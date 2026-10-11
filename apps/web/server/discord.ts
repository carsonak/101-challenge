import { createPublicKey, verify } from "node:crypto";
import { decimalValueSchema, errorMessage } from "@challenge/contracts";
import {
  logBackend,
  DomainError,
  type createAuth,
  type createTracker,
} from "@challenge/core";
import type { createRepository } from "@challenge/db";

/** Limits from https://docs.discord.com/developers/interactions/receiving-and-responding and /components/reference. */
export const discordLimits = {
  content: 2000,
  choices: 25,
  choiceName: 100,
  modalTitle: 45,
  modalFields: 5,
  label: 45,
  text: 4000,
  customId: 100,
  buttons: 5,
  buttonLabel: 80,
  checkboxOptions: 10,
} as const;
/** Guild-only daily-loop commands; registration uses this same manifest. */
export const guildCommands = [
  { name: "dashboard", description: "Your private progress and next action" },
  {
    name: "report",
    description: "Write or edit today's private report",
    options: [
      {
        type: 3,
        name: "season",
        description:
          "Choose a season when you have more than one active attempt",
        autocomplete: true,
      },
    ],
  },
  { name: "seasons", description: "Browse published seasons" },
  {
    name: "join",
    description: "Join a season by name",
    options: [
      {
        type: 3,
        name: "season",
        description: "Choose a published season",
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "help",
    description: "How to practise, report and manage your account",
  },
].map((command) => ({
  ...command,
  type: 1,
  contexts: [0],
  integration_types: [0],
}));
/** Injected private services; tokens and response text are transient, never logged. */
export interface DiscordDependencies {
  /** Safe request correlation. */ requestId?: string;
  /** Ed25519 portal key; absent disables endpoint. */ publicKey?: string;
  /** Canonical local/browser origin. */ origin: string;
  /** Linked actor service. */ auth: ReturnType<typeof createAuth>;
  /** Shared authorized domain service. */ tracker: ReturnType<
    typeof createTracker
  >;
  /** Actor-bound metadata store. */ database: ReturnType<
    typeof createRepository
  >;
  /** Retain deferred work after response. */ schedule: (
    work: () => Promise<void>
  ) => void;
  /** Deliver a private followup without persisting its token. */ deliver: (
    applicationId: string,
    token: string,
    data: unknown
  ) => Promise<void>;
  /** Injectable timestamp. */ now?: () => number;
}
/** Owner summary safe inside ephemeral Discord UI. */
type Summary = Awaited<
  ReturnType<ReturnType<typeof createTracker>["dailySummary"]>
>[number];
/** Transport component subset supports current labelled modal submissions. */
interface Component {
  type: number;
  custom_id?: string;
  value?: string | boolean;
  values?: string[];
  components?: Component[];
  component?: Component;
  label?: string;
  options?: { label: string; value: string }[];
}
/** Signed bounded interaction. */
interface Interaction {
  type: number;
  id: string;
  application_id: string;
  token: string;
  guild_id?: string;
  member?: { user?: { id?: string } };
  data?: {
    name?: string;
    custom_id?: string;
    options?: { name: string; value?: string; focused?: boolean }[];
    components?: Component[];
  };
}
/** Private message with mentions always disabled. */
function message(content: string, components: unknown[] = []) {
  return {
    type: 4,
    data: { content, flags: 64, allowed_mentions: { parse: [] }, components },
  };
}
/** One website link, never a proof-bearing URL. */
function link(label: string, url: string) {
  return { type: 2, style: 5, label, url };
}
/** One metadata-bound action. */
function button(label: string, id: string, primary = false) {
  return { type: 2, style: primary ? 1 : 2, label, custom_id: id };
}
/** Wrap buttons into a documented action row. */
function row(...components: unknown[]) {
  return { type: 1, components };
}
/** Escape user content to prevent markdown links/formatting and preserve full recovery text. */
function escapeText(text: string) {
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
/** Label wrapper for the current Discord modal API. */
function field(
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
function fields(components: Component[] = []) {
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
/** Verify raw signatures, acknowledge on time, and dispatch only owner-authorized commands. */
export function createDiscordAdapter(deps: DiscordDependencies) {
  const now = deps.now ?? Date.now;
  const localWebsite = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(deps.origin).hostname
  );
  /** Keep local website links understandable without exposing a public browser endpoint. */
  function reply(content: string, components: unknown[] = []) {
    const note =
      localWebsite && components.length
        ? "\n\n*During local testing, website links work on the computer running the app.*"
        : "";
    return message(content + note, components);
  }
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
  /** Read current state and build contextual private dashboard actions. */
  async function dashboard(userId: string) {
    const summaries = await deps.tracker.dailySummary(userId);
    if (!summaries.length)
      return reply(
        "## Begin your practice\nChoose a season with `/join`, then start a recommended plan or set your own goals.\n\nUse `/seasons` to see what is available.",
        [row(link("Explore seasons", `${deps.origin}/seasons`))]
      );
    const s =
      summaries.find((s) => s.participation === "active") ?? summaries[0];
    if (!s) throw new DomainError("NOT_FOUND");
    const count = Math.min(101, s.reportingDays);
    const grid = `${Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) =>
        y * 10 + x < count ? "■" : "□"
      ).join("")
    ).join("\n")}\n${count === 101 ? "◆" : "◇"} Day 101`;
    const buttons: unknown[] = [];
    if (s.participation === "active" && s.attemptState === "active") {
      buttons.push(
        button(
          s.report ? "Edit today's report" : "Report today",
          await action(userId, s, "report"),
          true
        )
      );
      buttons.push(button("Pause", await action(userId, s, "pause")));
    } else if (s.participation === "active" && !s.attemptId) {
      const season = (await deps.tracker.seasons()).find(
        (season) => season.id === s.seasonId
      );
      if (season?.goals.length)
        buttons.push(
          button(
            "Start recommended plan",
            await action(userId, s, "start"),
            true
          )
        );
      buttons.push(button("Custom goals", await action(userId, s, "custom")));
    } else if (s.participation === "paused")
      buttons.push(button("Resume", await action(userId, s, "resume"), true));
    else if (s.attemptState === "completed" && s.report)
      buttons.push(
        button("Edit today's report", await action(userId, s, "report"), true)
      );
    buttons.push(link("Open on website", `${deps.origin}/challenge/${s.id}`));
    return reply(
      `## ${escapeText(s.title.slice(0, 120))}\n**Today:** ${s.report ? "Your report is saved. You can still edit it today." : "No report saved yet."}\n\n**Reporting days:** ${s.reportingDays} / 101\n**Current streak:** ${s.currentStreak} days\n**Longest streak:** ${s.longestStreak} days\n**State:** ${s.participation === "paused" ? "Paused" : s.attemptState === "completed" ? "Completed" : !s.attemptId ? "Ready to start" : escapeText(s.participation)}\n\n\`\`\`\n${grid}\n\`\`\`\n■ Reported · □ Remaining · ◇ Day 101`,
      [row(...buttons)]
    );
  }
  /** Build a complete report modal or route oversized forms to the website. */
  async function reportModal(userId: string, s: Summary) {
    if (
      !s.attemptId ||
      !(
        s.attemptState === "active" ||
        (s.attemptState === "completed" && s.report)
      )
    )
      throw new DomainError("ATTEMPT_CLOSED");
    const measured = s.goals.filter((g) => g.kind !== "qualitative");
    const index = s.report?.reportingIndex ?? s.reportingDays + 1;
    const manual = s.report
      ? []
      : s.milestones.filter(
          (m) =>
            m.achievementKind === "manual" && m.targetReportingDay === index
        );
    if (
      1 + measured.length + Number(manual.length > 0) >
        discordLimits.modalFields ||
      manual.length > discordLimits.checkboxOptions
    )
      return reply(
        "## Finish your report on the website\nThis plan needs more fields than Discord can show. The website includes every goal value and milestone.",
        [row(link("Write your report", `${deps.origin}/challenge/${s.id}`))]
      );
    const components: unknown[] = [
      field("body", "Private daily report", s.report?.body ?? "", true),
    ];
    for (const g of measured)
      components.push(
        field(
          `goal:${g.revisionId}`,
          `${g.title}${g.unit ? ` (${g.unit})` : ""}`,
          s.report?.goalValues.find((v) => v.goalRevisionId === g.revisionId)
            ?.value ?? "",
          false,
          false
        )
      );
    if (manual.length)
      components.push({
        type: 18,
        label: "Milestones achieved today",
        component: {
          type: 22,
          custom_id: "milestones",
          min_values: 0,
          required: false,
          options: manual.map((m) => ({
            label: m.title.slice(0, 100),
            value: m.id,
          })),
        },
      });
    return {
      type: 9,
      data: {
        custom_id: await action(userId, s, "report"),
        title: s.report ? "Edit today's report" : "Report today",
        components,
      },
    };
  }
  /** Return a bounded response after validating it. */
  function response(
    payload:
      | ReturnType<typeof message>
      | { type: number; data?: Record<string, unknown> }
  ) {
    validateDiscordPayload(payload);
    return Response.json(payload);
  }
  return {
    /** Signed guild HTTP endpoint; transient followups use the injected framework lifetime hook. */
    async handle(request: Request): Promise<Response> {
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
      // Discord's signed continuation token is opaque; the raw-body bound limits its size.
      const subject = input.member.user.id;
      /** Deliver one validated private followup; delivery failure never rolls back a committed command. */
      async function send(payload: ReturnType<typeof message>) {
        validateDiscordPayload(payload);
        await deps.deliver(input.application_id, input.token, payload.data);
      }
      /** Immediate paths cannot defer then open a modal; no domain mutations occur here. */
      async function immediate() {
        const userId = await deps.auth.discordActor(subject);
        if (input.type === 4) {
          const term = String(
            input.data?.options?.find((o) => o.focused)?.value ?? ""
          ).toLowerCase();
          const choices =
            input.data?.name === "report"
              ? userId
                ? (await deps.tracker.dailySummary(userId))
                    .filter(
                      (s) =>
                        s.attemptState === "active" ||
                        (s.attemptState === "completed" && s.report)
                    )
                    .map((s) => ({ name: s.title, value: s.id }))
                : []
              : (await deps.tracker.seasons()).map((s) => ({
                  name: s.title,
                  value: s.id,
                }));
          return {
            type: 8,
            data: {
              choices: choices
                .filter((c) => c.name.toLowerCase().includes(term))
                .slice(0, discordLimits.choices)
                .map((c) => ({
                  ...c,
                  name: c.name.slice(0, discordLimits.choiceName),
                })),
            },
          };
        }
        if (!userId)
          return reply(
            "## Connect your account\n- **New here?** Sign in with Discord on the website.\n- **Already have an account?** Sign in there, then link Discord in Account settings.\n\nReturn to `/dashboard` when connected.",
            [row(link("Sign in or link Discord", `${deps.origin}/login`))]
          );
        const summaries = await deps.tracker.dailySummary(userId);
        if (input.type === 2 && input.data?.name === "report") {
          const selected = input.data.options?.find(
            (o) => o.name === "season"
          )?.value;
          const eligible = summaries.filter(
            (s) =>
              s.attemptState === "active" ||
              (s.attemptState === "completed" && s.report)
          );
          const s = selected
            ? eligible.find((s) => s.id === selected)
            : eligible.length === 1
              ? eligible[0]
              : undefined;
          if (!s)
            return reply(
              "## Choose your next step\n- Use `/report` and choose a season to write or edit today’s report.\n- Open `/dashboard` to start a plan or view progress."
            );
          return reportModal(userId, s);
        }
        const context = await deps.database.interactionContext(
          input.data?.custom_id ?? "",
          userId
        );
        if (!context) throw new DomainError("NOT_FOUND");
        if (context.kind === "start" || context.kind === "resume") {
          if (!input.data) throw new DomainError("VALIDATION");
          input.data.custom_id = `confirm:${context.id}`;
          return { type: -1 };
        }
        const s = summaries.find((s) => s.id === context.enrollmentId);
        if (!s) throw new DomainError("NOT_FOUND");
        if (context.kind === "report") return reportModal(userId, s);
        if (context.kind === "custom")
          return {
            type: 9,
            data: {
              custom_id: context.id,
              title: "Your first goals",
              components: [
                field("goal1", "First goal"),
                field("goal2", "Second goal (optional)", "", false, false),
                field("goal3", "Third goal (optional)", "", false, false),
              ],
            },
          };
        if (context.kind === "pause")
          return reply(
            "## Pause this practice?\n**Your reporting days remain safe.**\n\n- Your current streak resets.\n- Credits and perks expire immediately.\n- Another unfinished season can start on the next reporting day.\n\nConfirm below to pause, or keep practising.",
            [
              row(
                button("Confirm pause", `confirm:${context.id}`),
                link("Keep practising", `${deps.origin}/challenge/${s.id}`)
              ),
            ]
          );
        throw new DomainError("VALIDATION");
      }
      const immediatePath =
        input.type === 4 ||
        (input.type === 2 && input.data?.name === "report") ||
        (input.type === 3 && !input.data?.custom_id?.startsWith("confirm:"));
      // Components which mutate are deferred; form-opening and pause prompts must be immediate.
      if (immediatePath && !input.data?.custom_id?.startsWith("confirm:")) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fallback =
          input.type === 4
            ? { type: 8, data: { choices: [] } }
            : reply(
                "This form is taking too long. Try again or use the website.",
                [row(link("Open website", `${deps.origin}/home`))]
              );
        try {
          const prepared = await Promise.race([
            immediate(),
            new Promise<typeof fallback>((resolve) => {
              timer = setTimeout(() => resolve(fallback), 2000).unref();
            }),
          ]);
          if (prepared.type !== -1) return response(prepared);
        } catch (error) {
          logBackend(
            "web",
            "discord_form_failed",
            { requestId: deps.requestId },
            error
          );
          return response(
            input.type === 4
              ? { type: 8, data: { choices: [] } }
              : reply(errorMessage((error as { code?: string }).code))
          );
        } finally {
          clearTimeout(timer);
        }
      }
      const work = async () => {
        let submitted: ReturnType<typeof fields> | undefined;
        try {
          if (input.type === 2 && input.data?.name === "help") {
            await send(
              reply(
                "## Your daily practice\nA truthful report counts even without goal activity. Missing dates affect streaks, never your reporting-day total.\n\n**Today**\n- `/dashboard` — progress, start a plan, pause or resume.\n- `/report` — write or edit today’s private report.\n\n**Find your practice**\n- `/seasons` — browse published seasons.\n- `/join` — choose a season by name.\n\n**On the website**\nManage detailed goals, backfill, restart, cancellation and corrections. Your replies and report text stay private.",
                [row(link("Open website", `${deps.origin}/home`))]
              )
            );
            return;
          }
          if (input.type === 2 && input.data?.name === "seasons") {
            const seasons = await deps.tracker.seasons();
            await send(
              reply(
                seasons.length
                  ? `## Find your practice\n${seasons
                      .slice(0, 10)
                      .map(
                        (s) =>
                          `- **${escapeText(s.title.slice(0, 80))}**${s.featured ? " · Featured" : ""}`
                      )
                      .join(
                        "\n"
                      )}\n\nUse \`/join\` and choose a season by name.`
                  : "## Seasons\nNo seasons are published yet. Check back soon.",
                [row(link("Browse all seasons", `${deps.origin}/seasons`))]
              )
            );
            return;
          }
          if (input.type === 5) submitted = fields(input.data?.components);
          const userId = await deps.auth.discordActor(subject);
          if (!userId) {
            if (input.type === 5) throw new DomainError("UNAUTHENTICATED");
            await send(
              reply(
                "## Connect your account\n- **New here?** Sign in with Discord on the website.\n- **Already have an account?** Sign in there, then link Discord in Account settings.\n\nReturn to `/dashboard` when connected.",
                [row(link("Sign in or link Discord", `${deps.origin}/login`))]
              )
            );
            return;
          }
          if (input.type === 2 && input.data?.name === "join") {
            const seasonId = input.data.options?.find(
              (o) => o.name === "season"
            )?.value;
            await deps.tracker.execute(
              userId,
              { command: "Enroll", seasonId },
              `discord:${input.id}`
            );
          } else if (input.type === 3 || input.type === 5) {
            const id = input.data?.custom_id?.replace(/^confirm:/, "") ?? "";
            if (!/^[a-f0-9-]{36}$/.test(id))
              throw new DomainError("VALIDATION");
            const c = await deps.database.interactionContext(id, userId);
            if (!c) throw new DomainError("NOT_FOUND");
            let command: unknown;
            if (c.kind === "start" || c.kind === "custom") {
              const summaries = await deps.tracker.dailySummary(userId);
              const s = summaries.find((s) => s.id === c.enrollmentId);
              if (!s) throw new DomainError("NOT_FOUND");
              const season = (await deps.tracker.seasons()).find(
                (season) => season.id === s.seasonId
              );
              if (!season) throw new DomainError("NOT_FOUND");
              const goals =
                c.kind === "start"
                  ? season.goals
                  : [1, 2, 3]
                      .map((n) =>
                        String(submitted?.get(`goal${n}`) ?? "").trim()
                      )
                      .filter(Boolean)
                      .map((title) => ({ title, kind: "qualitative" }));
              command = {
                command: "StartAttempt",
                enrollmentId: c.enrollmentId,
                expectedEnrollmentVersion: c.enrollmentVersion,
                goals,
                milestones: c.kind === "start" ? season.milestones : [],
              };
            } else if (c.kind === "pause" || c.kind === "resume")
              command = {
                command:
                  c.kind === "pause" ? "PauseEnrollment" : "ResumeEnrollment",
                enrollmentId: c.enrollmentId,
                expectedEnrollmentVersion: c.enrollmentVersion,
              };
            else if (c.kind === "report" && input.type === 5) {
              const values = [...(submitted ?? [])]
                .filter(
                  ([key, value]) => key.startsWith("goal:") && value !== ""
                )
                .map(([key, value]) => {
                  if (!decimalValueSchema.safeParse(value).success)
                    throw new DomainError("VALIDATION");
                  return { goalRevisionId: key.slice(5), value };
                });
              const achievements = submitted?.get("milestones") ?? [];
              if (!Array.isArray(achievements))
                throw new DomainError("VALIDATION");
              const current = (await deps.tracker.dailySummary(userId)).find(
                (s) => s.id === c.enrollmentId
              );
              if (!current?.attemptId) throw new DomainError("NOT_FOUND");
              const editing = c.resourceId !== current.attemptId;
              command = {
                command: editing ? "EditReport" : "SubmitReport",
                ...(editing
                  ? { reportId: c.resourceId, expectedReportVersion: c.version }
                  : {
                      attemptId: c.resourceId,
                      expectedAttemptVersion: c.version,
                    }),
                body: submitted?.get("body"),
                goalValues: values,
                ...(!editing ? { milestoneAchievements: achievements } : {}),
              };
            } else throw new DomainError("VALIDATION");
            await deps.tracker.execute(userId, command, `discord:${input.id}`);
          } else if (!(input.type === 2 && input.data?.name === "dashboard"))
            throw new DomainError("VALIDATION");
          await send(await dashboard(userId));
        } catch (error) {
          logBackend(
            "web",
            "discord_action_failed",
            { requestId: deps.requestId },
            error
          );
          await send(
            reply(
              `## Let’s try that again\n${errorMessage((error as { code?: string }).code)}`,
              [row(link("Open website", `${deps.origin}/home`))]
            )
          );
          if (submitted) {
            const recovery = [...submitted]
              .map(
                ([key, value]) =>
                  `${key.startsWith("goal:") ? "Goal value" : key}: ${Array.isArray(value) ? value.join(", ") : value}`
              )
              .join("\n");
            for (const chunk of recoveryChunks(recovery))
              await send(reply(`**Your private recovery copy**\n${chunk}`));
          }
        }
      };
      deps.schedule(async () => {
        try {
          await work();
        } catch (error) {
          logBackend(
            "web",
            "discord_delivery_failed",
            { requestId: deps.requestId },
            error
          );
        }
      });
      return response({ type: 5, data: { flags: 64 } });
    },
  };
}
