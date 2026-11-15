# F4C — Administrative Observer Management validation

## Base and scope

PR #26 was confirmed merged into `dev`; fetched `origin/dev` and the clean primary
worktree were at `03e2e49`. Implementation uses the dedicated
`feat/administrative-observers` branch/worktree. No backend, migrations, dependencies,
account/link/assignment operations or administrative Attendance screens were changed.

## Actual API contracts

| Endpoint | Input | Response | Permission |
| --- | --- | --- | --- |
| `GET /api/observers` | Optional `search`, `active`, `linked`, `page`, `pageSize` | `{ items, page, pageSize, total }` | `observers:read` |
| `POST /api/observers` | `firstNames`, `lastNames`, nullable `phone` | 201 profile, active and accountless | `observers:create` |
| `GET /api/observers/:id` | UUIDv7 | Profile or 404 | `observers:read` |
| `PATCH /api/observers/:id` | Changed names and/or nullable phone, required `reason` | 204 | `observers:update` |
| `PATCH /api/observers/:id/status` | Boolean `active`, required `reason` | 204 | `observers:change-status` |

Profiles expose `id`, `firstNames`, `lastNames`, `phone`, `active`, `userId`,
`createdAt`, `updatedAt`. The API returns UTC MySQL timestamps such as
`2026-11-15 04:14:29.648238`, not ISO strings. The web preserves microseconds and
converts only the semantic HTML `time` attribute to ISO UTC.

Both active→inactive and inactive→active require their exact permission and an
explicit confirmation with reason. Neither changes accounts, sessions or assignments.
Edits preflight the original snapshot; status preflights before review and submission.
All writes use the existing same-origin HttpOnly/CSRF transport, `retry: false` and
query invalidation without optimistic state changes.

## Automated checks

- Web Vitest/React Testing Library: **250/250 passing**, 11 files; **50 observer tests**.
- Observer coverage: list/detail, filters, URL bounds and preservation, pagination,
  creation/editing, nullable phone, Unicode/whitespace limits, exact permissions,
  both transitions, required reasons and cancel, 400/403/404/409, network/5xx,
  malformed creation state, stale snapshots, failed preflights, committed edits with
  lost responses, query invalidation, loading/empty/error/retry.
- Existing session navigation test updated because Observers is no longer “Próximamente”.
- Web typecheck, repository lint, API build and web production build passed.
- Changed-file formatting and whitespace checks passed.
- Production build emits the >500 kB chunk advisory; no bundle optimization was
  attempted, as explicitly excluded from F4C.

Commands:

```powershell
pnpm --filter @hhpaisanos/web test
pnpm --filter @hhpaisanos/web typecheck
pnpm lint
pnpm --filter @hhpaisanos/api build
pnpm --filter @hhpaisanos/web build
pnpm exec vp fmt --check README.md docs/F4C_OBSERVERS_VALIDATION.md apps/web/src/modules/observers apps/web/src/app/routes.tsx apps/web/src/modules/auth/pages/SessionHomePage.tsx apps/web/src/modules/auth/auth.test.tsx
git diff --check
```

## Real-browser checks

Installed project Playwright CLI 0.1.24, Chrome, real NestJS AppModule on
`localhost:3000`, Vite+ on `localhost:5173`, existing MySQL 8.4 container. A random
`hhpaisanos_test_*` database and `hhp_test_*` SQL user held only synthetic fixtures;
all migrations ran only there. The shared development database was not modified.
The disposable database/user were removed and the task's API/web servers stopped
after validation. The primary `dev` worktree remained clean.

Passed browser checks:

1. Login with HttpOnly cookie; administrative navigation; listing 22 synthetic profiles,
   next page, literal-name search/URL updates, active/linked filters and empty results.
2. Required creation fields; actual POST, detail, personal edit and phone clearing.
3. Activation/deactivation with reasons, review and confirmation; refreshed detail.
4. Concurrent real API profile edit between review and final confirmation: stale
   snapshot detected, status write blocked, current profile retained.
5. Status PATCH committed by the real API, then its response deliberately aborted:
   uncertain notice, authoritative refreshed state, exactly one write and no retry.
6. 390px list/detail screenshots and document-width assertions: no page overflow;
   table scroll remains within its container.
7. Actual read-permission revocation/restoration: ADMIN denied without its grant,
   then allowed after restoration.

No mocked API responses were used. The response-loss check forwarded the PATCH to
NestJS before dropping its response. Local browser scripts/screenshots remain in
ignored `.playwright-cli/` output, not in Git.

## Independent review

One independent reviewer found **no material correctness/security findings**. Two
low-severity messaging observations were addressed: unexpected creation state now
has a dedicated verification notice, and failed final preflight reads explicitly
say that no change was sent. Focused tests cover both paths. Real-browser validation
also identified the MySQL timestamp contract mismatch; schemas and fixtures were
corrected and the complete browser flow and web suite passed afterward.

## Remaining boundaries / prerequisites for F5

- Obtain F5's approved scope; this change does not define or begin it.
- Real accounts require explicitly provisioned permissions. No provisioning or shared
  database migration ran here. Any pending shared-schema upgrades need separate
  authorization before using APIs that depend on them.
- Accounts, supervised account links and historical operative assignments remain
  separate workflows. A profile or linked account ID alone proves neither capture
  eligibility nor identity verification; future work must use the relevant APIs/rules.
- Profile names/phones are not unique. Creation has no idempotency key and updates
  accept no version precondition. Fresh reads reduce stale writes, but the final
  GET/PATCH race and duplicate creation after an uncertain response remain backend
  limitations. No endpoint or concurrency guarantee was invented to hide them.
