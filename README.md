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

Run Docker Compose commands from the repository root. For first setup only, copy
`.env.example` to `.env` and set distinct local passwords; preserve an existing `.env`:

```powershell
Copy-Item .env.example .env
# Edit .env locally; never commit it or print resolved Compose credentials.
docker compose up -d --pull never --wait mysql
docker compose ps
docker inspect hhpaisanos-mysql --format '{{json .State.Health.Status}}'
docker inspect hhpaisanos-mysql --format '{{json .Mounts}}'
pnpm --filter @hhpaisanos/api db:check
# Database reconstruction is a separate, explicitly authorized step.
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

**Local MySQL storage is persistent.** Compose key `mysql_data` mounts the dedicated
Docker named volume `hhpaisanos_mysql_data` at `/var/lib/mysql`. Verify `.Mounts`
shows type `volume`, that exact name and destination, and no tmpfs at that path.
Stop/start, Docker restarts and normal container recreation retain the database;
they do not require replaying migrations. Use synthetic development data, not real
operational data. A fresh volume creates the database and MySQL accounts only;
application migrations, roles, administrator bootstrap and permissions remain
separate authorized operations and never run automatically.

```sh
# Stop and start without deleting database contents.
docker compose stop mysql
docker compose start --wait mysql
# Recreate only MySQL when an approved service configuration change requires it.
# Requires the intended mysql:8.4 image to be available locally; no image is pulled.
docker compose up -d --no-deps --force-recreate --pull never --wait mysql
```

Never use `docker compose down -v`, remove `hhpaisanos_mysql_data`, or prune volumes
as routine maintenance: these operations can destroy the database. Plain `down`
retains the named volume, but is unnecessary for normal service stop/start. Do not
reuse or modify the unrelated `paisanos-dev` volumes. The explicit volume name is
shared across worktrees; use one local MySQL service, not parallel worktree instances.

`MYSQL_DATABASE`, `MYSQL_USER` and the password environment variables initialize an
**empty data directory only**. Editing `.env` or recreating a container does not
change existing MySQL account passwords. Rotate credentials through an explicitly
authorized MySQL account change, then update local configuration consistently;
never delete the volume to make new environment values take effect.

### Local backups

A persistent volume is not a backup: deletion, corruption or Docker storage loss
can still destroy it. After database initialization and before migrations or storage
changes, export a logical dump of `hhpaisanos` with `mysqldump --single-transaction
--no-tablespaces --set-gtid-purged=OFF --routines --events --triggers` to include stored
objects when present. Do not run concurrent DDL during the dump. Keep credentials
out of command arguments and output; use a protected credential source. Store timestamped dumps
outside the repository and Docker volume with restricted access, retaining a few
recent copies. Dumps contain sensitive account/session data, even in development.
Check command success and periodically test restoration in a separately authorized,
isolated database; never overwrite the working database as a restore test. Do not
copy live MySQL data files as a substitute for a consistent dump.

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
printing credentials or SQL values. Inspect migration state and preserve a backup
before planning recovery; never assume rollback, blindly retry or reset persistent
data. Any restore or reconstruction requires explicit authorization.

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

FKs use `RESTRICT` to protect referenced history. The non-cancelled-assignment
unique index blocks exact duplicates while retaining cancelled periods; it does
not enforce interval exclusions. Assignments enforces validity within the operative,
exclusive observer periods, transactional locking and atomic audit. Attendance/report
integration remains deferred and must protect activity against period changes before
capture is enabled.

The Compose-created `hhpaisanos` account intentionally has broad privileges on
the **local development database** so it can apply migrations. It does not
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

After explicitly migrating the local development database, run:

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

The module exposes:

| Endpoint                            | Permission            | Behavior                                                                                                  |
| ----------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /api/operatives`              | `operatives:create`   | Accepts `name`, `startDate`, `endDate`; creates `borrador` with atomic audit                              |
| `GET /api/operatives`               | `operatives:read`     | Filters by `name` (literal substring) and `status`; paginates with `page` and `limit`                     |
| `GET /api/operatives/:id`           | `operatives:read`     | Retrieves a UUIDv7 operative or returns 404                                                               |
| `POST /api/operatives/:id/activate` | `operatives:activate` | Accepts explicit `arrivalToleranceMinutes` and `reason`; activates a draft with atomic audit; returns 204 |

