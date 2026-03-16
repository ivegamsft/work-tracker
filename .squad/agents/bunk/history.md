# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Core Context

### Delivery History

**Phase 0 (2026-03-14):** JWT tokens module, mock user store, RBAC enforcement, Container-first architecture with Docker Compose. Terraform pivoted to Container Apps with managed identity. 10 tests passing.

**Phase 1 (2026-03-15):** PrismaAuditLogger implementation, integration tests (Documents 20, Notifications 24, Audit 2). Employees + Standards + Qualifications + Medical services with Prisma CRUD patterns, date-driven compliance logic. 140/140 tests passing.

**Phase 2 (2026-03-16):** Route taxonomy migrated from `/employees` to `/team` per app spec. Legacy `/employees/*` routes 301-redirect. My section pages (6 components) deliver self-service UI with API normalization pattern. Build: 179/179 tests passing.

### Critical Implementation Patterns

**Database & Prisma:**
- Singleton in `apps/api/src/config/database.ts`, shared across services
- Enum mapping: Prisma = uppercase (Role, QualificationStatus); DTOs = lowercase strings; services normalize before routes
- Seed: `data/src/seed.ts` uses UUID v5 from mock auth emails; Tier 1 (all envs), Tier 2 (Terraform Entra), Tier 3 (API bootstrap)

**RBAC & Audit:**
- 5-role hierarchy: EMPLOYEE < MANAGER < SUPERVISOR < LEAD < ADMIN
- JWT validation + ownership verification on reads; non-blocking audit logging to AuditLog table
- Sensitive fields redacted in audit logs

**Docker & Infrastructure:**
- Docker: API :3000, Postgres :5432, Azurite :10000
- Terraform: 3-layer (00-foundation, 10-data, 20-compute); Container Apps with managed identity
- Secrets: Key Vault via DefaultAzureCredential; no connection strings in .env

**MVP Scope:**
- Core: Employees + Standards + Qualifications + Medical
- Documents: Manual upload only (no OCR)
- Notifications: In-app only (no email)
- Deferred: Hours, OCR, Email, Labels, Department entity

### Key Service Patterns

**Service Template:** Create `apps/api/src/modules/{entity}/{service,validators,router}.ts`. Service returns lowercase DTOs; router handles status codes.

**Employees, Standards, Qualifications, Medical:** Prisma singleton + DTO-mapping; FK validation; compliance rules (active/expiring_soon satisfy requirements; 30-day window).

**Documents:** Manual upload (no OCR); UUID storageKey; auto-create ReviewQueueItem (PENDING).

**Notifications:** In-app only; preferences per user; mark-read, dismiss, digest.

**Auth:** JWT signing/verification in `apps/api/src/modules/auth/tokens.ts`; mock users per role; Entra Phase 2 (JWKS validation + TokenValidator strategy + AUTH_MODE toggle).

### File Reference Map

**Core:**
- `apps/api/src/config/database.ts` — Prisma singleton
- `apps/api/src/services/audit.ts` — PrismaAuditLogger
- `apps/api/src/modules/{entity}/` — per-service pattern
- `data/prisma/schema.prisma` — DB schema source of truth
- `data/src/seed.ts` — test data seeding
- `infra/layers/{00-foundation,10-data,20-compute}/` — Terraform roots

## Learnings

