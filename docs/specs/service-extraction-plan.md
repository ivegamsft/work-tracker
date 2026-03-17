# Service Extraction Plan — Reference Data & Notification Services

> **Status:** Architecture Design Spike  
> **Owner:** Freamon (Lead/Architect)  
> **Date:** 2026-03-20  
> **Applies To:** #28 [SA-07] Extract Reference Data and Notification services to separate runtimes  
> **Companion:** `docs/specs/event-contracts.md` (#29 [SA-08]), `docs/specs/service-architecture-spec.md` (Phase 2)

---

## 1. Executive Summary

This document designs the extraction of two low-coupling service groups—**Reference Data Service** and **Notification Service**—from the current monolithic API into separate, independently deployable runtimes. Reference Data (standards, labels, taxonomy) is read-heavy and self-contained. Notifications is cross-cutting but can be isolated behind command/event contracts. Both are P2 Phase 2 targets per the existing service architecture spec.

**Key outcomes:**
- Service boundary definitions and module groupings
- Prisma model ownership and partitioning strategy
- API contract proposals for inter-service communication
- Data access patterns (shared DB vs. separate schemas)
- Migration strategy using strangler fig pattern with feature flags
- Infrastructure (Terraform compute modules, Container Apps)
- Deployment and rollback considerations

---

## 2. Dependency Analysis & Extraction Order

### 2.1 Reference Data Service (Reference Data, Phase 2a)

**Current ownership in monolith:**
- Modules: `standards`, `labels` (two separate modules today; merge into Reference Data Service)
- Prisma models: `ComplianceStandard`, `StandardRequirement`, `Label`, `LabelMapping`, `TaxonomyVersion`

**Coupling audit:**
- **Inbound dependencies** (who reads Reference Data):
  - `qualifications` module: reads `ComplianceStandard`, `StandardRequirement` by ID for qualification context
  - `templates` module: reads `ComplianceStandard` for template creation and requirement matching
  - `hours` module: reads `Label` for hour categorization and taxonomy versioning
  - `documents` module: indirectly, through extraction/classification pipeline
  - `notifications` module: reads standards/labels for digest generation

- **Outbound dependencies**: None. Reference Data only reads from `Employee` (for audit context, minimal).

- **Data mutation scope**: Only CRUD operations (create, update, soft-delete); no cascades affecting other aggregates.

- **Write patterns**: Admin/Compliance Officer writes; all other roles are consumers.

**Extraction difficulty: ⭐ LOW** — Read-only for most consumers, no event-driven state, minimal temporal coupling.

---

### 2.2 Notification Service (Notification Service, Phase 2b)

**Current ownership in monolith:**
- Modules: `notifications` (single module; largely self-contained already)
- Prisma models: `Notification`, `NotificationPreference`, `EscalationRule`

**Coupling audit:**
- **Inbound dependencies** (who triggers notifications):
  - `qualifications` module: creates notifications on expiration, status change, review completion
  - `documents` module: creates notifications on review request, approval, rejection
  - `templates` module: creates notifications on assignment, fulfillment status
  - `hours` module: creates notifications on conflict flagging, resolution
  - `medical` module: creates notifications on clearance changes

- **Outbound dependencies**:
  - Reads `Employee` for user context (to send user-scoped notifications)
  - Reads `Qualification`, `Document`, `ProofFulfillment` for digest generation (cross-domain query)

- **Data mutation scope**: Creates `Notification` rows; updates `NotificationPreference` and `EscalationRule`.

- **Write patterns**: Event-triggered (currently direct service calls; after extraction, command-based).

**Extraction difficulty: ⭐⭐ MEDIUM** — Cross-cutting inbound triggers, requires command contracts and transactional guarantees.

---

### 2.3 Extraction Order Recommendation

**Recommended Phase 2 sequence:**
1. **Extract Reference Data Service first** (2a). It's cleanest: read-only, no events, no temporal coupling.
2. **Extract Notification Service second** (2b). Depends on event contracts (#29) being defined; requires strangler fig to handle dual-write during transition.

**Why not extract Records Service or Compliance Service first?**
- Records (`documents`, `hours`) has processing pipelines and worker logic; more complex.
- Compliance (`qualifications`, `medical`, `templates`) has high internal coupling and review workflows requiring careful state machine isolation.

---

## 3. Service Boundaries & Module Groupings

### 3.1 Reference Data Service

**Name:** `aca-reference-data-service`  
**Modules to extract:** `standards` + `labels`  
**New path prefix:** `/api/v1/reference`

**Routers consolidated:**
- `GET /api/v1/reference/standards` → List all active compliance standards
- `GET /api/v1/reference/standards/:id` → Fetch one standard + its requirements
- `GET /api/v1/reference/standards/:id/requirements` → List requirements for a standard
- `POST /api/v1/reference/standards` (Admin only) → Create new standard
- `PUT /api/v1/reference/standards/:id` (Admin only) → Update standard
- `DELETE /api/v1/reference/standards/:id` (Admin only, soft-delete) → Retire standard

- `GET /api/v1/reference/labels` → List all active labels
- `GET /api/v1/reference/labels/:id` → Fetch label + mappings
- `POST /api/v1/reference/labels` (Admin) → Create label
- `PUT /api/v1/reference/labels/:id` (Admin) → Update label
- `DELETE /api/v1/reference/labels/:id` (Admin, soft-delete) → Retire label

- `GET /api/v1/reference/taxonomy/versions` → List taxonomy versions
- `POST /api/v1/reference/taxonomy/versions` (Admin) → Publish new taxonomy version
- `GET /api/v1/reference/taxonomy/versions/:versionNumber/rules` → Migration rules for a version

**Exposed contract client:** See section 4.2.

---

### 3.2 Notification Service

**Name:** `aca-notification-service`  
**Modules to extract:** `notifications` (single module; no consolidation needed)  
**New path prefix:** `/api/v1/notifications`

**Routers consolidated:**
- `GET /api/v1/notifications/me` → Fetch my notifications (paginated)
- `GET /api/v1/notifications/:id` → Fetch one notification
- `PATCH /api/v1/notifications/:id/read` → Mark notification as read
- `DELETE /api/v1/notifications/:id` → Dismiss notification

- `GET /api/v1/notifications/preferences/me` → Fetch my notification preferences
- `PUT /api/v1/notifications/preferences` → Update my preferences (channels, frequency, types)

- `POST /api/v1/notifications/commands/send` (Internal, authenticated service) → Create notification (triggered by domain events)
- `POST /api/v1/notifications/commands/digest` (Internal) → Generate and send digest for a user
- `POST /api/v1/notifications/commands/escalate` (Internal) → Escalate an unacknowledged notification

**Exposed contract client:** See section 4.2.

---

## 4. API Contracts & Service Boundaries

### 4.1 Reference Data Service Contract

**Client package location:** `packages/shared/src/contracts/reference-data.ts`

```typescript
/**
 * Public interface for Reference Data Service.
 * Used by compliance, records, and notification services to fetch standards/labels.
 */

export interface ComplianceStandardSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  isActive: boolean;
}

export interface StandardRequirementSummary {
  id: string;
  category: string;
  description: string;
  minimumHours?: number;
  recertificationPeriodMonths?: number;
  requiredTests?: string[];
}

export interface LabelSummary {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "DEPRECATED";
  effectiveDate: Date;
  retirementDate?: Date;
}

export interface TaxonomyVersionInfo {
  versionNumber: number;
  changeLog: string;
  publishedAt?: Date;
}

/**
 * Reference Data Service Client — used by internal services.
 * In monolithic phase, this is a direct service call.
 * After extraction, this becomes an HTTP client with caching.
 */
export interface ReferenceDataClient {
  // Standards
  getStandardById(id: string): Promise<ComplianceStandardSummary | null>;
  listStandardsByIds(ids: string[]): Promise<ComplianceStandardSummary[]>;
  listActiveStandards(): Promise<ComplianceStandardSummary[]>;

  // Requirements
  getRequirementsByStandardId(standardId: string): Promise<StandardRequirementSummary[]>;
  getRequirementById(id: string): Promise<StandardRequirementSummary | null>;

  // Labels
  getLabelById(id: string): Promise<LabelSummary | null>;
  listActiveLabels(): Promise<LabelSummary[]>;

  // Taxonomy
  getCurrentTaxonomyVersion(): Promise<TaxonomyVersionInfo | null>;
  getTaxonomyVersionByNumber(versionNumber: number): Promise<TaxonomyVersionInfo | null>;
}
```

**Key behaviors:**
- All queries return cached summaries, not full Prisma models.
- No mutation methods exposed to consumers; only to internal admin routes.
- Service is **read-mostly**; caching at HTTP layer is acceptable (30-60 min TTL).
- Errors: `NotFoundError` only; no validation errors from consumers.

---

### 4.2 Notification Service Contract

**Client package location:** `packages/shared/src/contracts/notifications.ts`

```typescript
/**
 * Notification Service Contract — event/command based.
 * After extraction, notifications are triggered via events (see event-contracts.md).
 * During transition (strangler fig), both sync command calls and events are supported.
 */

export type NotificationStatus = "SENT" | "READ" | "DISMISSED";

export type NotificationType =
  | "QUALIFICATION_EXPIRING_SOON"
  | "QUALIFICATION_EXPIRED"
  | "QUALIFICATION_APPROVED"
  | "DOCUMENT_REVIEW_REQUESTED"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED"
  | "TEMPLATE_ASSIGNED"
  | "PROOF_FULFILLED"
  | "HOUR_CONFLICT_DETECTED"
  | "HOUR_CONFLICT_RESOLVED";

export interface NotificationCommand {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  deliveryChannel: "IN_APP" | "EMAIL" | "SMS";
  contextData?: Record<string, unknown>;
}

export interface NotificationPreferenceUpdate {
  notificationType: NotificationType;
  channels: ("IN_APP" | "EMAIL" | "SMS")[];
  isEnabled: boolean;
  frequency: "immediate" | "daily" | "weekly";
}

/**
 * Commands issued by domain services → Notification Service.
 * During monolithic phase: direct service calls.
 * After extraction: HTTP POST or async event via service bus.
 */
export interface NotificationCommandClient {
  // Send a single notification (synchronous)
  sendNotification(cmd: NotificationCommand): Promise<{ id: string }>;

  // Trigger digest generation for a user (async, returns immediately)
  triggerDigest(userId: string, options?: { digestType?: "daily" | "weekly" }): Promise<void>;

  // Escalate an unacknowledged notification after delay
  escalateNotification(notificationId: string, escalateToRole: string): Promise<void>;
}

/**
 * Internal service-to-service query interface.
 * Used by notification service to fetch context for digest/escalation.
 */
export interface NotificationQueryClient {
  getEmployeeSummary(employeeId: string): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null>;

  // These are fetched from other services via their contracts
  // (compliance service returns qualifications, records returns documents, etc.)
}
```

**Key behaviors:**
- **Synchronous API** for immediate notifications (approvals, rejections, assignments).
- **Asynchronous triggers** for digests and escalations (via events, backgrounded).
- **User preferences** scoped per user and notification type (channel selection, frequency).
- **Cross-domain context** fetched from other services' contract clients.

---

## 5. Prisma Model Ownership Matrix

### 5.1 Current state (shared database, monolithic ownership)

| Model | Current Owner | Read By | After Extraction Owner |
|-------|---|---|---|
| `ComplianceStandard` | monolith (standards module) | qualifications, templates, notifications | **Reference Data Service** |
| `StandardRequirement` | monolith (standards module) | qualifications, templates, documents | **Reference Data Service** |
| `Label` | monolith (labels module) | hours, documents | **Reference Data Service** |
| `LabelMapping` | monolith (labels module) | hours | **Reference Data Service** |
| `TaxonomyVersion` | monolith (labels module) | hours | **Reference Data Service** |
| `Notification` | monolith (notifications module) | web UI, notifications module | **Notification Service** |
| `NotificationPreference` | monolith (notifications module) | notifications module | **Notification Service** |
| `EscalationRule` | monolith (notifications module) | notifications module | **Notification Service** |

### 5.2 Model partitioning strategy

**During Phase 2 (shared database, but separated write ownership):**

The monolithic API and extracted services share the same PostgreSQL database. The Prisma schema remains in `data/prisma/schema.prisma`, but:

1. **Reference Data Service** becomes the **sole writer** to `ComplianceStandard`, `StandardRequirement`, `Label`, `LabelMapping`, `TaxonomyVersion`. The main API can still read, but all writes route through the Reference Data Service API contract.

2. **Notification Service** becomes the **sole writer** to `Notification`, `NotificationPreference`, `EscalationRule`. Other services create notifications by calling the Notification Service command contract, not by writing to the database directly.

3. **Main Workforce/Compliance/Records** runtimes become **consumers** via contract clients only; they no longer directly mutate these tables.

**Post-Phase 3 (optional, longer-term):**
- Move Reference Data and Notification tables to a dedicated schema or separate database.
- Update Prisma to use schema prefixing or separate client instances.
- No change needed to contracts; only internal plumbing changes.

---

## 6. Data Access Patterns

### 6.1 Reference Data Service (Read-Heavy)

**Write patterns:**
- Admin-only CRUD via HTTP API (`POST /api/v1/reference/standards`, etc.).
- Single point of mutation; no pub/sub or events.
- Audit logging: every write is logged to `AuditLog` table.

**Read patterns (consumers):**
- Compliance Service: fetch `ComplianceStandard` for qualification context (every create/update).
- Templates Service: fetch `ComplianceStandard` and `StandardRequirement` on template creation/linking.
- Hours/Records Service: fetch `Label` and `TaxonomyVersion` for hour categorization.
- Notifications Service: fetch standards for digest generation context.

**Caching strategy:**
- HTTP client caches summary views (30–60 min TTL).
- Cache invalidation: service clears cache on write, or client polls on cache miss.
- No cache consistency guarantees during Phase 2; acceptable for reference data (infrequently updated).

**Database access:**
- Shared PostgreSQL, same schema.
- Indexes on `code`, `status`, `isActive` (already present).

---

### 6.2 Notification Service (Event-Triggered)

**Write patterns:**
- Events from domain services (qualification expiry, document approval, etc.) trigger notification creation.
- Synchronous command API for critical notifications (e.g., document review required).
- Digest generation: async, triggered by event or scheduled.
- Escalation: async, triggered by timer/event after notification period.

**Read patterns:**
- End-user (Employee/Supervisor/Manager) reads own notifications via HTTP API.
- Admin queries notifications for user via HTTP API.
- Notification Service queries Employee, Qualification, Document, ProofFulfillment for digest context.

**Dual-write during transition (strangler fig):**
- **Phase 2a (transition):** Both monolithic and extracted Notification Service can create notifications. A feature flag controls which path is active (`notifications.use_extracted_service`). Readers see both.
- **Phase 2b (cutover):** Once extracted service is stable, stop creating notifications in monolithic API; all new notifications route through extracted service.
- **Rollback:** Feature flag allows instant switch back to monolithic path; no data migration.

**Database access:**
- Shared PostgreSQL, same schema.
- No cross-table joins in Notification Service; it owns the `Notification*` tables fully.

---

## 7. Communication Patterns

### 7.1 Reference Data Service (HTTP-only, read-focused)

**Monolithic → Reference Data:**
```
Qualifications.create(standard) 
  → calls ReferenceDataClient.getStandardById(standard.id) 
  → HTTP GET /api/v1/reference/standards/{id} 
  → caches response
```

**Behavior:**
- Synchronous HTTP (low latency; standard CRUD operations).
- Client-side circuit breaker: if Reference Data is down, fail open with cached value or error.
- No retry loop; let HTTP timeouts propagate to caller.

### 7.2 Notification Service (Event + Command)

**Domain → Notification (Phase 2a: both paths active):**

*Synchronous command path (strangler fig, dual-write):*
```
Qualifications.create() 
  → writes Qualification 
  → calls NotificationCommandClient.sendNotification(cmd) 
  → HTTP POST /api/v1/notifications/commands/send 
  → returns immediately with notification ID
```

*Asynchronous event path (eventual, after #29 contracts):*
```
Qualifications.create() 
  → writes Qualification 
  → publishes QualificationCreatedEvent to service bus 
  → Notification Service subscribes, consumes event 
  → creates Notification async
```

**Feature flag:** `notifications.use_extracted_service` gates which path is active.

**Behavior:**
- Synchronous is default (stricter semantics).
- Asynchronous is opt-in (better resilience, eventual consistency).
- Both can coexist during transition; readers see unified inbox.

---

## 8. Migration Strategy (Strangler Fig Pattern)

### 8.1 Phase 2a: Reference Data Service Extraction

**Step 1: Deploy standalone Reference Data Service (read-only mirror)**
- Extract `standards` and `labels` routers to new codebase at `services/reference-data-service/`.
- Reference Data Service reads from same PostgreSQL, same Prisma schema.
- Feature flag `reference_data.use_extracted_service` (default: false).
- Deploy as new Container App: `aca-reference-data-service`.

**Step 2: Route all Reference Data reads through contract client**
- Update Qualifications, Templates, Hours, Documents, Notifications services to use `ReferenceDataClient`.
- Client has conditional logic: if feature flag enabled, call HTTP; else call in-process service.
- Add integration tests: verify contract behavior across both paths.

**Step 3: Enable feature flag in staging**
- Test with real load.
- Verify caching and latency.
- Monitor error rates (circuit breaker, timeouts).

**Step 4: Promote to production**
- Enable feature flag for all environments.
- Operators can instantly disable if needed.

**Step 5: Decommission monolithic Reference Data routes (long-term)**
- Once feature flag is stable, remove in-process `standards` and `labels` routers from main API.
- Update CI/CD: stop building reference data routes in main API image.

**Rollback:** Flip feature flag to false → routes fall back to in-process service.

---

### 8.2 Phase 2b: Notification Service Extraction

**Step 1: Define event contracts (see #29)**
- Domain events: `QualificationExpiringEvent`, `DocumentApprovedEvent`, etc.
- Event schema, versioning, transport.

**Step 2: Deploy standalone Notification Service**
- Extract `notifications` routers to new codebase.
- Feature flag `notifications.use_extracted_service` (default: false).
- Deploy as new Container App.

**Step 3: Dual-write during transition**
- Update domain services (qualifications, documents, etc.) to:
  - Write Notification row directly (old path).
  - Call `NotificationCommandClient.sendNotification()` or publish event (new path).
  - Gate with feature flag.
- This ensures no notification loss during cutover.

**Step 4: Enable feature flag in staging**
- Test digest generation, escalation, preferences.
- Verify no duplicate notifications (both paths are active).

**Step 5: Promote to production with gradual rollout**
- Enable feature flag for subset of users (10%, 50%, 100%).
- Monitor duplicate notifications, missing notifications, latency.

**Step 6: Cutoff old path**
- Once stable, stop writing notifications in monolithic API.
- Delete old notification creation code.

**Rollback:** Flip feature flag to false → old path is used; no data loss.

---

## 9. Infrastructure & Deployment

### 9.1 Terraform changes

**New modules:**
```
infra/modules/
├─ compute-reference-data/    (new)
│  ├─ main.tf
│  ├─ variables.tf
│  └─ outputs.tf
└─ compute-notifications/     (new)
   ├─ main.tf
   ├─ variables.tf
   └─ outputs.tf
```

**Shared layers unchanged:**
- `00-foundation` (vnets, identity, key vault)
- `10-data` (PostgreSQL, Redis)
- `20-compute` (API container, initially; extracted services use new modules)

**New layer (optional, Phase 3+):**
- `30-services` (separate Container Apps for each service group)

### 9.2 Container Apps specifications

**Reference Data Service:**
- Name: `aca-reference-data-service`
- Image: `{registry}.azurecr.io/reference-data-service:latest`
- CPU: 0.5
- Memory: 512 Mi (lightweight, read-only)
- Replicas: 1–2
- Health endpoint: `GET /health`, `GET /ready`
- Config: `DATABASE_URL`, `LOG_LEVEL`, `CACHE_TTL`

**Notification Service:**
- Name: `aca-notification-service`
- Image: `{registry}.azurecr.io/notification-service:latest`
- CPU: 1.0
- Memory: 1 Gi (handles async jobs, pub/sub)
- Replicas: 1–2
- Health endpoint: `GET /health`, `GET /ready`
- Config: `DATABASE_URL`, `LOG_LEVEL`, `SERVICE_BUS_CONNECTION`, `CACHE_TTL`

**Networking:**
- Both services are internal (no public IP); accessed via ingress controller or private endpoints.
- Service-to-service via private DNS (Azure DNS, service discovery).
- Main API accesses via `http://aca-reference-data-service/api/v1/reference` (private link).

### 9.3 Database strategy

**Phase 2a & 2b (shared database):**
- Single PostgreSQL instance (already deployed).
- All tables remain in single schema.
- Service-level write separation via application logic (not DB-level roles yet).
- Migrations: continue to run from `data/prisma` CI step; affects all tables.

**Post-Phase 3 (optional, only if scaling demands):**
- Create separate Prisma schema for Reference Data and Notifications.
- Migrate tables to separate PostgreSQL schema within same instance.
- Deploy separate Prisma clients per service.
- Update migrations to be service-aware (CI runs only relevant migrations per service).

**No immediate change to backup/restore or disaster recovery.**

---

## 10. Monitoring & Observability

### 10.1 Metrics

**Reference Data Service:**
- HTTP request latency (p50, p95, p99).
- Cache hit ratio.
- Database query latency.
- Error rate (by endpoint).

**Notification Service:**
- Notification creation latency (sync path).
- Event ingestion latency (async path).
- Digest generation duration.
- Escalation rule trigger rate and latency.

**Cross-service:**
- Contract client circuit breaker state (open, closed).
- Timeout and retry counts.
- Feature flag activation rate.

### 10.2 Logging

- Structured logs: request ID, service name, user ID, action, duration, status.
- Audit logs: all writes to Reference Data and Notification tables.
- Error logs: include stack trace, input data (scrubbed), caller context.

### 10.3 Alerts

- **Reference Data Service:** downstream timeout > 5s, error rate > 1%.
- **Notification Service:** duplicate notifications (detected via event deduplication), missing notifications (delivery failure > 5 min).
- **Dual-write period:** mismatches between monolithic and extracted path (feature flag divergence).

---

## 11. Acceptance Criteria

- [ ] Reference Data Service contract defined in `packages/shared/src/contracts/reference-data.ts`
- [ ] Notification Service contract defined in `packages/shared/src/contracts/notifications.ts`
- [ ] Terraform modules `compute-reference-data` and `compute-notifications` created (stubs ok for spike)
- [ ] Feature flags `reference_data.use_extracted_service` and `notifications.use_extracted_service` scaffolded
- [ ] Dependency diagram showing module extraction and remaining monolith structure
- [ ] Migration plan documented with strangler fig phases and rollback strategy
- [ ] Database ownership matrix confirming single-writer per table
- [ ] Integration test strategy for dual-write validation during transition
- [ ] Monitoring and alert plan documented
- [ ] Service health endpoint design agreed

---

## 12. Open Questions & Next Steps

1. **Event transport for Notification Service:** Azure Service Bus or in-process pub/sub? (Addressed in #29.)
2. **Database schema separation timing:** When does it make sense to split Reference Data/Notification into separate schema? (Post-Phase 3 if load justifies.)
3. **Service-to-service authentication:** Use managed identity, shared API key, or JWT? (Recommend managed identity for Azure, documented in separate decision.)
4. **Caching layer:** Redis or HTTP client caching? (For Reference Data, propose HTTP client TTL + optional Redis layer Phase 3.)
5. **Read-side projections:** Does Notification Service need materialized views for digest generation? (Deferred to Phase 3+.)

---

## 13. Related Issues & Decisions

- **#28:** This document
- **#29:** Event contracts (companion spike)
- **#23 (SA-01):** Shared contract package structure
- **#24 (SA-02):** Repository interfaces (needed for service isolation)
- **#26 (SA-05):** Terraform compute module stubs (infrastructure support)
- **docs/specs/service-architecture-spec.md:** Phase 2 targets and overall architecture

---

**Approval:** Pending review from Bunk (backend), Daniels (infrastructure), Pearlman (compliance).  
**Next:** Create branch `squad/28-29-architecture-spikes`, write #29 event contracts spike, submit for PR review.
