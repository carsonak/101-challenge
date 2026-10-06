import { handleApi } from "../../../../../server/runtime";
/** Callback state must never be cached. */
export const dynamic = "force-dynamic";
/** Complete only Google/Discord callbacks through exact allowlisted redirects. */
export async function GET(request: Request) {
  return handleApi(request);
}
