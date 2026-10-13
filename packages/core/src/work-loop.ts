/** Bounds for active batching, empty-queue recovery and failures, in milliseconds. */
export interface WorkTiming {
  /** Smallest delay between active batches or coalesced pokes. */ minMs: number;
  /** Largest active backoff, including failures. */ maxMs: number;
  /** First recovery sweep after an empty queue. */ recoveryMinMs: number;
  /** Maximum missed-poke recovery delay. */ recoveryMaxMs: number;
}

/**
 * Serialize bounded sweeps and sleep until persisted work is due. Pokes are hints;
 * the sweep returns its earliest durable deadline or null. Request mode never
 * starts timers: callers must arrange durable external delivery of nextRunAt.
 * Stop awaits in-flight work. Failed sweeps reject explicit run() calls and use
 * bounded backoff in resident mode; no failure is interpreted as an empty queue.
 */
export function createWorkLoop(
  options: WorkTiming & {
    run: () => Promise<number | null>;
    resident: boolean;
    onError: (error: unknown) => void;
    now?: () => number;
  }
) {
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<number> | undefined;
  let stopped = false;
  let dirty = false;
  let delay = options.minMs;
  let recovery = options.recoveryMinMs;
  let nextRunAt = now();
  let lastStarted = -Infinity;
  let failures = 0;

  /** Arm one timer without database traffic; request mode leaves scheduling external. */
  function arm() {
    clearTimeout(timer);
    if (!options.resident || stopped) return;

    timer = setTimeout(
      () => void run().catch(options.onError),
      Math.max(0, nextRunAt - now())
    );
  }

  /** Perform at most one sweep, sharing simultaneous invocations and bounding repeated pokes. */
  function run(): Promise<number> {
    if (active) return active;

    if (stopped) return Promise.resolve(nextRunAt);

    if ((failures && now() < nextRunAt) || now() < lastStarted + options.minMs)
      return Promise.resolve(nextRunAt);

    clearTimeout(timer);
    lastStarted = now();
    dirty = false;
    active = (async () => {
      try {
        const due = await options.run();
        failures = 0;
        nextRunAt =
          due === null
            ? now() + recovery
            : Math.min(now() + recovery, Math.max(now() + options.minMs, due));

        if (due === null || due > now() + options.minMs)
          recovery = Math.min(options.recoveryMaxMs, recovery * 2);

        delay = Math.min(options.maxMs, delay * 2);
        if (dirty) nextRunAt = Math.min(nextRunAt, now() + delay);

        return nextRunAt;
      } catch (error) {
        failures++;
        nextRunAt =
          now() +
          Math.min(options.maxMs, options.minMs * 2 ** Math.min(failures, 20));

        throw error;
      } finally {
        active = undefined;
        arm();
      }
    })();

    return active;
  }

  return {
    run,
    /** Coalesce activity without allowing callers to postpone existing deadlines. */
    poke() {
      if (stopped) return;

      dirty = true;
      recovery = options.recoveryMinMs;
      delay = Math.max(options.minMs, Math.floor(delay / 2));
      // Failure backoff cannot be bypassed by repeated external wake-ups.
      if (!failures)
        nextRunAt = Math.min(nextRunAt, Math.max(now(), lastStarted + delay));

      if (!active) arm();
    },
    /** Next recommended invocation, including recovery of missed signals. */
    nextRunAt: () => nextRunAt,
    /** Cancel future timers and await the current sweep before releasing storage. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active?.catch(() => {});
    },
  };
}
