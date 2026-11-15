# F5 — Administrative accounts and observer linking validation

## Base and boundaries

PR #27 was verified merged into `dev` before starting. The primary worktree was
clean; `origin/dev` was fetched and primary `dev` fast-forwarded to `2a14268`.
Implementation uses the dedicated `feat/administrative-users` worktree/branch.
Only frontend and documentation changed; no API, migrations, dependencies, shared
database provisioning, assignments or administrative Attendance UI changed.

## Implemented contracts and permissions

| Operation | Existing endpoint | Required permission |
| --- | --- | --- |
| Account listing | `GET /api/users` | ADMIN + `users:read` |
| Account detail | `GET /api/users/:id` | ADMIN + `users:read` |
| Account creation | `POST /api/users` | ADMIN + `users:create` |
| Initial role catalog | `GET /api/roles` | ADMIN + `roles:read` |
| Full-name edit | `PATCH /api/users/:id` | ADMIN + `users:update` |
| Activation/deactivation | `PATCH /api/users/:id/status` | ADMIN + `users:change-status` |
| Profile selection/current relationships | `GET /api/observers`, `GET /api/observers/:id` | `observers:read` |
| Eligible account lookup | `GET /api/observers/linkable-account?username=...` | `observers:link-account` |
| Supervised linking | `PUT /api/observers/:id/account` | `observers:link-account` |

Account list filters: `search` (literal username/full-name substring, 150 Unicode
code points), `active`, `roleId` (UUIDv7), `page` (1–1,000,000), `pageSize` (1–100).
nuqs preserves filters/pagination on detail/return links; invalid filters issue no
request. Listing uses backend creation-time/ID ascending order. Responses validate
and strip fields with Zod, preserving MySQL UTC timestamp microseconds.

Creation sends only `{ username, fullName, roleId }`; names/usernames retain exact
spelling/whitespace. The UI intentionally requires the authorized read-only role
catalog as well as create permission, rather than hardcoding role IDs or allowing
blind role assignment. Only active ENLACE/OBSERVADOR initial roles are selectable.
The generated temporary password is masked by default, explicitly revealable for
authorized delivery, and discarded on hide/navigation/logout. It is component-local,
never in Query caches, mutations, browser storage or logs. A lost creation response
blocks resubmission; the operator must inspect current accounts and use the approved
external credential-recovery process if necessary. No reset UI is included.

Edits/status require a reason, fresh snapshot reads and explicit confirmation. The
UI protects ADMIN and unknown account roles. Profile/link state is independent of
account state; deactivation revokes account sessions, reactivation restores none.

Linking reuses existing observer profiles and their active/linked filters, not a
second observer domain. The UI workflow needs both profile read and link permission;
a link-only session cannot inspect/select profiles. ENLACE uses only authorized
observer endpoints, never Users/catalogs. No role-name permission bypass exists.

Lookup preserves the byte-exact username, including spaces, case and accents. The
operator must attest to approved identity verification, witnessing an independent
definitive sign-in, and checking the exact pairing; matching names are not evidence.
Required reasons must omit credentials/documents/unnecessary personal information.
PUT sends `{ userId, verificationMethod: "supervised_administrative", reason }`.
Account/profile are reread before review and again before final PUT. The backend
enforces eligibility, unique relationships, transactional authority, session
revocation and evidence; the UI does not certify legacy relationships or consent.

All writes retain HttpOnly sessions and existing CSRF transport. No optimistic
updates or automatic retries. Rejected 4xx, stale/failed preflight and uncertain
network/5xx results are distinguished; refreshed relationships do not turn an
uncertain request into a claimed success. Confirmed/uncertain writes invalidate
affected account/profile queries in the existing identity-isolated Query client.

## Automated validation

- Web Vitest/React Testing Library: **301/301 passing**, 13 files; **51 F5 tests**.
- Coverage: supported list/detail/creation/name/status operations, exact payloads,
  Unicode/whitespace, one-time credentials, catalog restrictions, ADMIN protection,
  role plus explicit grants, individual action grants, denied routes, linking
  attestation/reason/confirmation/cancel, unavailable/inactive/already-linked states,
  400/403/404/409/429, stale snapshots, failed preflight, lost responses/5xx,
  no duplicate writes, both-domain invalidation, late completion after logout,
  loading/empty/error lists and existing identity-isolation regression coverage.
- Workspace typecheck, lint, API/web builds and changed-file formatting checks pass.
- Web build retains the >500 kB chunk advisory. Bundle optimization is excluded.

Commands:

