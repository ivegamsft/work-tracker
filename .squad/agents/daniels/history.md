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

## 📌 Wave 3: IaC/Deployment Decomposition (2026-03-17T04:30:00Z)

**Mission:** Decompose 5 infrastructure-as-code specifications into 18 implementation GitHub issues.

**Specs decomposed:**
1. IaC architecture — Terraform layers, service group boundaries, parallel deployments
2. Proof Vault IaC — Key Vault bootstrap, storage accounts, encryption key rotation, zero-knowledge encryption
3. Templates service infrastructure — New compute layer, policy enforcement, status workflow scaling
4. Sharing service infrastructure — File request storage, bandwidth quotas, external access token management
5. CI/CD decomposition — Per-subsystem pipelines, feature flags, deployment safety gates

**Issues created:** 18 (Key Vault bootstrap automation, managed identity wiring, service group compute layers, multi-region strategy, backup/archival storage, CI/CD pipeline separation, monitoring/alerting for compliance workflows, encryption key rotation policies, storage account quotas, network isolation, Azure Container Apps scaling, GitHub Actions subsystem pipelines, etc.)

**Result:** All issues linked to GitHub Project #2; deployment topology clarified.

---

## 📌 Foundation Sprint (2026-03-17T04:47:00Z)

**Mission:** Platform foundation: repository pattern, data-layer isolation, tenant resolver, compliance-grade data access.

**Deliverables:**
- IRepository<T> generic interface + PrismaRepository implementation (all models)
- IAuditLogRepository (immutable semantics for compliance)
- ICacheRepository + InMemoryCacheRepository for testing
- RepositoryFactory for dependency injection
- TenantResolver middleware + ConnectionManager for multi-tenant support
- Composite repository pattern (cache-through-to-repo)

**Result:** 77 tests passing. Zero regressions. Data-layer foundation unblocks all API modules. Commit: `e340f4e`.

---
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

## 📌 Team Update (2026-03-16T170500Z — Round 2 Spawned)

