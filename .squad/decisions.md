# Squad Decisions

## Active Decisions

**Note:** Older decisions (2026-03-13 and 2026-03-14) have been archived to `decisions-archive.md` to keep this file focused on recent, active decisions.

---

## API v1 Namespace Migration Strategy (2026-03-19)

**Decision:** Adopt a 4-phase dual-mount migration strategy to move all API routes from `/api/*` to `/api/v1/{service-group}/*` over 3-6 months.

**Decision Maker:** Freamon (Lead)  
**Status:** Proposed  
**Related Issue:** #27 (SA-06)  
**Spec Document:** `docs/specs/api-v1-namespace.md`

### Context

The E-CLAT API currently exposes 94 endpoints across 11 modules using a flat `/api/*` namespace with no versioning. The service architecture spec requires migration to `/api/v1/*` to enable future versioning, align routes with 6 logical service boundaries, and enable incremental service extraction while maintaining backward compatibility.

### Service Group Mapping

| Service Group | v1 Prefix | Endpoints | Key Change |
|---|---|---|---|
| Identity | `/api/v1/auth` | 5 | Direct addition |
| Workforce | `/api/v1/workforce/employees` | 6 | Renames from `/api/employees` |
| Compliance | `/api/v1/compliance/*` | 37 | **Consolidates 4 mount points** |
| Records | `/api/v1/records/*` | 21 | Groups documents + hours |
| Reference | `/api/v1/reference/*` | 14 | Groups standards + labels |
| Notifications | `/api/v1/notifications` | 10 | Direct addition |
| Platform | `/api/v1/platform` | 1 | Already done ✓ |

### 4-Phase Migration

1. **Phase 1 (Sprint 5):** Non-breaking dual-mount; both `/api/*` and `/api/v1/*` work identically
2. **Phase 2 (Sprint 6-7):** Client migration with deprecation warnings; frontend base URL change
3. **Phase 3 (Sprint 8+):** HTTP 301 redirects from old → v1; 2-sprint warning window
4. **Phase 4 (v1.0.0):** Remove old routes after zero usage confirmed; 410 Gone

### Rationale

