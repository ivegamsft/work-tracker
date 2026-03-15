# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **Created:** 2026-03-13

## Core Context

Team roster: Freamon (Lead), Bunk (Backend), Kima (Frontend), Sydnor (Tester), Scribe, Ralph.

## Recent Updates

📌 Team hired on 2026-03-13 — cast from The Wire universe.

📌 **Phase 0 Container Pivot (2026-03-14T20:05:00Z)**
- Freamon delivered MVP scope defaults (8 decisions): core loop is Qualifications + Medical; Documents/Hours/OCR deferred
- Freamon delivered Container Apps architecture: pivot from App Service; ACR + Log Analytics in foundation; runtime secrets via Key Vault
- Bunk delivered Phase 0 blocking work: labels routing namespace fix, JWT tokens module, mock user store, updated tests
- Sydnor delivered Vitest harness: 10 passing tests (health, auth middleware, auth service, routing) unblocking Phase 1 domain work
- Coordinator captured container-first hosting directive from user
- **Phase 0 complete:** Test infrastructure operational, auth layer in place, routing corrected, container architecture decided
- **Phase 1 ready:** Opens for Kima/Bunk core domain service implementation

📌 **Phase 2 Auth & Frontend Kickoff (2026-03-15T23:34:38Z)**
- Freamon designed comprehensive Entra ID auth architecture: 10-section document, `05-identity` Terraform layer, 4 app registrations, 5 app roles, mock/Entra toggle, MSAL.js frontend, managed identity DB access
- Kima fixed frontend auth context (token field mismatch) and completed React+Vite scaffold (protected routes, plain CSS, centralized API client, 4 pages, Docker Compose ready, 25 tests)
- Bunk completed monorepo CI/CD: Postgres service containers, Prisma generation in CI/Docker, full build validation
- Sydnor validated 140 tests passing (46 Phase 2 + 94 Phase 1)
- **Decision Inbox merged:** 5 major decisions (Entra auth, user directives × 2, frontend scaffold, CI/CD pipeline) merged to `decisions.md`; older decisions (2026-03-13 and 2026-03-14) archived to `decisions-archive.md`
- **Orchestration logs created:** Freamon and Kima spawns documented with deliverables and implications
- **Cross-team context propagated:** Team updates appended to all agent history.md files

## Learnings

<!-- Append new learnings below. -->
