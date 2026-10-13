import { authCommandSchema } from "@challenge/contracts";
import { DomainError } from "@challenge/core";
import sharp from "sharp";
import type { ApiContext, RequestContext } from "./context";
import { cookieNames, json, payload, setCookie } from "./transport";
/** Dispatch authentication routes, returning undefined when unmatched. */
export function createAuthenticationRoutes(context: ApiContext) {
  const { config, auth, rates, ingressRates, address, loginCookies } = context;

  const secure = config.APP_ORIGIN.startsWith("https:");
  return async function handle({
    request,
    path,
    token,
    csrf,
  }: RequestContext): Promise<Response | undefined> {
    if (request.method === "POST" && path === "/api/v1/auth") {
      await ingressRates.take("auth-input", address(request), 100, 60000);
      const input = await payload(request);
      const c = authCommandSchema.safeParse(input);
      if (!c.success) throw new DomainError("VALIDATION");

      await rates.take("auth-input", address(request), 100, 60000);
      const action = c.data.action;
      const bucket = `auth-${action}`;
      await rates.take(
        bucket,
        address(request),
        action === "login" ? 20 : 60,
        60000
      );

      if ("email" in c.data)
        await rates.take(
          `${bucket}-email`,
          c.data.email.trim().toLowerCase(),
          10,
          15 * 60000
        );

      if (
        ![
          "login",
          "signup",
          "recover",
          "verify",
          "reset",
          "verify_recovery_email",
        ].includes(action)
      ) {
        const account = await auth.account(token);
        await rates.take("account-user", account.id, 120, 60000);
      }

      if (c.data.action === "set_avatar" && c.data.avatar) {
        const match =
          /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
            c.data.avatar
          );

        if (!match) throw new DomainError("VALIDATION");

        try {
          const clean = await sharp(Buffer.from(match[1] ?? "", "base64"), {
            limitInputPixels: 16000000,
            animated: false,
          })
            .rotate()
            .resize(256, 256, { fit: "cover", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

          c.data.avatar = `data:image/webp;base64,${clean.toString("base64")}`;
        } catch {
          throw new DomainError("VALIDATION");
        }
      }

      const ua = request.headers.get("user-agent") ?? "";
      const device = `${/Firefox/i.test(ua) ? "Firefox" : /Edg/i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser"} on ${/Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : "desktop"}`;
      const result = await auth.execute(c.data, token, csrf, device);
      const response = json({
        accepted: result.accepted,
        ...("requestId" in result ? { requestId: result.requestId } : {}),
      });

      if ("token" in result && "csrf" in result && result.token && result.csrf)
        loginCookies(response, {
          token: result.token,
          csrf: result.csrf,
        });

      if (
        ["logout", "unlink", "reset", "request_erasure"].includes(c.data.action)
      ) {
        setCookie(response, cookieNames.session, "", secure, true, 0);
        setCookie(response, cookieNames.csrf, "", secure, false, 0);
      }

      return response;
    }
  };
}
