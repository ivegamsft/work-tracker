# Qualification & Attestation Override API — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #102  
> **Applies To:** `apps/api/src/modules/qualifications`, `apps/api/src/modules/medical`, `data/prisma/schema.prisma`  
> **Related Decisions:** Decision 4 (Lock regulatory/flex custom), Decision 5 (L1-L4 attestation), Decision 6 (Full overrides with audit)  
> **Companion Docs:** [Templates Attestation Spec](./templates-attestation-spec.md) · [Proof Compliance Audit](./proof-compliance-audit.md)

---

## 1. Problem Statement

Compliance workflows require **overrides** (exemptions, approvals, waivers) that audit systems must track:

1. **No override mechanism** — Manager cannot waive expired certification without deleteing evidence
2. **No approval workflow** — Overrides approved by one person; requires dual-approval for regulatory
3. **No exemption types** — Cannot distinguish temporary waiver vs permanent exemption
4. **Expiration immutable** — Cannot extend expired proof without re-submission
5. **No third-party invite** — L3 verification requires external verifier; no workflow for that
6. **No override audit trail** — Who overrode, why, when, approved by whom — all missing

**Impact:** Cannot demonstrate regulatory compliance (no audit trail); cannot handle real-world scenarios (exemptions, extensions, waivers).

---

## 2. Solution Overview

Implement **complete override & attestation workflow**:

- **Override CRUD** — Create, approve, reject, expire overrides for 4 types
- **Approval workflow** — Single-approval for manager overrides, dual-approval for regulatory
- **Exemption engine** — Temporary (with end date) vs permanent (with reason)
- **External invite** — Send verification link to 3rd-party (e.g., doctor, training provider)
- **Attestation submission** — Employee submits proof at L1-L4 levels
- **Approval routing** — Route to appropriate reviewer (manager, compliance officer)
- **Query composition** — Standards → Requirements → Proofs with layered filtering

---

## 3. API Endpoints

### 3.1 Override Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/compliance/overrides` | POST | Create override (exemption, waiver, extension, exception) |
| `GET /api/v1/compliance/overrides` | GET | List overrides (filters: employee, type, status) |
| `GET /api/v1/compliance/overrides/:overrideId` | GET | Get override details |
| `POST /api/v1/compliance/overrides/:overrideId/approve` | POST | Approve override |
| `POST /api/v1/compliance/overrides/:overrideId/reject` | POST | Reject override |
| `POST /api/v1/compliance/overrides/:overrideId/expire` | POST | Expire override |
| `DELETE /api/v1/compliance/overrides/:overrideId` | DELETE | Soft-delete override |

#### Request/Response Schemas

**`POST /api/v1/compliance/overrides` (Create Override)**

```json
{
  "employee_id": "emp_001",
  "qualification_id": "qual_abc123",
  "override_type": "exemption",
  "reason": "Medical condition prevents training completion",
  "requested_by": "manager_001",
  "effective_date": "2026-03-21T00:00:00Z",
  "end_date": null,
  "requires_approval": true,
  "approval_routing": "compliance_officer",
  "notes": "Requires accommodation per HR"
}
```

**Response:**

```json
{
  "id": "override_xyz789",
  "employee_id": "emp_001",
  "qualification_id": "qual_abc123",
  "override_type": "exemption",
  "reason": "Medical condition prevents training completion",
  "status": "pending_approval",
  "requested_by": "manager_001",
  "requested_at": "2026-03-21T10:30:45Z",
  "effective_date": "2026-03-21T00:00:00Z",
  "end_date": null,
  "approved_by": null,
  "approved_at": null,
  "approval_notes": null,
  "audit_trail": [
    {
      "action": "created",
      "actor": "manager_001",
      "timestamp": "2026-03-21T10:30:45Z"
    }
  ]
}
```

**`POST /api/v1/compliance/overrides/:overrideId/approve` (Approve)**

```json
{
  "approved_by": "compliance_officer_001",
  "approval_notes": "Approved per medical accommodation"
}
```

