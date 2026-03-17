# Phase 3: Implementation Execution Plan

**Document Status:** Phase 3 Execution Plan  
**Created:** 2026-03-21  
**Lead:** Freamon  
**Backlog Size:** 140 open issues (Phase 2 complete: 28 specs, 100+ implementation issues)  
**Team:** Bunk (backend), Kima (frontend), Daniels (infra), Pearlman (compliance), Sydnor (testing)

---

## 1. FOUNDATION SPRINT — Critical Path (Week 1-2)

**Objective:** Establish the observability, auth, and data access patterns that all other work depends on.

### Why Foundation First?
- **Observability:** Every feature must emit telemetry. Setup first enables shared infrastructure.
- **Auth/Identity:** RBAC enforcement is built into every request. Must be solid before templates/qualifications.
- **Data Layer:** Tenant resolution and repository pattern abstract storage; enables polyglot database path.
- **Templates Module:** Gateway to proof system; unblocks qualifications, medical, standards.

### Foundation Sprint Issues (5 critical paths)

| # | Issue | Domain | Agent | Dependencies | Done When |
|---|-------|--------|-------|--------------|-----------|
| **121** | Implement OTel SDK initialization & health endpoints | Observability | Bunk | None | `POST /api/v1/platform/health` returns dep status; span exporter configured |
| **126** | Structured logging & winston bridge to OTel | Observability | Bunk | #121 | Logger emits trace IDs; Winston bridge working in tests |
| **128** | OTel metrics emission: request latency & business events | Observability | Bunk | #121, #126 | Latency histogram + custom business counters emitted to collector |
| **134** | Identity provider registry CRUD & token validation abstraction | Identity | Bunk | None | `POST /api/v1/auth/identity-providers` works; JWT validator tests pass |
| **135** | Multi-IdP token validation with JWKS caching | Identity | Bunk | #134 | JWKS cache layer working; token validation tests for 2+ IdPs pass |
| **181** | Data Layer: Repository Pattern & Polyglot Store Abstraction | Data | Freamon | None | `IRepository<T>` interface + Prisma implementation; tenant context flowing |
| **183** | Data Layer: Tenant-Aware Connection Resolver (Key Vault integration) | Data | Freamon | #181 | Tenant claim → connection string resolver working; Key Vault reads in tests |
| **127** | Implement /api/v1/platform/health with dependency checks | Platform | Bunk | #121 | Health endpoint reports DB, cache, IdP status |

