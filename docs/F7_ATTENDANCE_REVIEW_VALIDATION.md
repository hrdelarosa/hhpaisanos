# F7 — Administrative Attendance Review

## Base and scope

Verified PR #29 merged into `dev` at `4229f46`, fetched origin, and verified the
primary worktree clean with `dev...origin/dev` divergence `0 0`. Work uses the
dedicated `feat/administrative-attendance-review` worktree from updated `origin/dev`.
Read AGENTS, DESIGN, Attendance requirements and actual controllers, DTOs, access,
service, persistence/schema and existing session/Query/HTTP/Attendance infrastructure.

Frontend only, under the existing Attendance module, plus routing/navigation and
documentation. No backend changes, migrations, dependencies, shared-database
changes, manual capture, corrections, annulments, office isolation, geofencing,
deployment, bundle optimization or F8 implementation.

## Workflows and actual contracts

| Workflow | Existing API | Effective permission |
| --- | --- | --- |
| `/asistencias` | `GET /api/attendance` | `attendance:read` |
| `/asistencias/:id` | `GET /api/attendance/:id` | `attendance:read` |
| Version/review history in detail | `GET /api/attendance/:id/history?page=&limit=` | `attendance:read` |
| Accept/reject existing mark | `POST /api/attendance/:id/review` | `attendance:review` |

Administrative routes require ADMIN/ENLACE and the explicit read permission.
Review separately requires its own permission; ADMIN has no bypass. The backend
reauthorizes each request and transaction. Guerrero is the shared scope, not an
invented office boundary. Existing session providers isolate identities and
permission transitions with fresh Query clients and discarded private caches.

List filters are exactly `operativeId`, `moduleId`, `observerId` (UUIDv7), `from`,
`to` (civil dates), `reviewStatus`, `anomaly`, `page` (1–1,000,000) and `limit`
(1–100). nuqs preserves them, resets page on filter changes and retains current
filters through detail/return links. Invalid filters prevent requests. History has
independent URL pagination (`historyPage`, fixed limit 20). List ordering remains
server-defined: civil date descending, assignment/type/ID ascending.

Read projections show names, assignment, schedule, civil date, full-precision UTC
official time, channel, policy, currentness/version, structural completeness,
review state and factual anomalies independently. Missing marks never imply
absence; automatic/administrative acceptance never certifies physical presence.
Assignment links use the existing assignment route only with its read permission;
names already returned by Attendance do not require extra catalog reads.

Detail separates original event time/capture actor, consulted version/predecessor,
manual/correction reasons when returned, and administrative actor/time/reason.
Reviewer identities remain IDs: no identity/name evidence is fabricated. History
renders only returned versions and allowlisted audit projections, distinguishing
capture, correction, review and annulment evidence without offering F8 operations.

Only authorized detail schemas/rendering admit precise GPS. List/history Zod
projections strip it even if unexpected extra fields arrive. Detail cache has
`gcTime: 0`; all queries use abort signals and the identity-scoped client. No query
persistence, browser storage, exported sessions, receipt payloads or logs of private
evidence are introduced. Invalid-response errors do not retain Zod input payloads.

## Review, concurrency and recovery

- Only a current `pending_review` record can be accepted or rejected.
- POST sends exactly `{ decision: "accept" | "reject", reason, expectedVersion }`.
  Reason is nonblank, maximum 500 Unicode code points, without silent trimming.
  `expectedVersion` is the displayed/reviewed record version, not a guessed increment.
- Fresh abortable detail reads occur before confirmation and immediately before POST,
  cancelling earlier reads for that exact key. A frozen ID/version/current/state/time
  snapshot prevents reconfirming a different record silently. A disposed component
  cannot continue preflight into a new read/write after a session transition.
- Confirmation identifies record, observer, date/type, version, official time, decision
  and reason, and explains that capture/anomalies are unchanged. Ref locks and disabled
  controls prevent duplicate intentions. No optimistic state or automatic write retries.
- Backend locks/version/currentness/state checks close the remaining GET/POST race.
  Review changes state to `accepted_administrative` or `rejected`, preserving the same
  version, original timestamps/evidence/provenance and factual anomalies.
- Successful response must match the intended ID, expected version and decision state.
  Network, 5xx and malformed/mismatched success responses remain uncertain. A later
  authoritative read never retroactively proves that the particular request succeeded.
- 400/403/404, stale versions, already-reviewed/invalid transitions (409), failed
  preflight and uncertain outcomes are distinguished. A fresh explicit read is needed
  before another intention; there is no resend/recovery POST.
- Settlement invalidates the entire `['attendance']` family: administrative list,
  detail/history and existing personal queries, including uncertain/rejected results.
  Already-sent writes may settle after logout, but callbacks target only the discarded
  client and cannot expose evidence or success to the new session.
- Existing same-origin HttpOnly cookie auth, `cache: no-store`, JSON and
  `X-HHP-CSRF: 1` remain unchanged; no tokens or session secrets enter app storage.

