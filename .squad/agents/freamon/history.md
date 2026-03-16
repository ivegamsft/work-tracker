# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **Proof taxonomy consistency review completed (2026-03-18):** Reviewed `docs/architecture/proof-taxonomy.md` against `docs/architecture/templates-attestation-spec.md` and the industry proof reference at `.squad/decisions/inbox/copilot-directive-industry-proofs.md`. Key architecture pattern: the proof system is now a shared contract across taxonomy + templates, so schema, readiness states, and RBAC must be normalized in both docs before Bunk implements anything. Blocking gaps found: `ProofRequirement` contract drift (optional vs required `proofType`, string vs enum subtype/unit), unsupported quantitative `PARTIAL` progress for hours, broken preset provenance (`presetId` has no FK/template-level source relation), and preset route/RBAC mismatch. User preference reinforced: review in cross-spec terms first and call out contradictions before implementation. Detailed report captured at `.squad/decisions/inbox/freamon-taxonomy-review.md`.
- **PRD ↔ Architecture reconciliation completed (2026-03-17):** Reconciled the PRD (`docs/prds/eclat-spec.md`) against both architecture specs. Key terminology mappings documented: PRD "Certifications" = our "Qualifications", PRD "Clearance" = our "Medical", PRD's 4 roles map to our 5 (PRD's "Manager" splits into Supervisor + Manager). Deleted stale duplicate at `docs/architecture/product-spec.md`. Added PRD Coverage Analysis (§9) to app-spec mapping all 20 PRD screens — 10 fully covered, 7 partially covered, 3 deferred. Added PRD RBAC Deltas table to RBAC spec. 12 features explicitly deferred to Phase 2+: hours/qualification approval workflows, Reports API, Compliance API, Integration endpoints, audit view screen, AI config, manager reports, escalation management, self-service requirements, team gaps view, user management admin. 7 architectural decisions documented (keep 5 roles, keep our naming, employee can't self-create qualifications, no approve/reject yet, only Admin edits employees). Decision at `.squad/decisions/inbox/freamon-prd-reconciliation.md`.
- **Application specification authored (2026-03-17):** Comprehensive app spec at `docs/architecture/app-spec.md` defining 23 `apps/web` screens and 9 `apps/admin` screens, role-adaptive navigation, per-screen functionality matrices, screen→API mappings, and dashboard widget system. Key decisions: "Employees" nav renamed to "Team" and hidden from Employee role; employee dashboard rewritten around personal readiness + quick actions (clock in/out, upload doc, view profile); self-service cannot create compliance records (qualifications/medical managed by Supervisor+); standards read-only in `apps/web`; document review is Manager+ not Supervisor+. Identified 3 API gaps for Bunk: `GET /api/documents/employee/:employeeId` (P0), batch readiness endpoint (P1), compliance report endpoint (P2). 5-phase implementation order starting with Employee UX. Triggered by user feedback: "this screen is really confusing. no quick actions. employees should be trimmed. what is the directory?"
- **RBAC API specification authored (2026-03-17):** Comprehensive RBAC reference at `docs/architecture/rbac-api-spec.md` with 65 endpoint catalog, 36 permissions across 11 resource categories using `{resource}:{action}` syntax, 5-role data scoping, three-layer enforcement (UI → API middleware → Prisma), and migration path for Phase 2 custom roles. Permission-first architecture enables future extensibility. Contract verified against actual router files.
- **Sharing & Proof Vault specification authored (2026-03-18):** Comprehensive sharing spec at `docs/architecture/sharing-spec.md` defining the Proof Vault — a secure document sharing layer on top of the existing `documents` module. Covers: sharing model (shared folders, per-file sharing, 4 permission levels, time-limited share links for external auditors), 7 vault sections (My Vault, Shared With Me/By Me, Archive, Recent, File Requests, Deleted), zero-knowledge encryption design with phased migration (server-side first in Phase 2b, client-side crypto in Phase 3+), file requests workflow (manager→employee proof requests with deadlines, auto-share on fulfillment, escalation rules), storage quotas (role-based defaults, admin management), 42 new API endpoints under `/api/vault/`, 8 new `vault:*` permissions integrated with existing RBAC, 6 new web screens (W-24 through W-29) + 1 admin screen (A-10), 7 new Prisma models, and full audit trail/notification integration. Key architecture decisions: vault access is ownership+share-based (not role-hierarchy-based), share links restricted to Compliance Officer+, file requests restricted to Supervisor+, encryption phased to avoid blocking sharing features on crypto complexity. Recommended for Phase 2b implementation. Decision at `.squad/decisions/inbox/freamon-sharing-spec.md`.

- **Proof Vault Encryption Architecture authored (2026-03-18):** Comprehensive zero-knowledge proof vault spec at `docs/architecture/proof-vault-spec.md`. AES-256-GCM + PBKDF2 (100K iterations), client-side encryption via WebCrypto API, server-side decryption only for zip export. Two new Prisma models (ProofVault, VaultDocument), 12 new API endpoints under `/api/vault`, sentinel-based key verification, separate from existing Document review workflow. Metadata (filenames, sizes) in plaintext for searchability; file content encrypted. RBAC: employees own their vault, Supervisor+ sees existence/count only, no role can access another's content. Three-phase rollout. 9 architectural decisions documented. Decision at `.squad/decisions/inbox/freamon-proof-vault-architecture.md`.

- **Proof Template & Attestation Levels spec authored (2026-03-18):** Comprehensive architecture spec at `docs/architecture/templates-attestation-spec.md` for manager-to-employee compliance templates. Defines 4-level attestation system: Level 1 Self-Attest (25% trust), Level 2 Upload (60%), Level 3 Third-Party (85%), Level 4 Validated (100%). Supports compound levels (e.g., `upload_validated`) via array storage. 4 new Prisma models: `ProofTemplate`, `ProofRequirement`, `TemplateAssignment`, `ProofFulfillment`. Template lifecycle: draft → published → archived with versioning (edits create new versions, assignments frozen to version at assignment time). Assignment types: individual, by-role, by-department with auto-assignment on employee changes. Full fulfillment workflow: unfulfilled → pending_review → fulfilled/rejected/expired. 25 new API endpoints under `/api/templates` and `/api/fulfillments`. 9 new permissions (`templates:*`, `fulfillments:*`). 9 new web screens (W-30 through W-38) + 2 admin screens (A-11, A-12). Integration with Proof Vault (Level 2), Qualifications/Medical (auto-fulfill), Standards framework, Notifications, and Readiness scoring. Recommended for Phase 2b with Proof Vault. 9 architecture decisions documented. Decision at `.squad/decisions/inbox/freamon-templates-attestation.md`.
- **Documentation taxonomy standardized (2026-03-16):** Project docs now live under a category-based `docs/` tree: `ideas/`, `requirements/`, `specs/`, `guides/`, `tests/`, `plans/`, `decisions/`, and `prompts/`. Prompt-adjacent artifacts were split out of the old `prompts/` workspace, and cross-references were updated from legacy `prds/` and `architecture/` paths to the new `requirements/`, `specs/`, and `tests/` locations, including the RBAC → test-data-strategy link and the prompt-pack load order guide.

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
