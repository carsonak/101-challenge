import { randomUUID } from "node:crypto";
import { diagnosticRoute, logBackend } from "@challenge/core";

/**
 * Measure one API response and attach its server-generated diagnostic request ID.
 * The handler can record a caught error for safe classification in the completion log.
 * Request bodies, cookies, headers and query parameters are never logged.
 */
export async function observeRequest(
  request: Request,
  handle: (
    recordError: (error: unknown) => void,
    requestId: string
  ) => Promise<Response>
): Promise<Response> {
  const requestId = randomUUID();
  const started = performance.now();
  let failure: unknown;
  let status = 503;
  try {
    const response = await handle((error) => {
      failure = error;
    }, requestId);
    status = response.status;
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    logBackend(
      "web",
      "http_request",
      {
        requestId,
        route: diagnosticRoute(request.url),
        method: request.method,
        status,
        durationMs: performance.now() - started,
      },
      failure
    );
  }
}
