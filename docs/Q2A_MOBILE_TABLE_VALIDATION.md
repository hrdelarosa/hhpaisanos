# Q2A — Mobile administrative table readability

## Scope

Fixes Q1-01 only in `/operativos` and `/cuentas`. No business logic, filters,
pagination, permissions, API contracts, global styles or dependencies change.
Q2B/Q2C focus and form-validation findings remain outside this change.

- Tables retain native semantics, captions and column/row header scopes.
- Minimum table widths use Tailwind's existing 4px spacing scale: 640px for
  Operatives and 800px for Accounts (actual intrinsic width may be larger).
- Short headings, dates, statuses and actions do not wrap. Operative names,
  usernames and full names retain wrapping and complete selectable text.
- Existing local overflow containers become keyboard-focusable named regions.
  Native arrow-key/touch scrolling and the existing global focus outline are used;
  no custom scrolling controls, clipping or interaction handlers are introduced.
- F9's inherited `wrap-anywhere` protection is unchanged.

## Real-browser validation

Executed 2026-11-17 using installed Playwright CLI 0.1.24, headless Chrome,
real Vite+ and real NestJS at localhost:5173/3000, without business API mocks.
Used task-only `hhp-q2a-mysql-20261116`, the existing MySQL 8.4 image, loopback
port 33311 and `/var/lib/mysql` on tmpfs; `Mounts` was empty. Existing migrations
ran only against `hhpaisanos_test_q2a`. Roles/bootstrap ADMIN were synthetic
prerequisites; subsequent accounts, operatives and module fixtures used real APIs.
No shared environment file, account, database, volume or API source was modified.

Fixtures include readable Spanish synthetic names, a 50-character username,
150-character unbroken full name, 120-character unbroken operative/module names,
100-character municipality, two operative states, active/inactive accounts and
both password-change labels. No generated credentials are retained in the report
or committed browser payload.

Before the fix, the browser regression failed at 320px on fragmented headings,
dates, states and action links. After the fix:

| Route | Viewports | Table width | Document width | Result |
| --- | --- | --- | --- | --- |
| `/operativos` | 320 / 390px | 640px | 320 / 390px | Short text stays on one line; long names wrap |
| `/cuentas` | 320 / 390px | approximately 858px | 320 / 390px | Short text stays on one line; long usernames/names wrap |

All table headers measured 53px high, rather than the 242px Accounts header
observed in Q1. Both lists passed native ArrowRight scrolling, Tab to the first
action, visible/unclipped focus, native touch-event swipes through Chrome CDP,
unchanged complete text and retained header scopes. Left/right screenshots were
visually inspected. Touch validation is browser emulation, not a physical device.

The unchanged F9 payload also passed on the long-module detail at 320/390/768px:
document width matched each viewport and the full heading remained available.

## Reproducing the focused regression

Prepare an **isolated** real API/database fixture and authenticate a synthetic
ADMIN using the installed CLI, following README's browser-isolation guidance.
Both list pages must contain an unbroken 40+ character row identifier/name;
Accounts must also contain an unbroken 100+ character full name. Include normal
names, dates and supported states to inspect alongside the stress fixtures.
Do not use shared development data or export session state.

```powershell
$cli = './node_modules/@playwright/cli/playwright-cli.js'
# In an already authenticated named Chrome session:
node $cli -s=q2a run-code --filename=.playwright/check-mobile-tables.txt
# Open the isolated long-module detail, then reuse the F9 check:
node $cli -s=q2a run-code --filename=.playwright/check-long-content.txt
```

This is an operator-invoked regression using the existing CLI infrastructure,
not a new test runner or CI fixture provisioner. It measures real layout, short
text fragmentation, long-content wrapping, named-region focus, keyboard/touch
scrolling, action visibility and text preservation. jsdom cannot prove layout or
native scrolling; existing list component tests additionally check the named,
focusable regions around the correctly named tables.

## Checks and limitations

| Check | Result |
| --- | --- |
| Operatives/Users Vitest component tests | 69 passed across 2 files, including final semantic containers |
| Workspace typecheck | Pass |
| Workspace lint with warnings denied | Pass |
| Workspace formatting | Pass |
| API and web production builds | Pass; web rebuilt after final markup adjustment |
| Whitespace check | Pass |
| Final browser payload | Both routes at 320/390px passed after the semantic-container adjustment |

```powershell
$env:RAYON_NUM_THREADS = '1'
pnpm --filter @hhpaisanos/web test src/modules/operatives/operatives.test.tsx src/modules/users/users.test.tsx --pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000
pnpm typecheck
$env:GOMAXPROCS = '2'
pnpm lint
pnpm format:check
pnpm build
pnpm --filter @hhpaisanos/web build
git diff --check
```

One independent reviewer found no additional material defects. Addressed its
lint/formatting findings: named semantic `section` elements replace explicit
`div role="region"`, and the intentional `tabIndex={0}` has a line-local lint
exception explaining native keyboard scrolling. No shared lint rule was relaxed.
The final browser regression and component tests confirm implicit region semantics.

Closed the named browser and verified/stopped only task-owned API/web processes.
Stopped/removed the exact task-only container, destroying the tmpfs fixture and
synthetic accounts. The original shared MySQL service remains untouched. Browser
screenshots, console logs and temporary fixture scripts remain ignored, not committed.

No full F1–F9 rerun, WCAG certification, screen-reader validation, physical-device
or cross-browser claim, or deployment approval is implied. The browser payload is
operator-invoked and does not provision fixtures in CI.
