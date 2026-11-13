# Heroínas y Héroes Paisanos — Functional Requirements

**Status:** Draft v0.1 — Pending functional validation  
**Initial scope:** INM Representation Office in Guerrero  
**Purpose:** Define the functional behavior and business rules of the operational management system.

## 1. Purpose

The system supports the organization, execution, monitoring, and reporting of Heroínas y Héroes Paisanos operations.

It will replace fragmented manual records with consistent information about operatives, observers, attention modules, assignments, attendance, attention reports, and operational oversight.

## 2. Users and responsibilities

### Administrator (ADMIN)

Manages system access and administrative configuration within the authorized scope.

### Program Coordinator (ENLACE)

Manages operational information, observers, assignments, attendance reviews, attention reports, and operational oversight within the authorized scope.

Multiple users may have this role.

### Observer (OBSERVADOR)

Consults assigned shifts and, when remote capture is authorized, registers personal attendance and attention reports.

An observer may exist without an account when operational information is entered manually by authorized staff.

**Authorization rule:** Access is determined by the authenticated user's role, permissions, and ownership of the requested information. The frontend must never be the sole authorization mechanism.

## 3. Operatives

The system must support:

- Creating and managing operational periods.
- Defining each operative's name, start date, and end date.
- Managing an operative lifecycle: draft, active, and closed.
- Associating observer assignments with an operative.
- Preventing assignments outside the operative's date range.
- Preserving historical operational information.

Confirmed initial backend scope:

- Create, list, and retrieve operatives across the Guerrero scope.
- Creation accepts only name, start date, and end date; the initial status is always `borrador`.
- Dates are real civil calendar dates with start date less than or equal to end date. Overlapping operative intervals are allowed.
- Trim leading/trailing name whitespace, preserving casing, accents and internal whitespace. Equivalent names under the existing database column collation and identical start/end dates are duplicates.
- Require `operatives:read` for listing/details and `operatives:create` for creation, without role-name bypasses. The approved grants are ADMIN and ENLACE: both; OBSERVADOR: neither. Explicit centralized permission provisioning belongs to the Users module.
- Creation and its administrative audit event commit atomically.
- Editing, closing, reopening and deletion are not exposed. Modification and reopening policies remain pending.

Confirmed minimal Operative Activation scope:

- `POST /api/operatives/:id/activate` transitions only `borrador` to `activo`. Require explicit `operatives:activate`, granted to ADMIN and ENLACE only through centralized provisioning, without role-name bypasses.
- Accept only a nonblank administrative `reason` of at most 500 Unicode code points and explicit integer `arrivalToleranceMinutes`. The initial operational value is 15 minutes; configuration uses the existing unsigned SMALLINT range (0–65535), with no implicit default.
- Validate the operative interval and reject periods ending before today in `America/Mexico_City`. Future periods and periods ending today may be activated. Evaluate today after transactional locks.
- Revalidate actor/session/permission in the transaction, lock the operative and atomically commit activation, tolerance and `operatives.activated` audit. Preserve assignments, historical data and unrelated settings.
- Repeated or incompatible transitions return 409 without writes. Tolerance is immutable after activation through the API. No Attendance schema, capture, closure or reopening is introduced.

## 4. Attention modules

The system must support:

- Registering and maintaining attention modules.
- Associating modules with municipalities.
- Activating and deactivating modules without deleting history.
- Reusing modules in different operatives.
- Assigning observers to modules for specific shifts.

Coordinates and location-verification settings remain optional until their operational requirements and authorization are confirmed.

Confirmed initial Attention Modules backend scope:

- Create, list, retrieve, edit and activate/deactivate modules within the existing Guerrero-wide scope.
- Creation accepts only name and municipality and creates an active module. Trim surrounding whitespace, preserving casing, accents and internal spaces. Names and municipalities are required, with maximum lengths of 120 and 100 respectively. No business-key uniqueness restriction is introduced.
- List by literal name substring, municipality equality using the database collation, and active flag; paginate with `page` and `limit` (defaults 1 and 20, maximum limit 100), ordered by creation time and UUID descending. Without an active filter, include both states.
- Only name and municipality are editable, and effective changes are rejected whenever any assignment exists, including cancelled assignments. Repeated requests without effective changes are no-ops. Corrections and status changes require a nonblank reason of at most 500 characters.
- Activation/deactivation changes only the module's active flag. It never modifies or cancels assignments. No deletion endpoint is exposed, and existing relationships/history are preserved.
- Require `attention-modules:read`, `attention-modules:create`, `attention-modules:update`, and `attention-modules:change-status` for their respective operations, without role-name bypasses. The approved grants are ADMIN and ENLACE: all four; OBSERVADOR: none. These permissions belong to the explicit centralized provisioning catalog.
- Mutations revalidate the actor and permissions under transactional locks. Module changes and administrative audit events commit atomically; no-op requests generate no events.
- Coordinates and validation radius are neither accepted nor exposed by this API. Existing geographic values remain untouched by administrative edits.

## 5. Observers and accounts

The system must support:

- Registering observer profiles independently of login accounts.
- Activating and deactivating observer profiles.
- Creating accounts for observers who require remote access.
- Associating an observer profile with at most one account.
- Managing accounts and access permissions through authorized personnel.
- Preserving the relationship between recorded actions and their responsible users.

Account reassignment and unlinking policies remain pending.

Confirmed initial Observers backend scope:

- Create, list, retrieve, edit, activate and deactivate observer profiles across Guerrero.
- Profiles are created active and without an account. Editable fields are first names, last names and optional phone; explicit null clears the phone. Preserve supplied spelling and whitespace; names and non-null phones must not be blank. Names allow at most 100 Unicode code points each and phones 20.
- Profile edits require at least one editable field and a nonblank reason (up to 500 code points). Status changes require a boolean and the same reason contract. Identical updates are no-ops without audit events.
- Profile activation/deactivation never modifies the linked account, its sessions or historical relationships. No physical deletion is exposed.
- Require explicit `observers:read`, `observers:create`, `observers:update` and `observers:change-status` permissions, without role-name bypasses. Approved grants: ADMIN and ENLACE receive all four; OBSERVADOR receives none. These permissions belong to the explicit centralized provisioning catalog.
- Mutations revalidate current authority transactionally and commit atomically with audit. Personal edits audit changed field names rather than copies of names or phones.
- Account linking follows the approved scope below. Unlinking, reassignment and self-service remain deferred; assignment workflows belong to Assignments.

Confirmed Observer Account Linking scope:

- ADMIN and ENLACE receive the explicit `observers:link-account` permission through centralized provisioning. OBSERVADOR receives none. This does not grant ENLACE Users administration access or introduce role-name bypasses.
- `GET /api/observers/linkable-account` accepts an exact username and exposes only an eligible account's ID, username and full name. Ineligible and absent accounts return the same not-found response. It is not a general Users directory.
- `PUT /api/observers/:id/account` accepts an existing account UUIDv7, `verificationMethod: supervised_administrative`, and a nonblank reason of at most 500 Unicode code points.
- The responsible operator must verify the person's identity under institutionally approved procedures, witness independent sign-in with definitive credentials, and confirm the exact account/profile pairing. The method is an operator attestation, not cryptographic proof of consent. Names, phones and UUIDs are not identity evidence. Never request passwords or store identity-document copies.
- New links require an active account with an active OBSERVADOR role, no mandatory password change or current login lockout, no linked profile, and an active accountless observer profile. An active assignment is not required.
- Mutations revalidate actor authority and eligibility within a transaction, locking the target account before the profile. Linking, revocation of the target account's existing sessions and `observers.account.linked` audit commit atomically. No account credentials, role, status or assignment is changed.
- Conflicting links are rejected, never replaced. Identical links with an existing audit event for that exact pair and verification method are idempotent without further events or session revocation. Legacy links without this evidence are preserved but rejected for certification; regularization requires a separate approved process.
- Future personal capture must resolve the observer from the authenticated user and verify the current pair's linking evidence, profile status, permissions and assignment ownership transactionally. Linking alone enables no capture or historical reattribution. Telegram linking remains separate and deferred.

