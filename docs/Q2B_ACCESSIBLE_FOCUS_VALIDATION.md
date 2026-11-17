# Q2B — Accessible focus and navigation

## Scope and prerequisites

- Primary worktree was clean. Fetched origin, fast-forwarded `dev` to `727fe05`,
  verified Q2A PR #35 was merged, and created `fix/q2b-accessible-focus` in a
  dedicated worktree.
- Read AGENTS.md, DESIGN.md, F9 accessibility observations and Q2A validation.
  No standalone Q1 report was present in the repository or GitHub issues; the
  confirmed Q1-02/Q1-03 descriptions in the task define this change's scope.
- No Q2C, backend, migration, dependency, provider, guard, permission, business-rule
  or mutation-contract changes. Existing identity-isolated Query behavior remains
  responsible for removing private content.

## Behavior and affected code

`AppLayout` uses a small route-outlet hook, `use-route-focus.ts`, keyed by pathname.
It observes only committed content inside its existing main region; an explicit
`data-route-content` wrapper in `AuthenticatedLayout` excludes session navigation.
No router replacement, focus provider, route registry or authentication subscription
is introduced.

- A committed route h1 receives focus and supplies the document title, followed by
  the application name. Heading-less denied/error content uses its existing alert.
  These targets use `tabIndex=-1`, not additional sequential Tab stops.
- Pending session checks/imports supply loading titles but receive no premature
  private-content focus. Committed headings, lazy-import errors and subsequent
  recovery provide fresh navigation context.
- A later `focusin` on a still-connected control suppresses automatic focus;
  loading completion still updates the title. Removed controls that leave focus on
  body can be replaced by the new route's meaningful target.
- Pathname changes begin a new navigation intent; query-string-only filter and
  pagination updates do not reset focus. The skip link and existing navigation/
  logout remain intact. F9's inherited wrapping is unchanged.
- This applies to `/`, `/login`, `/cambiar-contrasena`, `/estado`, all existing
  administrative/personal routes and the not-found route. Existing guards decide
  whether any private route can render.

`ChangeModuleStatus` (`/modulos/:id`) and `ReviewAttendance` (`/asistencias/:id`)
reuse `use-confirmation-focus.ts` to capture focus intent before asynchronous work:

- Review focuses the confirmation heading after existing preflight succeeds; all
  snapshot details, reasons and consequences remain before the final action.
- Cancel returns to the status-reason input or attendance-decision select.
- Final settlement focuses the existing server-confirmed result or existing error/
  uncertain-outcome message, without changing its semantics or claiming success.
- Focus deliberately moved elsewhere during a preflight/write is preserved.
  There is no modal, focus trap, Escape handler or form-error association change.

## Real Chrome verification

Executed using installed Playwright CLI 0.1.24 and real headless Google Chrome,
real Vite+ at localhost:5173 and real NestJS at localhost:3000. Business endpoints
were not mocked. Task-only MySQL 8.4.11 container `hhp-q2b-mysql-20261117` used
loopback port 33312 and tmpfs `/var/lib/mysql`; Docker `Mounts` was empty. Existing
migrations ran only on the new `hhpaisanos_test_q2b` database.

Synthetic fixtures included ADMIN accounts (normal/mandatory-password-change),
roles/grants, readable and maximum-length names, two operative states, modules,
observer and assignment. Real manual capture followed by a real correction produced
a current pending-review version; manual capture alone is already administratively
accepted and is not a valid review fixture. Expiration/revocation were injected only
into this disposable database's session rows, then detected by an actual private
query's 401. No shared environment file/database/volume was read or changed.

| Verification | Result |
| --- | --- |
| Keyboard login, heading focus, title and next Tab to username | Pass |
| Skip link targets main; keyboard route navigation and logout | Pass |
| Mandatory password change, confirmed sign-out and reauthentication | Pass |
| Module deactivation review, consequences, Escape unchanged, cancel and result | Pass |
| Attendance review, reviewed evidence/consequences, cancel and result | Pass |
| Delayed real lazy import preserves keyboard-selected logout focus | Pass |
| Aborted real lazy import focuses error, keeps logout/navigation available | Pass |
| Leave/revisit error without automatic retry; explicit reload recovers | Pass |
| Real expired/revoked session: login heading/title and no old identity | Pass |
| Keyboard input focus ring | Solid 2px outline, 2px offset |
| Unchanged Q2A payload, both tables at 320/390px | Pass; no document overflow, keyboard/touch scrolling retained |
| Unchanged F9 long-module payload at 320/390/768px | Pass; document width equals viewport, full heading retained |

New operator-invoked payloads check actual `document.activeElement` and accessible
names, not merely focus attributes:

```powershell
$cli = './node_modules/@playwright/cli/playwright-cli.js'
# Prepare isolated fixtures and authenticate first. The navigation payload applies
# the two synthetic operations and logs out; reauthenticate before the lazy check.
node $cli -s=q2b run-code --filename=.playwright/check-focus-navigation.txt --raw
node $cli -s=q2b run-code --filename=.playwright/check-lazy-focus.txt --raw
```

The first payload requires an active module named `Módulo sintético Q2B`, one current
pending entrance as the first attendance detail, and the relevant ADMIN grants.
The second requires Operatives/Accounts read grants and the normal Vite+ dev paths;
it holds/aborts module requests rather than replacing modules or business responses.
They do not provision data or credentials and are not a new CI test runner.

Closed only the named browser, stopped verified task-owned API/web processes and
removed the exact task-only container, destroying its accounts/sessions and tmpfs
data. The shared `hhpaisanos-mysql` service was left running and untouched. Local
fixture scripts, credentials and browser artifacts remain ignored, never committed.

## Automated checks and independent review

Focused Vitest/RTL tests cover route titles/active elements, login/logout/password
change, uncertain logout, expiry/revocation, mandatory-password responses, pending/
resolved/rejected imports and recovery, changed permissions, account switching with
and without intentional focus movement, inline review/cancel/result, uncertainty
and delayed-result focus preservation.

The full web suite passes: **438 tests across 17 files**, with normal file isolation
and one worker. Typecheck, warnings-denied lint, workspace formatting, API/web
production builds and `git diff --check` pass. No lint suppressions or validation-rule changes were
needed. One independent reviewer ran the focused tests and web typecheck and found
no material defects; no second review was requested. Minor observations were the
possibility of repeated screen-reader announcements for a focused live alert and
the need for future consumers of the confirmation hook to supply a target that
actually materializes. Current call sites provide one or unmount with the session.

An exploratory full-suite run with `--no-isolate` passed 437/438 tests: the first
auth bootstrap test inherited `/asistencias` from another suite and therefore
correctly rendered a permission denial instead of the home heading. File isolation
is the normal configuration; the subsequent full isolated run passed all 438 tests.
This is not a production focus failure; no unrelated test was rewritten to mask it.

No screen-reader, cross-browser, physical-device, exhaustive WCAG certification,
full F1–F9 replay, deployment or Q2C work is claimed. Touch checks are Chrome
emulation. Authentication's existing server-response/focus-check detection policy
is unchanged; there is no new client-side expiry timer.
