# Heroínas y Héroes Paisanos

Technical foundation for the operational management system in Guerrero.

## Requirements

- Node.js 24 LTS, version 24.15.0 or newer within the 24.x line.
- PNPM 12.0.0 (pinned in `packageManager`).
- Docker Desktop with its Linux engine and Docker Compose for local MySQL 8.4.

No global Vite+, Nest CLI, or Windows MySQL installation is required. Local MySQL
runs exclusively in Docker; the API and web run on the host.

## Local development

```sh
pnpm install --frozen-lockfile
# Configure .env and start MySQL as described below before starting the API.
pnpm dev
```

- Web: <http://127.0.0.1:5173>
- API health: <http://127.0.0.1:3000/api/health>

Both servers bind to loopback only. The web development server proxies `/api`
to Nest. The page displays loading, success, or failure based on the real health
response. Restart/reload the page to check again after restarting the API.
Stop both development processes with Ctrl+C.

## Commands

| Command                                          | Purpose                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `pnpm dev`                                       | Start both applications in watch mode through Vite+        |
| `pnpm build`                                     | Build API with Nest CLI and web with Vite+                 |
| `pnpm lint`                                      | Run workspace-wide Vite+ linting                           |
| `pnpm format:check`                              | Check formatting without changing files                    |
| `pnpm format`                                    | Format setup/source files; original documents are excluded |
| `pnpm typecheck`                                 | Check API with TypeScript and web with Vite+               |
| `pnpm check`                                     | Run lint, formatting checks, and type checks               |
| `pnpm test`                                      | Compile API and run HTTP tests; run React component tests  |
| `pnpm --filter @hhpaisanos/api start`            | Run the compiled API after building                        |
| `pnpm --filter @hhpaisanos/api db:generate`      | Generate versioned SQL and Drizzle metadata                |
| `pnpm --filter @hhpaisanos/api db:migrate`       | Explicitly apply pending migrations                        |
| `pnpm --filter @hhpaisanos/api db:check`         | Verify a real database connection                          |
| `pnpm --filter @hhpaisanos/api test:integration` | Test against isolated disposable MySQL data                |
| `pnpm --filter @hhpaisanos/web preview`          | Preview the built static web application                   |

The development proxy is not deployment infrastructure. Static web preview does
not proxy API requests; integration is verified with `pnpm dev`.

## Organization and tooling

```text
apps/api/src/health/  Nest process-health module
apps/api/src/database/ MySQL infrastructure and API-internal Drizzle schemas
apps/api/drizzle/     Versioned SQL migrations and Drizzle metadata
apps/api/src/modules/ Future business features (not created until needed)
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

## Local MySQL and environment

Run Docker Compose commands from the repository root. Copy `.env.example` to
`.env`, then replace both example passwords with distinct local passwords:

```powershell
Copy-Item .env.example .env
# Edit .env locally; never commit it or print resolved Compose credentials.
docker compose up -d --wait
docker compose ps
docker inspect hhpaisanos-mysql --format '{{json .State.Health.Status}}'
docker inspect hhpaisanos-mysql --format '{{json .Mounts}}'
docker inspect hhpaisanos-mysql --format '{{json .HostConfig.Tmpfs}}'
docker exec hhpaisanos-mysql sh -c 'grep /var/lib/mysql /proc/mounts'
pnpm --filter @hhpaisanos/api db:check
pnpm --filter @hhpaisanos/api db:migrate
pnpm dev
```

Use `DB_HOST=localhost`, `DB_PORT=3306`, `DB_NAME=hhpaisanos`, and
`DB_USER=hhpaisanos`. `DB_PASSWORD` authenticates the local development account;
`DB_ROOT_PASSWORD` is only for container initialization/administration, never for
the API. `DB_POOL_SIZE` defaults to 5 (allowed range 1–100). Missing required
values or invalid numeric settings prevent API startup. Examples contain no real
credentials, and `.env` is ignored by Git.

Compose reads the root `.env`. API package scripts run in `apps/api` and load
that same root file with Node's `process.loadEnvFile`; Drizzle Kit uses the same
configuration. Existing process environment values take precedence over `.env`
in both cases. There is no separate API environment file. Run API commands using
the documented PNPM filter so their working directory is correct.

Only one container is used: `hhpaisanos-mysql` (`mysql:8.4`). The published port
is **127.0.0.1:3306**, not an external interface. Host clients use `localhost`;
do not change the port mapping to work around hostname resolution problems.
The Compose healthcheck checks server availability; `db:check` verifies the
application credentials and connection.

**All MySQL data is disposable.** `/var/lib/mysql` is `tmpfs`, with no named,
anonymous or host-mounted data volume. Docker may list this mount only in
`HostConfig.Tmpfs`, not `Mounts`; `/proc/mounts` must show `tmpfs`. Data is lost
when the container stops or restarts, including Docker/host restarts. Migrate
again after starting it; do not store operational data here. No seed data is
installed.

```sh
# Stop MySQL: this loses the database contents.
docker compose stop mysql
# Restart and recreate the schema explicitly.
docker compose up -d --wait
pnpm --filter @hhpaisanos/api db:migrate

