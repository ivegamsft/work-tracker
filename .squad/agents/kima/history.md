# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Core Context

### Frontend Architecture & Components
- **Frontend Scaffold Complete (2026-03-15):** React 19 + Vite + TypeScript SPA with React Router 7, auth context, protected routes, centralized API client, 4 core pages (Login, Dashboard, EmployeeList, EmployeeDetail). 243KB gzipped production build. API contracts: login returns `{ token, user }`, employees list + detail, readiness endpoint with expiry.
- **ProofList Component Pattern (2026-03-18):** Parent-provided proof items (no component fetching), client-side 4-tab filtering (All/Active/Expiring/Expired), progress tracking (`requirementsMet`, `requirementsTotal`), permission-gated Add New, paperclip labels for files. 28/28 tests passing.
- **Documentation Taxonomy (2026-03-16):** Specs at `docs/specs/` (app-spec, rbac-api-spec, sharing-spec, proof-vault-spec, templates-attestation-spec). 179 tests passing.

### Phase Architecture & Coordination
- **MVP Scope Locked (2026-03-14):** Core loop: Qualifications + Medical (no Hours); Documents deferred Phase 2; single-org; `overallStatus` 3-state rule; in-app notifications only. Phase 1: Admin login + basic shell. Phase 2: Employee management, standards, qualifications. Phase 3: Medical workflows, notifications UI.
- **Entra ID Auth Architecture (2026-03-15):** Token validation (direct, no re-sign), mock tokens mirror Entra claims, backend `TokenValidator` pattern, Phase 1 (backend interface) independent, Phases 2-3 blocked on tenant/consent.
- **Proof Vault Encryption (2026-03-18):** AES-256-GCM + PBKDF2 (client-side zero-knowledge encryption), server-side decryption for zip export only. 12 API endpoints, 2 Prisma models, 3-phase rollout (MVP → zip → Argon2).
- **Sharing Specification (2026-03-18):** 42 API endpoints, 6 new web screens (W-24–W-29), 8 RBAC permissions (ownership+share-based). Phase 2b ready after Documents/Notifications.

### Development Workflow
- **Dev environment:** `npm run dev -w @e-clat/web` (Vite :5173), `docker compose up web` (container)
- **API proxy:** `/api/*` → `http://localhost:3000` or `http://api:3000` (Docker)
- **RBAC boundaries:** Dashboard role-adaptive, employee directory supervisor+, employee-directory 403s should render permission-aware UI, auth context hydration blocks protected requests

### Known Gaps
- P0 backend gap: `GET /api/documents/employee/:employeeId` blocks W-06, W-13
- Auth middleware does not yet verify JWT (stub)
- Playwright/Cypress not configured; E2E via Vitest

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

## Learnings

- **Frontend Auth & RBAC (2026-03-16):** Role-gated pages must wait for AuthContext hydration before protected requests. Employee users skip employee-directory fetches; 403s should render permission-aware UI, not fatal errors. ProofList: parent-provided items, client-side filtering (All/Active/Expiring/Expired), Add New gated by create permission.
- **Specifications Ground Truth (2026-03-17):** RBAC spec (65 endpoints, 36 permissions, 5-role matrix) and App spec (23 core + 9 admin screens, 5-phase implementation) are canonical. Product spec locked 5-role model and terminology. All decisions merged to `.squad/decisions.md`.
- **My Section Self-Service UI (2026-03-15):** Built shared `my-section` API types and a reusable `my-section.css` system for cards, tables, forms, badges, nav links, empty states, and coming-soon states across My Profile, Qualifications, Medical, Documents, Notifications, and Hours. Pattern is auth-hydrated own-scope fetching with explicit loading/error/empty handling, ProofList mapping for qualifications, read-only preferences normalization for notifications, and 404/501 hours responses downgraded to planned UI instead of fatal errors. Assumed contracts: `/employees/:id` + `/employees/:id/readiness`, qualifications/medical/documents employee lists, notifications list + preferences, metadata-only document upload, and a future hours payload with date/clock totals.

## Phase 2 Auth & Frontend Sync (2026-03-15T23:34:38Z)

### Freamon Status Update (Lead)

✅ **Entra ID Authentication Architecture Complete:**
- Token validation (direct, no re-sign), `TokenValidator` pattern, `AUTH_MODE` toggle
- Phase 1 (backend interface) independent; Phases 2-3 blocked on tenant/consent

### Kima Status Update (Frontend)

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

## Team Updates (2026-03-18T00:47Z)

### ProofList Component Pattern Established

Kima's ProofList component + ProofCard pattern now locked in `.squad/decisions.md`:
- **Contract:** Parent-provided proof items (no component fetching)
- **Filtering:** Client-side 4-tab system (All, Active, Expiring Soon, Expired)
- **Progress tracking:** Requirement progress (`requirementsMet`, `requirementsTotal`)
- **Permission gating:** Add New control only shown when `canCreate && !isOwnProfile`
- **Evidence pattern:** Paperclip label for files; Upload hook for missing evidence

**Status:** 28/28 tests passing; TypeScript clean. Ready for integration with ProofVault screens once Freamon's vault API stabilizes.

### Proof Vault Architecture Ready

Freamon delivered full proof vault encryption architecture (`docs/architecture/proof-vault-spec.md`):
- **Crypto:** AES-256-GCM (WebCrypto native) + PBKDF2-SHA-256
- **Design:** Client-side encryption (zero-knowledge); server-side decryption for zip export only
- **API:** 12 endpoints under `/api/vault/`
- **Data model:** ProofVault + VaultDocument Prisma models
- **RBAC:** 6 new permissions (`vault:*`)
- **Phased rollout:** MVP (upload/download/delete) → Zip export → Argon2

**Implication:** Proof list UI will need to integrate with vault document lifecycle. Coordinates with vault module for file uploads/deletions from ProofCard.

### Sharing Specification Complete

Freamon's sharing spec (`docs/architecture/sharing-spec.md`) adds vault organization layer:
- **42 API endpoints** under `/api/vault/`
- **6 new web screens** (W-24 through W-29) for sharing, requests, archive, deleted
- **8 RBAC permissions** (ownership+share-based, not role-hierarchy-based)
- **Phase 2b ready:** After Documents/Notifications stabilize

**Implication:** Proof list screens will support sharing actions (share, request files, archive). May require proof-card action menus or sharing modals. Coordinate with Bunk for API availability.

**Development workflow:**
- `npm run dev -w @e-clat/web` — starts Vite dev server on port 5173
- `docker compose up web` — runs web service in container
- API proxy: `/api/*` → `http://localhost:3000` (or `http://api:3000` in Docker)
