# Project Context

- **Owner:** ivegamsft
- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker. Workforce readiness and qualification management for regulated industries.
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC (5 roles), Terraform, GitHub Actions
- **Structure:** Monorepo (npm workspaces) — apps/api (64 endpoints, 9 modules), apps/web (scaffold), apps/admin (scaffold), packages/shared, data (Prisma)
- **API Modules:** auth, documents, employees, hours, labels, medical, notifications, qualifications, standards
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Azure Container Apps Terraform Shift (2026-03-15)

Migrated the foundation and compute Terraform layers to support Azure Container Apps: added ACR + Log Analytics + ACR pull identity, switched Key Vault to RBAC, and rewired compute to deploy a Container App with managed identity-based access and Key Vault secret name wiring.

### Bootstrap Scripts for Azure Infrastructure (2026-03-13)

Created `bootstrap/` at repo root with Azure CLI scripts for one-time infrastructure setup:

- **`variables.sh`** — Shared config (project: eclat, region: eastus2, envs: dev/staging/prod)
- **`01-tf-state-storage.sh`** — Creates storage accounts + containers for Terraform remote state per environment
- **`02-entra-spns.sh`** — Creates Entra app registrations + service principals with Contributor role
- **`03-gh-oidc.sh`** — Sets up federated identity credentials for GitHub OIDC (passwordless auth)
- **`README.md`** — Prerequisites, order of operations, post-bootstrap steps

**Key patterns:**
- Idempotent check-before-create (safe to re-run)
- Naming: `eclat-{env}-deploy` for SPNs, `eclatstate{env}` for storage accounts
- OIDC subjects: main branch (`repo:owner/repo:ref:refs/heads/main`) + environment-specific
- Auto-sets GitHub secrets if `gh` CLI is available
- Bash scripts with `set -euo pipefail` for safety

### Terraform Infrastructure Layers (2026-03-14)

Designed three-layer Terraform architecture:
- **`00-foundation`** — Resource group, Key Vault, shared locals/tags
- **`10-data`** — PostgreSQL Flexible Server, storage account, secrets in Key Vault
- **`20-compute`** — Linux Web App (API hosting), future web/admin hosting

**State & Secrets:**
- Per-environment backend storage (from bootstrap), split by layer state key (foundation.tfstate, data.tfstate, compute.tfstate)
- Outputs carry identifiers + secret names, not raw values
- 10-data writes secrets to KV; 20-compute reads via Key Vault references

**CI/CD:** One infra workflow with staged jobs (foundation → data → compute) + separate app deployment workflow

**Future:** APIM/edge resources deploy as a new downstream layer after compute.

**Cross-layer contract:** Layer outputs define inputs for downstream dependents. Remote state protected from raw secret exposure.

**Files:** `bootstrap/{variables.sh, 01-tf-state-storage.sh, 02-entra-spns.sh, 03-gh-oidc.sh, README.md}`

### Terraform Layers + Bootstrap Naming Contract (2026-03-14)

Infra is now split into three Terraform layer roots under `infra/layers/`:
- `00-foundation` — resource group + Key Vault
- `10-data` — PostgreSQL Flexible Server + application storage
- `20-compute` — App Service plan + Linux Web App for the API

**Important implementation details:**
- Remote state stays in the bootstrap-created storage accounts and uses keys `foundation.tfstate`, `data.tfstate`, and `compute.tfstate` inside a single `tfstate` container per environment.
- Backend naming must match `bootstrap/variables.sh`: resource groups `eclat-{env}-tfstate-rg` and storage accounts `eclattfstate{env}`.
- Cross-layer outputs carry resource identifiers and Key Vault secret names, not raw secret values.
- The compute layer generates the API JWT secret in Key Vault and wires App Service settings through Key Vault references so runtime secrets stay out of layer outputs.

**Files:** `infra/modules/{foundation,database,storage,compute}` and `infra/layers/{00-foundation,10-data,20-compute}` with per-layer env files in `infra/environments/{dev,staging,prod}/`

## Important Status: PRDs Available

