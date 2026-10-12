/** @file Feature-grouped domain-postgres regression suite. pnpm test imports these modules serially. */
import "./domain-postgres/lifecycle.test.js";
import "./domain-postgres/slots.test.js";
import "./domain-postgres/restart-race.test.js";
import "./domain-postgres/credits.test.js";
import "./domain-postgres/correction-grants.test.js";
import "./domain-postgres/completion-race.test.js";
import "./domain-postgres/milestone-race.test.js";
