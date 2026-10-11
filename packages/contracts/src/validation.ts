/** @file Initialize shared validation before creating schemas. The runtime parser avoids Zod's code-generation probe under the browser's strict CSP. */
import { z } from "zod";
z.config({ jitless: true });
/** CSP-compatible schema builder; validation rules and errors are unchanged. */
export { z };
