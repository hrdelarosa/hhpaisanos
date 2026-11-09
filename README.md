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

- Web: <http://localhost:5173>
- API health: <http://localhost:3000/api/health>

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
apps/api/src/modules/auth/ Authentication, server-side sessions and permission guards
apps/api/src/modules/users/ Account administration and read-only access catalogs
apps/api/src/modules/observers/ Observer profile administration independent of accounts
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

## Backend authentication

The API exposes:

| Endpoint                         | Input / behavior                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`           | `{ "username": "...", "password": "..." }`; sets the session cookie                                  |
| `GET /api/auth/me`               | Returns `id`, `username`, `fullName`, `role`, `permissions`, `mustChangePassword`                    |
| `POST /api/auth/logout`          | Revokes the current session and clears its cookie; idempotent                                        |
| `POST /api/auth/change-password` | `{ "currentPassword": "...", "newPassword": "..." }`; revokes every session and requires a new login |

All mutating requests, including login/logout, require `Content-Type: application/json`,
`X-HHP-CSRF: 1`, and an `Origin` in `AUTH_ORIGINS`. Send `{}` for logout. Browser
requests use the existing same-origin `/api` development proxy; no credentialed
cross-origin CORS access is enabled. Authentication responses are not cacheable.

Sessions have fixed absolute lifetimes: **ADMIN 30 minutes; ENLACE and OBSERVADOR
3 hours**. Requests never renew sessions, slide expiration, or impose an idle
timeout. Session tokens have 256 random bits; only SHA-256 hashes are persisted.
The cookie is host-only, HTTP-only, `SameSite=Lax`, and `Path=/`. Production requires
`NODE_ENV=production`, explicit HTTPS `AUTH_ORIGINS`, and HTTPS transport; its cookie
is `Secure` with the `__Host-` prefix. Plain HTTP origins are accepted only for
loopback development. HTTPS origins also select secure cookies in development.
The API does not enable `trust proxy`; forwarded IP headers are not trusted.

Passwords use Argon2id (19 MiB memory, two iterations, parallelism one, random salt).
New passwords must contain **15–128 Unicode code points**, with spaces and Unicode
allowed, without normalization or composition rules; the current password cannot
be reused. Temporary credentials restrict access to `me`, password change and logout.

Five consecutive failed logins lock the account for **15 minutes**. Requests during
the lock do not extend it. Successful login or expiry resets the failed-attempt
counter (expiry is applied lazily at the next login). Password changes allow at most
five failed current-password verifications per account in a rolling 15-minute
window, enforced through audit records under a user-row lock. They do not lock out
login or invalidate other sessions on failure. A bounded per-process backstop also
limits login/password-change requests to 30 per IP per minute, including malformed
inputs. With multiple API instances, add a shared edge limiter; behind a reverse
proxy the backstop currently sees the proxy IP. Account-level protections remain
shared through MySQL. No session/audit purge or retention policy is implemented.

`AuthModule` registers authentication, CSRF and permission guards globally. Mark
public routes explicitly with `@Public()`; health remains public. Use
`@RequirePermissions('resource:action')` for all required permissions and
`@CurrentUser()` for the authenticated identity. ADMIN has no implicit permission
bypass. Permissions and user/role activity are read on each request. Resource
ownership checks belong to their future business modules. Account deactivation
calls `AuthService.revokeUserSessions` in the same transaction while holding
the user row lock. Role-permission matrix editing is not exposed over HTTP.

Security events use an explicit audit allowlist without credentials, token/password
hashes, submitted usernames, IPs or user-agent strings. Password/session changes and
their audit events commit atomically. Unexpected API errors return a generic 500
and log no driver exception details, because Drizzle errors may embed SQL values.

### Explicit local administrator bootstrap

After explicitly migrating the disposable local database, run:

```sh
pnpm --filter @hhpaisanos/api auth:bootstrap-admin local-admin
```

The command requires an interactive terminal and asks twice for a hidden temporary
password. It runs only against the documented localhost development database, creates
the ADMIN role if absent, refuses an inactive role or any existing administrator,
and creates an audited account requiring a password change. It never runs on startup,
seeds no permissions, and cannot reset an existing account. Production provisioning
is deliberately not automated. Automated tests use isolated synthetic fixtures instead.

Auth integration tests reuse the isolated MySQL setup and test complete security
flows, including concurrent failures, password-change/login races, CSRF, permission
changes, expiration/revocation and audit-failure rollback. Run them with
`pnpm --filter @hhpaisanos/api test:integration`; ordinary API tests do not need MySQL.
Integration files run sequentially with a 30-second per-test budget for Docker I/O;
security concurrency tests still send concurrent requests within each test.

## Operatives backend

The initial module exposes only:

| Endpoint                  | Permission          | Behavior                                                                              |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/operatives`    | `operatives:create` | Accepts `name`, `startDate`, `endDate`; creates `borrador` with atomic audit          |
| `GET /api/operatives`     | `operatives:read`   | Filters by `name` (literal substring) and `status`; paginates with `page` and `limit` |
| `GET /api/operatives/:id` | `operatives:read`   | Retrieves a UUIDv7 operative or returns 404                                           |

