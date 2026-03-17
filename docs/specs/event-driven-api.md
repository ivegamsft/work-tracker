# Event-Driven API & Real-Time Hub — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #110  
> **Applies To:** `apps/api` (event bus, WebSocket hub), `apps/web` (real-time subscriptions), Docker (RabbitMQ/Azure Service Bus)  
> **Related Decisions:** Decision 9 (Event-driven + WebSocket)  
> **Companion Docs:** [Service Architecture](./service-architecture-spec.md) · [API Telemetry](./api-telemetry.md)

---

## 1. Problem Statement

E-CLAT needs **event-driven architecture** for real-time collaboration and workflow automation:

1. **No event bus** — State changes (template published, proof submitted) only known to direct API caller
2. **No real-time notifications** — Employees don't know when assignment added; must refresh page
3. **No async workflows** — Complex multi-step processes (approval, email, audit) block HTTP response
4. **No workflow automation** — Rules engine cannot trigger based on events
5. **No cross-module communication** — Modules tightly coupled via DB queries only
6. **No presence tracking** — Cannot see who's online, viewing what
7. **No feature flag runtime evaluation** — Feature flags require restart

**Impact:** Poor UX (no real-time updates); blocking workflows; cannot automate compliance tasks; feature rollout manual.

---

## 2. Solution Overview

Implement **event-driven architecture with WebSocket real-time hub**:

- **Event bus abstraction** — Publish/subscribe interface hiding Service Bus (Azure) and RabbitMQ (on-prem)
- **Event catalog** — Documented event types with schemas
- **Async processors** — Event handlers run async; don't block HTTP response
- **WebSocket hub** — Real-time subscriptions for presence, notifications, template updates
- **Nudge system** — Prompt users to complete tasks (templates, proofs)
- **Feature flags** — Runtime-evaluated; no restart required
- **Event sourcing foundation** — Future: build event store for compliance audit trail

---

## 3. API Endpoints

### 3.1 Event Bus Management (Admin)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/platform/events/types` | GET | List event types |
| `GET /api/v1/platform/events/subscriptions` | GET | List active subscriptions |
| `POST /api/v1/platform/events/publish-test` | POST | Publish test event (admin only) |

**`GET /api/v1/platform/events/types`**

Response:

```json
{
  "event_types": [
    {
      "name": "template.published",
      "description": "Template moved to published status",
      "schema": {
        "template_id": "uuid",
        "version": "number",
        "published_by": "uuid",
        "published_at": "datetime"
      },
      "handlers": [
        "assign_to_employees",
        "send_notification",
        "log_audit"
      ]
    },
    {
      "name": "proof.submitted",
      "description": "Employee submitted proof",
      "schema": {
        "proof_id": "uuid",
        "assignment_id": "uuid",
        "employee_id": "uuid",
        "attestation_level": "string",
        "submitted_at": "datetime"
      },
      "handlers": [
        "create_review_item",
        "send_reviewer_nudge",
        "log_audit"
      ]
    }
  ]
}
```

### 3.2 WebSocket Hub

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `ws://api.example.com/hubs/presence` | WebSocket | User presence + online status |
| `ws://api.example.com/hubs/notifications` | WebSocket | Real-time notifications |

**`ws://api.example.com/hubs/presence` (Client subscribes)**

**Connection Setup:**

```
GET /hubs/presence?token={jwt} HTTP/1.1
Upgrade: websocket
Connection: Upgrade
```

**Server → Client (User came online):**

```json
{
  "type": "presence.user_online",
  "user_id": "user_001",
  "name": "John Doe",
  "role": "SUPERVISOR",
  "timestamp": "2026-03-21T10:30:45Z"
}
```

**Server → Client (User viewing template):**

```json
{
  "type": "presence.user_viewing",
  "user_id": "user_001",
  "resource_type": "template",
  "resource_id": "template_abc123",
  "timestamp": "2026-03-21T10:30:45Z"
}
```

**Client → Server (Heartbeat every 30s):**

```json
{
  "type": "presence.heartbeat",
  "user_id": "user_001",
  "timestamp": "2026-03-21T10:30:45Z"
}
```

**`ws://api.example.com/hubs/notifications` (Client subscribes)**

**Server → Client (Notification received):**

```json
{
  "type": "notification.new",
  "id": "notif_xyz789",
  "user_id": "user_001",
  "title": "Template Assignment",
  "body": "You've been assigned OSHA 10-Hour training",
  "action_type": "open_assignment",
  "action_data": {
    "assignment_id": "assign_001"
  },
  "timestamp": "2026-03-21T10:30:45Z"
}
```

