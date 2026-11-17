# D1 — Design foundation and branding

## Scope and baseline

- Started from `dev` / `origin/dev` at `68307c8` after fetching and confirming zero divergence. No tracked changes were present. The primary worktree contained pre-existing untracked `apps/web/public/` originals and `skills-lock.json`; neither was altered.
- Work is isolated in `feat/d1-design-foundation`, `D:/dev/hhpaisanos-d1`.
- Read AGENTS, DESIGN, the approved conversation plan, relevant design/Tailwind/HTML and Playwright guidance, and the existing F9/Q2 findings reviewed during planning.
- D1 only: documentation, one additive layout token, unchanged original assets and favicon integration. No new components, screen redesigns, dependency changes, backend/database operations or changes to authentication, permissions, routing or mutations.

## Design contract

`DESIGN.md` remains in English with its YAML front matter and eight ordered sections. It now documents the approved institutional direction, original branding, responsive shell/page composition, task-oriented home, native mobile navigation, inline business confirmations, shared-component extraction boundaries and Q1–Q2/F9 preservation requirements. Obsolete F1A/`packages/ui` implementation references were replaced with the actual frontend paths.

The palette, font stack, typography, radii and existing dimensions remain unchanged. The only additional token is `spacing.auth-max: 480px`, mapped to `--container-auth: 480px` in the existing `@theme inline` block. Future D2 consumers can use `max-w-auth`; no existing page uses it yet. The existing sidebar width stays 248px. No global selector, base style, focus rule or light/dark color changes were necessary.

## Branding and favicon

The supplied originals are now versioned at their original paths, byte-for-byte identical to the files in the primary worktree:

| File | SHA-256 |
| --- | --- |
| `apps/web/public/paisanos.webp` | `7791AC9CD7C3952424EA1AD2C5A75DAFD7B5AFD175687B756F65B78AC1F9E5B7` |
| `apps/web/public/paisanos-logo.webp` | `F4A5219383EBC4CCABAB21357B95C2AC3923DE53E947B4A4F6F6FD04422C67D9` |

`apps/web/public/favicon.png` is a 48×48 PNG derived from the entire 1330×1182 compact original using the browser's Canvas 2D image resampler. Recipe: create a transparent 48×48 canvas; enable high-quality image smoothing; calculate `scale = 48 / max(sourceWidth, sourceHeight)`; draw the full source at `(48 - width) / 2, (48 - height) / 2` with dimensions `sourceWidth * scale, sourceHeight * scale`; export with `canvas.toDataURL('image/png')`. The drawn image is approximately 48×42.659px with a 2.671px vertical offset. There is no source crop, background removal, recoloring, symbol redraw or distortion. No image package was installed.

`apps/web/index.html` declares `/favicon.png` with `type="image/png"` and `sizes="48x48"`. An ICO is intentionally omitted: the PNG suffices for the checked browser and adds no second generated asset to maintain.

### Visual limitation

Playwright captured the PNG rendered at 16, 32 and 48 CSS pixels against light and dark surfaces. At 16px the P silhouette is visible, but the eagle's fine detail and original texture are not reliably distinguishable; the original background/margins reduce the symbol's footprint. At 32/48px the eagle/P is clearer. This limitation is accepted as an honest reduction of the supplied original, not solved with an unauthorized crop or redesign. No native browser-chrome screenshot or cross-browser certification is claimed.

## Executed checks — 2026-11-17

Existing locked dependencies were restored offline in the new worktree (`pnpm install --offline --frozen-lockfile`); manifests and lockfile are unchanged.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed: API, API tools and web |
| `pnpm lint` | Passed, warnings denied |
| `pnpm format:check` | Passed |
| `pnpm build` | Passed: API and web |
| `pnpm --filter @hhpaisanos/web build` after favicon generation | Passed; final public assets copied to dist |
| `pnpm --filter @hhpaisanos/web test -- src/app/routing.test.tsx src/app/route-loading.test.tsx src/hooks/form-errors.test.tsx` | Passed: 16 tests / 3 files |
| `git diff --check` | Passed |
| Source asset hashes | Identical to the supplied originals |

### Real-browser checks

Used the already installed Playwright CLI 0.1.24 via its direct Node entrypoint, named ephemeral session `d1-branding`, with Vite+ on loopback port 5174. API responses were intercepted at the application's `/api/` URL only, with synthetic anonymous/ADMIN/OBSERVADOR fixtures. No database, credentials, geolocation request or capture mutation was used.

- `/login`, `/operativos`, `/mi-asistencia` at 320, 390, 768 and 1280px (12 combinations): one main and one h1; no document-level horizontal overflow.
- Operatives: long synthetic name wraps; native table retains its minimum 640px width, named keyboard-focusable overflow region and visible 2px focus outline at every checked width.
- Personal attendance: existing entry action, location explanation and no-marks state render; capture was deliberately not submitted.
- Favicon: HTTP 200, `image/png`, declared and decoded size 48×48; actual image rendering checked at 16/32/48px on light and dark surfaces.
- Built preview on loopback port 4174: login rendered; favicon and both original logos returned HTTP 200 and decoded successfully. Both served original hashes matched the source hashes above. The served favicon SHA-256 was `832642D33E6E1ABE2D3A446ABE5B6F9B70A1E4DDEEB4F338695C5A788092A8D5`.
- Screenshots retained locally under ignored `.playwright-cli/d1-*.png`; they contain synthetic data only and are not required production assets.
- Initial smoke setup exposed an unavailable local API and two test-harness issues (an overly broad interception pattern also matched source-module URLs; a fixture used the wrong attendance URL). Corrected the harness only, then reran all 12 combinations successfully with no unexpected API requests. These were not application regressions.

This is focused presentation validation, not a fresh execution of all F9 flows, a full WCAG audit or validation of real API permissions/capture. The unchanged runtime logic and existing focused regressions remain the basis for those behaviors.

## Independent review

One independent `reviewer` review completed against `origin/dev` (`68307c8`): **no material findings**. It independently checked the eight-section English document structure, scope boundaries, contrast calculations, additive Tailwind token, source hashes, PNG dimensions/transparency/proportional fit and favicon declaration. No corrections were required.

Non-blocking observations: fine-detail loss at 16px is inherent to preserving the full original; future implementation-specific guidance must be maintained as D2–D4 evolve. The reviewer did not rerun tests/builds or reproduce browser screenshots; execution evidence above belongs to the implementation session. The browser session and the two validation servers were stopped after checking.

## Deferred work

- D2: actually place the logos, apply the auth width, implement the sidebar/header/breadcrumbs, coordinate mobile-dialog focus with committed-route focus, and replace the session home. Revalidate session transitions, partial permissions and lazy-route recovery at that stage.
- D3A/B/C: administrative composition and shared presentation extraction with real consumers.
- D4: mobile attendance redesign and final cross-screen regressions. Current timing, retries and capture state are unchanged by D1.
- No fonts, icon packages, theme selector, modal business forms or new APIs were introduced.