Dates are strict civil `YYYY-MM-DD` values in the MySQL DATE range, with start <= end.
Names are trimmed without changing casing, accents or internal whitespace. The new
`0001_operatives_name_dates_unique` migration rejects equivalent names with identical
dates using the existing column collation (verified `utf8mb4_0900_ai_ci` in isolated
MySQL 8.4). Conflicts return 409, including concurrent submissions. Overlapping
intervals are allowed. Editing, closing, reopening and deletion are not implemented.

Activation accepts only `{ "arrivalToleranceMinutes": 15, "reason": "Approved operational start" }`.
Tolerance is required, with no implicit default: 15 minutes is the initial operational
setting, but it is configurable as a nonnegative integer within the existing unsigned
SMALLINT range (0–65535). Reasons must be nonblank and at most 500 Unicode code points.
Only `borrador` can become `activo`; repeated activation and all other state transitions
return 409, without changing tolerance, timestamps or audit. Tolerance cannot be edited
after activation through this API. The interval must be valid and must not have ended
before today in `America/Mexico_City`; activation is allowed before its first date and
on its final date. Civil time is evaluated after acquiring locks. Actor/session/permission
revalidation, operative locking, state/tolerance changes and `operatives.activated` audit
use one transaction. Assignments, previous audit and unrelated settings remain unchanged.
No Attendance capture or persistence is enabled. The existing schema is sufficient;
this feature adds no migration.

List responses contain `items`, `page`, `limit`, and `total`. Defaults are page 1
and limit 20 (maximum 100), ordered by start date descending, then UUID descending.
Details expose `id`, `name`, `startDate`, `endDate`, `status`, `arrivalToleranceMinutes`, `createdAt`, `updatedAt`;
timestamps are UTC strings with six fractional digits. Global session, mandatory
password-change, CSRF and permission protections apply unchanged.

**Permission dependency:** the Users module owns initial provisioning. Approved
grants are ADMIN and ENLACE: `operatives:read`, `operatives:create` and `operatives:activate`;
OBSERVADOR: none. No grants or role bypasses are introduced
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

## Attention Modules backend

The Guerrero-wide API exposes:

| Endpoint                                  | Permission                        | Behavior                                                                    |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `POST /api/attention-modules`             | `attention-modules:create`        | Accepts only `name` and `municipality`; creates an active module            |
| `GET /api/attention-modules`              | `attention-modules:read`          | Filters by `name`, `municipality`, `active`; paginates with `page`, `limit` |
| `GET /api/attention-modules/:id`          | `attention-modules:read`          | Retrieves a UUIDv7 module, or 404                                           |
| `PATCH /api/attention-modules/:id`        | `attention-modules:update`        | Accepts `name` and/or `municipality`, plus required `reason`; returns 204   |
| `PATCH /api/attention-modules/:id/status` | `attention-modules:change-status` | Accepts boolean `active` and required `reason`; returns 204                 |

Names and municipalities are required on creation, trimmed only at their boundaries,
and limited to 120 and 100 characters. There is no uniqueness rule. Updates reject
nulls and require at least one editable field. Reasons must be nonblank and at most
500 characters. Effective name/municipality edits return 409 if any assignment exists,
including cancelled assignments. Status changes never alter assignments. Repeated
values are no-ops: no timestamp change or fictitious audit event. No deletion is exposed.

Name search is a literal substring; municipality uses equality under the existing
database collation. `active` accepts only `true` or `false`; omitting it includes both
states. Pagination defaults to page 1 / limit 20 (maximum 100), ordered by creation
time then UUID descending. Lists return `{ items, page, limit, total }`. Records expose
only `id`, `name`, `municipality`, `active`, `createdAt`, `updatedAt`, with UTC timestamps
preserving six fractional digits. Geographic coordinates and validation radius are
not accepted or exposed, and existing values are preserved.

