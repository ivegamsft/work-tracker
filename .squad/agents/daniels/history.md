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

(New agent — no learnings yet)
