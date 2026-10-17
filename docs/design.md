# Design

Status: accepted direction for the web interface and Discord messages. This document records decisions and rationale. Implementation details that live in manifests or in the framework's documentation are intentionally not repeated here. Verify every color pairing for contrast when implementing; the values below are starting points.

## Product feel

101 Challenge is a quiet, encouraging place to build a habit. It is not a leaderboard and not a guilt machine. A truthful report counts even on a day with no activity, and missing days affect streaks, never total progress. The interface should feel like a well-kept notebook by Lake Victoria at dusk: warm, calm, a little ceremonial around milestones, never noisy.

Three words to design against: **steady, warm, honest.**

## Principles

1. **Today first.** The most important thing on any screen is what the participant can do today, then how they are doing, then everything else.

<!-- TODO(artwork): Update this grid description when the artwork integration replaces the placeholder. -->

2. **Progress is visible.** The 101-day grid is the signature element. It must feel good to fill in, and it anticipates the future artwork (one region revealed per reporting day) without pretending artwork exists.
3. **No guilt.** Never shame missed days. Streak loss is stated factually and followed by a clear way to continue.
4. **Private by default, visibly.** Report text is shown only to its owner. Anything that could look public is labelled.
5. **Dangerous things look dangerous.** Cancellation, erasure and account deletion are visually distinct, separated from routine actions, and require typing a confirmation.
6. **Explain in place, lightly.** Essential instructions stay visible; background explanation lives in contextual help and the optional tips on Home.
7. **Accessible and fast on a cheap phone.** Keyboard and screen-reader complete, readable at small widths, light on JavaScript and animation.

## Identity

Orange for the Bitcoin community, teal for the lake, warm paper for the notebook. The BitDevs Kisumu logo and trade dress are reserved (see the branding policy); do not imitate them. Use the configured display name in the interface.

### Color tokens

Define colors as semantic tokens, not raw palette values, so both themes work without per-component variants. Components use roles (`surface`, `text`, `accent`), never hex values.

| Role        | Light     | Dark      | Notes                                                            |
| ----------- | --------- | --------- | ---------------------------------------------------------------- |
| `bg`        | `#FAF7F2` | `#0F1A20` | Page background; warm paper in light, deep lake at night in dark |
| `surface`   | `#FFFFFF` | `#17262E` | Cards, menus, dialogs                                            |
| `surface-2` | `#F1ECE3` | `#1F313B` | Wells, table stripes, inactive grid cells                        |
| `line`      | `#D9D2C5` | `#35505C` | Borders and dividers                                             |
| `text`      | `#14232B` | `#EEF4F6` | Body text                                                        |
| `muted`     | `#4D626C` | `#A9BEC8` | Secondary text; must still meet text contrast                    |
| `accent`    | `#F7931A` | `#F7931A` | Primary actions, filled grid cells, highlights                   |
| `on-accent` | `#14232B` | `#14232B` | Text on accent. Use dark text on orange, never white             |
| `lake`      | `#0B6E7A` | `#5FD0DC` | Links, focus, secondary emphasis, informational states           |
| `success`   | `#2E7D4F` | `#6CCB92` | Saved, achieved milestone                                        |
| `danger`    | `#B3261E` | `#FF8A80` | Destructive actions and errors                                   |
| `danger-bg` | `#FBE9E7` | `#3A1F1F` | Danger zones                                                     |

Rules: body and interface text meet WCAG AA; large text and UI boundaries meet the non-text contrast requirement; color is never the only signal (pair it with an icon, label or pattern); orange is for actions and progress, not for long text.

An optional "dusk" gradient from orange through a muted rose to deep teal may appear on the landing hero and season headers only, never behind body text.

### Typography

Avoid generic system-looking type. Pair a characterful display face for headings and numerals with a highly legible body face, both self-hosted through the framework's font mechanism, with a system fallback stack. Use Fraunces for headings and Source Sans 3 for body text and counters, self-hosted with retained licenses. Requirements: open license, good numerals (progress numbers are prominent), Latin coverage with diacritics, small file sizes, and variable-font support to limit requests.

Scale: a modular scale with a ratio near 1.2 on small screens and 1.25 on large screens; body text never below 16px equivalent; line length 60 to 75 characters for prose; tabular numerals for counters and dates.

### Spacing, shape and depth

