import type { Challenge } from "../challenge-screen";
import type { Attempt } from "../tracker-types";
/** State shared between cohesive screen sections. */
export type ScreenContext = Parameters<typeof Challenge>[0] & {
  current?: Attempt;
  today?: Attempt["reports"][number];
  cancelName: string;
  setCancelName: (v: string) => void;
  erase: boolean;
  setErase: (v: boolean) => void;
};
