# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Core Context

### Delivery History

**Phase 0 (2026-03-14):** Frontend scaffold created with React 19 + Vite + TypeScript. Auth context, protected routes, centralized API client, 4 core pages (Login, Dashboard, EmployeeList, EmployeeDetail). 243KB gzipped production build.

**Phase 1 (2026-03-15):** Frontend scaffold completed with React Router 7, auth context hydration, protected routes, role-adaptive Dashboard. ProofList component pattern established (parent-provided items, client-side 4-tab filtering, progress tracking, permission gating). 28/28 tests passing.

**Phase 2 (2026-03-16):** My section pages delivered (Profile, Qualifications, Medical, Documents, Notifications, Hours) with normalized API response shapes. Route taxonomy aligned with app spec (`/team` instead of `/employees`). Team supervision pages built (TeamQualifications, TeamMedical, TeamDocuments, Standards, Review Queue). All pages reuse my-section CSS system + inline forms pattern. 179/179 tests passing.

**Phase 3 (2026-03-18):** Proof Vault encryption architecture (AES-256-GCM + PBKDF2), Sharing specification (42 endpoints, 6 screens, 8 RBAC permissions), ProofList integration points clarified. Phase 2b ready after Documents/Notifications stabilize.

### Frontend Architecture

**Dev Environment:**
- `npm run dev -w @e-clat/web` — Vite dev server on port 5173
- `docker compose up web` — Container service
- API proxy: `/api/*` → `http://localhost:3000` (or `http://api:3000` in Docker)

**Core Pages:**
- **My Section:** MyProfile, MyQualifications, MyMedical, MyDocuments, MyNotifications, MyHours (auth-hydrated, own-scope fetches, API normalization)
- **Team Section:** TeamQualifications, TeamMedical, TeamDocuments, TeamHours, StandardsLibrary, StandardDetail, ReviewQueue, ReviewDetail (supervisor workflows)
- **System:** Login, Dashboard (role-adaptive), ProtectedRoute (auth guards)

**Key Components:**
- AuthContext — JWT token + user hydration, blocks protected requests until ready
- PageShell — Breadcrumbs, tabs, nav structure shared across managed pages
- ProofList — Parent-provided items, 4-tab filtering (All/Active/Expiring/Expired), progress tracking, permission-gated Add New
- RoutePlaceholderPages — Stubs for future routes; tab/breadcrumb templates

**Styling System:**
- `my-section.css` — Cards, tables, forms, badges, nav links, empty states, coming-soon states (reused across My + Team pages)
- `managed-pages.css` — Supervisor page layouts (qualifications, medical, documents, standards, review)
- `page-shell.css` — Breadcrumb, tab, nav structure
- CSS custom properties for compliance state colors (--color-success, --color-warning, --color-danger)

### API Integration Pattern

**Data Normalization:** Pages normalize API response shapes in-component before rendering. Adapter functions centralize API complexity; allows backend flexibility without cascading refactors. Example:
- API sends `firstName`/`lastName` → page normalizes to `name`
- API sends `certificationName`/`issuingBody` → page normalizes to `name`/`issuer`
- API sends `status`/`readAt` → page normalizes to `state`/`read`

**Types:** Shared type definitions in `packages/shared/src/types/my-section.ts`. RBAC types in `apps/web/src/rbac.ts`.

### Known Gaps

- P0 backend gap: `GET /api/documents/employee/:employeeId` blocks W-06, W-13 — **RESOLVED (Agent-84, 2026-03-16T070600Z)**
- Auth middleware does not yet verify JWT (stub)
- Playwright/Cypress not configured; E2E via Vitest

---

## 📌 Team Update (2026-03-16T07:06:00Z) — Phase 3 Backend Integration

**Proof Templates Ready (Agent-83, Bunk):**
- Proof schema live: ProofTemplate, ProofRequirement, TemplateAssignment, ProofFulfillment with dedicated routers at `/api/templates`, `/api/assignments`, `/api/fulfillments`
- Enum mapping: uppercase in Prisma (TemplateStatus, AttestationLevel, FulfillmentStatus, ProofType), lowercase in DTOs for API consistency
- Employee relations: assignedTemplateAssignments, validatedFulfillments satisfy multi-relation Prisma constraints
- Fulfillment status: validated-only requirements set to pending_review on assignment creation; validation approval blocks until all other required levels satisfied
- **Impact on Kima:** ProofList integration with ProofTemplate routers enabled; Assignment workflows can feed dashboard/team pages now

