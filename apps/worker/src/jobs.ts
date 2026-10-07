import { logBackend } from "@challenge/core";
import type { PgBoss } from "pg-boss";
import type { createJobStore } from "@challenge/db";
import { trackerEventSchema } from "@challenge/contracts";

/** Register v0.1 content-free handlers after readiness; return a timer cleanup function. */
export async function startJobs(
  boss: PgBoss,
  store: ReturnType<typeof createJobStore>
) {
  await store.ready();
  await boss.createQueue("tracker_projection", {
    policy: "singleton",
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 60,
    retentionSeconds: 30 * 86400,
  });
  await boss.createQueue("tracker_housekeeping", {
    policy: "singleton",
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
  });
  await boss.work("tracker_projection", async (jobs) => {
    for (const job of jobs)
      try {
        const outcome = await store.process(trackerEventSchema.parse(job.data));
        logBackend("worker", "projection_complete", { outcome });
      } catch (error) {
        logBackend("worker", "projection_failed", {}, error);
        throw new Error("Projection check unavailable");
      }
  });
  await boss.work("tracker_housekeeping", async () => {
    try {
      await store.housekeeping();
      logBackend("worker", "housekeeping_complete");
    } catch (error) {
      logBackend("worker", "housekeeping_failed", {}, error);
      throw new Error("Housekeeping unavailable");
    }
  });
  await boss.schedule(
    "tracker_housekeeping",
    "0 * * * *",
    {},
    { singletonKey: "hourly" }
  );
  let publishing: Promise<unknown> | undefined;
  /** Publish without overlapping this worker's own scan; queue errors never disclose supplied content. */
  function tick() {
    if (publishing) return;
    publishing = store
      .publish(async (event) => {
        await boss.send("tracker_projection", event, {
          singletonKey: event.eventId,
          retryLimit: 5,
          retryDelay: 30,
          retryBackoff: true,
        });
      })
      .then((result) => {
        if (result.delivered || result.failed)
          logBackend("worker", "outbox_complete", result);
      })
      .catch((error) => logBackend("worker", "outbox_failed", {}, error))
      .finally(() => {
        publishing = undefined;
      });
  }
  tick();
  const timer = setInterval(tick, 2000).unref();
  return async () => {
    clearInterval(timer);
    await publishing;
  };
}
