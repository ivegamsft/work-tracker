# Standards Customization & Override Compliance — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-21  
> **Issue:** [#103 — Standards customization, layered exemptions, and override authority matrix](https://github.com/ivegamsft/work-tracker/issues/103)  
> **Applies To:** Standards module (`apps/api/src/modules/standards`), customization layers, exemption workflows  
> **Companion Docs:** [Templates & Attestation Spec](./templates-attestation-spec.md) · [Compliance Audit Events](./compliance-audit-events.md) · [Template Governance](./template-governance.md)  
> **Regulatory Scope:** SOX IT controls, HIPAA minimum necessary, industry flexibility (OSHA permitting, FAA certificates)  
> **Locked Decisions:** Decision 4 (Lock regulatory/flex custom), Decision 5 (L1-L4 attestation), Decision 6 (Full overrides with audit)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Standards Hierarchy & Customization Layers](#2-standards-hierarchy--customization-layers)
3. [Regulatory vs. Custom Standards](#3-regulatory-vs-custom-standards)
4. [Exemption & Override Authority Matrix](#4-exemption--override-authority-matrix)
5. [Layered Audit Trail](#5-layered-audit-trail)
6. [Exemption Classification & Validation](#6-exemption-classification--validation)
7. [Dual-Approval for Regulatory Overrides](#7-dual-approval-for-regulatory-overrides)
8. [Override Expiration & Review Cycles](#8-override-expiration--review-cycles)
9. [RBAC Implications](#9-rbac-implications)
10. [Risk Assessment](#10-risk-assessment)
11. [Mitigation Controls](#11-mitigation-controls)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Overview

### What Is Standards Customization?

A **compliance standard** defines baseline requirements for a regulated industry (e.g., OSHA 1910.1000 — hazardous substance exposure limits). But regulations are often written with flexibility:

- **"Employers MAY implement equivalent controls"** (regulatory discretion)
- **"Certifications OR equivalent experience accepted"** (alternative compliance)
- **"State standards may be more stringent"** (jurisdictional variance)

**Customization** allows organizations to:
1. **Tighten** requirements (e.g., "CPR every 12 months" when OSHA allows 24)
2. **Relax** requirements (e.g., "waive background check for low-risk roles")
3. **Substitute** requirements (e.g., "accept online training instead of in-person")
4. **Add** non-regulatory requirements (e.g., "company culture training")
5. **Exempt** individuals (e.g., "John's role doesn't require CPR")

But customization introduces compliance risk: regulators can challenge an organization claiming "OSHA equivalent" when they diverge. **Standards customization spec** defines:
- **Which standards are locked** (no customization allowed)
- **Which are flexible** (customization permitted)
- **Who can approve** customizations (authority matrix)
- **What audit trail** proves the customization was justified
- **When to re-certify** customizations

### Locked Decision Context

**Decision 4 — Lock regulatory/flex custom:** Regulatory standards (OSHA, Joint Commission) are immutable baseline; organizations can add/modify custom standards. Regulatory overrides require dual approval.

**Decision 5 — L1-L4 attestation:** Each requirement specifies minimum attestation level (self-attest, upload, third-party, validated).

**Decision 6 — Full overrides with audit:** All four override types (expiration extension, proof override, requirement waiver, grace period) supported with full audit trail + approval chain.

---

## 2. Standards Hierarchy & Customization Layers

### 2.1 Four-Layer Model

```
┌────────────────────────────────────────────────────────────┐
│ GLOBAL BASELINE — Regulatory Standard (Immutable)           │
│ E.g., OSHA 1910.1000, Joint Commission HR.01500            │
│ Properties:                                                 │
│  - isLocked: true (cannot delete/modify requirements)      │
│  - minAttestationLevel: L3 or L4 minimum (high rigor)      │
│  - jurisdiction: "Federal" or state-specific               │
│  - lastUpdateFromRegulator: 2025-12-01                     │
│  - customizationAllowed: false (locked by design)          │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ ORGANIZATION LAYER — Org Policy & Flexibility              │
│ E.g., "MyHealthcare Corp's OSHA 1910.1000 implementation"  │
│ Properties:                                                 │
│  - baseStandardId: OSHA-1910-1000 (immutable reference)   │
│  - customizations: [                                       │
│      {req: "hazmat_training", attestationLevel: L4 }       │
│      {req: "medical_clearance", added: true, new_level: L2}│
│    ]                                                       │
│  - customizationApprovedBy: [compliance-officer, admin]   │
│  - approvedDate: 2025-03-15                               │
│  - nextReviewDate: 2026-03-15                             │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ DEPARTMENT LAYER — Dept-Specific Variance                  │
│ E.g., "Clinical Ops dept additional background check"      │
│ Properties:                                                 │
│  - departmentId: "clinical-ops"                            │
│  - organizationStandardId: org-custom-standard-uuid        │
│  - departmentCustomizations: [                             │
│      {req: "enhanced_background_check", added: true}       │
│    ]                                                       │
│  - approvedBy: [manager-uuid, compliance-officer]          │
│  - approvedDate: 2025-04-01                               │
│  - nextReviewDate: 2026-04-01                             │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ INDIVIDUAL LAYER — Person-Specific Exemptions              │
│ E.g., "John Doe exempt from medical clearance (retired MD)"│
│ Properties:                                                 │
│  - employeeId: "john-uuid"                                │
│  - requirementId: "medical-clearance"                      │
│  - exemptionType: "due_to_prior_qualification"            │
│  - justification: "40-year medical career; MOH license"    │
│  - exemptionStartDate: 2025-05-01                         │
│  - exemptionEndDate: null (indefinite, annual review)      │
│  - approvedBy: [manager-uuid, compliance-officer]          │
│  - reviewDueDate: 2026-05-01                              │
│  - status: "APPROVED"                                      │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Inheritance Rules

Requirements **inherit down** (and can be overridden at each layer):

```
OSHA 1910.1000 requires:
  • Hazmat Training (L2)
  • Medical Clearance (L3)
  
  ↓ [ORG LAYER — MyHealthcare Corp]
  
  MyHealthcare implements:
  • Hazmat Training (L3 — tighter than OSHA)
  • Medical Clearance (L3 — same as OSHA)
  • ADD: Annual ethics training (company policy, L1)
  
  ↓ [DEPT LAYER — Clinical Ops]
  
  Clinical Ops adds:
  • All above (inherited)
  • Enhanced background check (L4 — new)
  • Medical Clearance (L4 — tighter than org, L3 OSHA)
  
  ↓ [INDIVIDUAL LAYER — John Doe]
  
  John's record:
  • All above
  • EXCEPT: Medical Clearance (EXEMPTED — retired MD)
  • Add: Annual MOH license verification (L2 substitute)
```

**Override rules:**
- **Lock regulatory:** Org cannot relax OSHA L2 to L1
- **Flex custom:** Org can tighten OSHA L2 to L3
- **Flex custom:** Org can add new requirements (non-regulatory)
- **Lock org standards:** Dept cannot relax org customization
- **Flex org:** Dept can tighten org customization
- **Flex individual:** Compliance Officer can exempt individual with justification

---

## 3. Regulatory vs. Custom Standards

### 3.1 Standard Classification

Every standard is classified:

```json
{
  "id": "standard-uuid",
  "name": "OSHA 1910.1000 — Hazardous Substances",
  
  "classification": {
    "type": "REGULATORY",  // REGULATORY | CUSTOM
    "isLocked": true,      // true = immutable; false = flexible
    "jurisdiction": "federal",
    "regulator": "OSHA"
  },
  
  "if_regulatory": {
    "regulatoryAuthority": "OSHA",
    "regoryCode": "1910.1000",
    "jurisdiction": "United States — Federal",
    "effectiveDate": "1978-01-01",
    "lastUpdatedByRegulator": "2025-11-15",
    "customizationAllowed": false,  // Regulatory = locked
    "requirementsCanBeAdded": false,  // Cannot add to regulatory
    "requirementsCanBeRemoved": false, // Cannot remove from regulatory
    "attestationLevelCanBeRelaxed": false,  // Cannot reduce L3 to L2
    "attestationLevelCanBeTightened": true   // Can increase L2 to L3
  },
  
  "if_custom": {
    "customizationAllowed": true,
    "baseStandardId": null,  // If null = org-created; if set = copy of regulatory
    "createdBy": "compliance-officer-uuid",
    "createdDate": "2025-03-15",
    "requirementsCanBeAdded": true,
    "requirementsCanBeRemoved": true,
    "requirementsCanBeModified": true,
    "attestationLevelCanBeAdjusted": true
  },
  
  "auditTrail": {
    "lastReviewDate": "2025-12-01",
    "nextReviewDate": "2026-12-01",  // Annual for regulatory
    "reviewCycle": "annual",
    "lastReviewedBy": "compliance-officer-uuid",
    "reviewNotes": "Alignment verified against OSHA 1910.1000 revision 2025-11"
  }
}
```

### 3.2 Lock Enforcement

At the API level, enforce immutability of regulatory standards:

```javascript
async updateStandardRequirement(standardId, reqId, patch) {
  const standard = await this.db.standard.findUnique(standardId);
  
  // Regulatory standards = read-only
  if (standard.isLocked && standard.classification === 'REGULATORY') {
    throw new ForbiddenError(
      `Cannot modify regulatory standard ${standard.name}. ` +
      `Create a custom standard or org layer customization instead.`
    );
  }
  
  // Custom standards = allow modification with audit trail
  if (standard.classification === 'CUSTOM') {
    await this.auditLog.log({
      action: 'standard_requirement:modified',
      standardId,
      before: requirement,
      after: patch,
      actor: userId
    });
  }
}
```

---

## 4. Exemption & Override Authority Matrix

### 4.1 Who Can Approve What?

```
╔══════════════════════════════════════════════════════════════════════════╗
║ AUTHORITY MATRIX — Exemptions & Overrides                               ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Action                   │ Org Std │ Dept Std │ Individual │ Approval   ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Tighten custom req       │ CO      │ Mgr+CO   │ N/A        │ Single     ║
║ Relax custom req         │ CO+ADMIN│ CO+ADMIN │ N/A        │ Dual       ║
║ Relax REGULATORY req     │ ❌      │ ❌       │ N/A        │ Denied     ║
║ Add custom req           │ CO      │ Mgr+CO   │ N/A        │ Single     ║
║ Remove custom req        │ CO+ADMIN│ CO+ADMIN │ N/A        │ Dual       ║
║ Override attestation lvl │ CO+ADMIN│ CO+ADMIN │ CO         │ Dual/Single║
║ (Tighten)               │         │          │            │            ║
║ Override attestation lvl │ ❌      │ ❌       │ N/A        │ Denied     ║
║ (Relax regulatory)       │         │          │            │            ║
║ Grant exemption          │ N/A     │ N/A      │ CO         │ Single     ║
║ Override proof complete  │ N/A     │ N/A      │ CO         │ Single     ║
║ Extend expiration        │ N/A     │ N/A      │ Mgr or CO  │ Single     ║
║ Grace period             │ N/A     │ N/A      │ Mgr        │ Single*    ║
║ * Max 30 days            │         │          │            │            ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 4.2 Supervisor Overrides (Limited Scope)

**Manager can approve LIMITED overrides for direct reports:**

```json
{
  "overrideType": "expiration_extend",
  "approvableBy": ["MANAGER", "SUPERVISOR"],
  "maxExtension": 30,  // days
  "requires_justification": true,
  "requires_co_approval_if": "extension_exceeds_90_days",
  "example": {
    "employee": "John Doe",
    "requirement": "CPR Certification",
    "currentExpiry": "2026-03-31",
    "requestedNewExpiry": "2026-04-15",
    "extension_days": 15,
    "reason": "In-person training scheduled for 4/12; certificate expected by 4/15",
    "approved_by": "manager-uuid",
    "approved_at": "2026-03-20T10:00:00Z",
    "approval_chain": ["manager-uuid"],
    "audit_entry": "override:expiration_extended"
  }
}
```

### 4.3 Compliance Officer Overrides (Full Authority)

**CO can approve ALL override types with full audit trail:**

```json
{
  "overrideId": "override-uuid",
  "overrideType": "requirement_waived",
  "approvableBy": ["COMPLIANCE_OFFICER"],
  
  "employee": "Jane Smith",
  "requirement": "Background Check",
  "waiverJustification": {
    "type": "equivalent_qualification",
    "details": "20-year veteran with top-secret clearance; background check not required",
    "supporting_docs": ["TS-clearance-letter-2024.pdf"]
  },
  
  "waiver_start": "2026-03-20",
  "waiver_end": "2027-03-20",  // 1-year default
  "review_cadence": "annual",
  "next_review_date": "2027-03-20",
  
  "approved_by": "compliance-officer-uuid",
  "approved_at": "2026-03-20T14:30:00Z",
  
  "audit_entry": {
    "action": "override:requirement_waived",
    "actor": "compliance-officer-uuid",
    "entityType": "EmployeeRequirementOverride",
    "recordId": "override-uuid",
    "reason": "Employee holds equivalent federal clearance"
  }
}
```

### 4.4 Regulatory Override Restrictions

**No one can relax a REGULATORY requirement without federal exemption:**

```
❌ FORBIDDEN:
  PATCH /api/standards/osha-1910-1000/requirements/hazmat-training
  { "minimumAttestationLevel": "L1" }
  
  Error: Cannot relax regulatory requirement below OSHA minimum
  
✅ ALLOWED (Tighten):
  PATCH /api/standards/{orgCustomId}/requirements/hazmat-training
  { "minimumAttestationLevel": "L4" }
  (Creates org-level override; OSHA requirement stays at L2)
```

---

## 5. Layered Audit Trail

### 5.1 Audit Entry per Customization Layer

Every layer generates its own audit entries:

**Level 1: REGULATORY (Global Baseline)**
```json
{
  "action": "standard:regulatory_published",
  "timestamp": "2025-12-01T00:00:00Z",
  "entityType": "ComplianceStandard",
  "recordId": "osha-1910-1000",
  "after": {
    "name": "OSHA 1910.1000 — Hazardous Substances",
    "regulation": "OSHA",
    "isLocked": true,
    "requirementCount": 15
  }
}
```

**Level 2: ORGANIZATION (Org Policy)**
```json
{
  "action": "standard:org_customization_created",
  "timestamp": "2025-03-15T10:00:00Z",
  "actor": "compliance-officer-uuid",
  "entityType": "OrgStandardCustomization",
  "recordId": "org-custom-osha-1910-1000",
  "after": {
    "baseStandardId": "osha-1910-1000",
    "organizationId": "org-uuid",
    "customizations": [
      {
        "requirementId": "hazmat-training",
        "change": "tighten_attestation",
        "from": "L2",
        "to": "L4",
        "reason": "Corporate policy — all hazmat training requires validation"
      }
    ],
    "approvedBy": ["compliance-officer-uuid", "admin-uuid"],
    "approvedDate": "2025-03-15T10:00:00Z"
  }
}
```

**Level 3: DEPARTMENT (Dept Variance)**
```json
{
  "action": "standard:dept_customization_created",
  "timestamp": "2025-04-01T09:00:00Z",
  "actor": "manager-uuid",
  "entityType": "DeptStandardCustomization",
  "recordId": "dept-custom-clinical-ops",
  "after": {
    "departmentId": "clinical-ops",
    "organizationStandardId": "org-custom-osha-1910-1000",
    "customizations": [
      {
        "requirementId": "enhanced-background-check",
        "type": "added",
        "newRequirement": {
          "name": "Enhanced Background Check",
          "minimumAttestationLevel": "L4",
          "justification": "Patient-facing staff; higher risk"
        }
      }
    ],
    "approvedBy": ["manager-uuid", "compliance-officer-uuid"],
    "approvedDate": "2025-04-01T09:00:00Z"
  }
}
```

**Level 4: INDIVIDUAL (Person-Specific Exemption)**
```json
{
  "action": "override:requirement_exempted",
  "timestamp": "2025-05-01T10:00:00Z",
  "actor": "compliance-officer-uuid",
  "entityType": "EmployeeOverride",
  "recordId": "override-john-medical-clearance",
  "after": {
    "employeeId": "john-uuid",
    "requirementId": "medical-clearance",
    "exemptionType": "due_to_prior_qualification",
    "justification": "40-year medical career; current MOH license",
    "exemptionStartDate": "2025-05-01",
    "exemptionEndDate": null,
    "reviewDate": "2026-05-01",
    "status": "APPROVED",
    "approvedBy": "compliance-officer-uuid"
  }
}
```

### 5.2 Audit Trail Query

Compliance officer can audit entire customization chain for an employee:

```
GET /api/standards/{standardId}/audit-trail?employeeId={empId}&requirementId={reqId}
```

Response shows all layers:

```json
{
  "requirementId": "hazmat-training",
  "auditChain": [
    {
      "layer": "REGULATORY",
      "standard": "OSHA 1910.1000",
      "minimumAttestationLevel": "L2",
      "source": "Federal regulation",
      "effectiveDate": "1978-01-01",
      "lastUpdated": "2025-11-15"
    },
    {
      "layer": "ORGANIZATION",
      "customization": "Tighten to L4",
      "approvedBy": "compliance-officer-uuid",
      "approvedDate": "2025-03-15",
      "reason": "Corporate policy — all hazmat training requires validation",
      "effectiveDate": "2025-04-01"
    },
    {
      "layer": "DEPARTMENT",
      "customization": "Clinical Ops — same as org (L4)",
      "inheritedFrom": "ORGANIZATION",
      "departmentId": "clinical-ops",
      "effectiveDate": "2025-04-01"
    },
    {
      "layer": "INDIVIDUAL",
      "override": "No override",
      "employeeId": "emp-uuid",
      "status": "NOT_OVERRIDDEN",
      "effectiveRequirement": "L4 (from ORGANIZATION)"
    }
  ],
  "summary": {
    "baseRequirement": "OSHA L2",
    "effectiveRequirement": "Organization L4",
    "employee_status": "not_exempt"
  }
}
```

---

## 6. Exemption Classification & Validation

### 6.1 Valid Exemption Categories

Compliance Officer must select an exemption type with supporting evidence:

```json
{
  "exemptionType": "equivalent_qualification",  // Enum
  "validCategories": [
    {
      "code": "equivalent_qualification",
      "name": "Equivalent Prior Qualification",
      "description": "Employee has credential equivalent to requirement",
      "requiresDocumentation": true,
      "exampleDocs": ["license.pdf", "certification.pdf"],
      "reviewCadence": "annual",
      "maxDuration": null  // indefinite
    },
    {
      "code": "medical_contraindication",
      "name": "Medical Contraindication",
      "description": "Employee cannot safely fulfill requirement (medical reason)",
      "requiresDocumentation": true,
      "exampleDocs": ["doctor-letter.pdf", "ADA-accommodation.pdf"],
      "reviewCadence": "annual",
      "maxDuration": null
    },
    {
      "code": "regulatory_exemption",
      "name": "Regulatory Exemption",
      "description": "Requirement exempted by regulation or agency decision",
      "requiresDocumentation": true,
      "exampleDocs": ["osha-variance.pdf", "fda-waiver.pdf"],
      "reviewCadence": "per_exemption_terms",
      "maxDuration": null
    },
    {
      "code": "role_not_applicable",
      "name": "Role Not Applicable",
      "description": "Employee's role does not require this qualification",
      "requiresDocumentation": false,
      "exampleDocs": [],
      "reviewCadence": "on_role_change",
      "maxDuration": null
    },
    {
      "code": "grace_period",
      "name": "Grace Period",
      "description": "Temporary extension while completing requirement",
      "requiresDocumentation": false,
      "exampleDocs": [],
      "reviewCadence": "per_grace_period",
      "maxDuration": 30  // days
    },
    {
      "code": "temporary_reassignment",
      "name": "Temporary Reassignment",
      "description": "Requirement not needed while on temporary assignment",
      "requiresDocumentation": true,
      "exampleDocs": ["reassignment-letter.pdf"],
      "reviewCadence": "on_reassignment_end",
      "maxDuration": null
    }
  ]
}
```

### 6.2 Exemption Validation Rules

```javascript
async validateExemption(exemption) {
  const category = this.exemptionCategories[exemption.exemptionType];
  
  // Documentation required?
  if (category.requiresDocumentation && !exemption.documentationUrl) {
    throw new ValidationError(
      `${exemption.exemptionType} requires supporting documentation`
    );
  }
  
  // Duration limit?
  if (category.maxDuration) {
    const durationDays = 
      (new Date(exemption.exemptionEndDate) - 
       new Date(exemption.exemptionStartDate)) / (1000 * 60 * 60 * 24);
    
    if (durationDays > category.maxDuration) {
      throw new ValidationError(
        `${exemption.exemptionType} cannot exceed ${category.maxDuration} days`
      );
    }
  }
  
  // Review due date
  const reviewDueDate = new Date(exemption.exemptionStartDate);
  reviewDueDate.setFullYear(reviewDueDate.getFullYear() + 1);
  exemption.reviewDueDate = reviewDueDate;
}
```

---

## 7. Dual-Approval for Regulatory Overrides

### 7.1 Mandatory Dual-Approval Scenarios

These actions require **two distinct approvers**:

| Action | Approver 1 | Approver 2 | Why |
|--------|-----------|-----------|-----|
| Relax custom requirement | COMPLIANCE_OFFICER | ADMIN | Dual: rigor + authority |
| Override attestation level (tighten) | COMPLIANCE_OFFICER | ADMIN | Dual: policy + governance |
| Grant indefinite exemption | COMPLIANCE_OFFICER | MANAGER | Dual: compliance + ownership |
| Waive regulatory requirement | ❌ | ❌ | **NEVER** — regulatory cannot be waived |
| Force-override proof complete | COMPLIANCE_OFFICER | ADMIN | Dual: strong separation of duties |

### 7.2 Dual-Approval Workflow

```
[Employee: John Doe needs exemption from "Background Check"]
  ↓
Step 1: Request Submitted
  Supervisor requests: "John is retired FBI; has top-secret clearance"
  Audit entry: "override:exemption_requested"
  ↓
Step 2: First Approval (Compliance Officer)
  CO reviews: "Top-secret clearance is higher than background check requirement"
  CO approves in principle
  Status: APPROVED_BY_CO (pending second approval)
  Audit entry: "override:exemption_approved_co"
  ↓
Step 3: Second Approval (Admin)
  Admin reviews: "CO approved; exemption duration justified"
  Admin signs off
  Status: APPROVED_BY_ADMIN
  Audit entry: "override:exemption_approved_admin"
  ↓
Step 4: Exemption Activated
  Employee's background check requirement is waived
  Exemption effective immediately
  Review due: 1 year from approval date
  ↓
Step 5: Annual Review
  [Automated]: Compliance Officer reviews at expiration
  "John still employed, still has TS clearance"
  CO re-approves (or revokes if circumstances change)
```

### 7.3 Dual-Approval Audit Entries

```json
{
  "action": "override:exemption_requested",
  "timestamp": "2026-03-19T10:00:00Z",
  "actor": "manager-uuid",
  "entityType": "EmployeeOverride",
  "recordId": "override-uuid",
  "status": "PENDING",
  "after": {
    "employeeId": "john-uuid",
    "requirementId": "background-check",
    "exemptionType": "equivalent_qualification",
    "justification": "Retired FBI with top-secret clearance",
    "submittedBy": "manager-uuid"
  }
}

{
  "action": "override:exemption_approved_co",
  "timestamp": "2026-03-20T09:00:00Z",
  "actor": "compliance-officer-uuid",
  "status": "APPROVED_BY_CO_PENDING_ADMIN",
  "after": {
    "status": "APPROVED_BY_CO_PENDING_ADMIN",
    "approvedBy_CO": "compliance-officer-uuid",
    "coApprovedAt": "2026-03-20T09:00:00Z",
    "coNotes": "TS clearance supersedes background check requirement"
  }
}

{
  "action": "override:exemption_approved_admin",
  "timestamp": "2026-03-20T14:30:00Z",
  "actor": "admin-uuid",
  "status": "APPROVED_FINAL",
  "after": {
    "status": "APPROVED",
    "approvedBy_ADMIN": "admin-uuid",
    "adminApprovedAt": "2026-03-20T14:30:00Z",
    "adminNotes": "Dual approval complete; exemption activated",
    "exemptionEffectiveDate": "2026-03-20",
    "reviewDueDate": "2027-03-20"
  }
}
```

---

## 8. Override Expiration & Review Cycles

### 8.1 Automatic Override Expiration

Exemptions expire after max duration and must be re-approved:

```sql
-- Daily job: Expire old overrides
UPDATE employee_overrides
SET status = 'EXPIRED'
WHERE 
  exemptionEndDate <= CURRENT_DATE
  AND status = 'APPROVED';

-- Trigger notification for re-approval
INSERT INTO notifications (
  userId, type, message, actionUrl
) SELECT
  e.id,
  'override_expiration',
  'Override for ' || req.name || ' expired. Requires re-approval.',
  '/compliance/overrides/' || eo.id
FROM employee_overrides eo
JOIN employees e ON eo.employeeId = e.id
JOIN standard_requirements req ON eo.requirementId = req.id
WHERE eo.status = 'EXPIRED' AND eo.status_was = 'APPROVED';
```

### 8.2 Override Review Checklist

When an override is about to expire, generate a review checklist:

```
OVERRIDE REVIEW — Background Check Exemption for John Doe
Due: 2027-03-20

Original Exemption: John has retired FBI with top-secret clearance
Original Approval Date: 2026-03-20

Current Review (2027-03-01):

☐ Verify employee still employed: [Active / Terminated / On Leave]
☐ Verify circumstances unchanged:
    ☐ Still has top-secret clearance? [Yes / No]
    ☐ Any regulatory changes? [Yes / No]
☐ Decision:
    ☐ Re-approve for 1 more year
    ☐ Revoke (new requirement) — [Reason]
    ☐ Modify terms (e.g., add annual TLS verification) — [Terms]

Reviewed by: _________________________ [CO Name]
Date: ________________
Signature: _________________________
```

---

## 9. RBAC Implications

### 9.1 Customization Permissions

```
standards:read
  └─ All roles can view current standards & requirements
  
standards:create:custom
  └─ COMPLIANCE_OFFICER can create new custom standards
  
standards:customize:org_layer
  └─ COMPLIANCE_OFFICER can add/modify org customizations
  
standards:customize:dept_layer
  └─ MANAGER can add/modify dept customizations (own dept)
  
standards:customize:individual_layer
  └─ COMPLIANCE_OFFICER can grant individual exemptions
  
standards:override:relax_custom
  └─ COMPLIANCE_OFFICER + ADMIN (dual) required
  
standards:override:relax_regulatory
  └─ ❌ NOT ALLOWED (enforced in code)
  
standards:review:exemptions
  └─ COMPLIANCE_OFFICER reviews annual expirations
  
standards:approve:regulatory_changes
  └─ COMPLIANCE_OFFICER reviews quarterly regulatory updates
```

---

## 10. Risk Assessment

### 10.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **Unauthorized customization** | Admin adds requirement without approval | Single-actor checks; dual-approval for relax |
| **Regulatory violation** | Org relaxes regulatory requirement (OSHA violation) | Immutable lock on regulatory standards |
| **Override creep** | Too many exemptions; standard becomes unenforceable | Review cadence + override inventory + audit |
| **Outdated exemptions** | Exemptions never expire; employee still exempt year later | Annual review + auto-expiration enforcement |
| **Loss of audit trail** | Cannot prove why exemption was granted | Full audit trail per layer + change log |
| **Unauthorized relax** | Manager relaxes requirement without CO input | Dual-approval requirement enforced in DB |

---

## 11. Mitigation Controls

### 11.1 Database-Level Controls

```sql
-- Regulatory standards immutable
CREATE TRIGGER regulatory_standard_immutable
  BEFORE UPDATE ON compliance_standards
  FOR EACH ROW
  WHEN (OLD.classification = 'REGULATORY')
  EXECUTE FUNCTION prevent_regulatory_modification();

-- Override expiration enforcement
CREATE TRIGGER override_expiration_check
  BEFORE UPDATE OF status ON employee_overrides
  FOR EACH ROW
  WHEN (NEW.status = 'APPROVED')
  EXECUTE FUNCTION set_override_expiration_date();

-- Dual-approval enforcement
CREATE TRIGGER dual_approval_required
  BEFORE UPDATE OF status ON employee_overrides
  FOR EACH ROW
  WHEN (NEW.status = 'APPROVED' AND NEW.requiresDualApproval = true)
  EXECUTE FUNCTION verify_dual_approval();
```

### 11.2 Application-Level Controls

1. **Standard type validator** — Check regulatory flag before allowing edits
2. **Override duration enforcer** — Validate against maxDuration per category
3. **Dual-approval engine** — Prevent status change if second approver hasn't signed
4. **Annual review scheduler** — Alert CO to upcoming expirations
5. **Customization audit generator** — Log all standard changes per layer

### 11.3 Infrastructure Controls

1. **Immutable standard snapshots** — Archive published standards versions
2. **Override audit trail** — Hash-chain integrity on all override audit entries
3. **Regulatory database sync** — Weekly pull from OSHA/FAA/JCO to detect updates
4. **Backup immutability** — Database backups stored in append-only containers

---

## 12. Phased Rollout

### Phase 1: Customization Layers & Org Standard (Months 1-2)

- [ ] Implement 4-layer hierarchy (global → org → dept → individual)
- [ ] Add org customization layer (org can tighten/add)
- [ ] Enforce lock on regulatory standards
- [ ] Test: org tightens OSHA L2 to L3 → verify inheritance
- [ ] Load-test with 10 org standards × 50 employees

**Success Criteria:**
- Published regulatory standards cannot be modified (PATCH rejected)
- Org layer additions inherit correctly to employees
- Audit trail shows all 4 layers for each requirement

### Phase 2: Department & Individual Layers (Months 2-3)

- [ ] Implement dept customization layer
- [ ] Implement individual exemption layer
- [ ] Build exemption type selector (6 categories)
- [ ] Test: employee exempt from 1 req → audit trail shows all 4 layers
- [ ] Pilot: 5 employees with different exemptions

**Success Criteria:**
- Dept can tighten org customization
- Individual exemptions show full justification + audit trail
- Query audit trail returns all 4 layers correctly

### Phase 3: Dual-Approval & Override Authority (Months 3-4)

- [ ] Implement dual-approval requirement for relax actions
- [ ] Prevent self-approval (submitter ≠ approver)
- [ ] Build approval workflow (CO approval → Admin sign-off)
- [ ] Test: relax action fails without 2 approvers
- [ ] Test: regulatory relax is always rejected (code-level block)

**Success Criteria:**
- Self-approval is impossible (error thrown)
- Relax actions require CO + ADMIN (database enforced)
- Regulatory standards cannot be relaxed (API rejects)

### Phase 4: Review & Expiration Cycles (Months 4-5)

- [ ] Implement auto-expiration (max duration per exemption type)
- [ ] Build annual review checklist + workflow
- [ ] Implement reminder notifications (30, 14, 1 days before expiration)
- [ ] Test: exemption expires → employee cannot fulfill requirement until renewed
- [ ] Pilot: 10 exemptions through expiration cycle

**Success Criteria:**
- Exemptions auto-expire after maxDuration
- Reminders sent at right intervals
- Review checklist auto-generated 30 days before expiration

### Phase 5: Auditor Readiness & Compliance (Months 5-6)

- [ ] Create auditor runbook: "Verify standards compliance"
- [ ] Conduct pilot audit with external auditor
- [ ] Generate regulatory alignment report
- [ ] Test GDPR data portability for exemptions
- [ ] Deploy to production with full monitoring

**Success Criteria:**
- External auditor validates 4-layer model
- Regulatory updates detected within 48 hours
- Exemption audit trail is unbroken and immutable

---

## Appendix: Standards Checklist

### Pre-Production

- [ ] All regulatory standards marked isLocked=true
- [ ] Org cannot relax regulatory (code-level enforcement)
- [ ] Dual-approval required for relax actions
- [ ] Exemption categories defined (6 types)
- [ ] Override expiration enforced per category
- [ ] Annual review workflow created
- [ ] Audit trail shows all 4 layers

### Post-Production

- [ ] Monitor override inventory (goal: < 5% of workforce)
- [ ] Quarterly regulatory scan (detect OSHA/FAA updates)
- [ ] Monitor exemption expiration rate (goal: 100% renewal)
- [ ] Audit trail integrity check (quarterly)

---

**Document Status:** Draft → Ready for Review → Approved by Legal/Compliance  
**Last Updated:** 2026-03-21  
**Next Review:** 2026-09-21 (6-month cycle)