- Use a 4px base unit; space between related items is smaller than space between groups. Most screens use a 4, 8, 12, 16, 24, 32, 48 rhythm.
- Corner radii: small for inputs and badges, medium for cards and buttons, full for avatars and pills. One consistent set.
- Depth: prefer borders and subtle background steps over heavy shadows. One soft shadow for floating layers (menus, dialogs, toasts).
- Content width: readable single column for forms and prose; a two-column layout (main plus sidebar) only where the sidebar adds value, such as previous attempts.

### Motion

Motion explains change; it never decorates. Durations are short (instant feedback, quick transitions), easing is gentle, and nothing loops. Required moments: a grid cell filling when a report is saved, a toast sliding in without shifting layout, menus and dialogs fading and scaling slightly. Milestone achievement may have one brief celebratory flourish. Everything respects the reduced-motion preference by switching to instant state changes.

## The 101-day grid

The signature component, used on Home, the challenge page and mirrored as text in Discord.

- 101 cells: ten columns by ten rows plus a single capstone cell for day 101, set apart as the keystone (distinct shape or outline, same fill logic).
- Cell states: **reported** (accent fill), **today, not yet reported** (accent outline with a static outline), **empty** (`surface-2`), and **milestone target** (a small marker in the corner; the marker has a text alternative).
- Order follows reporting index, not calendar date, because completion counts distinct reporting days across any span.
- Accessible: the grid is a labelled group with a text summary ("42 of 101 reporting days"); individual cells are not focus stops unless they open detail, in which case they are buttons with full labels.
- Responsive: cells scale to fit; never scroll horizontally.

<!-- TODO(artwork): Revisit grid replacement and accessible progress behavior during artwork integration. -->

- When artwork ships, this grid is the placeholder it replaces or sits beside; keep its API simple (counts, milestone indexes, today state).

## Components

- **Buttons.** One primary (accent) per view area, secondary (outline, lake text), tertiary (text), and danger (solid danger). Minimum touch target comfortably above the commonly recommended size. Disabled buttons explain why through adjacent help text or a tooltip.
- **Forms.** Visible labels always (placeholders are hints, not labels). Group related fields, mark optional rather than required fields, validate inline on blur and again on submit, keep the user's text on any error, and associate errors with their fields for assistive technology. Password fields have a visible show/hide control.
- **Confirm by typing.** Destructive flows state exactly what will be removed and what is retained, then require typing the identifier (season identifier for cancellation, username for account deletion). The confirm button stays disabled until it matches.
- **Cards.** A card is one idea. Do not nest cards more than one level.
- **Toasts.** Overlay, bottom corner, never shift layout, auto-dismiss for routine success, persist for errors until dismissed, pause on hover and focus.
- **Dialogs and menus.** Use accessible primitives: focus trap, escape to close, return focus, labelled.
- **Badges.** Small status pills (Draft, Published, Featured, Paused, Completed, Progress-only) with text, not color alone.
- **Empty states.** Every empty list explains what belongs there and offers the next action, in the product's voice.
- **Loading.** Skeletons shaped like the final content rather than a bare "Loading".
- **Help.** Contextual help sits beside the control it explains; the tips area on Home is optional, rotating, pauses while hidden, and can be turned off, with the preference remembered.

## Screens

- **Landing.** Plain promise, one primary call to action (explore seasons) and one secondary (create account), a glimpse of the grid, a short honest explanation of how completion works.
- **Authentication.** Single-purpose pages, minimal fields, clear switch between login and signup, recovery link only on login, provider buttons only when configured, friendly errors that do not reveal whether an account exists.
- **Home.** Greeting, today's state with the primary action, the grid, streak and reporting counts, next milestone, latest logs (owner only), the optional tip.
- **Challenge page.** Order: today's report; progress and grid; goals and milestones with revision history; backfill window if present; a separate "Manage season" area holding pause, resume, restart; the danger zone last. Previous attempts and logs live in the side column (stacked above on small screens).
- **Setup.** A focused page that excludes lifecycle controls and history: recommended plan applied by default, goals and milestones editable, start disabled until at least one valid goal exists, with an explanation next to the disabled button.
- **Seasons.** Cards with title, short description, featured badge, and a single state-aware action: Join, Continue, or Retry.
- **Account.** Sections in a clear order: profile, sign-in methods, recovery email, devices, privacy and export, danger zone. The deletion countdown state replaces the page when a request is pending.
- **Admin.** Dense and functional but still consistent with the system. Metadata only; draft, published and featured seasons listed beside the editor; one-time keys shown in a copy-friendly block with a clear "shown once" warning.