Global session, mandatory password-change, CSRF and permission guards apply unchanged.
Writes revalidate the actor/permission in the transaction, lock the module for edits,
and commit the change and allowlisted administrative audit event atomically. Module
locking also protects the assignment check against concurrent FK inserts.

**Permission dependency:** the centralized `users:provision-permissions` command grants
all four permissions to ADMIN and ENLACE; OBSERVADOR receives none. Until explicitly
applied, real accounts without these grants receive 403, including ADMIN. There
are no startup grants, new migrations, automatic associations, or role-name bypasses.

Integration tests create their own disposable MySQL database/user and synthetic grants,
reusing the running Compose service rather than starting another container:

```sh
pnpm --filter @hhpaisanos/api build
# Set COMPOSE_PROJECT_NAME to the existing service project when using another worktree.
pnpm --filter @hhpaisanos/api exec vp test run test/attention-modules.integration.test.mjs --no-file-parallelism --testTimeout 30000
```

## Observers backend

Observers manages operational profiles independently of login accounts across Guerrero.

| Endpoint                              | Input                                                        | Required permission       |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| `POST /api/observers`                 | `firstNames`, `lastNames`, optional nullable `phone`         | `observers:create`        |
| `GET /api/observers`                  | Optional `page`, `pageSize`, `search`, `active`, `linked`    | `observers:read`          |
| `GET /api/observers/:id`              | UUIDv7                                                       | `observers:read`          |
| `PATCH /api/observers/:id`            | At least one of `firstNames`, `lastNames`, `phone`; `reason` | `observers:update`        |
| `PATCH /api/observers/:id/status`     | `active`, `reason`                                           | `observers:change-status` |
| `GET /api/observers/linkable-account` | Required exact `username`                                    | `observers:link-account`  |
| `PUT /api/observers/:id/account`      | `userId`, `verificationMethod`, `reason`                     | `observers:link-account`  |

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
unlinking/reassignment, self-service or assignment management is exposed.
Mutations recheck authority and commit with minimal allowlisted audit events in one
transaction; personal edits record changed field names, not personal values.

**Permission dependency:** the centralized `users:provision-permissions` command grants
all five permissions to ADMIN and ENLACE; OBSERVADOR receives none. Until explicitly
applied, real accounts without these grants cannot use the module, including ADMIN.
No schema migration or automatic grants are introduced.

### Supervised account linking

Only an operator with `observers:link-account` may look up an exact username or
link a profile. Lookup returns only `{ id, username, fullName }`; absent and
ineligible accounts return the same 404. Username matching is byte-exact, without
trimming or case/accent folding. No general Users access is granted to ENLACE.

Before submitting `{ userId, verificationMethod: "supervised_administrative", reason }`,
the authorized ADMIN/ENLACE must verify identity using an institutionally approved
procedure, witness the observer independently signing in with definitive credentials,
and confirm the exact profile/account pairing. **The method is an operator attestation,
not cryptographic proof of consent.** Do not request passwords, copy identity documents,
or use matching names, phones or UUIDs as identity evidence. Reasons must not contain
credentials, document numbers or unnecessary personal information.

New links require an active account, active OBSERVADOR role, no required password
change or current login lockout, and an active accountless profile. An account cannot
already belong to any other profile, including an inactive one. No assignment is required.
The transaction revalidates authority and eligibility under account-before-profile locks,
creates the link, revokes existing target-account sessions (new login required), and
records `observers.account.linked` with actor/session, reason, previous null user ID,
new user ID and verification method. Audit failure rolls everything back.

PUT returns 204. Conflicts return 409; links are never replaced. Repeating an identical
pair with existing linking evidence returns 204 without changing timestamps, audit or
sessions, even if the profile/account has since been suspended. Legacy links without
that evidence remain untouched and return 409, not a new verification certificate.
Their regularization needs a separately approved process.

