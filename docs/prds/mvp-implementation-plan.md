# E-CLAT MVP Implementation Plan

> Owner mapping in this plan follows ivegamsft's requested split: **Bunk = backend**, **Kima = frontend**, **Sydnor = tests/quality**.

## 1. Current State Assessment

### Executive read
The codebase is a **contract-first skeleton**. The route layer, Zod validators, shared DTOs, and Prisma schema are in place, but the business layer is not. Today, the system can describe the product surface; it cannot yet execute the product workflows.

### What is real today
- `apps/api/src/` has Express routers and Zod validators for all 9 backend modules.
- `packages/shared/src/` provides shared DTOs, role hierarchy, and `AppError` classes.
- `data/prisma/schema.prisma` already models the core compliance domain: employees, standards, qualifications, documents, medical clearances, notifications, labels, hour conflicts, and audit logs.
- `apps/api/src/config/env.ts` validates runtime configuration with Zod.
- `apps/api/src/middleware/error-handler.ts` is real and usable.
- `data/package.json` already includes Prisma tooling and `data/src/seed.ts` exists as a placeholder.

### What is stubbed or missing
- **All backend service implementations are stubs** via `notImplemented()` and return 501 `NOT_IMPLEMENTED`.
- `apps/api/src/middleware/auth.ts` checks for a Bearer header but does **not** verify JWTs or populate `req.user`.
- The API does **not** instantiate or use Prisma anywhere.
- `tests/unit` and `tests/integration` are empty.
- `apps/web` and `apps/admin` are placeholders with echo-only scripts; no framework is selected.
- `infra/modules/compute`, `infra/modules/database`, and `infra/modules/storage` are Terraform TODO stubs.
- `data/src/seed.ts` contains comments only; no real seed data exists.

### Module-by-module implementation reality

| Module | Service file | Current reality |
| --- | --- | --- |
| Auth | `apps/api/src/modules/auth/service.ts` | `register`, `login`, `refreshToken`, `changePassword`, `oauthCallback` all call `notImplemented()` |
| Employees | `apps/api/src/modules/employees/service.ts` | `create`, `getById`, `update`, `list`, `getReadiness` all stubbed |
| Documents | `apps/api/src/modules/documents/service.ts` | `upload`, `getDocument`, `getExtraction`, `correctExtraction`, `reviewDocument`, `listReviewQueue`, `getAuditTrail` all stubbed |
| Hours | `apps/api/src/modules/hours/service.ts` | `clockIn`, `clockOut`, `submitManualEntry`, imports, conflict flows, edit/delete, audit all stubbed |
| Labels | `apps/api/src/modules/labels/service.ts` | CRUD, deprecate, mapping, resolve, audit all stubbed |
| Qualifications | `apps/api/src/modules/qualifications/service.ts` | CRUD, list, employee listing, audit, `checkCompliance` all stubbed |
| Medical | `apps/api/src/modules/medical/service.ts` | CRUD, employee list, audit all stubbed |
| Standards | `apps/api/src/modules/standards/service.ts` | standard CRUD and requirement CRUD/list all stubbed |
| Notifications | `apps/api/src/modules/notifications/service.ts` | preferences, list, mark-read, dismiss, digest, test notification, escalation rules all stubbed |

### Cross-cutting gaps
1. **Authentication is not real yet.** Any Bearer token can pass the current middleware shape.
2. **RBAC is only expressed at the route layer.** Ownership-aware reads and writes are not implemented.
3. **Audit logging is modeled, not enforced.** `AuditLog` exists in Prisma, but no persistence pattern exists in the API.
4. **Prisma is disconnected from the API.** The schema is useful, but no repository/service layer uses it.
5. **Shared type mapping is not solved.** Shared role/status values are lowercase strings while Prisma enums are uppercase, so service-layer mapping is required.
6. **Department modeling is incomplete.** `Employee.departmentId` exists without a corresponding department entity.

### Current structural issues to fix before implementation accelerates
- **Labels mount path bug:** `apps/api/src/index.ts` mounts the labels router at `/api` instead of `/api/labels`.
- **Documents route ordering bug:** `apps/api/src/modules/documents/router.ts` declares `GET /:id` before `GET /review-queue`, making the review queue unreachable.

### Tooling and readiness notes
- Root scripts exist for `test`, `typecheck`, `lint`, and `build`.
- In this checkout, the baseline `npm test` run fails immediately because workspace dependencies are not installed (`jest` is unavailable), and there are currently no tests anyway.
- The backend is best understood as **API contracts + schema + TODO infrastructure**, not as a partially working product.

## 2. Recommended MVP Scope Definition