📌 **As of 2026-03-13T17:10:00Z**, comprehensive PRDs for E-CLAT are now available in `docs/prds/`:
- **Platform Foundation PRD** — architecture, RBAC, audit, infra
- **Workforce Operations PRD** — employees, hours, qualifications, standards
- **Compliance Evidence PRD** — documents, medical records, evidence chain
- **Governance Taxonomy PRD** — taxonomy versioning, labels, standards reference
- **Frontend Admin PRD** — admin app scaffolds and workflows

See `.squad/orchestration-log/2026-03-13T17-10-freamon.md` for details. Read PRDs before planning your domain work.

## Important: MVP Planning Complete (2026-03-13T23:25:00Z)

📌 **MVP Planning Session Complete.** See `.squad/orchestration-log/2026-03-13T2325-{freamon,sydnor}.md` and `.squad/decisions.md` for full context.

### Your Phase 0 Assignment: API Foundation + Test Infrastructure

**Your responsibilities (Bunk - Backend Lead):**
1. **Fix critical bugs (Phase 0):**
   - Labels mount-path bug: Router mounted at `/api` instead of `/api/labels`
   - Document route-ordering issues
   - Resolve `departmentId` FK/semantics
   - Clarify `requiredTests` handling (deferred vs required)

2. **Implement Prisma integration (Phase 1):**
   - Repository pattern for core models
   - Real JWT verification in auth middleware
   - Audit logging enforcement (AuditLog persistence)
   - RBAC service-layer implementation (ownership-aware reads/writes)
   - Shared type mapping (lowercase strings ↔ uppercase enums)

3. **Support test infrastructure:**
   - Coordinate with Sydnor on test DB setup
   - Implement mock Prisma client support
   - Build service layer to be testable

