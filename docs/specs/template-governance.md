# Template Governance & Change Control Specification — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-21  
> **Issue:** [#100 — Template governance, change control, and regulatory alignment](https://github.com/ivegamsft/work-tracker/issues/100)  
> **Applies To:** `apps/api/src/modules/templates`, template versioning, release workflow  
> **Companion Docs:** [Templates & Attestation Spec](./templates-attestation-spec.md) · [Proof Taxonomy](./proof-taxonomy.md) · [Compliance Audit Events](./compliance-audit-events.md)  
> **Regulatory Scope:** SOX IT governance, HIPAA change control, industry-specific (FAA, Joint Commission, OSHA)  
> **Locked Decisions:** Decision 5 (L1-L4 attestation), Decision 7 (version control)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Template Lifecycle & State Machine](#2-template-lifecycle--state-machine)
3. [Change Control Workflow](#3-change-control-workflow)
4. [Review & Approval (4-Eyes Principle)](#4-review--approval-4-eyes-principle)
5. [Audit Trail for Template Changes](#5-audit-trail-for-template-changes)
6. [Regulatory Catalog Alignment](#6-regulatory-catalog-alignment)
7. [Version Control & Immutability](#7-version-control--immutability)
8. [Template Retirement & Migration](#8-template-retirement--migration)
9. [RBAC Implications](#9-rbac-implications)
10. [Risk Assessment](#10-risk-assessment)
11. [Mitigation Controls](#11-mitigation-controls)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Overview

### What Is Template Governance?

A **proof template** is a reusable bundle of compliance requirements (e.g., "CPR Certification + OSHA 10-Hour"). Once published, a template can be assigned to 100s of employees. Changes to a published template affect everyone assigned to it — including expiration dates, attestation levels, and proof types.

**Template governance** ensures:
1. **Change control** — Changes reviewed and approved before taking effect
2. **Auditability** — Every change to a template is logged with who, when, why
3. **Regulatory alignment** — Templates stay synchronized with current regulatory requirements
4. **Version traceability** — Auditors can reproduce the exact template version an employee was assigned
5. **Data integrity** — No accidental or malicious modifications to active requirements

### Locked Decision Context

**Decision 5 — L1-L4 Attestation:** Templates specify attestation levels per requirement (self-attest, upload, third-party, validated).
**Decision 7 — Version control:** Templates are versioned; published templates are immutable and cannot be edited (clone to modify).

---

## 2. Template Lifecycle & State Machine

### 2.1 Template States

```
                     ┌──────────────┐
                     │   DRAFT      │
                     │              │
                     │ (Editable)   │
                     └──────┬───────┘
                            │
                            │ [manager:publish]
                            ↓
                     ┌──────────────┐
                     │ PUBLISHED    │
                     │              │
                     │ (Immutable)  │
                     │ (Assignable) │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              │ [deprecated]│ [retired]   │
              ↓             ↓             │
        ┌──────────────┐    │             │
        │ DEPRECATED   │    │             │
        │              │    │             │
        │ (Read-only)  │    │             │
        │ (No new      │    │             │
        │  assignments)│    │             │
        └──────────────┘    │             │
                            ↓             │
                      ┌──────────────┐    │
                      │ RETIRED      │←───┘
                      │              │
                      │ (Archived)   │
                      │ (Audit only) │
                      └──────────────┘
```

### 2.2 State Transitions & Rules

| Current State | Action | Target State | Required Role | Requires Review? |
|---------------|--------|--------------|---------------|-----------------|
| DRAFT | Publish | PUBLISHED | MANAGER+ | ✅ Yes (4-eyes) |
| PUBLISHED | Deprecate | DEPRECATED | MANAGER+ | ✅ Yes (CO approval) |
| DEPRECATED | Retire | RETIRED | ADMIN | ✅ Yes (CO + legal) |
| DRAFT | Delete | (removed) | ADMIN | ❌ No (draft data only) |
| PUBLISHED | Clone | DRAFT (new) | MANAGER+ | ❌ No (copy operation) |

### 2.3 Template Metadata

Every template stores:

```json
{
  "id": "template-uuid",
  "name": "CPR Certification Renewal",
  "description": "Annual CPR certification requirement for clinical staff",
  "status": "PUBLISHED",
  "version": 3,
  "baselineVersion": 1,  // First published version
  "createdBy": "manager-uuid",
  "createdAt": "2025-06-15T10:00:00Z",
  "publishedBy": "compliance-officer-uuid",
  "publishedAt": "2025-06-20T14:30:00Z",
  "deprecatedBy": null,
  "deprecatedAt": null,
  "retiredBy": null,
  "retiredAt": null,
  
  "regulatoryBasis": {
    "frameworks": ["OSHA", "Joint Commission"],
    "citations": ["OSHA 1910.1000", "JCO.HR.01500"],
    "lastReviewDate": "2025-12-01",
    "expiryDate": null  // null = ongoing requirement
  },
  
  "requirements": [
    {
      "id": "req-uuid-1",
      "name": "CPR Card",
      "proofType": "certification",
      "attestationLevels": ["upload_validated"],
      "validityDays": 365,
      "renewalWarningDays": 30
    }
  ],
  
  "changeLog": [
    {
      "version": 1,
      "changedAt": "2025-06-20T14:30:00Z",
      "changedBy": "compliance-officer-uuid",
      "change": "Initial publish",
      "details": "Created template with 1 requirement"
    },
    {
      "version": 2,
      "changedAt": "2025-10-15T09:00:00Z",
      "changedBy": "manager-uuid",
      "change": "Updated requirement",
      "details": "Changed CPR Card attestation from upload to upload_validated",
      "reason": "Require manager validation per new policy"
    },
    {
      "version": 3,
      "changedAt": "2025-12-01T08:00:00Z",
      "changedBy": "compliance-officer-uuid",
      "change": "Added requirement",
      "details": "Added AED certification requirement",
      "reason": "New OSHA 1910.1000 update"
    }
  ],
  
  "activeAssignmentCount": 347,
  "deprecationPlan": null  // Only set when deprecated
}
```

---

## 3. Change Control Workflow

### 3.1 Template Change Workflow

```
[Manager wants to update active template]
  ↓
Step 1: Clone Published Template
  POST /api/templates/:id/clone
  Creates new DRAFT version v2.draft
  ↓
Step 2: Manager Edits Draft
  PATCH /api/templates/:draftId
  - Add/modify/delete requirements
  - Change attestation levels
  - Update validity periods
  ↓
Step 3: Manager Submits for Review
  POST /api/templates/:draftId/submit-for-review
  Creates ReviewRequest in "PENDING" status
  Notifies Compliance Officer
  ↓
Step 4: Compliance Officer Reviews
  [CO examines changelog]
  [CO reviews regulatory alignment]
  [CO decides: APPROVE or REJECT]
  ↓
  IF REJECT:
    ├─ PATCH /api/review-requests/:id/reject
    ├─ Feedback: "Validity period too long per HIPAA"
    ├─ Manager receives notification
    └─ Return to Step 2 (edit draft)
  ↓
  IF APPROVE:
    ├─ PATCH /api/review-requests/:id/approve
    ├─ Generate approval audit entry
    └─ Proceed to Step 5
  ↓
Step 5: Publish Updated Template
  PATCH /api/templates/:draftId/publish
  ├─ Set status = PUBLISHED
  ├─ Increment version (v3)
  ├─ Notify all managers with active assignments
  ├─ Log audit entry: template:published_v3
  └─ Users assigned to previous version remain (no auto-migration)
  ↓
Step 6: Communicate Migration Plan
  Email all supervisors:
  "CPR template updated. New assignments use v3."
  "Old assignments continue on v2 until expiry."
  "You can manually migrate by re-assigning."
```

### 3.2 Change Request Schema

```json
{
  "id": "review-request-uuid",
  "templateId": "template-uuid",
  "draftVersion": "v3.draft",
  "currentPublishedVersion": "v2",
  "submittedBy": "manager-uuid",
  "submittedAt": "2025-12-01T08:00:00Z",
  "status": "PENDING",  // PENDING | APPROVED | REJECTED | WITHDRAWN
  
  "changesSummary": {
    "requirementsAdded": 1,
    "requirementsModified": 1,
    "requirementsRemoved": 0,
    "detailedChanges": [
      {
        "type": "added",
        "requirementName": "AED Certification",
        "reason": "New OSHA 1910.1000 requirement"
      },
      {
        "type": "modified",
        "requirementName": "CPR Card",
        "oldValue": "upload",
        "newValue": "upload_validated",
        "reason": "Require manager validation per policy"
      }
    ]
  },
  
  "regulatoryImpact": {
    "frameworksAffected": ["OSHA", "Joint Commission"],
    "alignmentStatus": "requires_review",
    "complianceNotes": "AED addition aligns with JCO.HR.01500"
  },
  
  "reviewedBy": "compliance-officer-uuid",
  "reviewedAt": "2025-12-01T14:30:00Z",
  "reviewNotes": "Alignment verified. AED requirement matches current JCO standards.",
  
  "approvalChain": [
    {
      "approver": "compliance-officer-uuid",
      "role": "COMPLIANCE_OFFICER",
      "status": "APPROVED",
      "timestamp": "2025-12-01T14:30:00Z"
    }
  ]
}
```

---

## 4. Review & Approval (4-Eyes Principle)

### 4.1 Separation of Duties

**Rule:** No single person can unilaterally change an active template requirement without review.

| Who Can? | Action | Requires Approval? | Approver |
|----------|--------|-------------------|----------|
| MANAGER | Create new template | ❌ No (starts in DRAFT) | N/A |
| MANAGER | Edit DRAFT template | ❌ No (draft only) | N/A |
| MANAGER | Submit for review | ❌ No (creates request) | N/A |
| COMPLIANCE_OFFICER | Review/approve changes | ✅ Must be different person from submitter | Compliance Officer |
| ADMIN | Force-publish (bypass review) | ✅ Must be dual-approval (ADMIN + CO) | ADMIN + COMPLIANCE_OFFICER |
| ADMIN | Delete retired template | ✅ Requires audit trail sign-off | ADMIN (with audit approval) |

### 4.2 Approval Workflow Rules

1. **Auto-reject if self-review:** If `submittedBy == reviewedBy`, workflow returns error
2. **Escalation:** If no CO response within 5 business days, escalate to next CO
3. **Veto power:** Either MANAGER or CO can withdraw/reject at any step
4. **Approval audit:** Every approval decision is logged with signature

**Example Audit Entry:**

```json
{
  "action": "template:review_approved",
  "timestamp": "2025-12-01T14:30:00Z",
  "actor": "compliance-officer-uuid",
  "actorRole": "COMPLIANCE_OFFICER",
  "entityType": "TemplateReviewRequest",
  "recordId": "review-request-uuid",
  "reason": "Alignment verified against OSHA 1910.1000 and JCO standards.",
  "after": {
    "status": "APPROVED",
    "reviewedBy": "compliance-officer-uuid",
    "reviewedAt": "2025-12-01T14:30:00Z",
    "templateVersion": 3,
    "changesSummary": {
      "requirementsAdded": 1,
      "requirementsModified": 1
    }
  },
  "metadata": {
    "templateId": "template-uuid",
    "previousStatus": "PENDING",
    "approvalTime_minutes": 360
  }
}
```

---

## 5. Audit Trail for Template Changes

### 5.1 Every Template Change Logged

Every modification to a published template (or change request) generates an immutable audit entry:

| Event | Timestamp | Actor | Change |
|-------|-----------|-------|--------|
| Template created (DRAFT) | 2025-06-15 10:00 | Manager-A | status: DRAFT, version: 1 |
| Requirement added | 2025-06-18 14:30 | Manager-A | requirements: 1 → 2 |
| Submitted for review | 2025-06-20 09:00 | Manager-A | status: PENDING_REVIEW |
| Reviewed & approved | 2025-06-20 14:30 | CO-B | status: APPROVED |
| Published (v1) | 2025-06-20 15:00 | Manager-A | status: PUBLISHED, version: 1 |
| Cloned for edit (v2.draft) | 2025-10-15 08:00 | Manager-A | baselineVersion: 1 |
| Requirement modified | 2025-10-15 09:00 | Manager-A | attestationLevels: [upload] → [upload_validated] |
| Submitted for review (v2) | 2025-10-15 13:00 | Manager-A | status: PENDING_REVIEW |
| Reviewed & approved (v2) | 2025-10-15 15:30 | CO-C | status: APPROVED |
| Published (v2) | 2025-10-15 16:00 | Manager-A | status: PUBLISHED, version: 2 |

### 5.2 Template Diff Report

Compliance officers can generate a diff between versions:

```
GET /api/templates/{id}/versions/{v1}/diff/{v2}
```

Response:

```json
{
  "templateId": "template-uuid",
  "version1": 1,
  "version2": 2,
  "publishedAtV1": "2025-06-20T15:00:00Z",
  "publishedAtV2": "2025-10-15T16:00:00Z",
  "timeElapsed": "117 days",
  
  "requirementChanges": [
    {
      "requirementId": "req-1",
      "changeType": "modified",
      "name": "CPR Card",
      "fieldChanged": "attestationLevels",
      "before": ["upload"],
      "after": ["upload_validated"],
      "reason": "Require manager validation per new policy",
      "impact": "347 active assignments affected",
      "impactStatus": "no_auto_migration_required"
    }
  ],
  
  "impactAnalysis": {
    "activeAssignmentsV1": 347,
    "activeAssignmentsV2": 0,  // New version not yet assigned
    "employeesAffected": 347,
    "requirementsTightened": 1,  // More stringent
    "requirementsRelaxed": 0,
    "newRequirements": 0
  }
}
```

---

## 6. Regulatory Catalog Alignment

### 6.1 Template-to-Regulation Mapping

Each template stores its regulatory basis:

```json
{
  "regulatoryBasis": {
    "frameworks": ["OSHA", "Joint Commission", "HIPAA"],
    "citations": [
      {
        "framework": "OSHA",
        "section": "1910.1000",
        "title": "Table Z-1 Hazardous Substances",
        "link": "https://www.osha.gov/dsg/naics-code"
      },
      {
        "framework": "Joint Commission",
        "section": "JCO.HR.01500",
        "title": "Healthcare Worker Competency",
        "link": "https://www.jointcommission.org"
      }
    ],
    "lastReviewDate": "2025-12-01",
    "nextReviewDate": "2026-12-01",  // Annual
    "reviewedBy": "compliance-officer-uuid",
    "complianceStatus": "ALIGNED"  // ALIGNED | NEEDS_REVIEW | MISALIGNED
  }
}
```

### 6.2 Regulatory Update Detection

**Quarterly regulatory scan:**

1. **Scan regulatory databases** (OSHA, FAA, Joint Commission, state health boards)
2. **Compare current versions** against stored citations in E-CLAT
3. **Flag templates** that reference outdated regulatory sections
4. **Alert Compliance Officer:** "Joint Commission § JCO.HR.01500 updated on 2025-11-01"

**Audit Entry:**

```json
{
  "action": "template:regulatory_update_detected",
  "timestamp": "2025-12-15T08:00:00Z",
  "actor": "SYSTEM",
  "entityType": "Template",
  "recordId": "template-uuid",
  "severity": "high",
  "after": {
    "templateName": "CPR Certification Renewal",
    "regulatoryFramework": "Joint Commission",
    "citation": "JCO.HR.01500",
    "lastReviewedVersion": "2024-11-01",
    "currentPublishedVersion": "2025-11-01",
    "updateSummary": "Scope expanded to include telemedicine environments"
  }
}
```

### 6.3 Template Retirement Workflow (Regulatory Obsolescence)

If a regulation is repealed or superseded:

```
[Regulatory update: OSHA § 1910.1000 superseded by 1910.1200]
  ↓
Compliance Officer reviews
  → "CPR template still compliant under new 1910.1200"
  → No action needed
  ↓
OR
  → "Safety template based on repealed 1910.1000"
  → Schedule retirement
  ↓
DEPRECATE: Set status = DEPRECATED
  ├─ Notify all managers with active assignments
  ├─ Email: "CPR template v2 deprecated effective 2026-06-01"
  ├─ Provide migration path: "Use CPR v3 instead"
  └─ Grace period: 90 days (continue accepting proofs on v2)
  ↓
RETIRE: Set status = RETIRED after 90 days
  ├─ No new assignments allowed
  ├─ No new proofs can be submitted
  ├─ Archive all fulfillment records for v2
  └─ Retain audit trail for 7+ years
```

---

## 7. Version Control & Immutability

### 7.1 Template Versioning Rules

**Once published, templates are immutable:**

```
❌ FORBIDDEN:
  PATCH /api/templates/v2/requirements/req-1
  { "attestationLevels": ["upload"] }
  
✅ ALLOWED:
  POST /api/templates/v2/clone
  → Creates new DRAFT: v3.draft
  
  PATCH /api/templates/v3.draft/requirements/req-1
  { "attestationLevels": ["upload_validated"] }
  
  PATCH /api/templates/v3.draft/publish
  → Creates new PUBLISHED: v3
```

### 7.2 Version Identifier Scheme

```
Template ID: template-abcd-1234

Versions:
  v1 — Published 2025-06-20 — 347 active assignments
  v2 — Published 2025-10-15 — 45 active assignments
  v3.draft — Never published — 0 assignments
```

**Assignment tracking:**

```json
{
  "id": "assignment-uuid",
  "templateId": "template-uuid",
  "templateVersion": "v2",  // Pinned to v2 at time of assignment
  "employeeId": "emp-uuid",
  "assignedAt": "2025-10-15T16:30:00Z",
  "assignedBy": "manager-uuid",
  "dueDate": "2026-01-15",
  "status": "IN_PROGRESS",
  
  // Snapshot of v2 at time of assignment (immutable)
  "templateSnapshot": {
    "name": "CPR Certification Renewal",
    "requirements": [
      {
        "name": "CPR Card",
        "attestationLevels": ["upload_validated"],
        "validityDays": 365
      }
    ]
  }
}
```

### 7.3 Historical Reconstruction

To audit an assignment from 2 years ago:

```
GET /api/assignments/{id}/template-version
→ Returns exact requirements that were in force when assigned
→ Includes all requirement details, attestation levels, validity periods
→ Links to approval audit trail from that time period
```

---

## 8. Template Retirement & Migration

### 8.1 Deprecation → Retirement Timeline

```
ACTIVE (v2 published)
  ↓
T+0: Deprecation decision made
  ├─ Compliance Officer: "v2 replaced by v3"
  ├─ Create deprecation plan
  ├─ Audit entry: template:deprecation_planned
  └─ Email managers: "v2 deprecated effective 3/1/2026"
  ↓
T+30 days: Deprecation effective
  ├─ Set status = DEPRECATED
  ├─ No new assignments to v2 allowed
  ├─ Existing assignments continue
  ├─ Audit entry: template:status_changed_to_deprecated
  └─ Grace period starts (90 days)
  ↓
T+120 days: Retirement effective (30 days after grace period)
  ├─ Set status = RETIRED
  ├─ No changes allowed to v2
  ├─ No new proofs can be submitted for v2 requirements
  ├─ Archive all v2 assignments
  ├─ Audit entry: template:status_changed_to_retired
  └─ Assign 7-year retention lock
  ↓
T+7 years: Data retention expires
  ├─ Deletion job runs
  ├─ Audit entry: data:template_v2_retention_expired
  └─ Archive to cold storage
```

### 8.2 Migration Guidance

When a template is deprecated, provide migration path:

```json
{
  "deprecationPlan": {
    "currentVersion": "v2",
    "deprecationEffectiveDate": "2026-03-01",
    "retirementDate": "2026-06-01",
    "retirementGracePeriodDays": 90,
    
    "migrationPath": {
      "recommendedVersion": "v3",
      "rationale": "v3 adds AED certification per new OSHA 1910.1000 update",
      "whatChanged": [
        "CPR Card attestation: upload → upload_validated",
        "Added AED Certification (new OSHA requirement)"
      ],
      "automigrationAvailable": false,
      "manualMigrationSteps": [
        "1. Create new assignment with v3 template",
        "2. Employee completes new attestations",
        "3. Manager retires v2 assignment"
      ]
    },
    
    "impactedAssignments": {
      "totalAssignmentsV2": 45,
      "assignedTo": [
        { "department": "Clinical", "count": 30 },
        { "department": "Operations", "count": 15 }
      ],
      "dueByMigration": "2026-05-01",
      "notificationSchedule": [
        { "date": "2026-03-01", "message": "Deprecation effective" },
        { "date": "2026-04-01", "message": "30 days until retirement" },
        { "date": "2026-05-15", "message": "14 days until v2 no longer accepts proofs" }
      ]
    }
  }
}
```

---

## 9. RBAC Implications

### 9.1 Template Permissions

```
templates:create
  └─ MANAGER+ can create new templates in DRAFT
  
templates:edit:draft
  └─ MANAGER+ can edit their own DRAFT templates
  
templates:edit:published
  └─ ❌ NOT ALLOWED — must clone first
  
templates:publish
  └─ MANAGER+ can publish (after CO review)
  
templates:review:submit
  └─ MANAGER+ can submit DRAFT for review
  
templates:review:approve
  └─ COMPLIANCE_OFFICER can approve/reject reviews
  └─ Cannot approve own submissions (prevented in code)
  
templates:publish:force
  └─ ADMIN only — force-publish without CO review
  └─ Requires dual approval (ADMIN + CO)
  
templates:deprecate
  └─ COMPLIANCE_OFFICER can deprecate active templates
  
templates:retire
  └─ ADMIN only — retire a template
  └─ Requires CO sign-off
  
templates:delete
  └─ ADMIN only — delete DRAFT templates
  └─ Cannot delete published templates
```

---

## 10. Risk Assessment

### 10.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **Regulatory mismatch** | Template drifts from current regulation (e.g., OSHA updates) | Quarterly regulatory scan + alert workflow |
| **Unauthorized template change** | Admin unilaterally changes requirement without review | 4-eyes approval + audit trail enforcement |
| **Lost version history** | Cannot reconstruct what template v2 required when assigned | Immutable versioning + assignment snapshots |
| **Active assignment data loss** | Delete published template; break 347 active assignments | Soft delete only; retain audit trail for 7 years |
| **Retirement gap** | Employees continue using outdated requirement after retirement | Grace period + notification schedule + hard stop date |
| **Clone-and-publish loop** | Manager creates v2.draft, CO approves, manager doesn't publish, confusion | Status tracking: APPROVED → must publish within 7 days or withdraw |

---

## 11. Mitigation Controls

### 11.1 Database-Level Controls

```sql
-- Published templates are immutable
CREATE TRIGGER template_immutability_check
  BEFORE UPDATE ON proof_templates
  FOR EACH ROW
  WHEN (OLD.status = 'PUBLISHED')
  EXECUTE FUNCTION prevent_template_modification();

-- Prevent deletion of published templates
CREATE TRIGGER template_delete_protection
  BEFORE DELETE ON proof_templates
  FOR EACH ROW
  WHEN (OLD.status IN ('PUBLISHED', 'DEPRECATED'))
  EXECUTE FUNCTION prevent_template_deletion();

-- Version increment on publish
ALTER TABLE proof_templates ADD CONSTRAINT version_increment_check
  CHECK (
    -- Version must increment by exactly 1
    version = 1 OR 
    (version > previousVersion AND version = previousVersion + 1)
  );
```

### 11.2 Application-Level Controls

1. **Immutability enforcer** — Service method checks template status before allowing PATCH
2. **Review request engine** — Auto-creates change request; prevents publish without approval
3. **Regulatory scanner** — Quarterly job flags outdated citations
4. **Version snapshots** — Every assignment stores template snapshot (readonly)
5. **Deprecation scheduler** — Automated email notifications per schedule

### 11.3 Infrastructure Controls

1. **Template backup immutability** — Backups stored in append-only blob containers
2. **Audit log integrity** — Hash chain ensures template audit entries cannot be modified
3. **Change request retention** — 7-year retention for all review requests + approvals
4. **Approval signature verification** — HMAC-SHA256 of approval decisions

---

## 12. Phased Rollout

### Phase 1: Core Immutability & Versioning (Months 1-2)

- [ ] Implement version numbering (v1, v2, v3, ...)
- [ ] Add status field (DRAFT, PUBLISHED, DEPRECATED, RETIRED)
- [ ] Enforce immutability on PUBLISHED templates (no PATCH allowed)
- [ ] Store template snapshot in every assignment
- [ ] Test versioning with 3 templates across 50 assignments

**Success Criteria:**
- Published templates cannot be modified (PATCH returns 409 Conflict)
- Each assignment can retrieve exact template version at assignment time
- Version history query returns all changes with actors/timestamps

### Phase 2: Change Control & 4-Eyes Review (Months 2-3)

- [ ] Implement review request workflow (DRAFT → PENDING_REVIEW → APPROVED/REJECTED → PUBLISHED)
- [ ] Enforce 4-eyes: submitter ≠ approver
- [ ] Build approval email + signature workflow
- [ ] Test approval workflow: 5 templates through full cycle
- [ ] Load-test with 100 concurrent review requests

**Success Criteria:**
- Self-reviews are blocked (submitter cannot be approver)
- Approval email delivered within 5 minutes
- Publish fails if not approved (status check enforced)

### Phase 3: Regulatory Alignment & Audits (Months 3-4)

- [ ] Build regulatory citation mapping (template → regulations)
- [ ] Implement quarterly regulatory scan job
- [ ] Create alert workflow (CO notified of regulatory updates)
- [ ] Build diff viewer (v1 ↔ v2 regulatory comparison)
- [ ] Run first regulatory scan; resolve 5 flagged templates

**Success Criteria:**
- Regulatory scanner completes scan in < 1 hour
- Regulatory updates detected and flagged within 48 hours of publication
- Diff viewer shows exact requirement changes between versions

### Phase 4: Deprecation & Retirement Workflow (Months 4-5)

- [ ] Implement DEPRECATED status + grace period
- [ ] Build deprecation notification schedule
- [ ] Implement RETIRED status + hard stop date
- [ ] Pilot: deprecate 1 template, migrate all 20 assignments to new version
- [ ] Verify no new proofs accepted on RETIRED template

**Success Criteria:**
- Deprecation effective date enforced (no new assignments)
- Notification emails sent per schedule (30, 60, 90 days)
- RETIRED template rejects all new proof submissions

### Phase 5: Auditor Readiness & Compliance (Months 5-6)

- [ ] Create auditor runbook: "Verify template governance"
- [ ] Conduct pilot audit with external auditor
- [ ] Address auditor feedback
- [ ] Deploy to production with full monitoring
- [ ] Schedule quarterly auditor attestation

**Success Criteria:**
- External auditor validates 4-eyes control
- Version history is complete and unbroken
- All template changes have approval audit trails

---

## Appendix: Template Governance Checklist

### Pre-Deployment

- [ ] All published templates have version numbers
- [ ] All assignments store template snapshot (immutable copy)
- [ ] Review request workflow blocks self-approval
- [ ] Regulatory citations mapped for 5 key templates
- [ ] Deprecation notification schedule created
- [ ] Audit entries for all template state changes
- [ ] Test: attempt to PATCH published template → expect 409 Conflict

### Post-Deployment

- [ ] Monitor approval time (goal: CO review within 5 business days)
- [ ] Quarterly regulatory scan (check 10+ frameworks)
- [ ] Monitor deprecation grace period (goal: 90% of assignments migrated by deadline)
- [ ] Audit template version mismatch (goal: 0 assignments with unknown template version)

---

**Document Status:** Draft → Ready for Review → Approved by Legal/Compliance  
**Last Updated:** 2026-03-21  
**Next Review:** 2026-09-21 (6-month cycle)
