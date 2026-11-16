# F9 — Integrated Frontend Validation and Stabilization

## Assessment and scope

**CONDITIONAL GO for functional completion of the implemented F1–F8 frontend.**
No blocking application defect remains in the executed workflows. The confirmed
long-content responsive defect is fixed. The repository-wide formatting gate still
fails on pre-existing files; this is not represented as a passing gate. Accept or
resolve that baseline separately before requiring an entirely green workspace check.
This assessment is **not production deployment approval**, a WCAG certification,
or completion of unimplemented requirements such as Attention Reports or Telegram.

On 2026-11-16, verified PR #31 merged into `dev` at `bc899ce`, fetched `origin/dev`,
and confirmed the primary `dev` worktree clean and current. Work is isolated in
`test/f9-frontend-integration`, based on that commit. Read AGENTS, DESIGN, requirements,
actual routes/controllers/DTOs, session/Query/HTTP infrastructure, F4C–F8 reports,
and README's F1A/F1B, F2, F3, F4A and F4B validation sections. Separate F1–F4B
report files do not exist on this base.

Only the shared layout's text-wrapping utility, a focused Playwright CLI regression,
and this report change. No backend, migration, dependency, permission matrix,
domain transition, route, redesign or new feature is introduced.

## Environment and isolation

- Installed locked dependencies with `pnpm install --frozen-lockfile`; no dependency
  additions or updates. Used project Playwright CLI **0.1.24**, installed headless
  Chrome and the installed CLI skill instructions loaded before worktree creation.
- Real Vite+ web at `http://localhost:5173`, real Nest `AppModule` at
  `http://localhost:3000`; same-origin `/api` development proxy, no business API mocks.
- Created task-only container `hhp-f9-mysql-20261116` from the already-installed
  `mysql:8.4` image, bound only to `127.0.0.1:33309`, with `/var/lib/mysql` on tmpfs.
  `docker inspect .Mounts` returned `[]`: no persistent volume was attached.
- Applied existing migrations only to new `hhpaisanos_test_f9`, with a synthetic
  scoped SQL account. Used existing DatabaseService, migration and permission
  provisioning infrastructure. Seeded only roles and the initial temporary ADMIN
  prerequisite; subsequent accounts and business records used actual HTTP APIs.
- No shared `.env`, development credentials or development tables were read or
  modified. The shared container and persistent volume were left unchanged.
  No personal browser profile, exported session, operational
  information, external capture, deployment or institutional infrastructure was used.

## Integrated workflows tested

The same synthetic observer, account, operative, module and assignment were carried
across modules, not replaced by unrelated per-screen mock fixtures.

| Journey | Real-browser / real-API result |
| --- | --- |
| ADMIN initial access | Synthetic bootstrap-equivalent temporary ADMIN signed in, completed mandatory password change, signed in again. Users cannot create ADMIN accounts; no unsupported ADMIN-creation screen was invented. |
| Account onboarding | ADMIN created OBSERVADOR and ENLACE accounts through UI. Temporary credentials were masked, used only in memory in separate browser contexts, then dismissed. Each account independently changed its temporary password and signed in with definitive credentials. |
| Observer registration/link | UI created an active unlinked profile, exact eligible username lookup, supervised attestation, reason, review and confirmed link. Independent definitive sign-in preceded attestation. |
| Operational setup | UI created an operative draft, activated with explicit tolerance/reason/confirmation, created an attention module, and selected actual catalog resources to create a persistent assignment. |
| Personal Attendance | OBSERVADOR signed in, consulted server civil-date assignment context, recorded entry with synthetic GPS and exit with browser permission-denied evidence. Both were pending because factual timing/location anomalies applied. No acceptance was fabricated. |
| Exact observer retry | First entry POST reached Nest and committed, then its response was aborted. UI offered explicit retry, not success. Retry reused byte-identical body and the same idempotency key, without reacquiring GPS; two requests produced one mark/receipt. |
| Administrative review/history | ADMIN accepted the entry, corrected it into a distinct pending version, then separately rejected that version. Personal history later showed the rejected current version while retaining original history. Acceptance did not remove timing anomalies. |
| Uncertain administration | A corrected exit's real review committed, then only its response was aborted. UI retained “Resultado incierto”; exactly one POST, no automatic retry and no inferred request success from the refreshed accepted state. |
| Manual Attendance | UI backfilled historical entry and exit with explicit microsecond UTC times, applicable assignment/date, missing-location declaration and reasons. Manual records were administratively accepted, not GPS-verified. |
| Correction, separate review, annulment | A manual entry's correction created a pending successor. Separate review accepted it; subsequent explicit annulment retained both versions. Reload removed mutation forms for the annulled record. |
| Concurrent administrators | A real competing correction committed after final preflight but before the UI annulment POST. The UI received authoritative **409**, issued one annulment POST, and did not overwrite or retry. |
| Historical assignment changes | UI prospective schedule change split the assignment from the following civil day, retaining the original through today. Current Attendance projections were identical before/after. Real API termination that would exclude existing historical marks returned **409**. |
| Role boundaries | ADMIN → ENLACE → OBSERVADOR switches exposed no previous detail subtree. ENLACE/OBSERVADOR Users routes were denied and actual Users reads returned **403**; OBSERVADOR administrative Attendance route/API were also denied. |
| Account revocation | ADMIN deactivated an account with an existing observer session: real `/auth/me` returned **401**, and the UI removed private history. Reactivation preserved the profile/link but did not restore the old session. |
| Absolute expiration | Advanced only the synthetic observer session's stored absolute expiry in the disposable database. Its next UI history read returned **401**, removed the private subtree and displayed the expired/revoked-session login message. No refresh mechanism was added. |

