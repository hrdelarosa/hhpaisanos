# Attendance Stage 5: integrated backend validation

Base: `dev` revision `75e60f0` (Stages 1–4). Scope: the approved Guerrero-wide
backend, not frontend, Telegram, selfies, geofencing or physical-presence verification.

## Cross-module coverage

`apps/api/test/attendance-workflow.integration.test.mjs` adds four HTTP/MySQL workflows:

| Workflow | Checks |
| --- | --- |
| Public onboarding and normal attendance | Real ADMIN login; operative creation/activation with a seven-minute tolerance; observer and account creation; temporary-password change and fresh login; supervised administrative linking and revocation of the old session; module and persistent assignment creation; OBSERVADOR login; exact-tolerance check-in and exact-end check-out; automatic acceptance and personal/administrative reads. |
| Incidents and historical administration | First late millisecond; combined early departure and missing location; ADMIN acceptance and ENLACE rejection; correction with preserved original time, GPS and capture actor; successor pending until a separate explicit review; annulment with retained history; immutable original receipt replay versus current personal reads; historical manual capture on the API-created assignment. |
| Cross-module authorization and revocation | Temporary credentials and unlinked identities cannot capture/read; linking revokes sessions; forged observer identity and another observer's assignment are rejected; CSRF enforced; observers cannot read administrative details; administrators have no implicit personal access; logout/deactivation prevent replay without erasing evidence. |
| Durable recovery across an application restart | Audit-trigger failure rolls back mark and audit while retaining the pending receipt; restart Nest and its database pool; concurrent retries retain the original time/result and produce one capture audit; conflicting content and duplicate initial marks are rejected. |

Only deployment prerequisites (roles, the initial synthetic ADMIN and centralized grants)
are seeded directly. Workflow accounts, profiles, links, assignments, sessions and marks
use existing public APIs. Assertions inspect isolated persisted evidence, not just HTTP codes.
The clock fixes civil time to January 15, 2030, using only a fake `Date`; network, database
and test-timeout timers remain real. The application is restarted between tests to isolate
per-process rate-limit state when the test clock moves backwards.

Existing suites remain the authority for exhaustive RBAC combinations, account-link
eligibility, all controlled GPS failure reasons, midnight boundaries, six-digit precision,
historical scheduling protections, competing decisions, live permission changes, durable
rejections and rollback of each administrative operation. These are run alongside the new
cross-module workflows rather than duplicated.

## Isolation and reproducibility

- Use MySQL 8.4 and `COMPOSE_PROJECT_NAME=hhpaisanos` for the existing `rootSql` helper.
- Run from the API workspace with compiled API output. The new suite can be run with
  `pnpm --filter @hhpaisanos/api exec vp test run test/attendance-workflow.integration.test.mjs --no-file-parallelism --testTimeout 30000`.
- The new suite creates a random `hhpaisanos_test_*` database and `hhp_test_*` account,
  grants access only to that database, applies existing migrations there, and removes
  both fixtures on completion. It never targets shared operational tables.
- The full validation run supplies a separate synthetic runner account with no privileges
  on `hhpaisanos`; older suites grant that account access only to their disposable databases.
- Read-only counts, table checksums and `SHOW CREATE TABLE` hashes of all 14 shared tables
  are compared before and after the run. No shared migration or provisioning is executed.

Do not run builds concurrently with integration tests: the suites import `dist`, and Nest
regenerates that directory. During validation, concurrent builds caused three suites to
fail collection before any test ran. The successful eight suites did not need repeating;
only the three affected suites were selected for a sequential rerun without concurrent builds.
An initial parallel web-test worker also timed out at startup; its four tests passed when
run separately. Neither failure established a backend defect.

Build, typecheck, lint, 42 API tests and four web tests pass. Global `pnpm check` still
stops at formatting in the same ten untouched CRLF files; changed-file formatting passes.

## Validation outcome

All 130 integration tests pass across the following 11 suites (82 on the initial run,
then 48 on the three-suite collection-error rerun described above):

| Suite | Passed |
| --- | ---: |
| Integrated Attendance workflow (new) | 4 |
| Attendance persistence | 19 |
| Personal Attendance HTTP | 11 |
| Administrative Attendance HTTP | 13 |
| Assignments | 12 |
| Users and provisioning | 15 |
| Observers and administrative linking | 14 |
| Operatives and activation | 14 |
| Attention modules | 10 |
| Authentication and sessions | 7 |
| Database constraints, migrations and transactions | 11 |

One independent read-only review found no material issues. Its suggestion to add explicit
ordering to snapshot comparisons was applied; all four new workflow tests passed again
after that change. No confirmed production defect or production-code fix was necessary.

Shared database verification retained catalog 31, grants ADMIN 29 / ENLACE 21 /
OBSERVADOR 2 (52 total), audit 89, valid migrations 0000–0003 and empty Attendance tables.
All 14 table counts/checksums/DDL hashes remained unchanged. MySQL 8.4.11 stayed healthy
on the existing `hhpaisanos_mysql_data` volume; no service restart or volume operation
was performed.

**Recommendation: GO for integration with the web frontend**, using the approved API
contracts and the limitations below. This is not a production deployment, physical-presence
certification, load benchmark or frontend validation.

## Public-API limitations

- Initial ADMIN creation, role initialization and permission provisioning are explicit
  deployment commands, not production HTTP endpoints. Synthetic test setup uses the existing
  password/provisioning implementation instead of inventing APIs.
- No operative closure endpoint exists. Closed-operative backfill and related historical
  validation remain covered by the existing administrative suite's isolated database fixtures,
  not claimed as a public-API end-to-end closure workflow.
- Durable receipt recovery is guaranteed from receipt commit, not before it. The restart
  test validates recovery after a real committed pending receipt; it is not a power-loss or
  distributed-network fault test.
- Automatic acceptance validates policy, not GPS authenticity or physical presence.
