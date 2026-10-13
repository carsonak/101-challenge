import { createWorkLoop, logBackend } from "@challenge/core";
import type { parseServerConfig } from "@challenge/contracts";
import type { createJobStore } from "@challenge/db";

/** Create sleeping projection/housekeeping execution; callers start it with poke() or run(). */
export function startJobs(
  store: ReturnType<typeof createJobStore>,
  config: ReturnType<typeof parseServerConfig>,
  now: () => number = Date.now
) {
  let housekeepingAt = now();
  let housekeepingDelay = config.HOUSEKEEPING_MIN_MS;
  const loop = createWorkLoop({
    minMs: config.OUTBOX_POLL_MS,
    maxMs: config.OUTBOX_IDLE_MAX_MS,
    recoveryMinMs: config.WORK_RECOVERY_MIN_MS,
    recoveryMaxMs: config.WORK_RECOVERY_MAX_MS,
    resident: config.WORK_MODE === "resident",
    now,
    onError: (error) => logBackend("worker", "outbox_failed", {}, error),
    async run() {
      await store.ready();
      const result = await store.publish(async (event) => {
        await store.process(event);
      });

      if (result.delivered || result.failed)
        logBackend("worker", "outbox_complete", result);

      if (now() >= housekeepingAt) {
        const cleaned = await store.housekeeping();
        housekeepingAt = cleaned.more
          ? now() + config.OUTBOX_POLL_MS
          : Math.min(now() + housekeepingDelay, cleaned.nextDue ?? Infinity);

        housekeepingDelay = Math.min(
          config.HOUSEKEEPING_MAX_MS,
          housekeepingDelay * 2
        );

        logBackend("worker", "housekeeping_complete");
      }

      const due = await store.nextDue();
      // Recovery scans remain bounded even when the only known work is far away.
      return Math.min(due ?? Infinity, housekeepingAt);
    },
  });

  return {
    ...loop,
    /** Activity reduces housekeeping latency and wakes one coalesced batch. */
    poke() {
      housekeepingDelay = config.HOUSEKEEPING_MIN_MS;
      housekeepingAt = Math.min(housekeepingAt, now() + housekeepingDelay);
      loop.poke();
    },
  };
}
