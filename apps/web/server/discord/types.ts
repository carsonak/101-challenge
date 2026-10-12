import type { createAuth, createTracker } from "@challenge/core";
import type { createRepository } from "@challenge/db";

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
export type Summary = Awaited<
  ReturnType<ReturnType<typeof createTracker>["dailySummary"]>
>[number];

/** Transport component subset supports current labelled modal submissions. */
export interface Component {
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
export interface Interaction {
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