<!-- Append new learnings below. Recent work summarized to Core Context above. -->
- 2026-03-16: Web route taxonomy now follows `docs/specs/app-spec.md` with canonical `/team` and `/team/:id` paths in `apps/api/src/routes/team.ts`; legacy `/employees` and `/employees/:id` deep links redirect forward for backward compatibility.
- Added shared route scaffolding in `apps/web/src/components/PageShell.tsx`, `apps/web/src/pages/RoutePlaceholderPages.tsx`, and `apps/web/src/rbac.ts` so new `/me/*`, `/team/:id/*`, `/standards*`, `/reviews*`, `/unauthorized`, and `/404` entries reuse the same breadcrumb/tab/auth patterns.
- Updated active web route references in `apps/web/src/components/Layout.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/TeamDirectoryPage.tsx`, `apps/web/src/pages/TeamMemberDetailPage.tsx`; root `package.json` build/typecheck now include `@e-clat/web` for repo-level validation.
- 2026-03-16: Hours now uses Prisma-backed clock-in/out, manual entry, import conflict creation, soft deletes, and audit-log lookup in `apps/api/src/modules/hours/service.ts`; documents gained paginated employee listing plus self-or-supervisor access at `GET /api/documents/employee/:employeeId`.
- 2026-03-18: Added proof templates/assignments/fulfillments backend module with RBAC enforcement, status computation, and new Prisma models/relations; mounted `/api/templates`, `/api/assignments`, `/api/fulfillments`, and employee assignment listing routes.
- 2026-03-20: Implemented backend endpoints for issues #17, #18, #19 (team templates and fulfillment review). Added GET /api/templates/team (supervisor+ role, team template progress with completion percentages), GET /api/fulfillments/reviews (manager+ role, filterable review queue), GET /api/fulfillments/:id/review (review detail with separation-of-duties check), POST /api/fulfillments/:id/review (approve/reject/request_changes decisions). Extended validators.ts with fulfillmentReviewFiltersSchema and reviewDecisionSchema. All methods enforce RBAC, compute at-risk/overdue flags, aggregate employee-level completion metrics, and include audit trail for review history. Branch: squad/bunk/team-templates-review-endpoints, commit e4bb812.
- 2026-03-16: Issue #31 audit-safe expiration and renewal cycles — Added `renewalWindowDays`, `gracePeriodDays`, `priorCycleId`, `revokedAt`, `revokedBy`, `revocationReason` fields to ProofFulfillment schema; added REVOKED status to FulfillmentStatus enum; implemented `getExpiringFulfillments` (filter by days ahead, employee), `createRenewalCycle` (links prior cycle, preserves historical timestamps), and `revokeFulfillment` (invalidates readiness without deleting evidence) service methods; exposed via `GET /api/fulfillments/expiring`, `POST /api/fulfillments/:id/renew`, `POST /api/fulfillments/:id/revoke` endpoints with SUPERVISOR+ and MANAGER+ RBAC respectively; migration `20260316152157_add_fulfillment_expiration_renewal_revocation` ready for deployment.
- 2026-03-20: Issues #18, #19 — Built Fulfillment Review Queue and Detail frontend pages. Created `FulfillmentReviewQueuePage` (data table with status/proof-type/search filters, priority badges, summary stats) and `FulfillmentReviewDetailPage` (evidence sections for self-attestation/upload/third-party, review history audit trail, approve/reject/request-changes actions with notes). Routes at `/reviews/templates` and `/reviews/templates/:fulfillmentId` with supervisor+ RBAC and `compliance.templates` feature gate. Followed existing ReviewPages.tsx and TemplateLibraryPage patterns. 14 tests across 2 test files. First time doing frontend work — followed Kima's patterns closely. Branch: squad/18-19-fulfillment-review-ui.

## 📌 Team Update (2026-03-16T073200Z — Freamon's Backlog Decomposition)

Freamon decomposed the full E-CLAT backlog into **51 GitHub issues** across 5 epics and 4 releases.

This affects all squad work planning:
- **Bunk:** 16 backend issues assigned (architecture, bugs, stabilization)
- **Kima:** 13 frontend issues assigned (template UI screens W-30 to W-38, navigation)
- **Sydnor:** 1 testing issue assigned
- **Pearlman:** 7 compliance issues assigned (attestation, proof audit findings)
- **Daniels:** 12 architecture/DevOps issues assigned (contracts, feature flags, pipeline)
- **Freamon:** 3 spike/research issues (dependency critical path)

Key metrics:
- Priority split: P0 14, P1 25, P2 13
- Release targets: v0.4.0 (16), v0.5.0 (19), v0.6.0 (10), backlog (5)
- Go/No-Go: go:yes 29, go:needs-research 22

All 18 source documents (specs, requirements, ideas, known bugs) have corresponding issues with cross-references and traceability links. Squad leads should review assigned issues and refine acceptance criteria.

Decision file: \.squad/decisions/inbox/freamon-backlog-decomposition.md\`n

## 📌 Team Update (2026-03-16T073200Z — Daniels' Copilot Instructions & Docs Update)

Daniels updated core team memory files for better agent and copilot coordination:

**Files Updated:**
- \.github/copilot-instructions.md\ — Added templates module context (242 tests, docs pipeline, compliance guardrails, 8-member squad roster, service architecture, parallel deployment strategy)
- \docs/README.md\ — Reorganized docs taxonomy into category-based structure (specs/, requirements/, decisions/, guides/, plans/, ideas/, tests/, prompts/)
- \.github/agents/squad.agent.md\ — Refined agent charters and responsibilities

This affects all squad planning and copilot context:
- All agents now have clearer service architecture context (6 logical backend service groups)
- Copilot instructions include templates module spec (policy constraints, attestation 4-level system)
- Docs are now organized for better cross-referencing and discovery
- Branch naming standard documented: \copilot/{issue-number}-{slug}\ (cannot enforce server-side on private repo due to GitHub plan limit)

Decision files: \.squad/decisions/inbox/daniels-service-architecture.md\, \.squad/decisions/inbox/daniels-branch-rulesets.md\`n

## 📌 Team Update (2026-03-16T170500Z — Round 2 Spawned)

**All 4 agents complete & pushed:**
- Bunk: squad/bunk/audit-safe-expiration (PR #56, Issue #31)
- Daniels: squad/daniels/terraform-compute-stubs (PR #57, Issue #26)
- Freamon: squad/freamon/api-v1-namespace (PR #55, Issue #27)
- Kima: Coverage audit on #14-16 (Proof Templates/Attestation/Vault: 54-71%)

**Scribe Actions:**
- Orchestration logs: 2026-03-16T170500Z-{bunk,daniels,freamon,kima-coverage}.md
- Merged freamon-api-v1-namespace.md from inbox → decisions.md
- Added team updates to all 4 agent history files
- Deleted inbox file

**Next:** PRs #55-57 ready for review; Kima findings → P0 prioritization