**MVP Scope (what you're building):**
- **Phase 1:** Auth service (JWT login, token refresh), Prisma integration
- **Phase 2:** Employees, Standards, Qualifications, Medical services
- **Phase 3:** Documents-lite, Notifications-lite services
- **Deferred:** Full Hours workflows, Labels publishing, OCR/classification

**Blocking dependency:** Test infrastructure (test DB, factories, auth mocking) must be in place before Phase 1 accelerates. Sydnor is working on this in Phase 0.

See `.squad/decisions.md` for full MVP sequencing and test infrastructure requirements.

### JWT Auth + Route Safety (2026-03-14)

- Auth now issues signed access and refresh JWTs with a `tokenType` claim, and protected middleware accepts only verified access tokens.
- Until Prisma-backed users are wired, login uses deterministic mock users for each RBAC role and bcrypt password verification so auth flows stay testable.
- Labels endpoints are namespaced under `/api/labels`, and the documents review queue route must stay ahead of `/:id` to avoid Express path shadowing.
- API test helpers now build the real app and sign compatible access tokens, so route wiring and auth behavior are covered together.

### Phase 0 Complete: MVP Product Scope Locked (2026-03-14T20:05:00Z)

📌 **Freamon delivered MVP scope defaults; Bunk now owns Phase 0 blocking implementation.**

**MVP Scope Summary (8 decisions):**
- Core loop: Qualifications + Medical primary compliance loop (no Hours for MVP)
- Documents deferred to Phase 2 as manual upload + review only (no OCR)
- Department stays opaque string; no Department entity; single-org only
- `overallStatus` is deterministic 3-state rule (compliant/at_risk/non_compliant) with 30-day warning
- `requiredTests` is informational only on Standard; no test tracking subsystem
- In-app notifications only; email delivery deferred Phase 2+
- All decisions unblock Phase 0/1 and are reversible post-MVP

**Container-First Architecture also locked:**
- Moving from App Service to Azure Container Apps
- ACR + Log Analytics in `00-foundation`; Container Apps in `20-compute`
- Runtime reads Key Vault secrets directly (no init containers, no Dapr)
- Local-first Docker/Compose; image build on merge; separate infra deployment

**Your Phase 0 implementation targets:**
1. JWT tokens module (`apps/api/src/modules/auth/tokens.ts`) — signing + verification
2. Mock user store — deterministic users per RBAC role with bcrypt passwords
3. Labels routing: namespace under `/api/labels`, fix document route ordering
4. Auth middleware verification (real JWT checks, not placeholder)
5. Updated tests to validate routes + auth behavior
6. Coordinate with Sydnor on test factories and mock Prisma

**Phase 1 opens once Sydnor's test harness is confirmed and Bunk's Phase 0 work is tested.**

### Docker local dev + runtime Key Vault bootstrap (2026-03-14)

- API configuration now initializes asynchronously: load `.env` first, then hydrate missing runtime secrets from Key Vault only when `KEY_VAULT_URI` and secret-name settings are present.
- Container runtime depends on compiled workspace artifacts, so shared packages consumed by the API need `dist/` entrypoints in package metadata instead of source-file entrypoints.
- Docker builds need to clear stale TypeScript build-info for shared workspace packages before rebuilding when `dist/` is excluded from the image build context.

### Prisma workspace bootstrap + demo seed (2026-03-15)

- Prisma generation and migrations are owned by `data/prisma/schema.prisma` and `data/prisma/migrations/`; the API consumes the generated client through a singleton in `apps/api/src/config/database.ts`.
- API startup now connects Prisma only after environment loading, logs queries in development, and disconnects cleanly on shutdown or startup failure from `apps/api/src/index.ts`.
- Demo seed data lives in `data/src/seed.ts` and uses UUID v5 IDs derived from the mock auth emails so seeded employees stay aligned with the deterministic login store.
- Local validation for this repo should include `node ../../node_modules/typescript/lib/tsc.js`-based typechecks plus the existing Vitest suite after Prisma changes.

### Container-First Architecture Complete (2026-03-14T20:46:38Z)

**Docker stack fully operational locally.** All three containers (API :3000, Postgres :5432, Azurite :10000) healthy. Auth login returns JWT; protected endpoints enforce 401. Terraform compute pivoted to Container Apps with managed identities. See `.squad/orchestration-log/2026-03-14T20-46-38Z-bunk.md` for full delivery summary.

**Status:** Phase 0 Docker + Terraform complete. Phase 1 opens once Sydnor's test factories are confirmed.

### Qualifications + Medical Prisma service patterns (2026-03-15)

- `apps/api/src/modules/qualifications/service.ts` now follows the Prisma singleton pattern from `apps/api/src/config/database.ts`, maps Prisma enums back to shared lowercase DTOs, and returns safe relation data with employee password fields excluded.
- Qualification writes must validate employee + standard existence, reject duplicate `documentIds`, and verify linked documents belong to the same employee before writing `QualificationDocument` rows.
- Qualification compliance for MVP treats `active` and `expiring_soon` records as satisfying a standard requirement; response payloads now return requirement-by-requirement detail for UI consumption.
- `apps/api/src/modules/medical/service.ts` uses date-driven expiry recalculation: expiration can force `expired`, while non-expired records preserve the explicit business status (`cleared`, `pending`, or `restricted`).
- Key backend file paths for this phase: `apps/api/src/modules/qualifications/{service.ts,router.ts}`, `apps/api/src/modules/medical/service.ts`, `apps/api/src/modules/standards/router.ts`, and `data/prisma/schema.prisma`.

### Employees + Standards Prisma service patterns (2026-03-15)

- `apps/api/src/modules/employees/service.ts` and `apps/api/src/modules/standards/service.ts` now own Prisma-backed CRUD/list flows instead of `notImplemented()` stubs, using the shared singleton from `apps/api/src/config/database.ts` and explicit `NotFoundError` / `ConflictError` handling.
- Employee DTO mapping must normalize Prisma enums (`Role`, `QualificationStatus`, `MedicalClearanceStatus`) back to shared lowercase strings, and standards requirements must convert Prisma `Decimal` values to numbers before returning API payloads.
- Employee readiness for MVP treats every active compliance standard as a required qualification; missing standards, expired qualifications, missing medical clearance, or non-cleared medical states drive `non_compliant`, while items expiring within 30 days drive `at_risk`.
- Router/service alignment matters here: standards routes now call `create/list/getById/update`, requirement creation passes `standardId` separately, and employee/standard list routes let the service own the 20-item default when pagination params are omitted.
- Key backend file paths for this phase: `apps/api/src/modules/employees/{service.ts,router.ts}`, `apps/api/src/modules/standards/{service.ts,router.ts}`, `apps/api/src/modules/*/validators.ts`, and `data/src/seed.ts`.

