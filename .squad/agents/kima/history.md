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
