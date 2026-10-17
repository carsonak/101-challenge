> Historical source supplied by the owner, dated 13 October 2026. Recommendations
> and QA scenarios are reference material, not operational authorization. Current
> dispositions live in [the finding map](../findings.md); changed expectations
> live in [the manual QA supplement](../../../docs/manual-qa.md).

# 101 Challenge: Manual QA Guide (Web, Discord, Admin)

For your pre-invitation review, 13 October 2026.

## How to use this guide

Work top to bottom. Each test has an ID so you can reference it in your findings. Tick the box when it behaves as expected. If it doesn't, note the ID, what you did, what you expected and what happened, plus the `x-request-id` response header if an error appeared (it lets you find the matching server log line).

**Run it against the production domain**, not localhost, at least for sections 2, 4, 14 and 16. Localhost cannot prove email deliverability, provider callbacks or Discord links.

### Result codes

Use a short code next to each item in your notes: **P** pass, **F** fail, **B** blocked, **N** not applicable. Rate each failure: **S1** blocks launch, **S2** fix before inviting more people, **S3** polish.

### Test accounts you will need

| Alias   | What it is                                            | Used for                           |
| ------- | ----------------------------------------------------- | ---------------------------------- |
| ADMIN   | Email account promoted to admin                       | Admin flows, grants, backdating    |
| EMAIL-A | Fresh email account on a real inbox (Gmail)           | Signup, verification, recovery     |
| EMAIL-B | Second fresh email account (Outlook or custom domain) | Cross-account and privacy checks   |
| GOOGLE  | Google-only account                                   | Provider sign-in                   |
| DISCORD | Discord-only account (web sign-in with Discord)       | Provider sign-in, guild commands   |
| LINKED  | Email account with Discord linked                     | Guild flows on an existing account |
| PHONE   | Any real phone, ideally low-end Android               | Mobile checks                      |

### Seasons to prepare (as ADMIN)

- **S-TEMPLATE**: published; description; three goals (one qualitative, one count with target, one duration with unit); two milestones (one manual at day 1, one reporting-count at day 7); a study-session link.
- **S-EMPTY**: published; no template goals or milestones.
- **S-DRAFT**: created, left unpublished.
- **S-SECOND**: published; used to test the one-unfinished-season rule.

### Time-dependent tests

The app uses the server clock and the Africa/Nairobi day boundary. You cannot fast-forward it. To reach later states, use the admin **backdated participation** plus the participant's **24-hour backfill window**, which can insert up to 101 reports in one sitting. Tests that need "tomorrow" (next-day slot release, streak reset) must be done by waiting or by using a participation created the previous day. Plan two or three calendar days for the full pass.

---

## 1. Public pages and navigation (web)

- [ ] **W-NAV-01** Logged out, open `/`. Landing shows a clear promise, "Explore seasons", "Create account" and "Sign in". No errors, no layout jump.
- [ ] **W-NAV-02** Header shows Home, Seasons, theme selector, Log in, Sign up. Brand link goes to `/`.
- [ ] **W-NAV-03** Open `/seasons` logged out. Published seasons show; S-DRAFT does not. Featured badge appears only on featured seasons.
- [ ] **W-NAV-04** Open a season detail page logged out. Description, recommended goals and study link show. Button reads "Create an account to join".
- [ ] **W-NAV-05** Open `/home`, `/account`, `/notifications` logged out. You are sent to login (or shown a login prompt) and never see private data.
- [ ] **W-NAV-06** Open `/admin/seasons` and `/admin/corrections` as a non-admin and logged out. You see only a permission message, no data.
- [ ] **W-NAV-07** Open a nonsense URL. Friendly not-found page with a way back.
- [ ] **W-NAV-08** `/privacy` and `/terms` load, are readable, and the contact address is shown (confirm `CONTACT_EMAIL` is set).
- [ ] **W-NAV-09** Scroll down: header hides. Scroll up: it returns. Open the profile menu while scrolled: header stays.
- [ ] **W-NAV-10** Switch theme System, Light, Dark. Choice persists on reload and applies before the page paints (no flash).
- [ ] **W-NAV-11** Keyboard only: Tab from page load. First stop is "Skip to content". Focus is always visible.

