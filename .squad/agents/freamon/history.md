# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Core Context

### Architecture Decisions & Specifications
- **PRD ↔ Arch Reconciliation (2026-03-17):** Terminology mappings documented (PRD "Certifications" = our "Qualifications", PRD "Clearance" = our "Medical"). 12 features deferred Phase 2+ (approval workflows, Reports/Compliance APIs, manager reports, escalation, self-service requirements, team gaps, user mgmt). 7 decisions: keep 5 roles, keep our naming, employee can't self-create qualifications, no approve/reject endpoints yet, only Admin edits employees.
- **App Specification (2026-03-17):** 23 `apps/web` screens + 9 `apps/admin` screens, role-adaptive navigation, dashboard redesign with quick actions, document review is Manager+ not Supervisor+, self-service cannot create compliance records. 3 API gaps: `GET /api/documents/employee/:employeeId` (P0 blocker), batch readiness (P1), compliance reports (P2).
- **RBAC Specification (2026-03-17):** 65 endpoint catalog, 36 permissions across 11 resource categories, 5-role data scoping, three-layer enforcement.
- **Sharing & Proof Vault (2026-03-18):** 42 API endpoints, zero-knowledge encryption (phased), file requests workflow, storage quotas, 7 vault sections, 6 new web screens + 1 admin screen.
- **Proof Vault Encryption (2026-03-18):** AES-256-GCM + PBKDF2, client-side encryption via WebCrypto, 12 new API endpoints, separate from document review.
- **Proof Templates & Attestation (2026-03-18):** 4-level attestation system (Self/Upload/Third-Party/Validated), 25 new API endpoints, 9 new web screens, 2 admin screens, integration with Vault/Qualifications/Standards.
- **Proof Taxonomy Consistency (2026-03-18):** Reviewed against templates spec. Blocking gaps: `ProofRequirement` contract drift, unsupported quantitative `PARTIAL` progress for hours, broken preset provenance, preset route/RBAC mismatch.

### Implementation Status
- **Coverage Matrix (2026-03-16):** 48 features mapped across 12 categories. 4 ✅ (fully), 17 🔧 (API only), 20 📋 (spec only), 7 ❌ (not started). Classification rules: `🔧` = working backend + no UI; `❌` = service throws `notImplemented(...)`; `📋` = docs only; components alone ≠ UI screens. P0 blocker: `GET /api/documents/employee/:employeeId` (blocks W-06, W-13).

### Operations
- **Squad Skills Runbook (2026-03-16):** Added 6 reusable operations under `.squad/skills/`: `commit-and-push`, `secret-scan`, `spec-review`, `docker-reset`, `prisma-migrate`, `git-status-report`. Standardizes recurring coordinator actions with pass/fail criteria and ownership defaults.
- **Documentation Taxonomy (2026-03-16):** Reorganized under category-based structure: `requirements/`, `specs/`, `decisions/`, `guides/`, `plans/`, `ideas/`, `tests/`, `prompts/`. Cross-refs updated across 29 moved files.

---

## 📌 Team Update (2026-03-16T02:25:09Z)

**Documentation Taxonomy Reorganized:**
All project docs now live under category-based structure:
- `docs/architecture/` → `docs/specs/` (architecture, technical design specs)
- `docs/prds/` → `docs/requirements/` (product requirements, user stories)
- `docs/adrs/` → `docs/decisions/` (architectural decisions)
- `docs/prompts/` + planning artifacts → split: `docs/prompts/` (only actual AI prompts) + `docs/ideas/`, `docs/plans/`, etc.

**Key paths updated:**
- PRD: `docs/prds/eclat-spec.md` → `docs/requirements/eclat-spec.md`
- App spec: `docs/architecture/app-spec.md` → `docs/specs/app-spec.md`
- RBAC spec: `docs/architecture/rbac-api-spec.md` → `docs/specs/rbac-api-spec.md`
- Sharing spec: `docs/architecture/sharing-spec.md` → `docs/specs/sharing-spec.md`
- Proof vault spec: `docs/architecture/proof-vault-spec.md` → `docs/specs/proof-vault-spec.md`
- Templates spec: `docs/architecture/templates-attestation-spec.md` → `docs/specs/templates-attestation-spec.md`
- Proof taxonomy: `docs/architecture/proof-taxonomy.md` → `docs/specs/proof-taxonomy.md`

