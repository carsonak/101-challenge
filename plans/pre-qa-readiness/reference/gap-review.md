> Historical source supplied by the owner, dated 13 October 2026. Recommendations
> and QA scenarios are reference material, not operational authorization. Current
> dispositions live in [the finding map](../findings.md); changed expectations
> live in [the manual QA supplement](../../../docs/manual-qa.md).

# 101 Challenge: Pre-launch Gap Review

Prepared 13 October 2026 for the MVP go-live decision.

## 1. Scope and method

I reviewed the repository snapshot you shared: source, migrations, tests, plans, `docs/verification.md`, the deploy assets and the product summary. I did not run the application, and I did not browse live GitHub state beyond that snapshot, so anything that depends on your running environment is marked **needs confirmation**.

The core is in good shape. Domain rules, transactions, privacy projections, restricted database roles, retry safety and accessibility have unusually thorough local evidence. The gaps below are mostly the unglamorous things between "passes locally" and "strangers depend on it": configuration traps, unverified external services, missing support tooling and expectation-setting.

Priority levels:

- **P0 Blocker**: do not invite users until resolved or consciously accepted.
- **P1 Should fix**: fix before or very early in the pilot; real user pain likely.
- **P2 Plan for**: acceptable for a small pilot, but schedule it.
- **P3 Later**: polish and future work.

## 2. Summary

| ID  | Gap                                                                                      | Priority |
| --- | ---------------------------------------------------------------------------------------- | -------- |
| G1  | Auth rate limits share one global bucket unless proxy trust is configured                | P0       |
| G2  | Verification email delivery unconfirmed; no resend option                                | P0       |
| G3  | No tested production deployment runbook (provision, migrate, first admin, first season)  | P0       |
| G4  | Production Postgres version differs from the version everything was tested on            | P0       |
| G5  | Backups are scripted but unscheduled; no VPS restore drill; no alerting                  | P0       |
| G6  | Live Google, Discord and CI evidence missing                                             | P0       |
| G7  | Terms, privacy and data-protection review not completed                                  | P0       |
| G8  | Credits, perks and "collectible" promise things the MVP cannot deliver                   | P1       |
| G9  | Two-account trap: signing in with a provider never merges with an existing email account | P1       |
| G10 | Admin tooling does not scale and cannot identify people                                  | P1       |
| G11 | No support path or user-management tools                                                 | P1       |
| G12 | No reminders or re-engagement                                                            | P1       |
| G13 | No staging load trial                                                                    | P1       |
| G14 | Observability: logs only, no uptime or error alerting                                    | P1       |
| G15 | Account basics missing: change password, change sign-in email                            | P2       |
| G16 | Fixed Nairobi timezone for everyone                                                      | P2       |
| G17 | Completion has no payoff; Home hides completed seasons                                   | P2       |
| G18 | Single-process limits and scaling ceilings                                               | P2       |
| G19 | Minor code and doc inconsistencies                                                       | P3       |

## 3. P0 blockers

### G1. Auth rate limits collapse into one global bucket without proxy trust

**Observation.** `address()` in `apps/web/server/api.ts` returns the constant `"local"` unless both `TRUSTED_PROXY_HEADER` and `TRUSTED_PROXY_HOPS` are set. The per-action buckets (`auth-login` 20/min, `auth-input` 100/min, `oauth` 20/min) are keyed on that address. Behind Caddy with the defaults, every visitor shares the same bucket.

**Why it matters.** Twenty login attempts a minute across the whole site is enough for a handful of users on a shared event Wi-Fi, or one bored person with a script, to lock everyone out of logging in. Signup and OAuth start share the same weakness. `docs/authentication.md` mentions this, but nothing in the deploy files sets it.

**Recommendation.**

- In `secrets/web.env` set `TRUSTED_PROXY_HEADER=x-forwarded-for` and `TRUSTED_PROXY_HOPS=1`. This is safe because the Caddyfile overwrites the header with `{remote_host}`, provided the web port is unreachable from outside (it is only `expose`d on the internal network).
- Verify it: from two different networks, confirm that failed logins on one do not block the other.
- Add a startup warning, or a test, when `APP_ORIGIN` is HTTPS and proxy trust is unset.
- Be aware of the related trade-off: the per-email limit (10 per 15 minutes) lets anyone lock a known address out of login for 15 minutes. Acceptable for a pilot; note it in your support runbook.