Dates are strict civil `YYYY-MM-DD` values in the MySQL DATE range, with start <= end.
Names are trimmed without changing casing, accents or internal whitespace. The new
`0001_operatives_name_dates_unique` migration rejects equivalent names with identical
dates using the existing column collation (verified `utf8mb4_0900_ai_ci` in isolated
MySQL 8.4). Conflicts return 409, including concurrent submissions. Overlapping
intervals are allowed. Editing, transitions and deletion are not implemented.

List responses contain `items`, `page`, `limit`, and `total`. Defaults are page 1
and limit 20 (maximum 100), ordered by start date descending, then UUID descending.
Details expose `id`, `name`, `startDate`, `endDate`, `status`, `createdAt`, `updatedAt`;
timestamps are UTC strings with six fractional digits. Global session, mandatory
password-change, CSRF and permission protections apply unchanged.

**Permission dependency:** the Users module owns initial provisioning. Approved
grants are ADMIN: `operatives:read` and `operatives:create`; ENLACE:
`operatives:read`; OBSERVADOR: neither. No grants or role bypasses are introduced
by Operatives. Use the Users-owned `users:provision-permissions` command described
below; without provisioned grants, real accounts cannot use these endpoints.

Apply migrations only with explicit authorization. Before migrating an existing
database, verify `operativos.nombre` collation and check for duplicate tuples and
untrimmed legacy names. Resolve any conflicts explicitly; the migration neither
normalizes nor deletes existing records. A duplicate prevents index creation.
The original migration remains unchanged.

Operatives integration tests reuse the Compose MySQL helper but create their own
random database, synthetic database user and permission fixtures. They do not
require shared development credentials. Run after building the API:

```sh
pnpm --filter @hhpaisanos/api build
pnpm --filter @hhpaisanos/api exec vp test run test/operatives.integration.test.mjs --no-file-parallelism --testTimeout 30000
```

When reusing a Compose service started from another worktree, set
`COMPOSE_PROJECT_NAME` to its existing project name (locally `hhpaisanos`).
Do not start a second shared MySQL service. Tests apply migrations only to their
disposable database and remove their database/user afterward.

## Observers backend

Observers manages operational profiles independently of login accounts across Guerrero.

| Endpoint                          | Input                                                        | Required permission       |
| --------------------------------- | ------------------------------------------------------------ | ------------------------- |
| `POST /api/observers`             | `firstNames`, `lastNames`, optional nullable `phone`         | `observers:create`        |
| `GET /api/observers`              | Optional `page`, `pageSize`, `search`, `active`, `linked`    | `observers:read`          |
| `GET /api/observers/:id`          | UUIDv7                                                       | `observers:read`          |
| `PATCH /api/observers/:id`        | At least one of `firstNames`, `lastNames`, `phone`; `reason` | `observers:update`        |
| `PATCH /api/observers/:id/status` | `active`, `reason`                                           | `observers:change-status` |

