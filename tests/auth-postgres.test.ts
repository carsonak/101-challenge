/** @file Feature-grouped auth-postgres regression suite. pnpm test imports these modules serially. */
import "./auth-postgres/passwords.test.js";
import "./auth-postgres/email-proofs.test.js";
import "./auth-postgres/provider-linking.test.js";
import "./auth-postgres/oauth-races.test.js";
import "./auth-postgres/erasure.test.js";
import "./auth-postgres/mail-cooldowns.test.js";