### Recommended MVP outcome
Ship a secure, auditable workflow where an authenticated admin/compliance manager can:
1. sign in,
2. manage employees,
3. define compliance standards and requirements,
4. record employee qualifications and medical clearances,
5. view an explainable readiness/compliance state per employee.

That is enough to prove the product's core value proposition: **workforce compliance tracking with real auth, real persistence, real auditability, and role-scoped access**.

### What is IN the MVP
#### Core operational modules
1. **Employees** — workforce record, access scoping, readiness rollup surface.
2. **Qualifications** — core compliance evidence state and standards evaluation.
3. **Medical** — direct compliance signal that fits the current schema and is simpler than hours/documents.

#### Enabling module required for the above
4. **Standards** — authoritative compliance rules source for qualification and readiness logic.

#### Mandatory platform foundation
5. **Auth + RBAC + Prisma + audit logging + test harness**.

#### Minimal user interface
6. **A minimal admin app and minimal web app** that expose the working workflows, not a full product surface.

### Why this is the right MVP
- It demonstrates real compliance tracking without taking on the highest-risk integrations first.
- It uses the parts of the schema that are already coherent and relatively implementation-ready.
- It avoids the biggest unresolved semantics in the repo today: hour conflict resolution, label publishing/migration, OCR/classification orchestration, and escalation automation.
- It creates a reusable pattern for the remaining modules: Prisma repository shape, RBAC enforcement, audit logging, and state-transition testing.

### What is deliberately NOT required for the first MVP cut
- Hours capture/import/conflict workflows.
- Label taxonomy publishing and migration tooling.
- Full OCR/classification/extraction automation for documents.
- Digest/escalation background jobs.
- Rich reporting/export features.
- Full admin observability suite.
- Multi-tenant isolation.

## 3. Phased Implementation Plan

## Phase 0: Foundation
**Goal:** turn the skeleton into a secure, testable backend platform that can support regulated workflows.

| ID | Work item | Owner | Depends on | Risks / notes |
| --- | --- | --- | --- | --- |
| F0-1 | **Fix the known routing hazards immediately**: move labels to `/api/labels`, reorder document routes so `/review-queue` is defined before `/:id`, and add regression tests for both. | Bunk + Sydnor | None | Do this first so the contract surface stops drifting while implementation starts. |
| F0-2 | **Wire Prisma into the API**: add a shared Prisma client entry point, repository conventions, and the first real migration workflow between `data/` and `apps/api/`. | Bunk | None | Must resolve enum/DTO mapping and the missing department model before service work spreads. |
| F0-3 | **Complete auth data design**: add refresh token/session persistence, default admin seed data, password hashing rules, token TTL conventions, and logout/revocation behavior. | Bunk | F0-2 | Current schema has no refresh token/session model; this likely requires a schema change. |
| F0-4 | **Implement real auth and authorization helpers**: JWT verification in middleware, `req.user` population, role checks, and reusable ownership/team-scope helpers for service-layer enforcement. | Bunk | F0-2, F0-3 | Route-level guards are not enough in a compliance domain. Service-layer scope checks are mandatory. |
| F0-5 | **Create the audit logging pattern**: central helper for actor, entity, action, changed fields, reason, attestation, and timestamp; use it from every regulated mutation. | Bunk | F0-2 | Do not let each module invent its own audit shape. The pattern must be shared before Phase 1 starts. |
| F0-6 | **Build the execution baseline**: meaningful seed data, local/dev DB bootstrap, and root scripts that actually run in CI and locally. | Bunk | F0-2, F0-3 | Current seed script is placeholder-only; current checkout has no installed dependencies. |
| F0-7 | **Create the quality harness**: integration test setup, auth/RBAC tests, audit assertions, route-contract coverage, and CI gates that fail on missing meaningful coverage. | Sydnor | F0-1, F0-4, F0-5, F0-6 | The repo currently has zero tests; Phase 1 should not start without the harness. |
| F0-8 | **Finish minimum deployment infrastructure**: PostgreSQL, storage, secret wiring, and enough compute config to deploy the API for a demo environment. | Bunk | F0-2, F0-3 | Full production-grade Terraform can continue later, but demo-grade API infra should exist before frontend demo work. |

### Phase 0 exit criteria
- JWT auth is real.
- Prisma is live in the API.
- Audit writes are standardized.
- Routing bugs are fixed.
- Seed data and tests exist.
- A demo environment can host the API with DB + storage.

## Phase 1: Core Modules
**Goal:** deliver the smallest secure compliance workflow with explainable readiness.

