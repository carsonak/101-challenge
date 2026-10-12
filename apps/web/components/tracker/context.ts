import type { useTrackerController } from "./controller";
/** Current controller state and actions passed to route views. */
export type TrackerViewContext = ReturnType<typeof useTrackerController>;