# Reset only this project's disposable development container/network.
docker compose down
docker compose up -d --wait
pnpm --filter @hhpaisanos/api db:migrate
```

No `docker system prune`, volume deletion, or unrelated-container operation is
needed. Changing `.env` credentials requires recreating the disposable container
(`docker compose down` followed by `up`), not just restarting the old container.

## Schema, migrations and verification

The initial migration contains `roles`, `permisos`, `rol_permisos`, `usuarios`,
`sesiones`, `auditoria`, `observadores`, `operativos`, `modulos_atencion`,
`asignaciones`, and `conceptos_atencion`. Attendance and attention-report/version
tables remain deferred pending functional lifecycle decisions. Optional location
fields exist but no collection or verification is enabled; settings have no
invented thresholds. No roles, permissions, users or official concepts are seeded.

UUIDv7 strings are strictly converted to/from `BINARY(16)` without byte swapping.
`DATETIME(6)` values are **UTC strings** (`YYYY-MM-DD HH:mm:ss.ffffff`) to avoid
losing microseconds through JavaScript `Date`; each pool connection sets its
MySQL session timezone to `+00:00`. `DATE` and `TIME` remain local civil strings.
Mutable timestamps update through Drizzle; direct SQL callers must supply their
own updates. UUID defaults are application-side, so direct SQL must supply IDs.

```sh
pnpm --filter @hhpaisanos/api db:generate
# Review the generated SQL and metadata before applying it.
pnpm --filter @hhpaisanos/api db:migrate
pnpm --filter @hhpaisanos/api db:check
pnpm --filter @hhpaisanos/api test
pnpm --filter @hhpaisanos/api test:integration
pnpm check
pnpm build
pnpm test
```

Commit generated SQL and `drizzle/meta` together; do not edit applied migration
history. The application never migrates/synchronizes on startup. `db:migrate`
tracks completed migrations in `__drizzle_migrations`; rerunning skips them.
Never aim these commands at an existing/unrelated database without approval.
MySQL DDL is not transactionally reversible: a failed migration may leave some
DDL applied without a completed tracking row. Commands report failure without
printing credentials or SQL values. Inspect migration state; for this disposable
environment, reset and replay rather than assuming rollback or blindly retrying.

Unit and process-health tests run without MySQL. Integration tests require the
documented running Compose service and `localhost` configuration. They create a
randomly named `hhpaisanos_test_*` database inside that same container, grant the
local development user access to it, and remove only that database and its
test-specific grants/account afterward. They test clean/repeated/failed
migrations (including partial DDL), constraints, cancellation/replacement, UUIDs,
UTC/microseconds, DML rollback, audit grants, and real Nest startup/shutdown.
Temporary migration fixtures are removed after use. If interrupted, inspect
leftover `hhpaisanos_test_*` databases/test accounts before manually deleting
only the identified test resources. Development tables/data are not touched.

### Integrity and audit boundary

FKs use `RESTRICT` to protect referenced history. The active-assignment unique
index blocks exact duplicates while retaining any number of cancelled versions;
it does not enforce arbitrary interval overlaps. Assignment dates within the
operative range, overlap locking, cancellation with activity, audit allowlists,
and atomic business mutations belong to future feature implementations.

The Compose-created `hhpaisanos` account intentionally has broad privileges on
the **disposable development database** so it can apply migrations. It does not
make audit data immutable. For any non-disposable environment, provision separate
migration and runtime accounts: the runtime account must have no DDL, no global
or database-wide write grants, only the required table privileges, and only
`SELECT, INSERT` on `auditoria` (never `UPDATE`, `DELETE`, `DROP`, or `ALTER`).
Integration tests verify that restricted audit-account design. Operational
history deletion must also be excluded from runtime privileges. Account/grant
provisioning outside isolated tests is not automated in this module.

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
readiness. Startup verifies MySQL connectivity and shutdown closes the pool.
Authentication, authorization, business features, Telegram, deployment, and
CI/CD remain deferred; persistence tables do not implement their workflows.

The original `AGENTS.md`, `docs/REQUIREMENTS.md`, and `docs/DATABASE_MODEL.md`
remain unchanged. Functional decisions pending in those documents must be
resolved before implementing the affected business modules, including report
draft optionality and attendance/report transitions.