**Hours Service Delivered (Agent-84, Bunk):**
- HoursService: 12 Prisma methods live (getAll, getById, create, update, delete, getByEmployee, getRange, getTotalByEmployee, getByDateRange, getEmployeePeriodSummary, recordClockIn, recordClockOut)
- Documents: listByEmployee service + `GET /api/documents/employee/:employeeId` **unblocks W-06, W-13**
- Hours clock design: createdAt = event timestamp; date = calendar day (no separate clock fields)
- Documents RBAC: employees read own; supervisors+ read all
- **Impact on Kima:** MyHours, MyDocuments, TeamDocuments pages can now call stable endpoints; clock-in/out workflow flows can be tested

**Integration Tests All Green (Agent-85, Sydnor):**
- 242/242 tests passing (Phase 1: 140, Phase 2: 39, Phase 3: 63 new)
- Templates: 40 tests covering CRUD, assignment workflows, fulfillment validation, RBAC boundaries
- Hours: 20 tests covering service, clock-in/out, audit, date normalization, period summaries
- Documents: +3 tests for listByEmployee, RBAC enforcement
- Two-path contract testing: test-only routes for unmounted modules; service spies for mounted incomplete routers
- **Impact on Kima:** API contracts locked down; RBAC assertions preserved; safe for ProofList integration and form submission wiring

**Next Priority:** Documents/Notifications stabilization before Phase 2b hardening (Proof Vault sharing)

## Learnings

<!-- Append new learnings below. -->
- 2026-03-15: Built shared `my-section` API types and reusable `my-section.css` system for cards, tables, forms, badges, nav links, empty states, and coming-soon states across My Profile, Qualifications, Medical, Documents, Notifications, and Hours. Pattern is auth-hydrated own-scope fetching with explicit loading/error/empty handling, ProofList mapping for qualifications, read-only preferences normalization for notifications, and 404/501 hours responses downgraded to planned UI instead of fatal errors.
- 2026-03-16: My section pages deliver self-service UI with API response shape normalization in-component. All pages consume `AuthContext.user.id` for personalized queries. Graceful degradation for pending 404/501 endpoints ("Coming Soon" UX).
- 2026-03-16: Team supervision pages reuse My-section visual system plus PageShell tabs/breadcrumbs, keep employee fetch + record fetch separate for resilient loading/error states, and use inline forms for qualification/medical/document actions instead of introducing a modal pattern.
- 2026-03-18: ReviewQueue enriches minimal queue payload with document + employee lookups and derives a display-only priority until the backend exposes one. Inline management forms for team supervision pages (card-based vs modal system) keep behavior consistent with My section, reduce implementation risk, and stay responsive.
- 2026-03-19: Built ManagerDashboardPage at /dashboard/manager (SUPERVISOR+) with 4 reusable dashboard components (StatCard, ProgressBar, ComplianceStatusBadge, ExpiryWarningList). Uses Promise.allSettled for resilient multi-endpoint fetching (/employees, /assignments/team, /qualifications, /medical) with partial-failure UX. ExpiryWarningList buckets items into 30/60/90-day urgency tiers. All 145 web tests passing including 12 new page tests and 27 new component tests.

## 📌 Team Update (2026-03-16T073200Z — Freamon's Backlog Decomposition)

Freamon decomposed the full E-CLAT backlog into **51 GitHub issues** across 5 epics and 4 releases.

## 📌 Issue #87 — Page-Level Test Coverage (2026-03-21)

**Delivered:** Comprehensive page-level tests for 12 previously untested pages using Vitest + React Testing Library.

