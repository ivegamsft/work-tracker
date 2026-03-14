# Squad Decisions

## Active Decisions

### PRD Structure for E-CLAT (2026-03-13)

**Decision:** Document E-CLAT planning as a **PRD set** under `docs/prds/` instead of a single monolithic PRD.

**Structure:**
- `docs/prds/README.md`
- `docs/prds/platform-foundation-prd.md`
- `docs/prds/workforce-operations-prd.md`
- `docs/prds/compliance-evidence-prd.md`
- `docs/prds/governance-taxonomy-prd.md`
- `docs/prds/frontend-admin-prd.md`

**Rationale:**
- The codebase is already split into nine backend modules plus two app scaffolds.
- Cross-cutting platform concerns (RBAC, audit logging, validation, infra, background jobs) need one authoritative document.
- Domain teams need narrower, executable documents they can implement against without paging through unrelated modules.
- Frontend/admin requirements need their own product framing because those apps are still scaffolds.

**Expected Use:**
- Freamon owns sequencing and architectural alignment from the platform PRD.
- Kima can execute backend work from the three domain PRDs.
- Bunk can execute UI work from the frontend/admin PRD.
- Sydnor can derive test plans and quality gates from the acceptance criteria across the set.

### MVP Scope & Sequencing (2026-03-13)

**Decision:** Start MVP with secure compliance loop (Employees, Standards, Qualifications, Medical) + Foundation layer, deferring Hours workflows, full Labels lifecycle, and OCR/classification automation.

**Phase 0 (Blocking):**
- Fix labels mount-path bug (`/api` → `/api/labels`)
- Fix document route-ordering issues
- Set up test database (SQLite in-memory + `.env.test`)
- Create core model fixtures/factories (Employee, Qualification, Document, HourRecord)
- Implement JWT verification + mock token generator
- Build request testing utilities (supertest + auth builder)

**Phase 1 (Authentication & Persistence):**
- Complete JWT auth middleware
- Implement Prisma repository pattern
- Set up audit logging enforcement
- RBAC service-layer implementation

**Phase 2 (Core Domain Implementation):**
- Employees service (CRUD, readiness tracking)
- Standards service (requirements, versioning)
- Qualifications service (status tracking, compliance checks)
- Medical clearances service

**Phase 3 (Supporting Modules):**
- Documents (simplified: upload, approve, audit)
- Notifications (preferences, list, mark-read)
- Full Hours workflows deferred

**Rationale:**
- Smallest secure compliance loop proves patterns without taking on OCR/Hours/Labels complexity
- Establishes cross-cutting patterns: repository conventions, enum mapping, audit coverage, row-level RBAC, state-transition tests
- Test infrastructure is Phase 0 blocker (not after)
- Department semantics and `requiredTests` handling must be resolved before fanout

**Owner:** Freamon (sequencing), Bunk (backend), Sydnor (test infra), Kima (frontend)

**Conditions:**
- Test DB + factories must be in place before API endpoint implementation accelerates
- Auth middleware JWT verification must be real (not placeholder)
- Resolve `departmentId` FK/semantics

---

### Test Infrastructure for MVP (2026-03-13)

**Decision:** Build comprehensive test infrastructure in Phase 0, in parallel with API work (not sequential).

**Priority 1 (Blocking):**
- Test database: SQLite in-memory (local dev) + PostgreSQL (CI)
- `.env.test` configuration
- Prisma seed script for test data
- Factory pattern for core models (Employee, Qualification, Document, HourRecord, MedicalClearance)

**Priority 2:**
- JWT verification implementation in auth middleware
- `createMockToken()` utility for test role generation
- Auth test helpers (token attachment, authenticated request builder)

**Priority 3:**
- Request testing utilities (supertest wrapper, API client)
- Database cleanup hooks (beforeEach/afterEach transaction rollback)
- Domain-specific assertions

**Priority 4:**
- Middleware unit tests (error handler, auth middleware)
- Test configuration (Jest timeouts, snapshot strategy, coverage gates)

