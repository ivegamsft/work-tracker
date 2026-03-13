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
- PRD structure chosen for this repo: a master platform PRD plus domain PRDs under `squad/prds/`, because nine modules and two app scaffolds are too broad for a single actionable document.
