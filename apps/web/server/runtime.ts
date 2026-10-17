import { after } from "next/server";
import { createWakeClient } from "./wake";
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

  if (
    config.APP_ORIGIN.startsWith("https:") &&
    (!config.TRUSTED_PROXY_HEADER || !config.TRUSTED_PROXY_HOPS)
  )
    logBackend("web", "proxy_trust_unconfigured");

  const database = createRepository(
    config.DATABASE_URL,
    true,
    createWakeClient(config, after)
  );

  const mail = createMailer(config);
  const auth = createAuth(database.repository, {
    sendMail: mail.send,
    cooldown: database.rates,
  });

  const tracker = createTracker(database.repository, {
    timezone: config.REPORTING_TIMEZONE,
  });

  const providers = createProviders(config);
  logBackend("web", "runtime_ready");
  return {
    config,
    database,
    auth,
    tracker,
    api: createWebApi({
      config,
      auth,
      tracker,
      providers,
      rates: database.rates,
    }),
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
      if (
        /^\/api\/auth\/(google|discord)\/callback$/.test(
          new URL(request.url).pathname
        )
      ) {
        const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
        return new Response(null, {
          status: 303,
          headers: {
            location: `${origin}/login?error=oauth`,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "set-cookie": `challenge_oauth=; Path=/; SameSite=Lax; Max-Age=0; HttpOnly${origin.startsWith("https:") ? "; Secure" : ""}`,
          },
        });
      }

      return Response.json(
        { error: "Service unavailable" },
        { status: 503, headers: { "cache-control": "private, no-store" } }
      );
    });
  }
}
