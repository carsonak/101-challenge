import type { HealthResponse } from '@challenge/contracts';

export function GET() {
  return Response.json({
    status: 'ok',
    service: 'web',
  } satisfies HealthResponse);
}
