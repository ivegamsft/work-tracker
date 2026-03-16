# Parallel Deployment Requirements — E-CLAT

> **Status:** Proposed Requirements  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Scope:** CI/CD, Terraform, service boundaries, deploy targets, team workflow

## 1. Objective

The platform shall support parallel subsystem development and deployment so multiple developers can ship isolated changes without blocking on full-platform builds or deployments.

## 2. Functional Requirements

### PD-REQ-01 — Logical subsystem ownership
The repository **MUST** define deployable subsystem keys for:
- identity-platform
- workforce-core
- compliance-service
- records-service
- reference-data
- notifications-service
- web-shell
- admin-shell

### PD-REQ-02 — Path-based change detection
CI workflows **MUST** detect changed paths and map them to one or more subsystem keys before build jobs start.

### PD-REQ-03 — Targeted quality checks
Each subsystem pipeline **MUST** run only the lint, typecheck, contract tests, and module tests required by that subsystem, except when shared contracts or schema changes fan out to dependents.

### PD-REQ-04 — Shared dependency fan-out
Changes under `packages/shared/**` or `data/prisma/schema.prisma` **MUST** trigger all dependent API subsystems and any affected frontend shells.

### PD-REQ-05 — Independent deploy targets
Each backend subsystem intended for extraction **MUST** have a named deploy target and matching Terraform module or layer plan, even if multiple subsystems are temporarily co-hosted.

### PD-REQ-06 — Infrastructure layering
Terraform **MUST** preserve shared platform layering:
- `00-foundation`
- `10-data`
- compute modules or roots per subsystem

### PD-REQ-07 — Output alignment
Workflow variable names, artifact names, and Terraform outputs **MUST** use the same subsystem key and resource naming convention.

### PD-REQ-08 — Immutable promotion
The deployment model **MUST** promote the same artifact from dev to staging to prod; higher environments must not rebuild from source.

### PD-REQ-09 — Per-subsystem approvals
Production promotion **MUST** support approval per subsystem instead of requiring whole-platform promotion.

### PD-REQ-10 — Health verification
Every deployable subsystem **MUST** expose health endpoints and run post-deploy smoke checks before promotion completes.

### PD-REQ-11 — Contract-first extraction
Before a subsystem can move to its own runtime, its public API contracts and dependency contracts **MUST** exist in `packages/shared`.

### PD-REQ-12 — Query isolation
Cross-domain aggregation **MUST NOT** live inside CRUD service implementations once subsystem extraction begins. It must move to named query/facade layers.

## 3. Non-Functional Requirements

### PD-NFR-01 — Fast feedback
A subsystem-only change **SHOULD** complete CI faster than a full-repo build.

### PD-NFR-02 — Safe isolation
Deploying one subsystem **MUST NOT** require redeploying unrelated services unless shared contracts or shared infra changed.

### PD-NFR-03 — Traceability
Each deployment **MUST** record subsystem key, artifact version, environment, and approval trail.

### PD-NFR-04 — Backward compatibility
Migration from one runtime to many runtimes **SHOULD** preserve existing client routes until `/api/v1` contracts are adopted.

### PD-NFR-05 — Operational simplicity
The first increment **SHOULD** prefer modular-monolith pipeline separation before forcing service extraction.

## 4. Acceptance Tests
- A change in `apps/api/src/modules/hours/**` triggers `records-service` only, plus required shared lanes.
- A change in `apps/api/src/modules/standards/**` triggers `reference-data` only, plus required shared lanes.
- A compute deployment for one subsystem updates only that target in dev.
- Staging and prod promotion consume the same artifact identifier built in dev.
- Workflow and Terraform output names match without manual mapping errors.

## 5. Backlog Additions

| ID | Priority | Requirement-derived work |
|---|---|---|
| PD-BL-01 | P0 | Add change-detection outputs to CI and subsystem routing rules. |
| PD-BL-02 | P0 | Fix current `deploy.yml` / Terraform output mismatch. |
| PD-BL-03 | P0 | Define deploy target names and module names for each backend subsystem. |
| PD-BL-04 | P1 | Add immutable artifact promotion flow for staging and prod. |
| PD-BL-05 | P1 | Add smoke deploy checks for every subsystem. |
| PD-BL-06 | P2 | Add preview environments for records and compliance. |

## 6. Done Definition
A subsystem is parallel-deployment ready when:
- it has a contract file,
- it has a path filter,
- it has targeted tests,
- it has a deploy target name,
- it can be promoted independently,
- it has smoke-check coverage.