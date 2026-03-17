# Architecture Decision Records

## ADR-001: Monorepo with npm workspaces
- **Decision:** Structure as monorepo with `apps/`, `data/`, `infra/`, `packages/`
- **Rationale:** Shared types across API/web/admin, single CI pipeline, atomic cross-package changes
- **Status:** Accepted

## ADR-002: Prisma for data access
- **Decision:** Use Prisma ORM for PostgreSQL
- **Rationale:** Type-safe queries, auto-generated migrations, schema-as-code aligns with IaC philosophy
- **Status:** Accepted

## ADR-003: Terraform for IaC
- **Decision:** Use Terraform for infrastructure provisioning
- **Rationale:** Multi-cloud flexibility, large ecosystem, state management
- **Status:** Accepted

## ADR-004: Express for API
- **Decision:** Express.js with TypeScript strict mode
- **Rationale:** Mature ecosystem, simple middleware model, wide library support for auth/CORS/etc.
- **Status:** Accepted