Creation returns 201 with an active, accountless profile; patches return 204.
Profiles expose only `id`, `firstNames`, `lastNames`, `phone`, `active`, `userId`,
`createdAt`, `updatedAt`. Timestamps follow Users' UTC MySQL string representation
with six fractional digits. Names preserve supplied spelling/whitespace and allow
1–100 Unicode code points; non-null phones allow 1–20. Neither may be whitespace-only.
Omitted patch fields remain unchanged; explicit `phone: null` clears the phone.
Reasons are required, nonblank and at most 500 code points. Unsupported fields are
rejected. Identical updates preserve timestamps and generate no fictitious audit.

Lists return `{ items, page, pageSize, total }`, default to page 1 / 20 items,
allow at most 100 items per page and order by creation time then UUID ascending.
`search` matches literal substrings in either name field; `active` and `linked`
accept only `true` or `false`. `linked` filters existing relationships but does not
manage them. All normal session, mandatory password-change and CSRF protections apply.

Profile status is independent of account status: activation/deactivation never
changes the linked account, its sessions or assignments. No deletion, account
linking/unlinking/reassignment, self-service or assignment management is exposed.
Mutations recheck authority and commit with minimal allowlisted audit events in one
transaction; personal edits record changed field names, not personal values.

**Permission dependency:** approved future grants are ADMIN/ENLACE: all four;
OBSERVADOR: none. The shared permission provisioning command is intentionally
unchanged in this branch. Until the separate provisioning integration is approved
and explicitly applied, real accounts without these grants cannot use the module.
No schema migration or automatic grants are introduced.

Integration tests use isolated synthetic MySQL databases/accounts and permissions:

```sh
pnpm --filter @hhpaisanos/api build
pnpm --filter @hhpaisanos/api exec vp test run test/observers.integration.test.mjs --no-file-parallelism --testTimeout 30000
```

When sharing the existing Compose service across worktrees, set
`COMPOSE_PROJECT_NAME=hhpaisanos`; do not start another MySQL container.

## Backend user administration

Users operates within the single Guerrero scope. Every endpoint requires both an
active ADMIN account with a completed password change and its explicit permission.
ADMIN has no implicit bypass. Authorized administrators can view ADMIN accounts,
but **no Users mutation can create, modify, deactivate, reset or assign ADMIN**.
This also prevents concurrent requests from disabling the last active administrator.

| Endpoint                             | Input                                                     | Required permission    |
| ------------------------------------ | --------------------------------------------------------- | ---------------------- |
| `POST /api/users`                    | `username`, `fullName`, `roleId`                          | `users:create`         |
| `GET /api/users`                     | Optional `page`, `pageSize`, `search`, `active`, `roleId` | `users:read`           |
| `GET /api/users/:id`                 | UUIDv7                                                    | `users:read`           |
| `PATCH /api/users/:id`               | `fullName`, `reason`                                      | `users:update`         |
| `PATCH /api/users/:id/status`        | `active`, `reason`                                        | `users:change-status`  |
| `PUT /api/users/:id/role`            | `roleId`, `reason`                                        | `users:assign-role`    |
| `POST /api/users/:id/reset-password` | `reason`                                                  | `users:reset-password` |
| `GET /api/roles`                     | None                                                      | `roles:read`           |
| `GET /api/permissions`               | None                                                      | `permissions:read`     |

Mutations use the same Origin/JSON/CSRF contract as Auth. Creation returns 201;
reset returns 200; other mutations return 204. Creation and reset return only
`{ id, temporaryPassword }` with `Cache-Control: no-store`. Deliver the temporary
password to its owner through an authorized channel: no email or Telegram delivery
is implemented. A lost response requires another authorized reset; plaintext is
never persisted, audited or retrievable. Temporary passwords are generated with
256 random bits and Argon2id-hashed using Auth's existing policy. Credential
generation shares Auth's bounded per-process IP rate limiter.

Usernames are immutable and retain exact Unicode/whitespace semantics. Only
`fullName` is editable. One active ENLACE or OBSERVADOR role may be assigned;
unknown, inactive and ADMIN roles are rejected. Existing observer links cannot be
changed here, and effective role changes are blocked while linked. Account state
does not change observer profile state. New OBSERVADOR accounts are initially
unlinked; the role alone does not grant ownership of an observer's information.

