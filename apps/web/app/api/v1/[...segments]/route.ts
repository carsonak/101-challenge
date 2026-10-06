import { handleApi } from "../../../../server/runtime";
/** Private API reads bypass all framework caches. */
export const dynamic = "force-dynamic";
/** Handle allowlisted v1 queries with server-derived ownership. */
export async function GET(request: Request) {
  return handleApi(request);
}
/** Handle validated mutations with origin, CSRF and idempotency checks. */
export async function POST(request: Request) {
  return handleApi(request);
}