### G2. Verification email delivery is unconfirmed, and users cannot resend

**Observation.** `docs/verification.md` records that the owner reports the first verification message was rejected (placeholder sender) and delivery of verification messages "remains unconfirmed". Only the recovery email was confirmed to reach an inbox. In the app, the `/verify` page without a token just says "Check your email". There is no resend button. A user can only re-trigger by signing up again, which is rate-limited to one mail per address per 15 minutes and is not discoverable. Mail failures inside `auth.execute` are deliberately swallowed (enumeration safety), so the user sees success even if SMTP failed.

**Why it matters.** Email is the front door for every non-Discord user. If verification lands in spam, is delayed, or the SMTP provider rate-limits, signups silently die and you will not know.

**Recommendation.**

- Send a real verification email to Gmail, Outlook/Hotmail, Yahoo and a custom-domain mailbox. Check inbox vs spam and the headers for SPF, DKIM and DMARC pass.
- Make sure the sending domain has SPF, DKIM and DMARC published, and that `SMTP_FROM` is the exact verified sender.
- Add a "Resend verification email" action on `/verify` and on the login error path. It can stay enumeration-safe and keep the 15-minute cooldown, but the page should say that clearly ("If you didn't get it, wait a few minutes, check spam, then try again").
- Alert on `mail_failed` log events (see G14).
- Have a manual fallback for pilot day: an operator procedure to verify a specific account if mail is down.

### G3. No tested production deployment runbook

**Observation.** `deploy/` contains Compose, Caddy, backup tooling and a README, but several steps are described rather than executable. The Compose file has no job for role provisioning or migrations, yet the README requires provisioning roles, migrating, then provisioning grants before the app starts. `pnpm database:*` scripts assume the monorepo with built packages and the local `.env` launcher. The first administrator is made by hand-written SQL (`docs/operations.md`). No season exists on a fresh install, and the product depends on a published first season. Full hardened container builds are noted as unverified.

**Why it matters.** The first real deployment is usually where hidden assumptions surface, at the worst time. A step you have only read about, not run, will fail on launch day.

**Recommendation.** Write and rehearse a numbered runbook on a throwaway VPS (or a second Compose project locally) covering:

1. Build images, pin digests (`deploy/README.md` already asks for this).
2. Create secrets files and the operator Postgres password.
3. Start Postgres only; run provision roles, migrate (as migrator), provision grants. Consider adding a one-shot `migrate` service or Compose profile so this is a single command.
4. Bring up web, worker, maintenance and Caddy; check `/api/ready` on web and worker.
5. Sign up the admin account, verify, and run the exact tested SQL to promote it.
6. Create and publish the first season with its template, session link and description.
7. Register Discord commands against the production origin and set the interactions URL.
8. Smoke test the whole path as a new user.
9. Rollback: what you do if step N fails (restore, redeploy previous digests).

Time the rehearsal. Update the plan checkbox "deploy staging" only after it passes end to end.

### G4. Production Postgres major version differs from the tested version

**Observation.** `compose.yaml` (local, CI, every test and the restore rehearsal) uses `postgres:17.11-alpine`. `deploy/compose.yaml` uses `postgres:18-alpine` with the data volume mounted at `/var/lib/postgresql`. Caddy is `caddy:2-alpine` and unpinned.

**Why it matters.** Backups, role grants, advisory-lock behaviour, pg-boss and the restore tooling were all verified on 17. A silent major-version change in production is exactly the kind of difference the restore drill is meant to rule out. Postgres 18 also changed the image's data directory layout, so mount paths matter.

**Recommendation.** Pick one major version for both. The lowest-risk choice is 17.11 in the deploy file, pinned by digest. If you prefer 18, move CI, local Compose and the restore rehearsal to 18 first and re-run everything. Pin the Caddy image by digest too.