**Coverage Targets:**
- API endpoints: 80% (happy path + RBAC boundaries + error cases)
- Business logic: 95%
- Middleware: 100%
- Overall: 85% line coverage gate

**Owner:** Sydnor (lead), Bunk (support), Kima (integration tests after API stabilizes)

**Rationale:**
- 64 endpoints × 3 test cases per endpoint (unauthenticated, wrong role, correct role) = 192+ required RBAC tests
- Without factories, test code becomes unmaintainable
- Integration tests need clean state between runs (no pollution)
- Compliance systems require 100% middleware coverage (security-critical)

---

### Terraform Infrastructure Layering (2026-03-14)

**Owner:** Freamon  
**Context:** `infra/` was a single Terraform root with placeholder modules. Deployment order was implicit, not enforced.

**Decision:** Restructure into three deployable Terraform roots ordered by dependency:
1. **`00-foundation`** — Resource group, Key Vault, shared naming/tags
2. **`10-data`** — PostgreSQL, storage account, secrets to Key Vault  
3. **`20-compute`** — API hosting (Web App layer)

**Remote State Contract:**
- Per-environment backend storage accounts (from `bootstrap\`)
- Split by state key: `foundation.tfstate`, `data.tfstate`, `compute.tfstate`
- Outputs carry resource IDs and secret names, not raw values
- `10-data` writes secrets to Key Vault; `20-compute` reads via references

**Deployment Order:**
1. `bootstrap/01-tf-state-storage.sh`
2. `bootstrap/02-entra-spns.sh`
3. `bootstrap/03-gh-oidc.sh`
4. `infra/layers/00-foundation`
5. `infra/layers/10-data`
6. `infra/layers/20-compute`
7. Application artifact deployment

**GitHub Actions:** One infra workflow with staged jobs (foundation → data → compute). Keep app deployment in separate workflow.

**Future:** When APIM/edge resources are added, they deploy **after** `20-compute` as a new layer.

**Consequences:**
- Deployment order explicit and enforceable
- Data and compute can evolve independently
- Bootstrap stays one-time prerequisite
- Clear insertion point for future integration layer

---

### API Runtime Secret Handling (2026-03-14)

**Owner:** Bunk  
**Context:** Compute layer needs JWT secret at startup. Cross-layer remote state must not expose raw values.

**Decision:** Create API JWT signing secret inside `infra/modules/compute` and store it in environment Key Vault. Linux Web App reads both `DATABASE_URL` and `JWT_SECRET` via Key Vault references.

**Rationale:**
- Raw secrets stay out of Terraform outputs and cross-layer state
- Compute layer self-sufficient for application runtime
- Matches platform rule: downstream consumers use Key Vault references

**Consequences:**
- Compute layer needs Key Vault write access via deployment identity
- Runtime secret rotation happens in Key Vault without cross-layer contract changes

---

### Terraform Layer Output Pruning (2026-03-14)

**Owner:** Freamon  
**Context:** Wiring map identified 5 dead layer outputs (exports with no current consumer).

**Decision:** All 5 outputs are pruned. Layer outputs form the cross-layer Terraform contract and must export only what downstream layers, workflows, or external systems actually consume.

**Pruned Outputs:**

| Output | Reason |
|--------|--------|
| `00-foundation.resource_group_id` | No consumer; RG name suffices for downstream placement. |
| `10-data.postgres_fqdn` | No runtime consumer; debuggable from portal or state. |
| `10-data.postgres_database_name` | No consumer; database name is in the connection string. |
| `20-compute.api_default_hostname` | Superseded by custom `api_url`; removes false option. |
| `20-compute.api_principal_id` | Module implementation detail, not a layer contract. |

**Principle:** Layer outputs are the cross-layer contract. Speculative outputs or module implementation details belong in the module, not the layer API.

---

### MVP Default Decisions (2026-03-14)

**By:** Freamon  
**Context:** 8 open product questions from MVP plan with sensible MVP-scope defaults, reversible via API changes only.

**Q1 Decision: Qualifications + Medical for first demo, without Hours**
- Readiness calculation rule-based on qualification expiry and medical status
- Hours can be Phase 2+ without blocking demo
- Endpoint contract and table already exist

**Q2 Decision: Manual entry acceptable for MVP, documents deferred to Phase 2**
- MVP goal is to prove compliance tracking works, not build document pipeline
- Documents table exists; Phase 2 adds upload/review without waiting for OCR
- Manual entry of qualifications/medical is realistic for early workflows

**Q3 Decision: Upload + manual review only, OCR pipeline deferred indefinitely**
- OCR requires provider decision, async orchestration, failure handling — all unresolved
- Deferring OCR removes 6–8 weeks of contingent work
- Adding OCR later is straightforward (new service module, async queue)

**Q4 Decision: Department remains opaque string, no Department entity for MVP**
- Avoids new RBAC concern (department-scoped reads, manager relationships)
- Employees have `department` string attribute for grouping/filtering only
- If multi-org needed post-MVP, adding Department table is schema migration + service refactor

**Q5 Decision: Three-state deterministic rule for overallStatus**
- `compliant`: All required qualifications/medical current, no constraint violations
- `at_risk`: One or more expire within 30 days, or constraint flagged warning-level
- `non_compliant`: Any required qualification/medical expired OR constraint violated
- 30-day warning standard practice; rule-based and testable

**Q6 Decision: requiredTests informational only, no test subsystem**
- `requiredTests` is string/array on Standard; system does not enforce/track results
- Implementing test subsystem would add new domain to Phase 1 (test management, exam scheduling)
- Phase 2+ can add Test entity and attestation workflow without breaking MVP schema

**Q7 Decision: Single-organization only, no tenant isolation for MVP**
- Codebase reads as single-org; no `tenantId` or `organizationId` columns
- Multi-org would require schema changes, RBAC refactor, testing burden
- Post-MVP schema migration and API routes can be updated without breaking core logic

**Q8 Decision: In-app notifications only, email deferred to Phase 2+**
- In-app (list, mark-read, dismiss) quick to implement, proves trigger/delivery pattern
- Email requires SMTP, template management, email-specific testing
- For first demo and MVP users, in-app-only acceptable and faster to build

**All decisions unblock Phase 0 and Phase 1 without architectural debt.**

---

### Labels API Namespace (2026-03-14)

**By:** Bunk  
**Decision:** Namespace labels module under `/api/labels`

**Details:**
- Labels read paths grouped under `/api/labels/...`
- Labels admin operations under `/api/labels/admin/...`
- Label mapping creation under `/api/labels/mappings`
- Keeps module routing explicit, avoids overlap at API root
- Makes mount-path bugs easy to catch in tests

---

### Container-First Architecture for E-CLAT (2026-03-14)

**By:** Freamon  
**Decision:** Pivot from Azure App Service to **Azure Container Apps** as default runtime for local and Azure hosting.

**Layer Architecture:**
- **`00-foundation`**: Resource group, Key Vault, ACR (shared platform asset), Log Analytics workspace
- **`10-data`**: PostgreSQL, storage account, secrets to Key Vault
- **`20-compute`**: Replace App Service with Container Apps Environment + Container App resource

**Secret Handling Pattern:**
- API reads Key Vault secrets directly at startup using Azure SDK `DefaultAzureCredential`
- Expected runtime inputs: `KEY_VAULT_URI`, `DATABASE_URL_SECRET_NAME`, `JWT_SECRET_SECRET_NAME`
- Avoids init containers, Dapr, or preview Key Vault references
- Keeps secret values in Key Vault, not Terraform outputs or CI variables
- Supports local dev via `.env` files

**Identity & RBAC:**
- Container App system-assigned identity for Key Vault and Storage runtime access
- User-assigned managed identity for ACR pull (image pull permissions before app revision)
- GitHub OIDC deployment identity gets `AcrPush` on ACR

**Port & Delivery:**
- Keep existing `PORT` environment-variable contract; drop App Service-only settings
- Local dev: Docker / Compose
- PR workflows: code validation only
- Merge to main: container image build/push
- Infra deploy separate from image rollout
- MVP: use `az containerapp update` for rollout, keep Terraform for infrastructure

**Guardrails:**
- No AKS, Dapr, multi-container decomposition, or web/admin deployment for MVP
- Security constraints (no raw secrets, RBAC preferred, Private Link for backends)

---

### Container-First Hosting Directive (2026-03-14)

**By:** ivegamsft (via Copilot)  
**What:** Favor containers for local dev and Azure hosting. Use Azure Container Apps (not App Service). Ensure port overrides in code. Limit GitHub Actions builds.

---

### Terraform ACA Migration (2026-03-14)

**Owner:** Bunk  
**Context:** Platform is moving from App Service to Azure Container Apps. Infrastructure must add registry and observability, shift Key Vault to RBAC, and update compute to deploy containers.

**Decision:**
- Add Azure Container Registry, Log Analytics workspace, and ACR pull user-assigned identity to `00-foundation`
- Enable Key Vault RBAC; grant deployment identity `Key Vault Secrets Officer`
- Replace App Service resources in `20-compute` with Container App Environment and API Container App
- Use system-assigned managed identity for runtime RBAC (Key Vault secrets, storage access)
- Use user-assigned managed identity for ACR image pulls
- Pass Key Vault secret names (`DATABASE_URL_SECRET_NAME`, `JWT_SECRET_SECRET_NAME`) into container for runtime Key Vault resolution

**Consequences:**
- Downstream consumers must update foundation and compute outputs
- App Service-specific settings removed
- Runtime secret access now RBAC-only
- Container image lifecycle independent from infrastructure (image builds on CI, infra on merge)

---

### Workspace Runtime Artifacts (2026-03-14)

**Owner:** Bunk  
**Context:** Workspace packages consumed by the API at runtime must support container execution (compiled JavaScript only, no TypeScript).

**Decision:**
- Workspace packages that are runtime dependencies publish compiled `dist/` artifacts
- Update `main` and `types` fields in `package.json` to point to build outputs
- Docker builds clear stale TypeScript build-info before re-emitting `dist/` when `dist/` excluded from build context

**Consequences:**
- Shared workspace packages need a real build step (npm run build)
- Runtime images are production-only: compiled JS + package metadata + node_modules
- Container resolution depends on pre-built workspace artifacts (ships with image, not source)

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

### 2026-03-14T19:43:00Z: User directives — Infrastructure & team security rules
**By:** ivegamsft (via Copilot)

**What:**

1. **NO exposed connection strings.** All connection strings must go through Key Vault references — never as plain-text app settings, env vars in CI, or hardcoded values.
2. **RBAC only.** Use Azure RBAC (managed identity role assignments) for all service-to-service auth. No access keys, no shared secrets where RBAC is available.
3. **Private Link for non-public endpoints.** Any backend service that doesn't need public access (Postgres, Storage, Key Vault) must use Azure Private Link / private endpoints.
4. **DO NOT check in secrets.** No secrets, tokens, passwords, or connection strings in source control — ever. Use Key Vault, GitHub Secrets, or environment-scoped config.
5. **DO NOT expose local info in memories, commits, or decisions.** No local file paths, machine names, usernames, or environment-specific details in `.squad/` files, commit messages, or decision logs.
6. **Tests before user verification.** Agents must write and run tests to validate their changes before presenting results to the user. Do not ask the user to verify something you haven't tested yourself.

**Why:** User request — security and quality baseline for the project. These are non-negotiable rules for all team members.


### 2026-03-14T19:47:00Z: User directive — Secret definition scope
**By:** ivegamsft (via Copilot)

**What:** Secrets are defined as: passwords, tenant IDs, subscription IDs, usernames. Well-known public GUIDs are OK to commit/expose. Everything else that could be sensitive should use tokens (references, Key Vault refs, variable substitution) — never raw values.

**Why:** User request — tightens the definition of what counts as a secret for the team's no-secrets-in-source rule.

