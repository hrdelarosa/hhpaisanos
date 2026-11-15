# F6 — Persistent Observer Assignments Management

## Base and boundaries

PR [#28](https://github.com/hrdelarosa/hhpaisanos/pull/28) was verified merged into
`dev` (merge `8cd0423`) before implementation. The clean primary worktree was
fast-forwarded after `git fetch origin`; work proceeded in the dedicated
`feat/administrative-assignments` branch/worktree. Read root instructions, DESIGN,
approved assignment/Attendance requirements and actual backend contracts.

Frontend and documentation only. No backend changes, migrations, dependencies,
account provisioning/linking changes, administrative Attendance screens, office
isolation, deployment or F7 implementation. Shared development tables were untouched.

## Operations, endpoints and permissions

| Operation | Actual endpoint | Explicit permission |
| --- | --- | --- |
| List | `GET /api/assignments` | `assignments:read` |
| Detail | `GET /api/assignments/:id` | `assignments:read` |
| Create | `POST /api/assignments` | `assignments:create` |
| Change module and/or same-day hours | `POST /api/assignments/:id/change` | `assignments:update` |
| End a started period | `POST /api/assignments/:id/terminate` | `assignments:update` |
| Cancel future programming | `POST /api/assignments/:id/cancel` | `assignments:cancel` |

No ADMIN bypass. Session permissions gate navigation, routes and individual actions;
the API independently revalidates transactional authority. Home and observer,
operative and module details link to the appropriate assignment reads.

Listing supports only `observerId`, `operativeId`, `attentionModuleId`, `applicableOn`,
`from`, `to`, `cancelled`, `page`, `limit`. Date ranges intersect inclusive periods;
`applicableOn` also excludes cancelled periods. Ordering is start date/ID ascending.
nuqs preserves filters and pagination, including detail/return after changing a
filter. `shallow: false` keeps React Router's location synchronized with nuqs;
this real-browser regression has a focused test. Invalid IDs/dates/ranges/limits
prevent requests. No invented active/ended server filter exists.

Resource selection reuses `GET /api/observers`, `/api/operatives`,
`/api/attention-modules` and their detail contracts/parsers/query keys. Search and
pagination do not truncate selection to the first catalog page. UI shows names,
IDs, state and operative dates; selected IDs remain explicit across catalog pages.
No unauthorized catalog/detail reads are issued. Creation requires the three
resource read grants; change requires them plus assignment read/update. Ending and
cancellation require operative read for the relevant preflight. Read-only assignment
detail still works without catalog read grants, showing IDs instead of unauthorized
names. These UI read dependencies are not new backend permission rules.

## Historical, concurrency and transport safeguards

- Validity is inclusive; schedules remain same-day civil hours. Resources must be
  eligible and the operative open for effective scheduling changes. No invented
  account-link prerequisite for scheduling, workday calendar or geographic filter.
- A prospective change sends `effectiveFrom` and only supplied conditions. The API
  truncates the source through D−1 or cancels a wholly replaced future period, and
  inserts the new period. The returned replacement gets its own detail link.
- Termination sends inclusive `lastValidDate`; cancellation sends no effective-date
  substitute. Neither client operation transfers, deletes or rewrites Attendance.
  The server protects all associated Attendance versions under compatible locks.
- Changes, termination and cancellation require nonblank administrative reasons
  (maximum 500 Unicode code points) and the reviewed positive integer `expectedVersion`.
  204 responses may represent no-ops; the UI does not invent a replacement or version
  increment. Existing observer and operative references are immutable.
- Relevant reads occur before review and again before the final POST. Preflight
  cancels pre-existing reads for those exact keys so a selector request begun before
  the intention cannot satisfy freshness accidentally. Snapshot changes block POST
  and require rereading/reconfirmation. Backend version/transaction rules close the
  remaining read/write race; the UI never assumes preflight eliminates it.
- Single-flight locks and disabled actions prevent duplicate confirmation. There
  are no optimistic updates and mutation retry is explicitly false. Preflight
  failure, rejected 4xx/conflict and uncertain network/5xx/invalid-response outcomes
  are distinct. Later reads never convert an uncertain request into claimed success.
- After a submitted intention, detail requires an explicit fresh read before another
  review; creation intentionally ends that form's intention and directs the operator
  to inspect periods before starting another. No automatic recovery POST exists.
- Assignment and Attendance queries are invalidated on settlement, including uncertain
  outcomes. Existing identity/permission-scoped Query clients and abortable same-origin
  reads isolate sessions and late completions. Writes preserve HttpOnly cookie auth,
  `credentials: same-origin`, JSON and `X-HHP-CSRF: 1`; no storage or tokens are added.

The API has no status field: cancelled is authoritative via `cancelledAt`; scheduled,
currently effective and elapsed labels derive only display context from the browser's
Mexico civil calendar. They never authorize a mutation or Attendance capture. A final
date cannot distinguish natural expiry from administrative termination. The API also
exposes no audit-reason/history endpoint or replacement-chain field. The UI discloses
those limits and links all observer periods, without inventing audit evidence.

## Automated validation

- **352/352 web tests pass**, 14 files; **51 focused F6 tests** with Vitest/RTL.
- Covers list/detail, all supported filters, pagination, changed-filter return links,
  schemas/microseconds, resource selection/search/pages, creation and ineligibility,
  changes/ending/cancellation, exact payloads/CSRF/version, required reasons, review
  cancellation, 204 no-ops, action/route permissions, denied resource preflight,
  stale snapshots, 400/403/404/409, protected history/server-authoritative results,
  failed reads, loading/empty states, network/500/malformed uncertain responses,
  duplicate confirmation prevention, no retries, both-domain invalidation and late
  mutation completion after logout. Existing session-isolation regressions also pass.
- Workspace typecheck, lint, API/web builds, changed-file formatting and
  `git diff --check` pass. Build retains the existing >500 kB chunk advisory;
  bundle optimization is deliberately outside F6.

Relevant commands:

```powershell
pnpm --filter @hhpaisanos/web test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec vp fmt --check README.md docs/F6_ASSIGNMENTS_VALIDATION.md apps/web/src/modules/assignments apps/web/src/app/routes.tsx apps/web/src/modules/auth/pages/SessionHomePage.tsx apps/web/src/modules/observers/pages/ObserverDetailPage.tsx apps/web/src/modules/operatives/pages/OperativeDetailPage.tsx apps/web/src/modules/attention-modules/pages/ModuleDetailPage.tsx
git diff --check
```

## Real-browser validation

Used the installed Playwright CLI skill/reference, project CLI 0.1.24 and real Chrome,
Vite+ at localhost:5173, Nest AppModule at localhost:3000 and existing MySQL 8.4 server.
Executed the installed CLI directly with Node on Windows because the PNPM wrapper
did not retain its named browser session. No new browser tooling was installed.

Created a random `hhpaisanos_test_*` database and scoped `hhp_test_*` account, applying
existing migrations only there. Fixtures contained synthetic ADMIN/read-only ENLACE/
OBSERVADOR sessions, an accredited synthetic observer, modules, an active operative,
historical/started/future assignments and three synthetic manual Attendance marks.
No shared development database/account was modified. No full backend integration
suite was run.

Passed against actual backend responses:

1. Historical listing/detail and newly changed URL filters retained on return.
2. Creation using authorized catalog selection and explicit periods/hours.
3. Started assignment change preserving source and returning a new period; whole
   future-period replacement cancelling rather than overwriting the source.
4. Termination retaining today's mark and future cancellation retaining its row.
5. Overlap rejected even with another module/different hours; change rejected when
   it would invalidate an associated Attendance mark. Source version stayed intact.
6. Competing write committed after final preflight but before UI POST: actual 409,
   one UI write, no retry. A competing cancellation before final preflight instead
   blocked the client POST entirely and required new review.
7. Cancellation forwarded to Nest and committed, then only its response aborted:
   persistent uncertainty, authoritative cancelled row, no false success or resend.
8. Read-only session could inspect detail but had no mutation controls; direct create
   route was forbidden and real write API returned 403. Storage remained empty.
9. Empty results, held-request loading, simulated read-network failure and manual
   retry. 390px list, creation, confirmation and error layouts had no page overflow;
   screenshots were visually inspected.
10. Existing observer's real `/api/attendance/me/today` and history still exposed the
    original eligible assignment and exact original mark. Direct isolated SQL checked
    all three original mark IDs, assignment FKs, versions and review states unchanged.

Fault/concurrency routes forwarded to Nest or aborted transport; no fabricated API
success/business response was supplied. Temporary scripts/screenshots are ignored
under `.playwright-cli/`. The named browser, disposable database/account and task
servers were cleaned up after validation.

## Independent review

One independent reviewer inspected changes against actual assignment controllers,
DTOs/service, Attendance access, session/query architecture, permissions, DESIGN and
tests, and reran the initial F6 tests/typecheck. **No material findings.** Minor
observations included conservative creation recovery (navigate out before a new
intention), generic creation preflight errors and relying on backend transition-date
validation. Creation preflight now retains 403/404 distinction; other conservative
behavior is intentional. Browser validation additionally found and fixed nuqs/Router
filter-link synchronization; a regression test covers it.

## Remaining prerequisites for F7

F7 is not started. Review/merge F6 into `dev` separately; confirm F7's functional
scope and acceptance criteria before implementation. Inspect its actual contracts,
permission grants, concurrency/history rules and read projections. Environments
need existing migrations and explicitly authorized permission provisioning; none
was performed against shared data here. Account activation/linking/assignment alone
must not be treated as Attendance eligibility. Continue isolated synthetic validation.
Audit-reason or replacement-chain UI would require new backend reads, outside F6.
