---
version: alpha
name: Heroínas y Héroes Paisanos — Operational Web Design System
description: Approved product design foundation for the Guerrero operations web app, not an official institutional branding manual.
colors:
  primary: '#235B4E'
  on-primary: '#FFFFFF'
  primary-hover: '#183F36'
  secondary: '#E7F1EC'
  on-secondary: '#183F36'
  secondary-hover: '#D8E9E1'
  accent: '#A48642'
  accent-soft: '#F6EEDC'
  background: '#F7F6F2'
  surface: '#FFFFFF'
  surface-muted: '#F0F3EF'
  foreground: '#202924'
  foreground-secondary: '#52615A'
  foreground-muted: '#626F68'
  border-decorative: '#DDE3DC'
  border-control: '#6E7B74'
  success: '#23744B'
  success-surface: '#E8F5EC'
  warning: '#946000'
  warning-surface: '#FFF2D6'
  danger: '#B42332'
  danger-surface: '#FCEAED'
  info: '#245D8C'
  info-surface: '#EAF3FA'
  focus: '#183F36'
  focus-inverse: '#F6EEDC'
  dark-background: '#101916'
  dark-surface: '#17231F'
  dark-surface-elevated: '#1E2B26'
  dark-selection: '#1E3A31'
  dark-foreground: '#EEF3F0'
  dark-foreground-secondary: '#B3C0BA'
  dark-foreground-muted: '#A7B5AE'
  dark-border-decorative: '#2C3A34'
  dark-border-control: '#7B8A83'
  dark-primary: '#2E7D69'
  dark-on-primary: '#FFFFFF'
  dark-primary-hover: '#33826E'
  dark-accent: '#C9A55C'
  dark-focus: '#E7F1EC'
  dark-success: '#5FCF95'
  dark-success-surface: '#12291E'
  dark-warning: '#E7B45A'
  dark-warning-surface: '#2C2312'
  dark-danger: '#F38B96'
  dark-danger-surface: '#2E1419'
  dark-info: '#7FBDEB'
  dark-info-surface: '#11212F'
typography:
  caption:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: '1.4'
  body-sm:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: '1.5'
  body:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: '1.5'
  label:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: '1.4'
  subheading:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 18px
    fontWeight: 500
    lineHeight: '1.4'
  heading-sm:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: '1.3'
  heading:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: '1.25'
  heading-lg:
    fontFamily: Inter, ui-sans-serif, system-ui, Arial, sans-serif
    fontSize: 30px
    fontWeight: 600
    lineHeight: '1.2'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  touch-target: 44px
  sidebar: 248px
  page-max: 1440px
  form-max: 720px
  auth-max: 480px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 16px
    height: 44px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 16px
    height: 44px
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.on-secondary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 16px
    height: 44px
  button-ghost:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 12px
    height: 44px
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.lg}'
    padding: 24px
  card-accent:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.on-secondary}'
    typography: '{typography.label}'
    rounded: '{rounded.lg}'
    padding: 24px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: 10px 12px
    height: 44px
  chip-success:
    backgroundColor: '{colors.success-surface}'
    textColor: '{colors.success}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  chip-warning:
    backgroundColor: '{colors.warning-surface}'
    textColor: '{colors.warning}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  chip-danger:
    backgroundColor: '{colors.danger-surface}'
    textColor: '{colors.danger}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  chip-info:
    backgroundColor: '{colors.info-surface}'
    textColor: '{colors.info}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  nav-active:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.on-secondary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 12px
  dark-button-primary:
    backgroundColor: '{colors.dark-primary}'
    textColor: '{colors.dark-on-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 10px 16px
    height: 44px
  dark-card:
    backgroundColor: '{colors.dark-surface}'
    textColor: '{colors.dark-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.lg}'
    padding: 24px
  dark-chip-success:
    backgroundColor: '{colors.dark-success-surface}'
    textColor: '{colors.dark-success}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  dark-chip-warning:
    backgroundColor: '{colors.dark-warning-surface}'
    textColor: '{colors.dark-warning}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  dark-chip-danger:
    backgroundColor: '{colors.dark-danger-surface}'
    textColor: '{colors.dark-danger}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
  dark-chip-info:
    backgroundColor: '{colors.dark-info-surface}'
    textColor: '{colors.dark-info}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: 4px 10px
---

# Heroínas y Héroes Paisanos — Design System

