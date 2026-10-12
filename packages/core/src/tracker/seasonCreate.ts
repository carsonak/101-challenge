import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { requireRule } from "./shared.js";

/** Build seasonCreate behavior using the owning service dependencies. */
export function createTrackerSeasonCreate(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ secret: () => string;
}) {
  const { id, secret } = context;
  async function seasonCreate(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "CreateSeason") {
      requireRule(user.admin, "FORBIDDEN");
      await tx.serializeKey(`season-slug:${c.slug}`);
      requireRule(
        !(await tx.list("seasons", { slug: c.slug })).length,
        "VALIDATION"
      );

      const seasonId = id();
      await tx.insert("seasons", {
        id: seasonId,
        title: c.title,
        slug: c.slug,
        publishedAt: null,
        description: c.description ?? null,
        state: "draft",
        featured: false,
        seasonSeed: secret(),
        goals: [],
        milestones: [],
        sessionUrl: null,
        version: 0,
        createdAt: now,
        updatedAt: now,
      });

      return { resourceId: seasonId, version: 0 };
    }
  }

  return seasonCreate;
}