## 2. Signup and email verification

- [ ] **W-SIGN-01** Sign up EMAIL-A with valid username, email and a 12+ character password. You land on `/verify` with "check your email".
- [ ] **W-SIGN-02** The email arrives in the **inbox** (not spam) within a couple of minutes. Note the delay and the sender name and address. Subject and body read clearly.
- [ ] **W-SIGN-03** Click the link. `/verify?token=...` shows a button. Click "Verify my email". You land on login with "Email verified" notice.
- [ ] **W-SIGN-04** Click the same link again. Rejected with a friendly message, not a crash.
- [ ] **W-SIGN-05** Try logging in **before** verifying (use a second fresh signup). Rejected with a generic message that does not say "unverified".
- [ ] **W-SIGN-06** After signup but before verifying, try signing up again with the same email. Same success message; a new email arrives only after the 15-minute cooldown. Is it clear to a user how to get another email? (Known gap: no resend button.)
- [ ] **W-SIGN-07** Sign up with an email that is already verified. Same generic success; no information leak.
- [ ] **W-SIGN-08** Username edge cases: 2 characters (reject), 33 characters (reject), spaces, emoji, symbols other than `_` and `-` (reject), mixed case (accepted and lowercased), a name already taken in different case (reject).
- [ ] **W-SIGN-09** Password edge cases: 11 characters (reject), 12 (accept), 129 (reject), spaces and Unicode (accept). Show/hide button works and is keyboard operable.
- [ ] **W-SIGN-10** Email edge cases: missing `@`, trailing spaces, uppercase letters (normalised), 255+ characters (reject).
- [ ] **W-SIGN-11** Use an expired or tampered token in the URL. Friendly failure.
- [ ] **W-SIGN-12** Let a verification link age past 24 hours (or use an old one). Rejected.
- [ ] **W-SIGN-13** Submit the form twice quickly (double click). One account; no error page.
- [ ] **W-SIGN-14** Switch between Log in and Sign up using the link on each page. Recovery link appears on login only.

## 3. Login, logout, recovery

- [ ] **W-AUTH-01** Log in with correct credentials. You land on Home.
- [ ] **W-AUTH-02** Wrong password, unknown email and unverified email all show the same generic error and take similar time.
- [ ] **W-AUTH-03** Log out from the profile menu. You return to login; the Back button does not reveal private pages.
- [ ] **W-AUTH-04** Request recovery for a real and an unknown address. Identical response. The real one gets an email within minutes.
- [ ] **W-AUTH-05** Request recovery twice in a row. Second request sends no email until 15 minutes pass; UI gives no clue either way.
- [ ] **W-AUTH-06** Use the recovery link: choose a new password. You are sent to login with a success notice. Old password no longer works. All other sessions are signed out.
- [ ] **W-AUTH-07** Reuse the recovery link. Rejected. Let one expire past an hour. Rejected.
- [ ] **W-AUTH-08** Log in on two browsers. Account page lists both devices with coarse labels. Revoke the other; it is signed out on next action.
- [ ] **W-AUTH-09** Rate limits: from one network, enter wrong passwords about 20 times in a minute. You get a friendly "too many requests". **Then try from a different network (phone on mobile data): login must still work.** If it does not, proxy trust is misconfigured. S1.
- [ ] **W-AUTH-10** DevTools, Application, Cookies: session cookie is HttpOnly and Secure on HTTPS; no token in local storage or JSON responses.
- [ ] **W-AUTH-11** Delete the session cookie mid-use. The app falls back to logged-out cleanly with no error loop.
- [ ] **W-AUTH-12** Set junk values for `challenge_session` and `challenge_csrf`, then open `/login`. Cookies cleared; provider buttons visible; no error toast.

## 4. Google and Discord sign-in, linking, unlinking (production domain)