**Client → Server (Mark notification as read):**

```json
{
  "type": "notification.read",
  "notification_id": "notif_xyz789"
}
```

### 3.3 Nudge System

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/notifications/nudges` | POST | Create nudge |
| `GET /api/v1/notifications/nudges` | GET | List nudges for current user |
| `POST /api/v1/notifications/nudges/:nudgeId/acknowledge` | POST | Acknowledge nudge (user saw it) |
| `DELETE /api/v1/notifications/nudges/:nudgeId` | DELETE | Dismiss nudge |

**`POST /api/v1/notifications/nudges` (Create nudge for overdue assignment)**

```json
{
  "recipient_id": "emp_001",
  "nudge_type": "overdue_assignment",
  "title": "Action Required: OSHA Training Due Soon",
  "message": "You have 3 days to complete your assigned OSHA 10-Hour training",
  "action_url": "/assignments/assign_001",
  "priority": "high",
  "expires_at": "2026-04-21T23:59:59Z",
  "rate_limit_key": "assignment_assign_001"
}
```

**Response:**

```json
{
  "id": "nudge_abc123",
  "recipient_id": "emp_001",
  "nudge_type": "overdue_assignment",
  "title": "Action Required: OSHA Training Due Soon",
  "created_at": "2026-03-21T10:30:45Z",
  "acknowledged_at": null,
  "dismissed_at": null,
  "expires_at": "2026-04-21T23:59:59Z"
}
```

**`GET /api/v1/notifications/nudges` (List nudges)**

Query params: `status=active`, `limit=10`

Response:

```json
{
  "total": 45,
  "nudges": [
    {
      "id": "nudge_abc123",
      "nudge_type": "overdue_assignment",
      "title": "Action Required: OSHA Training Due Soon",
      "created_at": "2026-03-21T10:30:45Z",
      "acknowledged": false,
      "priority": "high"
    }
  ]
}
```

### 3.4 Feature Flags

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/platform/feature-flags` | GET | List all feature flags (admin) |
| `POST /api/v1/platform/feature-flags` | POST | Create flag |
| `PUT /api/v1/platform/feature-flags/:flagName` | PUT | Update flag |
| `POST /api/v1/platform/feature-flags/:flagName/evaluate` | POST | Evaluate flag for user |
| `DELETE /api/v1/platform/feature-flags/:flagName` | DELETE | Delete flag |

**`POST /api/v1/platform/feature-flags` (Create flag)**

```json
{
  "name": "advanced_reporting",
  "description": "Enable advanced compliance reporting",
  "type": "boolean",
  "default_value": false,
  "rollout_percentage": 25,
  "enabled": true,
  "rules": [
    {
      "condition": {
        "attribute": "tier",
        "operator": "equals",
        "value": "enterprise"
      },
      "value": true
    }
  ]
}
```

**Response:**

```json
{
  "id": "flag_reporting_001",
  "name": "advanced_reporting",
  "type": "boolean",
  "default_value": false,
  "rollout_percentage": 25,
  "enabled": true,
  "created_at": "2026-03-21T10:30:45Z",
  "updated_at": "2026-03-21T10:30:45Z"
}
```

**`POST /api/v1/platform/feature-flags/advanced_reporting/evaluate`**

```json
{
  "user_id": "user_001",
  "attributes": {
    "tier": "enterprise",
    "region": "us-east-1"
  }
}
```

**Response:**

```json
{
  "flag_name": "advanced_reporting",
  "enabled": true,
  "evaluated_at": "2026-03-21T10:30:45Z",
  "reason": "Matched rule: tier=enterprise"
}
```

---

## 4. Event Types Catalog

| Event Name | Trigger | Payload | Handlers |
|---|---|---|---|
| `template.created` | Manager creates template | `{ template_id, name, created_by, ... }` | audit_log |
| `template.submitted_for_review` | Template submitted for approval | `{ template_id, submitted_by, reviewers, ... }` | notify_reviewers |
| `template.published` | Compliance officer publishes template | `{ template_id, version, published_by, ... }` | assign_to_employees, notify_managers |
| `template.archived` | Template archived | `{ template_id, archived_by, reason, ... }` | notify_stakeholders |
| `assignment.created` | Template assigned to employee | `{ assignment_id, employee_id, template_id, ... }` | create_notification, send_email |
| `proof.submitted` | Employee submits proof | `{ proof_id, employee_id, attestation_level, ... }` | create_review_item, notify_reviewers |
| `proof.approved` | Reviewer approves proof | `{ proof_id, approved_by, ... }` | send_confirmation, update_readiness |
| `proof.rejected` | Reviewer rejects proof | `{ proof_id, rejected_by, reason, ... }` | notify_employee, create_nudge |
| `override.created` | Override created | `{ override_id, type, requested_by, ... }` | notify_approvers |
| `override.approved` | Override approved | `{ override_id, approved_by, ... }` | update_qualification |
| `employee.hired` | New employee provisioned | `{ employee_id, start_date, department, ... }` | assign_onboarding_templates |
| `employee.role_changed` | Employee role changes | `{ employee_id, new_role, old_role, ... }` | reevaluate_assignment_rules |
| `employee.offboarded` | Employee marked inactive | `{ employee_id, offboard_date, ... }` | archive_assignments |
| `audit.event_created` | Audit log entry created | `{ audit_id, action, actor, resource, ... }` | stream_to_adx, notify_compliance |

