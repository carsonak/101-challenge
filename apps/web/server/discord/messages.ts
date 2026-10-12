import { DomainError } from "@challenge/core";
import { discordLimits } from "./manifest";
import type { Component } from "./types";
/** Private message with mentions always disabled. */
export function message(content: string, components: unknown[] = []) {
  return {
    type: 4,
    data: { content, flags: 64, allowed_mentions: { parse: [] }, components },
  };
}

/** One website link, never a proof-bearing URL. */
export function link(label: string, url: string) {
  return { type: 2, style: 5, label, url };
}

/** One metadata-bound action. */
export function button(label: string, id: string, primary = false) {
  return { type: 2, style: primary ? 1 : 2, label, custom_id: id };
}

/** Wrap buttons into a documented action row. */
export function row(...components: unknown[]) {
  return { type: 1, components };
}

/** Escape user content to prevent markdown links/formatting and preserve full recovery text. */
export function escapeText(text: string) {
  return text.replace(/[\\`*_~|>[\]()]/g, "\\$&").replace(/@/g, "@\u200b");
}

/** Split recovery content by complete code points and escaped units; never break Unicode or Markdown escapes. */
export function recoveryChunks(text: string, limit = 1800) {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of text) {
    const escaped = escapeText(character);
    if (chunk.length + escaped.length > limit) {
      chunks.push(chunk);
      chunk = "";
    }

    chunk += escaped;
  }

  if (chunk) chunks.push(chunk);

  return chunks;
}

/** Label wrapper for the current Discord modal API. */
export function field(
  id: string,
  label: string,
  value = "",
  long = false,
  required = true
) {
  return {
    type: 18,
    label: label.slice(0, discordLimits.label),
    component: {
      type: 4,
      custom_id: id,
      style: long ? 2 : 1,
      required,
      max_length: long ? discordLimits.text : 200,
      ...(value ? { value } : {}),
    },
  };
}

/** Flatten only known modal components; reject duplicate identifiers. */
export function fields(components: Component[] = []) {
  const result = new Map<string, string | boolean | string[]>();
  const visit = (c: Component) => {
    if (c.custom_id) {
      if (result.has(c.custom_id)) throw new DomainError("VALIDATION");

      result.set(c.custom_id, c.values ?? c.value ?? "");
    }

    c.components?.forEach(visit);
    if (c.component) visit(c.component);
  };

  components.forEach(visit);
  return result;
}
