import type { HealthResponse } from "@challenge/contracts";

// Infrastructure probes are injected; domain code does not import drivers/frameworks.
/**
 * Run an availability check and return a safe health payload for a web or worker endpoint.
 * Await this when deciding readiness; a rejected probe becomes `unavailable`
 * without exposing its error. The probe runs once and owns any I/O and cleanup it needs.
 *
 * @param service Service identified by the returned payload.
 * @param probe Async check that resolves when the required dependency is available.
 * @returns An `ok` or `unavailable` payload; does not select an HTTP response status.
 */
export async function readiness(
  service: HealthResponse["service"],
  probe: () => Promise<void>
): Promise<HealthResponse> {
  try {
    await probe();
    return { status: "ok", service };
  } catch {
    return { status: "unavailable", service };
  }
}

export * from "./model.js";
export * from "./rules.js";
export * from "./tracker.js";
