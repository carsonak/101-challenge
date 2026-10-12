import { DomainError } from "@challenge/core";
import type { ApiContext, RequestContext } from "./context";
import { cookie, cookieNames, json, page, setCookie } from "./transport";
/** Dispatch reads routes, returning undefined when unmatched. */
export function createReadsRoutes(context: ApiContext) {
  const { config, auth, tracker } = context;

  const secure = config.APP_ORIGIN.startsWith("https:");
  return async function handle({
    request,
    url,
    path,
    token,
  }: RequestContext): Promise<Response | undefined> {
    if (request.method === "GET" && path === "/api/v1/session") {
      const flags = {
        google: config.googleEnabled,
        discord: config.discordEnabled,
      };

      if (!token) return json({ account: null, csrf: null, providers: flags });

      const proof = cookie(request, cookieNames.csrf);
      try {
        return json({
          account: await auth.account(token),
          csrf: proof,
          providers: flags,
        });
      } catch (error) {
        if ((error as { code?: unknown })?.code !== "UNAUTHENTICATED")
          throw error;

        // Expired or revoked cookies are an anonymous browser context.
        const response = json({
          account: null,
          csrf: null,
          providers: flags,
        });

        setCookie(response, cookieNames.session, "", secure, true, 0);
        setCookie(response, cookieNames.csrf, "", secure, false, 0);
        return response;
      }
    }

    if (request.method === "GET" && path === "/api/v1/seasons")
      return json(page(await tracker.seasons(), url, "seasons"));

    if (
      request.method === "GET" &&
      /^\/api\/v1\/seasons\/[a-f0-9-]{36}$/.test(path)
    ) {
      const season = (await tracker.seasons()).find(
        (s) => s.id === path.split("/").at(-1)
      );

      if (!season) throw new DomainError("NOT_FOUND");

      return json(season);
    }

    if (request.method === "GET" && path === "/api/v1/sessions") {
      await auth.authenticate(token);
      return json(await auth.sessions(token));
    }

    if (request.method === "GET" && path === "/api/v1/notifications") {
      await auth.authenticate(token);
      return json(await auth.notifications(token));
    }

    if (request.method === "GET" && path === "/api/v1/history") {
      const actor = await auth.authenticate(token);
      return json(page(await tracker.history(actor.userId), url, "history"));
    }

    if (request.method === "GET" && path === "/api/v1/export") {
      const actor = await auth.authenticate(token);
      const response = json({
        schemaVersion: 1,
        account: await auth.account(token),
        history: await tracker.history(actor.userId),
      });

      response.headers.set(
        "content-disposition",
        'attachment; filename="challenge-history.json"'
      );

      return response;
    }

    if (request.method === "GET" && path === "/api/v1/admin/stats") {
      const actor = await auth.authenticate(token);
      return json(await tracker.adminStats(actor.userId));
    }

    if (request.method === "GET" && path === "/api/v1/admin/seasons") {
      const actor = await auth.authenticate(token);
      return json(
        page(await tracker.seasons(actor.userId, true), url, "admin-seasons")
      );
    }
  };
}
