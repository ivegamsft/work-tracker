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

## Learnings

<!-- Append new learnings below. -->
