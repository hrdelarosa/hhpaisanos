# D2 — Application shell, authentication and home

## Baseline, recovery and boundaries

- Confirmed D1 PR #38 merged into `dev` at `2a2200c`. Fetched origin and fast-forwarded the primary `dev` worktree. Its two pre-existing untracked logos matched the D1 Git blobs exactly, so they were adopted unchanged; the unrelated `skills-lock.json` was preserved.
- Created `feat/d2-application-shell` in `D:/dev/hhpaisanos-d2` from that updated `dev`. Resumed the same worktree after the interrupted session; no replacement branch/worktree or duplicate implementation was created. There was no existing D2 commit, push or PR at recovery.
- Read AGENTS, D1's DESIGN and validation report, the approved plan, relevant installed frontend-design/shadcn/Tailwind/accessibility/Playwright guidance, and SIGIP's actual AppLayout, AuthLayout, AppSidebar, SiteHeader, breadcrumbs, NavUser, login and dashboard source.
- D2 only. Backend, schema/migrations, authentication/session runtime, permissions/guards, Query identity isolation, CaptureProvider/runtime, capture timing/retries, business mutations and administrative page implementations remain unchanged. No dependencies, font assets or design tokens were added. D1's logos and favicon are unchanged.

## Delivered presentation

- `AuthenticatedLayout`: institutional-green desktop sidebar, compact header, identity/initials and light content workspace. Desktop navigation can be hidden and reopened without replacing the main/content subtree. Native modal navigation starts closed below 1024px; the same trigger stays reachable across breakpoints.
- `AppNavigation`: grouped effective destinations, visible current-route treatment, personal history and account/password/logout actions. `navigation.ts` reuses the former home role/permission conditions, preserves create-only grants and Assignments' explicit-permission exception. There is no implicit ADMIN bypass.
- `SiteBreadcrumbs`: context from existing route metadata, accessible ancestor links only when readable, normalized case/trailing slashes, and no decorative record queries. Denied destinations retain truthful route context without an unauthorized link.
- `AuthFrame`: original complete logo, D1's `max-w-auth`, focused light surface, consistent supporting copy and session feedback. Login/password field registrations, validation, session verification and mutation handlers retain their existing behavior.
- `SessionHomePage`: identity, operational scope already known to the app, grouped task access and granted creation actions. Personal attendance is first for OBSERVADOR. Empty grants produce an honest no-tools state. No statistics, review counts, notifications or new dashboard requests were introduced.
- Public health/not-found screens use `PublicPage`: a verified unrestricted identity receives the shell; other states receive the branded public frame without private identity. Protected loading/denied/lazy-error content remains inside the shell and its existing boundary.
- `Brand` reserves original dimensions/proportions for complete and compact images. Small local SVG navigation icons require no icon package. Existing Button/Input implementations are reused.

## Accessibility and lifecycle details

The root AppLayout retains the existing URL-state adapter, skip link and Q2B focus hook, now scoped to its wrapper. Each committed public/authenticated frame owns exactly one `main#main-content`/route-content region. Providers remain above routing; sidebar changes do not reset capture or session state. Query-only changes retain existing focus semantics.

The mobile dialog uses `showModal()`/`close()` and the browser's focus containment, Escape dismissal, inert background and normal invoker restoration. There is no custom focus trap, manual inert management, global shortcut or automatic mutation/import retry. Following a menu link closes the panel before route focus runs. Scoped backdrop/overscroll CSS does not change global scrolling. Active links keep the existing light focus treatment; inverse links receive the existing inverse focus token.

Browser validation exposed one real breakpoint edge case: CSS can hide a focused desktop link and move focus to body before the media-query change handler runs. The shell now remembers sidebar focus intent, clears it when focus/pointer activity moves elsewhere, and restores the still-visible trigger when the sidebar disappears. This does not replace or alter `useRouteFocus`.

## Automated validation

- `pnpm typecheck`: passed for web, API and API tools.
- `pnpm lint`: passed, warnings denied.
- `pnpm format:check`: passed; formatting is limited to affected frontend files.
- `pnpm build`: passed for API and web; administrative screen chunks remain separate lazy outputs. The main web bundle is approximately 368 kB / 116 kB gzip (D1 approximately 358 kB / 113 kB gzip).
- Final `pnpm --filter @hhpaisanos/web test -- --maxWorkers=1`: **457 tests / 19 files passed**, with browser/preview and concurrent reviewer test runs stopped.
- Existing auth/routing/lazy/permission/identity/capture/form-error tests retained. Selector changes follow the new visible home title and identity placement; create-only tests scope their link to the authorized-home navigation. First cold-route waits in Observers/Accounts/Operatives/Attention Modules and three Assignments bootstrap queries allow 5s for lazy content without weakening any field/focus/data assertions. The new navigation matrix adds 10 tests for effective role/permission behavior and create-only destinations.
- Initial parallel workers exhausted local resources (spawn/read errors). Validation uses one worker. Intermediate full runs reported 454/457 and 456/457 passing with 1s cold-load timeouts, while the 53 Assignments tests passed in isolation without application changes. These observations led to the narrow bootstrap-wait adjustments above, not a global test timeout or suppressed errors. The final isolated run passed all tests.