- [ ] **W-OAUTH-01** On login and signup, provider buttons appear only for configured providers.
- [ ] **W-OAUTH-02** Continue with Google as a brand-new user. Consent screen shows your app name, privacy link and only openid/profile (no email request). Not limited to test users.
- [ ] **W-OAUTH-03** After return, you are sent to Account to confirm a username. Photo defaults from Google.
- [ ] **W-OAUTH-04** Continue with Discord as a brand-new user. Same behaviour; username defaults from your Discord handle; avatar from Discord.
- [ ] **W-OAUTH-05** Cancel at the provider consent screen. You return to login with a friendly, non-reflective error.
- [ ] **W-OAUTH-06** Reuse an old callback URL. Friendly failure; no session created.
- [ ] **W-OAUTH-07** Start sign-in in one browser, finish in another (copy the URL). Rejected.
- [ ] **W-OAUTH-08** **Two-account trap:** while EMAIL-A has history, sign out and use Continue with Discord with a Discord account never linked. You get a **new empty account**, not EMAIL-A. Note how confusing this feels. (Known gap; decide your mitigation.)
- [ ] **W-OAUTH-09** Log in as EMAIL-A, go to Account, Link Discord. You may be asked to re-authenticate. Afterwards the same Discord login opens EMAIL-A.
- [ ] **W-OAUTH-10** Try to link a Discord or Google identity that already belongs to another account. Rejected; nothing merged.
- [ ] **W-OAUTH-11** Unlink a provider while another sign-in method remains: works, and signs out all sessions. Try to unlink your only method: refused with clear copy.
- [ ] **W-OAUTH-12** Provider-only account: add email and password in Account, verify the email, then log in with email.
- [ ] **W-OAUTH-13** Provider-only account: set a recovery email and verify it. Set a second address before verifying the first; the first link stops working.

## 5. Account, profile, sessions, privacy, deletion

- [ ] **W-ACC-01** Change username. Duplicate (case-insensitive) rejected; valid change saved and shown in the menu.
- [ ] **W-ACC-02** Upload a JPG, PNG and WebP avatar under 250 KB. Each works and shows in the header. Try a .txt file, a file over 250 KB and a very large pixel-dimension image. Clear errors.
- [ ] **W-ACC-03** Remove the picture. Initials fallback appears.
- [ ] **W-ACC-04** "Sign-in methods" lists email and each linked provider correctly. Providers configured in production are enabled, not shown as "Not configured yet".
- [ ] **W-ACC-05** "Recent sign-ins and devices" marks the current session. Sign out another device from here.
- [ ] **W-ACC-06** **Export my history.** Download the JSON. It contains your reports and goals; it contains **no** seeds, password hashes or tokens.
- [ ] **W-ACC-07** Sensitive actions (unlink, add email, recovery email, deletion) ask for your password after about 10 minutes of session age. Wrong password rejected. Provider-only accounts get a sensible alternative.
- [ ] **W-ACC-08** Deletion: the button stays disabled until you have a verified recovery email and type your exact username. Try wrong case and an extra space.
- [ ] **W-ACC-09** Schedule deletion. You are signed out. A deletion email arrives with clear wording and no private data.
- [ ] **W-ACC-10** Log in during the grace period. You see "Account deletion scheduled" with a live countdown and deadline. Other pages redirect here. Discord commands for this user are refused.
- [ ] **W-ACC-11** Click Restore. You are back in with data intact. Separately, on staging with a test account and an adjusted deadline, confirm the maintenance process actually erases at the deadline.
- [ ] **W-ACC-12** Try to change your password while logged in, and to change your sign-in email. Record what a user would do (the recovery flow is the workaround).
- [ ] **W-ACC-13** Read `/privacy` and check each statement is true of what you just saw (admins see counts not text; seven-day recovery; export).

## 6. Seasons and joining

- [ ] **W-SEA-01** As EMAIL-A open S-TEMPLATE. Button reads **Join**. Joining takes you to setup.
- [ ] **W-SEA-02** Reopen the season. Button reads **Continue** and goes to the challenge page.
- [ ] **W-SEA-03** With S-TEMPLATE active, try to join S-SECOND. Refused with clear copy about the one-unfinished-season rule and how to free the slot.
- [ ] **W-SEA-04** Join S-EMPTY. Setup starts with one blank goal and no recommendations.
- [ ] **W-SEA-05** S-DRAFT cannot be reached by URL, UUID or slug as a participant.
- [ ] **W-SEA-06** Visit `/seasons/<uuid>` for a published season. It redirects to the slug URL.
- [ ] **W-SEA-07** Join, then navigate away before starting. Return later: the slot is held and setup still works.
- [ ] **W-SEA-08** Two browsers, same user: join S-TEMPLATE in one and S-SECOND in the other at the same moment. Exactly one succeeds.

