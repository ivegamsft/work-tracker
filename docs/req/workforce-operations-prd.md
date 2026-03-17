# E-CLAT Workforce Operations PRD

## Scope
- Auth
- Employees
- Hours

---

## 1. Auth module
### What exists today
**Endpoints (`apps/api/src/modules/auth/router.ts`)**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/change-password`
- `GET /api/auth/oauth/callback`

**Validation (`validators.ts`)**
- registration requires email, password, first name, last name, employee number
- registration/change-password enforce password length 8-128
- login only requires a non-empty password
- refresh requires a non-empty refresh token

**Business intent encoded in code**
- password-based auth is the primary path
- refresh token flow is expected
- OAuth callback exists because hours calendar sync is planned
- password changes require an authenticated user context

### What is missing or incomplete
- service methods for register/login/refresh/change-password/OAuth are all stubbed
- JWT verification is not implemented in middleware
- no bcrypt usage despite dependency being present
- no refresh token storage/rotation/revocation model
- no login throttling or account lockout
- no auth audit trail
- no email verification or invite flow
- login validator is weaker than register validator

### What should be built next
#### P0
1. Implement JWT verification in middleware and populate `req.user`.
2. Implement register/login/change-password/refresh with bcrypt and signed tokens.
3. Define refresh token persistence, rotation, logout/revocation, and session TTLs.
4. Add auth audit events for register, login success/failure, password change, refresh, and OAuth link.

#### P1
1. Add invite-based onboarding for employees created by admins.
2. Add brute-force protection and rate limiting.
3. Implement OAuth provider support for calendar sync prerequisites.

### Acceptance criteria
- Authenticated endpoints reject invalid/expired JWTs.
- Passwords are hashed and never stored or echoed.
- Refresh tokens rotate and old tokens are invalidated.
- Auth events appear in audit logs.

---

## 2. Employees module
### What exists today
**Endpoints (`apps/api/src/modules/employees/router.ts`)**
- `POST /api/employees`
- `GET /api/employees`
- `GET /api/employees/:id`
- `PUT /api/employees/:id`
- `GET /api/employees/:id/readiness`

**Data model signals**
- shared `Employee` DTO includes employee number, role, department, hire date, active flag
- Prisma `Employee` model ties employees to qualifications, hour records, documents, medical clearances, notifications, and preferences
- service contract defines an `EmployeeReadiness` aggregate with qualification counts, hour totals, medical summary, and overall status

**Business rules already encoded**
- only admins can create/update employees
- list endpoint is supervisor+
- readiness is a first-class product surface, not an afterthought
- employee filtering includes department, role, active state, text search, page, and limit

### What is missing or incomplete
- service methods are stubbed
- readiness calculation is undefined beyond the response shape
- GET by ID and readiness are not ownership- or role-scoped beyond authentication
- no employee deactivation/reactivation workflow beyond `isActive`
- no audit logging for role or department changes
- no export/reporting endpoint
- query validation is inconsistent (`role` is a free string in queries)

### What should be built next
#### P0
1. Implement employee CRUD backed by Prisma.
2. Define row-level access rules for self, supervisor, manager, compliance, and admin views.
3. Implement readiness aggregation using qualifications, hours, and medical clearance data.
4. Write audit logs for create/update/status/role changes.

#### P1
1. Add employee activation/deactivation workflow with reason capture.
2. Add CSV export for compliance reporting.
3. Add department/team scoping logic for supervisor and manager lists.
4. Define the business rule for `overallStatus` (`compliant`, `at_risk`, `non_compliant`).

### Acceptance criteria
- readiness endpoint returns deterministic, explainable rollups
- non-admin users cannot read arbitrary employee records
- employee mutations are auditable
- lists paginate consistently and validate filters correctly

---

## 3. Hours module
### What exists today
**Endpoints (`apps/api/src/modules/hours/router.ts`)**
- `POST /api/hours/clock-in`
- `POST /api/hours/clock-out`
- `POST /api/hours/manual`
- `POST /api/hours/import/payroll`
- `POST /api/hours/import/scheduling`
- `POST /api/hours/calendar/sync`
- `GET /api/hours/employee/:id`
- `GET /api/hours/conflicts`
- `POST /api/hours/conflicts/:id/resolve`
- `PUT /api/hours/:id`
- `DELETE /api/hours/:id`
- `GET /api/hours/:id/audit`

**Data model signals**
- Prisma `HourRecord` stores source, date, hours, qualification category, optional label, verification fields, soft-delete flags
- Prisma `HourConflict` and `HourConflictRecord` model duplicate/mismatch detection and resolution
- shared types and validators encode audit-heavy workflows: manual entry attestation, edit reasons, delete reasons, conflict attestation and reason

**Business rules already encoded**
- manual entry requires employee attestation
- conflict resolution requires both attestation and business reason
- edit/delete require reasons
- imports are supervisor+, conflict actions are manager+
- the system expects multiple sources: clock, payroll, job ticket, calendar, manual

### What is missing or incomplete
- every service method is stubbed
- no algorithm for clock session handling, overlap detection, duplicate detection, or mismatch resolution
- no real calendar OAuth sync
- no audit persistence despite audit-heavy API design
- GET employee hours is not ownership-aware
- bulk import batch limits are not enforced
- payroll import `labelId` is not validated as UUID, and scheduling import lacks a label field entirely
- merge conflict resolution semantics are undefined

### What should be built next
#### P0
1. Implement real clock-in/clock-out behavior with open-session validation.
2. Implement manual hour entry persistence and audit logging.
3. Implement payroll/scheduling imports with duplicate and mismatch detection.
4. Implement conflict list and resolve workflows using `HourConflict` tables.
5. Implement soft-delete and edit with immutable audit history.

#### P1
1. Define conflict-resolution outcomes for `precedence`, `override`, and `merge`.
2. Add ownership and team-scope authorization on read endpoints.
3. Add batch-size caps and rate limits for imports/manual entry.
4. Validate `qualificationCategory` and label mappings against active standards/taxonomy.
5. Implement calendar sync via OAuth-backed provider adapters.

#### P2
1. Add summary/reporting endpoints.
2. Add export formats for external compliance reviews.
3. Add preview/simulation endpoint for conflict resolution.

### Acceptance criteria
- hour records can be created from multiple sources without silent duplication
- conflicts are explainable and resolvable with audit evidence
- soft-deleted records remain reportable and traceable
- read access follows role + ownership rules

---

## 4. Workforce journey to support
1. Admin or invite flow creates employee access.
2. Employee or imported systems create hour records.
3. Managers can see readiness and intervene on conflicts.
4. Compliance staff can review audit history for every override.

## 5. Build order inside this PRD
1. Auth foundation
2. Employee CRUD + scope controls
3. Hours write paths + audit trail
4. Readiness rollup
5. Calendar sync and reporting
