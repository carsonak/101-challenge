# Local generator lab

Owner: generator. Gate A0 only. Status: not implemented.

## Scope

Add a private developer-only lab application on the artwork branch, separate from the v0.1 web app. Use fictional fixture inputs; no participant database or external service credentials. Show a seed corpus gallery plus progress 0–101, palette/motif configuration, initial goals/milestones, sample reports, reroll and correction controls. Display developer provenance for fictional inputs and export SVG/PNG plus a fixture manifest.

Bind to loopback by default. Never deploy the lab with participant credentials or include it in production builds. Seeds shown here must be clearly fictional. Render server-side using the same generator planned for production.

## Tasks and acceptance

- [ ] Create fixture selectors, input validation, side-by-side variants and export controls.
- [ ] Exercise restart/new base seed, same-day text changes/fixed colour, missed dates, milestones and rerolls.
- [ ] Capture review artifacts with seed/config/generator/input digests, using only fictional data.
- [ ] Verify fresh clone runs after installing dependencies without Discord, Google, mail, hosting or tracker tables.

Review visual direction through saved fixture/config changes, not secret random tweaks or real participant exports. No generator implementation is part of the foundation commit.