### Parallel Work in Foundation
- **Bunk:** Observability (#121, #126, #128) + Identity (#134, #135) + Health (#127) — 4-6 days
- **Freamon:** Data layer strategy (#181, #183) + repo pattern design — 3-4 days
- **Daniels:** Prepare observability IaC (ADX, App Insights) — parallel, not blocking

### Foundation Success Metrics
- ✅ All 8 endpoints implemented, 100% test coverage
- ✅ OTel spans flowing to collector in dev environment
- ✅ At least 2 JWKS providers validated
- ✅ Tenant context propagating through request lifecycle
- ✅ Zero secrets in code; Key Vault resolved

---

## 2. SPRINT ARCHITECTURE & DEPENDENCIES

### Dependency Map
```
Foundation (Observability + Identity + Data Layer)
  ├── Templates Module (issues #145, #147-#149, #184-#189, #191)
  │   ├── Qualification Engine (issues #102, #103, #169-#170, #203-#204)
  │   ├── Standards Customization (issues #182, #146, #156)
  │   └── Medical/Clearance (extends templates)
  ├── Multi-Tenancy (issues #172, #175, #179, #195-#206)
  ├── Event-Driven / Real-Time (issues #207-#210, #199-#202)
  └── Data Layer Polyglot (issues #212-#216)
```

### Issue Grouping by Sprint (Weeks 3-14)

---

## SPRINT 1: Templates Foundation (Week 3-4) — 18 issues
**Focus:** Core template CRUD, lifecycle, and industry catalog.  
**Why:** Templates → Qualifications → Standards → Proofs (critical path).

### Sprint 1 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **145** | Template CRUD with status lifecycle | Bunk | Prisma model + 6 endpoints (POST, GET /id, GET list, PATCH, DELETE, bulk) |
| **147** | Template publish workflow: submit → review → approve → publish | Bunk | Workflow state machine + audit trail; 4 endpoints |
| **148** | Template assignment engine (individual, group, role, rule-based) | Bunk | Assignment model, engine logic, 5 endpoints |
| **149** | Industry catalog & inheritance (OSHA, HIPAA templates) | Bunk | Seed 8-12 templates, inheritance chain validation |
| **184** | [Templates] Template Creation Wizard (5-step) | Kima | Form pages: Details → Questions → Requirements → Attestation → Review |
| **186** | [Templates] Industry Catalog Browser & Search | Kima | Filter/search by industry, compliance standard, role; card + detail views |
| **187** | [Templates] Assignment Wizard & Bulk Operations | Kima | Group selector, role rules, schedule, bulk upload CSV |
| **188** | [Templates] My Templates Page (Employee Side) | Kima | Assigned templates list, view in-progress proof submissions |
| **189** | [Templates] Version Control & Diff View | Kima | Template version history, side-by-side comparison of changes |
| **167** | Templates: Industry Catalog & Version Management | Freamon | Strategy + versioning contract |
| **165** | Templates: Lifecycle State Machine | Freamon | State diagram + allowed transitions |
| **191** | Templates: Group-Based Assignment and Inheritance | Freamon | Assignment rules engine design |
| **97** | [Track D] Spec: Template management strategy | (done) | — |
| **98** | [Track D] Spec: Template management API | (done) | — |
| **99** | [Track D] Spec: Template management UX | (done) | — |
| **100** | [Track D] Spec: Template governance | (done) | — |
| **150** | RBAC Matrix: Employees Module (6 test cases) | Sydnor | Tests: list, create, update, delete, bulk assign template |
| **152** | RBAC Matrix: Hours Module (7 test cases) | Sydnor | Tests: RBAC scoping for employee read, supervisor write, manager report |

**Parallel Lanes:**
- **Bunk:** Backend CRUD + assignment engine (4 days)
- **Kima:** Wizard flow + catalog UI (4 days)
- **Sydnor:** RBAC integration tests (2 days, run after Bunk endpoints exist)

**Success Metrics:**
- 18 endpoints live (`/api/v1/compliance/templates/*`)
- 100% endpoint coverage for templates
- 2 agent-assigned templates to test group
- Industry catalog loaded with ≥8 standards

---

## SPRINT 2: Qualifications Engine (Week 5-6) — 16 issues
**Focus:** Qualification customization layers and override model.

### Sprint 2 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **169** | Qualifications: Override Model (4 types) & Audit | Freamon | Design: EXPIRY_EXTENSION, PROOF_OVERRIDE, WAIVER, GRACE_PERIOD |
| **170** | Qualification override CRUD: exemption, waiver, extension, exception | Bunk | 5 endpoints: POST, GET /id, GET list, PATCH, DELETE |
| **102** | [Track E] Spec: Qualification API | (done) | — |
| **101** | [Track E] Spec: Qualification engine | (done) | — |
| **103** | [Track E] Spec: Standards customization | (done) | — |
| **104** | [Track E] Spec: Qualification test plan | (done) | — |
| **203** | Qualifications: Layered Customization (Org to Dept to Individual) | Freamon | Contract: strictest-wins composition, 3-level override hierarchy |
| **204** | Qualifications: L1-L4 Attestation Progression and Third-Party Invites | Freamon | Integrate with templates attestation levels; third-party invite flow |
| **173** | Override approval workflow with dual-approval for regulatory | Bunk | State machine + approval endpoints (request, approve, reject, comment) |
| **156** | Implement override expiration and annual review cycle workflow | Pearlman | Calendar-driven re-evaluation + audit record |
| **146** | Implement standards customization hierarchy and exemption authority matrix | Pearlman | RBAC for who can create/approve exemptions at org/dept/individual levels |
| **140** | Implement regulatory catalog alignment and quarterly updates | Pearlman | Quarterly review process, version bump, notification trigger |
| **182** | Standards → Requirements → Proofs composition & readiness score | Bunk | Scoring engine: roll up proof states to readiness % per requirement |
| **157** | RBAC Matrix: Qualifications & Medical Modules (10 test cases) | Sydnor | Tests: RBAC for read, override, approve across org/dept tiers |

**Parallel Lanes:**
- **Freamon:** Layered customization design (2 days)
- **Bunk:** Override CRUD + approval workflow (4 days)
- **Pearlman:** Compliance cycles + authority matrix (3 days)
- **Sydnor:** Integration RBAC tests (2 days)

**Success Metrics:**
- 12+ endpoints live (`/api/v1/compliance/qualifications/*`)
- Override model + approval workflow working
- Attestation progression tests: 10+ cases passing
- Readiness scoring accurate for test standards

---

## SPRINT 3: Proof System & Real-Time (Week 7-8) — 22 issues
**Focus:** Proof submission, attestation L1-L4, real-time notifications.

### Sprint 3 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **176** | Proof submission & attestation (L1-L4: self-attest, upload, third-party, validated) | Bunk | 8 endpoints: submit, approve, reject, validate, comment, get proof state |
| **180** | Proof review & approval queue (L4 validation) | Bunk | Queue model, reviewer assignment, bulk approval, audit trail |
| **110** | [Track G] Spec: Event-driven API | (done) | — |
| **111** | [Track G] Spec: Real-time UX | (done) | — |
| **112** | [Track G] Spec: Nudge compliance | (done) | — |
| **109** | [Track G] Spec: Event-driven IaC | (done) | — |
| **207** | Event bus abstraction with Service Bus and RabbitMQ adapters | Bunk | Abstract event handler registry, dual adapter support |
| **208** | Event handler registry and async processors | Bunk | Handler registration, async processor pool, dead-letter handling |
| **209** | Nudge system with rate limiting | Bunk | Nudge model, delivery queue, anti-harassment rate limiter |
| **210** | WebSocket hub for real-time presence and notifications | Bunk | SignalR integration, broadcast controller, presence tracking |
| **199** | [Real-Time] WebSocket Client & Presence Indicators | Kima | React hook for WebSocket, presence badge on employee cards |
| **200** | [Real-Time] Notification Center & Toast Notifications | Kima | Toast queue, notification panel, read/unread toggles |
| **201** | [Real-Time] Nudge Workflow & Action Buttons | Kima | Receive nudge message, action buttons (acknowledge, snooze, complete) |
| **202** | [Real-Time] Connection Status & Graceful Degradation | Kima | Connection indicator, fallback to polling, error recovery |
| **164** | Implement nudge system rate limiting and anti-harassment controls | Pearlman | Rules engine: max nudges/day/user, escalation limits, audit |
| **178** | Implement nudge as compliance evidence and constructive notice documentation | Pearlman | Nudge receipt = audit evidence; GDPR notice delivery confirmation |
| **190** | Implement notification consent management for GDPR/CCPA compliance | Pearlman | Consent preferences model, per-channel opt-out, audit log |
| **168** | [Telemetry] Telemetry Settings & Consent Audit | Kima | Settings UI: analytics consent, retention, export preferences |
| **166** | [Telemetry] Consent Manager & GDPR Compliance | Kima | Consent banner, revocation flow, GDPR copy |
| **163** | [Telemetry] Web Vitals & API Performance Monitoring | Kima | Web Vitals instrumentation, custom performance marks |
| **161** | [Telemetry] Page View & Form Timing Instrumentation | Kima | Page view tracking, form interaction timing |
| **144** | [Telemetry] TelemetryProvider & Error Boundary | Kima | React context + error boundary, error event capture |

**Parallel Lanes:**
- **Bunk:** Proof workflow (#176, #180) + Event bus (#207, #208, #209, #210) — 5 days
- **Kima:** Real-time UI (#199-#202) + telemetry UX (#163-#166, #168, #144) — 5 days
- **Pearlman:** Compliance rules (#164, #178, #190) — 2 days

**Success Metrics:**
- 15+ endpoints for proof submission and approval
- Event bus + handler registry working with ≥2 event types
- Real-time notifications flowing to ≥5 test clients
- Nudge rate limiter blocking >5/day, audit logged
- Consent preferences stored and respected

---

## SPRINT 4: Multi-Tenancy Foundation (Week 9-10) — 19 issues
**Focus:** Tenant hierarchy, tier isolation, and environment management.

### Sprint 4 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **105** | [Track F] Spec: Multi-tenant architecture | (done) | — |
| **106** | [Track F] Spec: Multi-tenant API | (done) | — |
| **107** | [Track F] Spec: Multi-tenant IaC | (done) | — |
| **108** | [Track F] Spec: Multi-tenant UX | (done) | — |
| **172** | Multi-Tenancy: Shared vs Dedicated Tier Isolation | Freamon | Design: row-level (shared) vs separate DB (dedicated); schema isolation |
| **175** | Multi-Tenancy: Tenant Hierarchy (L0→L3) & Environments | Freamon | Hierarchy design: platform → tenant → environment → workspace |
| **179** | Multi-Tenancy: Ring Deployment & Feature Flags (Canary→Beta→Stable) | Freamon | Ring strategy: tenant assignment to canary/beta/stable rings |
| **195** | Tenant model & CRUD with tier/region config | Bunk | Tenant Prisma model, 6 CRUD endpoints, region + tier fields |
| **197** | Environment management: create, configure, clone (dev/staging/prod) | Bunk | Environment model + clone logic, 7 endpoints for create/read/update/delete/clone |
| **205** | Group mapping: Azure AD groups to E-CLAT roles | Bunk | SCIM group sync, claim-driven role assignment, 3 endpoints |
| **206** | Cross-tenant admin dashboard and health metrics | Bunk | Dashboard endpoint: tenant count, active users, health per ring |
| **192** | [Admin] Admin Portal Shell & Tenant Dashboard | Kima | Shell layout, tenant selector, dashboard cards |
| **193** | [Admin] Environment Switcher & Multi-Env Dashboard | Kima | Env selector dropdown, per-env metrics (users, templates, qualifications) |
| **194** | [Admin] User Management & Invitation Flows | Kima | User table, invite form, role assignment modal |
| **196** | [Admin] Group Management & Claim-Driven Rules | Kima | Group table, SCIM sync status, rule editor |
| **129** | Implement multi-IdP compliance review and SCIM group sync audit | Pearlman | Audit trail for group membership changes, IdP sync events |
| **130** | Implement quarterly access certification workflow for SOX § 404 compliance | Pearlman | Periodic re-certification, manager signoff, exception approval |
| **138** | SCIM 2.0 backend provisioning from Azure AD | Bunk | SCIM endpoints, patch operations, deprovisioning logic |
| **159** | Identity: Multi-IdP Bootstrap & Tenant Creation | Freamon | First-user flow creates tenant + admin; IdP selection |

**Parallel Lanes:**
- **Freamon:** Multi-tenant architecture (#172, #175, #179, #159) — 3 days
- **Bunk:** Tenant/environment CRUD (#195, #197, #205, #206, #138) — 4 days
- **Kima:** Admin portal (#192-#196) — 4 days
- **Pearlman:** Compliance cycles (#129, #130) — 2 days

**Success Metrics:**
- Tenant hierarchy: ≥3-level nesting working, isolation verified
- Environment cloning: dev→staging, data masked correctly
- SCIM sync: ≥10 groups synced, membership changes audited
- Admin dashboard: real-time metrics for ≥5 tenants
- Access certification cycle: complete workflow for 2+ users

---

## SPRINT 5: Identity & Advanced Auth (Week 11-12) — 18 issues
**Focus:** Multi-IdP, profile isolation, B2B workflows.

### Sprint 5 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **159** | Identity: Multi-IdP Bootstrap & Tenant Creation | Freamon | First-user OAuth flow → tenant creation; IdP registry |
| **160** | Identity: B2B Invite Workflow (email-based invitation) | Freamon | Email template, token-based invite link, account creation flow |
| **162** | Identity: Profile Isolation & PII Encryption (semi-anonymous design) | Freamon | Profile model with encrypted PII, UUID-only business data, integration test |
| **137** | Linked identities & profile merge (email-anchored) | Bunk | Email-anchored profile discovery, merge logic, audit trail |
| **139** | Bulk user invite flow & B2B federated access | Bunk | CSV upload, async invite processing, email batch delivery |
| **123** | TF: Identity module — Entra SaaS app registration (multi-tenant) | Daniels | Terraform for app registration, manifest, reply URLs |
| **124** | TF: Identity module — SCIM service principal + provisioning setup | Daniels | Service principal, SCIM endpoint RBAC, Key Vault secrets |
| **125** | TF: Identity module — Conditional Access + Keycloak fallback | Daniels | Conditional Access policy, Keycloak as fallback, secret rotation |
| **95** | [Track C] Spec: Identity IaC | (done) | — |
| **93** | [Track C] Spec: Identity architecture | (done) | — |
| **94** | [Track C] Spec: Identity API | (done) | — |
| **96** | [Track C] Spec: Identity compliance | (done) | — |
| **122** | Implement GDPR data subject access request (SAR) export workflow | Pearlman | SAR handler, PII extraction, encryption for transit, cleanup |
| **158** | Security: Authorization, Injection & Audit Tests (27 cases) | Freamon | Test matrix: 27 auth/injection/audit scenarios across all modules |
| **160** | Identity: B2B Invite Workflow (email-based invitation) | Freamon | (see above) |
| **162** | Identity: Profile Isolation & PII Encryption (semi-anonymous design) | Freamon | (see above) |
| **159** | Identity: Multi-IdP Bootstrap & Tenant Creation | Freamon | (see above) |

**Parallel Lanes:**
- **Freamon:** Identity architecture (#159, #160, #162) + security tests (#158) — 4 days
- **Bunk:** Linked identities + bulk invite (#137, #139) — 3 days
- **Daniels:** Identity IaC (#123, #124, #125) — 3 days
- **Pearlman:** SAR workflow (#122) — 2 days

**Success Metrics:**
- Multi-IdP bootstrap: ≥2 IdPs (GitHub + Azure AD) working
- B2B invite: 10+ invites sent, recipients complete signup
- Profile isolation: PII encrypted end-to-end, business data UUID-only
- GDPR SAR: export generated in <5 minutes, all PII included
- Security tests: 27/27 passing, zero auth bypasses

---

## SPRINT 6: Data Layer Polyglot & Observability (Week 13-14) — 20 issues
**Focus:** Polyglot storage, migration path, observability infrastructure.

### Sprint 6 Issues

| # | Title | Assign | Work |
|---|-------|--------|------|
| **212** | Repository pattern interfaces: IRepository<T>, ITransaction, storage resolver | Freamon | Finalize polyglot contract, implementation registry |
| **213** | Polyglot storage adapters: Cosmos, Redis cache, Blob storage | Bunk | 3 adapters (MongoDB/Cosmos, Redis, Azure Blob), pass contract tests |
| **214** | Tenant-aware storage resolver and connection pooling | Bunk | Resolver: tenant claim → right store + pool, connection reuse |
| **215** | Service refactoring: template, qualification, document services to repository pattern | Bunk | Migrate 3 key services, zero breaking API changes |
| **216** | Event sourcing foundation and ADX telemetry repository | Bunk | Event log store, ADX query examples, telemetry landing |
| **185** | Data Layer: Polyglot Store Implementations | Freamon | Strategy: polyglot roadmap, SaaS vs on-prem store options |
| **114** | [Track H] Spec: Data layer API | (done) | — |
| **113** | [Track H] Spec: Data layer architecture | (done) | — |
| **115** | [Track H] Spec: Data layer IaC | (done) | — |
| **118** | TF: Observability module — App Insights + OTel Collector sidecar | Daniels | Container sidecar config, App Insights receiver, log aggregation |
| **116** | TF: Observability module — Log Analytics + ADX cluster | Daniels | Cluster provisioning, retention policy, RBAC setup |
| **119** | TF: ADX table schemas + lifecycle policies (7-year compliance) | Daniels | Table design for audit/telemetry, hot storage 1yr/warm 6yr/cold 7yr |
| **151** | TF: Data layer — PostgreSQL shared tier (B2s) + dedicated tier (D4s_v3) | Daniels | Shared B2s, dedicated D4s_v3 provisioning, connection string config |
| **153** | TF: Data layer — RLS policies + enforcement (tenant isolation at DB) | Daniels | Row-level security triggers, tenant claim enforcement, audit |
| **155** | TF: Data layer — Redis cache (shared Basic + dedicated Premium clusters) | Daniels | Shared Basic setup, dedicated Premium per tenant, connection pooling |
| **174** | TF: Data layer — Cosmos DB / MongoDB (document store, optional) | Daniels | Optional polyglot store, conditional provisioning, network config |
| **171** | TF: Data layer — Azure Storage (lifecycle: Hot → Cool → Archive) | Daniels | Blob storage with lifecycle policies, encryption at rest, RBAC |
| **177** | TF: Data layer — secret rotation (databases, Redis, Storage) via Key Vault | Daniels | Rotation schedule, Key Vault secret versioning, app restart logic |
| **90** | [Track B] Spec: API telemetry | (done) | — |
| **89** | [Track B] Spec: Monitoring & observability IaC | (done) | — |

**Parallel Lanes:**
- **Freamon:** Polyglot contract + strategy (#212, #185) — 2 days
- **Bunk:** Adapters + migration (#213, #214, #215, #216) — 5 days
- **Daniels:** Observability + data layer IaC (#118, #116, #119, #151, #153, #155, #174, #171, #177) — 6 days

**Success Metrics:**
- Polyglot contract: ≥3 adapter implementations passing contract tests
- Data layer migration: 3 services refactored, zero endpoint breaks
- Event sourcing: ≥100 events logged per day in ADX
- Observability: traces + metrics + logs flowing to App Insights
- RLS: tenant isolation verified at SQL level for ≥3 queries
- Storage lifecycle: 7-year compliance verified, cost optimization working

---

## 3. PARALLEL WORK: Testing & Documentation

### Testing (Sydnor) — Ongoing across all sprints
- **Unit tests:** 50+ added per sprint (target: 900 tests total by end)
- **Integration tests:** RBAC matrix completion (#150-#158)
- **E2E tests:** Happy path for each sprint's new workflows

### Documentation & Specs
- All 28 Phase 2 specs already complete
- Implementation docs: Each sprint adds API guide + UX screenshot guide
- Runbooks: Identity provisioning, multi-tenant onboarding, troubleshooting

---

## 4. RISK CALLOUTS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Observability delays testing** | Blocks proof that features work | Start #121-#128 immediately; telemetry optional for local dev |
| **SCIM sync failures** | Tenant onboarding stuck | Fallback to manual RBAC until SCIM rock-solid (#138, #205) |
| **Polyglot migration bugs** | Data loss on Cosmos adapter | Contract tests mandatory; staging validation before prod (#213-#215) |
| **Real-time scalability** | WebSocket hub overload at ≥100 clients | Load test early (#210), pre-plan signalR tier upgrade |
| **Multi-IdP token conflicts** | Auth bypass if IdP claims collide | Claim normalization test (#135, #158) mandatory before GA |
| **RLS row filtering bugs** | Tenant data leakage | RLS tests (#153) at schema level before any prod deployment |
| **Compliance audit gaps** | SOX/HIPAA audit failures | Pearlman reviews all audit trail changes before merge |

---

## 5. SUCCESS METRICS (Phase 3 Exit Criteria)

### Code Metrics
- **Endpoints:** 94 → 140+ live, all v1 migrated
- **Test count:** 415 → 900+ tests passing
- **Code coverage:** 65% → 80%+ for critical paths

### Functional Metrics
- **Templates:** ≥8 industry catalogs loaded, group assignment working
- **Qualifications:** 4-level attestation working, customization tiers tested
- **Proofs:** L1-L4 submission working, review queue functional
- **Real-time:** WebSocket connected clients broadcasting nudges, <200ms latency
- **Identity:** 2+ IdPs bootstrapped, B2B invites flowing
- **Multi-tenancy:** 3+ test tenants, isolation verified, RLS enforced
- **Data layer:** Repository pattern refactored, ≥1 polyglot adapter live

### Operational Metrics
- **Observability:** 100% request tracing, latency SLO <300ms p95
- **Compliance:** Audit trail logs all sensitive writes, GDPR SAR <5min
- **Security:** 27/27 security tests passing, zero OWASP Top 10 gaps
- **Performance:** Cold start <3s, steady-state p95 latency <200ms

### Team Metrics
- **Backlog burn:** 140 → ≤20 issues remaining
- **Velocity:** 28 issues/sprint (7-issue avg per agent)
- **Quality:** <2 bugs per 1000 LOC post-merge

---

## 6. AGENT ASSIGNMENT SUMMARY

| Agent | Primary Domains | Sprints 1-6 Issue Count |
|-------|-----------------|------------------------|
| **Bunk (backend)** | Templates, qualifications, proofs, event-driven, SCIM, data layer | 48 issues |
| **Kima (frontend)** | Template UX, admin portal, real-time UI, telemetry settings | 28 issues |
| **Daniels (infra)** | Identity IaC, data layer TF, observability, multi-tenant deployment | 21 issues |
| **Pearlman (compliance)** | Audit trails, regulatory cycles, nudge rules, GDPR SAR | 16 issues |
| **Freamon (lead)** | Architecture decisions, testing strategy, multi-tenant design | 12 issues |
| **Sydnor (testing)** | Integration tests, RBAC matrix, E2E happy paths | 8 issues |

---

## 7. HANDOFF TO SQUAD EXECUTION

**Next Steps (for Freamon + Squad):**
1. Create GitHub issue #217 (Phase 3 Execution Plan) with sprint breakdown
2. Label with `epic`, `squad:freamon`, `type:meta`
3. Link this plan document
4. Create 6 child sprint issues (#218-#223) with grouped issues
5. Start Foundation Sprint immediately (target: 2-week completion)
6. Hold weekly sync with squad leads (Bunk, Kima, Daniels, Pearlman, Sydnor)
7. Update progress board: move issues to "In Progress" → "Done" as completed

**Phase 3 Target:** 14 weeks (3.5 months), parallel execution, max parallelism in sprints.

---

**Document prepared by Freamon**  
**Date:** 2026-03-21  
**Status:** Ready for Squad Approval & Execution
