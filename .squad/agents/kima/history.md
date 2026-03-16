# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- 2026-03-16: Role-gated frontend pages should wait for AuthContext to finish hydrating before making protected requests; employee users must skip employee-directory fetches, and employee-directory 403s should render permission-aware UI instead of fatal generic errors.
- 2026-03-17: Team coordination phase complete. RBAC API spec (65 endpoints, 36 permissions, 5-role matrix) at `docs/architecture/rbac-api-spec.md` and App spec (23 core + 9 admin screens, 5-phase implementation) at `docs/architecture/app-spec.md` are ground truth. Product spec reconciliation locked 5-role model. All decisions merged to `.squad/decisions.md`. Dashboard implementation aligns to role-aware design pattern.

## Phase 2 Auth & Frontend Sync (2026-03-15T23:34:38Z)

### Freamon Status Update (Lead)

✅ **Entra ID Authentication Architecture Complete:**
- Full 10-section design document at `docs/architecture/entra-auth-design.md`
- New `05-identity` Terraform layer for app registrations and security groups
- 4 app registrations (API, web SPA, admin SPA, deployment SPN)
- 5 app roles + 5 security groups per environment (1:1 mapping to existing RBAC)
- Backend: JWKS token validation (no re-signing), `TokenValidator` strategy pattern, `AUTH_MODE` toggle
- Frontend: MSAL.js redirect-based login for both SPAs
- Database: Managed identity for production access
- Database: Managed identity for production PostgreSQL access
- 6-phase migration plan (foundation → terraform → bootstrap → backend → frontend → cleanup)
- Mock auth fully functional locally; switch to Entra when tenant/consent available

⚠️ **Blocking dependency:** Phases 2-3 need tenant ID, subscription, and admin consent. Phase 1 (backend token interface) independent — can start immediately with mock tokens.