### G5. Backups unscheduled, no VPS restore drill, no alerting

**Observation.** `scripts/backup.mjs` is good: age-encrypted, ledger kept separately, restore guarded. But nothing schedules it, uploads need an S3 principal you have not set up, and the restore was only rehearsed locally. Your stated target in the plans is RPO ≤ 24 h and RTO ≤ 4 h, "validated by restore". That validation has not happened on the real stack.

**Why it matters.** Participant history is the product. Losing a month of reports is the one failure users do not forgive. An untested backup is a hope, not a backup.

**Recommendation.**

- Schedule `backup` at least daily and `ledger` after every maintenance sweep (cron or a systemd timer), writing to off-server storage with versioning and a 30-day lifecycle.
- Keep the age decryption identity off the server, and confirm you can find it on a different machine.
- Do one full restore on a separate machine from the off-server copy, and record the duration.
- Alert if the newest backup is older than 26 hours.
- Practice replaying the deletion ledger so you do not resurrect a deleted account.

### G6. Live-provider and CI evidence missing

**Observation.** Pending items in `plan.md` and `verification.md`:

- real Google and Discord sign-in, linking and cancellation;
- Discord join, report, pause and resume flows (only help and dashboard are owner-confirmed live);
- verification-email delivery (see G2);
- CI has been configured but has not run remotely.

Also, provider consoles still point at localhost callbacks.

**Why it matters.** These are the exact flows users will use on day one. Fixture doubles prove your logic, not the provider's actual behaviour. Two examples worth checking explicitly: the Discord report modal uses a newer checkbox-group component (type 22) that only manual milestones trigger, and Google's consent screen must be set to **In production** or only listed test users can sign in.

**Recommendation.**

- Complete the QA guide sections 4 and 14 on the production domain before inviting anyone.
- Google: set publishing status to In production, add the privacy policy URL and authorized domain, register the exact production callback.
- Discord: update the interactions endpoint to the permanent HTTPS URL (the quick tunnel is temporary), register production OAuth redirect, register guild commands, and re-verify signed PING.
- Push to GitHub and get a green CI run including the browser job. Fix whatever the first remote run reveals.

### G7. Legal and data-protection review

**Observation.** `/terms` and `/privacy` exist and are accurate to the code, but `docs/deployment.md` itself states an owner legal-review gate for terms, privacy, data-protection obligations and cross-border processing. `CONTACT_EMAIL` is optional and unset by default. Participants' free-text reflections are retained until erasure, and are processed by Brevo (email), Discord and Google.

**Why it matters.** You are collecting personal data from Kenyan residents. I am not a lawyer, but you should confirm whether BitDevs Kisumu needs to register as a data controller or processor with the Office of the Data Protection Commissioner under the Data Protection Act, 2019, and whether your processors need agreements. Users also need a human to contact about their data.

**Recommendation.** Get a short qualified review, set `CONTACT_EMAIL` to a monitored address, add a retention and rights statement users can find without logging in, and re-read the privacy page against what the Discord flow actually does (report text passes through Discord).

## 4. P1 should fix

### G8. The MVP shows rewards it cannot deliver

**Observation.** Home and challenge pages show "Reroll credits" / "Streak credits", and the challenge help text explains how they are earned. Spending is not implemented, perk tiers have no concrete benefit, and artwork (the "seasonal collectible" in the product summary) is a separate release. Completion shows a plain notice.

**Why it matters.** Users will earn credits for weeks and then ask what they are for. The product summary promises evolving artwork. A mismatch between promise and delivery erodes trust faster than a missing feature does.

**Recommendation.** Decide the messaging deliberately: either relabel credits as "Banked for artwork (coming soon)" and put one honest line on the landing page and completion screen, or hide the counters until artwork ships. Tell pilot users artwork is coming and that their reports are being preserved to power it.

### G9. Provider sign-in creates a second account for existing email users

**Observation.** By design, email addresses never merge accounts, and Google is requested without the email scope. So a user who registered by email and later taps "Continue with Discord" or "Continue with Google" silently gets a brand-new account with an empty history. Linking is only available from Account settings after logging in. Discord guild commands only work for a Discord identity linked to an account.

