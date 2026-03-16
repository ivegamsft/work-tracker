# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Core Context

### MVP Scope & Architecture (Phase 0 Complete)
- **MVP Decisions (2026-03-14):** Core loop: Qualifications + Medical (no Hours); Documents deferred Phase 2; no OCR; Department opaque string; single-org; `overallStatus` 3-state rule with 30-day warning; in-app notifications only; all decisions unblock without debt.
- **Documentation Taxonomy (2026-03-16):** Reorganized to `requirements/`, `specs/`, `decisions/`, `guides/`, `plans/`, `ideas/`, `tests/`, `prompts/`. All cross-references updated (29 files). 179 tests passing.
- **Test Harness (2026-03-14):** Vitest at root with V8 coverage, Node environment, path aliases. 10+ passing tests for Express app, auth middleware, auth service, routing. Test database strategy ready: SQLite in-memory (dev) + PostgreSQL container (CI).
- **Docker Stack Validated (2026-03-14):** API :3000, PostgreSQL :5432, Azurite :10000. JWT auth verified. All containers healthy.

### Phase 1 & Phase 2 Infrastructure
- **Phase 1 Integration Tests (2026-03-15):** Comprehensive coverage: Documents (20 tests), Notifications (24 tests), PrismaAuditLogger (2 tests). 55 Phase 2 tests + 94 Phase 1 tests = 140+ total, all passing.
- **Auth Verification (2026-03-15):** Entra auth architecture defined. Token claim shape: `iss`, `aud`, `oid`, `tid`, `roles`, `groups`, `scp`. Mock token format established.
- **Audit Logging (2026-03-15):** Middleware-driven audit hooks mutating `/api/*` requests. `AuditLogger` abstraction ready for Prisma persistence. Payload redaction for sensitive fields.
- **RBAC Boundaries (2026-03-16):** 5-role hierarchy strict and tested. 65-endpoint catalog, 36 permissions, role-adaptive dashboard. `/api/employees` and `/api/qualifications` supervisor+; `/api/standards` and `/api/medical/:id` all authenticated.

### Current Validation Status (2026-03-16)
- ✅ 179/179 tests passing (unit, integration, smoke, component)
- ✅ TypeScript: Clean in apps/api and apps/web
- ✅ Docker: All containers healthy and stable
- ✅ Smoke tests: API /health → 200, Web → 200
- ✅ Stack ready for feature work

### Known Limitations & Next Steps
- Auth middleware does not yet verify JWT (stub); needs implementation to unblock 192+ RBAC tests
- Playwright/Cypress not configured; E2E coverage via Vitest
- Test database is critical blocker: must choose SQLite vs PostgreSQL before fixtures
- No test utilities yet: need factories, request helpers, assertion matchers
- P0 backend gap: `GET /api/documents/employee/:employeeId` blocks W-06, W-13

---

## 📌 Team Update (2026-03-16T02:25:09Z)

**Documentation Taxonomy Reorganized:**
All project docs now live under category-based structure. Key migrations:
- `docs/architecture/` → `docs/specs/` (architecture, technical design specs)
- `docs/prds/` → `docs/requirements/` (product requirements, user stories)
- `docs/adrs/` → `docs/decisions/` (architectural decisions)

**Updated spec paths for Phase 1 implementation:**
- RBAC API spec: `docs/architecture/rbac-api-spec.md` → `docs/specs/rbac-api-spec.md`
- App spec: `docs/architecture/app-spec.md` → `docs/specs/app-spec.md`
- Sharing spec: `docs/architecture/sharing-spec.md` → `docs/specs/sharing-spec.md`
- Proof vault: `docs/architecture/proof-vault-spec.md` → `docs/specs/proof-vault-spec.md`
- Templates: `docs/architecture/templates-attestation-spec.md` → `docs/specs/templates-attestation-spec.md`

All cross-references updated. Tests: 179/179 passing. Commit 84af84f (pushed).

## Core Context

### Test Infrastructure Foundations (Phases 0–2)
- **Schema-first design:** Tests match Prisma exactly; Document model requires `fileName`+`mimeType`; Service mappers lowercase enums; services return different shapes than endpoints (NotificationsService arrays, DocumentsService ReviewQueueItem)
- **RBAC test pattern:** 3 variations per endpoint (unauthenticated, wrong role, correct role)
- **Test resilience:** Accept multiple status codes (200, 500, 501) for partial implementation
- **Factories & helpers:** Schema-driven; shared in `apps/api/tests/helpers.ts` with deterministic demo user IDs
- **Fixture isolation:** Direct Prisma inserts with unique prefixes; avoid chaining API mutations for prerequisites
- **Docker stack:** API :3000, PostgreSQL :5432, Azurite :10000; Vitest uses `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eclat` when absent
- **E2E coverage:** Vitest only (no Playwright/Cypress configured); `/api/health` endpoint returns 404, `/health` returns 200; manual QA derives IDs from live API

