# Daniels — History

## Project Context

- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker
- **Owner:** Israel (Izzy)
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC
- **Structure:** Monorepo — apps/api, apps/web, apps/admin, packages/shared, data (Prisma)
- **Infra:** Terraform (layered: foundation, platform, application), GitHub Actions CI/CD
- **Domain:** Workforce readiness and qualification management for regulated industries

## Current Architecture

- **Backend:** Express monolith with 9 modules (auth, employees, medical, notifications, qualifications, standards, documents, hours, labels) + templates module being added
- **Frontend:** React + Vite SPA with role-based route gating
- **Shared:** packages/shared for TypeScript types
- **Database:** PostgreSQL via Prisma ORM, single schema
- **API Pattern:** Router → Validator (Zod) → Service → Prisma → DB
- **Auth:** JWT + bcrypt, 4-tier RBAC (EMPLOYEE, SUPERVISOR, MANAGER, ADMIN)

## Key Architectural Notes

- Monorepo uses npm workspaces
- All modules currently co-deployed as a single Express server
- No feature flag system yet
- No service mesh or inter-service communication
- CI/CD via GitHub Actions (single pipeline)
- Infra layered into foundation/platform/application Terraform
- Route taxonomy: /me/* (self-service), /team/:id/* (supervisor), /standards/*, /reviews/*

## Learnings

- Parallel-delivery architecture for E-CLAT should be framed as a **modular monolith evolving into service groups**, not as an immediate microservice rewrite.
- Recommended backend service groups: **Identity Platform (`auth`)**, **Workforce Core (`employees`)**, **Compliance Service (`qualifications`, `medical`, `templates`)**, **Records Service (`documents`, `hours`)**, **Reference Data (`standards`, `labels`)**, **Notification Service (`notifications`)**.
- The best first acceleration step is **pipeline separation before runtime separation**: split CI/CD by subsystem and keep `00-foundation` + `10-data` shared while compute grows into per-service modules.
- Feature flags should start as a **repo-backed shared schema plus environment overrides** with a client-safe bootstrap endpoint, not an external flag service.
- Frontend route taxonomy already trends in the right direction (`/me/*`, `/team/*`, `/standards/*`, `/reviews/*`), but navigation is still constrained by the hard-coded menu in `apps/web/src/components/Layout.tsx`.
- Key architecture files for this domain review: `apps/api/src/index.ts`, `apps/api/src/modules/*`, `apps/web/src/App.tsx`, `apps/web/src/components/Layout.tsx`, `data/prisma/schema.prisma`, `infra/layers/*`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- Current workflow/IaC mismatch to remember: `deploy.yml` reads `api_app_name`, while `infra/layers/20-compute/outputs.tf` publishes `api_container_app_name`.
- Izzy values **logical subsystem ownership, rollout safety, and faster independent deployments** over a rewrite narrative.
- GitHub rulesets and classic branch protection are both blocked for the private `ivegamsft/work-tracker` repo until the repository is upgraded or made public; current `gh api` calls return 403 plan restrictions.
- `.github/copilot-instructions.md` is the primary memory file for `@copilot` and now carries the authoritative repo context for modules, compliance guardrails, docs pipeline, and infrastructure expectations.
- Preferred `@copilot` branch naming is `copilot/{issue-number}-{slug}`, but GitHub does not yet expose a dedicated repository setting to force that pattern.
- Key architecture and governance files for this update: `.github/copilot-instructions.md`, `.github/agents/squad.agent.md`, `docs/README.md`, `apps/api/src/modules/templates/`, `data/prisma/schema.prisma`, `.github/workflows/ci.yml`.
- **Issue #26 Terraform module stubs (SA-05)**: Created 6 service group compute module stubs (`compute-identity`, `compute-workforce`, `compute-compliance`, `compute-records`, `compute-reference`, `compute-notifications`) under `infra/modules/`. Each module currently references the shared Container App via data source but is structured for future independent extraction with commented resource blocks. The `20-compute` layer now instantiates all 6 modules and exposes service-specific outputs (`identity_service`, `workforce_service`, etc.) containing `service_name`, `health_endpoint`, and `deploy_target`. This establishes the Terraform boundary for future parallel deployment without requiring refactoring downstream consumers. The extraction path is documented in `infra/modules/README.md` with recommended migration order: reference-data → notifications → identity → records → compliance → workforce.
