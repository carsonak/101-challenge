import type { HealthResponse } from "@challenge/contracts";

/**
 * Handle `GET /api/health` for liveness monitoring.
 * Returns HTTP 200 with the web health payload; does not check external dependencies.
 */
export function GET() {
  return Response.json({
    status: "ok",
    service: "web",
  } satisfies HealthResponse);
}
