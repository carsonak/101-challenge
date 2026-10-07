import { parseServerConfig } from "@challenge/contracts";
import { createAuth, createTracker, logBackend } from "@challenge/core";
import { createRepository } from "@challenge/db";
import { createWebApi } from "./api";
import { createMailer } from "./mail";
import { createProviders } from "./providers";
import { observeRequest } from "./logging";

/** Lazily initialized server-only connections; credential-free landing/health still work. */
let cached: ReturnType<typeof build> | undefined;
/** Build one private service container with restricted application transactions. */
function build() {
  const config = parseServerConfig(process.env);
  if (!config.DATABASE_URL) throw new Error("Database not configured");
  const database = createRepository(config.DATABASE_URL, true);
  const mail = createMailer(config);
  const auth = createAuth(database.repository, { sendMail: mail.send });
  const tracker = createTracker(database.repository);
  const providers = createProviders(config);
  logBackend("web", "runtime_ready");
  return {
    config,
    database,
    auth,
    tracker,
    api: createWebApi({ config, auth, tracker, providers }),
  };
}
/** Server-only runtime; never serialize the handle or configuration into client props. */
export function runtime() {
  cached ??= build();
  return cached;
}
/** Dispatch safely even when no database is configured; never expose startup errors. */
export async function handleApi(request: Request) {
  try {
    return await runtime().api.handle(request);
  } catch (error) {
    return observeRequest(request, async (recordError) => {
      recordError(error);
      return Response.json(
        { error: "Service unavailable" },
        { status: 503, headers: { "cache-control": "private, no-store" } }
      );
    });
  }
}