```powershell
pnpm --filter @hhpaisanos/web test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec vp fmt --check README.md docs/F5_USERS_LINKING_VALIDATION.md apps/web/src/modules/users apps/web/src/modules/observers/account-linking.test.tsx apps/web/src/modules/observers/api/account-linking.ts apps/web/src/modules/observers/components/LinkObserverAccount.tsx apps/web/src/modules/observers/pages/ObserverDetailPage.tsx apps/web/src/modules/observers/observers.test.tsx apps/web/src/app/routes.tsx apps/web/src/modules/auth/pages/SessionHomePage.tsx apps/web/src/modules/auth/auth.test.tsx
git diff --check
```

## Real-browser validation

Project Playwright CLI 0.1.24 with installed headless Chrome, Vite+ on localhost:5173,
real Nest AppModule on localhost:3000 and existing MySQL 8.4 container. A random
`hhpaisanos_test_*` database and `hhp_test_*` MySQL account contained only synthetic
fixtures, roles and permission grants. Existing migrations ran only in that new
database. No shared development account or persistent shared table was modified.

Passed checks:

1. Account list, search/URL filters, pagination and empty state; creation using the
   existing POST; masked one-time credential and explicit dismissal.
2. Newly created account signed in independently, completed the mandatory password
   change, then signed in with definitive credentials in an isolated browser context.
3. Real full-name edit, deactivation and reactivation with reasons/confirmation and
   authoritative refreshed detail.
4. ADMIN and ENLACE linked eligible accounts using supervised confirmation. ENLACE
   had no Users navigation/detail links; direct `/cuentas` was blocked and the real
   Users API returned 403.
5. Temporary-password, inactive, locked, already-linked and absent accounts shared
   the same unavailable lookup. Inactive and legacy-linked profiles had no new-link
   or replacement controls.
6. A real concurrent profile edit after review blocked final submission. A separate
   link committed after the final preflight but before PUT yielded a real 409;
   the competing relationship remained intact and no retry occurred.
7. A PUT was forwarded to Nest and committed, then only its response was aborted:
   uncertain notice, authoritative relationship refresh, one PUT, no false success.
8. Linking revoked a pre-existing definitive target-account session; its next real
   `GET /api/auth/me` returned 401.
9. 390px list, empty, creation, relationship and confirmation layouts had no page
   overflow; table scroll remained local. Screenshots were visually inspected.
   Browser localStorage/sessionStorage stayed empty.

No API responses were mocked. Browser scripts/screenshots remain ignored under
`.playwright-cli/`; generated temporary credentials were not printed or saved.
The named browser context was closed; disposable database/account and task servers
were cleaned up after validation.

## Independent review

One independent reviewer found **no material correctness/security issues**. It
verified actual controllers/services/DTOs, no forbidden endpoints, permission gates,
credential/cache isolation, confirmation, freshness checks and query invalidation.
Low-severity observations: intentional `roles:read` dependency is documented and
missing route/individual-action permission tests were added. Conservative generic
failed-account-preflight messages and persistent uncertainty notices remain truthful
by design; neither permits a blind retry nor claims unconfirmed success.

## Unsupported operations and residual limitations

- No unlink/replacement endpoint. No mutation of existing or legacy relationships,
  nor UI certification of their linking evidence. Evidence is not in the read API.
- No password reset, role editing, permission editing, ADMIN mutation or account
  deletion UI. The existing reset/role-change endpoints are deliberately unused by F5.
- Accounts expose active/mandatory-change/last-login information, not current login
  lockouts, role activity, sessions or observer IDs. Relations are read from existing
  observer endpoints; no inverse relationship filter/endpoint is invented.
- Creation is not idempotent; unique username prevents duplicates but cannot recover
  a lost temporary credential. Its approved out-of-UI recovery remains necessary.
- No version preconditions for account PATCH or profile linking: preflight reduces
  stale decisions but cannot remove the last-read/write race. Backend transactional
  rules remain authoritative. Supervised attestation is not cryptographic consent.
- No assignment or administrative Attendance screens; no office isolation.

## Prerequisites for F6

F6 is not started. Merge/review F5 separately, agree F6's functional scope and
acceptance criteria, and inspect its actual contracts/permissions. Environments need
the existing migrated schema and explicitly authorized permission provisioning;
F5 performed none against shared data. Maintain an approved identity-accreditation
and one-time credential delivery/recovery procedure. Continue using isolated synthetic
validation. Account activation/linking alone establishes neither an assignment nor
personal Attendance eligibility.