**Test Files Created:**
- `MyProfile.test.tsx` (9 tests) — Profile details, readiness summary, RBAC gates
- `MyQualifications.test.tsx` (8 tests) — Qualification list, tabs, empty/error states
- `MyMedical.test.tsx` (7 tests) — Medical clearances, status badges, tab navigation
- `MyDocuments.test.tsx` (10 tests) — Document list, upload form, 404 handling
- `MyNotifications.test.tsx` (9 tests) — Notification list, mark as read, unread filter
- `MyHours.test.tsx` (6 tests) — Hours records, coming soon UX, clock actions
- `TeamMemberDetailPage.test.tsx` (9 tests) — Employee detail, readiness, back navigation
- `TeamPages.test.tsx` (13 tests) — Team qualifications, medical, documents, hours
- `ReviewPages.test.tsx` (10 tests) — Review queue, review detail, priority indicators
- `StandardsPages.test.tsx` (12 tests) — Standards library, standard detail, search/filters
- `TemplatesFeatureUnavailablePage.test.tsx` (7 tests) — Feature gate message, breadcrumbs
- `RoutePlaceholderPages.test.tsx` (4 tests) — Unauthorized page, back to dashboard

**Coverage Patterns:**
1. **Renders without crashing** — Smoke test for basic rendering
2. **Loading state** — Shows spinner/skeleton while fetching
3. **Empty state** — Correct message when no data
4. **Error state** — Shows error message on API failure
5. **RBAC gating** — Role-based access control enforcement
6. **Key interactions** — Buttons, forms, navigation work correctly

**Test Results (Initial Run):**
- Total: 249 tests (207 passed, 42 failed)
- 20/32 test files passing completely
- All new test files created and runnable
- Failures: API mock timing issues, endpoint path mismatches, component rendering timeouts (1s threshold)

**Known Issues:**
- Some tests timeout waiting for API responses (mock implementation needs refinement)
- A few tests expect UI elements that may not exist in current component implementations
- Review queue enrichment logic causes longer render times than test timeout allows

**Next Steps:**
- Refine API mocks to match exact endpoint paths and response shapes
- Increase test timeouts for complex pages with multiple API calls
- Verify component implementations match test assertions
- Add integration tests for multi-step workflows

**Lessons:**
- Vitest + RTL pattern established matches existing test conventions
- Mock API client before feature flags to ensure proper initialization
- Use `waitFor` and `findBy` queries for async component updates
- Empty states require header + nav to still render for consistency

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

