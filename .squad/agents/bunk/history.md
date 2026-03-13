# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Bootstrap Scripts for Azure Infrastructure (2026-03-13)

Created `bootstrap/` at repo root with Azure CLI scripts for one-time infrastructure setup:

- **`variables.sh`** — Shared config (project: eclat, region: eastus2, envs: dev/staging/prod)
- **`01-tf-state-storage.sh`** — Creates storage accounts + containers for Terraform remote state per environment
- **`02-entra-spns.sh`** — Creates Entra app registrations + service principals with Contributor role
- **`03-gh-oidc.sh`** — Sets up federated identity credentials for GitHub OIDC (passwordless auth)
- **`README.md`** — Prerequisites, order of operations, post-bootstrap steps

**Key patterns:**
- Idempotent check-before-create (safe to re-run)
- Naming: `eclat-{env}-deploy` for SPNs, `eclatstate{env}` for storage accounts
- OIDC subjects: main branch (`repo:owner/repo:ref:refs/heads/main`) + environment-specific
- Auto-sets GitHub secrets if `gh` CLI is available
- Bash scripts with `set -euo pipefail` for safety

**Files:** `bootstrap/{variables.sh, 01-tf-state-storage.sh, 02-entra-spns.sh, 03-gh-oidc.sh, README.md}`

## Important Status: PRDs Available

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `docs/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your domain work.

## Important: MVP Planning Complete (2026-03-13T23:25:00Z)

📌 **MVP Planning Session Complete.** See `.squad/orchestration-log/2026-03-13T2325-{freamon,sydnor}.md` and `.squad/decisions.md` for full context.

### Your Phase 0 Assignment: API Foundation + Test Infrastructure

**Your responsibilities (Bunk - Backend Lead):**
1. **Fix critical bugs (Phase 0):**
   - Labels mount-path bug: Router mounted at `/api` instead of `/api/labels`
   - Document route-ordering issues
   - Resolve `departmentId` FK/semantics
   - Clarify `requiredTests` handling (deferred vs required)

2. **Implement Prisma integration (Phase 1):**
   - Repository pattern for core models
   - Real JWT verification in auth middleware
   - Audit logging enforcement (AuditLog persistence)
   - RBAC service-layer implementation (ownership-aware reads/writes)
   - Shared type mapping (lowercase strings ↔ uppercase enums)

3. **Support test infrastructure:**
   - Coordinate with Sydnor on test DB setup
   - Implement mock Prisma client support
   - Build service layer to be testable

**MVP Scope (what you're building):**
- **Phase 1:** Auth service (JWT login, token refresh), Prisma integration
- **Phase 2:** Employees, Standards, Qualifications, Medical services
- **Phase 3:** Documents-lite, Notifications-lite services
- **Deferred:** Full Hours workflows, Labels publishing, OCR/classification

**Blocking dependency:** Test infrastructure (test DB, factories, auth mocking) must be in place before Phase 1 accelerates. Sydnor is working on this in Phase 0.

See `.squad/decisions.md` for full MVP sequencing and test infrastructure requirements.
