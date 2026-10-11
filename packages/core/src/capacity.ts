import { DomainError } from "./tracker.js";

/** Bound expensive work and its waiting queue; rejected capacity is retryable. */
export function createCapacity(concurrency = 2, maxWaiting = 8) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return {
    /** Run one operation, releasing capacity even after failure. */
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (active >= concurrency) {
        if (waiting.length >= maxWaiting) throw new DomainError("RATE_LIMITED");
        await new Promise<void>((resolve) => waiting.push(resolve));
      } else active++;
      try {
        return await work();
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    },
  };
}
