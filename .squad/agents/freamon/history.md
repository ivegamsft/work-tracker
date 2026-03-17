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

## 📌 Wave 3: Spec Decomposition (2026-03-17T04:30:00Z)

**Mission:** Decompose 6 architecture specifications into 20 implementation GitHub issues.

**Specs decomposed:**
1. app-spec.md — Screen catalog (23 web + 9 admin), adaptive navigation, dashboard redesign
2. rbac-api-spec.md — 65 endpoint catalog, 36 permissions, 5-role scoping, 3-layer enforcement
3. proof-vault-spec.md — Zero-knowledge encryption (phased), file requests, 7 vault sections, 6+1 web/admin screens
4. templates-attestation-spec.md — 4-level attestation system, 25 API endpoints, 9+2 web/admin screens
5. proof-taxonomy.md — 2-axis model (type × level), compound attestation validation
6. sharing-spec.md — 42 API endpoints, external sharing flows, evidence packages

**Issues created:** 20 (routing, dashboard, RBAC enforcement, Proof Vault infrastructure, template publish/clone/assign, sharing UI, encryption bootstrap, status machines, permission gates, admin dashboards, etc.)

**Result:** All issues linked to GitHub Project #2; ready for team assignment.

## 📌 Phase 2 Project Board & Epic Issues (2026-03-20T143000Z)

Created GitHub Projects (v2) board for phase 2 architecture work:
- **Project #3:** "E-CLAT Phase 2 — Platform Architecture"
- **8 Epic Issues** (#77–#84): One per track (Test Coverage, Monitoring, Identity, Templates, Qualifications, Multi-Tenancy, Event-Driven, Data Layer)
- **31 Spec Issues** (#85–#115): Complete specification deliverables across all 8 tracks, with squad assignments and decision locks documented

Architecture tracks now visible on board with clear ownership and dependencies. Each epic decomposes into 3-4 spec issues (strategy, API, IaC/UX, compliance/testing). All locked decisions referenced in acceptance criteria.

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **Phase 3 Implementation Execution Plan (2026-03-21):** Analyzed 140 open issues across 8 epic domains (templates, qualifications, proofs, real-time, multi-tenancy, identity, data layer, observability) and created 14-week phased execution plan. Foundation Sprint (weeks 1-2): 8 critical path issues establishing observability (OTel SDK #121-#128), identity registry (#134-#135), repository pattern (#181), and health endpoints (#127). Sprints 1-6: Templates (#145-#189, 18 issues), Qualifications (#169-#204, 16 issues), Proofs & Real-Time (#176-#210, 22 issues), Multi-Tenancy (#172-#206, 19 issues), Identity & Auth (#159-#162, 18 issues), Data Layer Polyglot (#212-#216, 20 issues). Squad assignments: Bunk 48 issues (backend), Kima 28 (frontend), Daniels 21 (infra), Pearlman 16 (compliance), Freamon 12 (lead/architecture), Sydnor 8 (testing). Success metrics: 94→140+ endpoints, 415→900+ tests, 65%→80%+ coverage, <200ms p95 latency, 100% audit trail compliance, 27/27 security tests. 13 risk callouts with mitigations (observability delays, SCIM failures, polyglot bugs, real-time scalability, token conflicts, RLS data leakage, audit gaps). Plan document: `docs/plans/phase3-implementation-plan.md`. GitHub meta-issue #217 created. Pattern: Foundation→Templates→Qualifications→Proofs/Real-Time→Multi-Tenancy→Identity→Data Layer. Enables parallel execution with clear dependencies and critical-path issues identified. Ready for squad kickoff.
- **Phase 2 Architecture Specs Complete (2026-03-21):** Authored 6 comprehensive architecture specifications covering 8 locked decisions. Each spec includes problem statement, proposed design, data model changes, API contracts, security considerations, phased rollout plan (3-4 sprints), and explicit locked decision references. Specs: (1) test-coverage-requirements.md — CRUD matrix for 10 modules, RBAC rules, 20+ security test cases, 80→900 test progression. (2) identity-architecture.md — Multi-IdP (GitHub-style bootstrap, B2B invite, SCIM), PII isolation, semi-anonymous profiles (encrypted Profile table, UUID-only business data). (3) template-management-strategy.md — Lifecycle state machine (DRAFT→PUBLISHED→DEPRECATED→ARCHIVED), industry catalog, group-based assignment, L1-L4 attestation integration, versioning. (4) qualification-engine.md — Layered customization (Standard immutable → Org additive → Dept narrowing → Individual exempt), "strictest wins" composition, 4 override types (EXPIRY_EXTENSION, PROOF_OVERRIDE, WAIVER, GRACE_PERIOD), third-party invite flow. (5) multi-tenant-architecture.md — Tiered isolation (shared=row-level, dedicated=separate DB), nested hierarchy (L0:Platform → L1:Tenant → L2:Environment → L3:Workspace), modular monolith + ring deployment (Canary→Beta→Stable), environment cloning, claim-driven assignment. (6) data-layer-architecture.md — Repository pattern abstraction, tenant-aware connection resolver, polyglot stores (SQL/Postgres, Cosmos/Mongo, Blob/MinIO, Redis, ADX/Prometheus), migration path Prisma→polyglot, store implementations per deployment (SaaS vs on-prem). All specs locked to Decisions 1-12 per charter. Total: 28K+ words, 60+ diagrams, 120+ API endpoints, 4+ data models per spec. Deliverables enable parallel implementation: Bunk (APIs), Daniels (IaC), Kima (UI), Pearlman (compliance validation), Sydnor (testing). Ready for v0.5.0-v0.7.0 execution. Files: `docs/specs/{test-coverage-requirements, identity-architecture, template-management-strategy, qualification-engine, multi-tenant-architecture, data-layer-architecture}.md`.
- **Phase 2 Board Structure (2026-03-20):** Each of 8 architecture tracks decomposes as: (1) strategy/architecture spec (Freamon lead) → (2) API spec (Bunk) + IaC spec (Daniels) → (3) UX/compliance spec (Kima/Pearlman). Spec issues lock to active decisions (Decisions 1–12) to prevent spec drift. GitHub Projects v2 board enables tracking per track. Pattern: epic contains 3-4 child specs; each spec includes target file path, locked decisions, acceptance criteria.
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
