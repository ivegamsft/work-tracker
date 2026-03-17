# Event Contracts Specification

> **Status:** Architecture Design Spike  
> **Owner:** Freamon (Lead/Architect)  
> **Date:** 2026-03-20  
> **Applies To:** #29 [SA-08] Introduce event contracts for notifications and document review lifecycle  
> **Companion:** `docs/specs/service-extraction-plan.md` (#28 [SA-07]), `docs/specs/service-architecture-spec.md` (Phase 2)

---

## 1. Executive Summary

This document defines the event schema, transport, and consumption contract for asynchronous communication between services. Primary use cases:

1. **Notification lifecycle events** — domain services publish when qualifications, documents, or templates change; Notification Service subscribes to create notifications, digests, and escalations.
2. **Document review lifecycle events** — Records Service publishes state changes; Compliance Service and web UI subscribe for updates.

Events enable **loose coupling** and **eventual consistency**, allowing services to evolve independently. Events are **versioned** and **schema-validated** to support contract-based testing.

**Key outcomes:**
- Unified event schema format (metadata + domain payload)
- Event registry for each domain (notifications, documents, templates, qualifications, hours, medical)
- Event versioning and compatibility rules
- Transport options (in-process pub/sub, Azure Service Bus)
- Consumer contracts and subscription patterns
- Event deduplication and ordering guarantees

---

## 2. Event Schema Design

### 2.1 CloudEvents-compatible format

We adopt a **subset of CloudEvents** (CNCF standard) for interoperability and tooling support. This allows future integration with Azure Event Grid, external webhooks, and event replay systems.

```typescript
/**
 * Base event envelope — all domain events follow this structure.
 * Conforms to CloudEvents 1.0 spec (https://cloudevents.io/).
 */
export interface DomainEvent<T = unknown> {
  // CloudEvents required fields
  specversion: "1.0"; // constant
  type: string; // e.g., "com.eclat.qualifications.qualification.created"
  source: string; // e.g., "aca-api/qualifications" or "aca-compliance-service/qualifications"
  id: string; // UUID, unique per event
  time: string; // ISO 8601 timestamp

  // CloudEvents optional extensions (used for domain context)
  subject?: string; // e.g., "qualifications/{qualificationId}" or "documents/{documentId}"
  datacontenttype: "application/json"; // always JSON
  dataschema?: string; // optional: URL to Zod schema
  

  // Custom domain extensions
  tenantid?: string; // future: multi-tenant support
  correlationid: string; // trace ID for request context
  causationid?: string; // ID of command that caused this event (for CQRS patterns)
  actor: string; // user ID or service ID that triggered the event

  // Domain event payload
  data: T;

  // Metadata
  version: number; // schema version (1, 2, 3...) for the event type
}

/**
 * Envelope helper and factory.
 */
export function createEvent<T>(
  type: string,
  data: T,
  context: {
    source: string; // "aca-api/qualifications", "aca-notification-service", etc.
    correlationId: string; // request trace ID
    actor: string; // user ID
    causationId?: string; // command ID that triggered this
    subject?: string; // e.g., "qualifications/uuid"
    version?: number; // defaults to 1
  }
): DomainEvent<T> {
  return {
    specversion: "1.0",
    type,
    source: context.source,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    subject: context.subject,
    datacontenttype: "application/json",
    correlationid: context.correlationId,
    actor: context.actor,
    causationid: context.causationId,
    data,
    version: context.version ?? 1,
  };
}
```

**Rationale:**
- **CloudEvents** is an industry standard (CNCF, widely adopted).
- **Required fields** (specversion, type, source, id, time) provide traceability and ordering.
- **Custom extensions** (correlationid, actor, causationid) support request tracing and CQRS patterns.
- **JSON payload** keeps schema validation straightforward (Zod).
- **Versioning field** enables backward-compatible schema evolution.

---

## 3. Event Registry & Types

### 3.1 Notification Lifecycle Events

**Source:** All domain services (qualifications, documents, templates, hours, medical).  
**Consumer:** Notification Service.  
**Transport:** Service Bus (queued) or in-process pub/sub.

#### 3.1.1 Qualification Events

```typescript
// Fired when qualification is created (approval pending)
export interface QualificationCreatedEvent {
  qualificationId: string;
  employeeId: string;
  standardId: string;
  standardName: string;
  certificationName: string;
  issueDate: string; // ISO 8601
  expirationDate?: string;
  issuingBody: string;
}
// type: "com.eclat.qualifications.qualification.created"
// version: 1

// Fired when qualification is approved
export interface QualificationApprovedEvent {
  qualificationId: string;
  employeeId: string;
  standardName: string;
  certificationName: string;
  approvedBy: string;
  approvedAt: string; // ISO 8601
}
// type: "com.eclat.qualifications.qualification.approved"
// version: 1

// Fired when qualification is approaching expiration
export interface QualificationExpiringEvent {
  qualificationId: string;
  employeeId: string;
  certificationName: string;
  standardName: string;
  expiresAt: string; // ISO 8601
  daysUntilExpiration: number;
}
// type: "com.eclat.qualifications.qualification.expiring_soon"
// version: 1

// Fired when qualification has expired
export interface QualificationExpiredEvent {
  qualificationId: string;
  employeeId: string;
  certificationName: string;
  standardName: string;
  expiredAt: string; // ISO 8601
}
// type: "com.eclat.qualifications.qualification.expired"
// version: 1

// Fired when qualification status changes (suspended, etc.)
export interface QualificationStatusChangedEvent {
  qualificationId: string;
  employeeId: string;
  certificationName: string;
  previousStatus: string; // "ACTIVE", "PENDING_REVIEW", "SUSPENDED"
  newStatus: string;
  changedBy: string;
  changedAt: string; // ISO 8601
  reason?: string;
}
// type: "com.eclat.qualifications.qualification.status_changed"
// version: 1
```

#### 3.1.2 Document & Review Events

```typescript
// Fired when document is uploaded
export interface DocumentUploadedEvent {
  documentId: string;
  employeeId: string;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string; // ISO 8601
}
// type: "com.eclat.documents.document.uploaded"
// version: 1

// Fired when document is classified
export interface DocumentClassifiedEvent {
  documentId: string;
  employeeId: string;
  classifiedType: string;
  detectedExpiration?: string; // ISO 8601
  confidence: number; // 0-100
  classifiedBy: string; // processor or AI service
  classifiedAt: string;
}
// type: "com.eclat.documents.document.classified"
// version: 1

// Fired when document is added to review queue
export interface ReviewRequestedEvent {
  reviewQueueItemId: string;
  documentId: string;
  employeeId: string;
  fileName: string;
  linkedQualificationId?: string;
  requestedBy: string;
  requestedAt: string; // ISO 8601
}
// type: "com.eclat.documents.review.requested"
// version: 1

// Fired when document review is completed (approved)
export interface ReviewApprovedEvent {
  reviewQueueItemId: string;
  documentId: string;
  employeeId: string;
  fileName: string;
  linkedQualificationId?: string;
  approvedBy: string;
  approvedAt: string; // ISO 8601
  notes?: string;
}
// type: "com.eclat.documents.review.approved"
// version: 1

// Fired when document review is rejected
export interface ReviewRejectedEvent {
  reviewQueueItemId: string;
  documentId: string;
  employeeId: string;
  fileName: string;
  linkedQualificationId?: string;
  rejectedBy: string;
  rejectedAt: string; // ISO 8601
  reason: string;
}
// type: "com.eclat.documents.review.rejected"
// version: 1
```

#### 3.1.3 Template & Fulfillment Events

```typescript
// Fired when template is assigned to an employee or role
export interface TemplateAssignedEvent {
  assignmentId: string;
  templateId: string;
  templateName: string;
  employeeId?: string; // null if assigned to role
  role?: string; // null if assigned to individual
  assignedBy: string;
  assignedAt: string; // ISO 8601
  dueDate?: string; // ISO 8601
}
// type: "com.eclat.templates.template.assigned"
// version: 1

// Fired when a proof requirement is fulfilled (any level)
export interface ProofFulfilledEvent {
  fulfillmentId: string;
  assignmentId: string;
  requirementId: string;
  employeeId: string;
  requirementName: string;
  attestationLevel: "SELF_ATTEST" | "UPLOAD" | "THIRD_PARTY" | "VALIDATED";
  fulfilledAt: string; // ISO 8601
}
// type: "com.eclat.templates.proof.fulfilled"
// version: 1

// Fired when fulfillment is validated
export interface ProofValidatedEvent {
  fulfillmentId: string;
  requirementName: string;
  employeeId: string;
  validatedBy: string;
  validatedAt: string; // ISO 8601
}
// type: "com.eclat.templates.proof.validated"
// version: 1

// Fired when fulfillment is rejected
export interface ProofRejectedEvent {
  fulfillmentId: string;
  requirementName: string;
  employeeId: string;
  rejectedBy: string;
  rejectedAt: string; // ISO 8601
  reason: string;
}
// type: "com.eclat.templates.proof.rejected"
// version: 1
```

#### 3.1.4 Hours & Medical Events

```typescript
// Fired when hour record is created
export interface HourRecordCreatedEvent {
  recordId: string;
  employeeId: string;
  date: string; // ISO 8601 date
  hours: number;
  source: string; // "CLOCK_IN_OUT", "TIMESHEET_IMPORT", etc.
  category?: string;
  createdAt: string;
}
// type: "com.eclat.hours.record.created"
// version: 1

// Fired when hour conflict is detected
export interface HourConflictDetectedEvent {
  conflictId: string;
  employeeId: string;
  conflictType: "DUPLICATE" | "MISMATCH";
  recordIds: string[];
  detectedAt: string; // ISO 8601
}
// type: "com.eclat.hours.conflict.detected"
// version: 1

// Fired when hour conflict is resolved
export interface HourConflictResolvedEvent {
  conflictId: string;
  employeeId: string;
  resolutionMethod: "PRECEDENCE" | "OVERRIDE" | "MERGE";
  resolvedBy: string;
  resolvedAt: string; // ISO 8601
}
// type: "com.eclat.hours.conflict.resolved"
// version: 1

// Fired when medical clearance is updated
export interface MedicalClearanceUpdatedEvent {
  clearanceId: string;
  employeeId: string;
  clearanceType: string;
  status: string; // "CLEARED", "RESTRICTED", "EXPIRED", etc.
  effectiveDate: string; // ISO 8601
  expirationDate?: string;
  updatedBy: string;
  updatedAt: string;
}
// type: "com.eclat.medical.clearance.updated"
// version: 1
```

---

### 3.2 Commands vs. Events Distinction

**Commands** are imperative, synchronous requests (e.g., "SendNotification", "EscalateAlert"). They have a single receiver and synchronous outcome.

**Events** are facts (asynchronous, fact-based), no return value expected, broadcast to multiple subscribers.

For notifications, we support both:

| Pattern | When to Use | Example |
|---------|---|---|
| **Synchronous Command** | Critical notifications, must not be lost, low latency acceptable | Document review requested (Manager must act soon) |
| **Asynchronous Event** | Eventual consistency acceptable, high volume, resilience needed | Qualification expiring (digest, no urgency) |
| **Feature flag dual-write** | Transition period (Phase 2b) | Both command + event published; Notification Service consumes both |

---

## 4. Event Versioning & Backward Compatibility

### 4.1 Versioning rules

Each event type has a `version` field. The system enforces:

1. **Forward compatibility:** Consumers must handle events with `version > expected`. Unknown fields are ignored.
2. **Backward compatibility:** Producers must not break old consumers. Adding optional fields is safe; removing or renaming required fields is a breaking change.

```typescript
// Version 1: Original event
export interface QualificationApprovedEvent {
  qualificationId: string;
  employeeId: string;
  standardName: string;
  certificationName: string;
  approvedBy: string;
  approvedAt: string;
}

// Version 2: Add optional field (backward compatible)
export interface QualificationApprovedEventV2 {
  qualificationId: string;
  employeeId: string;
  standardName: string;
  certificationName: string;
  approvedBy: string;
  approvedAt: string;
  expirationDate?: string; // NEW, optional
}

// Version 3: Remove optional field (consumer must handle missing)
// NOT a breaking change for consumers if they check for undefined.
```

### 4.2 Schema registry (proposed, Phase 2b)

For production use, maintain a schema registry:

```
services/reference-data-service/
├─ schemas/
│  ├─ qualification-approved-v1.json
│  ├─ qualification-approved-v2.json
│  └─ qualification-approved-v3.json
```

Consumers validate incoming events against the schema for their version. Producers register new versions before publishing.

**For MVP:** Zod schemas live in `packages/shared/src/events/`; no separate registry.

---

## 5. Event Transport & Persistence

### 5.1 Transport options

| Option | Latency | Reliability | Ordering | Deduplication | Cost | When to use |
|--------|---------|---|---|---|---|---|
| **In-process EventEmitter** | <1ms | No | No (if multiple listeners) | No | Free | MVP, monolithic phase |
| **Azure Service Bus Queues** | 100-500ms | Yes (built-in retry) | Per partition | Yes (session ID) | Moderate | Phase 2b, production |
| **Azure Event Grid** | 1-5s | Yes | No | Optional | Low-to-moderate | Future, webhooks/external integrations |
| **Redis Streams** | 10-100ms | Optional (persistence) | Yes (per stream) | No (application-level) | Low | Cache-friendly, intermediate option |

### 5.2 Recommended Phase 2b approach

**MVP (in-process):**
```typescript
// packages/shared/src/events/event-emitter.ts
export class DomainEventEmitter {
  private listeners: Map<string, ((event: DomainEvent) => Promise<void>)[]> = new Map();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  async emit(event: DomainEvent) {
    const handlers = this.listeners.get(event.type) ?? [];
    await Promise.allSettled(handlers.map(h => h(event)));
  }
}
```

**Production (Azure Service Bus):**
```typescript
// apps/api/src/common/event-emitter.ts (with feature flag)
export class DomainEventEmitter {
  constructor(
    private useServiceBus: boolean,
    private sbClient?: ServiceBusClient,
    private inProcessEmitter?: InProcessEmitter
  ) {}

  async emit(event: DomainEvent) {
    if (this.useServiceBus) {
      await this.emitToServiceBus(event);
    } else {
      await this.inProcessEmitter?.emit(event);
    }
  }
}
```

**Feature flag:** `events.transport` (values: `in_process`, `service_bus`).

---

### 5.3 Persistence & replay

**MVP:** No persistence. If Notification Service is down during Phase 2b, notifications are lost. Acceptable for pilot.

**Phase 3+:** 
- Azure Service Bus provides built-in persistence.
- Add event store (`EventLog` table in Prisma) for audit/replay.
- Implement event sourcing patterns if needed.

---

## 6. Consumer Contracts & Subscriptions

### 6.1 Subscription patterns

Each event type has one or more **subscriptions** defining how consumers handle it:

```typescript
/**
 * Subscription definition: event type + handler + policy.
 */
export interface EventSubscription {
  eventType: string; // e.g., "com.eclat.qualifications.qualification.approved"
  minVersion: number; // minimum schema version supported
  maxVersion: number; // maximum schema version supported
  handler: (event: DomainEvent) => Promise<void>;
  policy: {
    maxRetries: number;
    retryDelayMs: number;
    deadLetterOnFailure: boolean;
    timeout: number; // ms
  };
}
```

### 6.2 Notification Service subscriptions

```typescript
// services/notification-service/src/events/subscriptions.ts

export const notificationSubscriptions = [
  {
    eventType: "com.eclat.qualifications.qualification.created",
    minVersion: 1,
    maxVersion: 1,
    handler: onQualificationCreated,
    policy: { maxRetries: 3, retryDelayMs: 1000, deadLetterOnFailure: true, timeout: 5000 },
  },
  {
    eventType: "com.eclat.qualifications.qualification.approved",
    minVersion: 1,
    maxVersion: 1,
    handler: onQualificationApproved,
    policy: { maxRetries: 3, retryDelayMs: 1000, deadLetterOnFailure: true, timeout: 5000 },
  },
  {
    eventType: "com.eclat.qualifications.qualification.expiring_soon",
    minVersion: 1,
    maxVersion: 1,
    handler: onQualificationExpiringEvent,
    policy: { maxRetries: 3, retryDelayMs: 1000, deadLetterOnFailure: true, timeout: 5000 },
  },
  // ... more subscriptions
];

async function onQualificationCreated(event: DomainEvent<QualificationCreatedEvent>) {
  // Create notification: "Qualification submitted for review"
  await notificationService.sendNotification({
    userId: event.data.employeeId,
    type: "QUALIFICATION_SUBMITTED",
    title: `${event.data.certificationName} submitted`,
    message: `Your ${event.data.standardName} qualification is pending review.`,
    actionUrl: `/qualifications/${event.data.qualificationId}`,
    deliveryChannel: "IN_APP",
  });
}

// ... more handlers
```

### 6.3 Other subscribers

**Compliance Service** (future):
```typescript
export const complianceSubscriptions = [
  {
    eventType: "com.eclat.documents.review.approved",
    handler: onReviewApproved, // Link document to qualification
  },
  {
    eventType: "com.eclat.documents.review.rejected",
    handler: onReviewRejected, // Update qualification status
  },
];
```

**Web UI (via WebSocket or polling):**
```typescript
// apps/web/src/services/eventSubscriber.ts
// Subscribe to NotificationCreated → update UI inbox in real-time
```

---

## 7. Deduplication & Ordering Guarantees

### 7.1 Idempotency

Each event has a unique `id` (UUID). Consumers must be idempotent:

```typescript
// BAD: Not idempotent
async function onQualificationApproved(event: DomainEvent) {
  await prisma.notification.create({
    data: { ... },
  });
}
// If event is redelivered, duplicate notification is created.

// GOOD: Idempotent
async function onQualificationApproved(event: DomainEvent) {
  const existing = await prisma.notification.findUnique({
    where: { externalId: event.id }, // Store event.id
  });
  if (existing) return; // Already processed

  await prisma.notification.create({
    data: {
      externalId: event.id,
      ...
    },
  });
}
```

**Pattern:** Store `event.id` in consumer tables (`Notification.externalEventId`). Check before processing.

### 7.2 Ordering guarantees

- **In-process:** No ordering guarantee. Listeners are called concurrently.
- **Service Bus Queues:** Per-session ordering (use `correlationId` as session key).
- **Event Grid:** No ordering guarantee (designed for high-cardinality events).

**For Notifications,** ordering is not critical (eventual consistency). For state machines (like document review), use session-based ordering in Service Bus.

---

## 8. Error Handling & Dead-Letter Queues

### 8.1 Handler exceptions

If an event handler throws:

```typescript
async function onQualificationApproved(event: DomainEvent) {
  if (notificationServiceIsDown()) {
    throw new Error("Notification service unreachable");
  }
}
```

**Policy:**
1. **In-process:** Exception propagates; event is lost. Use try-catch + logging.
2. **Service Bus:** Automatic retry (exponential backoff, max 3x). If all retries fail, move to dead-letter queue.
3. **Monitoring:** Alert on dead-letter queue growth.

### 8.2 Dead-letter queue handling

```typescript
// Monitor dead-letter messages
const dlq = sbClient.createReceiver(topicName, subscriptionName, { subQueue: "deadLetter" });
const message = await dlq.receiveMessages(1);
if (message) {
  console.error("Dead-lettered event:", message.body);
  // Alert operator; may require manual replay after fix.
}
```

---

## 9. Event Registry & Documentation

### 9.1 Event catalog

Maintain a catalog of all event types, versions, and subscribers:

```
docs/events/event-catalog.md

| Event Type | Version | Producer | Subscribers | Schema | Status |
|---|---|---|---|---|---|
| com.eclat.qualifications.qualification.created | 1 | qualifications-service | notifications-service | QualificationCreatedEvent | GA |
| com.eclat.qualifications.qualification.approved | 1 | qualifications-service | notifications-service | QualificationApprovedEvent | GA |
| com.eclat.documents.review.requested | 1 | records-service | notifications-service, web-ui | ReviewRequestedEvent | GA |
| ... | ... | ... | ... | ... | ... |
```

**Rationale:** Single source of truth for cross-domain contracts.

### 9.2 Schema documentation

Each event is documented with:
- Field definitions
- Example payload
- Who produces it and when
- Expected subscribers and their actions

```typescript
/**
 * QUALIFICATION_APPROVED
 *
 * Fired when a qualification is approved by a Compliance Officer or Manager.
 *
 * Producers: qualifications-service
 * Subscribers: notifications-service, compliance-query-service (future)
 *
 * Example:
 * {
 *   "specversion": "1.0",
 *   "type": "com.eclat.qualifications.qualification.approved",
 *   "source": "aca-api/qualifications",
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "time": "2026-03-20T14:30:00Z",
 *   "actor": "user-456",
 *   "correlationid": "req-789",
 *   "subject": "qualifications/qual-123",
 *   "data": {
 *     "qualificationId": "qual-123",
 *     "employeeId": "emp-001",
 *     "standardName": "FAA Certification",
 *     "certificationName": "Commercial Pilot License",
 *     "approvedBy": "user-456",
 *     "approvedAt": "2026-03-20T14:30:00Z"
 *   },
 *   "version": 1
 * }
 */
export interface QualificationApprovedEvent {
  qualificationId: string; // UUID of the qualification
  employeeId: string; // UUID of the employee
  standardName: string; // Human-readable standard name
  certificationName: string; // Human-readable certification name
  approvedBy: string; // User ID of approver
  approvedAt: string; // ISO 8601 timestamp
}
```

---

## 10. Testing Strategy

### 10.1 Unit tests (event handlers)

```typescript
// services/notification-service/tests/unit/events/qualification-approved.test.ts

describe("onQualificationApproved", () => {
  it("creates notification when qualification is approved", async () => {
    const event = createEvent<QualificationApprovedEvent>(
      "com.eclat.qualifications.qualification.approved",
      {
        qualificationId: "qual-123",
        employeeId: "emp-001",
        standardName: "FAA Cert",
        certificationName: "CPL",
        approvedBy: "user-456",
        approvedAt: new Date().toISOString(),
      },
      { source: "aca-api/qualifications", correlationId: "test-1", actor: "test" }
    );

    await onQualificationApproved(event);

    const notification = await prisma.notification.findFirst({
      where: { externalEventId: event.id },
    });
    expect(notification).toBeTruthy();
    expect(notification.userId).toBe("emp-001");
  });

  it("is idempotent when event is replayed", async () => {
    const event = createEvent<QualificationApprovedEvent>(...);
    
    await onQualificationApproved(event);
    const notifCount1 = await prisma.notification.count({ where: { externalEventId: event.id } });
    
    await onQualificationApproved(event); // Replay
    const notifCount2 = await prisma.notification.count({ where: { externalEventId: event.id } });
    
    expect(notifCount1).toBe(notifCount2); // No duplicate
  });
});
```

### 10.2 Integration tests (event flow)

```typescript
// tests/integration/events.test.ts

describe("Qualification Approval Event Flow", () => {
  it("qualification approval triggers notification and email", async () => {
    // Arrange: Create a qualification in PENDING_REVIEW status
    const qual = await prisma.qualification.create({
      data: { ... },
    });

    // Act: Approve the qualification
    const response = await apiClient.put(`/api/v1/qualifications/${qual.id}`, {
      status: "ACTIVE",
    });

    // Assert: Event was emitted
    expect(response.status).toBe(200);
    await sleep(500); // Let async handlers complete

    // Check notification was created
    const notification = await prisma.notification.findFirst({
      where: { userId: qual.employeeId },
    });
    expect(notification).toBeTruthy();
  });
});
```

### 10.3 Contract tests

```typescript
// tests/contract/notification-service-qualifications.test.ts
// Ensures Notification Service can handle all qualification events

describe("Notification Service Contract — Qualifications", () => {
  it("handles QualificationCreatedEvent v1", async () => {
    const event = createEvent<QualificationCreatedEvent>(
      "com.eclat.qualifications.qualification.created",
      { /* valid data */ },
      { source: "aca-api/qualifications", correlationId: "test", actor: "test" }
    );

    await expect(notificationService.handleEvent(event)).resolves.not.toThrow();
  });

  it("rejects QualificationCreatedEvent with missing required fields", async () => {
    const event: DomainEvent<Partial<QualificationCreatedEvent>> = {
      ...createEvent("com.eclat.qualifications.qualification.created", {}, {...}),
      data: { qualificationId: "q1" }, // Missing employeeId, etc.
    };

    await expect(notificationService.handleEvent(event as any)).rejects.toThrow();
  });

  it("ignores QualificationCreatedEvent v99 (unknown future version)", async () => {
    const event = createEvent<QualificationCreatedEvent>(
      "com.eclat.qualifications.qualification.created",
      { /* valid v1 data */ },
      { source: "aca-api/qualifications", correlationId: "test", actor: "test", version: 99 }
    );

    // Should not throw; forward compatibility
    await expect(notificationService.handleEvent(event)).resolves.not.toThrow();
  });
});
```

---

## 11. Feature Flag Strategy (Phase 2b Dual-Write)

```typescript
// apps/api/src/modules/qualifications/service.ts

export class QualificationsService {
  async approveQualification(id: string, approvedBy: string) {
    // Write to database
    const qualification = await prisma.qualification.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    // Publish event (dual-path)
    const event = createEvent<QualificationApprovedEvent>(
      "com.eclat.qualifications.qualification.approved",
      {
        qualificationId: qualification.id,
        employeeId: qualification.employeeId,
        standardName: qualification.standard.name,
        certificationName: qualification.certificationName,
        approvedBy,
        approvedAt: new Date().toISOString(),
      },
      { source: "aca-api/qualifications", correlationId: req.id, actor: approvedBy }
    );

    // Path 1: In-process (old, monolithic)
    if (featureFlags.isEnabled("notifications.use_extracted_service")) {
      // New path: Event to service bus
      await eventEmitter.emit(event); // Service Bus
    } else {
      // Old path: Direct service call
      await notificationService.sendNotification({
        userId: qualification.employeeId,
        type: "QUALIFICATION_APPROVED",
        title: `${qualification.certificationName} approved`,
        message: `Your qualification has been approved.`,
        actionUrl: `/qualifications/${qualification.id}`,
        deliveryChannel: "IN_APP",
      });
    }
  }
}
```

---

## 12. Monitoring & Observability

### 12.1 Metrics to track

- **Event emission:** events/sec by type, latency (p50, p95, p99).
- **Event consumption:** lag (seconds behind producer), handler latency, error rate.
- **Dead letters:** queue depth, alerts on growth.
- **Idempotency:** duplicate detections (should be low).

### 12.2 Logs

```json
{
  "timestamp": "2026-03-20T14:30:00Z",
  "level": "INFO",
  "service": "notification-service",
  "action": "event_consumed",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "com.eclat.qualifications.qualification.approved",
  "correlationId": "req-789",
  "handler": "onQualificationApproved",
  "durationMs": 245,
  "result": "success"
}
```

### 12.3 Alerts

- Event handler error rate > 1% per type.
- Dead-letter queue depth > 10.
- Event consumption lag > 60s.
- Feature flag `events.transport` changed (audit).

---

## 13. Acceptance Criteria

- [ ] Event schema (CloudEvents subset) defined in `packages/shared/src/events/`
- [ ] Event types catalog for qualifications, documents, templates, hours, medical
- [ ] Zod schemas for each event payload type
- [ ] Event factory (`createEvent()`) helper implemented
- [ ] Subscription pattern and handler interface defined
- [ ] In-process EventEmitter implementation (MVP)
- [ ] Feature flag `events.transport` scaffolded (in-process vs. service-bus)
- [ ] Deduplication pattern (externalEventId storage) documented
- [ ] Contract test examples for notification handlers
- [ ] Event documentation template created
- [ ] Dead-letter queue strategy documented
- [ ] Monitoring/alerting strategy defined

---

## 14. Open Questions & Next Steps

1. **Schema Registry:** Do we need a separate schema registry (Avro, Protobuf), or is Zod + TypeScript sufficient? (Answer: TypeScript + Zod for MVP; consider external registry Phase 3+.)
2. **Encryption:** Should events be encrypted in transit and at rest? (Answer: TLS in transit; encryption at rest deferred to Phase 3+.)
3. **Event sourcing:** Should all state changes be events, or only triggers to external services? (Answer: Only cross-service triggers for MVP; full event sourcing Phase 4+.)
4. **Ordering guarantees:** For document review state machine, do we need strict ordering, or eventual consistency? (Answer: Eventual consistency acceptable; use correlation ID for tracing.)
5. **Webhook integration:** Should external systems (ISO auditors, insurance partners) subscribe to events? (Answer: Deferred to Phase 4+ as a separate contract.)

---

## 15. Related Issues & Decisions

- **#29:** This document
- **#28:** Service extraction plan (companion)
- **#23 (SA-01):** Shared contracts package
- **#24 (SA-02):** Repository interfaces
- **#26 (SA-05):** Terraform stubs
- **docs/specs/service-architecture-spec.md:** Overall Phase 2 strategy

---

**Approval:** Pending review from Bunk (backend), Pearlman (compliance).  
**Next:** Integrate with #28 service-extraction-plan, create branch, submit PR.