All cross-references updated; 29 files moved with git history preserved; 179 tests passing. Commit 84af84f (pushed).

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **Implementation Status Classification Rules (2026-03-16):** Status classification: `🔧 API Only` = working backend surface, no routed UI screen. `❌ Not Started` takes precedence over exposed routes when service layer throws `notImplemented(...)`. `📋 Spec Only` = documented in specs, no frontend routes/API modules/Prisma schema. Reusable components without routing ≠ implemented UI screens. Rules prevent overstating progress in hours, labels, auth flows.
- **Reusable squad operations skill pack (2026-03-16):** Six runbooks at `.squad/skills/`: `commit-and-push`, `secret-scan`, `spec-review`, `docker-reset`, `prisma-migrate`, `git-status-report`. Standardized recurring coordinator actions with pass/fail criteria.
- **Proof architecture unified across specs (2026-03-18):** Proof system is shared contract across taxonomy + templates + vault. Must normalize schema, readiness states, RBAC in all specs before implementation. Blocking gaps in taxonomy: `ProofRequirement` contract drift, unsupported quantitative `PARTIAL` progress, broken preset provenance, preset route/RBAC mismatch.
- **Phase 2b Integration Scope (2026-03-18):** Proof Vault (12 endpoints, 2 Prisma models, AES-256-GCM client encryption), Sharing (42 endpoints, 6 web screens, 8 RBAC perms), Templates/Attestation (25 endpoints, 9 web screens, 4-level system). All spec-ready; implementation after Phase 1.
- **Backlog Decomposition Pattern (2026-03-16):** Decomposed 51 issues from 18 source documents into 5 epics across 4 releases. Key patterns: (1) Create epics first to establish context, (2) Pre-assign to squads based on domain expertise from specs, (3) Use go:yes for well-defined work and go:needs-research for spikes/design, (4) Document source, dependencies, and acceptance criteria in every issue body, (5) Cross-reference related issues by number. Squad distribution: Bunk (16 backend), Kima (13 frontend), Daniels (12 architecture/DevOps), Pearlman (7 compliance), Freamon (3 spikes), Sydnor (1 testing). Priority split: 14 P0, 25 P1, 13 P2. Release targeting based on dependency chains and risk: v0.4.0 (bugs + template UI), v0.5.0 (architecture + compliance), v0.6.0 (service extraction).
- **Admin Shell Dormant Decision (2026-03-19):** Decided to mark `apps/admin` as dormant for MVP (v0.4.0–v0.6.0) after investigation revealed it's a pure scaffold (2 files, zero code). Admin features will be implemented in `apps/web` with `requireRole(Roles.ADMIN)` guards during MVP, then extracted to dedicated admin app during service extraction phase (v0.7.0+). Rationale: (1) No code = wasted CI cycles if pipeline added now, (2) Admin features ship faster in web app, (3) RBAC provides security boundary, (4) Aligns with service extraction strategy. Created `apps/admin/DORMANT.md` (developer guide), `docs/specs/admin-shell-status.md` (full decision record with 9-step migration plan), and `.squad/decisions/inbox/freamon-admin-shell.md`. No CI lane added (path detection exists but no validation job needed). Related: #49.
- **Documentation Refresh for v0.4.0-v0.5.0 (2026-03-17):** After shipped work stabilized, updated implementation-status.md to reflect 415 tests passing (up from 242), 11 API modules (dashboard added), 25+ web screens (vs 4 previously). Created PR #71 capturing recent shipped work: template UI (8 pages, 25 endpoints), hours pages activation, manager analytics dashboard, admin dormant strategy, pipeline completion, API v1 namespace spike, attestation policies. Updated README and copilot-instructions accordingly. Pattern: docs-only PRs are low-risk, can be reviewed quickly, serve as checkpoints for team alignment on progress. Recommend quarterly refreshes.


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
- Bunk: audit-safe-expiration (PR #56, 3 endpoints)
- Daniels: terraform-compute-stubs (PR #57, 6 modules)
- Freamon: api-v1-namespace (PR #55, decision merged to decisions.md)
- Kima: coverage audit (54-71% partial, P0 blockers identified)

**Scribe:** Orchestration logs created, decision inbox merged, histories updated