> Status: **approved product design foundation (D1)**, not an officially approved INM or Government of Mexico branding manual. The supplied program assets are the originals to use in this application; permitted public uses must still be confirmed with the relevant authorities before public release. Shell and screen conventions below are implementation requirements for later stages, not claims that those stages are complete.

## Overview

**Brand and style.** A calm, trustworthy, welcoming public-service workspace with Mexican institutional inspiration: deep green for primary interactions, warm ivory backgrounds, restrained golden decoration, and clearly legible data. It is an **internal operational application**, not a promotional website or national platform. Avoid ornamental patriotic motifs, excessive cards, oversized hero sections, glassmorphism, and decorative dashboards.

**Audience.** Mobile-first **OBSERVADOR** users capture attendance while in the field. **ENLACE** and **ADMIN** users manage operational records and reviews on desktop and smaller screens. The current system is scoped to Guerrero; do not imply per-office access isolation that the backend does not implement.

**Design principles.** Task-first, restrained hierarchy, accurate operational status, accessible by default, resilient to slow networks, and respectful of sensitive personnel/location data. Interface labels, help text, and validation messages are in **Spanish**; this reference is in English for developers and design agents.

**Authority.** This file governs visual design, not backend policies or API behavior. Existing contracts, permission checks, versioned records, and approved domain rules take precedence. Use real data only; distinguish mock/demo data visibly.

**Reference and delivery.** Adapt SIGIP's structured navigation, compact page headers, aligned filters and restrained surfaces, not its source files, routing, authentication or dependencies. D1 establishes this foundation and favicon only. D2 delivers the shell, authentication and task-oriented home; D3A covers Operatives/Attention Modules, D3B Observers/Accounts, D3C Assignments/Administrative Attendance; D4 covers personal attendance and final cross-screen validation. Each implementation increment requires approval, an isolated branch/worktree, a PR to `dev` and an independent review; never merge automatically.

**Original branding.** Keep `apps/web/public/paisanos.webp` (complete program logo) and `apps/web/public/paisanos-logo.webp` (compact P/eagle) unchanged in those exact locations. Both include an original green background; the compact asset is also rectangular, not a transparent square icon. Display the entire image with its intrinsic aspect ratio, reserved dimensions and `object-fit: contain`. Do not crop, mask, remove the background, filter, recolor, stretch or redraw either asset. The application's green tokens need not match every textured pixel in the supplied artwork.

- Use the complete logo on authentication screens and the expanded sidebar/mobile navigation where its lettering remains readable. Avoid oversized promotional branding.
- Use the compact original in constrained headers, with a readable program name where needed. Give a brand link one meaningful accessible name; use empty image alt text when adjacent text already supplies it. Standalone meaningful logos need descriptive alt text.
- Derive `apps/web/public/favicon.png` from the compact original: fit the whole image proportionally in a square transparent canvas and center it, without enlarging the symbol through a crop. Reference the actual PNG size and MIME type from `apps/web/index.html`. Inspect at 16, 32 and 48px; report lost detail instead of redesigning it. An ICO is optional, not a reason to add tooling dependencies.

## Colors

**Light theme — preferred default.** The main canvas is Warm Ivory (`#F7F6F2`), with white functional surfaces and Ink text. The primary brand/action color is Institutional Green (`#235B4E`); Deep Green (`#183F36`) is for hover and limited emphasis. Green Tint (`#E7F1EC`) marks selection and secondary actions. Heritage Gold (`#A48642`) is **decorative only**: no normal text, status labels, or functional indicators.

| Semantic role      | Token                  | Value     | Use                            |
| ------------------ | ---------------------- | --------- | ------------------------------ |
| Primary            | `primary`              | `#235B4E` | Main action, selected emphasis |
| Primary foreground | `on-primary`           | `#FFFFFF` | Text on primary buttons        |
| Primary hover      | `primary-hover`        | `#183F36` | Active hover state             |
| Secondary          | `secondary`            | `#E7F1EC` | Selection, secondary buttons   |
| Gold accent        | `accent`               | `#A48642` | Rare non-text decoration       |
| Canvas             | `background`           | `#F7F6F2` | Application background         |
| Card               | `surface`              | `#FFFFFF` | Forms, tables, panels          |
| Text               | `foreground`           | `#202924` | Primary content                |
| Secondary text     | `foreground-secondary` | `#52615A` | Supporting metadata            |
| Muted text         | `foreground-muted`     | `#626F68` | Nonessential helper text       |
| Divider            | `border-decorative`    | `#DDE3DC` | Nonfunctional separators       |
| Input border       | `border-control`       | `#6E7B74` | Detectable functional edge     |

