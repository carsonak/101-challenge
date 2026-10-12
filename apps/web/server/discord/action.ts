import type { DiscordDependencies, Summary } from "./types";

/** Build action behavior for a private Discord interaction. */
export function createDiscordAction(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
}) {
  const { deps } = context;
  /** Make an opaque expiring action carrying only resource versions. */
  async function action(
    userId: string,
    s: Summary,
    kind: "report" | "start" | "pause" | "resume" | "custom" | "dashboard"
  ) {
    return deps.database.interactionForm({
      userId,
      kind,
      enrollmentId: s.id,
      enrollmentVersion: s.version,
      resourceId:
        kind === "report" ? (s.report?.id ?? s.attemptId ?? s.id) : s.id,
      version:
        kind === "report"
          ? (s.report?.version ?? s.attemptVersion ?? 0)
          : s.version,
    });
  }

  return action;
}
