---
version: alpha
name: Heroínas y Héroes Paisanos — Operational Web Design System
description: Proposed, non-official institutional-inspired design language for the Guerrero operations web app.
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

> Status: **proposed product design**, not an officially approved INM or Government of Mexico branding manual. Official identity assets, marks, seals, typography requirements, and permitted uses must be confirmed with the relevant authorities before public release.

## Overview

**Brand and style.** A calm, trustworthy, welcoming public-service workspace with Mexican institutional inspiration: deep green for primary interactions, warm ivory backgrounds, restrained golden decoration, and clearly legible data. It is an **internal operational application**, not a promotional website or national platform. Avoid ornamental patriotic motifs, excessive cards, oversized hero sections, glassmorphism, and decorative dashboards.

**Audience.** Mobile-first **OBSERVADOR** users capture attendance while in the field. **ENLACE** and **ADMIN** users manage operational records and reviews on desktop and smaller screens. The current system is scoped to Guerrero; do not imply per-office access isolation that the backend does not implement.

**Design principles.** Task-first, restrained hierarchy, accurate operational status, accessible by default, resilient to slow networks, and respectful of sensitive personnel/location data. Interface labels, help text, and validation messages are in **Spanish**; this reference is in English for developers and design agents.

**Authority.** This file governs visual design, not backend policies or API behavior. Existing contracts, permission checks, versioned records, and approved domain rules take precedence. Use real data only; distinguish mock/demo data visibly.

## Colors

**Light theme — preferred default.** The main canvas is Warm Ivory (`#F7F6F2`), with white functional surfaces and Ink text. The primary brand/action color is Institutional Green (`#235B4E`); Deep Green (`#183F36`) is for hover and limited emphasis. Green Tint (`#E7F1EC`) marks selection and secondary actions. Heritage Gold (`#A48642`) is **decorative only**: no normal text, status labels, or functional indicators.

| Semantic role | Token | Value | Use |
| --- | --- | --- | --- |
| Primary | `primary` | `#235B4E` | Main action, selected emphasis |
| Primary foreground | `on-primary` | `#FFFFFF` | Text on primary buttons |
| Primary hover | `primary-hover` | `#183F36` | Active hover state |
| Secondary | `secondary` | `#E7F1EC` | Selection, secondary buttons |
| Gold accent | `accent` | `#A48642` | Rare non-text decoration |
| Canvas | `background` | `#F7F6F2` | Application background |
| Card | `surface` | `#FFFFFF` | Forms, tables, panels |
| Text | `foreground` | `#202924` | Primary content |
| Secondary text | `foreground-secondary` | `#52615A` | Supporting metadata |
| Muted text | `foreground-muted` | `#626F68` | Nonessential helper text |
| Divider | `border-decorative` | `#DDE3DC` | Nonfunctional separators |
| Input border | `border-control` | `#6E7B74` | Detectable functional edge |

**Status colors are not brand colors.** Use explicit Spanish labels and icons, never color alone. `success`/`success-surface` for server-confirmed success; `warning`/`warning-surface` for pending review, location unavailable, or warnings; `danger`/`danger-surface` for rejected/invalid/annulled conditions **only where domain semantics warrant**; `info`/`info-surface` for neutral notices. Avoid treating all green records as independently verified physical presence.

**Dark theme.** Apply the `dark-*` color tokens when a `.dark` theme is explicitly active. Canvas `#101916`, cards `#17231F`, primary button `#2E7D69` with white text, main text `#EEF3F0`. Do not use fixed light palette utilities on dark surfaces; map components to semantic colors so both themes remain consistent. A visual-mode toggle is a UI feature, not required by this document alone.

**Accessibility.** Normal text contrast ≥4.5:1; large text ≥3:1 only at the applicable WCAG size/weight; interactive control boundaries and focus indicator contrast ≥3:1. Decorative Hairline is not sufficient as a control border. Focus: 2px visible ring with 2px offset (`focus` on light, `dark-focus` on dark, `focus-inverse` over deep-green inverse panels). These are design targets; rendered screens require separate accessibility checks. Never use gold for legibility-critical content.

## Typography

**Single web font:** Inter, with system-ui / Arial fallback. Do not request fonts from external CDNs at runtime; self-host only after approved asset/license acquisition. Use tabular numerals for hours, dates, counts, quantities, and reporting tables.

| Role | Token | Size / weight | Usage |
| --- | --- | --- | --- |
| Caption | `caption` | 12px / 400 | Noncritical auxiliary labels only |
| Small body | `body-sm` | 14px / 400 | Secondary data and explanations |
| Body | `body` | 16px / 400 | Observer workflows, forms, prose |
| Label | `label` | 14px / 500 | Inputs, controls, menus |
| Subheading | `subheading` | 18px / 500 | Card headings |
| Small heading | `heading-sm` | 20px / 600 | Sections |
| Page heading | `heading` | 24px / 600 | Main screen heading |
| Large heading | `heading-lg` | 30px / 600 | Rare top-level application headings |

Use 600 for headings and 700 only for exceptional metric emphasis. Keep operational status labels at least 14px; do not use 12px for critical actions or validation messages. Prefer sentence case, descriptive Spanish text, and readable line length. Do not force uppercase labels throughout the app.

## Layout

**System.** A responsive 4px base rhythm. Tailwind v4 uses `--spacing: 4px` as a multiplier; `p-4` means 16px. The YAML spacing tokens are *semantic documentation*, not instructions to declare a conflicting `--spacing-4` variable.