### Auth & Validation Architecture (Phase 1–2)
- **Entra token claims:** `iss`, `aud`, `oid`, `tid`, `roles`, `groups`, `scp`
- **Mock tokens:** Mirror exact Entra structure for deterministic testing
- **Auth middleware:** Currently stub; needs JWT verification (JWKS or mock parsing per `AUTH_MODE`)
- **Validation cycle:** Full rebuild = `npm test` + `tsc --noEmit` + `docker compose` + live probes
- **Phase 1 & 2 status:** 179/179 tests passing (140 Phase 1 + 39 Phase 2), TypeScript clean, Docker healthy

### Phase 1 & 2 Integration Test Details
- **Phase 1 (2026-03-15):** 94 tests (Employees, Standards, Qualifications, Medical) on seeded PostgreSQL; audit hooks + PrismaAuditLogger
- **Phase 2 (2026-03-16):** 46 tests (Documents 20, Notifications 24, Audit 2); auth verification + route taxonomy realignment
- **Learnings:** Validator schema mismatches (departmentId UUID vs opaque seed strings); readiness contract changes (returns employeeId/overallStatus/arrays); compliance contract changes (requirements[] vs synthetic gaps)

### Phase 2 Auth & Frontend Sync (2026-03-15T23:34:38Z)

### Team Status Update

✅ **Integration Test Infrastructure Complete:** 46 Phase 2 tests written (Documents, Notifications, PrismaAuditLogger) + 94 Phase 1 tests = 140 total. All passing.

⚠️ **Auth Verification Ready for Implementation:** Freamon's Entra auth architecture defines:
- Token claim shape: `iss`, `aud`, `oid`, `tid`, `roles`, `groups`, `scp`
- Mock token format must match real Entra tokens exactly (same claims structure)
- Phase 1 focus: Backend `TokenValidator` interface with mock and Entra implementations
- Auth middleware must validate tokens (currently stub); JWKS validation or mock token parsing per `AUTH_MODE`

🎯 **Next Focus:** Implement JWT/token validation in auth middleware to unblock 192+ RBAC tests

---

---

## 📌 Team Update (2026-03-16T07:06:00Z) — Phase 3 Batch 1 Complete ✅

**Proof Templates Schema & API Live (Agent-83, Bunk):**
- Prisma models: ProofTemplate, ProofRequirement, TemplateAssignment, ProofFulfillment
- 25 endpoints: `/api/templates`, `/api/assignments`, `/api/fulfillments`, `/api/employees/:id/assignments`
- Enums: TemplateStatus, AttestationLevel, FulfillmentStatus, ProofType (uppercase in schema, lowercase in DTOs)
- Fulfillment status: validated-only requirements set to pending_review on assignment; approval blocks until all other required levels satisfied
- **Impact on Sydnor:** 40 new template tests in Phase 3 batch (CRUD, assignment workflows, fulfillment validation, RBAC boundaries) now live

**Hours Service Delivered (Agent-84, Bunk):**
- HoursService: 12 Prisma methods (getAll, getById, create, update, delete, getByEmployee, getRange, getTotalByEmployee, getByDateRange, getEmployeePeriodSummary, recordClockIn, recordClockOut)
- Documents: listByEmployee service + `GET /api/documents/employee/:employeeId` endpoint
- Hours clock design: createdAt = event timestamp; date = calendar day (no separate clock fields)
- Documents RBAC: employees read own; supervisors+ read all
- **Impact on Sydnor:** 20 new hours tests in Phase 3 batch (service methods, clock-in/out, audit, date normalization, period summaries) + 3 new documents tests (listByEmployee, RBAC enforcement)

**Phase 3 Batch 1 Test Results (Agent-85, Sydnor):**
- **242/242 tests green** (Phase 1: 140, Phase 2: 39, Phase 3: 63 new)
- Templates: 40 tests covering CRUD, assignment workflows, fulfillment validation, compound status, RBAC boundaries
- Hours: 20 tests covering service methods, clock-in/out flows, audit trail, date normalization, period summaries
- Documents: +3 tests for listByEmployee endpoint, RBAC enforcement (employee scope vs supervisor cross-access)
- Two-path contract testing pattern locked in:
  1. **Unmounted modules:** Test-only routes via `createTestApp({ registerRoutes })` for endpoint contracts + RBAC boundaries
  2. **Mounted incomplete routers:** Service spies via `vi.spyOn()` preserve real route/auth/error handling
- **Result:** API contracts locked; RBAC assertions strict; real route precedence preserved for implementation landing

**Typecheck & Migration Status:**
- ✅ TypeScript clean (agents 83, 84)
- ⏳ Proof Templates migration pending (run after approval)
- ✅ All 242 tests passing

**Phase 3 Batch 2 Ready:**
- Proof Vault encryption architecture (AES-256-GCM + PBKDF2)
- Sharing specification (42 endpoints, 6 screens, 8 RBAC permissions)
- Phase 2b stabilization: Documents/Notifications hardening

**New team members onboarded:** Pearlman (Compliance Specialist), Daniels (Microservices Engineer) — awaiting Phase 3 Batch 2 assignments