## Playwright CLI browser validation

Used installed CLI 0.1.24 with a built preview at `http://localhost:5175`, ephemeral session `d2-shell` and synthetic intercepted same-origin `/api/` responses. No real credentials, live API/NestJS/MySQL instance, shared database, GPS request or attendance mutation was used. Authentication contract validation relies on the unchanged runtime tests, not a claim of new end-to-end backend validation.

Reproducible payload: `.playwright/check-application-shell.txt`, invoked from the repository root:

```powershell
node ./node_modules/@playwright/cli/playwright-cli.js -s=d2-shell open http://localhost:5175
node ./node_modules/@playwright/cli/playwright-cli.js -s=d2-shell --raw run-code --filename=.playwright/check-application-shell.txt
node ./node_modules/@playwright/cli/playwright-cli.js -s=d2-shell close
```

Passed checks:

- 23 viewport/landmark measurements: ADMIN/ENLACE/OBSERVADOR and a long-name/no-grants identity at 320/390/768/1280px, plus narrow-table and breakpoint transitions. Exactly one main; document scroll width equals viewport width in every measurement.
- Initial closed mobile navigation; Enter opening; visible close; Escape; invoker focus restoration; keyboard containment/wrap; real touch-event opening at 390px; both directions of breakpoint change with focus kept on a visible control.
- Menu-to-route Q2B heading focus. Operatives' original named/focusable overflow region, visible 2px focus and native keyboard scrolling remain functional. Long synthetic table content does not cause page overflow.
- Create-only destinations without unreadable-list breadcrumbs, Assignments exception, ENLACE account exclusion, no ADMIN bypass, denied routes without private requests and no home decoration requests.
- Login, mandatory password restriction, password-update fresh-login outcome, voluntary return link, unknown logout with explicit retry, different-identity login, expired-session revalidation and unavailable-session explicit recovery.
- Rejected production lazy chunk with heading focus, then mobile navigation home and logout still usable. Not-found and public health screens render. No requests to attendance endpoints occur in this payload.

The test harness was corrected to dispatch visibility changes on `window` (the installed Query listener target) and to allow the native dialog itself as a keyboard focus stop. Neither required an application/session workaround. Expected synthetic 401/503 responses and the intentionally aborted chunk produce console errors; they are not unexpected application errors.

## Visual evidence and assessment

Locally captured and inspected final synthetic-data screenshots under ignored `.playwright-cli/`:

| Surface | Artifact |
| --- | --- |
| Login desktop | `d2-login-1280.png` |
| Login mobile | `d2-login-320.png`, `d2-login-390.png` |
| Desktop sidebar and ADMIN home | `d2-home-admin-1280.png` |
| Mobile navigation | `d2-navigation-mobile-390.png` |
| OBSERVADOR home | `d2-home-observer-390.png` |
| Mandatory password | `d2-password-390.png` |
| Existing administrative page inside shell | `d2-operatives-1280.png` |

SIGIP's useful contribution is the persistent grouped navigation, compact header/breadcrumbs, restrained functional surfaces and aligned task composition. Paisanos keeps its own green/ivory identity and exact supplied logo backgrounds. Authentication stays compact rather than promotional. Initial home cards were too tall; the final two-column operational grid groups icons/titles and related actions, while attendance/administration align beneath it. OBSERVADOR sees a direct attendance/history entry instead of administrative placeholders. Focus outlines in screenshots reflect preserved Q2B heading focus, not a decorative border. No metrics or charts were fabricated.

## Review and limitations

The single independent D2 review completed: **no material findings**. The reviewer independently checked permission parity, landmarks, focus lifecycles, source asset dimensions, scoped CSS and frozen infrastructure, and ran the 10 navigation, 10 lazy-route and 22 auth tests successfully. Their concurrent parallel full-suite runs also reproduced cold-query timeouts. One low-severity branding observation was addressed: the compact header logo now has the program's descriptive alt text because no adjacent program name is present. No repeated independent review was necessary for that attribute-only correction.

After the correction, the final production preview confirmed the visible mobile banner image is `/paisanos-logo.webp` with accessible name `Heroínas y Héroes Paisanos`; visual screenshots were regenerated. The ephemeral browser and preview server were stopped deliberately after validation.

This validation is Chromium-focused, not a cross-browser certification or complete WCAG audit. No new real-backend authentication integration or full F9 rerun is claimed.

Existing administrative module navigation/content remain inside the new shell intentionally: list/detail/form refinements belong to D3A–D3C. Attendance capture/history composition belongs to D4. Native-dialog scroll containment is progressive enhancement on browsers with weaker overscroll support; the visible close control and Escape remain the primary dismissal paths. No D3/D4 work was started.