Observer personal history subsequently showed administratively accepted, rejected and
annulled current marks across both dates. Automatic acceptance remains covered by the
existing automated suite; F9's browser schedule intentionally produced anomalies.
Already-observed F1–F8 results are background evidence, not described as new F9 runs.

## Security and historical integrity

- Browser session cookie was HttpOnly and SameSite=Lax; `document.cookie` was empty.
  HTTP localhost does not exercise production Secure/`__Host-` cookies or TLS.
- A real mutation without CSRF protection returned **403**. Normal UI mutations used
  JSON, same-origin cookies and `X-HHP-CSRF: 1`. HTTP transport uses `cache: no-store`.
- Login/change-password/logout and account switching were exercised through actual
  session handling. Source and existing regression tests additionally cover discarded
  identity/permission Query clients, late callbacks and uncertain logout.
- Browser localStorage/sessionStorage remained empty. No credentials, evidence,
  receipts or session state were exported. Temporary generated credentials were not
  printed or saved; synthetic fixed fixture secrets are disposable, not real accounts.
- Precise GPS appeared in authorized administrative detail, not own-history projection.
  Own API payloads were checked for absent latitude; personal UI showed no GPS or
  private administrative reasons. Switching accounts removed previous private detail.
- Direct isolated Drizzle assertions passed: **7 retained version rows**, **3 exact
  predecessor/successor pairs**, **2 completed observer receipts**, **2 assignment
  periods**. No duplicate mark from replay. Superseded rows remained noncurrent;
  current successors retained assignment/date/type, capture actor/channel, GPS,
  accuracy, missing-location reason and manual provenance. Only official correction
  time/decision/version metadata changed as supported. Original manual time retained
  `.123456` precision. All Attendance versions retained the original assignment FK.
- No optimistic writes, write retry policy changes or new backend capabilities.
  Fault injection forwarded to real Nest before dropping responses, or aborted reads;
  concurrency injection issued a second real authorized write, never a fake success.

## UX, accessibility and responsive findings

**Fixed — material mobile usability defect:** a valid 120-character unbroken module
name and 100-character municipality produced a **2798px** document at a **390px**
viewport. Inherited `wrap-anywhere` on the shared `<main>` now permits text wrapping
without hiding/truncating names or adding global horizontal clipping. The committed
`.playwright/check-long-content.txt` CLI payload preserves full heading text and checks
document/heading width at **320, 390 and 768px**. All three passed after the fix.
Before/after screenshots were visually inspected.

The shared wrapping rule also lets unbroken account names/usernames wrap inside
table cells instead of always widening their local scroll area. Full text, copying
and accessible names remain intact; local table overflow wrappers are retained.
The CLI regression is deliberately operator-invoked against a prepared synthetic
fixture, not part of Vitest/CI. jsdom does not measure real layout; the 424 component
tests alone would not detect removal of this wrapping rule.

- Reviewed 15 administrative/home routes at 390px, including lists, profile/module/
  operative/assignment detail, account/assignment forms and manual/history screens.
  The long-module detail was the only observed page-overflow defect. No unlabeled
  input/select/textarea was found by the DOM label check on these routes.
- Personal today view passed document-width checks at 320/390/768px; screenshot
  inspection confirmed legible distinct rejected/accepted marks and retained anomalies.
- Held an actual Operatives read to inspect loading; real empty-name filter, aborted
  read and explicit retry passed at 320px without page overflow. Confirmations,
  required reasons and destructive actions were exercised in the integrated workflows.
- Keyboard Tab exposed the visible skip link with a solid focus outline; Enter moved
  focus to `main-content`. Native labeled controls and explicit review/confirm actions
  remained keyboard-operable. Confirmations are inline sections, not modal dialogs.
- Existing semantic DESIGN colors, visible labels, text statuses and 44px primary
  controls were retained. No navigation redesign or visual assets were introduced.
- Minor remaining usability observations: some administrative detail missing-location
  reasons display the API code in English; inline confirmation/route focus management
  could be more deliberate. These do not prevent keyboard completion. This was a
  targeted accessibility review, not exhaustive screen-reader/contrast certification.
- A wider 30-navigation 320/768px sweep was interrupted when the CLI browser closed
  under host resource pressure. Do not treat it as a passed sweep; the narrower
  long-content and personal-view checks above completed successfully.

## Automated validation and performance

