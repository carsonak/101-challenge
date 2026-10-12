/** @file PostgreSQL grant expiry/revocation and cross-attempt values reject atomically. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL grant expiry/revocation and cross-attempt values reject atomically",
  { skip: !url },
  async () => {
    const f = await fixture(),
      other = await fixture();

    try {
      const accepted = await f.submit(0);
      const window = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "attempt_window",
          attemptId: f.attemptId,
          durationMinutes: 60,
        },
        randomUUID()
      );

      f.setInstant("2026-01-01T10:00:00Z");
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CorrectReport",
            reportId: accepted.resourceId,
            expectedReportVersion: 0,
            body: "Expired",
            goalValues: [],
            key: window.rawKey,
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );

      const grant = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "single_report",
          reportId: accepted.resourceId,
        },
        randomUUID()
      );

      await f.tracker.execute(
        f.admin,
        { command: "RevokeCorrectionGrant", grantId: grant.resourceId },
        randomUUID()
      );

      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CorrectReport",
            reportId: accepted.resourceId,
            expectedReportVersion: 0,
            body: "Revoked",
            goalValues: [],
            key: grant.rawKey,
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );

      const foreign = required(
        required((await other.tracker.history(other.user))[0]).attempts[0]
      ).goalRevisions[0];

      const saved = await f.db.repository.transaction((tx) =>
        tx.get("reports", accepted.resourceId)
      );

      await assert.rejects(
        f.db.repository.transaction((tx) =>
          tx.save("reports", {
            ...required(saved),
            goalValues: [{ goalRevisionId: required(foreign).id, value: "1" }],
          })
        ),
        { code: "23503" }
      );

      assert.equal(
        (await f.tracker.source(f.user, f.attemptId)).reports[0]?.body,
        "Fictional progress"
      );
    } finally {
      await f.db.close();
      await other.db.close();
    }
  }
);