💡 **Key Decision:** Validate Entra tokens directly (don't re-sign). Mock tokens mirror exact Entra claims structure. Additive migration keeps mock auth functional.

### Kima Status Update (Frontend)

## Important Status: PRDs Available

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `docs/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your backend domain work.

## Important: MVP Planning Complete (2026-03-13T23:25:00Z)

📌 **MVP Planning Session Complete.** See `.squad/orchestration-log/2026-03-13T2325-{freamon,sydnor}.md` and `.squad/decisions.md` for full context.

### Your Phase 0 Assignment: Frontend + Test Integration

**Your responsibilities (Kima - Frontend Lead):**
1. **Block on test utilities (Phase 0):**
   - **DO NOT** start API endpoint implementation until test infrastructure is in place
   - Coordinate with Sydnor on auth mocking, request helpers, and test database
   - Frontend integration tests can start once API test harness is stable (Phase 1 end)

2. **Admin app scaffolds (Phase 1-3):**
   - Phase 1: Auth UI (login, token refresh)
   - Phase 2: Employee management, standards library, qualification tracking
   - Phase 3: Medical clearance workflows, notification preferences
   - Deferred: Hours workflows, document OCR, labels publishing

3. **Integration readiness:**
   - Work from `docs/prds/frontend-admin-prd.md`
   - Coordinate with Bunk on API contract stability before heavy UI work
   - Test infrastructure (auth mocking, API clients) will be provided by Sydnor

**MVP Scope (what you're building):**
- **Phase 1:** Admin login, basic app shell
- **Phase 2:** Core domain UIs (Employees, Qualifications, Standards)
- **Phase 3:** Medical clearances, notifications settings

**Critical blocker:** Test database + request utilities must be ready before API work accelerates. Sydnor has Phase 0 responsibility here.

**Team coordination:**
- Bunk is building API services; work from his contracts
- Sydnor is building test infrastructure; unblock his work first
- Freamon is sequencing phases; check `.squad/decisions.md` for phase transitions

See `.squad/decisions.md` for full MVP sequencing and test infrastructure requirements.

### Phase 0 Complete: MVP Scope Locked; Phase 1 Ready (2026-03-14T20:05:00Z)

📌 **Freamon locked MVP product scope and container-first architecture; Sydnor delivered test harness; Bunk implementing Phase 0 blocking work. Phase 1 opens for Kima's frontend work once Bunk's Phase 0 is complete and tested.**

**MVP Scope Decisions (8 locked):**
- Core loop: Qualifications + Medical (no Hours)
- Documents deferred Phase 2 (manual upload + review, no OCR)
- Department opaque string; single-org
- `overallStatus` 3-state rule (compliant/at_risk/non_compliant) with 30-day warning
- `requiredTests` informational; no test subsystem
- In-app notifications; email deferred
- **Result:** Phase 0/1 unblocked; all reversible post-MVP

**Container-First Architecture:**
- Azure Container Apps (not App Service); ACR + Log Analytics in foundation
- Runtime reads Key Vault directly; local-first Docker/Compose
- **Result:** Infra team (Freamon) has architecture; image build/rollout separate from Terraform

**Test Harness:**
- Vitest configured, 10 passing tests (health, auth, routing)
- Auth mocking pattern established
- **Result:** Bunk can write Phase 0 tests; Phase 1 service tests can follow

**Your Phase 1 scope (Kima - Frontend):**
- Phase 1 opens once Bunk's Phase 0 blocking work is tested and merged
- Start with Admin login UI (auth provider, token refresh, basic shell)
- Work from `docs/prds/frontend-admin-prd.md`
- Phase 2: Employee management, standards library, qualification tracking
- Phase 3: Medical clearance workflows, notification preferences
- Deferred: Hours workflows, document OCR, labels publishing

**Team coordination:**
- Bunk: Phase 0 blocking (JWT tokens, labels routing, mock users, auth verification)
- Sydnor: Phase 1 factories and service-layer test patterns (core models)
- Freamon: Infrastructure readiness, phase gating, decision updates
- Kima: Frontend integration tests once Bunk's Phase 1 services stabilize

**Blocking:** Bunk's Phase 0 work must complete and be tested before Phase 1 frontend work accelerates.

### Frontend Scaffold Complete (2026-03-15)

📌 **apps/web/ now has a complete React + Vite + TypeScript foundation ready for Phase 1 work.**

**What was built:**
- **Build system:** Vite config with React plugin, dev server proxy to `/api`, TypeScript strict mode
- **App shell:** React Router setup, auth context with JWT token handling, protected routes
- **Core pages:** Login, Dashboard (compliance stats), Employee List (paginated, searchable), Employee Detail (readiness dashboard)
- **Layout:** Responsive sidebar navigation, header with user info, logout functionality
- **API client:** Centralized fetch wrapper with token attachment, error handling, 401 redirect
- **Styling:** Plain CSS with custom properties for color scheme (compliant/at-risk/non-compliant indicators)
- **Docker integration:** `web` service added to docker-compose.yml, proxies to API container
- **Dependencies:** React 19, React Router 7, Vite 8, TypeScript 5 — all installed and verified

**TypeScript build:** Clean typecheck (no errors), production build successful (243KB gzipped)

**Color scheme (CSS custom properties):**
- `--color-success: #22c55e` (compliant)
- `--color-warning: #f59e0b` (at risk)
- `--color-danger: #ef4444` (non-compliant)
- `--color-primary: #3b82f6`

**API contracts assumed (from PRD):**
- `POST /api/auth/login` → `{ token, user }`
- `GET /api/employees` → Employee list with `overallStatus`
- `GET /api/employees/:id` → Employee detail
- `GET /api/employees/:id/readiness` → Qualifications + medical status with expiry dates

**Ready for:**
- Phase 1: Integration with live API once Bunk's auth endpoints are deployed
- Phase 2: Additional pages (Standards, Qualifications CRUD)
- Phase 3: Medical clearance workflows, notification preferences UI

**Development workflow:**
- `npm run dev -w @e-clat/web` — starts Vite dev server on port 5173
- `docker compose up web` — runs web service in container
- API proxy: `/api/*` → `http://localhost:3000` (or `http://api:3000` in Docker)
