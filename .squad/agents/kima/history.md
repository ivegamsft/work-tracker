# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

## Important Status: PRDs Available

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `squad/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your backend domain work.
