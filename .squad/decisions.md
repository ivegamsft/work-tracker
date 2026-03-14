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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
