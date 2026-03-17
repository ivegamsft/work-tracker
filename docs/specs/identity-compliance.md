# Identity & Multi-IdP Compliance Review — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-21  
> **Issue:** [#96 — Multi-IdP compliance review and PII isolation validation](https://github.com/ivegamsft/work-tracker/issues/96)  
> **Applies To:** Authentication layer (`apps/api/src/modules/auth`), identity federation, access control  
> **Companion Docs:** [Entra Auth Design](./entra-auth-design.md) · [RBAC API Spec](./rbac-api-spec.md) · [Compliance Audit Events](./compliance-audit-events.md)  
> **Regulatory Scope:** GDPR, HIPAA, SOX, industry data residency requirements (CCPA, LGPD)  
> **Locked Decisions:** Decision 2 (Multi-IdP + SCIM), Decision 12 (Semi-anonymous profiles)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Multi-IdP Architecture & Regulatory Implications](#2-multi-idp-architecture--regulatory-implications)
3. [Group Membership Audit Trail](#3-group-membership-audit-trail)
4. [Access Certification Requirements](#4-access-certification-requirements)
5. [GDPR Profile Export & Data Portability](#5-gdpr-profile-export--data-portability)
6. [PII Breach Notification Process](#6-pii-breach-notification-process)
7. [Semi-Anonymous Profile Security Review](#7-semi-anonymous-profile-security-review)
8. [SCIM Deprovisioning Audit](#8-scim-deprovisioning-audit)
9. [RBAC Implications](#9-rbac-implications)
10. [Risk Assessment](#10-risk-assessment)
11. [Mitigation Controls](#11-mitigation-controls)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Overview

### What Is Multi-IdP Compliance?

**Multi-IdP (Multiple Identity Provider)** means E-CLAT accepts user identities from multiple sources:
- **Primary:** Azure Entra ID (Microsoft Entra) — internal corporate identities
- **Secondary:** GitHub, Google, other OIDC-compliant providers — contractor/external identities
- **Optional:** SAML 2.0 federation — partner organizations

This introduces compliance risks around:
1. **Regulatory authority** — Who "owns" the identity truth? If Entra ID and GitHub diverge, which is canonical?
2. **PII exposure** — External IdP may share more (or less) data than we expect
3. **Group membership synchronization** — If an employee moves departments, does GitHub know?
4. **Deprovisioning** — When an employee leaves, can we revoke access across all IdPs?

### Locked Decision Context

**Decision 2 — Multi-IdP + SCIM:** The platform supports multiple identity providers simultaneously, with SCIM 2.0 for group membership synchronization (source-of-truth: Azure Entra ID). Semi-anonymous profiles (Decision 12) isolate PII with object ID abstraction.

---

## 2. Multi-IdP Architecture & Regulatory Implications

### 2.1 Trust Hierarchy

```
Entra ID (T1 — Authoritative)
  ├─ Employee identities (SCIM source-of-truth)
  ├─ Group memberships (sync → E-CLAT roles)
  ├─ Profile attributes (firstName, email, department)
  └─ Deprovisioning source (employee termination)

GitHub / Google (T2 — Federated)
  ├─ Contractor identities
  ├─ Groups managed in external IdP (E-CLAT reads via OIDC)
  ├─ Profile attributes (minimal — email + name only)
  └─ Deprovisioning coordination (manual or webhooks)

Partner SAML Federations (T3 — Delegated)
  ├─ Healthcare network, regulatory body logins
  ├─ Attributes: name, email, role, organization
  └─ Deprovisioning: per-partner agreement
```

### 2.2 Regulatory Implications by Industry

| Industry | Regulatory Driver | Implication | Compliance Control |
|----------|-------------------|-------------|-------------------|
| **Healthcare** | HIPAA § 164.308(a)(3) (Access Management) | Entra ID must be source-of-truth for HIPAA-covered entities; no external contractors as primary IdP | HIPAA audit trail of role changes via Entra ID |
| **Finance** | SOX § 404(a) (IT Controls) | IdP access must be certified quarterly; all login events logged | Quarterly access certification per §4 |
| **Aviation** | 14 CFR § 121.437 (FAA Qualifications) | Employee identities tied to FAA airman registry; contractors must be explicitly approved | Multi-layer role approval for external IdPs |
| **Nuclear** | 10 CFR § 73.54 (NRC Access Control) | Identity must be verified against government vetting; no federated/contractor logins for security areas | Entra ID only for site access |
| **General (GDPR)** | GDPR Article 6 (Lawful Basis) | If IdP shares PII, we must have legal basis to receive it; data transfer agreements required | Data Processing Addendum with each IdP provider |
| **General (CCPA/LGPD)** | CCPA § 1798.140 (Definitions) | IdP may be a "service provider"; PII access must be restricted and auditable | Service provider agreement + audit log access |

### 2.3 Multi-IdP Configuration Registry

Maintain a compliance-approved registry of all IdPs:

```json
{
  "idProviders": [
    {
      "id": "entra-id-primary",
      "name": "Azure Entra ID (Corporate)",
      "type": "openid_connect",
      "tier": "T1_AUTHORITATIVE",
      "issuer": "https://login.microsoftonline.com/{tenantId}/v2.0",
      "clientId": "vault:entra-client-id",
      "scope": ["openid", "profile", "email", "offline_access"],
      "dataTransferAgreement": "DPA-MSFT-2024.pdf",
      "approvedUseCases": ["internal_employee_login", "contractor_onboarding_baseline"],
      "piiAttr": ["oid", "given_name", "family_name", "email", "department", "job_title"],
      "groupSyncEnabled": true,
      "groupSyncSource": "SCIM2.0",
      "deprovisioning": "SCIM_DELETE_USER",
      "certificationCycle": "quarterly",
      "lastReview": "2026-03-20",
      "nextReview": "2026-06-20",
      "approvedBy": ["compliance-officer", "ciso"],
      "activeEmployeeCount": 250
    },
    {
      "id": "github-oauth",
      "name": "GitHub OAuth (External Contractors)",
      "type": "oauth2",
      "tier": "T2_FEDERATED",
      "issuer": "https://github.com",
      "clientId": "vault:github-client-id",
      "scope": ["user:email", "read:user"],
      "dataTransferAgreement": "GitHub-ToS-acknowledge.txt",
      "approvedUseCases": ["external_contractor_read_only_access"],
      "restrictedRoles": ["COMPLIANCE_OFFICER", "ADMIN"],  // Contractors cannot have these roles
      "piiAttr": ["login", "name", "email"],
      "groupSyncEnabled": false,
      "deprovisioning": "manual_revocation",
      "certificationCycle": "semi-annual",
      "lastReview": "2026-03-15",
      "nextReview": "2026-09-15",
      "approvedBy": ["ciso"],
      "activeContractorCount": 5
    }
  ]
}
```

**Enforcement:**
1. Before activating a new IdP, compliance officer must approve the registry entry
2. PII attributes listed must match actual token response (audit data types received)
3. Every 90 days, re-certify that the IdP is still in use and compliant
4. If not re-certified, automatically disable login for that IdP

---

## 3. Group Membership Audit Trail

### 3.1 Group Sync Lifecycle

When an Entra ID group membership changes (e.g., employee promoted from "Supervisors" to "Managers"), trace the entire flow:

**Step 1: Entra ID change**
```
Event: user-1234 added to group "Managers"
Timestamp: 2026-03-21T10:00:00Z
Source: Entra ID Graph API
```

**Step 2: SCIM sync (automated)**
```
SCIM PATCH /scim/v2/Groups/manager-group-uuid
{
  "members": [
    { "value": "user-1234", "operation": "add" }
  ]
}
Timestamp: 2026-03-21T10:05:00Z
Audit Entry: rbac:group_membership_synced
```

**Step 3: E-CLAT role update (automated)**
```
UPDATE employees 
SET role = 'MANAGER'
WHERE entraOid = 'user-1234'
Timestamp: 2026-03-21T10:06:00Z
Audit Entry: rbac:role_changed_via_group_sync
```

### 3.2 Audit Trail Requirements

For every group membership change, log:

```json
{
  "id": "audit-uuid",
  "timestamp": "2026-03-21T10:00:00Z",
  "action": "rbac:group_membership_synced",
  "actor": "SCIM-SERVICE",
  "actorRole": "SYSTEM",
  "entityType": "Employee",
  "recordId": "employee-uuid",
  "before": {
    "role": "SUPERVISOR",
    "entraGroups": ["supervisors"]
  },
  "after": {
    "role": "MANAGER",
    "entraGroups": ["supervisors", "managers"]
  },
  "changedFields": ["role", "entraGroups"],
  "metadata": {
    "idpSource": "entra-id-primary",
    "syncMethod": "SCIM",
    "groupId": "manager-group-uuid",
    "groupName": "Managers",
    "changeInitiator": "admin-user-uuid"  // Who made the change in Entra ID
  }
}
```

### 3.3 Drift Detection & Remediation

If E-CLAT role diverges from Entra ID group membership (e.g., user is in "Managers" group but role is still "SUPERVISOR"):

**Detect (Hourly Job):**
```sql
SELECT e.id, e.role, STRING_AGG(g.name, ',') as actual_groups
FROM employees e
LEFT JOIN rbac_group_assignments g ON e.id = g.employeeId
WHERE 
  -- User is in a higher role group than their E-CLAT role
  (e.role = 'SUPERVISOR' AND g.name = 'managers')
  OR (e.role = 'SUPERVISOR' AND g.name = 'compliance_officers')
  OR (e.role = 'MANAGER' AND g.name = 'compliance_officers')
  OR (e.role = 'MANAGER' AND g.name = 'admins');
```

**Remediate:**
1. Log `rbac:drift_detected` audit entry
2. Alert Compliance Officer: "Group membership mismatch detected"
3. Auto-correct with CO approval (do not force without human review)
4. Log correction as `rbac:drift_corrected`

---

## 4. Access Certification Requirements

### 4.1 Quarterly Access Certification Workflow

**Requirement:** SOX § 404 mandates quarterly certification that all user access is authorized and no inappropriate privileges are granted.

**Workflow:**

```
Q1 Start (Jan 1)
  ↓
[CO runs certification job]
  ├─ Export all employees + roles + group memberships
  ├─ Export all privilege grants (custom roles, overrides)
  ├─ Group by supervisor
  └─ Generate certification package per supervisor
  ↓
[Email to all supervisors]
  "Certify that these 15 people in your team have appropriate access"
  [CSV attachment with: name, role, groups, last login, access duration]
  ↓
[Supervisor reviews & signs off]
  "I confirm access is appropriate: [Sign] Date: 2026-03-31"
  ↓
[Compliance Officer collects certifications]
  ├─ Track response rate (goal: 100% within 30 days)
  ├─ For non-responses, escalate to their manager
  ├─ Log each certification as audit entry
  └─ Generate compliance report
  ↓
Q1 Complete
  └─ Archive certification records for 7-year retention
```

### 4.2 Certification Audit Entries

Every access certification generates audit events:

```json
{
  "action": "access_certification:job_started",
  "timestamp": "2026-03-01T00:00:00Z",
  "certificationCycleId": "q1-2026",
  "metadata": {
    "supervisorCount": 25,
    "employeeCount": 250,
    "dueDate": "2026-03-31"
  }
}

// After supervisor certifies:
{
  "action": "access_certification:supervisor_certified",
  "timestamp": "2026-03-15T14:30:00Z",
  "actor": "supervisor-uuid",
  "entityType": "AccessCertification",
  "recordId": "certification-uuid",
  "after": {
    "certificationStatus": "APPROVED",
    "supervisorName": "Jane Doe",
    "signedDate": "2026-03-15",
    "employeesCertified": 15
  }
}
```

### 4.3 Certification Template

Supervisors certify using this template:

```
═══════════════════════════════════════════════════════════
Q1 2026 ACCESS CERTIFICATION — Your Team (Due 2026-03-31)
═══════════════════════════════════════════════════════════

Supervisor: Jane Doe  |  Department: Clinical Operations  |  Team Size: 15

Instructions: 
  For each person below, confirm their access level is appropriate for their role.
  If someone should NOT have access, mark "REMOVE" and provide reason.

┌──────────────┬───────────────┬──────────┬─────────────────┬───────────────────┐
│ Name         │ Role          │ Groups   │ Last Login      │ Certification     │
├──────────────┼───────────────┼──────────┼─────────────────┼───────────────────┤
│ John Smith   │ SUPERVISOR    │ Clinical│ 2026-03-20      │ ☑ Appropriate     │
│ Alice Brown  │ EMPLOYEE      │ Nurses  │ 2026-03-18      │ ☑ Appropriate     │
│ Bob Johnson  │ SUPERVISOR    │ Doctors │ 2026-02-10      │ ☐ REMOVE (left 2/15)│
│ Carol White  │ MANAGER       │ Manager │ 2026-03-21      │ ☑ Appropriate     │
└──────────────┴───────────────┴──────────┴─────────────────┴───────────────────┘

Manager Signature: ___________________________  Date: ____________

Comments:
_____________________________________________________________________
```

---

## 5. GDPR Profile Export & Data Portability

### 5.1 GDPR Article 20 — Right to Data Portability

Users have the right to obtain and reuse their personal data across different services. E-CLAT must provide:

1. **All identity attributes** (name, email, department, etc.)
2. **All access records** (login history, role history)
3. **All data created by the user** (attestations, uploads, notes)
4. In **structured, commonly used format** (JSON, CSV, XML)
5. Within **30 days** of request

### 5.2 GDPR Export Content

When a user requests data portability, export:

```json
{
  "requestId": "dsar-uuid",
  "requestDate": "2026-03-20T10:00:00Z",
  "dataSubject": "john.doe@example.com",
  "exportedAt": "2026-03-21T10:00:00Z",
  "exportedBy": "compliance-officer-uuid",
  
  "identity": {
    "id": "emp-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "employeeNumber": "EMP-12345",
    "department": "Clinical Operations",
    "jobTitle": "Registered Nurse",
    "hireDate": "2020-06-15",
    "isActive": true,
    "entraOid": "entra-oid-uuid",
    "lastPasswordChange": "2026-02-10"
  },
  
  "accessHistory": [
    {
      "timestamp": "2026-03-21T14:30:00Z",
      "action": "login",
      "method": "password",
      "ipAddress": "192.0.2.1",
      "userAgent": "Mozilla/5.0...",
      "status": "success"
    }
  ],
  
  "roleHistory": [
    {
      "timestamp": "2020-06-15T08:00:00Z",
      "role": "EMPLOYEE",
      "grantedBy": "system",
      "reason": "Initial hire"
    },
    {
      "timestamp": "2023-01-10T08:00:00Z",
      "role": "SUPERVISOR",
      "grantedBy": "manager-uuid",
      "reason": "Promotion to team lead"
    }
  ],
  
  "groupMemberships": [
    {
      "groupId": "group-uuid",
      "groupName": "Clinical Staff",
      "joinedAt": "2020-06-15",
      "leftAt": null,
      "idpSource": "entra-id-primary"
    }
  ],
  
  "dataCreatedByUser": [
    {
      "type": "attestation",
      "id": "attestation-uuid",
      "description": "CPR Certification renewal attestation",
      "createdAt": "2026-03-20T10:15:00Z",
      "isPublic": false
    },
    {
      "type": "document_upload",
      "id": "doc-uuid",
      "fileName": "CPR_Certificate_2026.pdf",
      "uploadedAt": "2026-03-20T10:20:00Z",
      "fileSize": 150000
    }
  ]
}
```

### 5.3 Export Delivery & Format Options

- **JSON** — Full structured export (machine-readable)
- **CSV** — Flattened identity + access history (Excel-compatible)
- **PDF** — Human-readable report with summary

Delivery:
1. Encrypted file (AES-256) + password-protected link
2. Link expires in 7 days (GDPR requirement: "without undue delay")
3. Send link via registered email address
4. Log as `data:export_delivered` with timestamp

---

## 6. PII Breach Notification Process

### 6.1 Breach Detection & Notification Obligations

**GDPR Article 33:** When personal data is breached, notify the supervisory authority (DPA) within **72 hours**. If likely to result in high risk, also notify the individual immediately.

**HIPAA Breach Rule:** Notify affected individuals within **60 calendar days**; notify media if 500+ individuals in same jurisdiction; notify HHS.

**CCPA § 1798.150:** Notify consumers "without unreasonable delay"; California AG if 500+ California residents affected.

### 6.2 Breach Notification Workflow

```
[Breach Detected]
  ↓
T+0 Minutes: Incident Response
  ├─ Isolate affected system
  ├─ Preserve evidence (don't delete audit logs!)
  ├─ Log as: security_incident:breach_detected
  └─ Alert CISO & Compliance Officer
  ↓
T+1 Hours: Initial Assessment
  ├─ Scope: Which tables? How many records?
  ├─ Data: What PII is affected? (names, emails, SSNs, health data?)
  ├─ Risk: Is it encrypted? Can attacker use it?
  └─ Determine: Is this a "reportable breach"?
  ↓
T+24 Hours: Legal Review
  ├─ Consult external counsel (breach notification attorney)
  ├─ Confirm regulatory obligations (GDPR? HIPAA? CCPA?)
  ├─ Draft notification templates per regulation
  └─ Log as: security_incident:legal_review_complete
  ↓
T+48 Hours (GDPR: T+72 Max): Regulator Notification
  ├─ Submit breach notice to supervisory authority
  ├─ Attach technical details + remediation plan
  ├─ Keep proof of notification
  └─ Log as: security_incident:regulator_notified
  ↓
T+72 Hours (HIPAA/CCPA window): Individual Notification
  ├─ Send notification email to affected individuals
  ├─ Include: what was breached, what steps we took, what they should do
  ├─ Provide complimentary credit monitoring (if SSN exposed)
  ├─ Attach a copy of your privacy policy
  └─ Log as: security_incident:individual_notified
  ↓
T+30 Days: Post-Incident Report
  ├─ Root cause analysis (RCA)
  ├─ Timeline of events
  ├─ Technical details + evidence
  ├─ Remediation measures taken
  └─ Audit log: security_incident:post_incident_review_complete
  ↓
T+90 Days: Effectiveness Check
  ├─ Verify remediation is working
  ├─ Re-test affected systems
  └─ Confirm no recurrence
```

### 6.3 Breach Notification Audit Entries

Each step generates immutable audit entries:

```json
{
  "action": "security_incident:breach_detected",
  "timestamp": "2026-03-21T14:30:00Z",
  "actor": "SYSTEM",
  "entityType": "SecurityIncident",
  "recordId": "incident-uuid",
  "severity": "high",
  "after": {
    "incidentType": "unauthorized_access",
    "affectedDataType": ["email", "name", "department"],
    "affectedRecordCount": 250,
    "encryptionStatus": "encrypted",
    "discoveredAt": "2026-03-21T14:30:00Z",
    "discoverMethod": "audit_log_anomaly_detection"
  }
}

{
  "action": "security_incident:individual_notified",
  "timestamp": "2026-03-23T10:00:00Z",
  "actor": "compliance-officer-uuid",
  "entityType": "SecurityIncident",
  "recordId": "incident-uuid",
  "after": {
    "notificationType": "email",
    "recipientCount": 250,
    "templateUsed": "gdpr_breach_notification_v2",
    "sentDate": "2026-03-23",
    "deliveryStatus": "sent_to_250_recipients"
  }
}
```

---

## 7. Semi-Anonymous Profile Security Review

### 7.1 PII Isolation Architecture (Decision 12)

**Semi-anonymous profile:** E-CLAT stores a minimal PII "profile" linked to a UUID, while the canonical identity record (with full name, SSN, etc.) lives in an external system (Entra ID, HR database).

```
┌───────────────────────────────────┐
│ External System (HR / Entra ID)   │
│ ┌─────────────────────────────┐   │
│ │ Full PII Record             │   │
│ │ - SSN: 123-45-6789          │   │
│ │ - DOB: 1990-05-15           │   │
│ │ - Name: John Michael Doe    │   │
│ │ - Address: 123 Main St      │   │
│ │ - Bank Account: (...last 4) │   │
│ └─────────────────────────────┘   │
└───────────────────────────────────┘
         │
    [Entra OID: abc123]
         │
         ↓
┌───────────────────────────────────┐
│ E-CLAT Database (Minimal PII)     │
│ ┌─────────────────────────────┐   │
│ │ Employee Record             │   │
│ │ - id: emp-uuid              │   │
│ │ - entraOid: abc123          │   │
│ │ - firstName: John           │   │
│ │ - lastName: Doe             │   │
│ │ - email: john.doe@co.com    │   │
│ │ - department: Clinical Ops  │   │
│ │ - role: SUPERVISOR          │   │
│ │ [NO: SSN, DOB, address]     │   │
│ └─────────────────────────────┘   │
└───────────────────────────────────┘
```

**Benefits:**
1. **Data minimization** (GDPR Article 5) — E-CLAT doesn't store what it doesn't need
2. **Reduced breach exposure** — Breach of E-CLAT DB doesn't expose SSN/DOB
3. **Privacy by design** — External HR system remains source-of-truth for sensitive PII
4. **Right to erasure (GDPR Article 17)** — Delete E-CLAT profile without touching HR data

### 7.2 PII Isolation Security Controls

**Rule 1: No SSN Storage**
```
❌ FORBIDDEN:
  INSERT INTO employees (ssn) VALUES ('123-45-6789');
  
✅ ALLOWED (if absolutely necessary):
  -- Store hash only, never plaintext
  UPDATE employees 
  SET ssn_hash = SHA256('123-45-6789')
  WHERE id = 'emp-uuid';
```

**Rule 2: PII in Audit Logs**

Audit logs can contain before/after snapshots, but PII must be redacted:

```json
{
  "before": {
    "firstName": "John",
    "email": "john.doe@co.com"
    // ❌ NO: "ssn", "dob", "address"
  },
  "visibilityLevel": "RESTRICTED"  // Only CO+ can see even this
}
```

**Rule 3: PII Access Logging**

Every read of PII (e.g., exporting email for breach notification) generates a log:

```json
{
  "action": "data:pii_accessed",
  "timestamp": "2026-03-21T10:00:00Z",
  "actor": "compliance-officer-uuid",
  "entityType": "Employee",
  "recordId": "emp-uuid",
  "piiFieldsAccessed": ["email", "firstName", "lastName"],
  "accessMethod": "gdpr_export_request",
  "reason": "GDPR subject access request"
}
```

### 7.3 PII Isolation Validation Checklist

Before deploying, security team must verify:

- [ ] No columns in `employees` table storing SSN, DOB, address, phone, bank account
- [ ] All reads of email address (for notifications) are logged
- [ ] Export tools (GDPR SAR, reports) fetch PII from external source only
- [ ] Audit logs redact SSN/DOB/address by default
- [ ] Test: attempt to SELECT all employees + ssn → query fails or returns null
- [ ] Test: GDPR export for 10 users completes without exposing external system data

---

## 8. SCIM Deprovisioning Audit

### 8.1 SCIM 2.0 User Deprovisioning Lifecycle

When an employee terminates, Entra ID triggers a deprovisioning sequence via SCIM:

```
[Employee Terminated in HR]
  ↓
Entra ID marks user as "inactive"
  ↓
SCIM Connector (E-CLAT) receives:
  PATCH /scim/v2/Users/emp-uuid
  {
    "active": false,
    "x_termination_date": "2026-03-21"
  }
  ↓
E-CLAT Deprovisioning Engine:
  1. Revoke all session tokens → user logs out
  2. Disable API credentials
  3. Mark as inactive (retain data for audit)
  4. Revoke proof signing authority
  5. Disable edit permissions on proofs
  6. Archive all evidence packages
  ↓
Log series of audit entries:
  ├─ rbac:user_deprovisioned_scim
  ├─ rbac:sessions_revoked
  ├─ rbac:api_credentials_revoked
  ├─ data:archive_employee_evidence
  └─ audit:deprovisioning_complete
  ↓
Compliance Officer Reviews:
  ├─ Confirms all access revoked
  ├─ Signs off on deprovisioning
  ├─ Initiates data retention period (7 years)
  └─ Marks deprovisioning as "audit_approved"
```

### 8.2 Deprovisioning Audit Entries

```json
{
  "action": "rbac:user_deprovisioned_scim",
  "timestamp": "2026-03-21T09:00:00Z",
  "actor": "SCIM-SERVICE",
  "actorRole": "SYSTEM",
  "entityType": "Employee",
  "recordId": "emp-uuid",
  "before": {
    "isActive": true,
    "role": "SUPERVISOR",
    "sessionCount": 3,
    "lastLogin": "2026-03-20T17:30:00Z"
  },
  "after": {
    "isActive": false,
    "role": "EMPLOYEE",  // Reverted to base role
    "sessionCount": 0,
    "deactivatedAt": "2026-03-21T09:00:00Z"
  },
  "metadata": {
    "deprovisioning_source": "SCIM",
    "entra_id_status_change": "active → inactive",
    "reason": "employee_terminated",
    "notified_systems": ["sessions", "api_keys", "webhook_subscriptions"]
  }
}

{
  "action": "rbac:sessions_revoked",
  "timestamp": "2026-03-21T09:01:00Z",
  "actor": "SCIM-SERVICE",
  "after": {
    "sessionsRevoked": 3,
    "revokedSessionIds": [
      "session-uuid-1",
      "session-uuid-2",
      "session-uuid-3"
    ],
    "affectedDevices": 2
  }
}

{
  "action": "audit:deprovisioning_complete",
  "timestamp": "2026-03-21T09:15:00Z",
  "actor": "compliance-officer-uuid",
  "metadata": {
    "deprovisioning_duration_minutes": 15,
    "steps_completed": 5,
    "data_retention_period_years": 7,
    "audit_approved_at": "2026-03-21T09:15:00Z"
  }
}
```

### 8.3 Deprovisioning Verification Checklist

After SCIM deprovisioning, Compliance Officer must verify:

```
Deprovisioning Checklist — [Employee Name], [Termination Date]

Session Management:
  ☐ All login sessions revoked (last session: _______ at _________)
  ☐ No active tokens in auth service
  ☐ Verify with: GET /api/auth/sessions?userId=__
  
API Access:
  ☐ All API keys revoked or disabled
  ☐ No webhooks still active for this user
  ☐ No scheduled jobs under this user's account
  
Data Access:
  ☐ User marked as inactive in RBAC
  ☐ Read permissions revoked (cannot access org data)
  ☐ Write permissions revoked (cannot modify proofs)
  ☐ Verify with: GET /api/employees/userId/permissions → empty
  
Proof Signing Authority:
  ☐ Cannot validate fulfillments (if was supervisor)
  ☐ Cannot approve evidence packages (if was CO)
  ☐ Cannot override requirements (if was admin)
  
Evidence Archival:
  ☐ All evidence packages marked read-only
  ☐ All documents locked (cannot download)
  ☐ Audit trail preserved (cannot delete)
  
Final Attestation:
  Verified by: _________________________ [CO Name]
  Date: ________________
  Signature: _________________________
```

---

## 9. RBAC Implications

### 9.1 IdP & Group Sync Permissions

```
idp:read
  └─ Compliance Officer can view IdP registry
  
idp:manage
  └─ Admin can register/update/deactivate IdPs
  
idp:cert:review
  └─ Compliance Officer must review IdP changes quarterly
  
group_sync:monitor
  └─ Compliance Officer receives alerts on group sync failures
  
group_sync:drift_remediate
  └─ Compliance Officer approves corrections to role drift
  
access_cert:initiate
  └─ Compliance Officer starts quarterly access certification
  
access_cert:review
  └─ Supervisor certifies team access (can only certify direct reports)
  
access_cert:sign_off
  └─ Compliance Officer collects certifications and signs off
  
data:export
  └─ Employee can export own data (GDPR SAR)
  
data:export:all
  └─ Compliance Officer can export any user's data (SAR fulfillment)
  
deprovisioning:execute
  └─ SCIM service automatically revokes access
  
deprovisioning:verify
  └─ Compliance Officer manually verifies all access revoked
```

### 9.2 IdP Restrictions by Role

| Role | Can Use IdP | Notes |
|------|-------------|-------|
| **EMPLOYEE** | Entra ID only (primary) | Contractors use GitHub only |
| **SUPERVISOR** | Entra ID + GitHub (read-only) | Some supervisors may be contractors |
| **MANAGER** | Entra ID only | No external IdP |
| **COMPLIANCE_OFFICER** | Entra ID only | Must have corporate identity |
| **ADMIN** | Entra ID only | Must have corporate identity |

---

## 10. Risk Assessment

### 10.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **IdP compromise** | Attacker assumes identity via breached external IdP (GitHub account stolen) | Force re-authentication, IP whitelist for sensitive operations |
| **Group sync failure** | User retains elevated role despite deprovisioning | Hourly drift detection + automatic alert + manual verification |
| **SCIM deprovisioning delay** | Terminated employee can still log in for hours | Immediate session revocation on Entra ID termination |
| **Unauditability** | Cannot prove who accessed what data via external IdP | Mirror IdP login events to E-CLAT audit logs |
| **PII exposure** | Breach of E-CLAT exposes SSN/DOB stored in DB | Enforce PII isolation; store only entraOid + minimal attributes |
| **GDPR SAR timeout** | Cannot fulfill data export request within 30 days | Automate export process; test quarterly |
| **Multi-IdP role conflicts** | User has different role in GitHub vs. Entra ID | Entra ID is source-of-truth; GitHub groups read-only for display |

---

## 11. Mitigation Controls

### 11.1 Database-Level Controls

```sql
-- Enforce PII minimization
CREATE POLICY pii_minimal ON employees
  USING (
    -- Only these columns are allowed
    id IS NOT NULL
    AND entraOid IS NOT NULL
    AND firstName IS NOT NULL
    AND email IS NOT NULL
    -- Forbidden:
    AND ssn IS NULL
    AND date_of_birth IS NULL
    AND address IS NULL
  );

-- Audit all IdP configuration changes
CREATE TRIGGER idp_registry_audit
  AFTER UPDATE ON identity_providers
  FOR EACH ROW
  EXECUTE FUNCTION log_idp_change();

-- Immutable deprovisioning log
CREATE TABLE deprovisioning_log (
  id UUID PRIMARY KEY,
  employeeId UUID NOT NULL,
  initiatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  completedAt TIMESTAMP,
  verifiedBy UUID,
  verifiedAt TIMESTAMP,
  -- No DELETE allowed, only INSERT
) WITH (fillfactor = 100);
REVOKE DELETE ON deprovisioning_log FROM application_user;
```

### 11.2 Application-Level Controls

1. **PII validator** — Function that checks all reads/writes don't store/export SSN/DOB
2. **Group sync monitor** — Hourly job that detects role drift
3. **SCIM event processor** — Immediately processes deprovisioning without delay
4. **GDPR export job** — Pre-built template that gathers all required data
5. **Access cert workflow** — Templated email + signature collection

### 11.3 Infrastructure Controls

1. **IdP credential rotation** — Annual renewal of OAuth client secrets via Key Vault
2. **SCIM endpoint authentication** — Mutual TLS between E-CLAT and Entra ID
3. **Event mirroring** — Entra ID login events streamed to E-CLAT audit logs
4. **Backup immutability** — Database backups cannot be modified once created
5. **Quarterly integrity audits** — Independent verification of access controls

---

## 12. Phased Rollout

### Phase 1: Multi-IdP Registry & GitHub OAuth (Months 1-2)

- [ ] Create IdP registry with compliance metadata
- [ ] Integrate GitHub OAuth (contractor logins only)
- [ ] Restrict GitHub users from CO/ADMIN roles
- [ ] Test role inheritance from Entra ID groups
- [ ] Run 1-week pilot with 5 external contractors

**Success Criteria:**
- GitHub contractors can log in and access read-only data
- Role restrictions enforced (no elevated access)
- No increase in audit log volume > 10%

### Phase 2: SCIM Group Sync & Drift Detection (Months 2-3)

- [ ] Deploy SCIM 2.0 connector (Entra ID ↔ E-CLAT)
- [ ] Implement hourly drift detection job
- [ ] Build alerts/remediation workflow
- [ ] Test deprovisioning scenario (terminate employee in Entra, confirm access revoked)
- [ ] Load-test with 500 group membership changes/day

**Success Criteria:**
- Group sync completes within 5 minutes of Entra ID change
- Drift detection catches mismatches within 1 hour
- Deprovisioning completes within 1 hour of termination

### Phase 3: GDPR & PII Isolation (Months 3-4)

- [ ] Remove SSN/DOB/address columns from employees table (or set to NULL)
- [ ] Build GDPR export tool with data portability format
- [ ] Test with 10 sample users
- [ ] Implement PII redaction in audit logs
- [ ] Document data residency compliance (GDPR, CCPA)

**Success Criteria:**
- Employees table contains zero SSN/DOB records
- GDPR export generated within 30 minutes
- Export includes identity + access history + created data

### Phase 4: Access Certification & Quarterly Attestation (Months 4-5)

- [ ] Build access certification workflow (email to supervisors)
- [ ] Implement signature collection + archive
- [ ] Create quarterly scheduler
- [ ] Run first pilot certification cycle (1 department, 20 people)
- [ ] Generate compliance report

**Success Criteria:**
- First certification achieves 100% supervisor sign-off within 30 days
- Report generated successfully with 20 certified employees
- Audit trail captures all approvals

### Phase 5: Breach Notification & Post-Incident (Months 5-6)

- [ ] Document breach notification process (GDPR, HIPAA, CCPA timelines)
- [ ] Create notification templates per regulation
- [ ] Practice tabletop: "breach detected, notify 250 employees"
- [ ] Verify external counsel review < 24 hours
- [ ] Schedule quarterly breach simulations

**Success Criteria:**
- First simulated breach reaches regulators within 72 hours (GDPR)
- Individual notifications sent within 60 days (HIPAA)
- Post-incident review completed within 30 days

---

## Appendix: Multi-IdP Checklist

### Pre-Production

- [ ] All IdPs registered in compliance registry with legal DPA
- [ ] All PII columns audited; non-essential columns removed
- [ ] GDPR export template tested with 5 users
- [ ] SCIM connector tested for 100 group changes
- [ ] Deprovisioning tested end-to-end (termination → access revoked → verification)
- [ ] Access certification template created + pilot run
- [ ] Breach notification process documented + external counsel on retainer
- [ ] Quarterly integrity checks scheduled

### Production

- [ ] Monitor IdP error rates daily
- [ ] Monitor SCIM sync lag (goal < 5 min)
- [ ] Review group sync drift alerts weekly
- [ ] Run quarterly access certifications (Jan, Apr, Jul, Oct)
- [ ] Run quarterly breach notification drills
- [ ] Audit log integrity checks (quarterly)
- [ ] Re-certify IdPs annually (update DPA, verify still in use)

---

**Document Status:** Draft → Ready for Review → Approved by Legal/CISO  
**Last Updated:** 2026-03-21  
**Next Review:** 2026-09-21 (6-month cycle)
