# E-CLAT Requirements / PRD Set

This guide describes the requirement documents now stored under `docs/requirements/`.

## Why this exists
These PRDs turn the current E-CLAT codebase into an execution plan. The repository already defines the domain model, API surface, RBAC vocabulary, and deployment intent, but almost every service method is still scaffolded. This set documents what exists today, what is missing, and what the team should build next.

## Repository snapshot
- **Backend:** `apps/api` Express + TypeScript API with **9 modules** and route/validator scaffolding across **64 endpoints**.
- **Domain model:** `data/prisma/schema.prisma` defines the compliance data model in detail, including employees, qualifications, hour records, documents, medical clearances, audit logs, notifications, standards, labels, and escalation rules.
- **Shared package:** `packages/shared` contains role hierarchy, domain DTOs, and structured error classes.
- **Infrastructure:** `infra/` targets Azure with environment overlays, but compute/database/storage modules are still TODO placeholders.
- **Frontend/admin:** `apps/web` and `apps/admin` are scaffolds with README-level intent only.
- **Implementation status:** routers and validators are largely specified; service methods still throw `NOT_IMPLEMENTED` and authentication middleware does not yet verify JWTs.

## PRD map
1. **`platform-foundation-prd.md`** — current-state architecture, cross-cutting concerns, compliance expectations, roadmap, and delivery sequencing.
2. **`workforce-operations-prd.md`** — auth, employees, and hours.
3. **`compliance-evidence-prd.md`** — documents, medical, and notifications.
4. **`governance-taxonomy-prd.md`** — qualifications, standards, and labels.
5. **`frontend-admin-prd.md`** — required scope for `apps/web` and `apps/admin`.

## Recommended delivery order
### Phase 0 — Foundation blockers
- Real JWT authentication and token lifecycle
- Prisma data access layer and migrations
- Audit logging implementation
- Azure storage/database/compute implementation
- Shared authorization and row-level access rules

### Phase 1 — Core compliance workflows
- Employee CRUD + readiness rollups
- Hours capture/import/conflict handling
- Document upload/review/extraction correction
- Qualifications and standards evaluation
- Notification creation and delivery

### Phase 2 — Governance and operational maturity
- Label taxonomy lifecycle and version publishing
- Escalation automation and digest jobs
- Reporting/export surfaces
- Observability, retention, and compliance hardening

## Suggested team handoff
- **Kima:** backend service implementation, Prisma access layer, integrations, and RBAC hardening.
- **Sydnor:** API contract tests, business-rule test matrix, audit-log verification, and regression coverage.
- **Bunk:** `apps/web` and `apps/admin` implementation using the frontend PRD and API contracts from the domain PRDs.

## Non-negotiables for this program
- Every write path must produce an audit trail.
- Sensitive data access must be role-scoped and ownership-aware.
- Status transitions must be explicit, validated, and test-covered.
- Background workflows (OCR, escalations, expiry jobs, digests) need first-class design, not ad hoc cron logic.
- The same compliance patterns must hold across all nine modules.