import { after } from "next/server";
import { observeRequest } from "../../../server/logging";
import { runtime } from "../../../server/runtime";
import { createDiscordAdapter } from "../../../server/discord";
/** Signed HTTP guild endpoint; disabled until a portal public key is configured. */
export async function POST(request: Request) {
  return observeRequest(request, async (recordError, requestId) => {
    try {
      const services = runtime();
      return await createDiscordAdapter({
        ...services,
        publicKey: services.config.DISCORD_PUBLIC_KEY,
        origin: services.config.APP_ORIGIN,
        schedule: after,
        requestId,
        deliver: async (application, token, data) => {
          const response = await fetch(
            `https://discord.com/api/v10/webhooks/${application}/${token}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(data),
              signal: AbortSignal.timeout(5000),
            }
          );
          if (!response.ok) throw new Error("Private response unavailable");
        },
      }).handle(request);
    } catch (error) {
      recordError(error);
      return new Response(null, { status: 503 });
    }
  });
}