### 3.2 Attestation Submission

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/compliance/proofs/submit` | POST | Submit proof (L1-L4) |
| `GET /api/v1/compliance/proofs/:proofId` | GET | Get proof details |
| `PATCH /api/v1/compliance/proofs/:proofId` | PATCH | Update proof (re-submit after rejection) |
| `GET /api/v1/compliance/proofs/:proofId/review` | GET | Get review queue item |

**`POST /api/v1/compliance/proofs/submit` (Employee submits L1 self-attestation)**

```json
{
  "assignment_id": "assign_001",
  "requirement_id": "req_xyz789",
  "attestation_level": "self_attest",
  "attestation_data": {
    "attested": true,
    "attestation_date": "2026-03-21T00:00:00Z",
    "statement": "I certify that I have completed this training"
  }
}
```

**Response:**

```json
{
  "id": "proof_abc123",
  "assignment_id": "assign_001",
  "employee_id": "emp_001",
  "requirement_id": "req_xyz789",
  "attestation_level": "self_attest",
  "status": "submitted",
  "submitted_at": "2026-03-21T10:30:45Z",
  "evidence_url": null,
  "third_party_verification_pending": false
}
```

**`POST /api/v1/compliance/proofs/submit` (Employee uploads L2 document)**

```json
{
  "assignment_id": "assign_001",
  "requirement_id": "req_xyz789",
  "attestation_level": "upload",
  "evidence_file": "file_upload_binary",
  "file_name": "training-certificate.pdf",
  "mime_type": "application/pdf"
}
```

**`POST /api/v1/compliance/proofs/submit` (Invite L3 third-party)**

```json
{
  "assignment_id": "assign_001",
  "requirement_id": "req_xyz789",
  "attestation_level": "third_party",
  "third_party_email": "doctor@clinic.example.com",
  "third_party_name": "Dr. Smith",
  "verification_template": "medical_clearance",
  "send_invite": true
}
```

**Response:**

```json
{
  "id": "proof_xyz789",
  "status": "awaiting_verification",
  "verification_token": "verify_abc123...",
  "verification_url": "https://app.example.com/verify/verify_abc123...",
  "third_party_invited_at": "2026-03-21T10:30:45Z",
  "third_party_invite_expires_at": "2026-04-04T10:30:45Z"
}
```

### 3.3 Review & Approval (L4 Validation)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/compliance/proofs/review-queue` | GET | Get L4 validation queue |
| `POST /api/v1/compliance/proofs/:proofId/approve` | POST | Approve proof (L4 validation) |
| `POST /api/v1/compliance/proofs/:proofId/reject` | POST | Reject proof with feedback |
| `POST /api/v1/compliance/proofs/:proofId/request-changes` | POST | Request re-submission |

**`GET /api/v1/compliance/proofs/review-queue` (Manager/Compliance Officer)**

Query params: `status=pending`, `proof_type=certification`, `employee_id=emp_001`, `limit=50`

**Response:**

```json
{
  "total": 125,
  "pending": 23,
  "items": [
    {
      "id": "proof_abc123",
      "employee_id": "emp_001",
      "employee_name": "John Doe",
      "requirement": {
        "name": "CPR Certification",
        "proof_type": "certification"
      },
      "attestation_level": "upload",
      "status": "submitted",
      "submitted_at": "2026-03-21T09:15:00Z",
      "evidence_url": "/api/v1/documents/doc_001",
      "priority": "normal"
    }
  ]
}
```

**`POST /api/v1/compliance/proofs/:proofId/approve` (Validate L4)**

```json
{
  "approved_by": "manager_001",
  "approval_notes": "Certificate verified as authentic",
  "validation_date": "2026-03-21T10:40:00Z"
}
```

### 3.4 Standards & Requirements Query (Composition)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/reference/standards` | GET | List compliance standards |
| `GET /api/v1/reference/standards/:standardId` | GET | Get standard with requirements |
| `GET /api/v1/compliance/employees/:employeeId/readiness` | GET | Get employee readiness (all standards) |

**`GET /api/v1/reference/standards/:standardId`**

Response:

```json
{
  "id": "standard_osha_001",
  "name": "OSHA 10-Hour Construction",
  "description": "Required for all construction workers",
  "requirements": [
    {
      "id": "req_001",
      "name": "OSHA 10-Hour Card",
      "proof_type": "certification",
      "attestation_levels": ["upload"],
      "is_required": true,
      "expiry_days": 365
    },
    {
      "id": "req_002",
      "name": "Drug Screening",
      "proof_type": "clearance",
      "attestation_levels": ["third_party"],
      "is_required": true,
      "expiry_days": 365
    }
  ]
}
```

**`GET /api/v1/compliance/employees/:employeeId/readiness`**

Response:

```json
{
  "employee_id": "emp_001",
  "name": "John Doe",
  "readiness_score": 0.75,
  "status": "partially_compliant",
  "standards": [
    {
      "standard_id": "standard_osha_001",
      "name": "OSHA 10-Hour Construction",
      "completion": 0.5,
      "requirements": [
        {
          "id": "req_001",
          "name": "OSHA 10-Hour Card",
          "status": "completed",
          "expiry_date": "2027-03-21T00:00:00Z",
          "proof_id": "proof_abc123"
        },
        {
          "id": "req_002",
          "name": "Drug Screening",
          "status": "not_started",
          "deadline": "2026-04-21T23:59:59Z"
        }
      ]
    }
  ]
}
```

---

## 4. Validation Schemas (Zod)

```typescript
// apps/api/src/modules/qualifications/validators.ts

import { z } from 'zod';

export const overrideTypeSchema = z.enum([
  'exemption',     // Permanent waiver (medical, accommodation)
  'waiver',        // Temporary waiver (will re-assess)
  'extension',     // Deadline extension (proof in progress)
  'exception'      // Ad-hoc exception (one-off override)
]);

export const overrideCreateSchema = z.object({
  employee_id: z.string().uuid(),
  qualification_id: z.string().uuid(),
  override_type: overrideTypeSchema,
  reason: z.string().min(10).max(500),
  requested_by: z.string().uuid(),
  effective_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
  requires_approval: z.boolean().default(true),
  approval_routing: z.enum(['manager', 'compliance_officer']).default('compliance_officer'),
  notes: z.string().optional(),
});

export const attestationLevelSchema = z.enum(['self_attest', 'upload', 'third_party', 'validated']);

export const proofSubmissionSchema = z.object({
  assignment_id: z.string().uuid(),
  requirement_id: z.string().uuid(),
  attestation_level: attestationLevelSchema,
  attestation_data: z.object({
    attested: z.boolean(),
    attestation_date: z.string().datetime(),
    statement: z.string().optional(),
  }).optional(),
  evidence_file: z.instanceof(File).optional(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  third_party_email: z.string().email().optional(),
  third_party_name: z.string().optional(),
  verification_template: z.string().optional(),
  send_invite: z.boolean().default(true),
});

export const proofApprovalSchema = z.object({
  approved_by: z.string().uuid(),
  approval_notes: z.string().optional(),
  validation_date: z.string().datetime(),
});

export const proofRejectionSchema = z.object({
  rejected_by: z.string().uuid(),
  rejection_reason: z.string().min(10).max(500),
  rejection_date: z.string().datetime(),
});

export type OverrideCreateInput = z.infer<typeof overrideCreateSchema>;
export type ProofSubmissionInput = z.infer<typeof proofSubmissionSchema>;
export type ProofApprovalInput = z.infer<typeof proofApprovalSchema>;
```

---

## 5. Data Model Changes (Prisma)

```prisma
// data/prisma/schema.prisma

model QualificationOverride {
  id              String   @id @default(uuid())
  tenantId        String
  employeeId      String
  qualificationId String
  
  overrideType    String   // exemption, waiver, extension, exception
  reason          String
  
  status          String   @default("pending_approval")
  
  requestedAt     DateTime @default(now())
  requestedBy     String   // user_id
  
  effectiveDate   DateTime
  endDate         DateTime?
  
  approvalRouting String?  // manager, compliance_officer
  requiresApproval Boolean @default(true)
  
  approvedAt      DateTime?
  approvedBy      String?
  approvalNotes   String?
  
  rejectedAt      DateTime?
  rejectedBy      String?
  rejectionReason String?
  
  expiredAt       DateTime?
  
  notes           String?
  
  auditTrail      Json     @default("[]")
  
  @@index([tenantId, employeeId])
  @@index([status])
  @@index([effectiveDate])
}

model ProofSubmission {
  id              String   @id @default(uuid())
  tenantId        String
  employeeId      String
  assignmentId    String
  requirementId   String
  
  attestationLevel String // self_attest, upload, third_party, validated
  status          String  @default("submitted")
  
  // Attestation data (L1)
  attestationData Json?
  
  // Document upload (L2)
  documentId      String?
  documentUrl     String?
  mimeType        String?
  
  // Third-party verification (L3)
  thirdPartyEmail String?
  thirdPartyName  String?
  verificationToken String?
  verificationExpires DateTime?
  verificationResultsAt DateTime?
  
  // Internal validation (L4)
  validatedAt     DateTime?
  validatedBy     String?
  validationNotes String?
  
  submittedAt     DateTime @default(now())
  
  // Audit
  rejectedAt      DateTime?
  rejectionReason String?
  
  requestedChangesAt DateTime?
  requestedChangesReason String?
  
  @@index([tenantId, employeeId])
  @@index([assignmentId, requirementId])
  @@index([status])
  @@index([verificationToken])
}
```

