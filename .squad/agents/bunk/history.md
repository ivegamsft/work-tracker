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