### Recommended Phase 1 scope
- **Standards** (enabler)
- **Qualifications** (core compliance record)
- **Medical** (compliance status signal)
- **Employees** (readiness and access surface)

| ID | Work item | Owner | Depends on | Risks / notes |
| --- | --- | --- | --- | --- |
| P1-1 | **Standards CRUD + requirement management**: create/list/get/update standards; create/update/list requirements; add audit logging and version-conscious update rules. | Bunk | F0-2, F0-4, F0-5 | `requiredTests` is unresolved product scope; either park it behind validation rules or make it informational only for MVP. |
| P1-2 | **Qualification lifecycle v1**: Prisma-backed create/get/update/list/list-by-employee, state/date validation, evidence-link placeholders, and `checkCompliance()` against standards. | Bunk | P1-1, F0-5 | The gap engine must be explainable, not just boolean. Keep the first pass deterministic and rule-based. |
| P1-3 | **Medical lifecycle v1**: create/get/update/list-by-employee, legal status transitions, expiry evaluation, audit logging, and role-scoped reads. | Bunk | F0-2, F0-4, F0-5 | `clearanceType` is free text today; MVP should narrow it to an allowlist or documented reference set. |
| P1-4 | **Employees CRUD + row-level access**: admin create/update, scoped list/get, and readiness rollup using qualification and medical signals. | Bunk | P1-2, P1-3, F0-4, F0-5 | `Employee.departmentId` has no backing table. Either add `Department` now or intentionally demote `departmentId` to an opaque string for MVP. |
| P1-5 | **Readiness rules and UX-facing explanations**: define `compliant`, `at_risk`, and `non_compliant` based on clear qualification and medical rules, and return the reasons in the API response. | Bunk | P1-2, P1-3, P1-4 | This is a product rule, not just code. It must be documented and test-covered. |
| P1-6 | **Core module test matrix**: standards CRUD tests, qualification state-transition tests, medical expiry tests, employee scope tests, and readiness explainability tests. | Sydnor | P1-1 through P1-5 | This phase is not done until tests prove role scope and audit coverage. |

### Phase 1 exit criteria
- An admin can manage standards, employees, qualifications, and medical records.
- Qualification and medical state changes are auditable.
- Readiness is explainable for each employee.
- Non-admin users cannot read arbitrary employee or medical records.

## Phase 2: Supporting Modules
**Goal:** round out the MVP with the minimum evidence and communication capabilities that make the system usable.

### Recommended Phase 2 scope
- **Documents-lite** (manual evidence capture without full OCR pipeline)
- **Notifications-lite** (real domain-triggered reminders without full escalation engine)

| ID | Work item | Owner | Depends on | Risks / notes |
| --- | --- | --- | --- | --- |
| P2-1 | **Documents-lite foundation**: multipart upload, storage integration, `Document` persistence, review queue item creation, manual review decision, qualification linkage, and audit logging. | Bunk | F0-8, P1-2, P1-4 | Keep OCR/classification async pipeline out of the first cut. Fix route ordering before any document work begins. |
| P2-2 | **Notifications-lite foundation**: internal notification creation service, user preferences, list/mark-read/dismiss, and in-app + email delivery for qualification/medical/document triggers. | Bunk | P1-2, P1-3, P2-1 | Decide dismissal as soft dismiss, not hard delete. Validate `escalateToRole` against shared roles before adding admin rule management. |
| P2-3 | **Cross-module audit read surface**: expose a safe admin/compliance read path for audit history needed by the UI and by compliance review flows. | Bunk | F0-5, P1-1 through P2-2 | Be careful with PII exposure and pagination. Audit reads need role rules too. |
| P2-4 | **Supporting module quality pass**: document review tests, qualification-link tests, notification trigger tests, delivery fallback tests, and audit regression coverage. | Sydnor | P2-1 through P2-3 | Notifications are easy to fake. Test the trigger paths, not just CRUD. |

### Phase 2 exit criteria
- A document can be uploaded, reviewed, and linked to a qualification.
- Users receive real notifications on qualification/medical/document events.
- Audit history is reviewable by authorized roles.

## Phase 3: Frontend
**Goal:** make the MVP usable without trying to finish the whole product surface.

