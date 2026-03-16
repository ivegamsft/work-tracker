# Pipeline Architecture Spec — E-CLAT

> **Status:** Proposed CI/CD Target State  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Applies To:** `.github/workflows`, `infra`, `apps/api`, `apps/web`, `apps/admin`, `packages/shared`, `data/prisma`  
> **Companion Docs:** `docs/specs/service-architecture-spec.md`, `docs/req/parallel-deployment-requirements.md`, `docs/guides/infra-wiring-map.md`

## 1. Goal

Enable separate developers to build, test, and deploy logical subsystems in parallel while preserving the existing Terraform layer model and monorepo advantages.

## 2. Current-State Audit

### 2.1 Existing CI
`ci.yml` currently runs:
1. `typecheck`
2. `test-api`
3. `test-web`
4. `build`
5. `docker`

What is good:
- uses workspaces,
- already separates API and web tests,
- builds shared package first.

What blocks speed:
- no change detection by subsystem,
- shared package changes force whole-repo validation,
- build and docker are still whole-platform jobs,
- no admin-specific pipeline,
- no contract-test lane by bounded context.

### 2.2 Existing deploy flow
`deploy.yml` is manual and sequential:
- `foundation`
- `data`
- `compute`
- `deploy-api`

Blocking gaps:
- no subsystem selection input,
- no path-aware deployment logic,
- no environment promotion chain,
- only one compute target exists.

## 3. Pipeline Design Principles

1. **Detect before building.** First job decides what changed.
2. **Build by subsystem.** Only affected service groups run expensive work.
3. **Keep shared checks reusable.** Type generation, shared builds, lint, and contract tests become reusable workflow blocks.
4. **Promote immutable artifacts.** Rebuild once, promote many.
5. **Keep infra layering intact.** `00-foundation` and `10-data` remain ordered; compute becomes subdivided.

## 4. Proposed Subsystem Map

| Subsystem key | Source paths |
|---|---|
| `identity-platform` | `apps/api/src/modules/auth/**`, `apps/api/src/middleware/**`, platform flag/bootstrap code |
| `workforce-core` | `apps/api/src/modules/employees/**` |
| `compliance-service` | `apps/api/src/modules/qualifications/**`, `apps/api/src/modules/medical/**`, `apps/api/src/modules/templates/**` |
| `records-service` | `apps/api/src/modules/documents/**`, `apps/api/src/modules/hours/**` |
| `reference-data` | `apps/api/src/modules/standards/**`, `apps/api/src/modules/labels/**` |
| `notifications-service` | `apps/api/src/modules/notifications/**` |
| `web-shell` | `apps/web/**` |
| `admin-shell` | `apps/admin/**` |
| `shared-contracts` | `packages/shared/**`, `data/prisma/schema.prisma`, root TypeScript/Vitest config |
| `infra-foundation` | `infra/layers/00-foundation/**`, `infra/modules/foundation/**` |
| `infra-data` | `infra/layers/10-data/**`, `infra/modules/database/**`, `infra/modules/storage/**` |
| `infra-compute` | `infra/layers/20-compute/**`, future compute modules, `.github/workflows/deploy*.yml` |

## 5. Target CI Topology

### 5.1 Orchestrator workflow
Create one thin orchestrator workflow that:
1. checks out code,
2. runs path detection,
3. publishes outputs like `changed_workforce=true`.

Use a path-detection action or script; the implementation tool is less important than the contract.

### 5.2 Parallel validation lanes

```text
change-detect
├─ shared-quality
├─ workforce-core
├─ compliance-service
├─ records-service
├─ reference-data
├─ notifications-service
├─ web-shell
└─ admin-shell
```

### 5.3 Each lane should run
- build shared contracts when needed,
- targeted lint/typecheck,
- targeted tests,
- subsystem build artifact,
- optional container build for deployable services.

### 5.4 Shared reusable workflows
Recommended reusable workflow set:
- `_shared-node-setup.yml`
- `_quality-checks.yml`
- `_build-service-image.yml`
- `_terraform-plan-apply.yml`
- `_deploy-container-app.yml`

## 6. Monorepo Change Detection Rules

### 6.1 Baseline dependency rules
- `packages/shared/**` triggers every API/web/admin lane.
- `data/prisma/schema.prisma` triggers every API service lane and any contract tests depending on generated types.
- workflow changes trigger affected workflow validation.

