import { discordLimits } from "./manifest";
import type { Component } from "./types";
/** Validate every outgoing payload without including values in failures. */
export function validateDiscordPayload(payload: {
  type: number;
  data?: Record<string, unknown>;
}) {
  const data = payload.data;
  if (!data) return;

  const fail = () => {
    throw new Error("Discord response exceeds documented limits");
  };

  if (
    typeof data.content === "string" &&
    data.content.length > discordLimits.content
  )
    fail();

  if (payload.type === 8) {
    const choices = data.choices as { name: string; value: string }[];
    if (
      choices.length > discordLimits.choices ||
      choices.some(
        (c) => c.name.length > discordLimits.choiceName || c.value.length > 100
      )
    )
      fail();
  }

  if (
    payload.type === 9 &&
    (String(data.title).length > discordLimits.modalTitle ||
      String(data.custom_id).length > discordLimits.customId)
  )
    fail();

  const components = (data.components ?? []) as Component[];
  if (components.length > 5) fail();

  const visit = (c: Component) => {
    if (c.custom_id && c.custom_id.length > discordLimits.customId) fail();

    if (
      c.label &&
      c.label.length >
        (c.type === 2 ? discordLimits.buttonLabel : discordLimits.label)
    )
      fail();

    if (typeof c.value === "string" && c.value.length > discordLimits.text)
      fail();

    if (
      c.type === 22 &&
      c.options &&
      (c.options.length > discordLimits.checkboxOptions ||
        c.options.some((o) => o.label.length > 100 || o.value.length > 100))
    )
      fail();

    if (c.components && c.components.length > discordLimits.buttons) fail();

    c.components?.forEach(visit);
    if (c.component) visit(c.component);
  };

  components.forEach(visit);
}
