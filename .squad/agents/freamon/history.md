# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
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
