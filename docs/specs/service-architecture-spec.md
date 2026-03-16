# Service Architecture Spec — E-CLAT

> **Status:** Proposed Architecture Baseline  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Applies To:** `apps/api`, `apps/web`, `packages/shared`, `data/prisma`, `infra`, `.github/workflows`  
> **Companion Docs:** `docs/specs/app-spec.md`, `docs/specs/feature-flags-spec.md`, `docs/specs/pipeline-architecture-spec.md`, `docs/ideas/ui-menu-architecture.md`, `docs/implementation-status.md`

## 1. Purpose

Define the bounded contexts, deployment groupings, contract boundaries, and migration path required to turn the current modular monolith into a faster-moving subsystem-oriented platform without a rewrite.

## 2. Current-State Audit Summary

### 2.1 API runtime
- `apps/api/src/index.ts` mounts every domain into one Express process and one Prisma client.
- Current modules: `auth`, `employees`, `documents`, `hours`, `labels`, `medical`, `notifications`, `qualifications`, `standards`, `templates`.
- Most modules follow `router.ts -> validators.ts -> service.ts`, but services still call Prisma directly; there is no repository layer yet.
- Shared cross-domain coupling is concentrated around `Employee`, `Document`, `ComplianceStandard`, `StandardRequirement`, and `AuditLog`.

### 2.2 Frontend runtime
- `apps/web/src/App.tsx` already groups routes into `/me/*`, `/team/*`, `/standards/*`, `/reviews/*`, but `apps/web/src/components/Layout.tsx` still uses a hard-coded flat menu.
- Several pages are present as route-level shells before the corresponding APIs are production-ready.

### 2.3 Data ownership pressure points
- `Employee` is referenced by nearly every module.
- `Document` is a shared asset for review, qualification evidence, and proof fulfillment.
- `ComplianceStandard` and `StandardRequirement` act as shared reference data for qualifications and templates.
- `Notification` digest logic currently reads across qualifications, documents, and template fulfillments.

### 2.4 Infrastructure and workflow reality
- Terraform is layered as `00-foundation -> 10-data -> 20-compute`.
- Current compute deploys a single API Container App.
- CI is workspace-aware but not subsystem-aware.
- Deploy is sequential and manual; no path-based promotion model exists.
- Workflow/IaC mismatch exists today: `.github/workflows/deploy.yml` captures `terraform output -raw api_app_name`, while `infra/layers/20-compute/outputs.tf` exposes `api_container_app_name`.

## 3. Architectural Principles

1. **Modular monolith first, service extraction second.** Do not rewrite stable code to chase microservices.
2. **Interface-first always.** Service contracts live in shared packages before implementation or extraction.
3. **Data ownership is singular.** Each aggregate has one owner, even while the database remains shared.
4. **No cross-domain joins in domain services.** Cross-domain dashboards move to query/facade layers.
5. **Pipelines mirror bounded contexts.** Teams ship by subsystem, not by whole-repo rebuilds.
6. **Feature flags gate incomplete or risky experiences.** UI and API must share the same flag vocabulary.

## 4. Domain Ownership Model

| Aggregate / Model | Owning Service Group | Current Prisma Models | Allowed Consumers |
|---|---|---|---|
| Identity + access | Identity Platform | auth token flow today; future credential/session tables | all services via verified identity context |
| Workforce core | Workforce Core | `Employee` | compliance, records, notifications, UI query layers |
| Compliance evidence | Compliance Service | `Qualification`, `MedicalClearance`, `ProofTemplate`, `ProofRequirement`, `TemplateAssignment`, `ProofFulfillment` | workforce queries, notifications, UI |
| Operational records | Records Service | `Document`, `DocumentProcessing`, `ExtractionResult`, `ReviewQueueItem`, `HourRecord`, `HourConflict`, `HourConflictRecord` | compliance, notifications, UI |
| Reference data | Reference Data Service | `ComplianceStandard`, `StandardRequirement`, `Label`, `LabelMapping`, `TaxonomyVersion` | workforce, compliance, records, notifications |
| Notifications + orchestration | Notification Service | `Notification`, `NotificationPreference`, `EscalationRule` | all user-facing apps |
| Audit / observability | Platform shared concern | `AuditLog` | every service writes; reporting reads through platform contract |

