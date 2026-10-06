import type { HealthResponse } from '@challenge/contracts';

// Infrastructure probes are injected; domain code does not import drivers/frameworks.
export async function readiness(
  service: HealthResponse['service'],
  probe: () => Promise<void>,
): Promise<HealthResponse> {
  try {
    await probe();
    return { status: 'ok', service };
  } catch {
    return { status: 'unavailable', service };
  }
}