## API limitations (not changed)

Completeness counts structurally current entry/exit marks, including rejected or
annulled marks; it does not mean accepted attendance. The UI labels capture and
review separately and does not reinterpret it as eligibility or absence.

History is a page of versions with only their exposed events. The existing backend
caps events at `limit * 4` without an event continuation cursor/total. The UI does
not claim a complete audit export or fabricate missing events/reasons/reviewers.
There is no separate GPS-verification evidence or proof-of-presence contract.

## Validation

- Vitest/React Testing Library: final full web suite passed **389 tests / 15 files**;
  focused F7 suite passed **37 tests**, including session disposal during preflight.
- Focused F7 coverage includes supported filters/pages/return links, invalid inputs,
  detail/history and original vs subsequent versions, accept/reject exact contracts,
  reasons, explicit confirmation, current version/state conflicts, route/action
  permissions, GPS projection boundaries, immutable anomalies, uncertainty/no retries,
  invalidation, late settlement and logout during preflight, loading/empty/error/retry.
- Full workspace typecheck and lint, API/web builds and changed-file formatting are
  run. Build retains the preexisting >500 kB chunk advisory; optimization is out of scope.
- Cold/isolated executions hit worker startup/time limits and an existing F6
  one-second RTL wait. Final serial worker reuse passed all 389 tests in 59 seconds
  (`--pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000`). F7 also passed
  independently with normal file isolation and a bounded five-second async wait;
  no unrelated infrastructure/tests were changed to address host startup overhead.

Relevant final commands:

```powershell
pnpm --filter @hhpaisanos/web test --pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000
pnpm --filter @hhpaisanos/web test src/modules/attendance/administration.test.tsx --pool=threads --maxWorkers=1 --testTimeout=15000
pnpm typecheck
pnpm lint
pnpm build
# Final frontend rebuild after the session-disposal guard:
pnpm --filter @hhpaisanos/web build
$files = @(git diff --cached --name-only)
pnpm exec vp fmt --check @files
git diff --cached --check
```

Real browser: project Playwright CLI 0.1.24, installed headless Chrome, Vite+ on
localhost:5173, real Nest AppModule on localhost:3000 and existing MySQL 8.4 container.
Created only a random `hhpaisanos_test_*` database and scoped `hhp_test_*` user;
applied existing migrations only there. Synthetic ADMIN, read-only ENLACE and
OBSERVADOR accounts, assignment, GPS/missing-location marks and historical versions
were isolated from shared development data. Did not rerun the backend integration suite.

Passed real-browser checks:

1. Listing/filter/page navigation and newly changed filters retained on detail/return.
2. Precise GPS only on authorized detail; list, own history and browser storage clean.
3. Original and subsequent historical versions and exposed correction/review evidence.
4. Acceptance/rejection persisted through Nest; anomalies and version preserved, audit
   reason shown and personal read projection updated.
5. Competing review after final GET but before UI POST: real 409, exactly one UI POST.
6. Competing review before final preflight: changed state blocks UI POST entirely.
7. POST forwarded to Nest and committed, then response aborted: persistent uncertainty,
   authoritative accepted state, no automatic retry or false request-success message.
8. Review permission revoked after confirmation: real 403; read-only account has no
   action and direct review API is also 403. OBSERVADOR administrative detail forbidden.
9. Held loading and aborted read with explicit manual retry; empty results and 390px
   loading/error/list/detail/confirmation without horizontal page overflow. Mobile
   screenshots were visually inspected.
10. Switching ADMIN → ENLACE → OBSERVADOR exposes no previous identity's detail/GPS;
    localStorage/sessionStorage stayed empty.

Temporary fixture/fault scripts and synthetic screenshots remain ignored under
`.playwright-cli/`, not in Git. Named browser, task servers and disposable database/user
are cleaned up after validation. Fault routes forward to the real API or abort
transport; they do not fabricate successful business responses.

## Independent review

One independent reviewer checked frontend changes against actual backend contracts,
authorization, concurrency, session/query isolation, DESIGN and tests: **no material
findings**. It noted existing structural-completeness and bounded-event limitations,
documented above. Suggested loading/GPS-null concerns were checked against the
existing RequireSession boundary and database `asistencia_ubicacion_check`; neither
requires a backend or unrelated UI change. No confirmed material findings remain.

## F8 prerequisites

F8 has not started. Review/merge F7 separately and explicitly authorize the F8 scope.
Inspect existing manual/corrections/annul DTOs and transactional transitions again,
including historical assignment/date/time ordering, reasons, immutable capture/GPS,
predecessor chains, pending corrected versions and operation-specific permissions.
Existing migrations and explicit grants must already be provisioned in the intended
environment; no shared provisioning was performed. Continue isolated synthetic
validation; any complete audit-export capability would require a separate backend task.
