import { logBackend, signWake } from "@challenge/core";
import type { parseServerConfig } from "@challenge/contracts";

/**
 * Create a best-effort post-commit notifier. Framework lifetime hooks retain the
 * bounded delivery after the response (at most three configured timeout budgets).
 * Queues remain durable if a poke is lost; destinations and signing keys are
 * server-owned and redirects are forbidden.
 */
export function createWakeClient(
  config: ReturnType<typeof parseServerConfig>,
  schedule: (work: () => Promise<void>) => void,
  transport: typeof fetch = fetch
) {
  const pending = new Set<"worker" | "maintenance">();
  const active = new Set<"worker" | "maintenance">();
  return (service: "worker" | "maintenance") => {
    const url =
      service === "worker"
        ? config.WORKER_WAKE_URL
        : config.MAINTENANCE_WAKE_URL;

    const secret =
      service === "worker"
        ? config.WORKER_WAKE_SECRET
        : config.MAINTENANCE_WAKE_SECRET;

    if (!url || !secret) return;

    pending.add(service);
    if (active.has(service)) return;

    active.add(service);
    try {
      schedule(async () => {
        try {
          // A commit during delivery needs another hint; cap work per request.
          for (
            let attempt = 0;
            attempt < 3 && pending.has(service);
            attempt++
          ) {
            pending.delete(service);
            const timestamp = String(Date.now());
            try {
              const response = await transport(url, {
                method: "POST",
                redirect: "error",
                signal: AbortSignal.timeout(config.WAKE_DELIVERY_TIMEOUT_MS),
                headers: {
                  "x-work-timestamp": timestamp,
                  "x-work-signature": signWake(secret, service, timestamp),
                },
              });

              await response.body?.cancel();
              if (!response.ok) throw new Error("Wake delivery unavailable");
            } catch {
              pending.add(service);
            }
          }

          if (pending.has(service))
            logBackend("web", "wake_failed", { failed: 1 });
        } finally {
          active.delete(service);
          pending.delete(service);
        }
      });
    } catch {
      active.delete(service);
      pending.delete(service);
      logBackend("web", "wake_failed", { failed: 1 });
    }
  };
}
