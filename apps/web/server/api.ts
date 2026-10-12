import { trackerErrorCodeSchema } from "@challenge/contracts";
import { DomainError, createThrottle } from "@challenge/core";
import { isIP } from "node:net";
import { createAuthenticationRoutes } from "./api/authentication";
import { createCommandsRoutes } from "./api/commands";
import { createOauthRoutes } from "./api/oauth";
import { createReadsRoutes } from "./api/reads";
import type { ApiDependencies } from "./api/transport";
import { cookie, cookieNames, json, setCookie } from "./api/transport";
import { observeRequest } from "./logging";
export { cookieNames, type ApiDependencies } from "./api/transport";

/** Browser API with actor-derived identity, origin/CSRF checks and safe projections. */
export function createWebApi(deps: ApiDependencies) {
  const { config } = deps;
  const secure = config.APP_ORIGIN.startsWith("https:");
  const rates = createThrottle(deps.now);
  /** Accept only a validated address from the explicitly configured ingress chain. */
  function address(request: Request) {
    if (!config.TRUSTED_PROXY_HOPS || !config.TRUSTED_PROXY_HEADER)
      return "local";

    const chain =
      request.headers
        .get(config.TRUSTED_PROXY_HEADER)
        ?.split(",")
        .map((value) => value.trim()) ?? [];

    const value = chain.at(-config.TRUSTED_PROXY_HOPS);
    return value && isIP(value) ? value : "unknown";
  }

  /** Persist fresh opaque cookies while returning no bearer token in JSON. */
  function loginCookies(
    response: Response,
    session: { token: string; csrf: string }
  ) {
    setCookie(response, cookieNames.session, session.token, secure, true);
    setCookie(response, cookieNames.csrf, session.csrf, secure, false);
  }

  const context = { ...deps, rates, address, loginCookies };
  const routes = [
    createReadsRoutes(context),
    createAuthenticationRoutes(context),
    createCommandsRoutes(context),
    createOauthRoutes(context),
  ];

  return {
    /** Dispatch native HTTP requests; adapters cannot override actor, date, mode or seeds. */
    async handle(request: Request): Promise<Response> {
      return observeRequest(request, async (recordError) => {
        try {
          const url = new URL(request.url),
            path = url.pathname;

          const token = cookie(request, cookieNames.session),
            csrf = request.headers.get("x-csrf-token") ?? undefined;

          if (
            request.method === "POST" &&
            request.headers.get("origin") !== config.APP_ORIGIN
          )
            throw new DomainError("FORBIDDEN");

          const context = { request, url, path, token, csrf, recordError };
          for (const route of routes) {
            const response = await route(context);
            if (response) return response;
          }

          return json({ code: "NOT_FOUND" }, 404);
        } catch (error) {
          recordError(error);
          const code = trackerErrorCodeSchema.safeParse(
            (error as { code?: unknown })?.code
          );

          if (!code.success) return json({ error: "Service unavailable" }, 503);

          const statuses: Record<string, number> = {
            UNAUTHENTICATED: 401,
            FORBIDDEN: 403,
            NOT_FOUND: 404,
            VALIDATION: 400,
            RATE_LIMITED: 429,
          };

          const response = json(
            { code: code.data },
            statuses[code.data] ?? 409
          );

          if (code.data === "RATE_LIMITED")
            response.headers.set(
              "retry-after",
              String((error as { retryAfter?: number }).retryAfter ?? 5)
            );

          return response;
        }
      });
    },
  };
}