**Status colors are not brand colors.** Use explicit Spanish labels and icons, never color alone. `success`/`success-surface` for server-confirmed success; `warning`/`warning-surface` for pending review, location unavailable, or warnings; `danger`/`danger-surface` for rejected/invalid/annulled conditions **only where domain semantics warrant**; `info`/`info-surface` for neutral notices. Avoid treating all green records as independently verified physical presence.

Accepted attendance marks retain the existing informational blue treatment; acceptance, completeness and factual anomalies are separate dimensions. Neither acceptance nor browser GPS proves physical presence. Preserve the current palette: green/white contrast is approximately 7.84:1, deep-green/white 11.65:1, muted text/ivory 4.86:1. Gold/white is only 3.46:1 and remains decorative. Recheck actual rendered combinations rather than generalizing these ratios to all states.

**Dark theme.** Apply the `dark-*` color tokens when a `.dark` theme is explicitly active. Canvas `#101916`, cards `#17231F`, primary button `#2E7D69` with white text, main text `#EEF3F0`. Do not use fixed light palette utilities on dark surfaces; map components to semantic colors so both themes remain consistent. A visual-mode toggle is a UI feature, not required by this document alone.

**Accessibility.** Normal text contrast ≥4.5:1; large text ≥3:1 only at the applicable WCAG size/weight; interactive control boundaries and focus indicator contrast ≥3:1. Decorative Hairline is not sufficient as a control border. Focus: 2px visible ring with 2px offset (`focus` on light, `dark-focus` on dark, `focus-inverse` over deep-green inverse panels). These are design targets; rendered screens require separate accessibility checks. Never use gold for legibility-critical content.

## Typography

**Single web font:** Inter, with system-ui / Arial fallback. Do not request fonts from external CDNs at runtime; self-host only after approved asset/license acquisition. Use tabular numerals for hours, dates, counts, quantities, and reporting tables.

The current app declares Inter but does not bundle a font asset; the system fallback is intentional until acquisition is approved. Keep the existing type scale. Use one `h1` for a committed screen and subordinate section headings; compactness comes from grouping and alignment, not smaller critical text or touch targets.

| Role          | Token        | Size / weight | Usage                               |
| ------------- | ------------ | ------------- | ----------------------------------- |
| Caption       | `caption`    | 12px / 400    | Noncritical auxiliary labels only   |
| Small body    | `body-sm`    | 14px / 400    | Secondary data and explanations     |
| Body          | `body`       | 16px / 400    | Observer workflows, forms, prose    |
| Label         | `label`      | 14px / 500    | Inputs, controls, menus             |
| Subheading    | `subheading` | 18px / 500    | Card headings                       |
| Small heading | `heading-sm` | 20px / 600    | Sections                            |
| Page heading  | `heading`    | 24px / 600    | Main screen heading                 |
| Large heading | `heading-lg` | 30px / 600    | Rare top-level application headings |

Use 600 for headings and 700 only for exceptional metric emphasis. Keep operational status labels at least 14px; do not use 12px for critical actions or validation messages. Prefer sentence case, descriptive Spanish text, and readable line length. Do not force uppercase labels throughout the app.

## Layout

**System.** A responsive 4px base rhythm. Tailwind v4 uses `--spacing: 4px` as a multiplier; `p-4` means 16px. The YAML spacing tokens are _semantic documentation_, not instructions to declare a conflicting `--spacing-4` variable.

- **Mobile (OBSERVADOR):** one-column layout; prominent current assignment and attendance action; secondary information below. Minimum frequent touch target 44×44px, especially check-in/check-out and report submission. Respect device safe areas.
- **Desktop (ADMIN/ENLACE):** preserve the 248px sidebar token, top bar about 64px, content area maximum 1440px within the remaining width. Focused forms maximum 720px; authentication panels maximum 480px. Use 12-column layouts selectively; fewer columns where clearer.
- **Spacing:** 8px micro gaps, 16px field groups, 24px card padding on desktop (16px mobile), 32px section separation. Consistent vertical rhythm takes priority over strict grids.
- **Navigation:** show available routes according to effective permissions; server remains authoritative. Use a lightweight desktop sidebar, a restrained mobile navigation pattern, persistent page context and clear headings.
- **Data:** use explicit columns, aligned numbers, sticky headers only where helpful, compact administrative density and accessible table overflow on narrow screens. No invented KPIs, charts, maps, feeds or empty statistic cards.
- **Content context:** where applicable, show operative, assigned attention module, date and scope in readable text. Never substitute a decorative graphic for operational evidence.