- **Mobile (OBSERVADOR):** one-column layout; prominent current assignment and attendance action; secondary information below. Minimum frequent touch target 44×44px, especially check-in/check-out and report submission. Respect device safe areas.
- **Desktop (ADMIN/ENLACE):** sidebar up to 248px, top bar about 64px, content area maximum 1440px. Focused forms maximum 720px. Use 12-column layouts selectively; fewer columns where clearer.
- **Spacing:** 8px micro gaps, 16px field groups, 24px card padding on desktop (16px mobile), 32px section separation. Consistent vertical rhythm takes priority over strict grids.
- **Navigation:** show available routes according to effective permissions; server remains authoritative. Use a lightweight desktop sidebar, a restrained mobile navigation pattern, persistent page context and clear headings.
- **Data:** use explicit columns, aligned numbers, sticky headers only where helpful, compact administrative density and accessible table overflow on narrow screens. No invented KPIs, charts, maps, feeds or empty statistic cards.
- **Content context:** where applicable, show operative, assigned attention module, date and scope in readable text. Never substitute a decorative graphic for operational evidence.

## Elevation & Depth

Use **tonal layering** instead of heavy shadows. Ivory canvas, white cards, muted inset panels, 1px decorative dividers. Cards generally have **no shadow**. Use a subtle shadow only for sticky navigation when it improves separation; dialogs/popovers may have a stronger shadow plus a readable backdrop. Never rely on shadow alone to express interactive focus or a selected state.

Semantic surfaces: page `background`, normal card `surface`, inset panel `surface-muted`, active/priority card `secondary`, occasional deep-green inverse panel `primary-hover`. In dark mode use the corresponding `dark-background`, `dark-surface`, and `dark-surface-elevated` tokens.

## Shapes

Rounded but restrained: `sm` 4px for tight controls, `md` 8px for buttons/inputs/selects, `lg` 12px for cards and dialogs, `full` for pills and initials avatars. Keep shape language consistent across modules. Avoid excessively rounded dashboard cards, inflated button sizes, and decorative asymmetry.

Iconography: consistent lightweight line icons (e.g., Lucide-style) with accessible labels for icon-only controls. Staff avatars use initials or a neutral icon, not invented portraits. Motion: brief 150–200ms transitions when useful, respect `prefers-reduced-motion`, never animate essential data or confirmation states.

## Components

All listed tokens in YAML are visual starting points; actual implementation should use **semantic shadcn/ui tokens**, not paste literal colors into each component. Override shadcn/Tailwind tokens centrally; reuse `packages/ui` and existing styles instead of duplicating CSS scopes. Do not create parallel implementations of equivalent components.

**Buttons.** Primary green with white text, minimum 44px height; only one dominant action per task area. Secondary green-tint with deep-green text. Ghost for lower-priority navigation. Destructive operations require a distinct danger treatment and explicit confirmation. In-progress submission preserves layout, disables duplicate action, and must not claim success until the server confirms it.

**Inputs and forms.** Labels remain visible above controls; input edge uses `border-control` (not hairline) and 8px radius. Provide text errors next to the affected field, a concise global summary when appropriate, and visible keyboard focus. React Hook Form + Zod are implementation choices, not tokens. Avoid placeholder-only labeling. Mask secrets and avoid revealing precise location in summaries.

**Cards.** White, 12px radius, 1px decorative border, 24px desktop / 16px mobile padding, no default shadow. Current assignment/operative panels may use Green Tint. A dark-green context panel is rare and must keep proper inverse contrast.

**Tables and lists.** Clear column labels, 14–16px readable content, tabular numerals, restrained row dividers and visible empty/loading/error states. Filters and pagination remain accessible on narrow screens. Keep secondary metadata subordinate to main content. For histories, distinguish original and corrected versions without rewriting evidence.

**Status chips.** Rounded-full, ≥14px label text, semantic foreground/background pair. Distinguish automatically accepted, pending review, rejected, annulled, late, and location-unavailable states only according to actual API data. Color is never the only signal. A manually corrected mark requiring review must not be styled as approved prematurely.

**Dialogs and confirmations.** Clear title, consequences, actor-intent wording and separate cancel/confirm actions. Require reasons where existing backend contracts require reasons. Indicate version conflicts with a refresh-and-reconfirm workflow, not silent overwrites.

**Observer attendance view.** First screen shows today's operative/module, schedule, check-in/check-out states, and one next action. Present location permission requests in understandable Spanish and explain that missing GPS may still permit a capture pending administrative review. Keep request receipt/retry feedback precise: unknown network outcome is not successful or failed attendance. No display of fabricated device-confirmed time.

**Administrative attendance view.** Prioritize pending incidents, filters, authorized details, historical versions and explicit decisions. Show precise coordinates only in an authorized detail view when they are needed, not in list previews. Display pending correction separately from accepted history. Preserve reasons and audit context without overcrowding the main table.

**Loading and feedback.** Use compact skeletons only for information likely to resolve shortly, accessible live regions for important results, meaningful empty states, and a distinct session-expired state. Avoid toast-only reporting for important errors; keep critical state visible in the page.

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

This Markdown file is a design contract, not a request to install packages or rewrite the existing app. In **F1A**, inspect the actual Tailwind v4 / `packages/ui` setup, then map design values into **one** semantic `:root` / `.dark` layer and **one** `@theme inline` mapping as appropriate. Keep Tailwind's 4px spacing multiplier (`--spacing: 4px`) rather than overriding numeric utilities with separately named `--spacing-N` values. Token names in the YAML use hyphens for portability; CSS variables may use the project's current naming scheme provided the semantic mapping is traceable. Only create component directories as real components are implemented.

Stitch/design.md compatibility: YAML tokens at top; eight ordered `##` sections from Overview through Do's and Don'ts; additional project-specific guidance nested below them. The specification is evolving (`alpha`); lint with the official CLI when the repository setup permits. A valid token file does not establish runtime accessibility compliance.