| ID | Work item | Owner | Depends on | Risks / notes |
| --- | --- | --- | --- | --- |
| P3-1 | **Select and scaffold the frontend stack** for both `apps/web` and `apps/admin`, with shared auth handling, route guards, API client, and shared status vocabulary. | Kima | F0-4, F0-6 | Do this once the auth contract is stable; avoid rework by locking API shapes first. |
| P3-2 | **Admin app MVP**: login, employee management, standards management, qualification/medical editing, and audit history views. | Kima | P1-1 through P1-5, P2-3 | This is the operational control plane for the MVP. Keep it function-first, not design-first. |
| P3-3 | **Web app MVP**: login, self-readiness dashboard, personal qualifications/medical view, notifications center, and document upload/status if Phase 2 lands. | Kima | P1-4, P1-5, P2-1, P2-2 | The web app only needs the flows required for the demo and the first real users. |
| P3-4 | **Frontend quality pass**: happy-path E2E flows, auth guard tests, readiness display checks, and accessibility smoke coverage. | Sydnor | P3-2, P3-3 | Focus on the few end-to-end flows that prove the MVP rather than broad UI coverage. |

### Phase 3 exit criteria
- An admin can operate the MVP without touching the database.
- An employee can sign in and understand their readiness state.
- The frontend uses the same status vocabulary and access rules as the API.

## 4. Issues & Risks

1. **Current auth middleware is insecure.** The API is not meaningfully protected until JWT verification is real.
2. **Shared DTO values and Prisma enums do not match directly.** A translation layer is required; otherwise status/role bugs will spread across modules.
3. **`Employee.departmentId` is modeled without a real department table.** Decide now whether to add `Department` or intentionally keep department as an opaque string in MVP.
4. **Readiness semantics are not defined.** `overallStatus` exists in the contract, but the actual rules are missing.
5. **`requiredTests` is underspecified.** Standards mention tests, but there is no test/exam subsystem. Treat it carefully or defer it explicitly.
6. **Document route ordering is broken today.** Do not build document features until this is corrected and test-covered.
7. **Labels route namespace is inconsistent today.** Fix it now even if labels are deferred, because it is a contract hygiene issue.
8. **Hours and labels are high-risk for MVP.** Conflict semantics, import normalization, and taxonomy version behavior are still open design work.
9. **Document OCR/provider choice is unresolved.** That is why the recommended MVP only includes documents-lite in Phase 2.
10. **Infrastructure is barely started.** If the team waits until the end to finish DB/storage/secret wiring, frontend and integration testing will slip.
11. **The repo has no real test baseline yet.** In a compliance product, that is not a polish issue; it is a release blocker.
12. **The current workspace is not bootstrapped.** Dependency installation and reproducible local setup need to become a first-day task for the team.

## 5. Deferred Scope

The following items should be explicitly deferred from the default MVP plan:

| Deferred item | Why it is deferred |
| --- | --- |
| Hours clock-in/out, payroll import, scheduling import, conflict resolution | Highest algorithmic ambiguity in the repo; large testing surface; not needed to prove the first compliance-tracking loop |
| Labels lifecycle, publishing, migration tooling | Valuable, but mainly needed once hours/import workflows are live |
| Full document OCR/classification/extraction pipeline | Requires provider choice, async orchestration, failure handling, and storage hardening |
| Weekly digests, escalations, batching jobs, SMS | Useful, but secondary to getting core domain state and auth correct |
| Invite-based onboarding, OAuth calendar sync | Valuable, but not needed for the first secure MVP cut |
| Reporting/export package | Better added once readiness semantics and audit views are stable |
| Multi-tenant/org isolation | The current codebase reads as single-org; do not partially implement tenancy |
| Rich audit explorer/observability suite | Keep audit persistence and a minimal read surface; full observability can come after MVP |
| `requiredTests` exam subsystem | No supporting entities or workflows exist yet |

## 6. Questions for ivegamsft

1. **What absolutely defines readiness for your first customer/demo?** Qualifications only, qualifications + medical, or must hours be part of the first usable release?
2. **Do you need document evidence in the MVP, or is manual qualification/medical data entry acceptable for the first cut?**
3. **If documents are in scope, do you need the full OCR/classification pipeline for MVP, or is upload + manual review enough?**
4. **Should `departmentId` become a real `Department` entity now, or can department remain an opaque string until after MVP?**
5. **How should `overallStatus` be calculated?** Example: is one expired qualification enough for `non_compliant`, and what should trigger `at_risk`?
6. **What should happen to `requiredTests` in standards for MVP?** Informational only, removed from the contract, or backed by a minimal test-attestation mechanism?
7. **Is this product single-organization for MVP, or do you expect tenant isolation early?**
8. **What notification channels matter for MVP?** In-app only, email + in-app, or more?

## 7. Recommendation in one line
Build **foundation first**, then ship **Employees + Standards + Qualifications + Medical** as the first secure compliance loop, then add **Documents-lite + Notifications-lite**, and leave **Hours/Labels/full OCR automation** for after the core workflow is proven.
