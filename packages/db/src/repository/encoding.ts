import type { Tables } from "@challenge/core";
import { columns } from "../columns.js";
/** Validate repository-owned table/column identifiers and encode private values. */
export function encoding(table: keyof Tables, key: string): string {
  const map: Record<string, string> = columns[table];
  const kind = map[key];
  if (!kind) throw new Error("Unknown repository column");

  return kind;
}

/** Convert application values into PostgreSQL wire values without precision loss. */
export function encode(
  table: keyof Tables,
  key: string,
  value: unknown
): unknown {
  const kind = encoding(table, key).replace("?", "");
  if (value === null) return null;

  if (kind === "json") return JSON.stringify(value);

  if (kind === "seed") return Buffer.from(String(value), "hex");

  return value;
}

/** Decode only typed persistence columns, retaining civil dates as date strings. */
export function decode<K extends keyof Tables>(
  table: K,
  raw: Record<string, unknown>
): Tables[K] {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const kind = encoding(table, key).replace("?", "");
    if (value === null) result[key] = null;
    else if (kind === "instant")
      result[key] = new Date(
        value instanceof Date ? value.getTime() : String(value)
      ).toISOString();
    else if (kind === "date" && value instanceof Date)
      result[key] =
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    else result[key] = Buffer.isBuffer(value) ? value.toString("hex") : value;
  }

  return result as unknown as Tables[K];
}