No migration is needed: the nullable unique account FK already enforces 1:1. Future
personal capture must resolve identity from the authenticated user, check evidence for
the current pair and current profile status, and authorize assignment ownership within
the write transaction. A supplied `observerId` is not proof of identity. This feature
does not enable capture, unlinking, reassignment, self-service or Telegram linking.

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

Users owns the single centralized provisioning command for Users/catalog, Operatives,
Observers, Attention Modules and Assignments permissions. It does not implement operational endpoints.
Prerequisites: migrated schema,
existing ADMIN/ENLACE/OBSERVADOR roles, and an existing active ADMIN account with
an active ADMIN role. Missing roles cause a failure without writes; this command
does not create roles or accounts. The development bootstrap creates only ADMIN.
Initialize missing approved roles explicitly in the local development database,
after applying migrations with authorization:

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

The closed mapping contains exactly thirty-one codes:

| Permission group    | Codes                                                                                                                                              | ADMIN     | ENLACE    | OBSERVADOR |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- | ---------- |
| Users/catalog       | `users:create`, `users:read`, `users:update`, `users:change-status`, `users:assign-role`, `users:reset-password`, `roles:read`, `permissions:read` | All eight | None      | None       |
| Operatives          | `operatives:read`, `operatives:create`, `operatives:activate`                                                                                      | All three | All three | None       |
| Observers           | `observers:read`, `observers:create`, `observers:update`, `observers:change-status`, `observers:link-account`                                      | All five  | All five  | None       |
| Attention Modules   | `attention-modules:read`, `attention-modules:create`, `attention-modules:update`, `attention-modules:change-status`                                | All four  | All four  | None       |
| Assignments         | `assignments:read`, `assignments:create`, `assignments:update`, `assignments:cancel`                                                               | All four  | All four  | None       |
| Personal Attendance | `attendance:read-own`, `attendance:capture-own`                                                                                                    | None      | None      | Both       |

Administrative Attendance adds `attendance:read`, `attendance:capture-manual`,
`attendance:review`, `attendance:correct` and `attendance:annul` for ADMIN and ENLACE only.
OBSERVADOR retains only its two personal Attendance grants.

For databases provisioned with the previous twenty-six-code mapping, preview and explicitly
apply the same command again after separate authorization. It preserves existing permission
identifiers and approved grants, adding the five administrative Attendance permissions
and their ten ADMIN/ENLACE grants (exactly fifteen additions).
Upgrading older mappings also reconciles the existing operational grants. This does
not grant implicit ADMIN/ENLACE privileges. Final role totals are ADMIN 29, ENLACE 21,
OBSERVADOR 2 (52 grants total); administrative roles never receive personal capture grants.

Grants belong to roles, so all accounts with the role receive them. Applying the
command creates missing permission rows, adds missing approved grants and removes
incorrect grants **within these thirty-one codes and three roles only**. Other permissions,
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

## Assignments backend

Assignments are persistent validity periods with stable module and daily scheduled
hours, not daily shift rows. One observer may have at most one non-cancelled period
applicable on any date, across all operatives, even with different hours. Validity
does **not** establish attendance obligations on every date: no weekend, holiday,
rest-day calendar or daily attendance enforcement is included. Scheduling does not
authorize attendance capture or change an operative's lifecycle.

| Endpoint                              | Input                                                                                            | Permission / result                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `POST /api/assignments`               | `operativeId`, `observerId`, `attentionModuleId`, `validFrom`, `validTo`, `startTime`, `endTime` | `assignments:create`; 201                           |
| `GET /api/assignments`                | Optional filters below                                                                           | `assignments:read`; 200                             |
| `GET /api/assignments/:id`            | UUIDv7                                                                                           | `assignments:read`; 200 or 404                      |
| `POST /api/assignments/:id/change`    | `effectiveFrom`, module and/or hours, `reason`, `expectedVersion`                                | `assignments:update`; 201 replacement, or 204 no-op |
| `POST /api/assignments/:id/terminate` | `lastValidDate`, `reason`, `expectedVersion`                                                     | `assignments:update`; 204                           |
| `POST /api/assignments/:id/cancel`    | `reason`, `expectedVersion`                                                                      | `assignments:cancel`; 204                           |