### 4.1 Ownership rules
- `Employee` writes belong to Workforce Core only.
- `Document` lifecycle belongs to Records Service only; other services may store document IDs, not mutate document state.
- `ComplianceStandard` and `Label` remain reference-data owned, even if other services cache copies.
- `Notification` creation is centralized; other services publish events/commands instead of writing notification rows directly once extraction begins.

## 5. Proposed Logical Service Groupings

### 5.1 Recommended grouping set

| Group | Modules | Why they belong together | Deploy target | Terraform target | Pipeline key |
|---|---|---|---|---|---|
| **Identity Platform** | `auth` | shared auth, token issuance, RBAC context, feature-flag bootstrap | `aca-identity-api` later; shared API runtime initially | `compute-identity` later; shared `20-compute` initially | `identity-platform` |
| **Workforce Core** | `employees` | employee directory, scope, team relationships, profile ownership | `aca-workforce-api` | `compute-workforce` | `workforce-core` |
| **Compliance Service** | `qualifications`, `medical`, `templates` | one evidence-and-attestation lifecycle; shared status rules and review workflows | `aca-compliance-api` | `compute-compliance` | `compliance-service` |
| **Records Service** | `documents`, `hours` | evidence ingestion, review queues, clock/import ledgers, storage/processing concerns | `aca-records-api` + future worker | `compute-records` | `records-service` |
| **Reference Data Service** | `standards`, `labels` | admin-curated taxonomies and requirement catalogs used read-only elsewhere | `aca-reference-api` | `compute-reference` | `reference-data` |
| **Notification Service** | `notifications` | cross-cutting delivery, digest generation, escalation rules, future async consumers | `aca-notifications-api` or worker/api pair | `compute-notifications` | `notifications-service` |

### 5.2 Co-location guidance

#### Must remain co-located for now
- `qualifications` + `medical` + `templates`
  - They all contribute to the same proof/readiness story.
  - They share status and review semantics.
  - Splitting them before event contracts exist would increase coupling.
- `documents` + `hours`
  - Both need ingestion pipelines, manual review/override logic, and worker-style processing.
  - They benefit from shared operational storage and reconciliation tooling.

#### Can become independently deployable earlier
- `standards` + `labels` as reference data.
- `notifications` once digest inputs shift to read models or events.
- `auth` once real identity backing replaces mock login.

#### Should not be split first
- `employees` from everything else is a logical boundary, but not a first extraction candidate for runtime isolation because many current queries still join directly against employee data.

## 6. Required Interface Boundaries

### 6.1 Shared contract package layout

Add contract-first definitions under `packages/shared/src/contracts/`.

```text
packages/shared/src/contracts/
├─ identity.ts
├─ workforce.ts
├─ compliance.ts
├─ records.ts
├─ reference-data.ts
├─ notifications.ts
└─ feature-flags.ts
```

Each contract file should export:
- Zod request/response schemas
- public TypeScript interfaces
- event payload types
- error code enums

### 6.2 Service boundary rules
- Routers depend on validators and application services only.
- Services depend on repositories, domain helpers, and contracts.
- Repositories depend on Prisma only.
- Cross-service reads happen through:
  1. a public contract client, or
  2. a query/facade layer that is explicitly marked cross-domain.
- No service may import another module's Prisma mapping helpers.

### 6.3 Cross-domain contracts to introduce first

| Contract | Producer | Consumers | Why first |
|---|---|---|---|
| `EmployeeSummaryContract` | Workforce Core | compliance, records, notifications, web | removes direct `Employee` joins for basic lookups |
| `StandardRequirementContract` | Reference Data | compliance, records | removes duplicated standard logic |
| `DocumentReferenceContract` | Records | compliance | formalizes document linkage by ID/status |
| `ReadinessQueryContract` | Workforce facade | web, notifications | moves readiness aggregation out of employee CRUD |
| `NotificationCommandContract` | Notification Service | all domains | prepares event-driven notification creation |

## 7. Query / Composition Architecture

### 7.1 New query layers
Create explicit read-side services instead of hiding cross-domain logic in CRUD modules:
- `ReadinessQueryService`
- `ComplianceOverviewQueryService`
- `NotificationDigestQueryService`
- `ReviewQueueQueryService`

### 7.2 Rule
Cross-domain aggregation is allowed only in:
- query/facade services,
- reporting services, or
- async projection handlers.

It is not allowed in domain CRUD services such as `employeesService.create()` or `qualificationsService.update()`.

## 8. Deployment Mapping

