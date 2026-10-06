import { createPublicKey, verify } from "node:crypto";
import { trackerErrorCodeSchema } from "@challenge/contracts";
import type { createAuth, createTracker } from "@challenge/core";
import type { createRepository } from "@challenge/db";

/** Guild-only command manifest; register only after the external Discord gate. */
export const guildCommands = [
  "join",
  "setup",
  "update",
  "edit",
  "progress",
  "goals",
  "milestones",
  "streak",
  "perks",
  "seasons",
  "cancel",
  "resume",
  "restart",
].map((name) => ({
  name,
  description: `Challenge ${name}`,
  type: 1,
  contexts: [0],
  integration_types: [0],
  options: [
    "join",
    "setup",
    "update",
    "edit",
    "cancel",
    "resume",
    "restart",
  ].includes(name)
    ? [
        {
          type: 3,
          name: "id",
          description: "Season or enrollment ID from /seasons or /progress",
          required: true,
        },
      ]
    : [],
}));
/** Signed interaction services; schedule must retain work after the HTTP response. */
export interface DiscordDependencies {
  /** Portal Ed25519 public key, or undefined to disable this endpoint. */
  publicKey?: string;
  /** Canonical browser origin for private account/history links. */
  origin: string;
  /** Independent account/subject resolution. */
  auth: ReturnType<typeof createAuth>;
  /** Same transactional commands used by the browser. */
  tracker: ReturnType<typeof createTracker>;
  /** Private expiring modal metadata store. */
  database: ReturnType<typeof createRepository>;
  /** Framework background lifetime hook. */
  schedule: (work: () => Promise<void>) => void;
  /** Transient private response delivery; never persist or log interaction tokens. */
  deliver: (
    applicationId: string,
    token: string,
    data: unknown
  ) => Promise<void>;
  /** Injectable freshness clock. */
  now?: () => number;
}
/** Private Discord message; mention parsing is always disabled. */
function message(content: string, components?: unknown[]) {
  return {
    type: 4,
    data: {
      content,
      flags: 64,
      allowed_mentions: { parse: [] },
      ...(components ? { components } : {}),
    },
  };
}
/** Text-input modal; resource versions are held in the actor-bound store. */
function modal(
  id: string,
  title: string,
  fields: {
    id: string;
    label: string;
    value?: string;
    long?: boolean;
    required?: boolean;
  }[]
) {
  return {
    type: 9,
    data: {
      custom_id: id,
      title,
      components: fields.map((f) => ({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: f.id,
            label: f.label,
            style: f.long ? 2 : 1,
            required: f.required ?? true,
            max_length: 4000,
            ...(f.value ? { value: f.value.slice(0, 4000) } : {}),
          },
        ],
      })),
    },
  };
}
/** Verify raw signatures before actor lookup; share core mutations and bounded safe replies. */
export function createDiscordAdapter(deps: DiscordDependencies) {
  const now = deps.now ?? Date.now;
  return {
    /** Dispatch only fresh signed guild interactions; deferred delivery cannot undo a committed command. */
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
      let input: {
        type: number;
        id: string;
        guild_id?: string;
        application_id: string;
        token: string;
        member?: { user?: { id?: string } };
        data?: {
          name?: string;
          custom_id?: string;
          options?: { name: string; value: string }[];
          components?: {
            components?: { custom_id: string; value: string }[];
          }[];
        };
      };
      try {
        input = JSON.parse(body.toString("utf8"));
      } catch {
        return new Response(null, { status: 400 });
      }
      if (input.type === 1) return Response.json({ type: 1 });
      if (!input.guild_id || !input.member?.user?.id)
        return Response.json(
          message(
            "Guild commands only. Use your private account on the website."
          )
        );
      if (
        !/^\d{1,30}$/.test(input.id) ||
        !/^\d{1,30}$/.test(input.application_id) ||
        typeof input.token !== "string" ||
        !/^[\w.-]{1,200}$/.test(input.token)
      )
        return new Response(null, { status: 400 });
      const subject = input.member.user.id;
      /** Background dispatch preserves the initial three-second acknowledgement. */
      async function work() {
        let result: ReturnType<typeof message> | ReturnType<typeof modal>;
        try {
          const userId = await deps.auth.discordActor(subject);
          if (!userId) {
            result = message(
              `Sign in and link Discord privately: ${deps.origin}/account`
            );
          } else {
            const command = input.data?.name,
              resource = input.data?.options?.find(
                (o) => o.name === "id"
              )?.value;
            const history = await deps.tracker.history(userId);
            const enrollment = history.find((e) => e.id === resource),
              attempt = enrollment?.attempts.find(
                (a) => a.attemptId === enrollment.currentAttemptId
              );
            if (input.type === 3 || input.type === 5) {
              const id = input.data?.custom_id;
              if (!id || !/^[a-f0-9-]{36}$/.test(id))
                throw { code: "VALIDATION" };
              const context = await deps.database.interactionContext(
                id,
                userId
              );
              if (!context) throw { code: "FORBIDDEN" };
              const values = Object.fromEntries(
                (input.data?.components ?? [])
                  .flatMap((c) => c.components ?? [])
                  .map((c) => [c.custom_id, c.value])
              );
              let payload: unknown;
              if (context.kind === "cancel" && input.type === 3)
                payload = {
                  command: "CancelEnrollment",
                  enrollmentId: context.enrollmentId,
                  expectedEnrollmentVersion: context.enrollmentVersion,
                };
              else if (input.type !== 5) throw { code: "VALIDATION" };
              else if (context.kind === "setup" || context.kind === "restart") {
                if (context.kind === "restart" && values.confirm !== "RESTART")
                  throw { code: "VALIDATION" };
                payload = {
                  command:
                    context.kind === "setup"
                      ? "StartAttempt"
                      : "RestartAttempt",
                  enrollmentId: context.enrollmentId,
                  expectedEnrollmentVersion: context.enrollmentVersion,
                  timezone: values.timezone,
                  goals: JSON.parse(values.goals ?? "[]"),
                  milestones: [],
                  ...(context.kind === "restart"
                    ? {
                        attemptId: context.resourceId,
                        expectedAttemptVersion: context.version,
                        confirmed: true,
                      }
                    : {}),
                };
              } else
                payload = {
                  command:
                    context.kind === "edit" ? "EditReport" : "SubmitReport",
                  ...(context.kind === "edit"
                    ? {
                        reportId: context.resourceId,
                        expectedReportVersion: context.version,
                      }
                    : {
                        attemptId: context.resourceId,
                        expectedAttemptVersion: context.version,
                      }),
                  body: values.body,
                  goalValues: JSON.parse(values.values || "[]"),
                  ...(context.kind === "update"
                    ? {
                        milestoneAchievements: JSON.parse(
                          values.milestones ?? "[]"
                        ),
                      }
                    : {}),
                };
              const ref = await deps.tracker.execute(
                userId,
                payload,
                `discord-form:${context.id}`
              );
              result = message(
                `Saved${ref.replayed ? " (already accepted)" : ""}. Private history: ${deps.origin}/history`
              );
            } else if (command === "join") {
              await deps.tracker.execute(
                userId,
                { command: "Enroll", seasonId: resource },
                `discord:${input.id}`
              );
              result = message(
                `Enrollment saved. Choose goals privately: ${deps.origin}/history`
              );
            } else if (command === "resume" && enrollment) {
              await deps.tracker.execute(
                userId,
                {
                  command: "ResumeEnrollment",
                  enrollmentId: enrollment.id,
                  expectedEnrollmentVersion:
                    (await deps.database.resumeVersion(
                      userId,
                      `discord:${input.id}`,
                      enrollment.id
                    )) ?? enrollment.version,
                },
                `discord:${input.id}`
              );
              result = message(
                "Enrollment resumed; retained progress continues."
              );
            } else if (
              ["setup", "update", "edit", "cancel", "restart"].includes(
                command ?? ""
              )
            ) {
              if (!enrollment) throw { code: "NOT_FOUND" };
              const report = attempt?.reports.find(
                (r) => r.reportingDate === attempt.today
              );
              const kind = command as
                "setup" | "update" | "edit" | "cancel" | "restart";
              if (
                (kind !== "setup" && kind !== "cancel" && !attempt) ||
                (kind === "edit" && !report)
              )
                throw { code: "NOT_FOUND" };
              const form = await deps.database.interactionForm({
                userId,
                kind,
                resourceId:
                  kind === "edit"
                    ? (report?.id ?? enrollment.id)
                    : (attempt?.attemptId ?? enrollment.id),
                version:
                  kind === "edit"
                    ? (report?.version ?? 0)
                    : (attempt?.version ?? 0),
                enrollmentId: enrollment.id,
                enrollmentVersion: enrollment.version,
              });
              if (kind === "cancel")
                result = message(
                  "Cancel this enrollment? Retained reports remain; its unfinished slot is released.",
                  [
                    {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 4,
                          label: "Confirm cancellation",
                          custom_id: form,
                        },
                      ],
                    },
                  ]
                );
              else
                result = message(
                  `Open your private ${kind} form. It expires in ten minutes.`,
                  [
                    {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 1,
                          label: `Open ${kind} form`,
                          custom_id: `open:${form}`,
                        },
                      ],
                    },
                  ]
                );
            } else if (command === "seasons") {
              const seasons = await deps.tracker.seasons();
              result = message(
                seasons
                  .slice(0, 8)
                  .map((s) => `${s.title.slice(0, 80)} — ${s.id}`)
                  .join("\n") || "No published seasons yet."
              );
            } else if (
              ["progress", "streak", "perks"].includes(command ?? "")
            ) {
              result = message(
                history
                  .flatMap((e) =>
                    e.attempts
                      .filter((a) => a.attemptId === e.currentAttemptId)
                      .map(
                        (a) =>
                          `${e.id}: ${a.reportingDays}/101 days; streak ${a.currentStreak}; longest ${a.longestStreak}; credits ${a.rerollCredits}`
                      )
                  )
                  .slice(0, 8)
                  .join("\n") || `Start privately: ${deps.origin}/seasons`
              );
            } else if (command === "goals" || command === "milestones")
              result = message(
                `Manage revisions and retained history privately: ${deps.origin}/history`
              );
            else throw { code: "VALIDATION" };
          }
        } catch (error) {
          const code = trackerErrorCodeSchema.safeParse(
            (error as { code?: unknown })?.code
          );
          result = message(
            code.success
              ? `Action unavailable (${code.data}). Your submitted text was not published. Review privately: ${deps.origin}/history`
              : "Service unavailable. Retry the same interaction safely."
          );
        }
        try {
          await deps.deliver(input.application_id, input.token, result.data);
        } catch {
          /* Delivery failure never reverses a committed mutation. */
        }
      }
      // Opening a modal must itself be the immediate component response, not a follow-up.
      if (input.type === 3 && input.data?.custom_id?.startsWith("open:")) {
        const id = input.data.custom_id.slice(5);
        if (!/^[a-f0-9-]{36}$/.test(id))
          return Response.json(message("Invalid form."));
        const deadline = new Promise<Response>((resolve) => {
          setTimeout(
            () =>
              resolve(
                Response.json(
                  message(
                    "Form is taking too long. Please use private website history."
                  )
                )
              ),
            2000
          ).unref();
        });
        return Promise.race([
          deadline,
          (async () => {
            try {
              const userId = await deps.auth.discordActor(subject);
              const c = userId
                ? await deps.database.interactionContext(id, userId)
                : undefined;
              if (!c || !userId)
                return Response.json(
                  message("Form expired or belongs to another account.")
                );
              const history = await deps.tracker.history(userId),
                e = history.find((e) => e.id === c.enrollmentId),
                a = e?.attempts.find((a) => a.attemptId === e.currentAttemptId),
                r = a?.reports.find((r) => r.id === c.resourceId);
              const fields =
                c.kind === "setup" || c.kind === "restart"
                  ? [
                      {
                        id: "goals",
                        label: "Initial goals (JSON; custom or copied)",
                        long: true,
                        value: JSON.stringify([
                          { title: "My custom goal", kind: "qualitative" },
                        ]),
                      },
                      {
                        id: "timezone",
                        label: "IANA timezone",
                        value: e?.timezone ?? "UTC",
                      },
                      ...(c.kind === "restart"
                        ? [
                            {
                              id: "confirm",
                              label:
                                "History retained; credits expire. Type RESTART",
                            },
                          ]
                        : []),
                    ]
                  : [
                      {
                        id: "body",
                        label: "Private daily report",
                        long: true,
                        value: r?.body,
                      },
                      {
                        id: "values",
                        label: "Goal values JSON (revision IDs from website)",
                        long: true,
                        value: JSON.stringify(r?.goalValues ?? []),
                        required: false,
                      },
                      ...(c.kind === "update"
                        ? [
                            {
                              id: "milestones",
                              label: "Achieved milestone IDs JSON (optional)",
                              value: "[]",
                              required: false,
                            },
                          ]
                        : []),
                    ];
              return Response.json(modal(id, `Challenge ${c.kind}`, fields));
            } catch {
              return Response.json(
                message("Form unavailable. Use private website history.")
              );
            }
          })(),
        ]);
      }

      deps.schedule(work);
      return Response.json({ type: 5, data: { flags: 64 } });
    },
  };
}