## 7. Setup (starting an attempt)

- [ ] **W-SET-01** Setup is prefilled with the recommended plan. Edit a goal title, delete one, add one. "Apply season plan" resets to the template.
- [ ] **W-SET-02** Remove every goal. "Start my challenge" is disabled and a hint explains why.
- [ ] **W-SET-03** Invalid goal values: negative target, 0, `1e3`, seven decimal places, 19+ digits. Start stays disabled or the error is clear.
- [ ] **W-SET-04** Limits: 20 goals, 101 milestones, title 200 characters, description 4000.
- [ ] **W-SET-05** Add a milestone linked to a goal; delete that goal. The link is cleared, nothing breaks.
- [ ] **W-SET-06** Milestone target day 0 and 102 rejected. Day 1 and 101 accepted.
- [ ] **W-SET-07** Setup shows **no** pause, cancel or history controls.
- [ ] **W-SET-08** Does the page tell you which timezone governs your days? (It should; if not, note it.)
- [ ] **W-SET-09** Start. You land on the challenge page with today's report form and an empty grid.
- [ ] **W-SET-10** Double-click Start. One attempt only.
- [ ] **W-SET-11** Open setup in two tabs for the same enrollment; start in one, then the other. The second shows a clear stale-state message, not a duplicate attempt.

## 8. Daily reporting

- [ ] **W-REP-01** Submit a report with text only. Grid fills cell 1 with a brief animation. Counters update (1/101, streak 1).
- [ ] **W-REP-02** Submit with goal values (count and duration). Values are saved and shown when editing.
- [ ] **W-REP-03** Tick the manual-milestone checkbox on its target day. Milestone shows achieved.
- [ ] **W-REP-04** Empty and whitespace-only text rejected. 4000 characters accepted; 4001 rejected.
- [ ] **W-REP-05** A truthful "No practice today" report counts as a day.
- [ ] **W-REP-06** A second report the same day: you are guided to edit today's report.
- [ ] **W-REP-07** Edit today's report. Text and values update; the reporting count does not change.
- [ ] **W-REP-08** Simulate a network or server error while submitting. Your typed text stays in the box; retry succeeds without duplicating.
- [ ] **W-REP-09** Two tabs: submit in one, then in the other. The second reports already-reported and refreshes safely, keeping your draft.
- [ ] **W-REP-10** Emoji, newlines, long words and HTML-looking text (`<script>`) display exactly as typed, escaped, in your history.
- [ ] **W-REP-11** Day rollover: report around 23:55 and again after midnight Nairobi time. Two separate reporting days, with dates matching Nairobi.
- [ ] **W-REP-12** Next day, yesterday's report is no longer editable by you (needs a correction key).
- [ ] **W-REP-13** Skip a day. Current streak resets to 0 after the gap; reporting days and longest streak remain.
- [ ] **W-REP-14** Report the day after a single skip: streak restarts at 1.

## 9. Goals and milestones during an attempt

- [ ] **W-GOL-01** Revise a goal's title. A new revision is saved; earlier reports still show the original goal title.
- [ ] **W-GOL-02** Archive a goal. It disappears from the report form but remains in history.
- [ ] **W-GOL-03** Add a new goal mid-attempt. It appears in the next report form.
- [ ] **W-GOL-04** Add a milestone for a future day. Edit it. Archive it.
- [ ] **W-GOL-05** Add or edit a milestone whose target day is already reported. Refused as locked.
- [ ] **W-GOL-06** A milestone achieved on day 7 shows its grid marker; the screen-reader summary lists milestone days.
- [ ] **W-GOL-07** Change a goal in two tabs. The second save reports a version conflict and keeps your text.

## 10. Streaks, credits, pause and resume

