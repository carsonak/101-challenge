import type { RefObject } from "react";
import type AccountScreen from "../account-screen";
/** State shared between cohesive screen sections. */
export type ScreenContext = Parameters<typeof AccountScreen>[0] & {
  sessions: {
    id: string;
    device: string;
    authenticatedAt: string;
    expiresAt: string;
    revokedAt: string | null;
    current: boolean;
  }[];
  confirmation: string;
  setConfirmation: (v: string) => void;
  dialog: RefObject<HTMLDialogElement | null>;
  pending: unknown;
  setPending: (v: unknown) => void;
  avatarError: string;
  setAvatarError: (v: string) => void;
  now: number;
};