## 6. Assignments

Each assignment identifies:

- An operative.
- An observer.
- An attention module.
- An inclusive validity period within the operative's dates.
- Daily scheduled start and end times, normally 09:00–17:00 but configurable.

Business rules:

- Assignments are persistent periods, never generated separately for each day. Scheduled hours start and end within the same civil day.
- An observer may have at most one applicable non-cancelled assignment on any calendar date across all operatives and modules, regardless of hours.
- Validity does not establish attendance obligations for every calendar date. Weekends, holidays, rest days and daily attendance enforcement are not implemented without approved requirements.
- Create assignments in draft or active operatives, referencing active observer profiles and active attention modules. Scheduling does not activate an operative or authorize attendance capture.
- The initial API accepts explicit validity dates, including historical creation within an operative; changes to existing conditions are prospective only. No operative lifecycle management is added.
- Module/schedule changes take effect on a future civil date D. Preserve the original conditions through D−1 and create a new period from D through the previous end. Operative and observer remain fixed. Replacing a whole future period cancels its previous programming and inserts a new period.
- A change affects only the specified period, never unrelated future periods. No intraday changes, automatic extensions or retroactive rewriting are exposed.
- Only programming whose first validity date is later than today may be cancelled completely. Started assignments use early termination, retaining at least all dates through today. The last valid date is inclusive and cannot extend the existing interval.
- Cancelled and terminated periods remain available for history. No deletion or reactivation is exposed. Cancelled periods do not reserve dates; elapsed non-cancelled periods still do.
- Civil-date decisions use `America/Mexico_City`; recorded instants remain UTC.
- Require nonblank reasons up to 500 Unicode code points for change, termination and cancellation. Require the current positive integer `expectedVersion`; increment on effective modification and reject stale versions with 409. No-ops change neither version/timestamps nor audit.
- Require explicit `assignments:read`, `assignments:create`, `assignments:update` (change/termination) and `assignments:cancel`. ADMIN and ENLACE receive all four through centralized provisioning; OBSERVADOR receives none pending verified account/profile linking and ownership rules.
- Revalidate mutation authority under transactional locks. Serialize scheduling through the observer row and atomically commit period changes/replacements with meaningful audit events.
- Attendance references the precise historical assignment period and an explicit civil date. Capture and scheduling coordinate observer/assignment locks. Never shorten, cancel or split a period past associated attendance (including superseded, rejected or annulled versions), or transfer history. A pending technical receipt is not attendance. Attention report persistence remains deferred.

## 7. Attendance

The system must support:

- Recording an entry for an assigned shift.
- Recording an exit for an assigned shift.
- Identifying the capture channel.
- Identifying the responsible user.
- Recording the relevant time of the attendance event.
- Detecting duplicate submissions.
- Supporting authorized manual capture.
- Supporting review and correction while preserving history.
- Calculating attendance status from the relevant records and shift configuration.

Daily attendance will reference a persistent assignment and an explicit attendance date; actual entry/exit instants are separate from scheduled hours. Assignment validity alone does not determine whether attendance was required that day or authorize capture. Working-day rules, capture policies and identity linking remain separate decisions.

### Approved persistence contract (Stage 2)

