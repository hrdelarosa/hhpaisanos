# Q2C — Accessible form errors and first-invalid focus

## Scope and implementation

Started from updated `dev` (`2179e10`) after Q2B PR #36 was confirmed merged.
The primary worktree was clean. Work remained on the dedicated
`fix/q2c-accessible-form-errors` branch/worktree, including after resuming the task.
AGENTS.md, DESIGN.md, the affected forms and Q2B hooks were inspected.

Affected forms:

- `/asistencias/manual`: `ManualAttendancePage`.
- `/asistencias/:id`: correction and annulment in `HistoricalAttendanceOperation`.
- `/asignaciones/nueva`: `CreateAssignmentPage`, including `ResourcePicker`.
- Existing `AssignmentField` and `ResourcePicker` utilities are reused; their other
  existing consumers retain their contracts and business behavior.

`fieldErrorAttributes` joins existing descriptions with the relevant error reference
and supplies `aria-invalid`. Instance-specific `useId()` values keep control/error
IDs stable and distinct, including simultaneous correction/annulment forms and
repeated resource pickers. Corrected fields lose obsolete error references without
losing pre-existing descriptions. Field errors remain visible text, without a live
alert for each error; focus exposes the first error through its control description.
Existing server/network notices retain their live-region behavior.

The manual observer error is associated with its resource control. Until the
historical assignment selector is available, its prerequisite error is associated
with the operative picker rather than an absent control. Once available, the error
describes the historical assignment selector. Resource selection errors describe
the search input while choices are loading/unavailable; overlong search errors have
their own ID and preserve relevant selection-error descriptions.

`useInvalidFieldFocus` composes the unchanged Q2B `useConfirmationFocus` hook:

- Captures focus intent before resolver execution and waits for committed invalid
  attributes, using a distinct failed-validation token for each submission.
- Focuses the first enabled invalid control in actual form order, including custom
  resource selectors/search fallbacks, before later dates and times.
- Disables React Hook Form's competing automatic error focus in these three forms.
- Preserves a later intentional focus change during asynchronous validation.
- Does not focus again when delayed catalog options appear.

No changes to schemas, constraints, payloads, permissions, API/backend code,
database schemas/migration files, preflight snapshots, `expectedVersion`, mutation
behavior, uncertain-result handling, retries, providers or Q2B route/confirmation
hooks. No dependencies or broad form redesign.

## Automated validation and independent review

| Check | Result |
| --- | --- |
| Focused Vitest/RTL: form errors, historical Attendance and assignments | 95 passed across 3 files |
| Full web Vitest/RTL suite, including Q2B regressions | 447 passed across 18 files |
| Workspace typecheck | Pass |
| Warnings-denied lint | Pass |
| Workspace formatting | Pass |
| API/web production builds | Pass |
| Whitespace check | Pass |

Tests check actual `document.activeElement`, computed accessible descriptions via
Testing Library queries, unique/stable IDs, preservation of existing descriptions,
error removal, selector-before-date focus order, unresolved-resource fallback,
asynchronous validation without focus theft and recovery into existing confirmations.
Existing mutation, uncertainty, version/preflight, identity and Q2B focus tests pass.

One independent reviewer executed the 95 focused tests, lint and workspace typecheck.
The only finding was formatting in the added unresolved-selector test; it was fixed
and the repository formatting check passed. No material behavioral finding or
suppression remained. No second independent review was performed.

## Real Chrome verification

Used the existing Playwright CLI skill and pinned CLI 0.1.24 with real headless
Google Chrome, Vite+ at localhost:5173 and NestJS at localhost:3000. Task-only MySQL
8.4 container `hhp-q2c-mysql-20261117` used loopback port 33313, database
`hhpaisanos_test_q2c` and tmpfs `/var/lib/mysql`; Docker `Mounts` was empty.
Only existing migrations were applied to this newly created database.

Synthetic ADMIN/grants, catalogs and assignment supported real reads/preflight.
A real manual capture and real correction prepared a current pending-review
Attendance version. No business API responses were mocked. Credentials and fixture
scripts stayed local and ignored. The regression payloads stop at confirmation/
cancel and do not apply administrative writes.

- Verified **17 first-invalid-control cases** across assignment creation, manual
  capture, correction and annulment, with actual active elements, Spanish names,
  unique description references and solid visible focus outlines of at least 2px.
- Chrome CDP `Accessibility.getPartialAXTree` confirmed the focused controls' actual
  accessible names and error descriptions, not just the presence of ARIA attributes.
- Tab/Enter submitted forms, ArrowDown/Enter selected resources and location reason,
  and keyboard typing corrected reason fields. Recovery reached existing confirmation
  summaries; cancellation preserved valid form values and cleared obsolete errors.
- The reusable payload sets native date/time fixture values with Playwright `fill`;
  native date recovery was additionally verified with keyboard entry using Chrome's
  Spanish day/month/year segment order.
- Held the real observer catalog request: invalid submission focused the associated
  search input. After intentional keyboard navigation to a date, releasing the read
  did not steal focus; the error remained associated with the now-available select.
- Verified unchanged Q2B route heading focus/titles and Attendance review summary
  focus/cancel-to-decision behavior alongside the corrected historical forms.

Reproduction with prepared isolated synthetic fixtures and an authenticated ADMIN:

```powershell
$cli = './node_modules/@playwright/cli/playwright-cli.js'
node $cli -s=q2c run-code --filename=.playwright/check-form-errors.txt --raw
node $cli -s=q2c run-code --filename=.playwright/check-pending-form-focus.txt --raw
```

The first payload expects a selectable observer, active operative/module and an
assignment covering November 2026; the first entrance detail must be current and
pending review. It uses November 15–16 fixture dates. The second only needs
assignment-creation/catalog grants. These are operator-invoked checks, not a new
CI provisioner or test runner.

Closed only the named browser, stopped verified task-owned API/web processes and
removed the exact task-only container, destroying its synthetic accounts and tmpfs
data. The shared MySQL service/database/volume and shared environment files were
left untouched. No credential or browser artifact is committed.

## Limitations

No screen-reader certification, cross-browser/physical-device claim, exhaustive
WCAG audit, full F1–F9 browser replay or deployment is implied. Q2A table/F9 layout
checks were not repeated because no layout/styles changed. Native date/time fixture
setup in the reusable browser payload is not an end-to-end keyboard-entry claim for
every browser locale. No additional stage was started.
