# Heroínas y Héroes Paisanos

Technical foundation for the operational management system in Guerrero.

## Requirements

- Node.js 24 LTS, version 24.15.0 or newer within the 24.x line.
- PNPM 12.0.0 (pinned in `packageManager`).

No global Vite+ or Nest CLI installation is required. No database, secrets, or
environment files are needed for this phase.

## Local development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- Web: <http://127.0.0.1:5173>
- API health: <http://127.0.0.1:3000/api/health>

Both servers bind to loopback only. The web development server proxies `/api`
to Nest. The page displays loading, success, or failure based on the real health
response. Restart/reload the page to check again after restarting the API.
Stop both development processes with Ctrl+C.

## Commands

| Command                                 | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                              | Start both applications in watch mode through Vite+        |
| `pnpm build`                            | Build API with Nest CLI and web with Vite+                 |
| `pnpm lint`                             | Run workspace-wide Vite+ linting                           |
| `pnpm format:check`                     | Check formatting without changing files                    |
| `pnpm format`                           | Format setup/source files; original documents are excluded |
| `pnpm typecheck`                        | Check API with TypeScript and web with Vite+               |
| `pnpm check`                            | Run lint, formatting checks, and type checks               |
| `pnpm test`                             | Compile API and run HTTP tests; run React component tests  |
| `pnpm --filter @hhpaisanos/api start`   | Run the compiled API after building                        |
| `pnpm --filter @hhpaisanos/web preview` | Preview the built static web application                   |

The development proxy is not deployment infrastructure. Static web preview does
not proxy API requests; integration is verified with `pnpm dev`.

## Organization and tooling

```text
apps/api/src/health/  Nest health module
apps/web/src/         Single React application
docs/                Functional requirements and proposed database model
```

New business modules will be organized by feature, with responsibility folders
only when useful. No shared packages or speculative architectural layers exist.

The workspace was initialized using the official Vite+ 1.5.0 monorepo generator
in a temporary directory to protect existing documents. Its example applications
and shared utility package were not retained. Nest was scaffolded using its
official CLI, then reduced to the health module. Root lint/format settings live
in `vite.config.ts`; application settings stay with each app.

PNPM manages dependencies and the single lockfile. Vite+ orchestrates package
scripts with `vp run`. In particular, `vp run -r build` runs both build scripts,
whereas `vp build` alone is the web build tool, not a Nest compiler.

Vite+ runs all tests. API HTTP tests import Nest's compiled output to preserve
TypeScript decorator metadata without adding another transpiler. Web tests run
with jsdom and React Testing Library. Task caching is explicitly disabled; no
build cache optimization has been adopted.

## Git workflow

- `main` is the stable, production-oriented branch; this initial foundation is
  not a production-ready business application.
- `dev` is the permanent development integration branch.
- Create `feat/*` and `fix/*` branches from an up-to-date `dev`.
- Normal development pull requests target `dev` explicitly:
  `gh pr create --base dev --head feat/<name>` (or `fix/<name>`).
- Promote releases with a pull request from `dev` to `main`:
  `gh pr create --base main --head dev`.
- Use Conventional Commits. Use Git worktrees for independent or parallel work
  when useful, not for every task.
- Pushes, pull requests, merges, deployments, and repository setting changes
  require explicit authorization. Never force-push or delete protected branches.

## Scope

Health only reports process availability, not database or external-service
readiness. Persistence (MySQL 8.4 and Drizzle), schema/migrations, authentication,
authorization, business features, Telegram, deployment, and CI/CD are deferred.

The original `AGENTS.md`, `docs/REQUIREMENTS.md`, and `docs/DATABASE_MODEL.md`
remain unchanged. Functional decisions pending in those documents must be
resolved before implementing the affected business modules, including report
draft optionality and attendance/report transitions.
