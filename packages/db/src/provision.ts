import pg from "pg";

/** Restricted deployment identities; passwords stay private and never appear in logs. */
export interface DatabaseLogins {
  /** Schema owner used only by operators. */ migrator: {
    name: string;
    password: string;
  };
  /** Public app login. */ web: { name: string; password: string };
  /** Outbox/queue login. */ worker: { name: string; password: string };
  /** Grace-period erasure and mail login. */ maintenance: {
    name: string;
    password: string;
  };
}
/** Provision dedicated logins before migrations, or grant runtime access afterward; idempotent operator I/O. */
export async function provisionDatabase(
  connection: string,
  logins: DatabaseLogins,
  queueSchema: string,
  phase: "roles" | "grants"
) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(queueSchema))
    throw new Error("Invalid queue schema");
  for (const value of Object.values(logins))
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(value.name) || !value.password)
      throw new Error("Invalid database login configuration");
  if (new Set(Object.values(logins).map((v) => v.name)).size !== 4)
    throw new Error("Database logins must be distinct");
  const pool = new pg.Pool({ connectionString: connection, max: 1 });
  const client = await pool.connect();
  const id = pg.escapeIdentifier;
  try {
    await client.query("BEGIN");
    if (phase === "roles") {
      for (const [kind, value] of Object.entries(logins)) {
        const exists = await client.query(
          "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1",
          [value.name]
        );
        if (
          exists.rowCount &&
          (exists.rows[0].rolsuper ||
            exists.rows[0].rolcreatedb ||
            exists.rows[0].rolreplication ||
            exists.rows[0].rolbypassrls ||
            (kind !== "migrator" && exists.rows[0].rolcreaterole))
        )
          throw new Error("Configured login has unexpected privileges");
        if (!exists.rowCount)
          await client.query(
            `CREATE ROLE ${id(value.name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`
          );
        await client.query(
          `ALTER ROLE ${id(value.name)} PASSWORD ${pg.escapeLiteral(value.password)}`
        );
        if (kind === "migrator")
          await client.query(`ALTER ROLE ${id(value.name)} CREATEROLE`);
      }
      const database = (await client.query("SELECT current_database() AS name"))
        .rows[0].name;
      await client.query(
        `GRANT CREATE ON DATABASE ${id(database)} TO ${id(logins.migrator.name)}`
      );
      await client.query(
        `GRANT USAGE,CREATE ON SCHEMA public TO ${id(logins.migrator.name)}`
      );
    } else {
      await client.query(
        `GRANT challenge_tracker_app TO ${id(logins.web.name)}`
      );
      await client.query(
        `GRANT challenge_tracker_erasure TO ${id(logins.migrator.name)},${id(logins.maintenance.name)}`
      );
      await client.query(
        `GRANT USAGE ON SCHEMA public TO ${id(logins.worker.name)},${id(logins.maintenance.name)}`
      );
      const worker = id(logins.worker.name),
        maintenance = id(logins.maintenance.name);
      await client.query(
        `GRANT SELECT ON tracker_migrations,outbox,event_receipts,source_projections TO ${worker}`
      );
      await client.query(
        `REVOKE SELECT ON attempts,enrollments FROM ${worker}`
      );
      await client.query(
        `GRANT SELECT(id,"enrollmentId","sourceVersion",status) ON attempts TO ${worker}`
      );
      await client.query(
        `GRANT SELECT(id,"userId") ON enrollments TO ${worker}`
      );
      await client.query(`GRANT SELECT(id) ON users TO ${worker}`);
      await client.query(`GRANT SELECT("attemptId") ON reports TO ${worker}`);
      await client.query(
        `GRANT UPDATE("updatedAt") ON users,attempts TO ${worker}`
      );
      await client.query(`GRANT UPDATE,DELETE ON outbox TO ${worker}`);
      await client.query(`GRANT INSERT ON event_receipts TO ${worker}`);
      await client.query(
        `GRANT INSERT,UPDATE ON source_projections TO ${worker}`
      );
      for (const table of [
        "sessions",
        "auth_tokens",
        "oauth_states",
        "replays",
        "adapter_confirmations",
        "grants",
      ]) {
        await client.query(
          `GRANT SELECT("expiresAt"),DELETE ON ${table} TO ${worker}`
        );
      }
      await client.query(
        `GRANT SELECT("createdAt","readAt","dismissedAt"),DELETE ON notifications TO ${worker}`
      );
      await client.query(
        `GRANT SELECT ON profiles,account_mail,erasure_requests TO ${maintenance}`
      );
      await client.query(`REVOKE SELECT ON users FROM ${maintenance}`);
      await client.query(
        `GRANT SELECT(id),UPDATE("updatedAt") ON users TO ${maintenance}`
      );
      await client.query(`GRANT UPDATE ON account_mail TO ${maintenance}`);
      await client.query(
        `CREATE SCHEMA IF NOT EXISTS ${id(queueSchema)} AUTHORIZATION ${worker}`
      );
      // Only the worker owns pg-boss DDL. Erasure functions execute as their migration owner.
      await client.query(
        `GRANT USAGE ON SCHEMA ${id(queueSchema)} TO ${id(logins.migrator.name)}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${worker} IN SCHEMA ${id(queueSchema)} GRANT SELECT,DELETE ON TABLES TO ${id(logins.migrator.name)}`
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