All IDs are UUIDv7, validity dates are real civil `YYYY-MM-DD` values, and daily hours
are explicit `HH:mm:ss` within the same day with start < end. Normally 09:00–17:00,
the schedule is configurable and has no implicit database default. Dates are inclusive
and must fit a draft or active operative. Creation (including historical periods) and
effective rescheduling require active observers/modules; termination/cancellation do
not require them to remain active. Effective mutations are blocked in closed operatives.

Filters: `operativeId`, `observerId`, `attentionModuleId`, `from`, `to`, `applicableOn`,
`cancelled`, `page`, `limit`. `from`/`to` select intersecting periods; `applicableOn`
selects only non-cancelled periods containing that date. Filters combine with AND,
so `applicableOn` plus `cancelled=true` yields no results. Without cancellation filters,
history includes both states. Pagination defaults to 1/20 (limit <= 100), ordered by
validity start then UUID ascending, with `{ items, page, limit, total }`.

Responses expose `id`, the three reference IDs, validity dates, scheduled hours,
`cancelledAt`, integer `version`, `createdBy`, `createdAt`, and `updatedAt`. UTC instants
retain microseconds; civil dates/hours are not converted to UTC instants.

Changes apply on a future date D in `America/Mexico_City`: close the original through
D−1 and insert its replacement through the previous end, preserving observer/operative.
Replacing from the beginning of a future period instead cancels that period. Module
and schedule on previous rows remain unchanged. Other future periods are never silently
modified. Cancel only programming starting after today; terminate started periods by
shortening their end to today or a later date within their existing interval. There
are no intraday/retroactive changes, extensions, physical deletion or reactivation.

Reasons are nonblank and at most 500 Unicode code points. Mutations require the current
`expectedVersion`; stale versions, incompatible periods/states and retriable lock conflicts
return 409. Reload before retrying. Effective changes increment the affected period's
version; a replacement starts at 1. No-ops with the current version change no timestamps,
versions or audit. ADMIN/ENLACE require the exact permission; OBSERVADOR access awaits
verified identity linking and ownership rules. CSRF/session guards apply unchanged.

Writes lock actor authority, operative, observer, modules (sorted IDs), then assignment;
the observer lock serializes interval checks even on an empty calendar. Changes and
audit events commit together. Audit links predecessor/replacement IDs without copying
personal names or phones.

### Pending shared-database upgrade

`0002_persistent_assignments.sql` and its Drizzle metadata replace the legacy single
date with validity dates and a positive integer locking version. All four assignment
FKs, cancellation marker, timestamps and audit relationships are preserved. The migration
has an empty-table guard: it refuses to reinterpret nonempty legacy rows and prevents
inserts between that check and the structural change. MySQL DDL is not transactionally
reversible; inspect partial state if any migration fails. Stop application writes before
applying it. If assignments exist, stop and approve a separate historical conversion;
do not delete records or infer full-operative validity from a single legacy date.

The shared development database is **not migrated or provisioned by this feature**.
After separate authorization, verify the target and empty assignments table, then run:

```sh
pnpm --filter @hhpaisanos/api db:migrate
pnpm --filter @hhpaisanos/api users:provision-permissions <ADMIN-UUIDv7> "Approved Assignments access"
# Review the preview, then apply only with authorization:
pnpm --filter @hhpaisanos/api users:provision-permissions <ADMIN-UUIDv7> "Approved Assignments access" --apply
```

Do not run the new Assignments API against the legacy schema. The migration and
permission provisioning are independent explicit operations; neither runs on startup.

### Future daily capture boundary

Attendance/report tables do not exist yet. Before enabling them, records must carry
their own civil day and reference the precise historical period: attendance uniqueness
per assignment/day/type (plus correction version), report uniqueness per assignment/day
(plus correction version). Validate dates under assignment locks and reject changes that
would put associated activity outside its period; never silently move it to a replacement.
Late capture may reference a terminated period. Actual entry/exit instants are distinct
from scheduled hours. Working-day obligations, capture authorization and correction
workflows require their own approved requirements; no placeholder capture implementation
is included here.

