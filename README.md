# 101 Challenge

Build a steady practice with BitDevs Kisumu. Choose a season, make your own goals, and record 101 reporting days. Your logs stay private; missed days affect streaks, not total progress.

## Quick start

Install Node 24.7–24.x, pnpm 12.9.1, and Docker Compose (or compatible Podman Compose), then run:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm services:up
pnpm database:migrate
pnpm dev:web
```

In another terminal, run `pnpm dev:worker`. Open http://localhost:3000 and find local verification emails in Mailpit at http://localhost:8025.

## Using the tracker

Create an account, verify your email, choose a season, and customize its recommended plan. Start with at least one goal, then write a daily report. Home shows your progress; the season page holds goals, milestones and previous attempts. Account settings include your profile, sign-in methods and privacy controls.

## Learn more

- [Contributing](CONTRIBUTING.md): detailed setup, commands, containers and development checks.
- [Project status](docs/project-status.md): available features and release boundaries.
- [Plans](plans/README.md): current initiatives and progress.
- [Domain rules](docs/domain.md) and [operations](docs/operations.md).
- [Database and HTTP reference](docs/reference/README.md): DBML schema diagram and OpenAPI specification.
- [Verification evidence](docs/verification.md).

## License and identity

Code and documentation use [Apache-2.0](LICENSE). BitDevs Kisumu identity is reserved separately in [BRANDING.md]. Participant text and artwork are not automatically licensed under the code license. Set APP_DISPLAY_NAME to rebrand the displayed name.