**Why it matters.** This is the most likely support ticket of the pilot: "my progress disappeared". It also splits a person's participation across accounts and can hold two season slots.

**Recommendation.** Keep the safe merge policy but add guidance at the point of choice: under the provider buttons on login and signup, "Already have an account? Log in first, then link Discord or Google in Account settings." Make the Discord "Connect your account" message say the same. Add the "two accounts" case to the support runbook, including what you will and will not do manually.

### G10. Admin tooling does not scale and cannot identify people

**Observation.**

- `adminStats` loads every attempt, goal, milestone, report and grant for all users in one call, with several queries per attempt. Your synthetic measurement was one attempt.
- The corrections page renders a `<select>` of every report in the system labelled only "Day N, date, id", and every attempt labelled by start time and id. Admin cannot tell whose report or attempt they are choosing.
- The Metadata section lists attempt ids only.
- Admin errors surface as the generic "Check the fields" message.

**Why it matters.** With 50 active users at day 30 you have roughly 1,500 reports in a dropdown. A mistaken grant to the wrong person is easy, and corrections are your only sanctioned way to touch history.

**Recommendation.** At minimum, show username next to every attempt and report, add a search or filter by username, and require choosing a participant first, then their attempt, then their report. Paginate the admin stats query. Add a confirmation step before issuing a key, naming the person. Consider showing last-issued grants per user.

### G11. No support path or user-management tools

**Observation.** The admin area manages seasons and correction grants. There is no way to look up a user (even by username, email or Discord identity), see an audit trail (the `audit` table exists but has no UI), disable an account, trigger a verification, or resolve "I lost access to my email". Provider-only users with no recovery email have no recovery path except support.

**Why it matters.** With live users, support is a daily activity. Without tools, every case becomes manual SQL against the production database, which is the risk your restricted-role design is trying to avoid.

**Recommendation.** For the pilot, write a support runbook with the exact, reviewed SQL or scripts for the five likely cases: manual email verification, promote or demote admin, account lock/disable, merge-request handling, and "I changed my email". After the pilot, add a small read-only admin user lookup and an audit log view. Add a visible contact link in the site footer.

### G12. No reminders or re-engagement

**Observation.** Reminders are explicitly deferred. The notifications inbox is almost empty in practice (only backdated participation creates one).

**Why it matters.** Habit products rely on prompts. Your pilot will tell you little about retention if people simply forget. Discord is the natural channel, but the bot only responds to commands.

**Recommendation.** Do not build this before launch, but plan a manual substitute: a weekly community post in the Discord server linking to `/report`, and decide a metric (for example, share of enrolled users who report at least 3 days in week one) so you can judge whether reminders are needed.

### G13. No load trial

**Observation.** Your testing plan lists a staging trial of 100 participants and 10 concurrent writes as unchecked. The web container is capped at 768 MB with Argon2 at 64 MiB and two concurrent hashes, plus Sharp for avatars.

**Why it matters.** Signup and login are CPU- and memory-heavy by design. A cohort that signs up in the same five minutes after an announcement is the realistic worst case, and the capacity gate will return "rate limited" to some of them.

**Recommendation.** Run a simple scripted burst on the real server size: 50 signups and logins over two minutes, 20 concurrent report submissions, a few avatar uploads. Watch memory and error rates. If saturation errors appear, stagger invitations (waves of 10–20) rather than raising limits blindly.

### G14. Observability

**Observation.** Logs are structured JSON on stdout with 30-day retention. There is no external uptime monitor, no error or alert routing, and no dashboard. `docs/deployment.md` lists alerts (readiness failures, overdue erasures, unsent account mail, oldest pending events) but nothing implements them.

**Why it matters.** At pilot scale you will otherwise learn about outages from users.

**Recommendation.** Minimum viable set: an external uptime check on `/api/ready`; a log filter alerting on `mail_failed`, `startup_failed`, `queue_failed` and 5xx rates; a simple cron query alerting on due-and-unprocessed erasure requests and on backups older than 26 hours. Test each alert once by causing the fault.