| Logical group | API path prefix target | Runtime shape | Database stance | Notes |
|---|---|---|---|---|
| Identity Platform | `/api/v1/auth`, `/api/v1/platform/*` | API container | shared DB initially | feature-flag bootstrap endpoint lives here initially |
| Workforce Core | `/api/v1/workforce/*` | own container once extracted | shared DB schema first, separate schema later | source of truth for people/scope |
| Compliance Service | `/api/v1/compliance/*` | API container | shared DB first | owns evidence rules |
| Records Service | `/api/v1/records/*` | API + worker | shared DB first | document processing and hours reconciliation |
| Reference Data | `/api/v1/reference/*` | API container | shared DB or separate schema early | read-heavy, ideal early extraction |
| Notification Service | `/api/v1/notifications/*` | worker or API+worker | shared DB/read model first | event-driven target |

## 9. Migration Path

### Phase 0 — Stabilize the modular monolith
- Keep one deployable API.
- Publish shared contracts for each service group.
- Add repository interfaces so service code no longer depends directly on Prisma types.
- Add `/api/v1` route namespace plan without breaking existing routes yet.
- Introduce feature flags to gate incomplete routes and menu entries.

### Phase 1 — Pipeline separation before runtime separation
- Split CI by service group and by web/admin shell.
- Add Terraform module stubs for `compute-workforce`, `compute-compliance`, `compute-records`, `compute-reference`, and `compute-notifications`.
- Keep all groups in one runtime until path filters, contract tests, and promotion gates are stable.
- Fix current workflow/IaC alignment issues before layering more pipelines.

### Phase 2 — Extract low-coupling services first
- Extract **Reference Data Service**.
- Extract **Notification Service** behind command/event contracts.
- Keep Workforce, Compliance, and Records in the shared runtime while query layers mature.

### Phase 3 — Split records processing
- Extract **Records Service** with its own worker path for document processing and import/reconciliation jobs.
- Keep shared database initially, but isolate tables and migration ownership.

### Phase 4 — Split compliance runtime
- Extract **Compliance Service** once template/qualification/medical APIs are fully contract-tested.
- Replace direct joins with workforce/reference contract clients.

### Phase 5 — Optional deeper isolation
- Move to separate schemas or databases only after operational metrics prove a need.
- Introduce event streaming/materialized views for digests and readiness.

## 10. Terraform and Deploy Target Shape

### 10.1 Recommended Terraform evolution

```text
infra/modules/
├─ compute-identity/
├─ compute-workforce/
├─ compute-compliance/
├─ compute-records/
├─ compute-reference/
└─ compute-notifications/
```

Keep `00-foundation` and `10-data` shared. Split compute by service group before splitting data layers.

### 10.2 Environment rules
- `dev`: allow all service groups to deploy independently.
- `staging`: promote only groups that passed contract and integration checks.
- `prod`: approve per service group; do not require whole-platform redeploys for isolated changes.

## 11. Health, versioning, and config conventions
- Every service group must expose `/health` and `/ready`.
- Public HTTP APIs must standardize on `/api/v1/{group}`.
- Error payloads stay consistent across groups.
- Feature-flag bootstrap and service metadata endpoints belong to the platform layer.

## 12. Backlog Additions

| ID | Priority | Item |
|---|---|---|
| SA-01 | P0 | Add shared contract files for workforce, compliance, records, reference data, notifications, and feature flags in `packages/shared`. |
| SA-02 | P0 | Introduce repository interfaces so services stop depending directly on Prisma. |
| SA-03 | P0 | Fix workflow output mismatch between `deploy.yml` and `infra/layers/20-compute/outputs.tf`. |
| SA-04 | P1 | Create read-side query services for readiness, digest, review queues, and compliance overview. |
| SA-05 | P1 | Create Terraform compute module stubs per logical service group. |
| SA-06 | P1 | Add `/api/v1` route namespace plan and compatibility strategy. |
| SA-07 | P2 | Extract Reference Data and Notification services to separate runtimes. |
| SA-08 | P2 | Introduce event contracts for notification commands and document review lifecycle. |

## 13. Acceptance Criteria
- Each domain aggregate has exactly one documented owner.
- Every future extracted service has a defined contract file before implementation.
- Cross-domain aggregation has moved out of CRUD services into named query/facade layers.
- CI/CD and Terraform naming align with the logical grouping matrix.
- No proposed step requires a rewrite of existing working modules.