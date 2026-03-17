# Compliance Audit Events Specification — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-21  
> **Issue:** [#92 — Compliance audit events catalog and retention policy](https://github.com/ivegamsft/work-tracker/issues/92)  
> **Applies To:** All API modules, audit logging infrastructure, data retention policy  
> **Companion Docs:** [RBAC API Spec](./rbac-api-spec.md) · [Templates & Attestation Spec](./templates-attestation-spec.md) · [Issuer Verification Framework](./issuer-verification-framework.md)  
> **Regulatory Scope:** SOX, GDPR, HIPAA, industry-specific (OSHA, FAA, Joint Commission)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Audit Event Taxonomy](#2-audit-event-taxonomy)
3. [Event Schema](#3-event-schema)
4. [Write Path Audit Mapping](#4-write-path-audit-mapping)
5. [Data Retention Policies](#5-data-retention-policies)
6. [Tamper-Evidence & Integrity](#6-tamper-evidence--integrity)
7. [GDPR Data Subject Access Requests](#7-gdpr-data-subject-access-requests)
8. [Audit Log Query API](#8-audit-log-query-api)
9. [RBAC Implications](#9-rbac-implications)
10. [Risk Assessment](#10-risk-assessment)
11. [Mitigation Controls](#11-mitigation-controls)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Overview

### What Is Audit Logging?

An **audit log entry** is a tamper-evident, immutable record of every material action taken within E-CLAT. Audit logs serve four critical purposes:

1. **Regulatory Compliance** — Prove to auditors that system access and data changes were authorized and tracked
2. **Forensic Investigation** — Reconstruct what happened, when, by whom, and why if an incident occurs
3. **Data Subject Rights** — Fulfill GDPR/CCPA requests to show what data we hold about a person and who accessed it
4. **Separation of Duties** — Prevent single-actor overrides of compliance requirements (e.g., no one person can unilaterally mark a medical clearance as valid)

### Scope

Every **write** to the system (create, update, delete, override, approval, attestation, verification) MUST generate an audit log entry. **Reads** are excluded unless they involve sensitive PII disclosure (e.g., exporting a proof vault package) or override a previous decision.

---

## 2. Audit Event Taxonomy

### 2.1 Event Categories

| Category | Trigger | Examples |
|----------|---------|----------|
| **Authentication** | Login, logout, token refresh, multi-factor challenge | `auth:login`, `auth:mfa_challenge_sent`, `auth:logout` |
| **Employee Lifecycle** | Hire, transfer, termination, profile edit | `employee:created`, `employee:role_changed`, `employee:terminated` |
| **Template Management** | Template create, publish, archive, clone, assignment | `template:created`, `template:published`, `template:archived`, `template_assignment:created` |
| **Proof Fulfillment** | Self-attestation, upload, third-party verify, validation, rejection, expiration | `fulfillment:self_attested`, `fulfillment:document_uploaded`, `fulfillment:third_party_verified`, `fulfillment:validated`, `fulfillment:rejected`, `fulfillment:expired` |
| **Override & Waiver** | Expiration extension, proof override, requirement waiver, grace period | `override:proof_extended`, `override:requirement_waived`, `override:expiration_extended`, `override:grace_period_granted` |
| **Standards & Customization** | Standard create, requirement add/modify/delete, customization applied | `standard:created`, `standard_requirement:added`, `standard_requirement:modified`, `custom_standard:created`, `customization_layer:applied` |
| **Issuer Management** | Issuer registry entry created/updated, verification request issued, result received | `issuer:created`, `issuer:deactivated`, `verification_request:issued`, `verification_result:received` |
| **Evidence & Sharing** | Evidence package created, approved, shared, accessed, redacted | `package:created`, `package:approved`, `package:shared`, `package:accessed`, `package:field_redacted` |
| **Nudge & Notification** | Nudge sent, response received, escalation triggered | `nudge:sent`, `nudge:response_received`, `nudge:escalation_triggered` |
| **Access Control** | Role grant/revoke, permission modified, group membership change | `rbac:role_assigned`, `rbac:role_revoked`, `rbac:group_membership_added`, `rbac:group_membership_removed` |
| **Data Export & Disclosure** | GDPR access request fulfilled, report generated, external sharing | `data:export_requested`, `data:export_delivered`, `data:report_generated`, `data:external_access_granted` |
| **System & Audit** | Audit log export, log retention policy applied, archival | `audit:log_export_requested`, `audit:retention_policy_applied`, `audit:logs_archived` |

### 2.2 Mandatory Audit Fields

Every audit log entry MUST contain:

```json
{
  "id": "uuid",                           // Unique identifier
  "timestamp": "2026-03-21T14:30:00Z",   // When the action occurred (server time, not client time)
  "action": "fulfillment:validated",     // Audit event type (category:subcategory)
  "actor": "user-uuid-or-service-name",  // Who performed the action (user ID or system service)
  "actorRole": "COMPLIANCE_OFFICER",     // Role of the actor at the time of action
  "entityType": "ProofFulfillment",      // Primary entity affected
  "recordId": "fulfillment-uuid",        // ID of the primary record (not foreign keys)
  "reason": "Medical clearance review",  // Why the action was taken (required for approvals/overrides)
  "status": "success|failure",           // Did the action complete successfully?
  "before": { /* previous state */ },    // Snapshot of entity before change
  "after": { /* new state */ },          // Snapshot of entity after change
  "changedFields": ["status", "validatedBy", "validatedAt"], // Which fields changed
  "metadata": {
    "ipAddress": "192.0.2.1",            // Client IP (for breach investigation)
    "userAgent": "Mozilla/5.0...",       // Browser/client version
    "sessionId": "session-uuid",         // Session token (for session revocation on breach)
    "requestId": "correlation-uuid",     // Trace ID for distributed logging
    "approvalChain": ["user-1", "user-2"] // If multi-step approval, list all approvers
  }
}
```

---

## 3. Event Schema

### 3.1 Before & After Snapshots

For every update, capture:

- **Before:** Full state of all fields before the change
- **After:** Full state of all fields after the change
- **ChangedFields:** Array of field names that changed

This enables forensic reconstruction: "Who changed the expiration date from 2026-12-31 to 2027-06-30, and why?"

**Example:**

```json
{
  "action": "fulfillment:validated",
  "before": {
    "status": "PENDING_REVIEW",
    "validatedBy": null,
    "validatedAt": null,
    "validatorNotes": null
  },
  "after": {
    "status": "APPROVED",
    "validatedBy": "compliance-officer-uuid",
    "validatedAt": "2026-03-21T14:30:00Z",
    "validatorNotes": "Credential verified against issuer registry."
  },
  "changedFields": ["status", "validatedBy", "validatedAt", "validatorNotes"]
}
```

### 3.2 Sensitive Field Redaction (GDPR)

Certain fields MUST be redacted in audit logs visible to non-compliance personnel:

| Field | Redaction Rule | Why |
|-------|----------------|-----|
| `passwordHash` | Always redact (hash-only, not plaintext) | Password hashes are not compliance data |
| `ssn` | Redact all but last 4 digits | PII — minimize exposure |
| `medicalData` | Redact unless actor is medical staff or compliance officer | HIPAA — protect health information |
| `backgroundCheckResult` | Redact unless actor is compliance officer | FCRAsensitive — limit disclosure |
| `thirdPartyRefId` (in external context) | Redact unless actor is validator or compliance officer | Privacy — external verification data |

**Implementation:** Audit log storage includes a `visibilityLevel` enum:
- `PUBLIC` — visible to supervisor+
- `SENSITIVE` — visible to compliance officer+
- `RESTRICTED` — visible to compliance officer + platform admin only

---

## 4. Write Path Audit Mapping

Every write endpoint MUST map to an audit event. Below are the 10 critical write paths:

### 4.1 Template Lifecycle

| Write Path | HTTP | Audit Event | Required Fields |
|-----------|------|------------|-----------------|
| Create template | `POST /api/templates` | `template:created` | `name`, `createdBy` |
| Publish template | `PATCH /api/templates/:id/publish` | `template:published` | `templateId`, `publishedBy`, `publishedAt` |
| Archive template | `PATCH /api/templates/:id/archive` | `template:archived` | `templateId`, `archivedBy`, `reason` |
| Clone template | `POST /api/templates/:id/clone` | `template:cloned` | `sourceTemplateId`, `newTemplateId`, `clonedBy` |
| Assign template | `POST /api/assignments` | `template_assignment:created` | `templateId`, `employeeId`, `assignedBy`, `dueDate` |

### 4.2 Proof Fulfillment Workflow

| Write Path | HTTP | Audit Event | Required Fields |
|-----------|------|------------|-----------------|
| Self-attest | `PATCH /api/fulfillments/:id/self-attest` | `fulfillment:self_attested` | `fulfillmentId`, `employeeId`, `attestation`, `timestamp` |
| Upload document | `POST /api/fulfillments/:id/upload` | `fulfillment:document_uploaded` | `fulfillmentId`, `documentId`, `uploadedAt`, `uploadedBy` |
| Third-party verify | `PATCH /api/fulfillments/:id/third-party-verify` | `fulfillment:third_party_verified` | `fulfillmentId`, `issuerId`, `verificationRefId`, `result` |
| Validate | `PATCH /api/fulfillments/:id/validate` | `fulfillment:validated` | `fulfillmentId`, `validatedBy`, `validatedAt`, `notes`, `approvalChain` |
| Reject | `PATCH /api/fulfillments/:id/reject` | `fulfillment:rejected` | `fulfillmentId`, `rejectedBy`, `reason`, `rejectionDetails` |
| Expire (automatic) | Cron job | `fulfillment:expired` | `fulfillmentId`, `expiresAt`, `renewalDueDate` |

### 4.3 Override & Waiver

| Write Path | HTTP | Audit Event | Required Fields |
|-----------|------|------------|-----------------|
| Extend expiration | `POST /api/overrides/expiration-extend` | `override:expiration_extended` | `fulfillmentId`, `originalExpiration`, `newExpiration`, `reason`, `approvedBy` |
| Override proof | `POST /api/overrides/proof-override` | `override:proof_marked_complete` | `fulfillmentId`, `originalStatus`, `overrideReason`, `approvalChain` |
| Waive requirement | `POST /api/overrides/requirement-waive` | `override:requirement_waived` | `requirementId`, `employeeId`, `waiverReason`, `reviewDate`, `approvalChain` |
| Grant grace period | `POST /api/overrides/grace-period` | `override:grace_period_granted` | `requirementId`, `employeeId`, `gracePeriodEnd`, `reason`, `approvedBy` |

### 4.4 Standards & Customization

| Write Path | HTTP | Audit Event | Required Fields |
|-----------|------|------------|-----------------|
| Create standard | `POST /api/standards` | `standard:created` | `name`, `jurisdiction`, `createdBy` |
| Add requirement | `POST /api/standards/:id/requirements` | `standard_requirement:added` | `standardId`, `requirementName`, `proofType`, `minAttestationLevel`, `createdBy` |
| Customize requirement | `POST /api/standards/:id/customize` | `standard_requirement:customized` | `standardId`, `requirementId`, `oldMinLevel`, `newMinLevel`, `customizationReason` |
| Create custom standard | `POST /api/standards/custom` | `custom_standard:created` | `name`, `orgId`, `createdBy`, `baseStandardId` |

### 4.5 Issuer & Verification

| Write Path | HTTP | Audit Event | Required Fields |
|-----------|------|------------|-----------------|
| Register issuer | `POST /api/issuers` | `issuer:created` | `issuerName`, `trustTier`, `createdBy` |
| Deactivate issuer | `PATCH /api/issuers/:id/deactivate` | `issuer:deactivated` | `issuerId`, `reason`, `deactivatedBy` |
| Request verification | Internal call | `verification_request:issued` | `fulfillmentId`, `issuerId`, `requestId`, `sentAt` |
| Receive verification result | Internal call | `verification_result:received` | `requestId`, `result`, `resultData`, `processedBy`, `receivedAt` |

---

## 5. Data Retention Policies

### 5.1 Retention Schedule by Regulatory Context

| Audit Event Category | Regulated Industry | Retention Period | Reason |
|---------------------|-------------------|------------------|--------|
| **Authentication** | All | 1 year | Account access forensics |
| **Employee Lifecycle** | All | 7 years | Hiring/termination verification |
| **Template & Assignment** | All | 7 years | Proof requirement traceability |
| **Proof Fulfillment** | All | 7 years | Qualification proof archive |
| **Override & Waiver** | All | 7 years + 3 more if disputed | Regulatory appeals/disputes |
| **Standards & Customization** | All | 7 years | Compliance framework documentation |
| **Issuer Verification** | All | 7 years | Third-party attestation proof |
| **RBAC Changes** | All | 3 years | Access control change history |
| **Data Export/Disclosure** | All | 10 years | GDPR/legal hold compliance |
| **Medical/Sensitive Data** | Healthcare (HIPAA) | 10 years post-termination | HIPAA medical records minimum |
| **Background Checks** | All | 7 years | FCRA compliance |
| **Safety/Regulatory** | Aviation, Nuclear, Safety-critical | 10+ years | Industry-specific requirements |

**Default Rule:** Absent a specific regulatory requirement, retain audit logs for **7 years** from the date of the logged event.

### 5.2 Retention Enforcement

```sql
-- Automatic retention policy application
DELETE FROM audit_logs 
WHERE 
  -- 7-year default for most events
  (
    DATE_PART('year', CURRENT_DATE) - DATE_PART('year', timestamp) > 7
    AND action NOT IN (
      'override:*', 'approval:*', 'medical:*', 'background_check:*'
    )
  )
  -- 10-year for medical (HIPAA)
  OR (
    action LIKE 'medical:%'
    AND DATE_PART('year', CURRENT_DATE) - DATE_PART('year', timestamp) > 10
  )
  -- 10-year for background checks (FCRA)
  OR (
    action LIKE 'background:%'
    AND DATE_PART('year', CURRENT_DATE) - DATE_PART('year', timestamp) > 10
  )
  -- 10-year for overrides (extended for disputes)
  OR (
    action LIKE 'override:%'
    AND DATE_PART('year', CURRENT_DATE) - DATE_PART('year', timestamp) > 10
  );
```

### 5.3 Archival & Cold Storage

After the **retention threshold minus 1 year**, audit logs move to cold storage (Azure Blob Storage with immutable blob containers):

1. **Age 6 years → Archive to Blob** — Remove from hot PostgreSQL, store in append-only blob with SHA-256 manifest
2. **Age 7 years → Seal archive** — Write manifest fingerprint to audit_log_seals table (immutable)
3. **Age 8+ years → Destroy per policy** — Delete from cold storage on schedule

**Immutable Blob Container Configuration:**
```json
{
  "immutabilityPolicies": {
    "immutabilityPeriodDays": 2555,  // 7 years
    "allowProtectedAppendWrites": false
  },
  "encryption": "AES-256",
  "accessTier": "Archive"
}
```

---

## 6. Tamper-Evidence & Integrity

### 6.1 Hash Chain (Blockchain-Style Integrity)

To prevent an attacker from silently modifying audit logs, implement a hash chain:

```json
{
  "id": "audit-entry-uuid",
  "timestamp": "2026-03-21T14:30:00Z",
  "action": "fulfillment:validated",
  "actor": "compliance-officer-uuid",
  "body": { /* full event JSON */ },
  "hash": "sha256(previous_hash + action + timestamp + body)",
  "previousHash": "sha256-of-prior-entry",
  "sequenceNumber": 12847
}
```

**Hash Calculation:**
```
hash = SHA256(previousHash + "|" + sequenceNumber + "|" + timestamp + "|" + action + "|" + JSON.stringify(body, sorted_keys))
```

**Verification:** A tool can re-compute all hashes from the starting point and detect any tampering. If entry N's hash doesn't match the recomputed value, entries N onward have been modified.

### 6.2 Checksum Archive Manifest

When archiving audit logs to cold storage, create a manifest:

```json
{
  "manifestId": "manifest-uuid",
  "archivedAt": "2026-03-21T00:00:00Z",
  "recordCount": 50000,
  "recordRange": {
    "firstSequenceNumber": 10001,
    "lastSequenceNumber": 60000,
    "firstHash": "sha256-of-entry-10001",
    "lastHash": "sha256-of-entry-60000"
  },
  "blobStorageUri": "https://storage.azure.com/container/archive-2019.blob",
  "blobChecksum": "sha256-of-entire-blob-file",
  "sealedBy": "compliance-officer-uuid",
  "sealedAt": "2026-03-21T02:00:00Z",
  "sealSignature": "digital-signature-of-manifest"  // HMAC-SHA256 using Key Vault key
}
```

### 6.3 Quarterly Integrity Checks

Every quarter, run an integrity audit:

1. **Extract archived logs** from cold storage
2. **Recompute all hashes** from the first entry to the last
3. **Verify against manifest** — lastHash must match
4. **Log the verification result** to audit_log_integrity_checks table

```sql
INSERT INTO audit_log_integrity_checks (
  archiveId, verificationDate, recordCount, 
  firstHashVerified, lastHashVerified, 
  integrityStatus, verifiedBy
) VALUES (...)
```

---

## 7. GDPR Data Subject Access Requests

### 7.1 Data Subject Rights

Under GDPR Articles 15-20, when an employee or ex-employee requests "all data you hold about me," we MUST provide:

1. **All audit log entries mentioning them** (as data subject)
2. **All audit entries they triggered** (as actor)
3. **All data accessed, modified, or exported about them**
4. **Timeline of all access** to their sensitive data

### 7.2 GDPR Query Template

```sql
-- Find all audit entries relating to data subject
SELECT 
  id, timestamp, action, actor, actorRole,
  entityType, recordId, reason, status,
  before, after, changedFields
FROM audit_logs
WHERE 
  -- Entries where data subject is the primary entity
  recordId IN (
    SELECT id FROM proof_fulfillments WHERE employeeId = $1
    UNION
    SELECT id FROM template_assignments WHERE employeeId = $1
    UNION
    SELECT id FROM employees WHERE id = $1
    UNION
    ...
  )
  -- Entries where data subject is the actor
  OR actor = $1
  -- Entries that mention the data subject in changedFields or before/after
  OR (before->>'employeeId' = $1)
  OR (after->>'employeeId' = $1)
ORDER BY timestamp DESC;
```

### 7.3 GDPR Export Format

Return as a human-readable PDF + machine-readable JSON:

**PDF (Printable):**
```
GDPR Data Subject Access Report
Subject: John Doe (Employee ID: emp-uuid)
Generated: 2026-03-21
Period: 2019-01-01 to 2026-03-21

Timeline of all actions involving your data:
1. 2023-06-15 10:30 — Manager assigned CPR Certification template (Reason: Annual requirement)
2. 2023-07-20 14:22 — You uploaded CPR card (File: CPR-2023.pdf)
3. 2023-07-21 09:15 — Compliance Officer validated CPR card (Notes: Card authentic)
...
```

**JSON (Machine-readable):**
```json
{
  "requestId": "gdpr-request-uuid",
  "dataSubject": "emp-uuid",
  "requestDate": "2026-03-20T10:00:00Z",
  "responseDate": "2026-03-21T10:00:00Z",
  "totalRecords": 247,
  "auditEntries": [
    { /* full audit entry */ },
    ...
  ]
}
```

### 7.4 Response Timeline

- **Request received** → Log as `data:export_requested`
- **Within 10 days** → Acknowledge receipt, provide estimated delivery date
- **Within 30 days** (or 60 if complex) → Deliver full export, log as `data:export_delivered`
- **Keep proof** → Audit log entry confirms delivery method, recipient acknowledgment

---

## 8. Audit Log Query API

### 8.1 Query Endpoint

```
GET /api/audit/logs?action=fulfillment:validated&recordId=:id&actor=:userId&after=2026-01-01&before=2026-03-21&limit=100&offset=0
```

**Required Parameters:**
- `recordId` OR `actor` OR `action` — Must specify at least one filter

**Optional Parameters:**
- `action` — Filter by event type (supports wildcards: `fulfillment:*`)
- `recordId` — Filter by entity ID affected
- `actor` — Filter by user who performed action
- `actorRole` — Filter by role at time of action
- `entityType` — Filter by entity type (ProofFulfillment, TemplateAssignment, etc.)
- `after` — ISO 8601 datetime; audit entries on or after this time
- `before` — ISO 8601 datetime; audit entries before this time
- `status` — Filter by success/failure
- `limit` — Pagination limit (max 1000)
- `offset` — Pagination offset

### 8.2 Response Schema

```json
{
  "data": [
    {
      "id": "audit-uuid",
      "timestamp": "2026-03-21T14:30:00Z",
      "action": "fulfillment:validated",
      "actor": "user-uuid",
      "actorRole": "COMPLIANCE_OFFICER",
      "entityType": "ProofFulfillment",
      "recordId": "fulfillment-uuid",
      "reason": "Medical clearance review",
      "status": "success",
      "changedFields": ["status", "validatedBy"],
      "metadata": { "ipAddress": "192.0.2.1", ... }
    }
  ],
  "pagination": {
    "total": 5432,
    "limit": 100,
    "offset": 0,
    "pages": 55
  }
}
```

### 8.3 RBAC on Audit Log Queries

| Role | Can Query | Visibility |
|------|-----------|-----------|
| **EMPLOYEE** | Own entries only (as actor or data subject) | Redacted (no IP, no approval chains, no actor context) |
| **SUPERVISOR** | Team member entries | Redacted (no passwords, no medical unless needed) |
| **MANAGER** | Department entries | Redacted (no medical unless healthcare) |
| **COMPLIANCE_OFFICER** | All entries | Full (unrestricted) |
| **ADMIN** | All entries | Full (unrestricted) |

### 8.4 Export Endpoint

```
POST /api/audit/export
{
  "format": "json|csv|pdf",
  "action": "fulfillment:*",
  "recordId": "fulfillment-uuid",
  "after": "2026-01-01",
  "before": "2026-03-21"
}
```

Returns:
- `json` — Full audit entries with all fields
- `csv` — Flattened audit entries (suitable for Excel)
- `pdf` — Human-readable report with summary statistics

**Audit logging:** Every audit export is itself logged as `audit:log_export_requested` and `audit:log_export_delivered`.

---

## 9. RBAC Implications

### 9.1 Audit Log Access Permissions

```
audit:logs:read:own
  └─ Employee can read audit entries where they are actor or data subject
  
audit:logs:read:team
  └─ Supervisor can read audit entries for their direct reports
  
audit:logs:read:department
  └─ Manager can read audit entries for their department
  
audit:logs:read:all
  └─ Compliance Officer, Admin can read all audit entries
  
audit:logs:export:own
  └─ Employee can export their own audit trail (GDPR SAR)
  
audit:logs:export:department
  └─ Manager can export department-wide audit trails
  
audit:logs:export:all
  └─ Compliance Officer, Admin can export all audit trails
  
audit:logs:retention:modify
  └─ Admin only — modify retention policies
  
audit:logs:archive:manage
  └─ Admin only — manage cold storage archival
```

### 9.2 Separation of Duties in Audit Logging

Enforce these rules in code:

1. **No self-deletion of audit entries** — An actor cannot delete audit entries of their own actions
2. **No audit log modification** — Audit logs are append-only; no UPDATE or DELETE (except via scheduled retention)
3. **Dual audit approvals** — Override audit entries require two distinct approvers

---

## 10. Risk Assessment

### 10.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **Audit log tampering** | Attacker modifies audit entries to cover tracks | Hash chain + quarterly integrity checks |
| **Audit log deletion** | Attacker deletes audit entries to erase evidence | Immutable blob storage + append-only DB design |
| **Excessive logging overhead** | High write volume causes database performance degradation | Batch writes, async logging, index optimization |
| **Sensitive data in logs** | PII/health data exposed in audit entries | Redaction rules per visibility level |
| **Unauthorized audit access** | Non-compliance staff reads confidential audit trails | RBAC enforcement + field-level encryption |
| **Log retention expiry loss** | Old logs deleted before investigation needs them | 7-10 year retention minimums per regulation |
| **Time synchronization attacks** | Attacker manipulates timestamp to reorder entries | NTP time synchronization + server-only timestamps |

---

## 11. Mitigation Controls

### 11.1 Database-Level Controls

```sql
-- Audit logs are append-only
ALTER TABLE audit_logs DISABLE TRIGGER ALL;
ALTER TABLE audit_logs SET (fillfactor = 100);

-- No direct UPDATE/DELETE
REVOKE UPDATE, DELETE ON audit_logs FROM application_user;
GRANT INSERT, SELECT ON audit_logs TO application_user;

-- Hash chain integrity check
CREATE FUNCTION audit_hash_chain_check() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hash != sha256(
    OLD.previousHash || '|' || 
    NEW.sequenceNumber || '|' ||
    NEW.timestamp || '|' ||
    NEW.action || '|' ||
    NEW.body::text
  )::text THEN
    RAISE EXCEPTION 'Hash chain integrity violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_hash_check
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_hash_chain_check();
```

### 11.2 Application-Level Controls

1. **Centralized audit logger** — Single service (`AuditService`) that all modules use
2. **Structured logging** — All audit entries follow the schema in §3
3. **Mandatory reason field** — Approvals and overrides require justification
4. **No raw queries** — All audit queries go through the `/api/audit` endpoints (RBAC enforced)
5. **Request correlation** — All log entries from a single API request share a `requestId`

### 11.3 Infrastructure Controls

1. **Immutable blob storage** — Azure Blob Storage with immutability policies (legal hold + time-based)
2. **Cold storage encryption** — AES-256-GCM for all archived logs
3. **Key rotation** — HMAC-SHA256 signing keys rotated annually via Key Vault
4. **Access logging** — Every access to audit logs is itself logged (meta-audit)
5. **Retention enforcement** — Automated cron job deletes logs past retention threshold

---

## 12. Phased Rollout

### Phase 1: Core Audit Infrastructure (Months 1-2)

- [ ] Implement AuditLog Prisma model with before/after snapshots
- [ ] Centralize AuditService across all modules
- [ ] Add audit logging to all write endpoints (create, update, delete)
- [ ] Implement audit log query API with RBAC
- [ ] Deploy to staging; run 2-week audit volume baseline

**Success Criteria:**
- All write endpoints log events
- No audit log growth > 1 GB/day in staging
- Query API responds < 500ms for 30-day range

### Phase 2: Retention & Archival (Months 2-3)

- [ ] Implement retention schedule (§5.1)
- [ ] Set up Azure Blob Storage immutable containers
- [ ] Build archive migration process
- [ ] Deploy quarterly integrity checks
- [ ] Test restore/recovery procedures

**Success Criteria:**
- Archive migration runs without data loss
- Integrity check detects seeded hash corruption
- Recovery from blob storage completes < 24 hours

### Phase 3: Hash Chain & Tamper Evidence (Months 3-4)

- [ ] Implement hash chain per §6.1
- [ ] Deploy manifest sealing (§6.2)
- [ ] Add quarterly integrity audits (§6.3)
- [ ] Load-test hash computation on 10M+ entries
- [ ] Document tamper-evident procedures for auditors

**Success Criteria:**
- Hash chain recomputation completes in < 30 minutes for 10M entries
- Hash corruption is automatically detected
- Auditors can independently verify chain

### Phase 4: GDPR SAR & Export Tools (Months 4-5)

- [ ] Implement GDPR data subject query (§7.2)
- [ ] Build PDF + JSON export tools (§7.3)
- [ ] Test SAR fulfillment workflow end-to-end
- [ ] Document 30-day response SLA
- [ ] Train compliance staff on SAR process

**Success Criteria:**
- First GDPR SAR fulfilled within 30 days
- Export tool generates correct, complete data
- Legal/compliance approval workflow functions

### Phase 5: Auditor Readiness (Months 5-6)

- [ ] Create auditor runbooks (how to verify audit trail)
- [ ] Conduct pilot with external auditor
- [ ] Address auditor feedback
- [ ] Deploy to production with full monitoring
- [ ] Schedule monthly integrity attestation

**Success Criteria:**
- External auditor validates audit controls
- Production audit volume baseline < 100 MB/day
- 100% of compliance-material events logged

---

## Appendix: Audit Event Reference

### Fulfillment Events

- `fulfillment:self_attested` — Employee declares completion
- `fulfillment:document_uploaded` — Employee uploads supporting document
- `fulfillment:third_party_verified` — External third-party confirms status
- `fulfillment:validated` — Compliance Officer approves after review
- `fulfillment:rejected` — Compliance Officer rejects as insufficient
- `fulfillment:expired` — Fulfillment expires; renewal due
- `fulfillment:reactivated` — Expired fulfillment renewed

### Override Events

- `override:expiration_extended` — Expiration date pushed forward with approval
- `override:proof_marked_complete` — Proof marked fulfilled without standard evidence
- `override:requirement_waived` — Specific requirement exempted for employee
- `override:grace_period_granted` — Temporary compliance extension
- `override:approval_chain_completed` — Multi-step override approval finished

### GDPR/Privacy Events

- `data:export_requested` — Data subject requests "tell me what you have"
- `data:export_delivered` — Export fulfilled and sent to data subject
- `data:access_granted_external` — External party granted access to data (evidence package)
- `data:field_redacted` — Field redacted for privacy
- `data:retention_policy_applied` — Data deletion per retention schedule

---

**Document Status:** Draft → Ready for Review → Approved by Legal/Compliance  
**Last Updated:** 2026-03-21  
**Next Review:** 2026-09-21 (6-month cycle)
