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

The exact reopening and modification policies must be validated before implementation.

## 4. Attention modules

The system must support:

- Registering and maintaining attention modules.
- Associating modules with municipalities.
- Activating and deactivating modules without deleting history.
- Reusing modules in different operatives.
- Assigning observers to modules for specific shifts.

Coordinates and location-verification settings remain optional until their operational requirements and authorization are confirmed.

## 5. Observers and accounts

The system must support:

- Registering observer profiles independently of login accounts.
- Activating and deactivating observer profiles.
- Creating accounts for observers who require remote access.
- Associating an observer profile with at most one account.
- Managing accounts and access permissions through authorized personnel.
- Preserving the relationship between recorded actions and their responsible users.

Account reassignment and unlinking policies remain pending.

## 6. Assignments

Each assignment identifies:

- An operative.
- An observer.
- An attention module.
- A calendar date.
- A start time and an end time.

Business rules:

- Shifts must start and end on the same calendar day.
- An observer may have multiple assignments on the same day only when their schedules do not overlap.
- Cancelled assignments remain available for historical reference.
- Assignment cancellation must not silently invalidate attendance or attention information already recorded.

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

The precise review states, correction rules, tolerance policies, and location requirements remain pending confirmation.

## 8. Attention reports

The system must support:

- A consolidated attention report associated with an assignment.
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
- Permission provisioning is explicit, idempotent and audited, never automatic at startup or migration time. The approved closed set is `users:create`, `users:read`, `users:update`, `users:change-status`, `users:assign-role`, `users:reset-password`, `roles:read`, `permissions:read`, `operatives:read`, `operatives:create`. ADMIN receives all ten; ENLACE receives only `operatives:read`; OBSERVADOR receives none of this set. Other permission mappings remain unchanged.

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

1. Attendance validation, rejection, correction, and annulment lifecycle.
2. Attention report draft, submission, review, correction, and annulment lifecycle.
3. Geographic location and photographic evidence requirements.
4. Rules for correcting assignments that already contain activity.
5. Data retention.
6. Exact access-control matrix for the new implementation.
7. Official attention concepts and required reporting formats.
8. Operational schedules, capture windows, and exception handling.

These items must be resolved before implementing the affected functionality.

## 15. Acceptance criteria principle

Each functional implementation must define observable acceptance criteria using the relevant confirmed requirements.

A feature is complete when its authorized behavior works, relevant validations pass, and material limitations are documented. The existence of a database table or API endpoint alone does not constitute a completed feature.
