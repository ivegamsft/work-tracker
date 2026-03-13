# E-CLAT Platform Foundation PRD

## 1. Purpose
Define the foundation required to turn the current E-CLAT skeleton into a production-grade compliance platform for regulated industries.

## 2. What exists today
### Architecture
- `apps/api/src/index.ts` boots an Express API with `helmet`, `cors`, JSON parsing, `/health`, module routing, and a shared error handler.
- Modules are mounted at:
  - `/api/auth`
  - `/api/employees`
  - `/api` (labels; not `/api/labels`)
  - `/api/hours`
  - `/api/documents`
  - `/api/qualifications`
  - `/api/medical`
  - `/api/standards`
  - `/api/notifications`
- Every module follows a consistent pattern: `router.ts`, `validators.ts`, `service.ts`, `index.ts`.

### Shared platform assets
- `packages/shared/src/types/roles.ts` defines five roles and a numeric hierarchy:
  - employee
  - supervisor
  - manager
  - compliance_officer
  - admin
- `packages/shared/src/errors/app-error.ts` defines typed application errors (`UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `NotFoundError`).
- `packages/shared/src/types/domain.ts` already captures most of the business language needed for the system.

### Data model
`data/prisma/schema.prisma` is the strongest part of the current system. It already models:
- employees
- qualifications + qualification documents
- hour records + hour conflicts
- labels + mappings + taxonomy versions
- documents + processing + extraction + review queue
- medical clearances
- compliance standards + requirements
- audit logs
- notifications + preferences + escalation rules

### Tooling and workflows
- Root scripts exist for `dev`, `build`, `test`, `typecheck`, and `lint`.
- GitHub Actions has CI (`.github/workflows/ci.yml`) and manual deploy (`.github/workflows/deploy.yml`).
- Frontend/admin apps and Terraform modules are still scaffolds.

## 3. What is missing or incomplete
### Blocking platform gaps
1. **Authentication is not real yet**
   - `apps/api/src/middleware/auth.ts` only checks for a Bearer token prefix.
   - JWT verification is TODO.
   - `req.user` is not actually populated, which undermines all downstream RBAC assumptions.
2. **All service methods are placeholders**
   - Every module service still throws a `501 NOT_IMPLEMENTED` via `notImplemented()`.
3. **No Prisma access layer in the API**
   - The schema exists, but the API does not instantiate or use Prisma for live data access.
4. **Audit logging is modeled, not wired**
   - `AuditLog` exists in the schema and shared types, but write operations do not persist audit records.
5. **Terraform is mostly intent, not infrastructure**
   - `infra/modules/compute/main.tf`, `database/main.tf`, and `storage/main.tf` are TODO placeholders.
6. **Seed data is not implemented**
   - `data/src/seed.ts` names the right seed categories but creates nothing.
7. **No migrations are present**
   - Prisma schema exists without migration history.
8. **No real tests exist**
   - Jest is configured, but the `tests/` tree is empty.

### Structural inconsistencies to fix early
- Labels are mounted under `/api` instead of `/api/labels`, which mixes route namespaces.
- Notifications comments refer to admin notification paths that do not match the actual mount path.
- `documents/router.ts` defines `GET /:id` before `GET /review-queue`; in Express, `review-queue` will be captured as `:id` for GET requests.
- Ownership and row-level access are not enforced in several read endpoints.

## 4. Cross-cutting product requirements
### RBAC model
The platform must keep the current five-role hierarchy, but add **row-level** rules on top of it.

#### Required access model
- **Employee**: may view and act on their own profile, hours, documents, qualifications, notifications, and medical summaries as permitted.
- **Supervisor**: may manage scoped employees/teams and review operational records.
- **Manager**: may resolve conflicts, approve/reject reviews, and access management dashboards.
- **Compliance Officer**: must have broad read access to compliance evidence, audit logs, and exceptions.
- **Admin**: manages system settings, users, standards, labels, integrations, and escalation rules.

#### Product requirement
Every endpoint must enforce:
1. authentication,
2. role check,
3. ownership/team scope check where relevant,
4. audit logging for sensitive reads/writes where required.

### Validation pattern
What exists now is good at the edge: routers parse bodies and queries with Zod. What is missing is deeper validation.

#### Required validation layers
- **Schema validation:** Zod at the API boundary.
- **State validation:** legal status transitions only.
- **Relational validation:** referenced entities must exist and belong to the right employee/tenant scope.
- **Temporal validation:** issue dates, expiration dates, retirement dates, and effective dates must make sense.
- **Security validation:** upload MIME/type allowlists, batch size caps, search string limits, rate limits.

### Error handling
Keep the current structured error payload shape. Extend it with:
- consistent mapping from Zod errors to `ValidationError`,
- conflict semantics for duplicate resources and invalid state transitions,
- machine-readable error codes per domain workflow.

### Audit logging
Audit logging is mandatory for compliance.

#### Required audit coverage
- auth: register, login failures, password changes, refresh, OAuth linking
- employees: create, update, deactivate/reactivate, role changes
- hours: manual entry, imports, edits, deletes, conflict resolution
- documents: upload, extraction correction, review decisions, qualification linkage
- qualifications: create, update, status changes, document linkage, compliance overrides
- medical: create, update, status change, expiry override
- standards/labels: create, update, publish, deprecate, rule changes
- notifications/escalations: rule changes, dismissals where relevant, delivery failures

#### Required audit fields
- actor
- action
- entityType
- recordId
- changedFields
- reason
- attestation (where applicable)
- timestamp

### Background processing
The current codebase implies asynchronous work that should be designed explicitly.

#### Required jobs/workers
- document OCR/classification/extraction pipeline
- qualification expiry/expiring-soon recalculation
- medical expiry recalculation
- weekly digest generation
- notification batching
- escalation-rule evaluation
- optional label taxonomy migration jobs

### Observability and security
Must be added before production readiness:
- request logging with correlation IDs
- dependency-aware health checks (DB, storage, email provider, OCR provider)
- rate limiting on auth and write-heavy endpoints
- secrets management for JWT, DB, SMTP, OCR, OAuth
- encrypted storage for sensitive evidence and medical data
- retention policies for audit logs, dismissed notifications, soft-deleted records, and uploads

## 5. Prioritized roadmap
### P0 — unblock the platform
1. Implement JWT auth, refresh flow, and password hashing.
2. Add Prisma client usage to the API and create the first migration set.
3. Implement audit logging primitives and reusable repository/service helpers.
4. Build storage/database/compute Terraform modules and secret wiring.
5. Seed default admin, standards, label taxonomy, and escalation rules.
6. Create baseline test harness and CI that fails on zero meaningful coverage.

### P1 — operational backbone
1. Employee CRUD and readiness aggregation.
2. Hours capture/import/conflict workflows.
3. Documents upload/review/extraction correction.
4. Qualifications CRUD and standards-backed compliance evaluation.
5. Notifications delivery and digest/escalation behavior.

### P2 — governance and maturity
1. Label lifecycle, taxonomy publishing, and migration tooling.
2. Export/reporting features.
3. Admin observability and audit exploration.
4. Hardening for retention, encryption, and regulatory evidence.

## 6. Delivery milestones
### Milestone A — working secure API skeleton
- auth middleware validates JWTs
- all modules can read/write through Prisma
- audit log writes exist for at least one end-to-end workflow
- CI runs typecheck, lint, build, and tests successfully

### Milestone B — end-to-end compliance workflow
- employee profile exists
- hours are logged/imported
- document is uploaded and reviewed
- qualification is linked to evidence
- readiness is computed
- notifications fire on a real trigger

### Milestone C — production readiness
- infrastructure provisioned in Azure
- storage/OCR/email integrations live
- admin and web apps cover core operations
- retention, security, and observability controls are active

## 7. Acceptance criteria
- No endpoint in the nine modules returns `NOT_IMPLEMENTED` for in-scope workflows.
- Sensitive reads/writes are ownership-aware and role-scoped.
- Audit logs exist for every regulated mutation.
- The API, schema, shared types, and frontend clients agree on field names and statuses.
- Background jobs are defined, owned, and test-covered.
- Terraform can provision a dev environment end to end.

## 8. Team-ready work packages
### Kima
- auth, Prisma integration, service implementations, infrastructure integrations

### Sydnor
- API contract suite, edge-case/state-transition tests, audit-log verification, CI quality gates

### Bunk
- user/admin UI implementation against stable contracts, approval flows, dashboard UX, accessibility