---

## 5. Validation Schemas (Zod)

```typescript
// apps/api/src/modules/events/validators.ts

import { z } from 'zod';

export const eventTypeSchema = z.enum([
  'template.created',
  'template.submitted_for_review',
  'template.published',
  'template.archived',
  'assignment.created',
  'proof.submitted',
  'proof.approved',
  'proof.rejected',
  'override.created',
  'override.approved',
  'employee.hired',
  'employee.role_changed',
  'employee.offboarded',
  'audit.event_created',
]);

export const eventSchema = z.object({
  id: z.string().uuid(),
  type: eventTypeSchema,
  tenantId: z.string().uuid(),
  correlationId: z.string(),
  timestamp: z.string().datetime(),
  actor: z.object({
    user_id: z.string().uuid(),
    role: z.string(),
  }),
  data: z.record(z.any()),
  metadata: z.object({
    source: z.string(), // api, job, webhook, etc.
    version: z.string().default('1.0'),
  }).optional(),
});

export const nudgeCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  nudge_type: z.string(),
  title: z.string().min(1).max(200),
  message: z.string().max(500),
  action_url: z.string().url(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  expires_at: z.string().datetime().optional(),
  rate_limit_key: z.string().optional(),
});

export const featureFlagSchema = z.object({
  name: z.string().regex(/^[a-z_]+$/),
  description: z.string().optional(),
  type: z.enum(['boolean', 'string', 'percentage']).default('boolean'),
  default_value: z.any(),
  rollout_percentage: z.number().int().min(0).max(100).default(100),
  enabled: z.boolean().default(true),
  rules: z.array(z.object({
    condition: z.object({
      attribute: z.string(),
      operator: z.enum(['equals', 'contains', 'in', 'gt', 'lt']),
      value: z.any(),
    }),
    value: z.any(),
  })).optional(),
});

export const featureFlagEvaluationSchema = z.object({
  user_id: z.string().uuid(),
  attributes: z.record(z.any()),
});

export type Event = z.infer<typeof eventSchema>;
export type NudgeCreate = z.infer<typeof nudgeCreateSchema>;
export type FeatureFlagEvaluation = z.infer<typeof featureFlagEvaluationSchema>;
```

---

## 6. Data Model Changes (Prisma)

```prisma
// data/prisma/schema.prisma

model Event {
  id              String   @id @default(uuid())
  tenantId        String
  
  type            String   // template.published, proof.submitted, etc.
  correlationId   String   // trace correlation
  
  timestamp       DateTime @default(now())
  
  actor           Json     // { user_id, role }
  data            Json     // Event-specific payload
  metadata        Json?    // { source, version }
  
  publishedAt     DateTime?
  processedAt     DateTime?
  
  @@index([tenantId, type, timestamp])
  @@index([correlationId])
}

model Nudge {
  id              String   @id @default(uuid())
  tenantId        String
  recipientId     String
  
  nudgeType       String
  title           String
  message         String
  actionUrl       String?
  priority        String   @default("normal")
  
  createdAt       DateTime @default(now())
  acknowledgedAt  DateTime?
  dismissedAt     DateTime?
  expiresAt       DateTime?
  
  rateLimitKey    String?
  
  @@index([tenantId, recipientId])
  @@index([expiresAt])
}

model FeatureFlag {
  id              String   @id @default(uuid())
  name            String   @unique
  description     String?
  
  type            String   @default("boolean")
  defaultValue    Json
  rolloutPercentage Int   @default(100)
  
  enabled         Boolean  @default(true)
  rules           Json?    // Array of { condition, value }
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([enabled])
}

model WebSocketSession {
  id              String   @id @default(uuid())
  tenantId        String
  userId          String
  
  connectionId    String   @unique
  hubType         String   // presence, notifications
  
  connectedAt     DateTime @default(now())
  disconnectedAt  DateTime?
  lastHeartbeatAt DateTime @default(now())
  
  // Presence tracking
  viewingResourceType String?
  viewingResourceId   String?
  
  @@index([tenantId, userId])
  @@index([connectionId])
}
```

