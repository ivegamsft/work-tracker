# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **Application specification authored (2026-03-17):** Comprehensive app spec at `docs/architecture/app-spec.md` defining 23 `apps/web` screens and 9 `apps/admin` screens, role-adaptive navigation, per-screen functionality matrices, screen→API mappings, and dashboard widget system. Key decisions: "Employees" nav renamed to "Team" and hidden from Employee role; employee dashboard rewritten around personal readiness + quick actions (clock in/out, upload doc, view profile); self-service cannot create compliance records (qualifications/medical managed by Supervisor+); standards read-only in `apps/web`; document review is Manager+ not Supervisor+. Identified 3 API gaps for Bunk: `GET /api/documents/employee/:employeeId` (P0), batch readiness endpoint (P1), compliance report endpoint (P2). 5-phase implementation order starting with Employee UX. Triggered by user feedback: "this screen is really confusing. no quick actions. employees should be trimmed. what is the directory?"
- **RBAC API specification authored (2026-03-17):** Comprehensive RBAC reference at `docs/architecture/rbac-api-spec.md` with 65 endpoint catalog, 36 permissions across 11 resource categories using `{resource}:{action}` syntax, 5-role data scoping, three-layer enforcement (UI → API middleware → Prisma), and migration path for Phase 2 custom roles. Permission-first architecture enables future extensibility. Contract verified against actual router files.

## Team Sync (2026-03-15T23:34:38Z)

### Kima Status Update

✅ **Frontend Auth Context Fixed:** Fixed JWT token field mismatch in `apps/web/src/contexts/AuthContext.tsx`:
- Changed from `accessToken` to `token` in login response parsing
- Added user object extraction from JWT payload
- 25 tests passing

⚠️ **Blocking dependency:** Frontend login flow expects API to return `token` field (not `accessToken`). Bunk's API must be updated when integrating with Kima's frontend.

✅ **Frontend Scaffold Complete:** React + Vite + TypeScript SPA with:
- React Router 7 protected routes
- Plain CSS styling with custom properties (no framework)
- Centralized API client with auto Bearer token injection
- 4 pages implemented: Login, Dashboard, EmployeeList, EmployeeDetail
- Production build: 243KB gzipped
- Docker Compose integration ready

### Phase 0 Complete: MVP Scope + Container Architecture (2026-03-14T20:05:00Z)

📌 **Freamon delivered both blocking Phase 0 decisions:**

1. **MVP Product Scope (8 decisions):**
   - Q1: Qualifications + Medical primary loop; Hours deferred Phase 2+
   - Q2: Manual qualification/medical entry acceptable; Documents deferred Phase 2
   - Q3: Upload + manual review only; OCR pipeline deferred indefinitely
   - Q4: Department stays opaque string, no Department entity
   - Q5: Three-state `overallStatus` rule (compliant/at_risk/non_compliant) with 30-day warning
   - Q6: `requiredTests` informational only; no test subsystem
   - Q7: Single-organization only; no tenant isolation for MVP
   - Q8: In-app notifications only; email deferred Phase 2+
   - **Result:** All decisions unblock Phase 0/1 without architectural debt; all are reversible post-MVP

2. **Container-First Architecture:**
   - Pivot from App Service → Azure Container Apps
   - Layer changes: ACR + Log Analytics moved to `00-foundation`, `20-compute` replaces Web App with ACA Environment + Container App
   - Secret handling: API reads Key Vault directly at startup via `DefaultAzureCredential` (no init containers, no Dapr, no preview features)
   - Identity: System-assigned for runtime access, user-assigned for ACR pull, GitHub OIDC for `AcrPush`
   - Delivery: Local Docker/Compose, PR validation only, image build on merge, separate infra/image deployment
   - **Result:** Phase 0 complete; Bunk can now implement Phase 0 blocking work; Sydnor test harness unblocks Phase 1