**D2 shell composition.** Institutional-green navigation frames the light workspace; use existing primary/deep-green and inverse-focus tokens, with contrast-checked active/hover states. At widths below 1024px (including 320, 390 and 768px), navigation starts closed and opens on request; at 1280px it is a persistent desktop sidebar that can be hidden with an explicit control. Keep the reopen control reachable. Prefer the available native modal `dialog` for the mobile panel, not a new overlay dependency. Provide an accessible title, visible close control, Escape dismissal and inert background while open. Closing without navigation returns focus to the trigger; following a link closes the panel and lets committed-route focus take precedence. Crossing breakpoints must not leave focus hidden or the document inert. Do not persist sensitive navigation/session data or add global keyboard shortcuts.

Group existing destinations under Inicio, Mi asistencia, Operación, Control de asistencia and Administración, omitting unavailable/empty groups. Preserve existing role and permission conditions, including create-only access and Assignments' explicit-permission behavior without an extra role gate. Keep account identity, role, password change and logout reachable. Breadcrumbs reflect existing route hierarchy; link only accessible ancestors and do not fetch records solely for a decorative breadcrumb. Active destinations use `aria-current="page"` plus a non-color cue. Do not expose future modules.

**Page composition.** Align breadcrumbs/context, title/short description and the permitted primary action to the same content edges. Follow with filters or a record summary, then results/detail/form and pagination or outcome. On narrow screens stack actions and fields without changing DOM reading order. Use 16px mobile and 24px larger-screen outer padding, 16–24px internal gaps and 32px between major sections. Keep one main vertical page scroll; introduce local horizontal scrolling only for data that needs it. Retain `min-width: 0`/long-content wrapping protections; do not clip overflow to hide defects.

**Task-oriented home.** Replace the plain session link list with identity, role and grouped permitted destinations with short descriptions. Prioritize today's attendance and history for OBSERVADOR; organize operational areas for ADMIN/ENLACE. Show scope only when supplied by existing data. Preserve create-only links and provide an honest no-access state. Do not add metrics, pending-task counts or new API requests to decorate the home.

## Elevation & Depth

Use **tonal layering** instead of heavy shadows. Ivory canvas, white cards, muted inset panels, 1px decorative dividers. Cards generally have **no shadow**. Use a subtle shadow only for sticky navigation when it improves separation; dialogs/popovers may have a stronger shadow plus a readable backdrop. Never rely on shadow alone to express interactive focus or a selected state.

Semantic surfaces: page `background`, normal card `surface`, inset panel `surface-muted`, active/priority card `secondary`, occasional deep-green inverse panel `primary-hover`. In dark mode use the corresponding `dark-background`, `dark-surface`, and `dark-surface-elevated` tokens.

## Shapes

Rounded but restrained: `sm` 4px for tight controls, `md` 8px for buttons/inputs/selects, `lg` 12px for cards and dialogs, `full` for pills and initials avatars. Keep shape language consistent across modules. Avoid excessively rounded dashboard cards, inflated button sizes, and decorative asymmetry.

Iconography: consistent lightweight line icons (e.g., Lucide-style) with accessible labels for icon-only controls. Staff avatars use initials or a neutral icon, not invented portraits. Motion: brief 150–200ms transitions when useful, respect `prefers-reduced-motion`, never animate essential data or confirmation states.

## Components

All listed tokens in YAML are visual starting points; actual implementation should use **semantic shadcn/ui tokens**, not paste literal colors into each component. Override shadcn/Tailwind tokens centrally in `apps/web/src/styles/globals.css`; reuse `apps/web/src/components/ui/` and existing module components instead of duplicating CSS scopes. Do not create parallel implementations of equivalent components.

**Buttons.** Primary green with white text, minimum 44px height; only one dominant action per task area. Secondary green-tint with deep-green text. Ghost for lower-priority navigation. Destructive operations require a distinct danger treatment and explicit confirmation. In-progress submission preserves layout, disables duplicate action, and must not claim success until the server confirms it.

**Inputs and forms.** Labels remain visible above controls; input edge uses `border-control` (not hairline) and 8px radius. Provide text errors next to the affected field, a concise global summary when appropriate, and visible keyboard focus. React Hook Form + Zod are implementation choices, not tokens. Avoid placeholder-only labeling. Mask secrets and avoid revealing precise location in summaries.