## Attendance persistence (Stage 2)

`AttendanceModule` exports internal `AttendancePersistence.establish` and `complete`
primitives and has no controller. `establish` authenticates/validates and commits a
technical receipt; only then may `complete` create a mark. The authenticated request
middleware attaches `receivedAt` before the JSON parser or authentication waits, using `Date.now()`
milliseconds padded to six fractional digits. Future capture routes must pass this
original request timestamp, never a new timestamp after waiting. A durable guarantee
starts after receipt COMMIT. Same user/operation/exact key preserves the first committed
receipt/content across session renewal; different validated content conflicts.

The business transaction revalidates current authority/eligibility, locks resources
in scheduling order, and commits attendance, audit and minimal receipt result together.
Failure leaves a pending receipt; authorized terminal replay writes no new attendance
or audit. Pending prior-day requests and requests crossing Mexico City midnight while
processing reject before insertion under locks; this does not promise COMMIT before
midnight. No background queue, leases or receipt TTL exists. The original content holds
sensitive GPS; never log it or copy it into audit/results. SQL administration remains
trusted: the internal primitives expose no original-evidence mutation operation; future
review code must update decisions only and implement corrections as audited versions.

Migration `0003_attendance_persistence.sql` adds `recibos_asistencia` and
`registros_asistencia`, their RESTRICT FKs, CHECKs and unique keys. It preserves populated
persistent assignments and the hashes of `0000`–`0002`. Scheduling now blocks cancellation,
shortening or splitting that would invalidate any attendance version. A pending receipt
does not pin a period. The schema supports manual historical provenance, correction
versions and administrative decisions; those workflows remain unimplemented. No public
capture/admin routes, frontend, selfie storage, Telegram, offline, closure or automatic
absence generation is included. No Attendance permission provisioning runs in this stage.

Tests: `test/attendance.test.mjs` and `test/attendance.integration.test.mjs` cover boundary
timestamps, six-digit comparisons, durable receipts, concurrency, atomic audit rollback,
replay, GPS/version constraints, midnight, historical assignment races and upgrade from
populated `0002`. Integration fixtures use disposable `hhpaisanos_test_*` databases and
synthetic runtime users against MySQL 8.4, never migrate the shared development database.

Applying the migration to an existing database requires **separate explicit authorization**,
a verified target configuration, backup and a maintenance window. Confirm MySQL 8.4,
`0000`–`0002` tracked with their original hashes and `0002` persistent assignments already
applied. Check that neither new table exists from a partial failed application. Use a
migration account with CREATE/ALTER/INDEX/REFERENCES and migration-journal read/write
privileges on the target database (no SUPER or server configuration change is needed).
From the approved checkout, install frozen dependencies, then run
`pnpm --filter @hhpaisanos/api db:check` (connectivity only) and, only after authorization,
`pnpm --filter @hhpaisanos/api db:migrate`. MySQL DDL can partially apply; inspect failures
before retrying. Review the migration journal, both new tables and unchanged assignments
afterward. Do not rerun operative activation provisioning, bootstrap or role initialization.

### Personal Attendance API (Stage 3)

| Endpoint                            | Permission               | Behavior                                                                       |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `POST /api/attendance/me/check-in`  | `attendance:capture-own` | Capture one logical entry; 201 with `{ attendanceId, state }`                  |
| `POST /api/attendance/me/check-out` | `attendance:capture-own` | Capture one logical exit strictly after a usable entry; same response          |
| `GET /api/attendance/me/today`      | `attendance:read-own`    | Current Mexico City date and eligible assignments, schedules and current marks |
| `GET /api/attendance/me`            | `attendance:read-own`    | Own marked assignment/date groups with bounded pagination                      |

All four require an authenticated active OBSERVADOR, an active observer profile resolved
from the account and supervised administrative account-link evidence. Exact permissions
are revalidated inside the transaction; ADMIN/ENLACE cannot use these APIs even with
accidentally assigned own permissions. Responses use `Cache-Control: no-store`.