---

## 7. Event Bus Implementation

```typescript
// apps/api/src/config/event-bus.ts

interface EventBusAdapter {
  publish(event: Event): Promise<void>;
  subscribe(eventType: string, handler: (event: Event) => Promise<void>): void;
  unsubscribe(eventType: string): void;
}

class ServiceBusAdapter implements EventBusAdapter {
  // Azure Service Bus implementation
  async publish(event: Event) {
    const sender = this.client.createSender(event.type);
    await sender.sendMessages({ body: JSON.stringify(event) });
  }
}

class RabbitMQAdapter implements EventBusAdapter {
  // RabbitMQ implementation
  async publish(event: Event) {
    const channel = await this.connection.createChannel();
    await channel.assertExchange(event.type, 'fanout', { durable: true });
    channel.publish(event.type, '', Buffer.from(JSON.stringify(event)));
  }
}

// Factory
export function getEventBus(): EventBusAdapter {
  if (process.env.EVENT_BUS_TYPE === 'servicebus') {
    return new ServiceBusAdapter();
  }
  return new RabbitMQAdapter();
}
```

---

## 8. RBAC Rules

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `GET /api/v1/platform/events/types` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `GET /api/v1/notifications/nudges` | ✓ (own) | ✓ (team) | ✓ (team) | ✓ (all) | ✓ (all) |
| `POST /api/v1/platform/feature-flags` | ✗ | ✗ | ✗ | ✗ | ✓ |
| WebSocket subscribe | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 9. Error Responses

```json
{
  "error": {
    "code": "EVENT_ERROR",
    "message": "Description"
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Event publish failed | 500 | `PUBLISH_FAILED` |
| WebSocket connection failed | 500 | `CONNECTION_FAILED` |
| Feature flag not found | 404 | `FLAG_NOT_FOUND` |
| Nudge rate limit exceeded | 429 | `NUDGE_RATE_LIMITED` |
| Invalid event payload | 400 | `INVALID_EVENT` |

---

## 10. Phased Rollout

### Phase 1 (Sprint 5) — Event Bus Foundation

- [ ] Create Event model, event type enum
- [ ] Implement abstraction (adapter pattern)
- [ ] Configure Azure Service Bus / RabbitMQ
- [ ] Implement basic publish/subscribe
- [ ] Unit tests for event publishing
- **Success Criteria:** Can publish events, subscribers receive them async

### Phase 2 (Sprint 6) — Event Handlers & Nudges

- [ ] Create event handler registry
- [ ] Implement handlers (audit_log, notify_managers, etc.)
- [ ] Nudge model & CRUD endpoints
- [ ] Nudge creation from events
- [ ] Integration tests
- **Success Criteria:** Event triggers nudge creation, user receives notification

### Phase 3 (Sprint 7) — WebSocket Hub & Real-Time

- [ ] Implement WebSocket hub (presence, notifications)
- [ ] Client subscription logic
- [ ] Presence tracking (who's online, viewing what)
- [ ] Real-time notification delivery
- **Success Criteria:** User sees notification in real-time, presence updates live

### Phase 4 (Sprint 8) — Feature Flags

- [ ] FeatureFlag model & CRUD
- [ ] Rule evaluation engine
- [ ] Runtime flag evaluation (no restart)
- [ ] Client-side flag queries
- [ ] Gradual rollout (percentage-based)
- **Success Criteria:** Can roll out feature to 10% of users, increase to 100%

---

## 11. Acceptance Criteria

✅ **Phase 1 Acceptance:**

- [ ] Event published to Service Bus / RabbitMQ
- [ ] Subscriber receives event within 100ms
- [ ] Event payload matches schema
- [ ] Correlation ID propagated through event chain
- [ ] No data loss if handler fails (dead-letter queue)

---

## 12. Security Considerations

- **Event payload encryption** — Events contain sensitive data (proof details); encrypted in transit and at rest
- **WebSocket authentication** — JWT token required on every WebSocket connection
- **Rate limiting** — Nudge creation rate-limited per user (10/hour)
- **PII in events** — Redacted from logs; only user_id stored, never email/name

---

## 13. Related Specs

- **Service Architecture:** `service-architecture-spec.md` (Decision 9)
- **API Telemetry:** `api-telemetry.md` (correlation ID propagation)
- **Qualification API:** `qualification-api.md` (event triggers review queue)