- [ ] **W-STR-01** After 7 consecutive reporting days a credit appears; after 14, two. A gap does not remove credits.
- [ ] **W-STR-02** Read the credit wording. Does a user know what credits are for? (They are not spendable yet.)
- [ ] **W-PAU-01** Pause the season. Streak resets to 0, credits go to 0, longest streak and reporting days are kept. "Resume enrollment" appears.
- [ ] **W-PAU-02** While paused, the report form is gone. Joining a different season is blocked until the next reporting day (Nairobi).
- [ ] **W-PAU-03** After the next reporting day starts, join S-SECOND while S-TEMPLATE stays paused. Succeeds.
- [ ] **W-PAU-04** Resume the paused season while S-SECOND is active: refused (would hold two slots). Succeeds when the slot is free.
- [ ] **W-PAU-05** Resume immediately after pausing (same day). Succeeds; streak still 0; credits not restored.
- [ ] **W-PAU-06** Pause after reporting earlier that same day. Confirm the streak behaviour matches what the page says.

## 11. Cancel, restart, retry, completion

- [ ] **W-CAN-01** The cancel area is visually distinct (danger zone) and last on the page. The button is disabled until you type the exact season identifier.
- [ ] **W-CAN-02** Cancel **keeping** data. Participation shows cancelled, slot freed immediately, history retained and readable.
- [ ] **W-CAN-03** Cancel **with erase**. Reports, goals, milestones for that attempt are gone; an erased marker remains. Earlier attempts are untouched.
- [ ] **W-CAN-04** On a cancelled season the button reads **Retry**. Retry opens setup; starting creates a new attempt with old history preserved.
- [ ] **W-CAN-05** Restart an active attempt with new goals (confirmation checkbox required). Old attempt kept in history; credits expire; counters restart at 0.
- [ ] **W-CAN-06** Cancel, then immediately join another season. Works.
- [ ] **W-CAN-07** Previous attempts and logs show in the side column (stacked on phone).
- [ ] **W-COM-01** As ADMIN, backdate a test user far enough; as that user backfill 101 distinct dates. The 101st report completes the attempt, frees the slot and shows the completion notice.
- [ ] **W-COM-02** After completion, edit the final report the same day. Allowed. Next day it is read-only.
- [ ] **W-COM-03** After completion press **Retry**. The new attempt is progress-only; the notice says original completion stays fixed; it does not take the unfinished-season slot.
- [ ] **W-COM-04** A completed season and another active season at once. Allowed.
- [ ] **W-COM-05** What does the user see on Home after completing? (Currently no acknowledgement. Decide if that is acceptable.)
- [ ] **W-COM-06** Report 101 versus restart in two tabs at once. Exactly one wins, no lost history, one completion record.

## 12. Home, history, notifications, tips

- [ ] **W-HOME-01** Home shows season card, today's primary action ("Write today's report" or "Edit today's report"), grid, streak, reporting days, credits, upcoming milestones and latest three logs.
- [ ] **W-HOME-02** New account with nothing active: friendly empty state with "Explore seasons".
- [ ] **W-HOME-03** Logs on Home are visible only to the owner. Open the same URLs in another account: no data.
- [ ] **W-HOME-04** Tips: toggle off, reload; preference is remembered. Toggle on, wait over 30 seconds; the tip rotates, and does not rotate in a hidden tab.
- [ ] **W-HIST-01** `/history` lists every enrollment with participation and retained-attempt count; each opens its challenge page.
- [ ] **W-NTF-01** `/notifications` empty state reads sensibly. As ADMIN backdate a user; that user gets a notification. Mark read; dismiss. Dismissed items disappear.
- [ ] **W-NTF-02** Toasts: routine "Saved." disappears after about six seconds, does not move content, pauses on hover and focus. Errors persist until dismissed.

## 13. Admin workflows (web)

All as ADMIN unless stated.

### Seasons