Group related fields with headings or `fieldset`/`legend` as appropriate. Preserve existing schemas, help IDs, `aria-describedby`, `aria-invalid`, first-invalid focus and submitted values. Resource selectors retain search, native select, pagination, visible selection and permission handling; error association follows the search field while no select exists. Arrival of options must not steal focus. Keep one-off credentials and sensitive account outcomes in their existing protected lifecycle, not a reusable notification cache.

**Cards.** White, 12px radius, 1px decorative border, 24px desktop / 16px mobile padding, no default shadow. Current assignment/operative panels may use Green Tint. A dark-green context panel is rare and must keep proper inverse contrast.

**Tables and lists.** Clear column labels, 14–16px readable content, tabular numerals, restrained row dividers and visible empty/loading/error states. Filters and pagination remain accessible on narrow screens. Keep secondary metadata subordinate to main content. For histories, distinguish original and corrected versions without rewriting evidence.

Keep native tables with captions and correctly scoped row/column headers. Use a named, keyboard-focusable local overflow region when horizontal scrolling is needed; retain Q2A's minimum widths (Operatives 640px, Accounts 800px). Choose widths for other tables from real column content, not a universal minimum. Full names and identifiers remain selectable and wrap; short dates/statuses/actions remain readable without letter-by-letter wrapping. Do not hide columns or turn table cells into pseudo-labeled blocks that lose header relationships. Assignments and Administrative Attendance may retain their card lists with denser alignment. Filters and pagination must preserve existing URL state, validation, search behavior and return context; do not invent API sorting, counts or search capabilities.

**Status chips.** Rounded-full, ≥14px label text, semantic foreground/background pair. Distinguish automatically accepted, pending review, rejected, annulled, late, and location-unavailable states only according to actual API data. Color is never the only signal. A manually corrected mark requiring review must not be styled as approved prematurely.

**Dialogs and confirmations.** Clear title, consequences, actor-intent wording and separate cancel/confirm actions. Require reasons where existing backend contracts require reasons. Indicate version conflicts with a refresh-and-reconfirm workflow, not silent overwrites.

Existing business confirmations stay **inline**, not converted to dialogs for visual uniformity. Preserve frozen snapshots, preflight, expected versions, reasons, confirm/cancel behavior, focus restoration and uncertain-outcome recovery. Group the summary and consequences beside its controls. Native mobile navigation dialogs do not establish a requirement for modal business forms.

**Observer attendance view.** First screen shows today's operative/module, schedule, check-in/check-out states, and one next action. Present location permission requests in understandable Spanish and explain that missing GPS may still permit a capture pending administrative review. Keep request receipt/retry feedback precise: unknown network outcome is not successful or failed attendance. No display of fabricated device-confirmed time.

Order mobile content as date/context, current marks, available action, attempt feedback, then supporting evidence/history. Retain GPS requests only after user action, the existing 15s location/25s submission limits, and explicit retries of the same request/idempotency/evidence without a new GPS request. Do not remount capture state as a layout technique or hide uncertainty warnings behind a disclosure.

**Administrative attendance view.** Prioritize pending incidents, filters, authorized details, historical versions and explicit decisions. Show precise coordinates only in an authorized detail view when they are needed, not in list previews. Display pending correction separately from accepted history. Preserve reasons and audit context without overcrowding the main table.

**Loading and feedback.** Use compact skeletons only for information likely to resolve shortly, accessible live regions for important results, meaningful empty states, and a distinct session-expired state. Avoid toast-only reporting for important errors; keep critical state visible in the page.

Authentication uses the complete original logo and the compact auth width, without implementing a promotional split-screen. Keep mandatory and voluntary password-change behavior distinct, including mandatory access restrictions and the existing closure of all sessions. Preserve explicit verification/recovery actions for unknown login/logout outcomes; do not auto-resubmit credentials or mutations. Route-load failures keep navigation/logout available and explain any loss of in-memory capture attempts before a manual reload.

**Shared patterns, not a new library.** Reuse `Button`, `Input`, existing field components, `ResourcePicker`, attendance components and focus/error utilities first. Introduce shell/page headers in D2 and extract table, status, field-group or feedback presentation only with actual repeated consumers in D3. Prefer small composable presentation components; keep domain labels, authorization and mutation state in their feature modules. Avoid universal CRUD components, parallel providers, package migrations or dependencies solely for styling.