### 6.2 Example path filter intent

| Change | Pipelines that must run |
|---|---|
| `apps/api/src/modules/hours/**` | `records-service`, `shared-quality` |
| `apps/api/src/modules/templates/**` | `compliance-service`, `shared-quality` |
| `apps/web/src/pages/**` | `web-shell`, optionally contract smoke tests |
| `packages/shared/**` | all service groups + web/admin |
| `infra/modules/compute/**` | infra compute plan + affected deploy smoke checks |

## 7. Target Deploy Topology

### 7.1 Infrastructure layers
Keep:
- `00-foundation`
- `10-data`

Refactor compute into logical modules or roots:
- `compute-identity`
- `compute-workforce`
- `compute-compliance`
- `compute-records`
- `compute-reference`
- `compute-notifications`
- later `compute-web`, `compute-admin` if hosted separately

### 7.2 Deploy jobs

```text
infra-foundation -> infra-data -> compute-* -> deploy-*
```

After `infra-data`, compute jobs may run in parallel where independent.

Example:

```text
foundation
  -> data
      -> compute-workforce
      -> compute-compliance
      -> compute-records
      -> compute-reference
      -> compute-notifications
```

### 7.3 Deployable units

| Unit | Artifact | Deploy target |
|---|---|---|
| Workforce Core | container image | ACA workforce app |
| Compliance Service | container image | ACA compliance app |
| Records Service | container image | ACA records app + worker later |
| Reference Data | container image | ACA reference app |
| Notification Service | container image | ACA notification app/worker |
| Web shell | static artifact or container | web target |
| Admin shell | static artifact or container | admin target |

## 8. Promotion Model

### 8.1 Dev
- auto-deploy changed subsystems after merge to `main`.
- no full-platform redeploy requirement.

### 8.2 Staging
- promote the same built artifact from dev.
- require green contract tests and environment smoke tests.

### 8.3 Prod
- manual approval per subsystem using GitHub environment protections.
- allow prod promotion of one subsystem without redeploying others.

## 9. Required Checks Per Subsystem

| Check type | Purpose |
|---|---|
| Contract tests | verify public schemas and API compatibility |
| Module tests | verify service-group behavior |
| Smoke deploy test | verify health endpoint and startup |
| Path filter test | verify only intended lanes trigger |
| Infra plan review | verify correct Terraform layer or module changed |

## 10. Workflow Files to Add or Refactor

Recommended workflow set:
- `ci.yml` -> orchestrator only
- `ci-subsystems.yml` -> reusable or matrix runner
- `deploy-dev.yml`
- `promote-staging.yml`
- `promote-prod.yml`
- `infra-plan.yml`

If the team prefers fewer files, keep one deploy workflow but require:
- `subsystems` input,
- `layers` input,
- reusable compute/deploy steps.

## 11. Terraform / Workflow Alignment Rules
- Workflow outputs must exactly match Terraform output names.
- Compute module names, image names, and workflow job names must share the same subsystem key.
- Every compute module must expose a deploy target name and URL output.
- Shared foundation/data changes must not force application artifact rebuilds unless runtime contract changes.

## 12. Backlog Additions

| ID | Priority | Item |
|---|---|---|
| PA-01 | P0 | Fix current deploy output mismatch (`api_container_app_name`). |
| PA-02 | P0 | Add change-detection job and subsystem outputs to CI. |
| PA-03 | P0 | Add admin-shell pipeline or explicitly mark it dormant until app exists. |
| PA-04 | P1 | Split compute into service-group modules or roots while keeping shared foundation/data. |
| PA-05 | P1 | Add immutable artifact promotion from dev to staging to prod. |
| PA-06 | P1 | Add targeted smoke deploy checks per service group. |
| PA-07 | P2 | Add preview environments per subsystem for high-change areas like records and compliance. |

## 13. Acceptance Criteria
- A change in one subsystem does not trigger unrelated builds by default.
- A change in one deployable service can move to dev/staging/prod without redeploying the entire platform.
- Terraform layer ownership remains clear even after compute splits.
- Workflow names, artifact names, and Terraform outputs are aligned.
- Promotion gates work per subsystem, not only per repository.