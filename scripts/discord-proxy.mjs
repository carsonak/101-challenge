/** @file Loopback-only exact-path proxy for a Discord quick tunnel. Run pnpm discord:proxy. Never logs requests. */
import { createServer } from "node:http";
import { request as upstreamRequest } from "node:http";
import { reportCliFailure } from "./cli-diagnostics.mjs";
try {
  /** Local production app; never accepts an arbitrary upstream target from request data. */
  const target = new URL(
    process.env.DISCORD_PROXY_TARGET ?? "http://127.0.0.1:3000"
  );
  if (
    target.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search
  )
    throw new Error("Proxy target must be a loopback HTTP origin");
  /** Bounded request streaming preserves the exact signature input. */
  const server = createServer((incoming, outgoing) => {
    if (incoming.method !== "POST" || incoming.url !== "/api/discord") {
      outgoing.writeHead(404).end();
      incoming.resume();
      return;
    }
    const headers = {
      "content-type": "application/json",
      "x-signature-ed25519": incoming.headers["x-signature-ed25519"] ?? "",
      "x-signature-timestamp": incoming.headers["x-signature-timestamp"] ?? "",
    };
    const upstream = upstreamRequest(
      new URL("/api/discord", target),
      { method: "POST", headers, timeout: 5000 },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        response.pipe(outgoing);
      }
    );
    let size = 0;
    incoming.on("data", (chunk) => {
      size += chunk.length;
      if (size > 65536) {
        upstream.destroy();
        if (!outgoing.headersSent) outgoing.writeHead(413).end();
      }
    });
    incoming.on("aborted", () => upstream.destroy());
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502).end();
    });
    incoming.pipe(upstream);
  });
  server.once("error", (error) => {
    reportCliFailure(
      "discord:proxy",
      error,
      "Check DISCORD_PROXY_PORT is available and DISCORD_PROXY_TARGET is a loopback HTTP origin in .env."
    );
    server.closeAllConnections();
    server.close();
    process.exitCode = 1;
  });
  server.listen(Number(process.env.DISCORD_PROXY_PORT ?? 3002), "127.0.0.1");
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      server.closeAllConnections();
      server.close();
    });
} catch (error) {
  reportCliFailure(
    "discord:proxy",
    error,
    "Check DISCORD_PROXY_PORT and the loopback HTTP DISCORD_PROXY_TARGET in .env."
  );
  process.exitCode = 1;
}
