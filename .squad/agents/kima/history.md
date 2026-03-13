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

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `docs/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your backend domain work.

## Important: MVP Planning Complete (2026-03-13T23:25:00Z)

📌 **MVP Planning Session Complete.** See `.squad/orchestration-log/2026-03-13T2325-{freamon,sydnor}.md` and `.squad/decisions.md` for full context.

### Your Phase 0 Assignment: Frontend + Test Integration

**Your responsibilities (Kima - Frontend Lead):**
1. **Block on test utilities (Phase 0):**
   - **DO NOT** start API endpoint implementation until test infrastructure is in place
   - Coordinate with Sydnor on auth mocking, request helpers, and test database
   - Frontend integration tests can start once API test harness is stable (Phase 1 end)

2. **Admin app scaffolds (Phase 1-3):**
   - Phase 1: Auth UI (login, token refresh)
   - Phase 2: Employee management, standards library, qualification tracking
   - Phase 3: Medical clearance workflows, notification preferences
   - Deferred: Hours workflows, document OCR, labels publishing

3. **Integration readiness:**
   - Work from `docs/prds/frontend-admin-prd.md`
   - Coordinate with Bunk on API contract stability before heavy UI work
   - Test infrastructure (auth mocking, API clients) will be provided by Sydnor

**MVP Scope (what you're building):**
- **Phase 1:** Admin login, basic app shell
- **Phase 2:** Core domain UIs (Employees, Qualifications, Standards)
- **Phase 3:** Medical clearances, notifications settings

**Critical blocker:** Test database + request utilities must be ready before API work accelerates. Sydnor has Phase 0 responsibility here.

**Team coordination:**
- Bunk is building API services; work from his contracts
- Sydnor is building test infrastructure; unblock his work first
- Freamon is sequencing phases; check `.squad/decisions.md` for phase transitions

See `.squad/decisions.md` for full MVP sequencing and test infrastructure requirements.