- Personal capture requires an active operative, explicit `attendance:capture-own`, an OBSERVADOR account and a server-resolved active observer with supervised administrative `observers.account.linked` audit evidence, an active module and an applicable historical assignment. ADMIN has no implicit observer grants.
- Future attendance RBAC: OBSERVADOR `attendance:read-own`, `attendance:capture-own`; ADMIN/ENLACE `attendance:read`, `attendance:capture-manual`, `attendance:review`, `attendance:correct`, `attendance:annul`. Correction and review are separate permissions. Stage 2 does not provision these grants.
- Use UTC instants and the civil date in `America/Mexico_City`. Capture `Date.now()` once before asynchronous authentication waits at the API boundary; persist only after authentication and input validation. Store actual measured milliseconds in DATETIME(6), padded with zeroes. Preserve all six supplied fractional digits when comparing instants; never manufacture measured microseconds.
- Commit a minimal technical receipt before the attendance business transaction. Scope the exact idempotency key by authenticated user and operation, not session. Concurrent same-key requests establish one immutable original timestamp and validated normalized content, not necessarily the earliest network arrival. Different valid content conflicts. Recovery starts after the receipt COMMIT; no guarantee exists before it, and `creado_en` is a storage timestamp, not commit or receipt time.
- The second transaction revalidates current authorization and eligibility under compatible resource locks. Attendance, audit and terminal receipt result commit atomically. Technical failure leaves the durable receipt pending; retry uses its original timestamp/content. Definitive business rejection can commit a terminal rejection without attendance. Authorized terminal replay returns the stored minimal result without a new mark or audit. No processing leases or background queue are required.
- Bind the expected daily-context date into original content. Pending prior-day personal requests and requests crossing local midnight while processing are rejected under locks immediately before insertion. No silent date shift or guarantee that physical COMMIT precedes midnight. Completed replay after midnight creates nothing.
- Personal marks with satisfied policy are `accepted_automatic`, meaning policy satisfaction, not verified physical presence. Late arrival, early departure and missing location can coexist and cause `pending_review`. Arrival tolerance is explicitly configured on the operative, initially 15 minutes, immutable after activation through the API; the threshold is inclusive. Early departure means before scheduled end. Store policy version; distinguish completeness, review status and calculated flags without daily summary/anomaly tables.
- Future entry/exit UI must request GPS, but failure does not block a valid mark. Persist finite paired latitude/longitude and nonnegative accuracy, or one controlled missing-location reason: `permission_denied`, `position_unavailable`, `timeout`, `unsupported`, `insecure_context`, `unexpected_error`. Protect precise GPS from logs, audit and responses. Selfie is optional, and its absence is not an incident; no selfie storage in Stage 2.
- States are `accepted_automatic`, `pending_review`, `accepted_administrative`, `rejected`, `annulled`. Corrections create a version with reason and predecessor, pending until an explicit administrative decision. Reviews preserve original evidence/event time. Authorized manual historical capture requires reason, audit and a valid assignment/date, including a closed operative without reopening it. Stage 2 models this provenance and decision evidence; it does not implement manual/review/correction/annulment workflows.
- There is no destructive receipt TTL/cleanup without an approved retention policy. No automatic absences, daily assignments, public capture/administrative Attendance endpoints, frontend, Telegram, offline, operative closure or generic event infrastructure in Stage 2.

### Personal capture and own reads (Stage 3)

- Expose `POST /api/attendance/me/check-in`, `POST /api/attendance/me/check-out`, `GET /api/attendance/me/today` and `GET /api/attendance/me` only. Reuse the Stage 2 durable receipts, server timestamps, classification, locks and atomic auditing. No new migration is required.
- Require explicit `attendance:capture-own` or `attendance:read-own`, granted to OBSERVADOR only. Require a current active OBSERVADOR account, server-resolved active profile and supervised account-link evidence. Revalidate transactionally; never accept client actor/observer identity or acceptance status. Terminal replay also requires an active accredited profile, but never reclassifies past policy.
- POST bodies contain only applicable `assignmentId`, daily-context `expectedDate` and the approved location union; require an exact `Idempotency-Key` scoped by authenticated user and operation. Ordering requires a usable current entry before exit, with exit strictly later than its official timestamp; a rejected/annulled entry cannot authorize exit. Duplicate initial marks never create corrections. Functional ordering rejections are durable terminal receipt results.
- Own reads expose current mark versions, structural completeness separately from review status, stored policy anomalies, official timestamps, schedules and location-evidence status without raw GPS or receipt content. History is bounded and paginated by marked assignment/civil-date groups; no automatic absences or daily-summary persistence. History remains available after operative/module changes, subject to current own-read authorization.
- Stage 3 does not implement administrative capture/review/correction/annulment, selfie uploads, frontend, Telegram or offline synchronization. Shared database provisioning requires separate authorization.

### Administrative management (Stage 4)