## 5. P2 plan for

### G15. Account basics missing

Logged-in users cannot change their password (only recover it by email), cannot change their sign-in email, and cannot remove the email credential while it is their only method. Users expect these. Add change-password (requires recent sign-in) soon; document the workaround meanwhile.

### G16. One fixed timezone

All new enrollments use the server timezone (default Africa/Nairobi) and users cannot choose. This is a deliberate decision for a Kisumu community. Tell users plainly on the setup page which timezone their days follow, since someone travelling or living abroad will find "today" rolls over at an odd hour for them. Revisit if you open the challenge outside East Africa.

### G17. Completion has no payoff, Home forgets completed seasons

Home only lists active or paused enrollments, so a user who completes a season sees "Your next chapter" with no acknowledgement. The completion notice is a single line. Consider a brief, warm completion screen and a "Completed seasons" row on Home. Light work, big emotional payoff, and it tests a flow you have only exercised in automated tests.

### G18. Scaling ceilings

Rate limit counters are per-process and reset on restart; production is single-instance by design. Home and history load every retained attempt including report bodies. Fine for tens or low hundreds of users. Note the limits in your plan so you know when to revisit (many hundreds of users, or multiple web instances).

## 6. P3 later

### G19. Small inconsistencies

- `CONTRIBUTING.md` says integrate through `develop`; recent hardening landed on `main`. Pick one and tag a release before launch.
- Edit-report date resolution falls back to `"UTC"` while other paths fall back to the configured default zone. Harmless today (timezone is always set once an attempt exists) but worth unifying.
- The deletion email subject reads "Recover your challenge account", which is slightly confusing. Use a clear "Account deletion scheduled" subject.
- `robots: noindex` is correct for a pilot; remember to change it when you want discoverability.
- Footer only links Privacy and Terms. Add Contact and a short How it works / FAQ page.
- Admin errors on backdating (missing season template, publication timestamp) show only a generic message. Add specific copy.

## 7. What is already strong

This is worth stating so you do not spend time re-doing it: idempotent commands with replay safety; lock-ordered transactions with real Postgres race tests; hashed sessions, one-use proofs and CSRF; Argon2id with bounded capacity; restricted database roles with actual-login tests; metadata-only admin projections; deletion ledger and restore replay; nonce CSP; accessibility sweeps in two themes and three widths; and honest verification records that separate local from live evidence. Those are the hard things. The remaining work is mostly operational.

## 8. Suggested sequence

**Week 0 (before any invitation)**

1. G4 version alignment and G1 proxy trust (small, high value).
2. G3 runbook rehearsal on a staging VPS, including G5 backup and restore drill.
3. G2 email deliverability and the resend button.
4. G6 live Google and Discord on the production domain; first green remote CI run.
5. G7 legal review and contact address.
6. Create the first season and write the support runbook (G11).
7. Run your QA guide end to end; fix what it finds.

**Pilot wave 1 (10–20 people, friendly)**

- G8 messaging, G9 hints, G14 minimal alerts, G13 burst test beforehand. Watch daily for a week.

**After wave 1**

- G10 admin improvements, G15, G17, then decide on reminders (G12) from real retention data.

## 9. Go / no-go checklist

- [ ] A brand-new person can sign up by email, receive the email in their inbox, verify, log in and start a season on production.
- [ ] Google and Discord sign-in, linking and unlinking work on production.
- [ ] `/report` in Discord works end to end for a linked user, including a measured goal and a manual milestone.
- [ ] Login from two different networks is rate-limited independently.
- [ ] A backup from the last 24 hours restored successfully on a separate machine.
- [ ] Alerts fire for site down, mail failure and stale backup.
- [ ] An administrator, a published season and `CONTACT_EMAIL` exist.
- [ ] Terms and privacy reviewed; the pilot cohort has been told what the MVP does and does not include (no artwork yet, credits not spendable).
- [ ] Support runbook exists and you have tested one case from it.
- [ ] CI is green on GitHub and the release is tagged.