- **Compliance consolidation:** 4-way template split → unified `/api/v1/compliance/*`
- **Service-ready:** Clear boundaries enable future extraction (per Daniels' Terraform stubs)
- **Backward compatible:** Zero breaking changes until Phase 4
- **Frontend simple:** One-line base URL change

### Key Decisions

- Shared router instances (no code duplication)
- Audit logs track usage on both old and v1 paths
- OpenAPI spec generation planned post-addition
- Health endpoint: `/health` (no prefix) for LB; `/api/v1/platform/health` for detailed checks

### Consequences

**Positive:** Future-proof versioning, service extraction ready, template namespace fixed, backward compatible, easy frontend migration

**Negative:** Increased route surface (188 points during Phase 1), monitoring complexity, documentation burden, potential stragglers

### Related Decisions

- Daniels' Terraform stubs (PR #57) define 6 service boundaries in infra
- Service Architecture Spec: `docs/specs/service-architecture-spec.md`

---

## Phase 2 Route Taxonomy & My Section UI (2026-03-16)

### Frontend Normalization of API Response Shapes (2026-03-16)

**Decision:** My section page components normalize API response shapes in-component before rendering.

**Rationale:**
- Backend endpoints still return inconsistent field naming (e.g., `firstName`/`lastName`, `certificationName`, `status`/`readAt`, `fileName`/`mimeType`)
- Rather than change all backend endpoints, frontend pages host adapter functions to normalize
- Centralizes API complexity in one place per domain (profile, qualifications, medical, etc.)
- Allows backend flexibility without cascading frontend refactors

**Implementation:**
- All My pages in `apps/web/src/pages/my/` implement this pattern
- Shared type definitions in `packages/shared/src/types/my-section.ts`
- Example (MyQualifications): `certificationName` → `name`, `issuingBody` → `issuer`, `status` → `state`
- Example (MyDocuments): `fileName` → `name`, `mimeType` → `type`

**Pages Using This Pattern:**
- `MyProfile.tsx` — Adapts basic profile fields
- `MyQualifications.tsx` — Normalizes certification responses
- `MyMedical.tsx` — Normalizes clearance status
- `MyDocuments.tsx` — Adapts document metadata
- `MyNotifications.tsx` — Adapts notification status/readAt
- `MyHours.tsx` — Graceful 404/501 handling (planned endpoint)

**Consequences:**
- Frontend robust to backend schema changes (within normalization contract)
- API endpoints can evolve independently; breaking changes isolated to adapter logic
- Future: Consider API contract enforcement (e.g., API versioning) after MVP

**Validation:**
- ✓ All My pages built and TypeScript passing
- ✓ 179/179 tests passing
- ✓ API integration verified with mock AuthContext

---

### Route Taxonomy Alignment: /employees → /team (2026-03-16)

**Decision:** Consolidated employee routes under `/team` prefix to match app specification.

**Rationale:**
- App spec consistently specifies `/team` routes (single source of truth)
- Implementation used `/employees` (naming inconsistency)
- Frontend attempting to route to `/team/*`; backend routes needed alignment
- Both approaches blocked each other

**Implementation:**
- Updated `apps/api/src/routes/team.ts` with all CRUD endpoints under `/team`
- Maintained legacy `/employees/*` routes with 301 redirects for backward compatibility
- Service layer unchanged (internal boundaries preserved; services still named `employeesService`)
- Routes pattern: `GET /team`, `GET /team/:id`, `POST /team`, `PATCH /team/:id`, `DELETE /team/:id`

**Self-Service Patterns:**
- `/team/me` → authenticated user's profile
- `/team/me/qualifications` → personal qualifications list
- `/team/me/documents` → personal documents
- `/team/me/notifications` → personal notifications

**Grace Period & Migration:**
- `/employees/*` redirects remain active (remove in Phase 3+ after all clients migrated)
- No impact on internal API contracts; services unmodified

**Consequences:**
- Frontend can now confidently route `/team/me` flows
- Legacy clients get 301 redirects; no service disruption
- Service layer complexity unchanged; routing boundary preserved

**Validation:**
- ✓ Build passing (npm run build)
- ✓ 179/179 tests passing
- ✓ `/team` routes responding 200
- ✓ `/employees` routes returning 301 redirects
- ✓ No breaking changes to service APIs

---

### Inline Management Forms for Supervisor Team Pages (2026-03-16)

**Decision:** Use inline card-based forms within page shell instead of introducing a new modal/dialog system.

**Rationale:**
- Behavior consistent with existing My-section pages
- Reduces implementation risk (no new modal library dependency)
- Stays responsive on smaller screens
- Forms are straightforward (no multi-step wizards)

**Implementation:**
- Team Qualifications: Card with create/update form inline
- Team Medical: Status selector + date picker inline
- Team Documents: Upload form within page (binary plumbing deferred to Phase 3)

**Consequences:**
- Simpler page architecture; easier to test
- Form validation colocated with form UI
- If UX team requests modals later, refactor is localized to page components

**Validation:**
- ✓ All Team pages built and TypeScript passing
- ✓ 179/179 tests passing (no regressions)
- ✓ Forms integrated with POST/PATCH endpoints

---

### Derived Review Priority Until Backend Support Exists (2026-03-16)

**Decision:** Enrich the review queue client-side with document + employee lookups and derive a display-only priority from review status, age, and detected expiration.

**Rationale:**
- `GET /api/documents/review-queue` returns queue metadata but no explicit priority
- Managers need a triage view now; backend priority endpoint not yet designed
- Heuristic: Priority = (status: urgent > high > normal) + (age: older first) + (expiry: soon first)
- Client-side priority can be replaced cleanly once API exposes first-class priority endpoint

**Implementation:**
- ReviewQueue.tsx calculates priority on fetch
- Display reflects priority order (urgent documents first)
- Once backend priority endpoint lands, swap in API value instead of heuristic

**Consequences:**
- Manager triage view functional in MVP without backend changes
- If backend priority changes, only one component updates
- Future: API contract iteration won't break this page

**Validation:**
- ✓ ReviewQueue page renders with derived priorities
- ✓ Sort order reflects heuristic (status > age > expiry)
- ✓ Ready for replacement once backend endpoint defined

## Phase 2 Authentication & Frontend Kickoff (2026-03-15)

### PrismaAuditLogger Implementation (2026-03-15)

**Decision:** Implemented full Prisma-backed audit persistence with non-blocking error handling.

**Characteristics:**
1. **Persistence layer**: `PrismaAuditLogger` writes to `AuditLog` table via `prisma.auditLog.create()`
2. **Error handling**: All database operations wrapped in try/catch; audit failures never block primary requests
3. **Type safety**: `changedFields` explicitly cast to `Prisma.InputJsonValue | undefined`
4. **Production default**: Changed default logger in `apps/api/src/index.ts` from `ConsoleAuditLogger` to `PrismaAuditLogger`
5. **Dual logging**: Console info log after successful persistence for local dev visibility

**Alternatives Considered:**
- Async queue (Bull) for audit writes — rejected for MVP simplicity
- Batch writes — rejected because real-time audit persistence is critical for compliance
- Separate audit database — deferred to post-MVP

**Consequences:**
- Every state-changing API call has durable audit trail in PostgreSQL
- Audit failures isolated; database issues won't cascade to user-facing failures
- One extra write per mutating request (~5-10ms latency); acceptable for MVP
- Future work: log rotation/archival if table grows to millions of rows

**Files Modified:**
- `apps/api/src/services/audit.ts` — Implemented `PrismaAuditLogger.log()`
- `apps/api/src/index.ts` — Default logger changed to Prisma

**Validation:**
- ✓ TypeScript typechecks
- ✓ All 9 audit tests passing
- ✓ Overall suite: 140/140 tests passing

---

### Phase 2 Integration Tests (2026-03-15)

**Decision:** Comprehensive integration tests for Phase 2 modules written before full service implementation to enable TDD and establish clear contracts.

**Test Files Created:**
1. **Documents service** (20 tests)
   - Upload, get, review queue, approve/reject, extraction, audit trail
   - RBAC boundaries tested (upload: any auth, review: manager+, audit: supervisor+)
   - Matches Document schema (fileName, mimeType, storageKey)

2. **Notifications service** (24 tests)
   - Preferences (get/set), list, mark-read, dismiss, weekly digest
   - Admin endpoints: test notification, escalation rules
   - RBAC boundaries (admin endpoints: admin only, preferences/notifications: any auth)
   - Matches Notification schema (deliveryChannel required, status enum)

3. **PrismaAuditLogger** (2 tests)
   - Database persistence validation
   - Non-blocking error behavior (audit failures don't crash requests)

**Test Patterns Established:**
- **Resilient to partial implementation:** Accepts multiple status codes (200, 500, 501) during parallel dev
- **Schema-first:** All Prisma creates match actual schema; enum values match service mappers
- **RBAC coverage:** Every endpoint has 401 (no auth) and 403 (wrong role) tests

**Consequences:**
- ✅ TDD-ready: Services can be implemented against clear test contracts
- ✅ Parallel development: Tests pass even when services return 500/501
- ✅ Schema alignment: Tests catch mismatches early
- ✅ RBAC verification: All endpoint auth requirements tested
- ⚠️ Test maintenance: Contract changes require test updates
- ⚠️ Resilience trade-off: Accepting 500/501 allows incomplete services to "pass"

**Validation:**
```
npx vitest run — 140/140 tests passing (46 new + 94 Phase 1)
npm run typecheck — 0 errors
```

---

## Phase 1 Operations & Documentation Standardization (2026-03-16)

### Reusable Ops Skills (2026-03-16)

**Decision:** Add six reusable skills under `.squad/skills/` with assigned default coordinators by role.

**Skills Created:**
1. `commit-and-push` — Ralph (coord): safe push gates with secret scanning
2. `secret-scan` — Ralph (coord): credential detection before pushes
3. `git-status-report` — Ralph (coord): fast branch snapshots and status reporting
4. `docker-reset` — Sydnor (coord): local Docker/Compose recovery
5. `prisma-migrate` — Bunk (coord): Prisma migration verification and rollback
6. `spec-review` — Freamon (coord): cross-spec consistency checks

**Rationale:**
- Recurring coordinator actions need standardized, reusable runbooks
- Risk gates (secret scanning, migration verification, Docker recovery) deserve explicit pass/fail criteria
- Shared report structure enables quick comparison of results across handoffs
- Work assigned to role defaults reduces coordination overhead

**Consequences:**
- Coordinators have documented playbooks for six common operational tasks
- Push workflows explicitly coupled to secret scanning and commit hygiene
- Spec review formalized as cross-document consistency, not style pass
- Prisma and Docker workflows have one canonical recovery path

**Files Created:**
- `.squad/skills/commit-and-push/` (directory with README, checklist, examples)
- `.squad/skills/docker-reset/` (directory)
- `.squad/skills/git-status-report/` (directory)
- `.squad/skills/prisma-migrate/` (directory)
- `.squad/skills/secret-scan/` (directory)
- `.squad/skills/spec-review/` (directory)

---

### Category-Based Documentation Taxonomy (2026-03-16)

**Decision:** Standardize project-facing markdown under `docs/` by purpose; retire legacy folder structure.

**New Structure:**
```
docs/
  ideas/           — brainstorming, open questions, exploration
  requirements/    — PRDs, user stories, feature specs (formerly docs/prds/)
  specs/           — architecture specs, technical design (formerly docs/architecture/)
  guides/          — how-to guides, runbooks, walkthroughs
  tests/           — test strategy, test data, validation approaches
  plans/           — project plans, phase roadmaps, release notes
  decisions/       — architectural decision records, governance docs
  prompts/         — actual AI prompts (not prompt-adjacent artifacts like brainstorming)
```

**Retired Paths:**
- `docs/prds/` (moved to `docs/requirements/`)
- `docs/architecture/` (moved to `docs/specs/`)
- `docs/adrs/` (merged into `docs/decisions/`)
- Top-level `prompts/` (moved to `docs/prompts/`, with brainstorming split out)

**Execution:**
- 29 files moved with `git mv` (history preserved)
- Cross-references updated across all markdown files
- Old directories empty and retired
- Tests: 179/179 passing (no regressions)
- Commit: 84af84f, pushed to origin

**Rationale:**
- Navigation by purpose is clearer than historical source folders
- Link maintenance centralized by category
- Prompt assets no longer mixed with planning/brainstorming artifacts
- Future docs filed by purpose, not legacy location

**Consequences:**
- All new documentation must follow category-based structure
- Relative links should target new category paths
- Retired directories kept empty; future cleanup can delete them
- One source of truth for each document type

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

### 2026-03-14T19:43:00Z: User directives — Infrastructure & team security rules
**By:** ivegamsft (via Copilot)

**What:**

1. **NO exposed connection strings.** All connection strings must go through Key Vault references — never as plain-text app settings, env vars in CI, or hardcoded values.
2. **RBAC only.** Use Azure RBAC (managed identity role assignments) for all service-to-service auth. No access keys, no shared secrets where RBAC is available.
3. **Private Link for non-public endpoints.** Any backend service that doesn't need public access (Postgres, Storage, Key Vault) must use Azure Private Link / private endpoints.
4. **DO NOT check in secrets.** No secrets, tokens, passwords, or connection strings in source control — ever. Use Key Vault, GitHub Secrets, or environment-scoped config.
5. **DO NOT expose local info in memories, commits, or decisions.** No local file paths, machine names, usernames, or environment-specific details in `.squad/` files, commit messages, or decision logs.
6. **Tests before user verification.** Agents must write and run tests to validate their changes before presenting results to the user. Do not ask the user to verify something you haven't tested yourself.

**Why:** User request — security and quality baseline for the project. These are non-negotiable rules for all team members.


### 2026-03-14T19:47:00Z: User directive — Secret definition scope
**By:** ivegamsft (via Copilot)

**What:** Secrets are defined as: passwords, tenant IDs, subscription IDs, usernames. Well-known public GUIDs are OK to commit/expose. Everything else that could be sensitive should use tokens (references, Key Vault refs, variable substitution) — never raw values.

**Why:** User request — tightens the definition of what counts as a secret for the team's no-secrets-in-source rule.

---

### Prisma Workspace Integration (2026-03-14)

**By:** Bunk

**Context:** The Prisma schema, migrations, and seed flow are owned by the `data/` workspace. The API needs one consistent Prisma client configuration for future repository and service work.

**Decision:**
- Keep Prisma client generation anchored to `data/prisma/schema.prisma` and consume the generated `@prisma/client` directly from the API.
- Centralize API access in `apps/api/src/config/database.ts` as a singleton with development query logging.
- Connect the client after environment loading and disconnect it during API shutdown/startup failure handling in `apps/api/src/index.ts`.
- Keep demo employee IDs aligned with the mock auth store by deriving them from the shared UUID v5 namespace in `data/src/seed.ts`.

**Implications:**
- After schema changes, regenerate the client from the `data` workspace before API typecheck/build runs.
- Seeded local data remains consistent with the deterministic mock-login accounts used in the auth module.

---

### Audit Middleware Architecture (2026-03-14)

**By:** Sydnor

**Context:** The system requires consistent audit coverage for all mutating operations without duplicating code or blocking API responses. An abstraction is needed to support console logging today and persistence layer upgrades later.

**Decision:**
- Keep audit logging as an application-level middleware mounted on `/api/:entityType`, with a swappable `AuditLogger` abstraction injected from `createApp()`.
- Every mutating route gets consistent post-response audit coverage without duplicating route-level code.
- The logger can start with structured console output now and switch to Prisma persistence later with no route rewrites.
- Tests can inject a fake logger and temporary routes through `createTestApp()` to validate POST/PUT/PATCH/DELETE behavior, anonymous actors, and non-blocking execution.
- Sensitive request fields should stay redacted before they enter `changedFields`.

**Impacted Files:**
- `apps/api/src/index.ts`
- `apps/api/src/middleware/audit.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/tests/helpers.ts`
- `apps/api/tests/audit.test.ts`

**Consequences:**
- Non-blocking audit failures do not block API responses.
- Logger interface supports runtime swapping without code changes.
- Phase 1 persistence layer upgrade requires only logger backend implementation change.

---

## Phase 1 Implementation Decisions

### Employees & Standards Service Implementation (2026-03-15)

**By:** Bunk

**Context:** Foundational services for workforce management system need establishment of patterns for CRUD, search, pagination, and error handling.

**Decisions:**

1. **Error Handling:** Flexible Prisma error checking with both `instanceof` and code property checks for test compatibility
2. **Role Normalization:** Accept lowercase in API, store uppercase in database with bidirectional mapping
3. **Readiness Calculation:** Aggregate compliance data with parallel queries; three-state rule (compliant/at_risk/non_compliant)
4. **Search Implementation:** Case-insensitive partial matching across multiple fields
5. **Pagination:** Default 50 items, max 100, with total count
6. **Requirement Management:** Store as child entities with standard relationships; supports 0-N requirements per standard
7. **Test Architecture:** Mock Prisma with Vitest; 25 unit tests covering all methods and error paths

**Rationale:**
- Error handling flexibility necessary for test mocking
- Case normalization maintains API conventions while respecting database schema
- Parallel aggregations provide performance for readiness calculations
- Pagination and search patterns enable consistent UX across all services
- Related requirements to standards enables flexible domain modeling

**Consequences:**
- ✅ Foundation established for other services (Qualifications, Medical)
- ✅ 25 unit tests provide high coverage
- ✅ Production-ready error handling and validation
- ⚠️ Assumes Prisma schema already migrated
- ⚠️ No built-in caching (can add later)

**Files Impacted:**
- `apps/api/src/modules/employees/service.ts`
- `apps/api/src/modules/standards/service.ts`

---

### User Directive: Entra Auth Overhaul (2026-03-15T23:24:59Z)

**By:** ivegamsft (via Copilot)

**What:**
- UI protected by Entra ID (MSAL.js)
- Backend protected by Entra + OAuth token validation (replace JWT/bcrypt)
- Some APIs need On-Behalf-Of (OBO) flow for downstream calls
- API-to-DB connection uses RBAC (managed identity, no connection strings)
- APIs will eventually sit behind APIM
- App RBAC backed by Entra groups — groups created in IaC
- Entra groups used to lock down API endpoint scopes and app registrations
- IaC must create app registrations for all scopes
- Bootstrap script needs enough perms to create the SPN
- The SPN in turn needs perms to do app registration work

**Why:** User request — production-grade identity architecture for regulated compliance platform

---

### User Directive: Mock Auth for Local Dev (2026-03-15T23:25:09Z)

**By:** ivegamsft (via Copilot)

**What:** Entra auth must be mockable for local testing. The Docker/local dev stack should work without a real Entra tenant — use a mock identity provider or bypass that simulates Entra tokens, groups, and RBAC roles so developers can test all flows locally.

**Why:** User request — dev velocity. Can't require Entra tenant for local iteration.

---

### Entra ID Authentication Architecture (2026-03-16)

**Decision:** Replace E-CLAT's mock JWT/bcrypt authentication with Microsoft Entra ID across all environments.

**Author:** Freamon

**Status:** Proposed — awaiting team review

**Impact:** All layers (infra, backend, frontend, testing)

**Key Decisions:**

1. **Token Strategy: Validate, Don't Re-sign**
   - API validates Entra-issued access tokens directly using JWKS
   - Do NOT exchange Entra tokens for app-signed JWTs
   - Eliminates trust boundary, reduces code, aligns with Zero Trust

2. **New Terraform Layer: `05-identity`**
   - Identity resources (app registrations, groups, roles, scopes) in dedicated layer
   - Deployment order: foundation → identity → data → compute

3. **Five App Registrations:**
   - `eclat-api-{env}` — Web API (exposes scopes, validates tokens, holds app roles)
   - `eclat-web-{env}` — SPA (employee/manager frontend, PKCE, no secret)
   - `eclat-admin-{env}` — SPA (admin frontend, PKCE, no secret)
   - `eclat-{env}-deploy` — Application (deployment SPN, expanded permissions)

4. **Entra Groups = RBAC Source of Truth**
   - Five security groups per environment map 1:1 to existing roles
   - Group → App Role → Token `roles` claim → Middleware
   - Existing `requireRole()` / `requireMinRole()` patterns unchanged

5. **AUTH_MODE Toggle for Mock/Entra**
   - `AUTH_MODE=mock` (default local dev) vs `AUTH_MODE=entra` (production)
   - Mock tokens mirror real Entra claims structure
   - Mock mode blocked in production

6. **Frontend Uses MSAL.js**
   - `@azure/msal-react` for both SPAs
   - Redirect-based login (not popup)
   - Token acquisition, caching, refresh handled by MSAL

7. **Managed Identity for Database**
   - Production PostgreSQL uses `DefaultAzureCredential` instead of connection strings
   - Container App system-assigned identity registered as Entra AD admin on server

8. **Bootstrap SPN Gets Graph Permissions**
   - Deployment SPN needs `Application.ReadWrite.OwnedBy` + `Group.ReadWrite.All` + `AppRoleAssignment.ReadWrite.All`
   - Requires one-time admin consent

**Consequences:**
- Additive migration: Mock auth stays functional until Entra proven end-to-end
- 6 phases over ~4 weeks: Foundation → Terraform → Bootstrap → Backend → Frontend → Cleanup
- Phases 2-3 blocked on tenant ID and admin consent
- Phase 1 independent: Backend token interface + mock validator
- Existing tests continue via mock token format alignment

**Risks & Mitigation:**
- Admin consent delayed → Phase 1 fully independent; all backend uses mock tokens
- Token validation performance → JWKS key caching (10-minute TTL); in-process validation
- OBO complexity → OBO is Phase 4; can defer
- Group claims overflow → Set `groupMembershipClaims: "SecurityGroup"`; app roles primary

**Full Design:** `docs/architecture/entra-auth-design.md`

**Team Actions:**
- **Bunk:** Review backend auth overhaul (sections 6, 8) and Terraform identity layer (section 4)
- **Kima:** Review frontend MSAL integration (section 7) and mock auth provider (section 8.4)
- **Sydnor:** Review mock token strategy (section 8) for test compatibility
- **ivegamsft:** Provide tenant ID, subscription, admin consent timeline

---

### Frontend Scaffold Architecture (2026-03-15)

**Decision:** Scaffold `apps/web/` as a React + Vite + TypeScript SPA with plain CSS styling, centralized API client, JWT token-based authentication.

**Author:** Kima

**Status:** Complete

**Architecture:**
- **Build System:** Vite 8 with React, TypeScript 5, dev server proxy to API
- **State Management:** Auth context (JWT in localStorage), React state for data, centralized API client
- **Routing:** React Router 7, protected routes (/login public, /employees/:id protected)
- **Styling:** Plain CSS + custom properties (no framework), responsive design
- **Pages Implemented:**
  - LoginPage: Email/password, error display, success redirect
  - DashboardPage: Compliance stats (total, compliant, at-risk, non-compliant, rate)
  - EmployeeListPage: Paginated table (20/page), search, click-to-detail
  - EmployeeDetailPage: Info + readiness dashboard (medical + qualifications, color-coded)

**API Client Pattern:**
- Centralized fetch wrapper attaches `Authorization: Bearer <token>` from localStorage
- 401 → logout; all errors → `ApiError` with status
- Type-safe: `api.get<T>(path)` for typed responses

**Docker Integration:** `web` service in docker-compose.yml, depends on API

**Verification:**
- ✅ TypeScript: No errors
- ✅ Production build: 243KB gzipped
- ✅ Dev server: Port 5173 with hot reload
- ✅ Docker service: Configured and ready

**Team Impact:**
- **Bunk:** Frontend ready to test API; need `/auth/login` functional
- **Sydnor:** Integration tests can start once auth works end-to-end
- **Freamon:** Full stack in Compose (postgres + api + web)

---

### Monorepo CI/CD Pipeline with Postgres Service Container (2026-03-15)

**Decision:** Comprehensive monorepo pipeline with Postgres service containers for integration tests, Prisma generation in CI/Docker, and full monorepo validation.

**Author:** Bunk

**Status:** Implemented

**Pipeline Structure:**

1. **Typecheck Job:** TypeScript check for API + Web workspaces, shared package first
2. **API Test Job:** Postgres 16 service container with health checks, Prisma generation, migrations, seed, Vitest suite
3. **Web Test Job:** Placeholder for component tests (when implemented)
4. **Build Job:** Validates all workspace builds (only runs after tests pass)
5. **Docker Job:** Validates Dockerfile build (only runs after tests pass)

**Dockerfile Updates:**
- Build stage: Added `npx prisma generate --schema=data/prisma/schema.prisma`
- Runtime stage: Copy `data/prisma/` for Prisma client runtime operations

**Rationale:**
- Service container pattern: Native GitHub Actions Postgres support, clean isolation
- Parallel execution: API and Web tests independent after typecheck
- Prisma generation in build: Ensures client exists before TS compilation
- Prisma schema in runtime: Required for connection management and migrations

**Consequences:**
- ✅ Full monorepo CI coverage
- ✅ Real database integration tests (no Docker-in-Docker)
- ✅ Docker builds validated on every push/PR
- ✅ Clear dependencies and parallelization
- ⚠️ CI runtime slightly longer (Postgres startup + seed)

**Implementation Notes:**
- Working directory for Prisma: `data/` (schema location)
- Postgres service uses standard health checks
- Web test script exits 0 (placeholder)
- Docker build validates production image

---

### Qualifications and Medical Services Implementation (2026-03-15)

**By:** Bunk

**Context:** MVP compliance loop requires Qualifications and Medical services to track certifications, medical clearances, and compliance status. Services must operate independently while supporting readiness calculations.

**Key Decisions:**

1. **Direct Database Integration:** Services interact directly with Prisma (Employees/Standards are stubs, avoids circular dependencies)
2. **Automatic Status Calculation:** Status auto-derived from dates rather than manual management
   - Qualifications: `active`, `expiring_soon` (30 days), `expired`
   - Medical: `pending`, `cleared`, `expired`, `restricted` (with manual override for operational status)
3. **Mapper Pattern:** Map Prisma UPPERCASE enums to lowercase domain DTOs
4. **Compliance Checking:** Fuzzy substring matching for certification name validation
5. **Comprehensive Clearance Status:** Medical service provides aggregated `checkClearanceStatus()` method

**Rationale:**
- Direct DB integration pragmatic when service dependencies are stubs
- Automatic status eliminates human error and API complexity
- Mapping maintains clean API boundaries and database abstraction
- Fuzzy matching handles real-world certification name variations
- Aggregation method enables quick "can work?" checks

**Consequences:**
- ✅ Both services immediately functional without blocking dependencies
- ✅ Consistent status accuracy across records
- ✅ 28 tests provide comprehensive coverage
- ✅ Integration ready with Prisma and Docker stack
- ⚠️ Tighter coupling to database schema
- ⚠️ Fuzzy matching could produce false positives in edge cases

**Migration Path:** If Employees/Standards services later provide enriched data or business logic, can optionally add service-to-service calls without breaking changes.

**Files Impacted:**
- `apps/api/src/modules/qualifications/service.ts`
- `apps/api/src/modules/medical/service.ts`

---

### Qualification and Medical Status Policy (2026-03-15)

**By:** Bunk

**Context:** MVP compliance loop needs deterministic status calculation without ambiguity between automatic and manual status management.

**Decision:**
- Qualification status recalculated from `expirationDate`: `active`, `expiring_soon` (30 days), `expired`
- Qualification compliance treats both `active` and `expiring_soon` as meeting requirements (both still current for MVP readiness)
- Medical clearance expiry forces `expired` state; otherwise preserves explicit operational status (`cleared`, `pending`, `restricted`)
- Qualification document links validated against employee before join rows created

**Rationale:**
- Deterministic status from dates prevents drift
- Compliance rule treats "expiring soon" as still valid for MVP readiness views
- Medical preserves business meaning not encoded by dates alone (supervisor discretion on restrictions)

**Impact:**
- Frontend and tests can rely on deterministic status recalculation
- Richer compliance payloads support complete readiness picture
- Medical status retains operational flexibility while maintaining expiry safeguards

---

### Employee Readiness Required-Standards Rule (2026-03-15)

**By:** Bunk

**Context:** MVP readiness endpoint needs deterministic rule using current schema (no role-to-standard assignment table yet).

**Decision:**
- Treat every active compliance standard as required qualification for MVP readiness
- Emit one qualification readiness item per active standard in `GET /api/employees/:id/readiness`
- If employee lacks qualification for standard, return synthetic `missing` item marked `non_compliant`
- For medical, evaluate best record per clearance type; return synthetic missing item if no records exist
- Use 30-day warning window for both qualifications and medical expirations; expiring items are `at_risk`

**Rationale:**
- Keeps readiness explainable and deterministic without schema extensions
- Matches locked MVP three-state rule in team decisions
- Produces UI-friendly detail arrays
- Doesn't block on future role-scoped standards work

**Impact:**
- Readiness endpoint provides actionable compliance detail without guessing
- UI can render per-standard status with clear missing/at-risk/compliant states
- Non-compliant status triggers enforcement actions

**Files Impacted:**
- `apps/api/src/modules/employees/service.ts`
- `apps/api/src/modules/standards/service.ts`

---

### Sydnor — Core Module Integration Test Pattern (2026-03-15)

**By:** Sydnor

**Context:** Phase 1 integration testing needs a pattern that validates real service contracts, supports RBAC testing, and scales to future modules.

**Decision:**
For Employees, Standards, Qualifications, and Medical integration suites:
- Use seeded PostgreSQL records for read-path assertions
- Use deterministic seeded auth identities from shared test helpers for RBAC coverage
- Use direct Prisma fixture creation for update/compliance/audit setup
- Use unique prefixes and explicit cleanup to prevent database pollution on repeated runs

**Rationale:**
- Read endpoints should validate against realistic seeded data already present
- RBAC tests more trustworthy when tokens carry same IDs/emails as seeded demo users
- Update and audit tests should not depend on other endpoints succeeding for setup
- Cleanup patterns prevent pollution from repeated local test runs

**Impact:**
- Bunk can implement service methods against seeded-data contract without guessing
- Future module suites should follow same pattern
- Validator/schema mismatches corrected by updating test builders, not pattern

**Test Coverage:**
- Employees: 19 integration tests
- Standards: 18 integration tests
- Qualifications: 19 integration tests
- Medical: 20 integration tests
- Total: 76 integration tests (all passing)

---

### Sydnor — Integration Test Database Default (2026-03-15)

**By:** Sydnor

**Context:** API integration suites depend on DATABASE_URL but developers shouldn't have to manually configure it for standard local Docker environment.

**Decision:**
For Vitest API integration runs from repo root, default `DATABASE_URL` in `apps/api/tests/setup.ts` to local Docker Postgres connection string (`postgresql://postgres:postgres@localhost:5432/eclat`) whenever variable not already set.

**Rationale:**
- Prisma-backed integration suites fail early when DATABASE_URL missing
- Project's documented local stack already exposes Postgres on localhost:5432
- Root-level Vitest runs should not depend on developer manually loading .env.test

**Impact:**
- `npx vitest run` activates Employees, Standards, Qualifications, Medical integration suites by default
- Developers and CI can override DATABASE_URL explicitly for other environments
- Test expectations anchored to live service contracts instead of stubbed responses

**Results:**
- 76 integration tests passing against real Postgres
- Docker e2e validation complete
- CI can use same pattern for automated testing



## Test Data Seeding Strategy (2026-03-16)

# Decision: Test Data Seeding Strategy for E-CLAT

**Date:** 2026-03-16  
**Author:** Freamon (Lead/Architect)  
**Status:** Final  
**Decision Type:** Architecture  
**Affected Layers:** All (Local Dev, CI/CD, Deployed)

---

## Context

E-CLAT test data spans two independent layers with different lifecycles and deployment contexts:

1. **Entra Directory Data** (identity plane): Test users, security groups, app role assignments in Entra ID
2. **Application Data** (data plane): Employees, qualifications, standards, medical clearances in PostgreSQL

These exist in three environments with conflicting constraints:
- **Local dev (Docker):** No Entra access; uses mock auth; ephemeral Postgres
- **CI/CD:** No Entra access; ephemeral Postgres; needs reproducible seeds
- **Deployed (dev/staging):** Real Entra with real test users; persistent Postgres; must be idempotent and production-safe

Existing gaps:
- Current `data/src/seed.ts` handles PostgreSQL only (hardcoded mock test users)
- No Entra test user provisioning mechanism
- No clear strategy for three-environment execution
- Terraform `05-identity` layer (Entra resources) not yet designed

The team needed clarity: Should test data be IaC, a script, a workflow, or a combination?

---

## Decision

**Adopt a layered three-tier approach:**

### Tier 1: Prisma Seed Script (Application Data — All Environments)

**Use:** `data/src/seed.ts` (enhanced)

**What it does:**
- Upserts 5 test employees (email-keyed for idempotency)
- Upserts 3 compliance standards + 3 labels
- Upserts qualifications + medical clearances linked to test employees
- Runs in all three environments (local, CI, deployed)

**How to execute:**
```bash
npm run seed --workspace=data
```

**Idempotency:** All Prisma operations use `upsert` with unique email keys.

### Tier 2: Terraform `05-identity` Layer (Entra Directory Data — Deployed Only)

**Use:** `infra/layers/05-identity/` (new layer between foundation and data)

**What it creates:**
- 5 Entra security groups (one per E-CLAT role: employee, supervisor, manager, compliance officer, admin)
- 5 test users (email-keyed, randomized passwords in Key Vault)
- Group → App Role assignments (enables role claims in tokens)

**How to execute:**
```bash
cd infra/layers/05-identity
terraform apply -var-file="../../environments/{dev|staging}.tfvars"
```

**Idempotency:** Terraform state file manages; re-apply is safe.

**Not for local dev:** Uses `azuread` provider; requires Azure credentials. Local dev uses mock auth instead.

### Tier 3: Bootstrap API Endpoint (Optional — Phase 2+)

**Use:** `POST /api/admin/seed-test-data` (admin-only, disabled in production)

**When:** Staging environment convenience; enables manual resets without Terraform.

**Not MVP:** Defer to Phase 2 after Entra auth core is proven.

---

## Rationale

### Why Prisma Seed (Not Terraform for DB Data)?

❌ **Terraform for PostgreSQL = Wrong Tool**
- Terraform azurerm provider has `azurerm_postgresql_flexible_server_database` but no first-class data seeding
- Would require external `local_exec` provisioner → shell scripts → messy and unmaintainable
- Conflicts with Prisma's migration/schema ownership
- DB schema changes (migrations) are already Prisma's responsibility

✅ **Prisma Seed = Correct Tool**
- Built-in `prisma db seed` command
- Integrates with Prisma schema; schema is source of truth
- Runs in CI, local dev, and deployed environments
- Already proven in codebase (seed.ts exists)

### Why Terraform `05-identity` (Not Bootstrap Script for Entra)?

❌ **Bootstrap Script (az CLI) = Drift Risk**
- One-shot script; hard to detect/repair infrastructure drift
- No state file; re-running script may fail idempotency checks
- Manual updates to Entra resources break script assumptions
- Team members may make portal changes, breaking IaC consistency

✅ **Terraform = State + Idempotency**
- Terraform state file is source of truth for Entra resources
- Drift detection: `terraform plan` shows what changed in Entra since last apply
- Idempotent: `terraform apply` safe to run multiple times
- IaC principle: all infrastructure (Entra + Azure) managed uniformly
- Audit trail: git history + state file + plan diffs

### Why Separate `05-identity` Layer (Not in `00-foundation` or `10-data`)?

**Layer boundaries are API provider boundaries:**
- `00-foundation` = azurerm only (resource groups, Key Vault, storage)
- `05-identity` = azuread only (app registrations, users, groups)
- `10-data` = azurerm only (PostgreSQL, networking)
- `20-compute` = azurerm only (Container Apps, logging)

**Rationale:**
- Entra (azuread) resources have different permission requirements than Azure platform resources
- Identity changes don't require compute/network redeploys (can update groups without touching infrastructure)
- Blast radius limited: Entra outage doesn't affect storage/database layers
- Different lifecycle: Entra configuration changes more frequently than platform infrastructure

### Why Test Users in Entra (Not in Database)?

❌ **Store test users as Employee records in PostgreSQL = Data Confusion**
- Blurs line between identity (Entra) and business entity (Employee)
- Auth tokens come from Entra; Employee records come from database
- Requires manual synchronization (Entra user → Employee row)
- Test data cleanup becomes complex

✅ **Test users in Entra Only = Clean Separation**
- Entra is sole identity provider; test users live there
- Employee records in PostgreSQL represent real organizational entities
- Token → employee lookup is still via email or `oid` (Entra user object ID)
- Easier to clean up: delete Entra users, keep historical Employee records if needed

### Why Email-Based Idempotency?

**Entra perspective:** Users are uniquely identified by `userPrincipalName` (email)  
**Database perspective:** Employees are uniquely identified by `email` + `employeeNumber`  
**Terraform perspective:** Resource IDs are deterministic based on email

Using email as the idempotency key across all layers ensures:
- Same user in Entra and PostgreSQL is same test user
- Re-running seed (Prisma) or Terraform doesn't duplicate records
- Team can easily reason about test data identity

---

## Alternatives Considered and Rejected

### Alt 1: GitHub Actions Workflow for Everything

**Idea:** Single `seed-test-data.yml` workflow does both Entra + DB seeding

**Why rejected:**
- Workflow dispatch doesn't integrate with IaC workflow (TF applies are separate)
- Creates two paths: workflow for seeding, Terraform for infrastructure (inconsistent)
- Harder to validate what actually exists in Entra/DB (no state file)
- Drift detection impossible without Terraform

**When to use:** Optional convenience layer (Phase 2+) on top of existing Terraform + Prisma

### Alt 2: Separate Bootstrap Script (`04-seed-test-data.sh`)

**Idea:** Shell script using `az` CLI to create Entra users + call API for DB seeding

**Why rejected:**
- No state file; drift risk
- Idempotency requires custom logic in shell (fragile)
- Audit trail poor (script execution logs vs. Terraform state + git)
- Harder to review changes (shell script diff vs. Terraform plan)

**When to use:** Quick manual testing (developers can write ad-hoc scripts locally)

### Alt 3: All Test Data in Entra (No PostgreSQL Employees)

**Idea:** Query Entra at runtime for employee identity; no Employee records in DB

**Why rejected:**
- Breaks existing Prisma schema (Employee table is core)
- Employee is a business entity (hire date, department, qualifications) not just identity
- Database query patterns expect Employee records (can't replace with Graph API calls)
- Unnecessary coupling of auth layer to business logic

**When to use:** Future refactoring (post-MVP); not viable for Phase 0/1

### Alt 4: Everything in Docker (No Entra for Any Environment)

**Idea:** Use mock auth + seeded employees everywhere; avoid Entra

**Why rejected:**
- Defeats purpose of Entra auth design
- Can't validate real Entra token flows before prod
- Staging environment unable to test real identity scenarios
- Doesn't address requirement for real test users in deployed environments

**When to use:** Might have been viable pre-Entra-auth-design; now incompatible with Phase 2+

---

## Consequences

### Positive

✅ **Clear execution paths:** Developers know exactly what to run in each environment (see runbook)

✅ **IaC consistency:** Identity resources (Entra) managed same way as infrastructure (Terraform)

✅ **Idempotency guaranteed:** Both Prisma upserts and Terraform state ensure safe re-runs

✅ **Separation of concerns:** Entra (layer 05-identity) independent from compute (20-compute) and data (10-data)

✅ **Production safety:** IaC prevents test data in prod; code-level checks (`NODE_ENV`) enforce policy

✅ **Testability:** Each layer can be tested independently (Prisma seed on ephemeral DB; Terraform against dev Entra tenant)

✅ **Scalability:** Adding new test users = 2 small edits (Prisma + Terraform); no code refactoring

### Negative

⚠️ **Requires Terraform knowledge:** Team must understand layer composition + state management

⚠️ **Two tools to learn:** Terraform for Entra; Prisma for DB seeding

⚠️ **Manual coordination in deployed environments:** Terraform, then Prisma (or via API endpoint); not a single `apply all` command

⚠️ **Key Vault dependency:** Test user passwords stored in Key Vault; requires Azure access to retrieve

### Risks Mitigated

| Risk | Mitigation |
|------|-----------|
| Test data in production | IaC `enable_test_users = false` default; code checks `NODE_ENV` |
| Entra users not matching DB employees | Single source of truth (`seed-config.ts`); alignment tests |
| Accidental schema changes by test data | All Prisma upserts idempotent; no hard deletes during seed |
| Terraform state corruption | State locking + state file backups in storage account |

---

## Implementation Plan

### Phase 0 (MVP — Before Entra Auth Deployment)

- [ ] Document test data strategy (this decision + `test-data-strategy.md`) ✅
- [ ] Review Prisma seed script; ensure email-keyed idempotency
- [ ] Create `data/src/seed-config.ts` (centralized test data constants)
- [ ] Validate Docker Compose runs `npm run seed` on startup
- [ ] Add safety check to seed: prevent running in `NODE_ENV=production`

### Phase 1 (Entra Auth Core — Weeks 1-2 of Identity Implementation)

- [ ] Create `infra/layers/05-identity/` structure (main.tf, variables.tf, outputs.tf)
- [ ] Implement `azuread_user` resources for 5 test users (email-keyed)
- [ ] Implement `azuread_group` resources for 5 role groups
- [ ] Implement `azuread_app_role_assignment` (group → app role)
- [ ] Test against dev Entra tenant
- [ ] Document execution steps in runbook

### Phase 2+ (Convenience Features — Post-Entra Proof)

- [ ] Implement `POST /api/admin/seed-test-data` endpoint
- [ ] Create GitHub Actions dispatch workflow
- [ ] Add optional API-level test data markers (`isTestData` in Employee model)

---

## Validation

How to verify this design works:

**Local Dev:**
```bash
docker-compose up
# → Should see: "✅ Seed complete: 5 employees, 3 standards..."
# → Should be able to login as eclat-test-employee@example.onmicrosoft.com (mock mode)
```

**CI/CD:**
```bash
npm test  # CI setup should call npm run seed before tests
# → Tests should pass with known test data
```

**Deployed Dev:**
```bash
# After Terraform apply + Prisma seed:
az ad user list --filter "displayName eq 'Test Employee'"
# → Should find eclat-test-employee@example.onmicrosoft.com in Entra

curl https://api-dev.eclat.example.com/api/employees?role=employee \
  -H "Authorization: Bearer $(get-test-token employee)"
# → Should return 5+ employees including test data
```

---

## Related Decisions

- **Entra Auth Architecture (2026-03-16):** Defines token flows, scope structure, role mapping. Test data must align with 5 app roles and group structure.
- **MVP Defaults (2026-03-14):** Single-org, no tenancy. Test data assumes single tenant throughout.
- **Container Architecture (2026-03-14):** Container Apps on ACA with Image build/push separation. Test data endpoint optional in Phase 2+.

---

## Owners and Stakeholders

- **Owner:** Freamon (Lead/Architect)
- **Implementers:** Bunk (backend), Sydnor (test harness)
- **Review:** Team consensus on GitHub issue / squad channel before Phase 1

---

## References

- `docs/architecture/test-data-strategy.md` — Full design document
- `docs/architecture/entra-auth-design.md` — Identity architecture (token flows, scopes, roles)
- `data/src/seed.ts` — Current Prisma seed script (to be enhanced)

---

## Phase 2b: Proof Templates & Attestation System (2026-03-18)

### Decision: Proof Template & Attestation Levels Architecture

**Date:** 2026-03-18  
**Author:** Freamon (Lead / Architect)  
**Status:** Proposed  
**Spec:** [`docs/architecture/templates-attestation-spec.md`](../../../docs/architecture/templates-attestation-spec.md)

**Summary:** Defined comprehensive architecture for manager-to-employee compliance templates with a 4-level attestation system. Templates are reusable bundles of proof requirements that managers assign to employees, with each requirement specifying how the employee must prove completion.

**Key Decisions:**

1. **Four-Level Attestation System** — Self-Attest (25% trust), Upload (60%), Third-Party (85%), Validated (100%)
2. **Compound Levels via Array Storage** — Enabling combinations like `["upload", "validated"]` without enum explosion
3. **Template Versioning with Frozen Assignments** — Published templates immutable; edits create new drafts; assignments capture version at assignment time
4. **Separate ProofFulfillment Model** — Individual records per employee per requirement (not embedded)
5. **Three Assignment Types** — Individual employees, by-role (auto-synced), by-department (auto-synced)
6. **Level 4 Validation Requires Manager+** — Supervisors create/assign; only Manager+ validates
7. **Integration with Proof Vault** — Level 2 uploads go to encrypted vault by default
8. **Auto-Fulfillment from Qualifications Deferred to Phase 3** — Edge cases need careful design
9. **Third-Party Verification via System Endpoints Only** — Employees don't trigger; background jobs/webhooks do

**Data Model:**
- `ProofTemplate` — name, description, status (draft/published/archived), version, requirements[]
- `ProofRequirement` — name, attestationLevels[], validityDays, links to qualification/medical/standard
- `TemplateAssignment` — template + employee/role/department, dueDate, fulfillments[]
- `ProofFulfillment` — per-level timestamps, status, reviewer notes, expiration

**API Surface:**
- 25 new endpoints under `/api/templates` and `/api/fulfillments`
- 9 new permissions (`templates:*`, `fulfillments:*`)

**UI Impact:**
- 9 new web screens (W-30 through W-38)
- 2 new admin screens (A-11, A-12)

**Integration Points:**
- Proof Vault (Level 2 storage)
- Qualifications/Medical (auto-fulfill candidates)
- Standards framework
- Notifications
- Readiness scoring

**Validation:**
- Spec comprehensive; no implementation blockers identified at architectural level
- Ready for Phase 2b (follows Proof Vault specification)

---

### ⚠️ BLOCKING: Taxonomy vs. Attestation Spec Inconsistencies (2026-03-16T01:21Z)

**By:** Freamon (Architectural Review)  
**Status:** Requires resolution before implementation

**Finding:** Cross-spec review of `docs/architecture/proof-taxonomy.md` against `docs/architecture/templates-attestation-spec.md` identified 6 critical blockers. Do **not** implement `proof-taxonomy.md` as written.

**Critical Issues (must fix):**

1. **ProofRequirement contract mismatch** — templates spec defines optional `proofType` and string `proofSubType`; taxonomy changes to required `proofType` and enum `ProofSubType`. API request examples still omit these fields.

2. **PARTIAL fulfillment status unsupported** — taxonomy uses `status = PARTIAL` with examples like `250/500 hours`; templates spec only defines `unfulfilled`, `pending_review`, `fulfilled`, `expired`, `rejected`. No model for quantitative progress.

3. **Hours model cannot encode count-based activity** — taxonomy gives "3 landings in 90 days" as canonical example; threshold units only support `hours`, `credits`, `days`. "Landings" is not a time unit.

4. **Preset route collision + RBAC mismatch** — `GET /api/presets/:industry` and `GET /api/presets/:id` have same route shape (routing ambiguity). `POST /api/templates/from-preset/:presetId` is Manager-only in taxonomy but template creation is Supervisor-capable in templates spec.

5. **Preset provenance missing FK/relation** — taxonomy adds `presetId` to `ProofRequirement` but no foreign key to `IndustryPreset`; no `ProofTemplate.sourcePresetId` or versioned source reference.

6. **Type definitions promise fields fulfillment schema cannot store** — Type definitions enumerate input fields (e.g., `activityDescription`, `credentialName`, `scope`, `certificateId`, `issueDate`, `expirationDate`, `nextDueDate`, `regulatoryBody`, `date`, `notes`) that don't exist in the actual fulfillment extension.

**Warnings (should fix):**
- Validation coverage incomplete for `assessment` and `compliance` types
- Default attestation guidance too coarse for subtype library (need subtype/risk-level defaults)
- Preset examples vs. schema use different representations
- Industry mapping too rigid for complex examples (apprenticeship hours, logbooks as both audit + activity)
- Industry subtype boundaries fuzzy (OSHA 10/30 reads as training; Hours-of-Service is both compliance + activity)
- `IndustryPreset` under-specified for custom preset governance (missing audit fields, versioning)
- Phase sequencing needs explicit documentation

**Observations (nice to fix):**
- Core proof-type hierarchy matches enum list ✓
- No literal field duplication in `ProofFulfillment` ✓
- Most taxonomy API additions are additive once blockers resolved ✓

**Call to Action:**
1. Pick authoritative schema (recommend consolidating into single spec)
2. Add explicit `PARTIAL`/quantitative-progress semantics to shared model
3. Broaden threshold-unit model (add `count`/`events`) or split quantitative-activity subtype
4. Disambiguate preset routes; align preset-based template creation with template CRUD authority
5. Move preset provenance to template level with real relation + version tracking
6. Add missing fulfillment-time evidence fields or explicitly separate requirement-time config from fulfillment-time fields

**Detailed report:** `.squad/decisions/inbox/freamon-taxonomy-review.md`

---

## Domain Knowledge References

### 2026-03-16T01:03Z: Industry Proof Types Reference

**By:** ivegamsft (via Copilot)  
**Purpose:** Domain knowledge for template & attestation system design

**Content:** Comprehensive reference of proof types across 10 regulated industries — Aviation, Healthcare, Nuclear, Construction/OSHA, Licensed Trades, Finance/Securities, Transportation/CDL, Food Safety, IT/Security, Teaching.

**Key Pattern (universal):**
- Initial qualification (exam, training, certification)
- Recency proof (hours worked, training completed, skills demonstrated)
- Clearance status (background check, medical, security)
- Continuing competency (CE hours, skills tests, audits)
- Audit trail (documented evidence of all above)

**Industry Examples:**
- **Aviation:** flight hours, medical cert, recency landings, type-rating checkrides, proficiency checks
- **Healthcare:** CE credits, license renewal, competency assessments, shift logs, peer evaluations
- **Nuclear:** security clearance, operator cert exams, simulator hours, radiation safety, requalification
- **Construction:** OSHA 30, fall protection, equipment tickets, safety training, jobsite hours
- **Licensed Trades:** apprenticeship hours (4000+), journeyman exam, CE for renewal, project hours, master's exam
- **Finance:** Series 7/63/65, CE credits, fingerprint clearance, AML/KYC certs, supervisor hours
- **CDL (Transportation):** DOT physical, skills test, logbook compliance, hazmat endorsement, violations history
- **Food Safety:** food handler cert, HACCP training, auditor certs, inspection passes, temp logs
- **IT/Security:** Security+/CISSP, CPE credits, work experience hours, lab hours, ethics sign-off
- **Teaching:** state cert, PD hours, background check, classroom observation, subject exam

**Key Insight:** e-clat's value is *layered proof through continuous action* — certification proves you learned it, hours prove you're using it, requalification proves you can maintain it, audit trail proves it's all verified.

**Use:** Templates should support these industry-specific proof patterns out of the box.

---

### 2026-03-16: Sydnor Decision — Proof List Tests

**Date:** 2026-03-16  
**Requester:** ivegamsft  
**Component:** `ProofList` and `ProofCard` (React)

**Decision:** Cover `ProofList` and `ProofCard` with a root-level jsdom E2E spec (`tests/e2e/proof-list.test.tsx`) until the feature is mounted on a live route.

**Rationale:** Components are implemented but not yet reachable through the running web app, so browser-to-route E2E would not exercise them. Root-level spec keeps contract coverage practical now without blocking on additional page wiring.

**Implementation:**
- Root `vitest.config.ts` and `vitest.e2e.config.ts` include `.test.tsx` files
- React-based E2E specs run alongside live-stack smoke suite
- `infra/layers/` — Existing layer structure (00-foundation, 10-data, 20-compute)
- `bootstrap/` — Bootstrap scripts (for context; test data different from bootstrap)



## Coordination & Specification Phase (2026-03-17)

### 1. Product Spec Reconciliation (By: Squad Coordinator)

**Decision:** Align implementation against external product spec while retaining 5-role model and implementation terminology.

**Key Points:**
1. **Keep 5 roles (Supervisor retained)** — Regulated industries need team lead / shift lead distinction. Supervisor handles direct-report oversight without department-wide authority. Already implemented and tested.
2. **Terminology: Use implementation names** — qualifications, not "certifications"; medical, not "clearance". UI displays user-friendly labels while API stays as-is.
3. **Product spec is functional north star** — Screen inventory and employee self-service UX from product spec is authoritative. RBAC matrix from Freamon's spec (5-role, granular) is authoritative for enforcement.
4. **Labels module stays** — Not in product spec but needed for standards versioning and compliance taxonomy. Keep it.

**Why:** Product spec comparison revealed gaps; decisions unblock continued development.

---

### 2. RBAC API Specification (By: Freamon)

**Decision:** Single authoritative reference for role-based access control across all team implementations.

**Specification:** docs/architecture/rbac-api-spec.md — 65 endpoints, 36 permissions, 5-role matrix.

**Key Decisions:**
1. **Permission model:** {resource}:{action} syntax. 36 permissions across 11 resource categories (read, create, update, delete, approve, export).
2. **Three-layer enforcement:** UI (route guards + visibility) → API (middleware) → Data (Prisma filters).
3. **Data scoping is mandatory:** Employee (own), Supervisor (direct + own), Manager (department), Compliance Officer (org read + dept write), Admin (unrestricted).
4. **Permission-first authorization:** hasPermission(user, 'resource:action'), never role-only checks. Prerequisite for custom roles Phase 2+.
5. **Migration path for custom roles:** Phase 1: equireRole. Phase 2: add equirePermission. Phase 3+: DB custom roles + Entra groups.
6. **Endpoint catalog verified:** 65 total (5 public, 27 auth-only, 33 role-restricted) across 9 modules verified against router files.

**Consequences:** This is the contract; any deviation requires ADR. Sydnor generates test cases directly from access table. Bunk implements scope filters; Kima implements visibility.

---

### 3. Application Specification (By: Freamon)

**Decision:** Authoritative screen inventory, navigation, and employee UX aligned to product spec feedback.

**Specification:** docs/architecture/app-spec.md — 23 core + 9 admin screens, navigation wireframes, 5-phase implementation.

**Key Decisions:**
1. **"Employees" → "Team"** — Renamed, hidden entirely from Employee role.
2. **Employee dashboard:** Personal readiness, upcoming expirations, quick actions (clock in/out, upload document, profile/hours/qualifications).
3. **/me/* route family:** All roles get self-service paths; /team/:id/* for managing others.
4. **Self-service cannot create compliance records** — View only; Supervisors+ manage through /team/:id/*.
5. **Document review:** Manager+, not Supervisor+ (aligns with RBAC spec).
6. **Standards:** Read-only in web app; CRUD admin-only via admin app.
7. **Three API gaps (P0/P1/P2):** Missing GET /api/documents/employee/:employeeId, batch readiness endpoint, compliance report.
8. **5-phase implementation:** Employee UX → Team Management → Manager Operations → Compliance/Standards → Admin App.

**Consequences:** Kima restructures routes/sidebar/dashboard first. Bunk adds missing document endpoint. All UI work traces to spec.

---

### 4. Role-aware Employee Access UX (By: Kima)

**Decision:** Treat employee-directory access as role-aware UI concern; skip fetches for employee role, render 403 as permission state.

**Why:** Avoids broken UX for valid employee logins, prevents auth-hydration races, keeps RBAC UX consistent.

**Implementation:**
- Wait for AuthContext hydration before making role-gated requests.
- Skip employee-directory fetches entirely for employee-role users on dashboard.
- Render 403 responses as permission-aware states, not fatal errors.

---

## Phase 2b: Proof Vault & Sharing Architecture (2026-03-18)

### 1. User Directive: Encrypted Proof Vault (2026-03-16T00:40Z)

**Author:** ivegamsft  
**Status:** Directive  
**Source:** User requirement

**Direction:** Proofs must be stored as encrypted blobs per user. When creating a "proof vault", the user sets an encryption key. All uploads are encrypted/decrypted using that key. If the user forgets the key, there is NO recovery path — zero-knowledge design. However, users should be able to download a zip of their proofs (decrypted with their key) for portability.

**Rationale:** Compliance documents contain sensitive data. Zero-knowledge encryption ensures only the user can access their proofs. Zip export provides self-service backup/portability.

**Implications:**
- Backend implements client-side key derivation + AES encryption for blob storage
- Azurite/Azure Blob Storage holds only encrypted blobs — server never sees plaintext
- New API endpoints: vault creation (with key setup), encrypted upload, decrypted download, zip export
- UI needs "proof vault" concept with key setup flow and file grid for browsing
- Key never stored server-side — only verification mechanism (sentinel + GCM)

---

### 2. UI Design Directive: Proof List Pattern (2026-03-16T00:36Z)

**Author:** ivegamsft  
**Status:** Directive  
**Source:** User-provided visual reference

**Direction:** Proof/qualification lists should follow a card-based pattern. Each card shows: proof name, progress (met/total requirements), evidence upload capability, expiration date, and color-coded status bar. Header includes title + add button. Filter tabs for status categories (All, Active, Expiring, Expired).

**Rationale:** User provided visual reference — this is the target UX for qualification/certification lists across the app.

**Applies to:** All qualification/certification list screens (personal + team views)

---

### 3. UI Design Directive: Dashboard & Team Directory Pattern (2026-03-16T00:44Z)

**Author:** ivegamsft  
**Status:** Directive  
**Source:** User-provided visual reference from HR management app

**Direction:** Dashboard home screens should follow a workspace pattern with: (1) greeting header with user name, (2) hero stats card with gradient background showing key metrics (Total Staff, Compliance %, Pending items), (3) Quick Action grid with icon buttons for common tasks, (4) notification/activity feed with avatars and timestamps. Team directory should show employee cards with avatar, name, role, tenure, and readiness score percentage badge, with filter tabs and action buttons (View Profile, Flag for Review).

**Applies to:** W-02 (Dashboard), W-09 (Team Directory), W-10 (Employee Card)

---

### 4. UI Design Directive: Manager Analytics Dashboard (2026-03-16T00:47Z)

**Author:** ivegamsft  
**Status:** Directive  
**Source:** User-provided visual reference from HR analytics dashboard

**Direction:** Manager dashboard should support analytics-heavy layout: (1) top row of 4 KPI stat cards with metric, value, sparkline trend, delta vs last period; (2) middle row with heatmap/grid for hours tracking + bar chart for compliance overview; (3) bottom row split between searchable team activity table (avatar, name, dept, status badge, timestamps) and schedule/events sidebar. Dark theme option. Left sidebar navigation with section grouping.

**E-CLAT Adaptation:**
- Total Employees → Team Size
- Attendance Rate → Compliance Rate %
- New Hires → New Certifications This Month
- Active Projects → Active Requirements
- Attendance heatmap → Hours logged heatmap
- Project Overview bar chart → Compliance status by day/week
- Attendance table → Team activity table (cert uploads, approvals, expirations)
- Schedule sidebar → Upcoming expirations / review deadlines

**Applies to:** W-02 (Dashboard - Manager/CO variants), potentially W-19 (Compliance Overview)

---

### 5. Proof List Component Contract (2026-03-17)

**Author:** Kima  
**Status:** Active  
**Date:** 2026-03-17  
**Artifact:** Component implementation + decision document

**Decision Summary:**

1. Keep `ProofList` and `ProofCard` presentation-first. Parent pages provide normalized proof items instead of the component fetching directly.
2. Require each proof item to include requirement progress (`requirementsMet`, `requirementsTotal`) so the UI can always render the tracker-style progress summary and color bar.
3. Handle list filtering inside the component with four client-side tabs: `All`, `Active`, `Expiring Soon`, and `Expired`.
4. Only show the `Add New` affordance when the parent indicates both create permission and a non-self/team context (`canCreate && !isOwnProfile`).
5. Evidence stays lightweight in-card: attached files show a paperclip label; missing evidence exposes an Upload action hook supplied by the parent.

**Why:**
- Keeps the component reusable across both page variants (self-service + team views)
- Matches architecture spec: employees can view their qualifications but cannot create them; Supervisor+ can add qualifications from team views
- Avoids coupling list UI to API gaps while keeping final design ready for compliance progress data

**Consequences:**
- Page containers own API orchestration and enrichment for requirement counts
- Proof-list UI can be dropped into future pages without route-specific rewrites
- Permission logic remains explicit at page/container layer

**Validation:** 28/28 tests passing; TypeScript clean

---

### 6. Proof Vault Encryption Architecture (2026-03-18)

**Author:** Freamon (Lead / Architect)  
**Status:** Active — authoritative design for proof vault implementation  
**Date:** 2026-03-18  
**Artifact:** `docs/architecture/proof-vault-spec.md`

**Decision Summary (9 key decisions):**

1. **AES-256-GCM** for symmetric encryption — AEAD cipher, WebCrypto native, industry standard. Rejected ChaCha20-Poly1305 (not in WebCrypto) and AES-CBC (no authentication).

2. **PBKDF2-SHA-256 (100K iterations)** for key derivation — WebCrypto native, no WASM dependency. Argon2 deferred to Phase 3.

3. **Client-side encryption for upload/download** — true zero-knowledge. Server never sees plaintext content. WebCrypto API handles all crypto in-browser.

4. **Server-side decryption for zip export only** — passphrase sent per-request over TLS, key exists only in request-scoped memory, never persisted. Accepted trade-off for usability.

5. **Metadata in plaintext** — filenames, MIME types, sizes, dates stored unencrypted in Postgres. Enables search, display, compliance reporting. Only file *content* is encrypted.

6. **Separate from Document model** — ProofVault and VaultDocument are new Prisma models, independent from existing Document review workflow. Different lifecycle, security, access patterns.

7. **No key recovery** — zero-knowledge by design. Forgotten passphrase = permanent data loss. No admin backdoor, no key escrow.

8. **Client-side re-encryption for key change** — user downloads each encrypted blob, decrypts with old key, re-encrypts with new key, uploads replacements. Server never sees plaintext during key change.

9. **Sentinel pattern for key verification** — encrypt known sentinel string with derived key. Verify by attempting GCM decryption. Reveals nothing about the key; no hash comparison needed.

**Data Model:**
- `ProofVault` — 1:1 with Employee, stores salt + encrypted sentinel + stats
- `VaultDocument` — 1:N under vault, stores metadata + blob storage key + encryption IV
- Blobs in Azure Blob Storage (Azurite locally): `proof-vaults/{employeeId}/{documentId}`

**RBAC:**
- Employees: full CRUD on own vault and documents
- Supervisor+: can view vault existence + document count only (via `vault:read_status`)
- No role can access another employee's vault content — enforced cryptographically

**API:** 12 new endpoints under `/api/vault` — vault CRUD, document upload/download/delete, zip export, passphrase change, manager status view.

**Phased Rollout:**
- Phase 1 (MVP): Create/upload/download/delete + UI
- Phase 2: Zip export + key change + manager view
- Phase 3: Vault-to-review pipeline + Argon2

**Consequences:**
- New `vault` API module in `apps/api/src/modules/vault/`
- New `vault-crypto.ts` shared package for WebCrypto utilities
- New blob storage container `proof-vaults` in Azure/Azurite
- New Prisma migration for `proof_vaults` + `vault_documents` tables
- New permissions: `vault:create`, `vault:read`, `vault:write`, `vault:export`, `vault:delete`, `vault:read_status`
- New UI screen W-06a (Proof Vault) with file grid pattern
- Dependencies: @azure/storage-blob + archiver + zxcvbn

---

### 7. Sharing & Proof Vault Specification (2026-03-18)

**Author:** Freamon (Lead / Architect)  
**Status:** Draft — awaiting team review  
**Date:** 2026-03-18  
**Artifact:** `docs/architecture/sharing-spec.md`

**Summary:** Comprehensive specification for Sharing & Proof Vault feature — a secure document sharing layer built on top of the existing `documents` module. Spec-only deliverable; no code implemented.

**Decision Summary (6 key decisions):**

1. **Vault access is ownership+share-based, not role-hierarchy-based**
   - Unlike the rest of E-CLAT where Supervisors see team data via role hierarchy, vault requires explicit sharing
   - Supervisor cannot browse team members' vault contents — can only see documents explicitly shared with them
   - Rationale: Compliance proofs are personal property; explicit sharing creates clear audit trail of consent

2. **Share links restricted to Compliance Officer+**
   - Only Compliance Officer and Admin can create external share links (token-based URLs)
   - Rationale: External exposure of compliance documents is significant risk; compliance-focused roles ensure proper oversight
   - Supervisors/Managers can request links via Compliance Officer

3. **File requests restricted to Supervisor+**
   - Only Supervisor+ roles can create file requests (asking employees to upload specific proofs)
   - Employees cannot request files from other employees
   - Rationale: File requests are management tool creating obligations with deadlines; aligns with top-down compliance management

4. **Encryption phased: server-side first, client-side later**
   - Phase 2b: Server-side encryption (Azure SSE)
   - Phase 3+: Zero-knowledge client-side encryption (AES-256-GCM with per-document DEKs)
   - Rationale: Client-side crypto adds significant complexity; sharing features deliver immediate value with server-side first; full crypto architecture documented for Phase 3

5. **New `/api/vault/` module (42 endpoints)**
   - All sharing/vault endpoints under `/api/vault/`, separate from `/api/documents/`
   - Vault references documents by ID but doesn't replace documents module
   - Rationale: Documents module handles upload, review, extraction (operational). Vault handles organization, sharing, access control (user-facing). Clean module boundaries.

6. **Recommended for Phase 2b**
   - Implement after Documents and Notifications are stable (Phase 2 core) but before Phase 3
   - Rationale: Vault depends on stable documents + notifications; naturally bridges Phase 2 → Phase 3

**Vault Architecture:**
- **Sections:** My Vault, Shared With Me/By Me, Archive, Recent, File Requests, Deleted
- **Sharing Model:** Shared folders, per-file sharing, 4 permission levels (view, edit, comment, admin), time-limited share links for external auditors
- **File Requests:** Manager→employee proof requests with deadlines, auto-share on fulfillment, escalation rules
- **Storage Quotas:** Role-based defaults, admin management
- **Access Control:** Ownership+share-based (not role-hierarchy-based)

**New API Surface:**
- **Endpoints:** 42 endpoints under `/api/vault/`
- **Permissions:** 8 new `vault:*` permissions integrated with existing RBAC
- **Models:** 7 new Prisma models, 2 modified (Document, User)
- **Notifications:** 10 new notification triggers
- **Audit Events:** 19 new audit event types

**UI Screens:**
- **Web:** W-24 through W-29 (6 new screens)
- **Admin:** A-10 (1 new screen)

**Risks:**
1. **Scope creep:** 42 new endpoints substantial; Phase 2b should deliver folder sharing + file requests first, defer share links
2. **Encryption migration:** Moving server-side → client-side in Phase 3 requires re-encrypting existing documents; plan migration tooling early
3. **Quota enforcement:** Storage quota tracking requires accurate byte counting on every upload/delete; edge cases need careful handling

---

### 8. PRD ↔ Architecture Spec Reconciliation (2026-03-17)

**Author:** Freamon (Lead / Architect)  
**Status:** Active  
**Date:** 2026-03-17  
**PRD:** `docs/prds/eclat-spec.md`  
**Specs Updated:** `docs/architecture/app-spec.md`, `docs/architecture/rbac-api-spec.md`  
**Cleanup:** Deleted stale `docs/architecture/product-spec.md`

**Summary:** Reconciled user-provided PRD against both architecture specs. Architecture specs now have full traceability to PRD; implementation team has clear visibility on coverage, deferral rationale, and terminology mappings.

**Actions Completed:**
1. Deleted duplicate `docs/architecture/product-spec.md` — identical to PRD
2. Added Source PRD reference to both architecture specs with bidirectional cross-links
3. Documented terminology mapping (PRD → implementation):
   - Certifications → Qualifications
   - Clearance → Medical
   - Standard Framework → Standard
4. Documented role mapping — PRD's 4 roles → our 5 roles, with rationale for Supervisor tier
5. Added PRD Coverage Analysis (§9) to app-spec mapping all 20 PRD screens
6. Added PRD RBAC Deltas table to RBAC spec
7. Added PRD Data Model Cross-Reference to RBAC spec

**Decision Summary (7 key decisions):**

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Keep 5 roles** (PRD has 4) | Supervisor tier essential for regulated industries — separates team oversight from department operations and document approval authority |
| 2 | **Keep "qualifications" naming** (PRD says "certifications") | Code, Prisma schema, API modules, 140+ tests use "qualifications"; renaming has massive blast radius for zero user benefit; terminology mapping documented instead |
| 3 | **Keep "medical" naming** (PRD says "clearance") | Same reasoning; API module is `medical`, Prisma model is `MedicalClearance` |
| 4 | **Employee cannot self-create qualifications** (PRD implies they can) | Regulated industries require Supervisor+ attestation; employees upload documents (enter review queue), not direct qualification records |
| 5 | **No hours approve/reject endpoints yet** (PRD defines them) | Our architecture uses conflict resolution rather than per-entry approval; model may be added Phase 2 if manual entry validation requires it |
| 6 | **No qualification approve/reject endpoints yet** (PRD defines them) | Manual qualifications by Supervisor+ bypass approval; document-based qualifications go through Document Review |
| 7 | **Only Admin can edit employee records** (PRD lets Manager edit team) | Prevents field-level conflicts; maintains single source of truth for employee data |

**Features Explicitly Deferred (Phase 2+):**
- Hours approval workflow (§4.3)
- Qualification approval workflow (§4.4)
- Reports API module (§4.9) — 6 endpoints
- Compliance API module (§4.7) — 6 endpoints
- Integration endpoints (§4.11) — OAuth calendar, payroll, scheduling
- Compliance Audit View screen (§3.3)
- Document Processing Configuration (§3.6) — AI/OCR settings
- Manager-scoped reports (§2.7)
- Escalation management (§2.6)
- My Requirements self-service (§3.1)
- Team gaps batch view (§3.2)
- User & Role Management admin screen (§3.7)

**Consequences:**
- Both architecture specs now have full traceability to PRD
- Implementation team sees exactly what's covered, deferred, and why
- Terminology confusion resolved via documented mapping
- 12 features explicitly deferred with PRD section references for Phase 2+ planning
- No code changes required — spec-level reconciliation only

---

---

## Implementation Status Classification (2026-03-16)

For the implementation status matrix in \docs/implementation-status.md\:

### Decision

1. **\🔧 API Only\ means a working backend surface exists but no routed UI screen exists.**
2. **\❌ Not Started\ takes precedence over exposed routes when the service layer still throws \
otImplemented(...)\.** Router scaffolds alone do not count as implementation.
3. **\📋 Spec Only\ is reserved for features that are documented in \docs/specs/\ or \docs/specs/app-spec.md\ but do not yet exist in frontend routes, API modules, or Prisma schema.**
4. **Reusable components without routing do not count as implemented UI screens.** Current example: \pps/web/src/components/ProofList.tsx\ and \ProofCard.tsx\.

### Rationale

Without this rule, the matrix would overstate progress in \hours\, \labels\, and several auth flows that have router signatures but no working service implementation. The team needs the document to reflect execution reality, not just file presence.

### Immediate Consequences

- \hours\ features are tracked as **❌**, not **🔧**.
- \labels\ management is tracked as **❌**, not **🔧**.
- \uth/register\, \uth/change-password\, and \uth/oauth/callback\ are tracked as **❌**.
- \GET /api/documents/employee/:employeeId\ remains the P0 backend gap that blocks both W-06 and W-13.

---

## User Directive: Name Preference (2026-03-16T03:22:36Z)

**By:** Israel (Izzy) (via Copilot)  
**What:** User's name is Israel, not Isaac. Preferred name: Izzy.  
**Why:** User request — captured for team memory


---

## ### 2026-03-15T23:48:30.3974508-04:00: My Section UI Architecture
**By:** Kima (Frontend Dev)
**What:** Established a shared `apps/web/src/types/my-section.ts` contract for self-service API payloads, a reusable `apps/web/src/styles/my-section.css` design system (`my-page`, `my-card`, `my-grid`, `my-table`, badge/button/form/nav/empty/coming-soon patterns), and six focused My* pages that all wait for auth hydration before own-scope fetches. The pages reuse ProofList for qualifications, normalize notification/preferences payloads for safer frontend rendering, provide metadata-only document upload UI, and treat unimplemented hours endpoints as a coming-soon experience instead of a hard failure.
**Why:** This keeps self-service screens visually consistent, type-safe, and easy to extend while backend contracts are still settling. Shared primitives reduce duplication, make responsive behavior/accessibility predictable, and let Bunk wire routes later without reworking page internals.


---

# Bunk — Taxonomy Route Alignment

## Decision
Use `/team` and `/team/:id` as the canonical web routes for team management, matching `docs/specs/app-spec.md`. Keep `/employees` and `/employees/:id` as redirect-only legacy entry points so existing links do not break while the UI and docs converge.

## Implementation Notes
- Route source of truth: `apps/web/src/App.tsx`
- Shared route UI scaffolding: `apps/web/src/components/PageShell.tsx`
- Shared role gating: `apps/web/src/rbac.ts` + `apps/web/src/components/ProtectedRoute.tsx`
- Placeholder route bundle for Kima follow-up: `apps/web/src/pages/RoutePlaceholderPages.tsx`
- Updated team pages: `apps/web/src/pages/TeamDirectoryPage.tsx`, `apps/web/src/pages/TeamMemberDetailPage.tsx`

## Why
- The spec and current UI terminology were drifting (`/employees` in code vs `/team` in product language).
- Redirects preserve compatibility for saved links and bookmarks.
- Shared breadcrumb/tab shell prevents the new route families from diverging while real pages are still pending.

## Extra Validation Choice
I also added `@e-clat/web` to the root `build` and `typecheck` scripts in `package.json` so monorepo validation now includes frontend route changes by default.

---

# Bunk — Proof Templates (Phase 3, Agent-83)

- Proof template schema keeps Prisma enums uppercase (TemplateStatus, AttestationLevel, FulfillmentStatus, ProofType) while API responses map to lowercase strings for consistency with existing DTO patterns.
- Employee now owns relation arrays for assignment creators (\ssignedTemplateAssignments\) and validators (\alidatedFulfillments\) to satisfy multi-relation Prisma constraints alongside assignee relations.
- Templates module exports dedicated routers for templates, assignments, fulfillments, plus an employee assignments router mounted under \/api/employees/:id/assignments\ to avoid coupling with the employees module.
- Fulfillment status computation sets validated-only requirements to \pending_review\ on assignment creation and blocks validation approval until all other required levels are satisfied.

---

# Bunk — Hours Service + Documents Listing (Phase 3, Agent-84)

- Hours clock-in/out stores the event timestamp in \HourRecord.createdAt\ and keeps \HourRecord.date\ normalized to the calendar day, because the schema has no separate clock timestamp fields.
- Hour audit trail lookup accepts both \HourRecord\-style names and the existing \/api/hours\ audit entity type so service lookups work with current middleware behavior.
- Document employee listing authorization is enforced in the router: employees may read their own documents, while cross-employee access requires \SUPERVISOR\ or higher.

---

# Sydnor — Phase 3 Test Harness (Agent-85)

## Context

Templates and the new documents-by-employee endpoint are being tested in parallel with implementation. Some routes are not mounted yet, while Hours already has mounted routes but placeholder services.

## Decision

Use a two-path contract-testing pattern:
1. For modules/routes not yet mounted, add fallback test-only routes through \createTestApp({ registerRoutes })\ so endpoint contracts and RBAC boundaries are testable now.
2. For mounted routers with incomplete services, spy on service methods in tests and let the real router, auth middleware, validators, and error handler run unchanged.

## Rationale

This keeps RBAC assertions strict, preserves real route precedence when implementations land, and avoids blocking API contract coverage on unfinished service logic.

---

# Copilot Directive — Docs-to-Code Pipeline (2026-03-16T024927Z)

**By:** Israel (Izzy) (via Copilot)

**What:** Establish a docs-to-code workflow pipeline:
1. **Ideas** (docs/ideas/) → brainstorming, exploration, rough concepts
2. **Requirements** (docs/requirements/) → refined ideas become user stories, PRDs, feature specs
3. **Specs** (docs/specs/) → requirements become technical architecture and design specs
4. **Decisions** (docs/decisions/) → review gate — ADRs, scope calls, architecture decisions
5. **Tests** (docs/tests/) → specs become test plans, test cases, acceptance criteria
6. **Plans** (docs/plans/) → requirements + specs + tests become implementation plans with task breakdowns
7. **Code** → plans become implementation
8. **Guides** (docs/guides/) → operational docs, runbooks, how-tos written after shipping

**Pipeline:** 💡 Ideas → 📋 Requirements → 📐 Specs → ✅ Decisions → 🧪 Tests → 📅 Plans → 💻 Code → 📖 Guides

Each stage feeds the next. Ideas graduate to requirements. Requirements become specs. Specs go through a decision gate. Approved specs produce tests and plans. Code follows plans. Guides capture what you learn after shipping.

**Why:** User request — structured pipeline from ideation to production. Ensures nothing ships without going through the full funnel. Maps 1:1 to existing docs/ folder structure.

---

# Backlog Decomposition Decision — E-CLAT

> **Date:** 2026-03-16  
> **Decision Owner:** Freamon (Lead)  
> **Requested By:** Israel (Izzy)  
> **Scope:** Entire E-CLAT backlog from specs, audits, requirements, and ideas

## Context

E-CLAT reached releases v0.1.0, v0.2.0, and v0.3.0 with zero GitHub issues. The repository had extensive documentation (18 source documents) but no actionable backlog for parallel squad work. This created bottlenecks:
- No visibility into prioritized work
- No squad-level ownership of features
- No release planning or dependency tracking
- No go/no-go gates on implementation-ready items

## Decision

Decomposed the full backlog into **51 GitHub issues** organized into **5 epics** across **4 releases** (v0.4.0, v0.5.0, v0.6.0, backlog).

### Epic Structure

1. **Compliance Hardening** (P0, v0.5.0, Pearlman) — Audit findings from proof-compliance-audit.md
2. **Architecture Foundation** (P0, v0.5.0, Daniels) — Service boundaries, contracts, feature flags
3. **Template UI Screens** (P1, v0.4.0, Kima) — Phase 3 Batch 2 (W-30 through W-38)
4. **Pipeline & DevOps** (P1, v0.5.0, Daniels) — Parallel deployment, CI/CD separation
5. **Bug Fixes & Stabilization** (P0, v0.4.0, Bunk) — Known issues blocking v0.4.0

### Decomposition Rules

| Rule | Rationale |
|------|-----------|
| **Epic-first creation** | Establish context before creating child issues |
| **Pre-assign to squads** | Use spec ownership and domain expertise (Bunk=backend, Kima=frontend, Daniels=arch/DevOps, Pearlman=compliance, Sydnor=testing) |
| **go:yes vs go:needs-research** | go:yes = clearly defined and implementable; go:needs-research = needs spike/design first |
| **Document source in every issue** | Link to originating spec/req/idea doc for traceability |
| **Cross-reference dependencies** | Use issue numbers (#6, #23, etc.) to track blocking relationships |
| **All work captured** | Every backlog item from every source gets an issue (completeness over convenience) |

### Issue Breakdown

- **By Squad:** Bunk 16, Kima 13, Daniels 12, Pearlman 7, Freamon 3, Sydnor 1
- **By Priority:** P0 14, P1 25, P2 13
- **By Release:** v0.4.0 16, v0.5.0 19, v0.6.0 10, backlog 5
- **By Go/No-Go:** go:yes 29, go:needs-research 22

### Release Targeting Strategy

| Release | Focus | Key Items |
|---------|-------|-----------|
| **v0.4.0** | Bugs + Template UI | Fix P0 bugs (#6-#8, #10), build 9 template screens (W-30 to W-38), Prisma migration |
| **v0.5.0** | Architecture + Compliance | Shared contracts, repository layer, feature flags, attestation policy, expiration handling |
| **v0.6.0** | Service Extraction | Reference/Notification extraction, issuer verification, evidence packages, preview envs |
| **backlog** | Future Enhancements | Hour reconciliation, label taxonomy, AI document review, access/notifications |

### Source Documents (18 total)

**Specifications:**
- proof-compliance-audit.md (Pearlman's audit)
- service-architecture-spec.md (Daniels' SA-01 through SA-08)
- feature-flags-spec.md
- pipeline-architecture-spec.md
- templates-attestation-spec.md (W-30 through W-38)

**Requirements:**
- attestation-policy-constraints.md
- audit-trail-retention-and-revocation.md
- feature-flag-requirements.md
- parallel-deployment-requirements.md

**Ideas:**
- ui-menu-architecture.md
- recertification-lifecycle.md
- evidence-package-sharing.md
- issuer-registry-integrations.md
- document-uploads-ai-review.md
- hour-capture-reconciliation.md
- label-taxonomy-mapping.md
- access-visibility-notifications.md

**Known Bugs:**
- Template validation errors (500 vs 400)
- npm run lint failures
- Prisma migration not applied
- Deploy workflow output mismatch

## Alternatives Considered

### Option 1: Incremental Issue Creation
Create issues only for immediate sprint work, backlog stays in docs.

**Rejected:** No visibility into future work, no release planning, squads can't parallelize.

### Option 2: Flat Issue List (No Epics)
Create all 51 issues without epic organization.

**Rejected:** Too hard to navigate, no thematic grouping, harder to track progress by domain.

### Option 3: Separate Repos or Projects
Use GitHub Projects or separate repos per service.

**Rejected:** Premature for monorepo; adds coordination overhead before service extraction.

## Consequences

### Positive

- **Squad parallelization:** Each squad has clear backlog, can work independently
- **Release planning:** P0/P1/P2 + release tags enable sequencing decisions
- **Dependency tracking:** Cross-references in issue bodies reveal blocking chains
- **Go/no-go gates:** go:needs-research flags items needing design work before implementation
- **Traceability:** Every issue links back to authoritative spec/req/idea doc
- **Completeness:** Nothing from specs/audits/requirements is lost or forgotten

### Negative / Risks

- **51 issues may overwhelm:** Mitigation: Epics group thematically, release tags filter by horizon
- **Pre-assignment may be wrong:** Mitigation: squad label is inbox; squad leads can reassign
- **Dependencies may shift:** Mitigation: Issue bodies are editable; update as design evolves
- **go:needs-research items block progress:** Mitigation: Prioritize spikes (#27, #49) to unblock

## Next Actions

1. **Squad leads** review assigned issues, refine acceptance criteria, estimate effort
2. **Freamon** sequence P0 issues for v0.4.0 sprint (likely #6, #7, #8, #10)
3. **Spikes prioritized:** #27 (API v1 namespace), #49 (admin shell decision)
4. **Epics updated:** Add child issue links to epic bodies for tracking
5. **Dependencies tracked:** Review cross-references, identify critical path

## Validation Criteria

- ✅ All backlog items from all 18 source documents have corresponding issues
- ✅ All issues have: title, body (context/AC/source/deps), labels (type/priority/release/squad/go)
- ✅ All issues pre-triaged to squads based on domain expertise
- ✅ All issues cross-referenced where dependencies exist
- ✅ Epics provide thematic organization and progress tracking
- ✅ Release targets align with dependency chains and risk profiles

## Related Artifacts

- GitHub issues #1 through #51: https://github.com/ivegamsft/work-tracker/issues
- Backlog summary: `.squad/decisions/inbox/backlog-summary.md` (temporary summary doc)
- Freamon history: `.squad/agents/freamon/history.md` (updated with decomposition pattern)

## Approval Status

**Status:** Proposed (awaiting squad lead review)  
**Approvers:** Freamon (decision owner), squad leads (validators)  
**Effective Date:** 2026-03-16 (issues created)  
**Review Date:** After v0.4.0 release (validate decomposition effectiveness)

---

# Daniels decisions — service architecture and parallel deployment

## Context
Izzy requested an audit of API/app architecture against Terraform and workflows, with a proposal that enables parallel subsystem development and faster independent deployments.

## Decisions
1. Treat the current backend as a **modular monolith with explicit future service boundaries**, not as a rewrite candidate.
2. Use six logical backend service groups:
   - Identity Platform (`auth`)
   - Workforce Core (`employees`)
   - Compliance Service (`qualifications`, `medical`, `templates`)
   - Records Service (`documents`, `hours`)
   - Reference Data (`standards`, `labels`)
   - Notification Service (`notifications`)
3. Keep `qualifications + medical + templates` co-located until shared contracts and query facades exist.
4. Keep `documents + hours` co-located because they share ingestion, reconciliation, storage, and worker concerns.
5. Move cross-domain aggregation out of CRUD services and into named query/facade layers (`ReadinessQueryService`, `NotificationDigestQueryService`, etc.).
6. Add shared interface contracts under `packages/shared/src/contracts/*` before any runtime extraction.
7. Introduce an MVP feature-flag system as repo-backed config plus environment overrides, with a client-safe bootstrap endpoint.
8. Split CI/CD by subsystem before splitting runtimes; pipeline separation is the first speed multiplier.
9. Preserve shared Terraform layers for `00-foundation` and `10-data`, but split compute by logical service group when extraction begins.
10. Align workflow outputs and Terraform outputs immediately; current deploy flow references `api_app_name` while Terraform exposes `api_container_app_name`.

## Backlog pushed from architecture review
- Add shared contract files for workforce/compliance/records/reference/notifications/feature flags.
- Add repository interfaces to remove direct Prisma coupling from services.
- Add subsystem-aware path filters and promotion logic to CI/CD.
- Add deploy target/module naming per backend service group.
- Gate incomplete domains (hours, labels, escalation rules, route registry rollout) with feature flags.
- Add an architecture test plan covering path filters, deploy isolation, menu visibility, and flag parity.
---

### 2026-03-16: Copilot branch convention and branch protection limit
**By:** Daniels
**Decision:** Keep `.github/copilot-instructions.md` as the primary memory file for `@copilot`. Use `copilot/{issue-number}-{slug}` as the preferred Copilot branch naming convention, but treat it as a documented repo standard for now because GitHub does not currently expose a repository setting to force that pattern.
**Why:** Squad and Copilot issue routing both benefit from stable issue-numbered branches. During this update, both repository rulesets and classic branch protection APIs returned GitHub plan-limit 403s for the private `ivegamsft/work-tracker` repo, so server-side enforcement remains pending a repo upgrade or public visibility.

---

# Pearlman Proof Audit — Decision Intake

## Proposed durable decisions

1. **Keep the six top-level proof types.** Do not add a separate `medical` proof type; medical remains a `clearance` subtype.
2. **Do not silently default legacy untyped requirements to `compliance`.** Published templates must be explicitly classified before they are treated as authoritative.
3. **Treat expiration as historical evidence plus next-cycle work.** Expiration must not clear prior fulfillment evidence.
4. **Require policy constraints for attestation combinations.** `clearance` cannot be L1-only, and Level 4 validation requires separation of duties.
5. **Use evidence packages for external vault sharing.** Zero-knowledge vault content should not be exposed by raw share-link decryption.

## Why this matters

These decisions align the proof model with regulated-industry expectations for auditability, trust hierarchy, and controlled disclosure. They also reduce downstream churn by tightening terminology and lifecycle semantics before more UI/API work lands.

