# F8 — Administrative Attendance Historical Operations

## Base and scope

Verified PR #30 merged into `dev` (`2c17cf1`), fetched origin and confirmed the
primary worktree clean and `dev...origin/dev` divergence `0 0`. Dedicated branch:
`feat/attendance-historical-operations`. Read AGENTS, DESIGN, existing Attendance
validation and real Nest controllers, DTOs, authorization, transactional services,
historical date/time rules and persistence constraints.

Frontend only, extending `apps/web/src/modules/attendance/` and existing F7 routes.
No backend changes, migrations, dependencies, shared-database changes, hard deletion,
GPS fabrication, geofencing, office isolation, exports, bundle optimization or F9.

## Actual operations

| Workflow | Existing endpoint / DTO | Explicit permission |
| --- | --- | --- |
| `/asistencias/manual` | `POST /api/attendance/manual` / `ManualAttendanceDto` | `attendance:capture-manual` |
| Correction in existing detail | `POST /api/attendance/:id/corrections` / `CorrectAttendanceDto` | `attendance:correct` |
| Annulment in existing detail | `POST /api/attendance/:id/annul` / `AttendanceVersionDto` | `attendance:annul` |

Administrative routes retain ADMIN/ENLACE plus `attendance:read`. ADMIN has no
bypass. Manual context selection additionally uses existing `observers:read`,
`operatives:read` and `assignments:read`, not new catalog APIs or permission grants.
Missing catalog grants are explained instead of offering blind UUID entry.

- Manual DTO is exactly `{ observerId, assignmentId, date, type, officialTimestamp,
  missingLocationReason, reason }`. Operative is selected to filter and verify the
  assignment, not sent as an invented DTO field. Both entry and exit are supported;
  administrative backfill may fill either half first. Existing initial marks cannot
  be recreated, even after annulment. Response is `{ id, version: 1,
  reviewStatus: "accepted_administrative" }`.
- Correction sends exactly `{ officialTimestamp, reason, expectedVersion }`.
  Assignment, observer, date, type, GPS and capture provenance are not editable.
  Server creates a distinct successor ID with version +1, predecessor ID and
  `pending_review`. The successor link opens F7 detail and its separately authorized
  review; F8 never sends an acceptance request.
- Annulment sends exactly `{ reason, expectedVersion }`, with separate destructive
  confirmation identifying record, observer, civil date, type, version and effects.
  It returns the same ID/version with `annulled`. Nothing is deleted; the other mark
  is not automatically annulled. Annulled/noncurrent records expose no mutation form.