## Voice and tone

Encouraging, concrete, calm. Short sentences. Say what happened and what to do next. Examples of the intended register:

- Not "You failed to report yesterday" but "Your streak reset. Your 42 reporting days are safe. Report today to start a new run."
- Not "Error: VALIDATION" but "Check the highlighted fields and try again."
- Destructive copy states consequences plainly: what is kept, what is removed, and that it cannot be undone.

Use the same plain-language error messages on the website and in Discord; they live in one shared place.

## Responsive behavior

Design for phones first; many participants will use a phone. Single column below the tablet width; two columns where the sidebar pattern applies; the navigation collapses to a compact header with a menu on small screens. The hide-on-scroll header must never hide while a menu is open or a control inside it has focus. Test at a very narrow width: nothing may overflow horizontally.

## Accessibility baseline

- Keyboard reachable and operable everywhere, visible focus ring in the `lake` color with sufficient offset, logical focus order, skip link.
- Landmarks and headings form a sensible outline, one `h1` per page.
- Dialogs, menus, tabs and toasts use proper roles and announce appropriately.
- Respect reduced-motion and color-scheme preferences; the theme choice (system, light, dark) persists and applies before first paint.
- Do not rely on hover; every tooltip's content is available on focus and touch.
- Text can be enlarged without breaking layout.

## Implementation notes

- Styling uses Tailwind semantic utilities and component-owned CSS Modules. Every module declares the shared cascade-layer order so route loading cannot move components ahead of base resets. Tokens above are CSS variables that switch under the theme attribute and the system preference; Tailwind's theme maps them to semantic utilities. Avoid arbitrary one-off values; if a value is needed twice, it becomes a token.
- Use accessible headless primitives for dialog, menu, tabs and toast rather than hand-rolling focus management.
- Icons come from one consistent set, used sparingly, always with a text label or accessible name.
- Keep client JavaScript small: server-render what can be rendered, load interactive widgets only where used.
- The browser tests find controls by role and accessible name; renaming a control is a test change that must be made deliberately.
- Private participant text is never stored in browser storage; only non-sensitive preferences (theme, tips) are.

## Discord visual language

Discord is a companion for the daily loop, so its messages should feel like the same product in a smaller room.

- Every reply is ephemeral and avoids mentions.
- Use Markdown headings for the answer, short command lists, bold progress labels and a fenced text grid. Escape participant text before adding authored formatting; never decorate recovery text in a way that loses its content. During local acceptance, label website links as usable on the computer running the app.
- Use one accent color for message accents, matching the web accent.
- Lead with the answer: a short line saying what happened, then the details, then at most a few buttons.
- Buttons mirror web hierarchy: one primary action per message, secondary actions neutral, destructive actions clearly marked and confirmed. Complex flows use a link button to the website.
- The dashboard shows season, reporting days, streaks, today's state and a compact text version of the grid with the 101st cell distinct.
- Same voice as the web, same error copy, no raw error codes, no IDs shown to users.
- Respect the platform's documented length and component limits through a tested validator, not by hope.

## Review checklist

Before declaring a UI change done, check each route in light and dark, at phone, tablet and desktop widths:

1. Is today's action obvious within a glance?
2. Is there exactly one primary action per area?
3. Can everything be done by keyboard, with visible focus?
4. Do text and controls meet contrast requirements, in both themes?
5. Does the layout survive a very narrow width and enlarged text?
6. Are empty, loading and error states designed, not default?
7. Do destructive actions look and behave differently from routine ones?
8. Does motion respect the reduced-motion preference?
9. Is any private text exposed where it should not be, or stored in the browser?
10. Does it still look like the same product as every other screen?

## Font assets

The variable Fraunces and Source Sans 3 assets are self-hosted in the web app font directory, with their SIL Open Font License files retained. Upstream sources are the [Google Fonts Fraunces family](https://github.com/google/fonts/tree/main/ofl/fraunces) and [Adobe Source Sans](https://github.com/adobe-fonts/source-sans). Local WOFF2 compression changes the container format and preserves family/axis information; no third-party font service receives browser requests.

Shared contract validation initializes Zod in its [CSP-compatible runtime mode](https://zod.dev/compile#content-security-policy) before creating schemas. Production pages keep script code generation disabled; caught library probes must not fill browser security reports.