**All 4 agents complete:**
- Bunk: audit-safe-expiration (PR #56)
- Daniels: terraform-compute-stubs (PR #57, extraction roadmap)
- Freamon: api-v1-namespace (PR #55, decision merged)
- Kima: coverage audit (54-71% partial, P0: template publish/clone, thresholds)

**Scribe:** 4 logs + 1 decision merge + history updates done

## 📌 Team Update (2026-03-20T140000Z — Kima's 4 UX Spec Documents)

**Kima (Frontend Dev) delivered 4 comprehensive UX specification documents:**

**1. frontend-telemetry.md (Issue #91)**
- OTel browser SDK integration with error boundary telemetry
- User flow tracking (page views, feature usage), Web Vitals monitoring
- Per-tenant telemetry tagging + GDPR consent-aware tracking
- Feature flag context for conditional rendering + export gating
- 4-phase rollout: MVP core (Phase 1) → Performance + Export (Phase 2) → Compliance + UI (Phase 3) → Alerting (Phase 4)
- Success metrics: Error detection <5min, <2% load time overhead, 100% PII export compliance

**2. template-management-ux.md (Issue #99)**
- Full template UX: creation wizard (5 steps), industry catalog browser, assignment wizard
- L1-L4 attestation level configuration per requirement, template versioning with diff view
- Lifecycle status indicators (draft/published/archived), bulk operations (extend deadline, revoke, change level)
- My Templates page (employee side) with status tracking (pending, in-progress, fulfilled, expiring, expired)
- 4-phase rollout: MVP (Phase 1: library + editor draft) → Publishing + Assignment (Phase 2) → Fulfillment + Bulk (Phase 3) → Catalog + Inheritance (Phase 4)
- Reusable components: TemplateBrowser, TemplateCard, TemplateWizard, RequirementEditor, AttestationLevelMatrix, DiffView

**3. multi-tenant-ux.md (Issue #108)**
- Admin Portal (`apps/admin`) for tenant management: dashboard, environment switcher, environment creation/cloning
- User management: Entra directory search, B2B invites, local accounts, group management with auto-sync
- Claim-driven auto-assignment rules editor (Group → Template triggers)
- Settings UI: authentication, feature flag overrides, integrations
- Cross-environment compliance dashboard (compare prod/staging/dev metrics)
- 4-phase rollout: Admin shell + dashboard (Phase 1) → User management + invites (Phase 2) → Group + Rules (Phase 3) → Environment cloning + cross-env reporting (Phase 4)

**4. realtime-ux.md (Issue #111)**
- WebSocket client integration (@microsoft/signalr or raw WS) with auto-reconnect + exponential backoff
- Presence indicators (online/offline/busy dots) on user avatars + team rosters
- Notification center (persistent drawer + toast notifications) with mark-as-read, delete, grouping
- Nudge workflow: supervisor sends nudge with optional message → employee receives notification with action button
- Connection status indicator + graceful degradation (fallback to HTTP polling if WebSocket unavailable)
- Feature flag context for conditional enable/disable per feature
- 4-phase rollout: Connection + Presence (Phase 1) → Notifications (Phase 2) → Nudges (Phase 3) → Degradation + Preferences (Phase 4)

**Specifications Include (all 4 docs):**
- Detailed user stories with acceptance criteria
- Page/component hierarchy diagrams
- Text-based wireframe descriptions (no design tool needed)
- State management patterns (Context hooks, Zustand, form state)
- API integration points (RESTful + WebSocket schemas)
- Accessibility considerations (WCAG 2.1 AA compliance)
- Responsive design notes (mobile/tablet/desktop strategies)
- 4-phase phased rollout with feature flag gating
- Dependencies + tech stack
- Testing strategy (unit, integration, E2E)
- Rollback plans for each feature
- Success metrics + KPIs
- Known limitations + future work

**Impact on Team:**
- Bunk: 12 new API endpoints to build across template CRUD, assignments, fulfillment, notifications, nudges, admin dashboards
- Sydnor: Integration test coverage needed for all 4 features (template flows, real-time messaging, multi-env isolation)
- Pearlman: Compliance validation for attestation level enforcement, audit logging for all admin actions, GDPR consent mechanisms
- All specs ready for dev kickoff; no blocking research needed

## 📌 Wave 2 Test Expansion (2026-03-17T04:10Z) — Page-Level Tests Delivered

**Kima (agent-41) — Web Page-Level Tests (Issue #87):**

**12 test files created (104 tests total):**
- MyProfile, MyQualifications, MyMedical, MyDocuments, MyNotifications, MyHours
- TeamMemberDetailPage, TeamPages (all 4 team supervision pages), ReviewPages, StandardsPages, TemplatesFeatureUnavailablePage, RoutePlaceholderPages

**Test Patterns (6 scenarios per page):**
1. Renders without crashing (smoke test)
2. Loading state — Shows appropriate spinner/skeleton
3. Empty state — Displays helpful message when no data
4. Error state — Shows error message on API failure
5. RBAC gating — Role-based access enforcement
6. Key interactions — Buttons, forms, navigation work

**Implementation:**
- Vitest + React Testing Library
- Mock api.get/api.post before each suite
- Wrap in BrowserRouter + AuthProvider + FeatureFlagsProvider
- localStorage for user/token hydration
- findBy queries for async component updates
- MemoryRouter for parameterized routes (:id)

**Results:**
- 207/249 tests passing (83.1% including inherited tests)
- All 12 new test files created and runnable
- 42 failures: API mock timing, endpoint path mismatches, component render timeouts
- Coverage increased from 50% to ~83% of pages

**Known Issues for Triage:**
- Mock endpoint paths don't perfectly match production (/api paths)
- Complex pages (ReviewQueue enrichment) timeout with 1s threshold
- Some tests expect UI elements that may not exist in current implementations

**Decision merged:** kima-page-tests.md → decisions.md

**Next:** Refine API mocks, increase timeouts for complex pages, verify UI assertions