- Expose administrative list, detail and version history at `GET /api/attendance`, `GET /api/attendance/:id`, `GET /api/attendance/:id/history`; writes at `POST /api/attendance/manual`, `POST /api/attendance/:id/review`, `POST /api/attendance/:id/corrections`, `POST /api/attendance/:id/annul`.
- The current organizational scope is Guerrero for ADMIN and ENLACE, with authenticated active accounts and explicit per-operation administrative permissions. Office-level isolation is deferred until an approved organizational model exists. Do not invent office ownership, identifiers or national access. OBSERVADOR remains personal-only.
- Require `attendance:read`, `attendance:capture-manual`, `attendance:review`, `attendance:correct`, `attendance:annul`, granted only to ADMIN/ENLACE. Administrative permissions never imply personal observer permissions or vice versa.
- Review only current pending records, accepting or rejecting with mandatory reason and positive `expectedVersion`. Serialize currentness/version/state checks with writes and audit. Preserve event timestamps, evidence, capture provenance and factual anomalies. Acceptance does not remove historical facts.
- Manual historical entry/exit requires the matching observer and assignment, explicit event instant/civil date and reason. Reject future events and cancelled/inapplicable periods; allow active or closed operatives with configured tolerance without reactivation. Current profile/module deactivation does not erase historical applicability. Require a declared controlled missing-location reason; never invent coordinates. Manual acceptance is administrative with explicit provenance and retained anomalies. Either half may be entered first, with coherent ordering when the counterpart exists; never fabricate the missing half.
- Corrections change the event time within the original assignment/date/type. Preserve the predecessor and original GPS/capture provenance; insert a new version with reason and predecessor, recalculate timing anomalies using the stored supported policy and require separate explicit review. New versions are always pending with no inherited decision, even with zero anomalies. Reject unknown policy versions rather than reinterpreting history.
- Annul the current version with reason and `expectedVersion`; preserve original evidence and audit. Annulment does not delete the logical mark, authorize another initial capture, or permit correction/recreation of an annulled mark.
- Administrative queries validate operative/module/observer, date-range, review-status and anomaly filters with bounded pagination. Return current versions by default and paginated version history separately. Separate structural completeness from review and factual anomalies. Only explicitly authorized detail responses expose precise GPS; never expose receipt payloads or credentials.

## 8. Attention reports

The system must support:

- A daily consolidated attention report associated with an assignment and an explicit report date.
- An official catalog of attention concepts.
- Recording quantities by concept.
- Supporting the concept requiring a general specification, such as "Other".
- Saving an editable draft, subject to the approved lifecycle.
- Submitting reports for review.
- Validating or observing submitted reports.
- Correcting confirmed information without destroying historical versions.
- Calculating totals by operative, module, date, observer, and concept.

Official attention concepts must come from approved source formats, not invented seed data.

## 9. Authentication and authorization

The system must provide:

- Username and password authentication.
- Secure password hashing.
- Revocable server-side sessions.
- Password change and administrative reset.
- Mandatory password change for temporary credentials.
- Temporary protection against repeated failed login attempts.
- Role- and permission-based authorization.
- Resource ownership checks for observer access.
- Protection of sensitive operations.

Authentication policies confirmed for the auth implementation:

- Fixed absolute session lifetimes: ADMIN 30 minutes; ENLACE and OBSERVADOR three hours.
- No sliding expiration, renewal, refresh tokens, or inactivity-based expiration.
- Argon2id password hashing and opaque server-side sessions; persist only SHA-256 token hashes.
- Five consecutive failed login attempts lock the account for 15 minutes. Requests during a lock do not extend it; successful authentication or lock expiry resets the counter.
- New passwords contain 15–128 Unicode code points, including spaces and Unicode, without composition rules. Reuse of the current password is rejected.
- Password changes revoke all sessions, including the current one, and require a new login.
- Temporary credentials permit only current-user consultation, password change, and logout.
- Account deactivation must revoke existing sessions when account management is implemented.
- Password-change requests require rate limiting and failed-verification protection independent of login lockout.

Retention policies remain pending.

Account-management policies confirmed for the initial Users implementation:

- One organizational scope: Guerrero. Office-level restrictions await an organizational model.
- Administrative HTTP operations require both ADMIN role and the explicit operation permission; ADMIN has no implicit bypass.
- Authorized administrators may view ADMIN accounts, but Users cannot create, modify, deactivate, reset or assign ADMIN accounts/roles. This restriction also protects the last active administrator under concurrency.
- Account creation and role assignment are limited to active ENLACE and OBSERVADOR roles. Existing observer-linked accounts reject effective role changes and retain their relationship/profile state.
- Username is immutable after creation; only full name is editable initially. Accounts are never physically deleted.
- Temporary passwords are securely generated server-side and returned only in the successful creation/reset response, never stored in plaintext. Delivery requires an authorized operational channel.
- Administrative reset clears temporary login lockout, requires password change and revokes sessions without reactivating an inactive account. Deactivation and effective role changes revoke sessions; reactivation never restores them.
- Account mutations and relevant audit events are atomic. Role-permission editing and observer profile management are not exposed through Users.
- Permission provisioning is explicit, idempotent and audited, never automatic at startup or migration time. The approved closed set is `users:create`, `users:read`, `users:update`, `users:change-status`, `users:assign-role`, `users:reset-password`, `roles:read`, `permissions:read`, `operatives:read`, `operatives:create`, `operatives:activate`, `observers:read`, `observers:create`, `observers:update`, `observers:change-status`, `observers:link-account`, `attention-modules:read`, `attention-modules:create`, `attention-modules:update`, `attention-modules:change-status`, `assignments:read`, `assignments:create`, `assignments:update`, `assignments:cancel`, `attendance:read`, `attendance:capture-manual`, `attendance:review`, `attendance:correct`, `attendance:annul`, `attendance:read-own`, `attendance:capture-own`. Of these thirty-one codes, ADMIN receives twenty-nine, ENLACE twenty-one, and OBSERVADOR only the two personal Attendance permissions (fifty-two grants total). No implicit own-capture/read grants go to ADMIN/ENLACE; other permission mappings remain unchanged.

## 10. Audit and traceability

The system must record significant actions, including:

- Account and permission changes.
- Operational record creation, review, correction, and annulment.
- Authorized manual capture.
- Session revocation and relevant security events.

Corrections must identify the responsible actor, reason, and time.

Audit information must avoid unnecessary personal data, passwords, credentials, tokens, and precise location history.

## 11. Consultation and reporting

Authorized users must be able to consult operational information within their access scope.

Reports must use the applicable current records and preserve access to historical corrections where authorized.

Exact report layouts, filters, exports, and dashboards must be defined against the operational formats and reporting needs.

## 12. Capture channels

### Initial release

- Unified web application for administrative personnel and observers.
- Authorized manual capture through the web.

### Subsequent release

- Telegram bot using the same backend business rules.
- Verified, revocable observer-account linking.
- Controlled service-to-API authentication.
- No assumption that Telegram is institutionally authorized for real data capture.

## 13. Out of scope for the initial release

- Native mobile applications.
- Nationwide organizational hierarchy.
- Public information website.
- Production cloud infrastructure design.
- Unapproved biometric or location-based identification mechanisms.
- Additional features without a validated operational requirement.

## 14. Pending functional decisions

1. Public Attendance workflow implementation and detailed transition rules beyond the approved Stage 2 contract.
2. Attention report draft, submission, review, correction, and annulment lifecycle.
3. Additional geographic verification and optional photographic evidence handling beyond the approved Stage 2 contract.
4. Assignment/report history integrity beyond the attendance preservation rules above.
5. Data retention.
6. Exact access-control matrix for the new implementation.
7. Official attention concepts and required reporting formats.
8. Operational schedules, capture windows, and exception handling.

These items must be resolved before implementing the affected functionality.

## 15. Acceptance criteria principle

Each functional implementation must define observable acceptance criteria using the relevant confirmed requirements.

A feature is complete when its authorized behavior works, relevant validations pass, and material limitations are documented. The existence of a database table or API endpoint alone does not constitute a completed feature.
