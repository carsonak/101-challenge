import { createDiscordReply } from "./reply";
import { createPublicKey, verify } from "node:crypto";
import type { DiscordDependencies, Interaction } from "./types";

import { createDiscordResponse } from "./response";
/** Signed guild actor validated before private work begins. */
export type GuildInteraction = Interaction & {
  member: { user: { id: string } };
  guild_id: string;
};

/** Read bounded signed bytes and reject invalid requests before actor lookup. */
export async function readInteraction(
  request: Request,
  deps: DiscordDependencies,
  now: () => number
): Promise<Response | GuildInteraction> {
  const response = createDiscordResponse({});
  const reply = createDiscordReply({
    localWebsite: ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(deps.origin).hostname
    ),
  });

  if (!deps.publicKey) return new Response(null, { status: 404 });

  const signature = request.headers.get("x-signature-ed25519"),
    timestamp = request.headers.get("x-signature-timestamp");

  if (
    !signature ||
    !/^[a-f0-9]{128}$/i.test(signature) ||
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    Math.abs(now() / 1000 - Number(timestamp)) > 300
  )
    return new Response(null, { status: 401 });

  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 401 });

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }

    chunks.push(value);
  }

  const body = Buffer.concat(chunks);
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(deps.publicKey, "hex"),
      ]),
      format: "der",
      type: "spki",
    });

    if (
      !verify(
        null,
        Buffer.concat([Buffer.from(timestamp), body]),
        key,
        Buffer.from(signature, "hex")
      )
    )
      return new Response(null, { status: 401 });
  } catch {
    return new Response(null, { status: 401 });
  }

  let input: Interaction;
  try {
    input = JSON.parse(body.toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }

  if (input?.type === 1) return response({ type: 1 });

  if (!input?.guild_id || !input.member?.user?.id)
    return response(
      reply("Use these commands in your server, or visit the website.")
    );

  if (
    !/^\d{1,30}$/.test(input.id) ||
    !/^\d{1,30}$/.test(input.application_id) ||
    !/^\d{1,30}$/.test(input.member.user.id) ||
    typeof input.token !== "string" ||
    input.token.length === 0
  )
    return new Response(null, { status: 400 });

  return input as GuildInteraction;
}
