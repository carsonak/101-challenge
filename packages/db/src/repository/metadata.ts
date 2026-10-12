import { randomUUID } from "node:crypto";
import type { QueryResult } from "pg";
import type pg from "pg";
/** Build metadata operations using the owning repository pool. */
export function createMetadata(context: {
  /** Pool owned and closed by the repository. */ pool: pg.Pool;
  /** Privileged access is unavailable to application-role handles. */ applicationRole: boolean;
  /** Application-role transaction query. */ adapterQuery: (
    text: string,
    values: unknown[]
  ) => Promise<QueryResult>;
}) {
  const { adapterQuery } = context;
  return {
    /** Recover the original enrollment version for a duplicate signed resume interaction without reading its private hash. */
    async resumeVersion(userId: string, key: string, enrollmentId: string) {
      const row = (
        await adapterQuery(
          `SELECT version FROM replays WHERE "userId"=$1 AND command='ResumeEnrollment' AND key=$2 AND "resourceId"=$3 AND "expiresAt">now()`,
          [userId, key, enrollmentId]
        )
      ).rows[0];

      return row ? Number(row.version) - 1 : undefined;
    },
    /** Create a ten-minute actor-bound interaction form with resource/version metadata only. */
    async interactionForm(input: {
      userId: string;
      kind:
        | "setup"
        | "update"
        | "edit"
        | "cancel"
        | "restart"
        | "dashboard"
        | "report"
        | "start"
        | "pause"
        | "resume"
        | "custom";
      resourceId: string;
      version: number;
      enrollmentId: string;
      enrollmentVersion: number;
    }) {
      const id = randomUUID();
      await adapterQuery(
        `INSERT INTO adapter_confirmations VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')`,
        [
          id,
          input.userId,
          input.kind,
          input.resourceId,
          input.version,
          input.enrollmentId,
          input.enrollmentVersion,
        ]
      );

      return id;
    },
    /** Resolve only an unexpired form owned by the authenticated actor; submitted bodies remain transient. */
    async interactionContext(id: string, userId: string) {
      return (
        await adapterQuery(
          'SELECT * FROM adapter_confirmations WHERE id=$1 AND "userId"=$2 AND "expiresAt">now()',
          [id, userId]
        )
      ).rows[0] as
        | {
            id: string;
            kind:
              | "setup"
              | "update"
              | "edit"
              | "cancel"
              | "restart"
              | "dashboard"
              | "report"
              | "start"
              | "pause"
              | "resume"
              | "custom";
            resourceId: string;
            version: number;
            enrollmentId: string;
            enrollmentVersion: number;
          }
        | undefined;
    },
  };
}