- [ ] **A-SEA-01** Create a draft with a slug (lowercase with hyphens; reject uppercase, spaces, leading or trailing hyphen, duplicates) and a title.
- [ ] **A-SEA-02** After creation you land on the editor. Edit the description and save (previously a bug: confirm it works).
- [ ] **A-SEA-03** Add template goals and milestones, save. Milestones are a separate section even when empty. "Remove" is a plain button.
- [ ] **A-SEA-04** Study-session link: a valid URL saves; a non-URL is rejected.
- [ ] **A-SEA-05** Publish. The slug becomes read-only. Participants can now see and join it.
- [ ] **A-SEA-06** Edit the template after people have joined. Existing participants' goals are unchanged; new joiners get the new template.
- [ ] **A-SEA-07** Feature and unfeature a season. Badge changes; direct enrollment works either way.
- [ ] **A-SEA-08** Concurrent edits from two admin tabs: the second save reports a version conflict.
- [ ] **A-SEA-09** The left list shows draft, published and featured states for every season.
- [ ] **A-SEA-10** A non-admin who knows the editor URL cannot load or save anything. Also try the API from DevTools: expect 403.

### Backdating and backfill

- [ ] **A-BKD-01** Choose a participant, a published season with a nonempty template, and a registration date on or after publication. The created participation shows a 24-hour window.
- [ ] **A-BKD-02** A date before publication, in the future, or for a user already enrolled is rejected. Is the copy understandable? (Known gap: it is generic.)
- [ ] **A-BKD-03** As the participant, you see the backdate notice, a list of skipped dates, and a "Fill a skipped date" form offering only eligible, unoccupied dates.
- [ ] **A-BKD-04** Fill dates out of order. Reports re-sort chronologically; counts, streaks and milestones recalculate.
- [ ] **A-BKD-05** After 24 hours (or after revoking the grant) the form disappears and unfilled dates stay unfilled.
- [ ] **A-BKD-06** A legacy season without a publication timestamp blocks backdating until an admin supplies one (only if such data exists).

### Correction keys

- [ ] **A-COR-01** Issue a single-report key. A 64-character key is shown once with a "shown once" warning. Reload: it is gone.
- [ ] **A-COR-02** As the owner, open the report under Previous attempts, use the key to correct the text and optionally move it to an eligible empty date. The key is consumed.
- [ ] **A-COR-03** Reuse the key: rejected. Use another person's key: rejected. Use an expired key (after 24 hours): rejected.
- [ ] **A-COR-04** Issue an attempt-window key (1 to 60 minutes). It can correct several reports until it expires. 61 minutes is rejected.
- [ ] **A-COR-05** Revoke a key before use. The owner's attempt is rejected.
- [ ] **A-COR-06** Correct a completed attempt's report. Completion date, count and entitlement do not change.
- [ ] **A-COR-07** The admin screens show IDs rather than names. **Can you tell whom you are about to grant to?** If not, log a usability issue.
- [ ] **A-COR-08** Admin never sees report text: check statistics, the corrections page and `/api/v1/admin/stats` in DevTools for any body text or seeds.
- [ ] **A-COR-09** Issuing or revoking grants needs a recent sign-in (after 10 minutes you must re-authenticate).

### Administration safety

- [ ] **A-SAF-01** Admin pages are hidden from non-admin navigation.
- [ ] **A-SAF-02** No public control promotes anyone to admin. Promotion is a database operation: perform it once on a throwaway account using your runbook SQL, and confirm nothing else changed.
- [ ] **A-SAF-03** Think through support cases: lost email access, wrong Discord account linked, accidental cancellation with erase, wrong correction grant, two accounts for one person. Is each solvable with the tools you have today?

## 14. Discord (production guild; linked and unlinked users)

Use `/` commands in the real server. All replies should be private (only you see them) with no pings.

### Setup and linking

- [ ] **D-LNK-01** Exactly five commands appear: `/dashboard`, `/report`, `/seasons`, `/join`, `/help`.
- [ ] **D-LNK-02** As an **unlinked** Discord user run `/dashboard`. You get a "Connect your account" message and a sign-in link. No error codes.
- [ ] **D-LNK-03** Use the link, sign in with Discord (new account) and return. `/dashboard` now recognises you.
- [ ] **D-LNK-04** Existing EMAIL-A links Discord in Account settings; `/dashboard` as that Discord user shows EMAIL-A's progress.
- [ ] **D-LNK-05** Unlink Discord on the web. The next Discord command asks you to reconnect.
- [ ] **D-LNK-06** Website links in messages open the production site. The "during local testing" note must not appear in production.

### Commands

