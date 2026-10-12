import { DomainError } from "@challenge/core";
import type { ApiContext, RequestContext } from "./context";
import { json, payload } from "./transport";
/** Dispatch commands routes, returning undefined when unmatched. */
export function createCommandsRoutes(context: ApiContext) {
  const { auth, tracker, rates } = context;

  return async function handle({
    request,
    path,
    token,
    csrf,
  }: RequestContext): Promise<Response | undefined> {
    if (request.method === "POST" && path === "/api/v1/command") {
      if (!csrf) throw new DomainError("FORBIDDEN");

      const input = await payload(request);
      if (!input || typeof input !== "object")
        throw new DomainError("VALIDATION");

      const cmd = input as { command?: unknown };
      const recent =
        cmd.command === "IssueCorrectionGrant" ||
        cmd.command === "RevokeCorrectionGrant";

      const actor = await auth.authenticate(token, csrf, recent);
      rates.take("mutation", actor.userId, 120, 60000);
      const key = request.headers.get("idempotency-key");
      if (!key || !/^[-\w:]{1,200}$/.test(key))
        throw new DomainError("VALIDATION");

      return json(await tracker.execute(actor.userId, input, key));
    }
  };
}