**Dark component variants.** Use YAML `dark-*` tokens as the equivalents of their light variants. Gold remains decorative in both modes. Confirm real contrast and focus visibility in actual browser rendering.

## Do's and Don'ts

**Do**

- Use the YAML front matter as the canonical machine-readable palette, type, spacing, radius and component tokens; the Markdown explains how to use them.
- Keep the app light, calm, responsive, accessible and focused on real user tasks.
- Follow the approved backend permissions and session lifecycle; client navigation is not authorization.
- Prefer semantic CSS variables and Tailwind/shadcn mappings in a single token source; keep `modules/` feature implementation organized without visual duplication.
- Preserve Spanish functional copy; use real dates, times, role names and server-confirmed statuses.
- Separate loading, uncertain-network outcome, pending review and successful capture.
- Include focus, keyboard, error, empty, disabled, mobile and reduced-motion states for relevant interactions.
- Preserve the Q1–Q2 accessibility fixes and F9 long-content protections while changing layout; do not trade them for visual density.
- Treat geolocation, personnel information and audit data as operationally sensitive; minimize their appearance on shared screens.
- Respect light and dark themes when the theme functionality is implemented; no runtime CDN font dependency.

**Don't**

- Don't present this document or its proposed color codes as official federal visual-identity standards.
- Don't insert unapproved emblems, logos, seals, patriotic clichés, stock personnel imagery or AI-generated evidentiary imagery.
- Don't use gold as normal-size text, status colors as the sole signal, or faint decorative borders for form controls.
- Don't add ornamental gradients, glass effects, oversized hero banners, gratuitous KPI cards or complex animations.
- Don't invent domain statuses, office isolation, operative closing APIs, GPS verification or offline capture.
- Don't use mock attendance or assistance reports as if they were actual production data.
- Don't expose precise GPS in table lists or cache sensitive form values beyond their operational need.
- Don't hardcode light colors into theme-aware components or create competing CSS theme definitions.

### Implementation mapping (developer notes, not an additional Stitch section)

This Markdown file is a design contract, not a request to install packages or rewrite the existing app. The current React + Vite+, React Router, SessionProvider, lazy administrative routes and identity-isolated TanStack Query architecture stay intact. `apps/web/src/styles/globals.css` owns **one** semantic `:root` / `.dark` layer and **one** `@theme inline` mapping. YAML `surface` maps to `--card`, `foreground-muted` to `--muted-foreground`, `danger` to `--destructive`, and decorative gold `accent` to `--decoration`; shadcn `--accent` remains interactive green selection. Keep existing colors, type, radii and layout tokens. The only D1 addition is `auth-max: 480px` → `--container-auth`, available as `max-w-auth` for D2; `sidebar: 248px` already maps to `--spacing-sidebar`. No new sidebar color family is necessary. Keep Tailwind's 4px spacing multiplier (`--spacing: 4px`) rather than overriding numeric utilities with separately named `--spacing-N` values. Only create component directories as real components are implemented.

**Accessibility integration.** Keep a single `main#main-content`, a working skip link and a scoped committed-route content region. Preserve `useRouteFocus` titles/heading-or-alert focus, voluntary-focus protection and the rule that query-only updates do not reset route focus. Keep confirmation-focus and invalid-field helpers connected to their actual controls; do not duplicate them in a shell provider. Visible focus must not be obscured by sticky UI. Native controls and links retain their semantics and accessible names. Verify keyboard operation and focus sequencing in the real browser, not just snapshots.

**Validation matrix.** At each affected increment, inspect 320/390/768/1280px with representative authorized roles and partial permissions, long names/identifiers, loading/empty/error states and relevant critical outcomes. Require no page-level horizontal overflow, no clipped essential content, readable local table scrolling and reachable 44px targets. Check text/control/focus contrast, reduced motion, labels, error associations, first-invalid focus, route/confirmation focus and session transitions. Use the installed Playwright CLI with synthetic isolated data; record visual evidence and limitations. Run focused tests, typecheck, lint, formatting and build in proportion to the change; do not rerun full backend integration for pure presentation changes. Reports document checks actually executed, not WCAG certification or deployment approval.

Stitch/design.md compatibility: YAML tokens at top; eight ordered `##` sections from Overview through Do's and Don'ts; additional project-specific guidance nested below them. The specification is evolving (`alpha`); lint with the official CLI when the repository setup permits. A valid token file does not establish runtime accessibility compliance.