| Check | Result |
| --- | --- |
| Full web Vitest/RTL suite, before the CSS-only fix | **424 passed / 16 files**, one serial run, 99 seconds |
| Relevant App/routing tests after the fix | **6 passed / 2 files** |
| Workspace typecheck | Pass |
| Workspace lint | Pass |
| API and web production builds | Pass, including rebuild after the fix |
| Workspace formatting | **Fail on 125 pre-existing files**, predominantly worktree CRLF formatting; not silently reformatted |
| Changed-file formatting and whitespace | Layout formatting and `git diff --check` pass; docs are excluded by the existing formatter policy and the CLI payload is raw text. |

A first post-fix focused-test attempt failed before tests with native
`VirtualAlloc failed` while browser/build work ran concurrently. It passed when
rerun serially with `RAYON_NUM_THREADS=1`; no product/test logic was weakened.
Final typecheck and lint also pass; final lint used `GOMAXPROCS=2` after the native
type-aware linter exhausted host memory at its default concurrency. The CLI regression
is stored as a raw `.txt` function payload, not an imported/unused JavaScript module.
Temporary browser-script locator/HTTP-status mistakes were corrected against actual
snapshots/controllers before counting the affected workflows as passed.

Measured actual production output, rather than proposing speculative optimization:

| Output | Baseline | After text-wrapping fix |
| --- | --- | --- |
| JS entry | 635.98 kB / 180.35 kB gzip | 635.99 kB / 180.36 kB gzip |
| CSS | 13.21 kB / 3.79 kB gzip | 13.25 kB / 3.80 kB gzip |

The **>500 kB chunk advisory remains**. `routes.tsx` eagerly imports page components;
there is no route-level code splitting. API loading/empty/error feedback is separate
from JS loading. The tiny CSS fix does not justify a bundling refactor: no chunk
threshold suppression, dependencies, lazy-loading architecture or speculative
optimization was added. Route-level splitting should be a separately measured task
if initial-load budgets require it. No field/network benchmark or production static
hosting validation is claimed; Vite preview does not provide the API proxy.

Commands used:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @hhpaisanos/web test --pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
$env:RAYON_NUM_THREADS = '1'
pnpm --filter @hhpaisanos/web test src/App.test.tsx src/app/routing.test.tsx --pool=threads --maxWorkers=1 --no-isolate --testTimeout=15000
# In the named CLI session, open an authenticated synthetic long-module detail first:
node ./node_modules/@playwright/cli/playwright-cli.js -s=f9 run-code --filename=.playwright/check-long-content.txt
pnpm exec vp fmt --check apps/web/src/app/layouts/AppLayout.tsx docs/F9_FRONTEND_INTEGRATION_VALIDATION.md
git diff --check
```

Full backend integration suites were not repeated: F9 reused focused frontend tests
and real-browser/API/isolated-database assertions, not another expensive backend run.

## Findings and remaining limitations

| Classification | Disposition |
| --- | --- |
| Blocking defects | None confirmed in executed supported workflows. |
| Material non-blocking issues | Long-content page overflow fixed and browser-regressed. Existing workspace formatting failure remains a separate baseline issue. |
| Minor improvements | Raw location-reason codes and more deliberate focus management; broader assistive-technology coverage. |
| Known backend limitations | No ADMIN creation through Users; no role/permission editor or linking replacement UI; no administrative idempotency/receipt-recovery API; fresh reads cannot remove the final GET/write race. Review/annulment can retain the same version, so expectedVersion is not an expected-status token. Bounded history events are not a complete audit export. |
| Known deployment limitations | HTTPS/same-origin static hosting and Secure cookies, explicit migrations/grants, credential delivery/recovery and supervised identity procedures, restricted runtime SQL grants, retention and distributed rate limiting still require authorized deployment work. No office isolation or proof of physical presence is implied. |

## Independent review and cleanup

One independent reviewer inspected the stabilization diff and bounded connected
session/capture/Attendance/assignment code: **no blocking or material findings**.
It verified that the production CSS actually contains `overflow-wrap:anywhere`,
that root inheritance preserves accessibility, and that the raw CLI payload is
evaluated/invoked by the installed CLI. Minor notes: the regression is manual rather
than a CI gate; the heading-width assertion adds little beyond the binding document
overflow check; document the table-cell wrapping trade-off (now above). Its initial
“not committed yet” observation is resolved by committing the fix and report before
publication. No repeated test suite or additional reviewer was used.
No automatic merge or production deployment is authorized.

Cleanup completed: the named CLI browser no longer exists; task API/web listener PIDs
were verified and stopped. The exact task-only MySQL container was stopped and removed,
destroying its tmpfs database/accounts. Docker still shows the original shared
`hhpaisanos-mysql` service on port 3306 unchanged. Task-generated ignored scripts,
snapshots, console logs and screenshots were removed after inspection; none are
committed or uploaded. The focused source regression contains no credentials or GPS.
The dedicated worktree remains for PR review; the primary worktree is not cleaned,
reset or otherwise modified by F9.
