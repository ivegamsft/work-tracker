# e-clat

**Employee Compliance and Lifecycle Activity Tracker**

A workforce readiness and qualification management platform for regulated industries.

## Monorepo Structure

```
├── apps/
│   ├── api/             Express REST API (64 endpoints)
│   ├── web/             Frontend app (TBD)
│   └── admin/           Management app (TBD)
├── data/                Prisma schema, migrations, seeds (PostgreSQL)
├── docs/
│   ├── adrs/            Architecture decision records
│   └── prds/            Product requirement documents
├── infra/               Terraform IaC (compute, database, storage)
├── packages/
│   └── shared/          Shared types, errors, constants
├── scripts/             Dev setup and repository utilities
└── .github/workflows/   CI/CD pipelines
```

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Or bootstrap with the repo script
bash scripts/setup.sh

# Copy environment config
cp apps/api/.env.example apps/api/.env

# Run API in development
npm run dev

# Run tests
npm test

# Typecheck all packages
npm run typecheck
```

## Workspaces

| Package | Path | Description |
|---------|------|-------------|
| `@e-clat/api` | `apps/api/` | REST API — auth, employees, hours, documents, qualifications, medical, standards, notifications, labels |
| `@e-clat/web` | `apps/web/` | Frontend (scaffold) |
| `@e-clat/admin` | `apps/admin/` | Admin management (scaffold) |
| `@e-clat/shared` | `packages/shared/` | Shared domain types and error classes |
| `@e-clat/data` | `data/` | Prisma schema and database tooling |

## Tech Stack

- **API:** Node.js, TypeScript, Express, Zod
- **Database:** PostgreSQL + Prisma
- **Auth:** JWT + bcrypt, RBAC (5 roles)
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