Capture requires the existing CSRF headers and `Idempotency-Key` (1–128 visible ASCII
characters, no spaces, exact/case-sensitive), and accepts only:

```json
{
  "assignmentId": "<applicable UUIDv7>",
  "expectedDate": "2026-11-12",
  "location": { "latitude": 16.85, "longitude": -99.9, "accuracy": 12 }
}
```

Alternatively supply `location: { "missingReason": "timeout" }`, using one of the six
approved reasons. Missing location is accepted with `pending_review`/`missing_location`.
Coordinates are unverified evidence, not proof of physical presence. No geofence or
accuracy policy threshold is applied; validation includes the existing storage range.
Unknown fields, client identity/state/type, mixed evidence and malformed coordinates are
rejected. Optional selfie absence has no effect; uploads are not implemented.

The existing two-transaction receipt implementation owns timestamp, idempotency,
classification and audit. The route supplies entry/exit type; the server supplies receipt
time and actor. Tolerance is inclusive; late/early/missing flags coexist. An exit requires
a current entry not rejected/annulled and an official timestamp strictly after it. A new
key cannot create a second logical mark. A failed business transaction leaves the receipt
pending; retries preserve original content/time. Same key with different validated content
returns 409. Terminal replay returns the original result without another mark/audit; the
account, permission and linked active profile must still be authorized. It does not
reclassify old policy or require today's operative eligibility. Ineligible capture returns
403; `day_changed`, `initial_mark_exists` and `invalid_order` return 409. Definitive
rejections remain bound to the key. Midnight rules are unchanged.

Today returns `{ date, timeZone, assignments }`; each item includes assignment/operative/
module identifiers and labels, `startTime`, `endTime`, `arrivalToleranceMinutes`, `checkIn`,
`checkOut` and `completeness` (`none`, `check_in_only`, `check_out_only`, `complete`).
Completeness is structural, separate from review acceptance; `none` is not an absence.
Each mark exposes id/version, official UTC timestamp with six fractional digits,
`reviewStatus`, calculated `anomalies` and `locationEvidence` (`provided_unverified` or
`missing` with reason). Coordinates, accuracy values, receipts, account identities and
administrative decision details are not returned.

History accepts optional inclusive civil-date `from`/`to`, `page` (1–1,000,000) and `limit`
(1–100; default 20), returning `{ items, total, page, limit }` in descending date order
with assignment-id tie breaking. Pagination counts marked assignment/date groups, not
individual versions. Only current versions are projected; no empty historical days or
automatic absences are generated. Own history remains readable after operative closure
or module deactivation, provided the account/profile authorization remains valid.

Stage 3 reuses migration 0003 without schema changes. Shared permission provisioning is
a separate authorized operation; no provisioning or migration runs on startup. Tests in
`attendance-http.integration.test.mjs` use disposable synthetic MySQL databases. No
administrative Attendance endpoints, frontend, Telegram, offline or Stage 4 are enabled.

### Administrative Attendance API (Stage 4)

The approved organizational scope remains **Guerrero**. Active ADMIN and ENLACE accounts
share this scope, but every operation still requires its explicit permission, revalidated
transactionally. No role-name permission bypass exists. Office-level isolation is deferred
until a proper organizational model is approved; no office identifiers or ownership tables
are introduced. OBSERVADOR cannot use these routes even with accidental administrative grants.