---

## 6. RBAC Rules

### 6.1 Override Management

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/compliance/overrides` | ✗ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/compliance/overrides` | ✗ (own) | ✓ (team) | ✓ (team) | ✓ (all) | ✓ (all) |
| `POST /overrides/:id/approve` | ✗ | ✓ (manager) | ✓ | ✓ | ✓ |
| `POST /overrides/:id/reject` | ✗ | ✓ (manager) | ✓ | ✓ | ✓ |

### 6.2 Proof Submission & Review

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/compliance/proofs/submit` | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (any) |
| `GET /api/v1/compliance/proofs/review-queue` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `POST /proofs/:id/approve` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `POST /proofs/:id/reject` | ✗ | ✗ | ✓ | ✓ | ✓ |

---

## 7. Error Responses

```json
{
  "error": {
    "code": "QUALIFICATION_ERROR",
    "message": "Description",
    "details": {}
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Override type invalid | 400 | `INVALID_OVERRIDE_TYPE` |
| Requirement not found | 404 | `REQUIREMENT_NOT_FOUND` |
| Override already approved | 409 | `OVERRIDE_ALREADY_APPROVED` |
| Approval insufficient (dual needed) | 403 | `DUAL_APPROVAL_REQUIRED` |
| Proof not found | 404 | `PROOF_NOT_FOUND` |
| Invalid attestation level | 400 | `INVALID_ATTESTATION_LEVEL` |
| Third-party invite failed | 500 | `INVITE_SEND_FAILED` |
| Document upload failed | 400 | `UPLOAD_FAILED` |
| Employee not found | 404 | `EMPLOYEE_NOT_FOUND` |

---

## 8. Security & Compliance

### 8.1 Dual-Approval for Regulatory Overrides

- **Exemption approval** — Requires manager + compliance officer dual sign-off
- **Attestation** — At least one reviewer with separation of duties
- **Audit immutable** — Override audit trail cannot be deleted or modified

### 8.2 Evidence Handling

- **Document encryption** — All uploaded documents stored encrypted; returned via signed URL only
- **Third-party data** — External verification results encrypted; never stored in plaintext
- **PII redaction** — Audit logs redact sensitive fields (SSN, DOB from documents)

### 8.3 Expiration & Renewal

- **No deletion on expiry** — Expired proofs marked as historical; renewal creates new cycle
- **Renewal audit** — Previous fulfillment linked to renewal via `priorCycleId`
- **Override expiry** — End date enforced; override automatically expires without manual intervention

---

## 9. Phased Rollout

### Phase 1 (Sprint 5) — Override Foundations

- [ ] Create Prisma models (QualificationOverride, ProofSubmission)
- [ ] Implement override CRUD endpoints
- [ ] Basic approval workflow (single-approval)
- [ ] Unit tests for override creation & approval
- **Success Criteria:** Can create and approve overrides

### Phase 2 (Sprint 6) — Attestation Submission

- [ ] Implement proof submission endpoints (L1-L3)
- [ ] Document upload to vault
- [ ] Third-party invite workflow
- [ ] Integration tests with file uploads
- **Success Criteria:** Employee can submit proof, third-party receives verification link

### Phase 3 (Sprint 7) — Review & Approval

- [ ] Implement L4 validation (manager/compliance officer review)
- [ ] Review queue endpoints
- [ ] Approval/rejection routing
- [ ] Dual-approval enforcement for regulatory
- **Success Criteria:** Manager can approve/reject proofs, overrides require dual-approval

### Phase 4 (Sprint 8) — Composition & Readiness

- [ ] Standards → Requirements → Proofs query composition
- [ ] Readiness score calculation
- [ ] Employee readiness dashboard API
- **Success Criteria:** Can query employee readiness across all standards

---

## 10. Acceptance Criteria

✅ **Phase 1 Acceptance:**

- [ ] Can create override with reason
- [ ] Override status transitions (pending → approved/rejected)
- [ ] All status changes logged to AuditLog
- [ ] Cannot delete approved override
- [ ] Dual-approval enforced for regulatory overrides

---

## 11. Related Specs

- **Templates & Attestation:** `templates-attestation-spec.md`
- **Proof Audit:** `proof-compliance-audit.md`
- **RBAC API:** `rbac-api-spec.md`

