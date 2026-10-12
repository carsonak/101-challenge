import { seasonSchema } from "@challenge/contracts";
import type { Repository } from "../model.js";
import type { createTrackerActor } from "./actor.js";
import { requireRule } from "./shared.js";

/** Build seasons behavior using the owning service dependencies. */
export function createTrackerSeasons(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
}) {
  const { repository, actor } = context;
  return {
    /** List published seasons; administrators can separately request drafts. */
    async seasons(userId?: string, includeDrafts = false) {
      return repository.transaction(async (tx) => {
        if (includeDrafts) {
          requireRule(userId, "UNAUTHENTICATED");
          requireRule((await actor(tx, userId)).admin, "FORBIDDEN");
        }

        const rows = await tx.list(
          "seasons",
          includeDrafts ? {} : { state: "published" }
        );

        return rows.map((s) =>
          seasonSchema.parse({
            id: s.id,
            slug: s.slug,
            publishedAt: s.publishedAt,
            title: s.title,
            description: s.description,
            featured: s.featured,
            state: s.state,
            version: s.version,
            goals: s.goals,
            milestones: s.milestones,
            sessionUrl: s.sessionUrl,
          })
        );
      });
    },
  };
}
