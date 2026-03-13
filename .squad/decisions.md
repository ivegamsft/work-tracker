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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
