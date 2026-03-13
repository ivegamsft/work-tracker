# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

- **Jest is correctly configured for monorepo testing** (ts-jest, path aliases, Node environment). Tests can start immediately once test utilities are built.
- **Test database is the critical blocker** — no test database strategy or Prisma test setup exists. Must choose SQLite (in-memory for dev) vs PostgreSQL (container for CI) before fixtures can be written.
- **Auth middleware is a stub** — `authenticate()` doesn't verify JWT. Completing JWT verification is prerequisite for RBAC testing (≥192 test cases across 64 endpoints).
- **No test utilities at all** — no factories, no request helpers, no assertion matchers. This must be built incrementally as the first test infrastructure work (before MVP endpoint tests).
- **Error handling is solid** — custom error classes (`AppError`, `UnauthorizedError`, `ForbiddenError`) exist and are properly structured for testing. Middleware error handler is straightforward to test.
- **Prisma schema is rich and testable** — 16 models with clear enums and relationships. Factories can leverage this (e.g., `QualificationStatus.EXPIRED` is explicit). SQLite factories will be simpler than mocking.
- **RBAC boundaries are critical** — 5-role hierarchy is strict and must be tested exhaustively. Every endpoint needs 3 test variations (unauthenticated, wrong role, correct role).

## Important Status: PRDs Available

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `docs/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your QA and test strategy.
