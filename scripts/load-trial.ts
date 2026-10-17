/** @file Disposable staging burst trial: run with --import tsx against a loopback web process and an exclusive *_test database with SMTP catcher. Creates fictional accounts/seasons/reports and reports aggregate latency/status only. Never run on participant data. */
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createRepository } from "@challenge/db";
import { createAuth, createTracker } from "../packages/core/src/index.js";

/** Validate integer inputs before creating any synthetic data or network work. */
function integer(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}`);

  return value;
}

/** Run the explicitly confirmed disposable trial; failed requests are measured and never silently retried. */
async function main() {
  const connection = process.env.TRACKER_TEST_DATABASE_URL;
  const origin = new URL(process.env.QA_BASE_URL ?? "http://127.0.0.1:3101");
  if (
    !connection ||
    !/_(test|ci)$/.test(new URL(connection).pathname) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    process.env.TRIAL_CONFIRM_SMTP_CATCHER !== "1"
  )
    throw new Error(
      "Disposable database, loopback origin and TRIAL_CONFIRM_SMTP_CATCHER=1 required"
    );

  const users = integer("TRIAL_USERS", 20, 1, 100),
    duration = integer("TRIAL_DURATION_MS", 120000, 0, 600000);

  const db = createRepository(connection);
  const tracker = createTracker(db.repository);
  const times: number[] = [];
  const statuses: Record<string, number> = {};
  /** Measure one bounded HTTP write, keeping cookies/proofs only in private process memory. */
  async function request(
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, origin), {
        method: "POST",
        headers: {
          origin: origin.origin,
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      times.push(performance.now() - start);
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      if (!response.ok) return null;

      const data = await response.json();
      return { data, cookies: response.headers.getSetCookie() };
    } catch {
      statuses.network = (statuses.network ?? 0) + 1;
      return null;
    }
  }

  try {
    await db.probe();
    // Prove the loopback server uses this disposable database before any signup
    // HTTP write. An unrelated server receives only a fictional failed login.
    const proofMail: { token: string }[] = [];
    const probeAuth = createAuth(db.repository, {
      sendMail: async (mail) => {
        proofMail.push(mail);
      },
    });

    const probeEmail = `probe-${randomUUID()}@example.invalid`,
      probePassword = `fictional-probe-${randomUUID()}`;

    await probeAuth.execute({
      action: "signup",
      username: `probe-${randomUUID().slice(0, 20)}`,
      email: probeEmail,
      password: probePassword,
    });

    if (!proofMail[0]) throw new Error("Missing disposable probe");

    await probeAuth.execute({ action: "verify", token: proofMail[0].token });
    const probeLogin = await request("/api/v1/auth", {
      action: "login",
      email: probeEmail,
      password: probePassword,
    });

    if (!probeLogin) throw new Error("Web/database target mismatch");

    const probeCookie = probeLogin.cookies
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    const probeResponse = await fetch(new URL("/api/v1/session", origin), {
      headers: { cookie: probeCookie },
      signal: AbortSignal.timeout(5000),
    });

    const probeAccount = await probeResponse.json();
    const probeCredential = await db.repository.transaction((tx) =>
      tx.list("credentials", { email: probeEmail })
    );

    if (
      !probeResponse.ok ||
      probeAccount.account?.id !== probeCredential[0]?.userId
    )
      throw new Error("Web/database target mismatch");

    const admin = await tracker.createUser(true);
    const season = await tracker.execute(
      admin,
      {
        command: "CreateSeason",
        slug: `load-${randomUUID()}`,
        title: "Synthetic load trial",
      },
      randomUUID()
    );

    await tracker.execute(
      admin,
      {
        command: "PublishSeason",
        seasonId: season.resourceId,
        expectedSeasonVersion: 0,
      },
      randomUUID()
    );

    const accounts = await Promise.all(
      Array.from({ length: users }, async (_, index) => {
        await setTimeout(Math.floor((index * duration) / users));
        const username = `trial-${randomUUID().slice(0, 20)}`,
          email = `${username}@example.invalid`,
          password = `fictional-trial-${randomUUID()}`;

        if (
          !(await request("/api/v1/auth", {
            action: "signup",
            username,
            email,
            password,
          }))
        )
          return null;

        // Verification latency is a separate provider gate. Confirm only this trial's newly created disposable credential.
        const id = await db.repository.transaction(async (tx) => {
          const found = (await tx.list("credentials", { email }))[0];
          if (!found) throw new Error("Synthetic credential missing");

          await tx.get("users", found.userId, true);
          const credential = await tx.get("credentials", found.id, true);
          if (!credential) throw new Error("Synthetic credential missing");

          credential.verified = true;
          await tx.save("credentials", credential);
          return credential.userId;
        });

        const login = await request("/api/v1/auth", {
          action: "login",
          email,
          password,
        });

        if (!login) return null;

        const cookies = login.cookies
          .map((cookie) => cookie.split(";")[0])
          .join("; ");

        const csrf = login.cookies
          .find((cookie) => cookie.startsWith("challenge_csrf="))
          ?.split(";")[0]
          ?.split("=")[1];

        if (!csrf) throw new Error("Synthetic session missing");

        const enrollment = await tracker.execute(
          id,
          { command: "Enroll", seasonId: season.resourceId },
          randomUUID()
        );

        const attempt = await tracker.execute(
          id,
          {
            command: "StartAttempt",
            enrollmentId: enrollment.resourceId,
            expectedEnrollmentVersion: enrollment.version,
            goals: [{ title: "Synthetic practice", kind: "qualitative" }],
          },
          randomUUID()
        );

        return { attempt, cookies, csrf };
      })
    );

    const ready = accounts.filter((account) => account !== null);
    await Promise.all(
      ready.slice(0, 20).map((account) =>
        request(
          "/api/v1/command",
          {
            command: "SubmitReport",
            attemptId: account.attempt.resourceId,
            expectedAttemptVersion: account.attempt.version,
            body: "Synthetic load report",
            goalValues: [],
          },
          {
            cookie: account.cookies,
            "x-csrf-token": account.csrf,
            "idempotency-key": randomUUID(),
          }
        )
      )
    );

    let persistedReports = 0;
    for (const account of ready.slice(0, 20))
      persistedReports += (
        await db.repository.transaction((tx) =>
          tx.list("reports", { attemptId: account.attempt.resourceId })
        )
      ).length;

    if (persistedReports !== Math.min(ready.length, 20))
      throw new Error("Synthetic report count mismatch");

    times.sort((a, b) => a - b);
    const percentile = (fraction: number) =>
      Math.round(
        times[
          Math.min(times.length - 1, Math.floor(times.length * fraction))
        ] ?? 0
      );

    console.info(
      JSON.stringify({
        users,
        durationMs: duration,
        authenticated: ready.length,
        persistedReports,
        statuses,
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        maxMs: Math.round(times.at(-1) ?? 0),
      })
    );

    if (
      ready.length !== users ||
      Object.keys(statuses).some((status) => !/^2\d\d$/.test(status))
    )
      process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch(() => {
  console.error(
    "Synthetic load trial failed. Check the isolated stack and private configuration; no request bodies or credentials were logged."
  );

  process.exitCode = 1;
});
