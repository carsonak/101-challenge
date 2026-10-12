/** Compatibility facade for the existing public exports. */
export type { BackendEvent, BackendDetails } from "./diagnostics/types.js";
export { diagnosticRoute } from "./diagnostics/classification.js";
export { diagnosticFailure } from "./diagnostics/redaction.js";
export { logBackend } from "./diagnostics/logging.js";