Reset clears login failures/temporary lockout, requires a password change and
revokes live sessions without reactivating an inactive account. Deactivation and
effective role changes also revoke live sessions in the same transaction. Reactivation
never restores revoked sessions. Repeated identical profile/status/role updates
are no-ops without fictitious audit events. Mutations recheck the actor's session,
role and permissions under transactional locks. Audit writes and session revocations
are atomic with the account change; personal-name edits record the changed field,
not copies of the names. No physical deletion is exposed.

Pagination defaults to page 1 / 20 items, with at most 100 items per page and a
stable creation-time/ID order. The response is `{ items, page, pageSize, total }`.
`active` accepts only `true` or `false`; `search` matches literal substrings in
username/fullName, including literal `%`, `_` and `!`. Account and catalog responses
are non-cacheable and never contain password hashes or session tokens.

### Explicit initial permission provisioning

Users owns the single initial provisioning command, including the agreed Operatives
codes. It does not implement Operatives endpoints. Prerequisites: migrated schema,
existing ADMIN/ENLACE/OBSERVADOR roles, and an existing active ADMIN account with
an active ADMIN role. Missing roles cause a failure without writes; this command
does not create roles or accounts. The development bootstrap creates only ADMIN.
Initialize missing approved roles explicitly in the disposable local development
database, after applying migrations with authorization:

```sh
pnpm --filter @hhpaisanos/api roles:init-dev
```

This repeatable command creates only missing active ADMIN, ENLACE and OBSERVADOR
roles, using the existing Drizzle UUIDv7 defaults. It preserves existing identifiers
and metadata, and refuses inactive approved roles without making changes. It never
creates users, grants permissions or modifies role-permission mappings. It requires
`DB_HOST=localhost`, `DB_NAME=hhpaisanos`, `DB_USER=hhpaisanos`, valid local credentials,
and `NODE_ENV` unset or `development`. It never runs on startup or during migrations.
A general role-management interface remains out of scope.

For initial setup, run this command before `auth:bootstrap-admin`; an ADMIN role
already created by bootstrap is also preserved. Then obtain the active administrator's
UUIDv7 and preview/apply permission provisioning separately. The administrator must
complete the mandatory password change before using Users or Operatives endpoints.
Each database-writing step requires explicit authorization; none runs automatically.

```sh
# Preview only; UUID identifies the administrative actor, not a password or session.
pnpm --filter @hhpaisanos/api users:provision-permissions <ADMIN-UUIDv7> "Approved initial access"
# Explicitly apply the previewed mapping.
pnpm --filter @hhpaisanos/api users:provision-permissions <ADMIN-UUIDv7> "Approved initial access" --apply
```

The closed mapping contains exactly ten codes:

- ADMIN: all eight Users/catalog permissions above, plus `operatives:read` and `operatives:create`.
- ENLACE: only `operatives:read` from that set.
- OBSERVADOR: none from that set.

Grants belong to roles, so all accounts with the role receive them. Applying the
command creates missing permission rows, adds missing approved grants and removes
incorrect grants **within these ten codes and three roles only**. Other permissions,
other roles and existing descriptions are untouched. Actual changes have individual
administrative audit events with the actor and supplied reason in one transaction;
repeating an already-applied mapping writes nothing. The command never runs on
startup or during migrations and does not create/reset accounts. Run it only with
explicit authorization against the intended database; it requires database privileges
to manage this limited catalog. It is not an HTTP permission editor.

Users integration tests exercise authorization, protected accounts, observer links,
credential lifecycle, concurrent login/mutation races, pagination, provisioning and
audit-failure rollback. Auth/Users/database tests also accept a dedicated synthetic MySQL
account named `hhp_test_<16 lowercase hex digits>` instead of the development user;
that account must be created and removed by the isolated test setup, never by the API.

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
Backend authentication, permission guards, scoped account administration, observer
profile administration and initial operative creation/consultation are implemented; other business workflows, frontend
authentication, Telegram, deployment and CI/CD remain deferred. Persistence tables
alone do not implement their workflows.

`docs/REQUIREMENTS.md` and `docs/DATABASE_MODEL.md` record the confirmed auth
policies. Other pending functional decisions must be resolved before implementing
the affected business modules, including report draft optionality and
attendance/report transitions.