- [ ] **D-HELP-01** `/help` lists commands and explains reports and streaks in plain language.
- [ ] **D-SEA-01** `/seasons` lists published seasons, marks featured ones, links to the website.
- [ ] **D-JOIN-01** `/join` autocompletes season names as you type. Choosing one enrols you and shows the dashboard.
- [ ] **D-JOIN-02** `/join` with a draft or nonsense name does nothing harmful.
- [ ] **D-JOIN-03** `/join` while another season is active: a friendly message about the one-unfinished-season rule.
- [ ] **D-JOIN-04** Run `/join` twice quickly. One enrollment.

### Dashboard

- [ ] **D-DASH-01** Dashboard shows season title, today's state, reporting days, streaks, state and a text grid with a distinct day 101.
- [ ] **D-DASH-02** Newly joined with recommended goals: "Start recommended plan" and "Custom goals" buttons. With no template: only custom.
- [ ] **D-DASH-03** Start recommended plan. The attempt starts; the dashboard now offers "Report today" and "Pause".
- [ ] **D-DASH-04** Custom goals: modal with up to three goals; submit with one, then with none (should fail gracefully).
- [ ] **D-DASH-05** Another person clicks your buttons (a friend with a copy of your message): refused.
- [ ] **D-DASH-06** Buttons expire after about 10 minutes. Click an old one: a friendly "try again", not a crash.

### Reporting

