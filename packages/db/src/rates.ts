import { DomainError, type Throttle } from "@challenge/core";
import type { QueryResult } from "pg";

/** Shared bounded reservations use database time and opaque keys; outages fail closed. */
export function createDatabaseThrottle(
  query: (sql: string, values: unknown[]) => Promise<QueryResult>
): Throttle {
  return {
    async take(action, identity, limit, windowMs) {
      const result = await query(
        "SELECT take_tracker_rate($1,$2,$3,$4) AS retry",
        [action, identity, limit, windowMs]
      );

      const retryAfter = Number(result.rows[0].retry);
      if (retryAfter)
        throw Object.assign(new DomainError("RATE_LIMITED"), { retryAfter });
    },
    async allow(action, identity, windowMs) {
      try {
        await this.take(action, identity, 1, windowMs);
        return true;
      } catch (error) {
        if (error instanceof DomainError && error.code === "RATE_LIMITED")
          return false;

        throw error;
      }
    },
  };
}
