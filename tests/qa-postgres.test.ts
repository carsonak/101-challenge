/** @file Feature-grouped qa-postgres regression suite. pnpm test imports these modules serially. */
import "./qa-postgres/metadata-lifecycle.test.js";
import "./qa-postgres/backfill.test.js";
import "./qa-postgres/accounts.test.js";
import "./qa-postgres/expiry-completion.test.js";
import "./qa-postgres/provider-recovery.test.js";
import "./qa-postgres/username-races.test.js";