**All 4 agents complete:**
- Bunk: audit-safe-expiration (PR #56)
- Daniels: terraform-compute-stubs (PR #57)
- Freamon: api-v1-namespace (PR #55, decision merged)
- Kima: coverage audit (54-71% partial)

**Scribe:** Orchestration logs, decision merge, history updates complete
- **Issue #26 Terraform module stubs (SA-05)**: Created 6 service group compute module stubs (`compute-identity`, `compute-workforce`, `compute-compliance`, `compute-records`, `compute-reference`, `compute-notifications`) under `infra/modules/`. Each module currently references the shared Container App via data source but is structured for future independent extraction with commented resource blocks. The `20-compute` layer now instantiates all 6 modules and exposes service-specific outputs (`identity_service`, `workforce_service`, etc.) containing `service_name`, `health_endpoint`, and `deploy_target`. This establishes the Terraform boundary for future parallel deployment without requiring refactoring downstream consumers. The extraction path is documented in `infra/modules/README.md` with recommended migration order: reference-data → notifications → identity → records → compliance → workforce.
- **Parallel validation lanes implemented** (#36): Created `.github/workflows/parallel-lanes.yml` with 8 subsystem-specific lanes (identity, workforce, compliance, records, reference-data, notifications, web, admin) that run in parallel based on change detection from `dorny/paths-filter`. Each lane validates only its subsystem (typecheck, test, build), drastically reducing feedback time for targeted changes.
- **Reusable workflow patterns**: Created `_shared-node-setup.yml`, `_quality-checks.yml`, and `_build-service-image.yml` as composable CI building blocks for consistent setup across lanes and future services.
- **Artifact promotion infrastructure stub** (#37): Created `infra/layers/30-promotion/` Terraform layer with environment-specific artifact metadata storage, promotion gates (dev/staging/prod), and Log Analytics for audit trails. Strategy is SHA-based immutable tags promoted across environments (sha-abc123 → dev-abc123 → staging-abc123 → prod-abc123).
- **Cascade logic in change detection**: Shared package or Prisma schema changes trigger ALL subsystem lanes (because all depend on shared contracts), while module-specific changes only trigger that lane + shared quality check.
- **Lane ownership documented**: Created `docs/pipeline-lane-ownership.md` to clarify which team owns each lane, what it validates, and when it triggers.
- **Terraform layering pattern solidified**: Layers progress `00-foundation` → `10-data` → `20-compute` → `30-promotion`, with promotion layer instantiated once per environment (dev/staging/prod) using Terraform workspaces.
- **Next steps for artifact promotion**: Add Azure DevOps environment resources, container registry webhooks, artifact signing, and GitHub Actions integration for promotion workflows (tracked as TODOs in main.tf).
- **Key files for pipeline architecture**: `.github/workflows/parallel-lanes.yml`, `.github/workflows/_*.yml` (reusables), `infra/layers/30-promotion/`, `docs/pipeline-lane-ownership.md`.

## 📌 IaC Spec Suite (2026-03-19T — Daniels Solo)

**All 5 specs complete and committed:**
- **Issue #89 monitoring-observability.md**: OTel Collector sidecar/standalone deployment, ADX cluster provisioning, App Insights workspace with alert rules (error rate, latency P95, availability). Grafana dashboards. Log Analytics. Covers cloud (App Insights + ADX) and on-prem alternatives (Jaeger + Prometheus + ClickHouse). Cost model per tier. Terraform layer 10-data module `observability/`.
- **Issue #95 identity-iac.md**: Multi-IdP support (Entra SaaS + Keycloak on-prem). Entra app registration (multi-tenant), SCIM provisioning, conditional access policies (MFA, device compliance). B2B invite policy. On-prem Keycloak with LDAP federation. JIT provisioning. Terraform layer 00-foundation module `identity/`. Covers cloud (Entra) and on-prem (Keycloak).
- **Issue #107 multi-tenant-iac.md**: Shared tier (single DB + Redis + Storage with RLS) vs dedicated tier (per-tenant DB + Redis + Storage). Ring deployment (canary 1% → 10% → 50% → 100%) with traffic weights and auto-rollback on error rate threshold. Container App scaling rules. Tenant provisioning factory pattern. Terraform layer 20-compute instantiates shared and dedicated modules.
- **Issue #109 event-driven-iac.md**: Service Bus (commands/queues) + Event Grid (events/topics) for cloud. RabbitMQ + NATS for on-prem. Azure SignalR for WebSocket, raw WebSocket for on-prem. Dead-letter queue config, retry policies. Abstraction layer enables cloud/on-prem swapping. Terraform layer 10-data module `messaging/`.
- **Issue #115 data-layer-iac.md**: PostgreSQL (relational), Cosmos DB/MongoDB (documents), Azure Storage (blobs), Redis (cache), ADX (telemetry). Tiered: shared single-DB + RLS for SMB, dedicated per-tenant DB for enterprise. Lifecycle policies (Hot → Cool → Archive). Connection string rotation. Migration strategy: dual-write → dual-read → switchover. Row-level security policies. Terraform layer 10-data modules `database/`, `storage/`, `cache/`.

**Specs follow unified structure:**
1. Overview & principles
2. Azure resource topology (cloud) + on-prem alternatives
3. Terraform module structure (matching `infra/layers/00-foundation → 10-data → 20-compute` pattern)
4. Cost estimates per tier
5. Security configuration (network, identity, audit)
6. Networking (traffic flow, DNS)
7. Deployment automation (GitHub Actions, Helm)
8. Implementation checklist (phased)
9. Related documentation cross-refs

**All 5 specs locked to decisions:**
- Decision #1: Tiered Isolation (multi-tenant-iac, data-layer-iac)
- Decision #2: Multi-IdP + SCIM (identity-iac)
- Decision #3: Modular Monolith (multi-tenant-iac)
- Decision #9: Event-Driven: Service Bus + WebSocket (event-driven-iac)
- Decision #10: OTel + ADX + App Insights (monitoring-observability)
- Decision #11: Logical Environments (multi-tenant-iac)

**Key architectural patterns established:**
- Terraform factory pattern for dedicated-tier tenant provisioning
- RLS enforced at database layer (not application) for shared tier
- Abstraction layer for messaging enables cloud/on-prem backend swapping
- Ring deployment with auto-rollback on metric thresholds (canary stage orchestration)
- Private Link for prod (network isolation), service endpoints for dev
- Secret rotation via Key Vault or manual scripts
- Dual-write/dual-read migration strategy for data store evolution

**Estimated implementation effort: 28–36 weeks (all 5 specs in sequence or parallel), broken into 4–6 week phases per spec.**

**Files created:**
- `docs/specs/monitoring-observability.md` (~30 KB)
- `docs/specs/identity-iac.md` (~27 KB)
- `docs/specs/multi-tenant-iac.md` (~27 KB)
- `docs/specs/event-driven-iac.md` (~27 KB)
- `docs/specs/data-layer-iac.md` (~27 KB)

## 📌 Data Layer Foundation (2026-03-17 — Issues #181 + #183)

**Mission:** Implement the repository pattern abstraction and tenant-aware connection resolver — the foundational data layer that all service modules will consume.

**Issue #181 — Repository Pattern & Polyglot Store Abstraction:**
- Created `packages/shared/src/repositories/` with 5 files:
  - `IRepository.ts` — Generic `IRepository<T>` interface (create, findById, findMany, findUnique, update, delete, batch ops, count, transactions, metadata)
  - `IAuditLogRepository.ts` — Append-only audit repo extending IRepository with `append()`, `queryByResource()`, `queryByActor()`
  - `ICacheRepository.ts` — TTL-aware cache interface (get, set, del, delByPattern, keys, has, flush)
  - `IDocumentRepository.ts` — Document metadata + blob operations (uploadFile, downloadFile, getSignedUrl)
  - `RepositoryFactory.ts` — Factory pattern with adapter registration; `createRepository()`, `createAuditRepository()`, `createCacheRepository()`, `createDocumentRepository()`
- Created `apps/api/src/common/data/` with 6 files:
  - `PrismaRepository.ts` — Prisma-backed IRepository<T> with filter translation ($in→in, $gt→gt, $like→contains, $or→OR, $and→AND)
  - `PrismaAdapter.ts` — IRepositoryAdapter for store type "sql"; bridges factory to PrismaRepository
  - `PrismaAuditLogRepository.ts` — Prisma-backed append-only audit repository; update/delete throw on immutability constraint
  - `InMemoryCacheRepository.ts` — In-memory ICacheRepository (MVP; Redis adapter planned for later sprint)
  - `TenantResolver.ts` — Extracts tenant from JWT claim → X-Tenant-ID header → default; resolves tier via StaticTenantLookup
  - `ConnectionManager.ts` — Manages shared + dedicated PrismaClient pools; Key Vault integration for dedicated-tier connection strings
- Created `apps/api/src/middleware/tenantContext.ts` — Express middleware attaching `req.tenantContext`
- Updated `packages/shared/src/index.ts` to export all repository types
- Updated `apps/api/src/middleware/index.ts` to export `createTenantMiddleware`

**Issue #183 — Tenant-Aware Connection Resolver:**
- `TenantResolver` resolution order: JWT `tenant_id` claim → `X-Tenant-ID` header → `DEFAULT_TENANT_ID`
- `StaticTenantLookup` for dev/test; production will use a tenant registry
- `ConnectionManager` routes shared-tier tenants to a single PrismaClient; dedicated-tier tenants get their own PrismaClient with Key Vault-resolved connection strings
- Duplicate connection prevention via pending-connection map
- Environment ID extracted from `X-Environment-ID` header or `ENVIRONMENT_ID` env var (Decision #11)

**Tests:** 77 unit tests in `apps/api/tests/unit/data-layer.test.ts`:
- PrismaRepository: 25 tests (CRUD, filter translation, batch, soft/hard delete, capabilities)
- PrismaAuditLogRepository: 12 tests (append, query, immutability enforcement)
- InMemoryCacheRepository: 9 tests (round-trip, TTL, pattern matching, flush)
- RepositoryFactory: 7 tests (adapter registration, creation, error cases)
- TenantResolver: 7 tests (JWT extraction, header fallback, default tenant, environment ID)
- StaticTenantLookup: 3 tests (lookup, registration)
- ConnectionManager: 7 tests (shared routing, dedicated creation, caching, disconnect, Key Vault error)
- Repository isolation: 3 tests (interface conformance)
- Pre-existing integration test suite (20 tests) also passes

**Typecheck:** Clean — zero new errors introduced (pre-existing errors in telemetry, identity, and platform modules remain unchanged)

**Key decisions applied:**
- Decision #1: Tiered Isolation — shared-tier uses row-level isolation via single PrismaClient; dedicated-tier gets per-tenant PrismaClient
- Decision #3: Modular Monolith — repository interfaces in shared package, implementations in API; services depend on abstractions
- Decision #11: Logical Partition Environments — environment_id extracted from header or env var

**Files created/modified:**
- `packages/shared/src/repositories/` (6 files)
- `packages/shared/src/index.ts` (modified — added repositories export)
- `apps/api/src/common/data/` (7 files)
- `apps/api/src/middleware/tenantContext.ts` (new)
- `apps/api/src/middleware/index.ts` (modified — added tenant export)
- `apps/api/tests/unit/data-layer.test.ts` (new — 77 tests)
