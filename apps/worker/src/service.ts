import { createServer } from "node:http";
import {
  logBackend,
  readiness,
  verifyWake,
  type createWorkLoop,
} from "@challenge/core";

/**
 * Private worker listener. Signed POST /wake accepts no body and coalesces scans.
 * Request mode awaits one bounded sweep; its content-free deadline must be handed
 * to a durable platform scheduler. Health never accesses PostgreSQL.
 */
export function serveWorker(options: {
  service: "worker" | "maintenance";
  host: string;
  port: number;
  secret?: string;
  resident: boolean;
  loop: ReturnType<typeof createWorkLoop>;
  ready: () => Promise<void>;
  close: () => Promise<void>;
}) {
  const server = createServer(
    { requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 },
    async (request, response) => {
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", "application/json");
      if (request.method === "GET" && request.url === "/health") {
        response.end(JSON.stringify({ status: "ok", service: "worker" }));
        return;
      }

      if (request.method === "GET" && request.url === "/ready") {
        const result = await readiness("worker", options.ready);
        response
          .writeHead(result.status === "ok" ? 200 : 503)
          .end(JSON.stringify(result));

        return;
      }

      if (
        request.method !== "POST" ||
        request.url !== "/wake" ||
        !options.secret
      ) {
        response.writeHead(404).end();
        return;
      }

      const timestamp = request.headers["x-work-timestamp"];
      const signature = request.headers["x-work-signature"];
      if (
        !verifyWake(
          options.secret,
          options.service,
          typeof timestamp === "string" ? timestamp : undefined,
          typeof signature === "string" ? signature : undefined
        )
      ) {
        response.writeHead(401, { connection: "close" }).end();
        return;
      }

      if (
        request.headers["transfer-encoding"] ||
        (request.headers["content-length"] &&
          request.headers["content-length"] !== "0")
      ) {
        response.writeHead(400, { connection: "close" }).end();
        return;
      }

      try {
        options.loop.poke();
        const nextRunAt = options.resident
          ? options.loop.nextRunAt()
          : await options.loop.run();

        response
          .writeHead(options.resident ? 202 : 200)
          .end(
            JSON.stringify({ nextRunAt: new Date(nextRunAt).toISOString() })
          );
      } catch (error) {
        logBackend("worker", "queue_failed", {}, error);
        response
          .writeHead(503, { "retry-after": "30" })
          .end(JSON.stringify({ error: "Work temporarily unavailable" }));
      }
    }
  );

  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  let closing: Promise<void> | undefined;
  /** Stop accepting work, await active sweeps, then release database/transport handles. */
  function close() {
    closing ??= (async () => {
      server.closeIdleConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await options.loop.stop();
      await options.close();
    })();

    return closing;
  }

  return {
    /** Listen before enabling timer execution so the process always has a lifecycle owner. */
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port, options.host, resolve);
      });

      if (options.resident) options.loop.poke();
    },
    close,
    /** Bound listener address, useful for ephemeral-port integration tests. */
    address: () => server.address(),
  };
}
