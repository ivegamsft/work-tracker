# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **MVP product scope is locked (2026-03-14):** 8 open questions from the implementation plan were answered with sensible defaults (Q1: Qualifications+Medical no Hours; Q2: Manual entry no OCR; Q3: documents deferred to Phase 2 as upload+review; Q4: department stays opaque string; Q5: overallStatus is 3-state deterministic rule with 30-day warning; Q6: requiredTests informational only; Q7: single-org no tenancy; Q8: in-app notifications only). All decisions minimize Phase 0/1 scope, avoid architectural debt, and are reversible in Phase 2+. Decisions written to `.squad/decisions/inbox/freamon-mvp-defaults.md` for team ratification.
- The backend is a contract-first skeleton: routers and Zod validators are broadly complete across 9 modules, but service methods still return `NOT_IMPLEMENTED`, so the schema and route layer are the real source of truth for current-state PRD work.
- `data/prisma/schema.prisma` is the architectural center of gravity; it already models compliance evidence, audit logs, taxonomy versioning, notifications, and workforce readiness relationships even though the API does not use Prisma yet.
- Cross-cutting gaps that must be handled consistently across modules: real JWT verification in `apps/api/src/middleware/auth.ts`, ownership-aware RBAC on read endpoints, and mandatory audit-log persistence for every regulated mutation.
- Important path-specific findings: labels are mounted from `apps/api/src/index.ts` at `/api` instead of `/api/labels`, and `apps/api/src/modules/documents/router.ts` declares `GET /:id` before `GET /review-queue`, which should be corrected before implementation proceeds.
- Frontend scope should stay split by operating mode: `apps/web` for employee/manager workflows and `apps/admin` for standards, taxonomy, roles, integrations, escalation rules, and audit exploration.
- PRD structure chosen for this repo: a master platform PRD plus domain PRDs under `docs/prds/`, because nine modules and two app scaffolds are too broad for a single actionable document.
- Repository-facing planning artifacts now live under `docs/` (`docs/prds/` for execution docs and `docs/adrs/` for architecture records) while executable bootstrap utilities live under `scripts/`; reserving `.squad/` for team infrastructure removes the old name collision and makes the repo layout self-explanatory.
- The practical default MVP path for this codebase is: Phase 0 foundation (auth, Prisma, audit, test harness, infra minimum), then Employees + Standards + Qualifications + Medical as the first secure compliance loop, then Documents-lite + Notifications-lite; Hours, Labels lifecycle, and full OCR automation should be deferred until the core loop is proven.
- Shared role/status vocabulary needs an explicit mapping layer because Prisma enums are uppercase (`Role`, `QualificationStatus`, etc.) while `packages/shared/src/types/roles.ts` and `packages/shared/src/types/domain.ts` use lowercase string values expected by the API and UI.
- `data/package.json` already contains Prisma and `@prisma/client`, and `data/src/seed.ts` exists as the handoff point for default admin, standards, taxonomy, and escalation seed data, but the API currently has no Prisma client wiring at all.
- `apps/web` and `apps/admin` are still framework-free placeholders with echo-only scripts, so frontend work should start only after auth and core API contracts stabilize.
- In a fresh checkout, `npm test` fails before product assertions run because workspace dependencies are not installed (`jest` is unavailable); reproducible bootstrap and CI setup need to be treated as day-zero work, not cleanup.
- `bootstrap\` is strictly the pre-Terraform bootstrap path: it creates backend state storage plus deployment identity/OIDC, so runtime infrastructure should start at a separate `00-foundation` Terraform layer instead of trying to self-bootstrap those concerns.
- Infrastructure naturally splits into three runtime layers: `00-foundation` (environment resource group + Key Vault), `10-data` (PostgreSQL + application storage), and `20-compute` (API hosting first, then web/admin hosting later); Bunk implemented this with per-environment state keys and cross-layer contracts. Any future APIM or edge resources should sit downstream as a later integration layer.
- Backend naming needs one source of truth during the restructure: `bootstrap\variables.sh` generates storage accounts as `eclattfstate{env}`, while `bootstrap\README.md` still shows older example names.
- The runtime secret chain is now explicit: `00-foundation` owns the shared Key Vault, `10-data` writes the PostgreSQL connection string secret, and `20-compute` writes the JWT secret plus projects both into App Service through Key Vault references; OAuth, AWS, and SMTP secrets remain manual gaps.
- The current infra contract has five exported-but-unconsumed layer outputs (`resource_group_id`, `postgres_fqdn`, `postgres_database_name`, `api_default_hostname`, `api_principal_id`) and one bootstrap/backend mismatch (`terraform.tfstate` still printed even though the real split keys are `foundation.tfstate`, `data.tfstate`, and `compute.tfstate`).
- Layer outputs are the cross-layer Terraform contract; they should export only what downstream layers, workflows, or external systems actually consume. Speculative future outputs and module implementation details (like the API's internal principal ID) belong in the module, not the layer root. All five dead outputs were pruned on 2026-03-14.
- The container-first target architecture is Azure Container Apps for hosting, ACR in `00-foundation`, and a Log Analytics-backed ACA Environment in `20-compute`. Keep `PORT` as the runtime listener contract, replace App Service Key Vault references with application-level Key Vault reads via `DefaultAzureCredential`, and split image build/push from Terraform infra deployment so day-to-day development stays local-first while Azure remains RBAC-driven and Private Link-capable.

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
