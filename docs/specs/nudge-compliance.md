# Nudge System & Compliance Notifications — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-21  
> **Issue:** [#112 — Nudge system compliance review, rate limiting, and anti-harassment controls](https://github.com/ivegamsft/work-tracker/issues/112)  
> **Applies To:** Notifications module, nudge service, rate limiting, harassment prevention  
> **Companion Docs:** [Compliance Audit Events](./compliance-audit-events.md) · [RBAC API Spec](./rbac-api-spec.md) · [Identity Compliance](./identity-compliance.md)  
> **Regulatory Scope:** GDPR (consent & processing), HIPAA (notification rules), employment law (anti-harassment), FCRA (consumer notification)  
> **Locked Decision:** Decision 9 (Event-driven + WebSocket), Decision 12 (Semi-anonymous profiles)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Nudge Definition & Use Cases](#2-nudge-definition--use-cases)
3. [Audit Trail Requirements](#3-audit-trail-requirements)
4. [Rate Limiting & Anti-Harassment](#4-rate-limiting--anti-harassment)
5. [Harassment Escalation & CO Review](#5-harassment-escalation--co-review)
6. [Nudge as Compliance Evidence](#6-nudge-as-compliance-evidence)
7. [Notification Consent Management](#7-notification-consent-management)
8. [Data Retention for Nudge History](#8-data-retention-for-nudge-history)
9. [RBAC Implications](#9-rbac-implications)
10. [Risk Assessment](#10-risk-assessment)
11. [Mitigation Controls](#11-mitigation-controls)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Overview

### What Is a Nudge?

A **nudge** is a proactive, time-sensitive notification reminding an employee to complete or renew a compliance requirement. Nudges serve two purposes:

1. **Operational** — Remind John Doe: "CPR cert expires in 14 days; renew by March 31"
2. **Compliance evidence** — Document that the employer notified the employee, proving "due diligence" if a violation occurs

Nudges are **supervisor-initiated** (not automated). When John's CPR expires, his supervisor sends a nudge:
- **To:** John (via email, Teams, SMS)
- **From:** Supervisor (identified by name + role)
- **Channel:** Email, Teams, SMS, in-app
- **Timestamp:** Logged with delivery confirmation
- **Response:** John must acknowledge receipt

### Regulatory Context

**OSHA 1910.1000** — Employer responsible for providing training and maintaining records of completion. A nudge proves the employer **communicated** the requirement.

**GDPR Article 6** — Notifications are a form of "processing" personal data; consent required (unless processing is legal requirement for employment compliance).

**HIPAA § 164.308(a)(4)** — Workforce security: access to protected health info must be managed and documented (nudges are part of access control documentation).

**Employment Law (US)** — "Constructive notice" requires documented communication. A nudge is evidence employer notified employee of expiration.

---

## 2. Nudge Definition & Use Cases

### 2.1 Nudge Lifecycle

```
TRIGGER EVENT
  ├─ Qualification expiring in 7 days
  ├─ Required training not started after 14 days
  ├─ Manual supervisor trigger (send reminder)
  ├─ Fulfillment rejected; employee has 3 days to resubmit
  └─ Override expiration ending; review due in 7 days
  ↓
NUDGE CREATED (status: DRAFT)
  ├─ Supervisor selects employee & requirement
  ├─ Selects nudge type (expiration reminder, follow-up, rejection)
  ├─ Chooses communication channel(s) (email, Teams, SMS)
  ├─ Sets due date (optional; default = requirement due date)
  └─ Logs as: nudge:created
  ↓
NUDGE SENT (status: SENT)
  ├─ Email/Teams/SMS delivered to recipient
  ├─ Timestamp of send
  ├─ Delivery method confirmed
  ├─ Logs as: nudge:sent
  └─ Start tracking for response/acknowledgment
  ↓
AWAITING RESPONSE (status: AWAITING_RESPONSE, 7 days default)
  ├─ Employee receives notification
  ├─ Employee clicks link / acknowledges in Teams
  ├─ [Optional] Employee views nudge in app
  ├─ Logs as: nudge:viewed, nudge:response_received
  └─ Grace period: can take action
  ↓
ESCALATION (if no response by due date)
  ├─ Status: ESCALATED
  ├─ Send reminder to supervisor: "No response from employee"
  ├─ Escalate to manager if supervisor didn't follow up
  ├─ Logs as: nudge:escalation_triggered
  └─ May trigger performance review / disciplinary action
  ↓
RESOLVED (action taken or override granted)
  ├─ Status: RESOLVED
  ├─ Employee completes requirement → fulfillment created
  ├─ OR manager overrides → requirement waived
  ├─ OR due date extended → supervisor extends deadline
  └─ Logs as: nudge:resolved
```

### 2.2 Nudge Types

| Type | When Sent | By Whom | Message |
|------|-----------|---------|---------|
| **Expiration reminder** | 14, 7, 3 days before expiration | Supervisor | "CPR expires on 3/31. Please renew by then." |
| **Follow-up** | After reminder, if no action | Supervisor | "Gentle reminder: CPR renewal due in 3 days." |
| **Rejection notice** | When proof is rejected | Validator | "Your CPR upload was rejected. Resubmit by Friday." |
| **Assignment start** | New template assigned | Manager | "You've been assigned CPR cert training. Due 3/31." |
| **Escalation** | After multiple reminders | Manager | "CPR renewal is overdue. Please complete immediately." |
| **Override notification** | Requirement waived or extended | Compliance Officer | "Background check requirement waived until 3/31/27." |

### 2.3 Nudge Payload

```json
{
  "id": "nudge-uuid",
  "employeeId": "emp-uuid",
  "supervisorId": "supervisor-uuid",  // Who is sending the nudge
  "requirementId": "requirement-uuid",
  "requirementName": "CPR Certification",
  "requirement_due_date": "2026-03-31",
  
  "nudge_type": "expiration_reminder",
  "nudge_days_before_expiry": 14,
  "message_template": "expiration_reminder_14d",
  
  "communication_channels": ["email", "teams"],
  "channel_preferences": {
    "email": "john.doe@example.com",
    "teams": "john-doe@teams",
    "sms": null  // Employee opted out of SMS
  },
  
  "sent_at": "2026-03-17T08:00:00Z",
  "sent_by": "supervisor-uuid",
  "delivery_status": "delivered",  // DRAFT | SENT | FAILED | BLOCKED_BY_CONSENT
  
  "response_deadline": "2026-03-24T23:59:59Z",  // 7 days to respond
  "response_status": "AWAITING_RESPONSE",  // AWAITING_RESPONSE | RESPONDED | ESCALATED
  "responded_at": null,
  "response_method": null,  // viewed_in_app | clicked_link | acknowledged
  
  "escalation": {
    "escalation_triggered_at": null,
    "escalation_level": null,  // 1 = supervisor, 2 = manager
    "escalation_sent_to": null
  },
  
  "audit_trail": [
    { "action": "nudge:created", "timestamp": "2026-03-16T14:00:00Z", "actor": "supervisor-uuid" },
    { "action": "nudge:sent", "timestamp": "2026-03-17T08:00:00Z", "actor": "SYSTEM" },
    { "action": "nudge:delivered_email", "timestamp": "2026-03-17T08:00:15Z", "actor": "email_service" },
    { "action": "nudge:delivered_teams", "timestamp": "2026-03-17T08:00:20Z", "actor": "teams_service" }
  ]
}
```

---

## 3. Audit Trail Requirements

### 3.1 Nudge Event Catalog

Every nudge event generates an immutable audit entry:

| Event | Timestamp | Details Logged |
|-------|-----------|----------------|
| `nudge:created` | When created | nudgeId, employeeId, supervisorId, requirementId |
| `nudge:sent` | When delivered | channels used, delivery status, timestamp |
| `nudge:viewed` | When employee opens | in-app view time, device info |
| `nudge:response_received` | When acknowledged | response method, timestamp, user action |
| `nudge:escalation_triggered` | After deadline missed | escalation level, notified supervisors |
| `nudge:escalation_sent` | When escalation delivered | recipient, channel, timestamp |
| `nudge:resolved` | When action completed | how resolved (action taken / override / escalation closed) |
| `nudge:blocked_by_consent` | If not sent | reason (no consent for channel) |
| `nudge:harassment_flag` | If employee flags as harassment | who flagged, reason, timestamp |

### 3.2 Audit Entry Schema

```json
{
  "id": "audit-uuid",
  "timestamp": "2026-03-17T08:00:00Z",
  "action": "nudge:sent",
  "actor": "SYSTEM",  // Often automated; manual actions show supervisor
  "actorRole": "SYSTEM",
  "entityType": "Nudge",
  "recordId": "nudge-uuid",
  "reason": "Scheduled reminder: CPR expires in 14 days",
  "status": "success",
  
  "before": {
    "nudge_status": "DRAFT",
    "sent_at": null,
    "delivery_status": null
  },
  
  "after": {
    "nudge_status": "SENT",
    "sent_at": "2026-03-17T08:00:00Z",
    "delivery_status": "delivered"
  },
  
  "changedFields": ["sent_at", "delivery_status"],
  
  "metadata": {
    "employee_id": "emp-uuid",
    "employee_name": "John Doe",  // For visibility (semi-anonymous OK here)
    "supervisor_id": "supervisor-uuid",
    "supervisor_name": "Jane Smith",
    "requirement": "CPR Certification",
    "requirement_due_date": "2026-03-31",
    "channels": ["email", "teams"],
    "delivery_confirmation": {
      "email": { "status": "delivered", "timestamp": "2026-03-17T08:00:15Z" },
      "teams": { "status": "delivered", "timestamp": "2026-03-17T08:00:20Z" }
    }
  }
}
```

### 3.3 Compliance Evidence Query

Auditor can prove that employer notified employee:

```
GET /api/audit/nudges?employeeId={emp}&requirementId={req}&after=2025-01-01

Response:
  ├─ Nudge 1: Expiration reminder sent 2026-03-17
  ├─ Nudge 2: Follow-up sent 2026-03-24 (no response to first)
  ├─ Nudge 3: Escalation sent to manager 2026-03-31
  └─ [After 2026-04-07] Employee completes requirement
  
Compliance finding: "Employer documented 3 notifications before employee completed requirement. Constructive notice proven."
```

---

## 4. Rate Limiting & Anti-Harassment

### 4.1 Rate Limiting Rules

**Max nudges per supervisor per employee per day: 1**

```javascript
async sendNudge(supervisorId, employeeId, nudgePayload) {
  // Check rate limit
  const today = new Date().toDateString();
  const nudgesSentToday = await this.db.nudge.count({
    where: {
      supervisorId,
      employeeId,
      sent_at: {
        gte: new Date(today),
        lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });
  
  if (nudgesSentToday >= 1) {
    throw new RateLimitError(
      `Supervisor has already sent 1 nudge to this employee today. ` +
      `Max 1 per day per employee to prevent harassment.`
    );
  }
  
  // Proceed with sending nudge
  return await this.nudgeService.send(supervisorId, employeeId, nudgePayload);
}
```

### 4.2 Rate Limit Thresholds

| Limit | Threshold | Rationale |
|-------|-----------|-----------|
| Nudges per supervisor per employee per day | 1 | Prevents spam |
| Nudges per employee per day (from all supervisors) | 3 | Prevents pile-on |
| Automatic escalation nudges per employee per cycle | 1 | Only escalate once per requirement |
| Nudges per employee per calendar week | 7 | Max 1 per day average |

### 4.3 Rate Limit Violation Handling

When a supervisor exceeds rate limits:

```
[Supervisor tries to send 2nd nudge to John in same day]
  ↓
Rate limit check fails
  ↓
System response:
  ├─ DENY the nudge (return 429 Too Many Requests)
  ├─ Show error: "You've already sent 1 nudge today. Max 1 per day."
  ├─ Suggest: "Next nudge can be sent starting tomorrow."
  ├─ Log as: "nudge:rate_limit_exceeded"
  └─ No audit entry in nudge system (no nudge created)
```

---

## 5. Harassment Escalation & CO Review

### 5.1 Harassment Flags

Employees can flag excessive nudges as harassment:

```json
{
  "id": "harassment-flag-uuid",
  "nudgeId": "nudge-uuid",
  "employeeId": "emp-uuid",
  "flaggedAt": "2026-03-20T14:30:00Z",
  "reason": "Supervisor sent 5 nudges in 1 week about same requirement",
  
  "context": {
    "nudgeChain": [
      { "sent_at": "2026-03-15T08:00:00Z", "type": "expiration_reminder" },
      { "sent_at": "2026-03-16T09:00:00Z", "type": "follow_up" },
      { "sent_at": "2026-03-17T14:00:00Z", "type": "follow_up" },
      { "sent_at": "2026-03-18T08:30:00Z", "type": "follow_up" },
      { "sent_at": "2026-03-19T16:00:00Z", "type": "escalation" }
    ]
  },
  
  "status": "PENDING",  // PENDING | UNDER_REVIEW | RESOLVED
  "reviewedBy": null,
  "reviewedAt": null,
  "resolution": null
}
```

### 5.2 Harassment Investigation Workflow

```
[Employee flags: "Too many nudges from supervisor"]
  ↓
Step 1: Flag Received
  ├─ Log as: "harassment:flag_received"
  ├─ Email Compliance Officer
  └─ Status: PENDING_REVIEW
  ↓
Step 2: CO Review (within 48 hours)
  ├─ Analyze nudge frequency: 5 nudges in 1 week
  ├─ Check rate limit violations: Yes, 5 > 3 per week
  ├─ Check employee consent: Yes, consent given for notifications
  ├─ Determine: Harassment or legitimate escalation?
  │   └─ Finding: Supervisor violated rate limits
  ├─ Decision options:
  │   ├─ SUBSTANTIATED — Flag supervisor for retraining
  │   ├─ UNSUBSTANTIATED — Escalation was justified
  │   └─ PARTIALLY — Some nudges OK, some excessive
  └─ Log as: "harassment:review_completed"
  ↓
Step 3: Action Taken
  If SUBSTANTIATED:
    ├─ Notify supervisor: Violated rate limits
    ├─ Require retraining: Anti-harassment policy
    ├─ Monitor future nudges: Flag if rate limits exceeded again
    ├─ Offer employee support: Mediation, role change?
    └─ Log as: "harassment:supervisor_notified", "harassment:retraining_assigned"
  
  If UNSUBSTANTIATED:
    ├─ Notify employee: Escalation was justified per policy
    ├─ Explain: Rate limits allow 3 nudges/week for exactly this
    └─ Log as: "harassment:flag_dismissed"
  ↓
Step 4: Closeout
  ├─ Status: RESOLVED
  ├─ Email both parties with decision
  └─ Archive for record
```

### 5.3 Harassment Investigation Audit Entry

```json
{
  "action": "harassment:flag_received",
  "timestamp": "2026-03-20T14:30:00Z",
  "actor": "emp-uuid",  // Employee filing flag
  "entityType": "HarassmentFlag",
  "recordId": "harassment-flag-uuid",
  "after": {
    "flaggedNudgeId": "nudge-uuid",
    "flagReason": "Excessive nudges about same requirement",
    "nudgeFrequency": { "count": 5, "period": "7_days" },
    "status": "PENDING_REVIEW"
  }
}

{
  "action": "harassment:review_completed",
  "timestamp": "2026-03-22T10:00:00Z",
  "actor": "compliance-officer-uuid",
  "after": {
    "harassmentFlagId": "harassment-flag-uuid",
    "finding": "SUBSTANTIATED",
    "reason": "Rate limit exceeded: 5 nudges sent in 1 week; policy allows 3",
    "action": "Supervisor retraining required"
  }
}
```

---

## 6. Nudge as Compliance Evidence

### 6.1 Constructive Notice Doctrine

In employment law, **constructive notice** means the employer took reasonable steps to inform the employee. A nudge proves this:

```
Compliance Scenario:
  Employee's CPR cert is EXPIRED.
  CPR is OSHA required.
  Employer didn't notify employee.
  → OSHA cites employer for lack of notice / training.
  
With Nudge System:
  Employee's CPR cert expiring in 14 days.
  Supervisor sends nudge: "CPR expires 3/31. Renew by then."
  Timestamp: 2026-03-17 08:00:00Z
  Delivery: Email + Teams (confirmed)
  → Audit trail proves employer notified employee 14 days before.
  → OSHA cannot cite for lack of notice.
```

### 6.2 Evidence Package for Auditor

When audited, generate compliance evidence report:

```json
{
  "employeeId": "emp-uuid",
  "employeeName": "John Doe",
  "requirement": "CPR Certification",
  "requirement_id": "cpr-cert",
  "regulatory_requirement": "OSHA 1910.1000 — Training compliance",
  
  "compliance_timeline": [
    {
      "date": "2025-12-01",
      "event": "CPR assignment",
      "due_date": "2026-03-31",
      "action": "Manager assigned template",
      "proof": "assignment_created_audit"
    },
    {
      "date": "2026-03-17",
      "event": "First nudge (14 days before expiry)",
      "channels": ["email", "teams"],
      "delivery_confirmed": true,
      "action": "Employer notified employee of upcoming expiration",
      "proof": "nudge_sent_audit"
    },
    {
      "date": "2026-03-17",
      "event": "Employee viewed nudge",
      "time": "2026-03-17T08:15:00Z",
      "device": "Desktop",
      "proof": "nudge_viewed_audit"
    },
    {
      "date": "2026-03-24",
      "event": "Second nudge (7 days before expiry)",
      "note": "No response to first nudge",
      "channels": ["email", "teams"],
      "delivery_confirmed": true,
      "action": "Follow-up reminder sent",
      "proof": "nudge_sent_audit"
    },
    {
      "date": "2026-03-31",
      "event": "CPR expires",
      "action": "Employee has not yet renewed",
      "proof": "fulfillment_expired_audit"
    },
    {
      "date": "2026-03-31",
      "event": "Escalation nudge sent to manager",
      "note": "Escalated because employee didn't respond to 2 nudges",
      "channels": ["email", "teams"],
      "action": "Manager notified of non-compliance",
      "proof": "nudge_escalation_audit"
    },
    {
      "date": "2026-04-07",
      "event": "Employee completes CPR",
      "action": "Renewal fulfilled",
      "proof": "fulfillment_created_audit"
    }
  ],
  
  "compliance_status": "COMPLIANT_WITH_NOTICE",
  "finding": "Employer sent 3 nudges over 3 weeks (14d, 7d, 0d); employee acknowledged; employer demonstrates due diligence per OSHA 1910.1000.",
  
  "audit_timestamp": "2026-04-30T10:00:00Z",
  "report_generated_by": "compliance-officer-uuid"
}
```

---

## 7. Notification Consent Management

### 7.1 Consent Rules (GDPR / CCPA)

Employers must have **legal basis** to send nudges. Under GDPR:

| Basis | Description | Example |
|-------|-------------|---------|
| **Legal Obligation** | Notification required by law | "Employer must notify of training deadline" |
| **Contract** | Notification required by employment contract | "Employee handbook requires renewal notices" |
| **Consent** | Explicit opt-in by employee | "Employee checked 'receive compliance notifications'" |
| **Legitimate Interest** | Employer interest in compliance (balances employee privacy) | "Employer needs to track expiration; balances employee privacy" |

**Default:** Nudges are sent under "Legal Obligation" (employment compliance). Employees can **opt out** of specific channels (SMS) but cannot opt out entirely.

### 7.2 Notification Preferences

Employees manage which channels they receive nudges on:

```json
{
  "id": "notification-pref-uuid",
  "employeeId": "emp-uuid",
  
  "notification_types": {
    "compliance_nudge": {
      "enabled": true,  // Cannot disable; required by law
      "legal_basis": "legal_obligation",  // Employment compliance
      "channels": {
        "email": true,
        "teams": true,
        "sms": false,  // Employee opted out of SMS
        "in_app": true
      },
      "frequency": "immediate",  // Send immediately when scheduled
      "lastUpdated": "2026-02-01T10:00:00Z"
    }
  }
}
```

### 7.3 Consent Audit Trail

Every preference change generates an audit entry:

```json
{
  "action": "notification:preference_updated",
  "timestamp": "2026-02-01T10:00:00Z",
  "actor": "emp-uuid",  // Employee changed own preference
  "entityType": "NotificationPreference",
  "recordId": "notification-pref-uuid",
  
  "before": {
    "sms": true
  },
  
  "after": {
    "sms": false
  },
  
  "metadata": {
    "changeReason": "Employee opt-out",
    "channel": "preference_center"
  }
}
```

---

## 8. Data Retention for Nudge History

### 8.1 Nudge Data Retention

Nudge history is compliance evidence and must be retained:

| Data | Retention | Reason |
|------|-----------|--------|
| **Nudge records** (sent_at, channels, status) | 7 years | Proof of notice; regulatory audit trail |
| **Nudge audit entries** | 7 years | Immutable evidence; cannot be modified |
| **Employee response** (viewed_at, acknowledged_at) | 7 years | Proof employee received notice |
| **Escalation records** | 7 years | Management action documentation |
| **Harassment flags** | 7 years | HR documentation; potential disputes |
| **Notification preferences** | Life of employment + 7 years | Privacy baseline + regulatory compliance |

### 8.2 Cold Storage Archival

After 6 years, nudge records move to cold storage:

```
Age 6 years: Move from PostgreSQL → Azure Blob Storage (immutable)
Age 7 years: Seal with manifest fingerprint
Age 8+ years: Delete per policy (immutable container prevents early deletion)
```

### 8.3 GDPR Right to Erasure (Article 17)

Nudge history supports "right to be forgotten," but:

- **Cannot delete** — Proof of employment compliance
- **Can redact** — Mask personal details (name, email) for old records
- **Can export** — Provide employee copy of all nudges sent about them

---

## 9. RBAC Implications

### 9.1 Nudge Permissions

```
nudges:send
  └─ SUPERVISOR+ can send nudges to direct reports
  
nudges:send:escalated
  └─ MANAGER can escalate nudges to employees
  
nudges:receive
  └─ All employees receive nudges
  
nudges:read:own
  └─ Employee can read nudges sent to them
  
nudges:read:team
  └─ Supervisor can read nudges they sent
  
nudges:read:all
  └─ COMPLIANCE_OFFICER can read all nudges (audit)
  
notifications:preferences:manage_own
  └─ Employee can modify their notification preferences
  
notifications:preferences:manage_all
  └─ ADMIN can override employee preferences (rare, with audit)
  
harassment:flag
  └─ Any employee can flag nudge as harassment
  
harassment:investigate
  └─ COMPLIANCE_OFFICER investigates harassment flags
```

---

## 10. Risk Assessment

### 10.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **Harassment via nudges** | Supervisor sends 10 nudges/day to intimidate | Rate limit: 1 nudge per supervisor per employee per day |
| **Spam notifications** | Notification overload; employee ignores nudges | Frequency limit: 3 nudges/week per employee |
| **Consent violations (GDPR)** | Send SMS without employee consent | Respect preferences; audit every send decision |
| **Nudge as retaliation** | Supervisor sends nudge to harass employee | Audit trail + harassment flag workflow + CO review |
| **Missed escalations** | Important nudge doesn't escalate when unacknowledged | Auto-escalation at deadline; CO alerted |
| **Lost audit trail** | Nudge sent, but audit entry deleted | Hash-chain integrity + immutable storage |
| **Fake delivery confirmations** | Claim nudge delivered when it wasn't | Email/Teams delivery logs + retry logic |

---

## 11. Mitigation Controls

### 11.1 Database-Level Controls

```sql
-- Rate limit enforcement
CREATE TRIGGER nudge_rate_limit_check
  BEFORE INSERT ON nudges
  FOR EACH ROW
  EXECUTE FUNCTION enforce_nudge_rate_limit();
  -- Prevents >1 nudge per supervisor per employee per day

-- Immutable nudge records
ALTER TABLE nudges DISABLE TRIGGER ALL;
REVOKE UPDATE, DELETE ON nudges FROM application_user;
GRANT INSERT, SELECT ON nudges TO application_user;

-- Audit entry integrity
CREATE TRIGGER nudge_audit_hash_check
  BEFORE INSERT ON audit_logs
  WHERE action LIKE 'nudge:%'
  FOR EACH ROW
  EXECUTE FUNCTION verify_hash_chain();
```

### 11.2 Application-Level Controls

1. **Rate limiter** — Singleton service that tracks nudge sends per (supervisor, employee) per day
2. **Escalation engine** — Scheduled job that auto-escalates unacknowledged nudges
3. **Consent validator** — Check employee notification preferences before sending
4. **Harassment detector** — Automated flag if >3 nudges in 7 days from same supervisor
5. **Delivery notifier** — Mirror email/Teams delivery logs to audit system

### 11.3 Infrastructure Controls

1. **Email/Teams webhooks** — Log all delivery confirmations to audit system
2. **Notification queue** — Azure Service Bus for reliable delivery + retry
3. **Harassment alert** — Automated alert to CO if >5 harassment flags in month
4. **Audit log integrity** — Quarterly integrity checks on nudge audit entries

---

## 12. Phased Rollout

### Phase 1: Basic Nudge System (Months 1-2)

- [ ] Implement nudge creation & sending (supervisor → employee)
- [ ] Add audit trail for all nudge events
- [ ] Integrate email delivery (Teams optional)
- [ ] Test: create nudge, send, confirm delivery
- [ ] Load-test with 1000 nudges/day

**Success Criteria:**
- Nudges sent and delivered within 1 minute
- Audit trail captures all events
- No data loss on queue failures (retry logic works)

### Phase 2: Rate Limiting & Anti-Harassment (Months 2-3)

- [ ] Implement rate limiter (1 nudge/supervisor/employee/day)
- [ ] Build harassment flag workflow
- [ ] Implement CO review + resolution
- [ ] Test: supervisor tries to send 2 nudges in 1 day → denied
- [ ] Pilot: 5 employees flag harassment; CO reviews

**Success Criteria:**
- Rate limit enforced; 2nd nudge same day returns 429
- Harassment flag reaches CO within 1 minute
- CO can review + resolve within 48 hours

### Phase 3: Escalation & Auto-Acknowledgment (Months 3-4)

- [ ] Implement auto-escalation (if no response by due date)
- [ ] Build escalation notification (to manager)
- [ ] Add "viewed" tracking (employee clicks link)
- [ ] Test: nudge sent → no response → escalated to manager
- [ ] Test: 1000 employees acknowledge nudges in 1 hour

**Success Criteria:**
- Escalation triggered exactly on due date
- Manager receives escalation notification
- Acknowledged nudges marked as responded

### Phase 4: Consent & Preferences (Months 4-5)

- [ ] Build notification preference UI
- [ ] Implement GDPR consent rules
- [ ] Add preference audit trail
- [ ] Allow employee to opt out of SMS (keep email/Teams)
- [ ] Test: send nudge with SMS disabled → no SMS sent

**Success Criteria:**
- Employee preferences respected in all sends
- Preference changes logged in audit trail
- Compliance report shows consent basis

### Phase 5: Auditor Readiness & Compliance (Months 5-6)

- [ ] Create evidence package generator (compliance report)
- [ ] Test: generate report for employee; proves notice sent
- [ ] Run first OSHA-style audit: "Prove notification happened"
- [ ] Archive nudge data to cold storage after 6 years
- [ ] Deploy to production with monitoring

**Success Criteria:**
- Evidence package generated in < 1 minute
- External auditor validates nudge trail as proof of notice
- Compliance report passes legal review

---

## Appendix: Nudge Compliance Checklist

### Pre-Production

- [ ] Rate limiting enforced (1 nudge/supervisor/employee/day)
- [ ] All nudges have audit entries
- [ ] Harassment flag workflow exists + CO review
- [ ] Escalation auto-triggers at due date
- [ ] Notification preferences stored + respected
- [ ] Evidence package can be generated per employee
- [ ] Cold storage archive configured for 6+ year retention
- [ ] Test: Send 10 nudges to 100 employees; verify all in audit trail

### Post-Production

- [ ] Monitor rate limit violations (goal: 0)
- [ ] Monitor harassment flags (goal: < 1% of nudges)
- [ ] Monitor escalation rate (goal: < 10% of assignments)
- [ ] Audit trail integrity check (monthly)
- [ ] Compliance evidence report (quarterly)

---

**Document Status:** Draft → Ready for Review → Approved by Legal/Compliance  
**Last Updated:** 2026-03-21  
**Next Review:** 2026-09-21 (6-month cycle)
