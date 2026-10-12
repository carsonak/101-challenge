import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { requireRule } from "./shared.js";

/** Build seasonSave behavior using the owning service dependencies. */
export function createTrackerSeasonSave(_context: Record<string, never>) {
  async function seasonSave(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (
      c.command === "SaveSeason" ||
      c.command === "PublishSeason" ||
      c.command === "SetSeasonFeatured" ||
      c.command === "SaveSeasonTemplate"
    ) {
      requireRule(user.admin, "FORBIDDEN");
      const row = await tx.get("seasons", c.seasonId, true);
      requireRule(row, "NOT_FOUND");
      requireRule(row.version === c.expectedSeasonVersion, "VERSION_CONFLICT");
      if (c.command === "SaveSeason") {
        requireRule(row.state === "draft" || row.slug === c.slug, "FORBIDDEN");
        requireRule(
          !c.publishedAt ||
            (!row.publishedAt &&
              row.state === "published" &&
              c.publishedAt <= now),
          "VALIDATION"
        );

        await tx.serializeKey(`season-slug:${c.slug}`);
        requireRule(
          !(await tx.list("seasons", { slug: c.slug })).some(
            (s) => s.id !== row.id
          ),
          "VALIDATION"
        );

        row.title = c.title;
        row.description = c.description;
        row.slug = c.slug;
        if (c.publishedAt) row.publishedAt = c.publishedAt;
      }

      if (c.command === "PublishSeason") {
        row.state = "published";
        row.publishedAt ??= now;
      }

      if (c.command === "SetSeasonFeatured") row.featured = c.featured;

      if (c.command === "SaveSeasonTemplate") {
        row.goals = c.goals;
        row.milestones = c.milestones;
        row.sessionUrl = c.sessionUrl ?? null;
      }

      row.version++;
      row.updatedAt = now;
      await tx.save("seasons", row);
      return { resourceId: row.id, version: row.version };
    }
  }

  return seasonSave;
}