- All reasons are nonblank and at most 500 Unicode code points, without silent
  trimming. Official timestamps require strict UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ`.
  The browser does not round microseconds or convert local device time implicitly.

## Historical and concurrency safeguards

- Mexico City civil-date validation uses `America/Mexico_City`, not device timezone.
  Manual preflight freshly reads assignment, operative and current marks before
  confirmation and again before POST. It checks observer/operative relationship,
  cancellation, assignment/operative date bounds, active/closed operative with
  tolerance, existing marks and ordering against a usable opposite mark. An
  overfull defensive read blocks confirmation rather than claiming completeness.
- Correction/annulment freshly read detail twice. Frozen confirmation fingerprints
  contain ID, version, currentness, status, official timestamp and decision metadata.
  Changed state requires a new confirmation, not silently updated preconditions.
  Corrections retain the civil date; unsupported policy or exhausted version blocks
  the form. Backend locks enforce final historical eligibility, no future timestamps,
  ordering, currentness and transitions transactionally.
- Expected version is the authoritative reviewed version, never a guessed successor.
  The API does not offer expected-status/updatedAt preconditions or idempotency keys
  for these operations. Review and annulment do not increment the version: fresh
  reads are best-effort for same-version decisions, not an atomic expected-status
  guarantee. The UI adds no unsupported preconditions or backend workarounds.
- Original event time, capture actor, GPS, channel, manual reasons and predecessors
  remain server evidence. Only correction changes the official time on a new row.
  Manual records carry no GPS and do not certify physical presence. The mandatory
  missing-location reason must be selected truthfully from the six supported codes;
  there is no backend `administrative_backfill` code or optional location alternative.
- Synchronous ref locks and disabled controls prevent duplicate submission per
  intention. No optimistic updates and no automatic write retries. Each settled
  intention ends; another requires deliberately consulting the authoritative state.
  Disposal/session transition during preflight prevents the subsequent write.
- Validated success responses must match operation ID/version/state expectations.
  400/403/404 rejection, 409 conflict, changed preflight and uncertain network/5xx or
  malformed success remain distinct. A later matching read never proves that the
  particular uncertain request succeeded. No automatic resend is offered.
- Every settlement invalidates `['attendance']`, including admin list/detail/history
  and personal queries. Existing HttpOnly cookies, same-origin CSRF transport and
  identity-isolated Query clients remain unchanged. Precise GPS remains detail-only;
  no sensitive evidence/session data is persisted in browser storage.

## Validation

- Full web Vitest/RTL suite: **424 passed / 16 files**; focused F8: **35 passed**.
  Covers exact manual entry/exit DTOs, strict precision/civil dates/reasons,
  historical assignment/operative/ordering constraints, version payloads and pending
  successor link, annulment/history, competing state, conflicts, uncertainty,
  duplicate-click protection, invalidation, permissions, revoked sessions, disposal
  during preflight and read errors/retry. Existing F7 regression tests also pass.
- Workspace typecheck and lint pass. API/web builds pass; the existing >500 kB web
  chunk advisory remains out of scope. Changed-file formatting is checked separately.
- An initial full run hit the existing one-second F6 session-loading wait (413/414
  passed). F6 passed independently (51/51); the final serial full run passed all 423
  without changing unrelated tests or infrastructure. A final manual-409 regression
  test brings the suite to 424.

Commands:

```powershell
pnpm --filter @hhpaisanos/web test src/modules/attendance/historical.test.tsx --pool=threads --maxWorkers=1 --testTimeout=15000
pnpm --filter @hhpaisanos/web test --pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000
pnpm typecheck
pnpm lint
pnpm build
$files = @(git diff --name-only) + @(git ls-files --others --exclude-standard)
pnpm exec vp fmt --check @files
git diff --check
```

Real browser: installed project Playwright CLI 0.1.24 and headless Chrome, Vite+
localhost:5173, real Nest AppModule localhost:3000, existing MySQL 8.4 service.
Created random `hhpaisanos_test_*` databases and scoped `hhp_test_*` users; applied
existing migrations only there. Synthetic ADMIN, observer, closed historical
operative, assignment, manual marks and synthetic web/GPS evidence fixtures. No
shared development credentials or operational tables were read or modified.

Browser checks passed:

1. Manual entry and exit on a closed operative's eligible historical assignment.
2. Correction creates a distinct successor and leaves F7 review available.
3. Annulment persists and retains original/corrected history; annulled mutation
   controls disappear after reload.
4. Synthetic original GPS remains visible only in authorized detail across correction.
5. Real correction commits but its response is aborted: UI remains uncertain, with
   no false success or automatic retry despite authoritative successor existence.
6. Concurrent correction between final GET and annulment POST produces real 409,
   with one annulment POST and no silent overwrite.
7. Wrong civil-date input blocks manual confirmation.
8. 390px manual confirmation/detail/history render without horizontal page overflow;
   screenshots inspected. Browser localStorage/sessionStorage remain empty.
9. Manual permission revoked in the isolated DB after confirmation: real 403, no
   false success and no resubmission.

Direct isolated-database assertions verify original microsecond timestamp, versions
1/2 and annulment retention for manual entry, and a four-version web chain with exact
predecessor links, unchanged GPS/accuracy/capture actor/channel and latest pending
review. Browser fixtures/fault scripts/screenshots are ignored, not deliverable source.
The named browser and task servers were stopped. Both F8 disposable databases/users
(including an empty failed-start setup) were identified and removed; the shared
MySQL service/volume and development database were left unchanged.

## Independent review

One independent reviewer found **no material defects** after reviewing the frontend
against actual backend contracts and running the web suite, typecheck and lint.
Minor suggestions were addressed: broaden the 409 explanation for historical/date/
ordering conflicts, translate missing-location confirmation labels, and add a direct
manual-409 regression. Manual confirmation snapshot divergence also has a focused
test. Workspace-wide CRLF formatting findings concern untouched files; final
changed-file formatting is the relevant gate. No confirmed material findings remain.

## Existing API limitations and F9 prerequisites

F7's bounded per-page event projection is not a complete audit export. There is no
new audit endpoint, physical-presence proof or operative-closure operation. Uncertain
administrative writes have no receipt recovery API. Full historical eligibility and
server time remain backend decisions; frontend reads cannot eliminate the last
GET/write race or extend the expected-version contract.

Before F9: review and merge F8 into `dev`, explicitly approve F9 requirements and
inspect its actual APIs/permissions. Ensure existing migrations and explicit grants
are provisioned in the intended environment by an authorized operator. Continue
isolated synthetic validation. F9 has not started.
