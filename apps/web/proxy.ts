import { NextResponse, type NextRequest } from "next/server";

/** Replace inbound nonce headers with an unpredictable nonce for each fresh page. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: https://cdn.discordapp.com https://*.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-content-type-options", "nosniff");
  if (process.env.APP_ORIGIN?.startsWith("https:"))
    response.headers.set("strict-transport-security", "max-age=31536000");

  return response;
}

/** Skip API and static assets; pages and client navigation receive fresh nonce headers. */
export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico|fonts).*)",
};