| Endpoint                               | Permission                  | Behavior                                                                                           |
| -------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/attendance`                  | `attendance:read`           | Current versions, validated filters and bounded pagination                                         |
| `GET /api/attendance/:id`              | `attendance:read`           | Explicit detail of a selected version, including precise unverified location evidence              |
| `GET /api/attendance/:id/history`      | `attendance:read`           | Paginated logical-mark versions and their administrative/capture audit events, without precise GPS |
| `POST /api/attendance/manual`          | `attendance:capture-manual` | Explicitly accepted historical administrative mark; 201                                            |
| `POST /api/attendance/:id/review`      | `attendance:review`         | Accept/reject only a pending current version; 200                                                  |
| `POST /api/attendance/:id/corrections` | `attendance:correct`        | Create the next pending version; 201                                                               |
| `POST /api/attendance/:id/annul`       | `attendance:annul`          | Annul the current non-annulled version, without deletion; 200                                      |

All responses are `no-store`; writes require the existing CSRF headers. List filters:
`operativeId`, `moduleId`, `observerId` (UUIDv7), inclusive civil dates `from`/`to`,
`reviewStatus` (one approved status), and `anomaly` (`late_arrival`, `early_departure`,
`missing_location`). `page` is 1–1,000,000 and `limit` 1–100 (default 20); history uses
the same pagination bounds. Lists count current marks, not days. Factual anomalies remain
visible after administrative acceptance; completeness counts present current marks and
does not imply acceptance. Lists and history omit precise GPS and all receipt payloads.
Only the explicitly permission-checked detail response returns coordinates and accuracy.

Manual capture accepts `{ observerId, assignmentId, date, type, officialTimestamp,
missingLocationReason, reason }`. `type` is `entrada`/`salida`; timestamps are explicit
UTC strings with exactly six decimals, for example `2026-11-11T15:00:00.000000Z`.
These are reported historical times, not measured request times. The observer must match
the precise historical assignment; both assignment and operative must contain the civil
date. The operative must be active or closed, with explicit tolerance; cancelled periods,
draft operatives and future event times are rejected. Currently inactive profiles/modules
do not erase historical applicability. No linked observer account is required for an
administrative historical mark. The caller must explicitly declare one approved
`missingLocationReason`; coordinates cannot be supplied or fabricated by this route.
The mark is `accepted_administrative` with the acting administrator and mandatory reason,
retaining calculated factual anomalies. Either half may be backfilled first; if a usable
counterpart exists, exit must be strictly after entry. No other mark is fabricated.

Review accepts `{ expectedVersion, decision: "accept" | "reject", reason }`; annul accepts
`{ expectedVersion, reason }`. `expectedVersion` is the positive integer version of the
selected record, not a new daily summary revision. Currentness/version and allowed state
transitions are checked under assignment/mark locks; competing reviews or corrections
cannot overwrite one another. Decisions update decision fields only, never event time,
GPS, factual anomalies, capture actor, channel or receipt. Prior decisions remain in audit.
Reasons must be nonblank and at most 500 Unicode code points.

Correction accepts `{ expectedVersion, officialTimestamp, reason }`. It corrects the
event time within the original civil date; assignment/date/type and original evidence
cannot be replaced. The predecessor retains its complete record with `vigente = NULL`.
The next version copies original actor/channel/manual provenance and exact location
evidence, references its predecessor, and has no duplicate receipt FK. It recalculates
timing flags under the stored `personal-v1` policy and immutable operative tolerance.
Unknown historical policies are rejected rather than silently reinterpreted. Every new
version is `pending_review`, with cleared decision fields, even when it has no anomalies.
It requires a separate explicit `attendance:review` operation for acceptance; a correction
permission alone does not confer review. Annulled marks cannot be corrected/recreated.
Duplicate original manual or personal marks remain blocked across all historical versions.

The existing receipt outcome remains immutable after administrative actions; replay is
not a new mark or a fresh administrative decision. Transactions reuse Stage 2 error
sanitization, assignment resource-lock order and audit insertion. No new schema migration
is needed and migrations 0000–0003 are unchanged. Integration tests use disposable MySQL
databases, including audit-trigger rollback and concurrent decisions. Shared provisioning
remains a separately authorized operation; no migrations/provisioning are run by this
feature. Frontend, Telegram, selfies, offline capture, absences and Stage 5 are not added.

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
profile administration, attention modules, persistent assignment management, internal attendance persistence and operative creation/consultation/activation are implemented; other business workflows, frontend
authentication, Telegram, deployment and CI/CD remain deferred. Persistence tables
alone do not implement their workflows.

`docs/REQUIREMENTS.md` and `docs/DATABASE_MODEL.md` record the confirmed auth
policies. Other pending functional decisions must be resolved before implementing
the affected business modules, including report draft optionality and
attendance/report transitions.
