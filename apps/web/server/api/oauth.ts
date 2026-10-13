import { DomainError } from "@challenge/core";
import { randomBytes } from "node:crypto";
import type { ApiContext, RequestContext } from "./context";
import { cookie, cookieNames, json, payload, setCookie } from "./transport";
/** Dispatch oauth routes, returning undefined when unmatched. */
export function createOauthRoutes(context: ApiContext) {
  const {
    config,
    auth,
    providers,
    rates,
    ingressRates,
    address,
    loginCookies,
  } = context;

  const secure = config.APP_ORIGIN.startsWith("https:");
  return async function handle({
    request,
    url,
    path,
    token,
    csrf,
    recordError,
  }: RequestContext): Promise<Response | undefined> {
    if (request.method === "POST" && path === "/api/v1/oauth") {
      await ingressRates.take("oauth", address(request), 20, 60000);
      const value = await payload(request);
      if (!value || typeof value !== "object")
        throw new DomainError("VALIDATION");

      const input = value as { provider?: unknown; link?: unknown };
      if (
        (input.provider !== "google" && input.provider !== "discord") ||
        typeof input.link !== "boolean"
      )
        throw new DomainError("VALIDATION");

      await rates.take("oauth", address(request), 20, 60000);
      const browser = randomBytes(32).toString("hex");
      const state = await auth.beginOAuth(
        input.provider,
        browser,
        token,
        csrf,
        input.link
      );

      const response = json({
        url: providers.authorization(input.provider, state),
      });

      setCookie(response, cookieNames.oauth, browser, secure, true, 600);
      return response;
    }

    if (
      request.method === "GET" &&
      /^\/api\/auth\/(google|discord)\/callback$/.test(path)
    ) {
      const provider = path.includes("/google/") ? "google" : "discord";
      const state = url.searchParams.get("state"),
        code = url.searchParams.get("code"),
        browser = cookie(request, cookieNames.oauth);

      let destination = "/login";
      let response: Response;
      try {
        if (!state || !browser || state.length > 256)
          throw new DomainError("UNAUTHENTICATED");

        const saved = await auth.oauthState(provider, state, browser);
        if (saved.userId) destination = "/account";

        if (url.searchParams.has("error") || !code || code.length > 4096)
          throw new DomainError("UNAUTHENTICATED");

        const proof = await providers.exchange(saved, code);
        const session = await auth.completeOAuth(
          saved.id,
          browser,
          proof,
          token
        );

        response = new Response(null, {
          status: 303,
          headers: {
            location: `${config.APP_ORIGIN}/account`,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        });

        loginCookies(response, session);
      } catch (error) {
        recordError(error);
        response = new Response(null, {
          status: 303,
          headers: {
            location: `${config.APP_ORIGIN}${destination}?error=oauth`,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        });
      }

      setCookie(response, cookieNames.oauth, "", secure, true, 0);
      return response;
    }
  };
}