- [ ] **D-REP-01** `/report` opens the modal instantly (inside Discord's 3-second limit). With several active attempts, the season selector autocompletes.
- [ ] **D-REP-02** Submit a simple text report. The dashboard returns; the web shows the same report.
- [ ] **D-REP-03** Plan with a count or duration goal: the modal includes that field; blank is allowed; non-numeric is rejected; up to 6 decimals accepted.
- [ ] **D-REP-04** Plan with a manual milestone due today: a checkbox group appears. Select it; the web shows it achieved. **This uses a newer Discord component: test on desktop, Android and iOS clients.**
- [ ] **D-REP-05** A plan with too many measured goals (4+ plus text) redirects to the website with a clear message and a direct link.
- [ ] **D-REP-06** `/report` again edits today's report, prefilled with the saved text and values.
- [ ] **D-REP-07** A 4000-character report is accepted; anything over is blocked by Discord or rejected cleanly.
- [ ] **D-REP-08** Edit the same report on the web, then submit the stale Discord edit. You get a try-again message **and** a private recovery copy of your text in chunks. Verify it is complete and escaped.
- [ ] **D-REP-09** Paste `@everyone`, `<@123>`, links, backticks and emoji in a report. No mention fires; the recovery copy shows them literally.
- [ ] **D-REP-10** Unlink Discord on the web while a modal is open, then submit it. You still receive the recovery copy of your text.

### Lifecycle

- [ ] **D-LIF-01** Pause shows a confirmation explaining the consequences; confirm pauses. The dashboard now offers Resume.
- [ ] **D-LIF-02** Resume continues the paused attempt (subject to slot rules).
- [ ] **D-LIF-03** Restart, cancel, goal revisions and backfill are **not** offered in Discord; links go to the website.
- [ ] **D-LIF-04** Completed season: the dashboard offers editing today's final report only on the completion day.

### Robustness and safety

- [ ] **D-ROB-01** Direct messages: commands are guild-only and answer helpfully in DMs.
- [ ] **D-ROB-02** Server or tunnel down: what does the user see? (Typically "application did not respond".) Decide your status messaging.
- [ ] **D-ROB-03** On staging, run a command during a brief database outage. Friendly retry message, no partial state.
- [ ] **D-ROB-04** A pending-deletion user's Discord commands are refused.
- [ ] **D-ROB-05** Submit the same report from Discord and web at nearly the same time. One report exists; no duplicate.
- [ ] **D-ROB-06** No raw error codes, IDs or stack traces appear in any reply.

## 15. Cross-cutting checks

### Devices and display

- [ ] **X-DEV-01** On PHONE (320 to 400 px wide), complete signup, setup, report, pause and cancel. No horizontal scrolling; controls are tappable.
- [ ] **X-DEV-02** Landscape and tablet widths: navigation collapses neatly.
- [ ] **X-DEV-03** Browser text size at 200%: layouts remain usable.
- [ ] **X-DEV-04** Every page in light and dark theme: contrast readable, danger zones obvious.
- [ ] **X-DEV-05** Reduced motion (OS setting): animations disabled.
- [ ] **X-DEV-06** Throttle to slow 3G: skeletons show; nothing double-submits.
- [ ] **X-DEV-07** Firefox, Safari (iOS), Chrome, and Samsung Internet if your community uses it.
- [ ] **X-DEV-08** Screen reader pass (TalkBack or VoiceOver) through login, report and the cancel confirmation.

### Privacy and security spot checks (as a user)

- [ ] **X-SEC-01** Log in as EMAIL-A and EMAIL-B. Copy a challenge URL from A and open it as B. B sees "unavailable".
- [ ] **X-SEC-02** In DevTools, admin API routes return 403 for non-admins and never contain report text or seeds.
- [ ] **X-SEC-03** Response headers include a CSP with a nonce, `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, and HSTS on HTTPS.
- [ ] **X-SEC-04** The browser console shows no CSP or hydration errors on any page.
- [ ] **X-SEC-05** Post to `/api/v1/command` from another origin or without the CSRF header. Rejected.
- [ ] **X-SEC-06** Search the page source and network tab for your own email, password and tokens. Only the expected places contain them.

### Dates and time

- [ ] **X-TIME-01** "Today" in the app equals the Nairobi calendar date, including near midnight.
- [ ] **X-TIME-02** Set your device to a very different timezone (for example New York). Report dates still follow Nairobi.
- [ ] **X-TIME-03** Deletion countdown and backfill deadlines display correctly in your local time.

## 16. Operations and emails (staging or production)

- [ ] **O-OPS-01** `/api/health` and `/api/ready` on web return 200; worker `/health` and `/ready` return 200 from inside the server.
- [ ] **O-OPS-02** Stop the database briefly: readiness returns 503; the site shows a friendly error; it recovers by itself.
- [ ] **O-OPS-03** Restart the web container mid-session. You stay logged in; nothing is corrupt.
- [ ] **O-OPS-04** Stop the worker for a few minutes. Reports and completion still work. Restart: the queue drains without duplicates.
- [ ] **O-OPS-05** Confirm the maintenance scheduler runs every minute. On staging, create a deletion request, backdate its deadline, and confirm erasure and the deletion email.
- [ ] **O-OPS-06** Verify, recovery, recovery-address verification and deletion emails all render well in Gmail web and mobile, none land in spam, and links use the production origin.
- [ ] **O-OPS-07** Run a backup. Confirm the encrypted file and the ledger are in off-server storage with the expected timestamp.
- [ ] **O-OPS-08** Restore that backup on a separate machine; sign in as a test user; confirm reports, completion and an erased account behave correctly.
- [ ] **O-OPS-09** Cause each alert you configured (site down, mail failure, old backup) once, and confirm you receive it.
- [ ] **O-OPS-10** Burst test: 20 people (or a script) sign up and log in within two minutes. Note errors and memory and CPU use.

---

## 17. Findings log

Copy this table into your notes and add a row per finding.

| #   | Test ID | Severity | What I did | Expected | Actual | Request ID / screenshot | Decision |
| --- | ------- | -------- | ---------- | -------- | ------ | ----------------------- | -------- |
| 1   |         |          |            |          |        |                         |          |

## 18. Questions to answer after the pass

1. Could a first-time user reach their first report in under five minutes without help?
2. Which three screens made you hesitate, and what copy would remove the hesitation?
3. Did any flow depend on knowing how the system works (slots, pausing, linking)? Where should that explanation live?
4. What would you tell a user who says "my progress disappeared"? Can you actually fix it?
5. If email stopped working tomorrow, how would you verify and recover people?
6. Which findings are S1 (block), and which can wait for wave 2?

## 19. Exit criteria for inviting users

- [ ] Zero open S1 findings.
- [ ] Every test in sections 2, 3, 4, 8, 14 and 16 passed on the production domain.
- [ ] Admin flows A-SEA, A-BKD and A-COR passed with a second person as the participant.
- [ ] You have written the support runbook and tried at least one case from it.
- [ ] The pilot cohort knows what the MVP does and does not include (no artwork yet; credits are not spendable yet).
