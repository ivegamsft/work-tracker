# Issuer Verification Framework — E-CLAT Platform

> **Status:** Design Spike  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-20  
> **Issue:** [#32 — Design and implement issuer verification framework (L3 attestation)](https://github.com/ivegamsft/work-tracker/issues/32)  
> **Applies To:** `apps/api` (templates module, new `verification` module), `data/prisma/schema.prisma`, `packages/shared`  
> **Companion Docs:** [Templates & Attestation Spec](./templates-attestation-spec.md) · [Proof Taxonomy](./proof-taxonomy.md) · [Proof Vault Spec](./proof-vault-spec.md) · [Sharing Spec](./sharing-spec.md)  
> **Dependencies:** Attestation policy (#30) defines when L3 is required/optional

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Issuer Registry](#2-issuer-registry)
3. [Trust Tier Classification](#3-trust-tier-classification)
4. [Verification Request Lifecycle](#4-verification-request-lifecycle)
5. [Verification Response Schema](#5-verification-response-schema)
6. [Data Model — Prisma Schema Additions](#6-data-model--prisma-schema-additions)
7. [API Endpoints](#7-api-endpoints)
8. [RBAC Requirements](#8-rbac-requirements)
9. [Error Handling & Resilience](#9-error-handling--resilience)
10. [Audit Trail](#10-audit-trail)
11. [State Machine](#11-state-machine)
12. [Integration Patterns](#12-integration-patterns)
13. [Compliance Guardrails](#13-compliance-guardrails)
14. [Implementation Phases](#14-implementation-phases)

---

## 1. Problem Statement

L3 (third-party) attestation is defined in the Templates & Attestation Spec as "External system confirms status (API check, issuer portal, background check service)" with a trust weight of 0.85. Today, the `ProofFulfillment` model stores `thirdPartySource`, `thirdPartyRefId`, and `thirdPartyData` — but there is no framework for:

- **Who** qualifies as a legitimate third-party issuer
- **How** we verify that a claimed third-party attestation is authentic
- **What** trust level we assign to different verification sources
- **When** a verification result expires or must be re-checked

Without an issuer verification framework, L3 attestation is effectively self-reported ("I say Checkr verified me") with no systemic validation. This undermines the 0.85 trust weight and exposes regulated organizations to compliance risk.

### What This Spec Covers

| In Scope | Out of Scope |
|----------|-------------|
| Issuer registry data model | Specific API integrations (Checkr, NCSBN, etc.) |
| Trust tier classification system | Integration implementation code |
| Verification request/response lifecycle | Real-time webhook handlers |
| State machine for verification flow | UI design for verification management |
| RBAC for issuer management | Pricing/licensing for third-party providers |
| Audit trail requirements | Data residency regulations per jurisdiction |

---

## 2. Issuer Registry

### 2.1 What Is an Issuer?

An **issuer** is any external entity that can authoritatively confirm an employee's qualification, credential, clearance, or training completion. Issuers range from government licensing boards (highest authority) to employer-supplied internal references (lowest authority).

### 2.2 Issuer Categories

| Category | Examples | Verification Method |
|----------|----------|-------------------|
| **Government Registry** | State licensing boards, FAA Airman Registry, NRC Operator Database, DOT FMCSA | API lookup against official database |
| **Background Check Provider** | Checkr, GoodHire, CastleBranch, Sterling | API integration with provider |
| **Learning Management System** | Cornerstone, SAP Litmos, Docebo, TalentLMS | API integration for course completion |
| **Professional Body** | (ISC)², PMI, FINRA BrokerCheck, NCSBN Nursys | API or manual portal verification |
| **Medical Provider** | Occupational health clinics, drug test labs (Quest, LabCorp) | API or result-file import |
| **Custom / Manual** | Direct call to issuer, letter on file, faxed confirmation | Manual entry by Compliance Officer |

### 2.3 Issuer Registry Fields

Each registered issuer stores:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Display name (e.g., "California Board of Registered Nursing") |
| `code` | String (unique) | Machine identifier (e.g., `ca-brn`, `checkr`, `nursys`) |
| `category` | Enum | `government_registry`, `background_provider`, `lms`, `professional_body`, `medical_provider`, `custom` |
| `trustTier` | Enum | See §3 — `authoritative`, `delegated`, `employer_supplied`, `manual` |
| `verificationMethod` | Enum | `api_realtime`, `api_batch`, `file_import`, `manual_entry` |
| `apiConfigRef` | String? | Key Vault URI for connection details — NOT raw credentials |
| `supportedProofTypes` | ProofType[] | Which proof types this issuer can verify |
| `supportedSubTypes` | String[] | Specific sub-types (e.g., `["license", "professional_cert"]`) |
| `responseMapping` | Json? | Maps provider-specific fields to canonical verification response |
| `isActive` | Boolean | Whether this issuer is available for new verifications |
| `activatedAt` | DateTime? | When the issuer was approved for use |
| `deactivatedAt` | DateTime? | When the issuer was disabled |
| `deactivationReason` | String? | Why the issuer was disabled |
| `contactInfo` | Json? | Contact details for manual escalation |
| `notes` | String? | Admin notes about the issuer |
| `createdBy` | String | User who registered the issuer |
| `createdAt` | DateTime | Timestamp |
| `updatedAt` | DateTime | Timestamp |

### 2.4 Issuer Credential Storage

For API-based issuers, credentials must be stored securely:

| Credential Type | Storage | Access |
|----------------|---------|--------|
| API key | Azure Key Vault reference | Resolved at verification time only |
| OAuth client secret | Azure Key Vault reference | Resolved at verification time only |
| mTLS certificate | Azure Key Vault reference | Resolved at verification time only |
| Basic auth password | Azure Key Vault reference | Resolved at verification time only |

**Rule:** No issuer credentials stored in the database or application configuration. All credentials referenced by Key Vault secret URI. The `apiConfigRef` field stores the Key Vault URI, not the secret value.

---

## 3. Trust Tier Classification

### 3.1 Trust Tier Definitions

| Tier | Code | Trust Weight | Description | Examples |
|:----:|------|:------------:|-------------|----------|
| **T1** | `authoritative` | 1.00 | Official registry or database maintained by the credentialing authority itself | FAA Airman Registry, state licensing board databases, NRC operator records, FINRA BrokerCheck |
| **T2** | `delegated` | 0.85 | Accredited intermediary authorized to verify on behalf of the authority | Background check providers (Checkr, Sterling), NCSBN Nursys (aggregate nursing license data), drug test laboratories |
| **T3** | `employer_supplied` | 0.65 | Evidence provided by the employer or employee that has been reviewed but not independently verified against an authoritative source | Uploaded certificates reviewed by Compliance Officer, LMS completion records, employer-internal assessment results |
| **T4** | `manual` | 0.45 | Verification performed through offline or unstructured channels | Phone call to issuer, faxed confirmation letter, email verification |

### 3.2 Trust Tier Impact on Readiness Score

The trust tier of the issuer adjusts the base L3 attestation weight (0.85 from the attestation spec):

```
effective_weight = base_L3_weight × tier_multiplier

T1 authoritative:     0.85 × 1.00 = 0.85  (full L3 trust)
T2 delegated:         0.85 × 0.85 = 0.72  (high trust)
T3 employer_supplied: 0.85 × 0.65 = 0.55  (moderate trust)
T4 manual:            0.85 × 0.45 = 0.38  (limited trust)
```

### 3.3 Trust Tier Assignment Rules

| Rule | Rationale |
|------|-----------|
| Only ADMIN can assign T1 (authoritative) tier | Prevents inflated trust from miscategorized issuers |
| COMPLIANCE_OFFICER can assign T2-T4 | Operational flexibility for day-to-day issuer management |
| Tier downgrades require reason and audit entry | Prevents silent trust erosion |
| Tier upgrades to T1 require documented evidence of authoritative status | e.g., link to official API documentation, accreditation certificate |

### 3.4 Attestation Floor Interaction

From the Templates & Attestation Spec §2.6: "Proof type governs attestation floor." The trust tier further constrains this:

| Proof Type | Minimum Trust Tier for L3 | Rationale |
|------------|:------------------------:|-----------|
| `clearance` | T2 (delegated) | Clearances require authoritative or delegated verification; manual/employer-supplied is insufficient |
| `certification` (license sub-type) | T2 (delegated) | Licenses are legally governed; must be verified through official or accredited channels |
| `training` | T3 (employer_supplied) | LMS records from known systems are acceptable |
| `hours` | T3 (employer_supplied) | Timesheet systems and supervisor attestation are accepted norms |
| `assessment` | T2 (delegated) | Exams and checkrides require testing center or examiner confirmation |
| `compliance` | T3 (employer_supplied) | Audit results from known systems are acceptable |

---

## 4. Verification Request Lifecycle

### 4.1 Flow Overview

```
Employee submits L3 fulfillment
        │
        ▼
┌────────────────────────────┐
│ Create VerificationRequest │
│ status: pending            │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐     ┌──────────────────────┐
│ Resolve issuer from        │────▶│ No matching issuer?  │
│ fulfillment context        │     │ → manual_escalation  │
└────────────────────────────┘     └──────────────────────┘
        │
        ▼
┌────────────────────────────┐
│ Dispatch verification      │
│ (API / batch / manual)     │
│ status: in_progress        │
└────────────────────────────┘
        │
        ├──▶ API success → status: verified / not_verified / expired / revoked
        │
        ├──▶ API error → retry logic → status: error (after max retries)
        │
        ├──▶ Manual → CO enters result → status: manually_verified / not_verified
        │
        └──▶ Timeout → status: timed_out → escalate
```

### 4.2 Verification Trigger Points

| Trigger | Context |
|---------|---------|
| Employee submits L3 fulfillment | Auto-triggered when fulfillment includes `third_party` attestation level |
| Compliance Officer initiates manual check | On-demand re-verification of existing fulfillment |
| Scheduled re-verification | Cron job checks approaching expiration dates |
| Issuer pushes update (webhook) | Future: real-time status changes from issuer |

### 4.3 Subject Matching

The verification request must include enough data to match the employee to the issuer's records:

| Match Field | Source | Example |
|-------------|--------|---------|
| `subjectName` | Employee's `firstName` + `lastName` | "Jane Smith" |
| `subjectDob` | Employee profile (if available) | "1985-03-15" |
| `credentialId` | From fulfillment `thirdPartyRefId` or requirement `typeConfig` | "RN-12345-CA" |
| `issuingAuthority` | From requirement context or issuer registry | "California Board of Registered Nursing" |
| `licenseType` | From proof sub-type | "registered_nurse" |

**Privacy constraint:** Only transmit the minimum data fields required by the issuer's API. Never send employee SSN, full address, or medical details unless the issuer contract explicitly requires it and the data handling agreement is on file.

---

## 5. Verification Response Schema

### 5.1 Canonical Response

All verification responses — regardless of source — are normalized to this canonical schema:

```typescript
interface VerificationResponse {
  // Source identification
  issuerId: string;             // FK to IssuerRegistry
  issuerName: string;           // Denormalized for readability
  trustTier: TrustTier;         // Tier at time of verification

  // Subject matching
  subjectMatchConfidence: number;  // 0.0-1.0 — how confident the match is
  subjectMatchMethod: 'exact' | 'fuzzy' | 'partial' | 'manual';

  // Verification result
  status: VerificationStatus;   // verified, not_verified, expired, revoked, inconclusive
  statusDetail: string;         // Human-readable explanation
  
  // Credential details (from issuer)
  credentialId: string | null;  // Credential number as reported by issuer
  credentialType: string | null; // Issuer's classification of the credential
  issueDate: Date | null;       // When the credential was issued
  expirationDate: Date | null;  // When the credential expires per the issuer
  scope: string | null;         // What the credential covers
  
  // Verification metadata
  verifiedAt: Date;             // When verification was performed
  verificationMethod: 'api_realtime' | 'api_batch' | 'file_import' | 'manual_entry';
  rawReferenceId: string | null; // Issuer's transaction/reference ID
  rawResponseData: object | null; // Full response payload (stored encrypted)
  
  // Expiration of this verification result
  resultExpiresAt: Date | null; // When this verification result should be re-checked
}
```

### 5.2 Verification Status Values

| Status | Meaning | Fulfillment Effect |
|--------|---------|-------------------|
| `verified` | Credential confirmed valid by issuer | Fulfillment L3 satisfied |
| `not_verified` | Credential not found or does not match | Fulfillment L3 rejected; employee notified to correct |
| `expired` | Credential was valid but has expired per issuer | Fulfillment marked `expired`; renewal workflow triggered |
| `revoked` | Credential actively revoked by issuer | Fulfillment marked `rejected`; compliance alert generated |
| `inconclusive` | Issuer returned ambiguous result; manual review needed | Escalate to Compliance Officer for manual determination |

### 5.3 Subject Match Confidence

| Confidence | Meaning | Action |
|:----------:|---------|--------|
| ≥ 0.95 | Strong match — name + credential ID match exactly | Auto-accept |
| 0.75–0.94 | Probable match — partial name match or minor discrepancy | Flag for CO review |
| 0.50–0.74 | Weak match — multiple candidates or fuzzy match | Require CO manual verification |
| < 0.50 | No match | Reject; notify employee |

---

## 6. Data Model — Prisma Schema Additions

### 6.1 New Models

```prisma
// ─── Issuer Verification Framework ─────────────────────

enum IssuerCategory {
  GOVERNMENT_REGISTRY
  BACKGROUND_PROVIDER
  LMS
  PROFESSIONAL_BODY
  MEDICAL_PROVIDER
  CUSTOM
}

enum TrustTier {
  AUTHORITATIVE       // T1 — official registry
  DELEGATED           // T2 — accredited intermediary
  EMPLOYER_SUPPLIED   // T3 — employer/employee evidence
  MANUAL              // T4 — offline verification
}

enum VerificationMethod {
  API_REALTIME
  API_BATCH
  FILE_IMPORT
  MANUAL_ENTRY
}

enum VerificationStatus {
  VERIFIED
  NOT_VERIFIED
  EXPIRED
  REVOKED
  INCONCLUSIVE
}

enum VerificationRequestStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  ERROR
  TIMED_OUT
  MANUALLY_ESCALATED
  CANCELLED
}

model IssuerRegistry {
  id                  String             @id @default(uuid())
  name                String
  code                String             @unique
  category            IssuerCategory
  trustTier           TrustTier
  verificationMethod  VerificationMethod
  apiConfigRef        String?            // Key Vault URI — NOT raw credentials
  supportedProofTypes ProofType[]
  supportedSubTypes   String[]
  responseMapping     Json?
  isActive            Boolean            @default(true)
  activatedAt         DateTime?
  deactivatedAt       DateTime?
  deactivationReason  String?
  contactInfo         Json?
  notes               String?
  createdBy           String
  createdByEmployee   Employee           @relation("IssuerCreator", fields: [createdBy], references: [id])
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  verificationRequests VerificationRequest[]

  @@index([category])
  @@index([trustTier])
  @@index([isActive])
  @@map("issuer_registry")
}

model VerificationRequest {
  id                String                    @id @default(uuid())
  fulfillmentId     String
  fulfillment       ProofFulfillment          @relation(fields: [fulfillmentId], references: [id])
  issuerId          String
  issuer            IssuerRegistry            @relation(fields: [issuerId], references: [id])
  
  // Request data
  status            VerificationRequestStatus @default(PENDING)
  subjectName       String
  subjectDob        DateTime?                 @db.Date
  credentialId      String?
  requestPayload    Json?                     // Data sent to issuer (encrypted at rest)
  
  // Response data
  verificationStatus VerificationStatus?
  statusDetail       String?
  subjectMatchConfidence Float?
  subjectMatchMethod String?
  responseCredentialId   String?
  responseIssueDate      DateTime?
  responseExpirationDate DateTime?
  responseScope          String?
  rawReferenceId         String?
  rawResponseData        Json?                // Full issuer response (encrypted at rest)
  
  // Verification result expiration
  resultExpiresAt   DateTime?
  
  // Retry tracking
  attemptCount      Int                       @default(0)
  maxAttempts       Int                       @default(3)
  lastAttemptAt     DateTime?
  nextRetryAt       DateTime?
  lastErrorMessage  String?
  
  // Manual escalation
  escalatedAt       DateTime?
  escalatedTo       String?                   // userId of CO handling escalation
  escalationNotes   String?
  resolvedBy        String?                   // userId who resolved manually
  resolvedAt        DateTime?
  
  // Lifecycle
  requestedBy       String                    // userId who triggered the verification
  requestedByEmployee Employee                @relation("VerificationRequester", fields: [requestedBy], references: [id])
  completedAt       DateTime?
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt

  @@index([fulfillmentId])
  @@index([issuerId])
  @@index([status])
  @@index([resultExpiresAt])
  @@map("verification_requests")
}
```

### 6.2 Modifications to Existing Models

```prisma
model Employee {
  // ... existing fields ...
  createdIssuers           IssuerRegistry[]        @relation("IssuerCreator")
  verificationRequests     VerificationRequest[]   @relation("VerificationRequester")
}

model ProofFulfillment {
  // ... existing fields ...
  verificationRequests     VerificationRequest[]
}
```

### 6.3 Index Strategy

| Index | Purpose |
|-------|---------|
| `issuer_registry.code` (unique) | Fast lookup by machine code |
| `issuer_registry.category` | Filter by issuer type |
| `issuer_registry.trustTier` | Filter by trust level |
| `verification_requests.fulfillmentId` | Find verifications for a fulfillment |
| `verification_requests.status` | Find pending/errored verifications |
| `verification_requests.resultExpiresAt` | Scheduled re-verification cron |

---

## 7. API Endpoints

### 7.1 Issuer Registry Management

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `GET` | `/api/issuers` | List all registered issuers (paginated, filterable) | COMPLIANCE_OFFICER |
| `GET` | `/api/issuers/:id` | Get issuer details | COMPLIANCE_OFFICER |
| `POST` | `/api/issuers` | Register a new issuer | ADMIN |
| `PATCH` | `/api/issuers/:id` | Update issuer details (name, config, contact) | COMPLIANCE_OFFICER |
| `PATCH` | `/api/issuers/:id/trust-tier` | Change trust tier (T1 requires ADMIN) | COMPLIANCE_OFFICER* |
| `POST` | `/api/issuers/:id/activate` | Activate an issuer | COMPLIANCE_OFFICER |
| `POST` | `/api/issuers/:id/deactivate` | Deactivate an issuer (with reason) | COMPLIANCE_OFFICER |
| `GET` | `/api/issuers/:id/verification-stats` | Verification success/failure rates | COMPLIANCE_OFFICER |

*Note: Elevating to T1 (authoritative) requires ADMIN role per §3.3.

### 7.2 Verification Requests

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `POST` | `/api/verifications` | Create a verification request | SUPERVISOR |
| `GET` | `/api/verifications` | List verification requests (paginated, filterable) | COMPLIANCE_OFFICER |
| `GET` | `/api/verifications/:id` | Get verification request details | SUPERVISOR |
| `POST` | `/api/verifications/:id/retry` | Retry a failed verification | COMPLIANCE_OFFICER |
| `POST` | `/api/verifications/:id/escalate` | Escalate to manual review | SUPERVISOR |
| `POST` | `/api/verifications/:id/resolve` | Manually resolve an escalated verification | COMPLIANCE_OFFICER |
| `POST` | `/api/verifications/:id/cancel` | Cancel a pending verification | COMPLIANCE_OFFICER |
| `GET` | `/api/fulfillments/:id/verifications` | List verifications for a specific fulfillment | SUPERVISOR |

### 7.3 Verification Request Body

```json
{
  "fulfillmentId": "uuid",
  "issuerId": "uuid",
  "subjectName": "Jane Smith",
  "subjectDob": "1985-03-15",
  "credentialId": "RN-12345-CA",
  "additionalData": {}
}
```

### 7.4 Manual Resolution Body

```json
{
  "verificationStatus": "verified",
  "statusDetail": "Confirmed via phone call to CA BRN on 2026-03-20",
  "subjectMatchConfidence": 1.0,
  "subjectMatchMethod": "manual",
  "responseCredentialId": "RN-12345-CA",
  "responseExpirationDate": "2028-03-15",
  "escalationNotes": "Phone verification completed. Spoke with registry clerk, ref #45678."
}
```

---

## 8. RBAC Requirements

| Action | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|--------|:--------:|:----------:|:-------:|:------------------:|:-----:|
| View own verification results | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team verification status | ❌ | ✅ | ✅ | ✅ | ✅ |
| Trigger verification request | ❌ | ✅ | ✅ | ✅ | ✅ |
| View all verifications | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage issuer registry | ❌ | ❌ | ❌ | ✅ | ✅ |
| Set trust tier to T1 | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resolve manual escalation | ❌ | ❌ | ❌ | ✅ | ✅ |
| Register new issuer | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deactivate issuer | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 9. Error Handling & Resilience

### 9.1 Retry Strategy

| Error Type | Retry? | Max Attempts | Backoff | Escalation |
|-----------|:------:|:------------:|---------|------------|
| Network timeout | Yes | 3 | Exponential (1m, 5m, 30m) | After max → `timed_out` → CO alert |
| HTTP 429 (rate limit) | Yes | 3 | Respect `Retry-After` header | After max → `error` → CO alert |
| HTTP 5xx (server error) | Yes | 3 | Exponential (5m, 30m, 2h) | After max → `error` → CO alert |
| HTTP 4xx (client error) | No | 1 | — | Immediate `error` → review request payload |
| Authentication failure | No | 1 | — | `error` → alert ADMIN (credential issue) |
| Invalid response format | No | 1 | — | `error` → review `responseMapping` config |

### 9.2 Issuer Outage Handling

| Scenario | System Response |
|----------|----------------|
| Issuer consistently failing (>5 failures in 1 hour) | Auto-deactivate issuer; alert ADMIN; log reason |
| All verifications for an issuer timing out | Mark issuer as degraded; queue for batch retry |
| Issuer permanently discontinued | ADMIN deactivates issuer; existing verified results remain valid until their `resultExpiresAt` |

### 9.3 Subject Mismatch Rules

| Mismatch Type | Action |
|---------------|--------|
| Name differs slightly (typo, maiden name) | Return `inconclusive`; CO reviews |
| Credential ID not found | Return `not_verified`; employee prompted to re-enter |
| Multiple candidates returned | Return `inconclusive` with candidate count; CO reviews |
| Credential found but different person | Return `not_verified`; flag potential fraud for review |

---

## 10. Audit Trail

Every verification event produces an audit log entry:

| Event | `action` | `entityType` | Details |
|-------|----------|-------------|---------|
| Verification requested | `verification_request_create` | `VerificationRequest` | Fulfillment ID, issuer ID, requester |
| Verification dispatched | `verification_dispatch` | `VerificationRequest` | Method, attempt number |
| Verification completed | `verification_complete` | `VerificationRequest` | Status, confidence, result |
| Verification failed | `verification_error` | `VerificationRequest` | Error type, retry scheduled? |
| Manual escalation | `verification_escalate` | `VerificationRequest` | Escalated to whom, reason |
| Manual resolution | `verification_resolve` | `VerificationRequest` | Resolved by, status, notes |
| Issuer registered | `issuer_create` | `IssuerRegistry` | Category, tier, created by |
| Issuer trust tier changed | `issuer_trust_change` | `IssuerRegistry` | Old tier, new tier, reason |
| Issuer deactivated | `issuer_deactivate` | `IssuerRegistry` | Reason, deactivated by |

**Compliance requirement:** Audit entries for verification events MUST include enough detail to reconstruct the verification decision chain during an external audit.

---

## 11. State Machine

### 11.1 Verification Request States

```
┌─────────┐
│ PENDING  │─────────────────────────────────────────────┐
└─────────┘                                               │
     │                                                    │
     │ Dispatch to issuer                                 │
     ▼                                                    │
┌─────────────┐                                           │
│ IN_PROGRESS │                                           │
└─────────────┘                                           │
     │                                                    │
     ├──── Success ────▶ ┌───────────┐                    │
     │                   │ COMPLETED │                    │
     │                   └───────────┘                    │
     │                                                    │
     ├──── Error (retries remaining) ─▶ PENDING (retry)   │
     │                                                    │
     ├──── Error (max retries) ─▶ ┌───────┐              │
     │                            │ ERROR │              │
     │                            └───────┘              │
     │                                                    │
     ├──── Timeout ────▶ ┌───────────┐                    │
     │                   │ TIMED_OUT │                    │
     │                   └───────────┘                    │
     │                                                    │
     └──── Escalate ───▶ ┌──────────────────────┐         │
                         │ MANUALLY_ESCALATED   │         │
                         └──────────────────────┘         │
                              │                           │
                              │ CO resolves               │
                              ▼                           │
                         ┌───────────┐                    │
                         │ COMPLETED │                    │
                         └───────────┘                    │
                                                          │
     CANCELLED ◀──────────────────────────────────────────┘
     (from any non-COMPLETED state)
```

### 11.2 Valid State Transitions

| From | To | Trigger |
|------|----|---------|
| `PENDING` | `IN_PROGRESS` | Verification dispatched |
| `PENDING` | `CANCELLED` | User/CO cancels |
| `IN_PROGRESS` | `COMPLETED` | Issuer response received |
| `IN_PROGRESS` | `PENDING` | Retry after transient error |
| `IN_PROGRESS` | `ERROR` | Max retries exhausted |
| `IN_PROGRESS` | `TIMED_OUT` | Verification timed out |
| `IN_PROGRESS` | `MANUALLY_ESCALATED` | CO escalates |
| `ERROR` | `PENDING` | CO retries |
| `ERROR` | `CANCELLED` | CO cancels |
| `TIMED_OUT` | `PENDING` | CO retries |
| `TIMED_OUT` | `MANUALLY_ESCALATED` | CO escalates for manual check |
| `MANUALLY_ESCALATED` | `COMPLETED` | CO resolves with result |
| `MANUALLY_ESCALATED` | `CANCELLED` | CO cancels |

---

## 12. Integration Patterns

### 12.1 Adapter Interface

Each issuer integration implements a common adapter interface:

```typescript
interface IssuerAdapter {
  readonly issuerCode: string;

  supports(proofType: ProofType, subType?: string): boolean;

  verify(request: VerificationInput): Promise<VerificationOutput>;

  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}

interface VerificationInput {
  subjectName: string;
  subjectDob?: Date;
  credentialId?: string;
  additionalData?: Record<string, unknown>;
}

interface VerificationOutput {
  status: VerificationStatus;
  statusDetail: string;
  subjectMatchConfidence: number;
  subjectMatchMethod: 'exact' | 'fuzzy' | 'partial';
  credentialId?: string;
  issueDate?: Date;
  expirationDate?: Date;
  scope?: string;
  rawReferenceId?: string;
  rawResponseData?: object;
  resultValidForDays?: number;
}
```

### 12.2 Manual Verification Adapter

For T4 (manual) issuers, a special adapter creates a workflow:

1. Creates a task in the CO's queue with subject details and what to verify
2. CO performs verification through external channels (phone, email, portal)
3. CO enters results via the `/api/verifications/:id/resolve` endpoint
4. Adapter records the manual result as a standard `VerificationOutput`

### 12.3 Scheduled Re-Verification

A cron job runs daily to check for expiring verification results:

```sql
SELECT vr.* FROM verification_requests vr
WHERE vr.status = 'COMPLETED'
  AND vr.verification_status = 'VERIFIED'
  AND vr.result_expires_at <= NOW() + INTERVAL '30 days'
  AND vr.result_expires_at > NOW()
ORDER BY vr.result_expires_at ASC
```

Results approaching expiration trigger:
1. Notification to employee ("Your [credential] verification expires in X days")
2. Auto-creation of a new `VerificationRequest` (status: `PENDING`) 14 days before expiration
3. If re-verification fails, notification to CO for manual follow-up

---

## 13. Compliance Guardrails

| Guardrail | Rule | Enforcement |
|-----------|------|-------------|
| **Credential minimum for clearance** | `clearance` proof type requires T2+ trust tier issuer | Validator rejects T3/T4 issuers for clearance verifications |
| **Separation of duties** | The employee being verified cannot resolve their own manual escalation | Service layer checks `resolvedBy !== fulfillment.employeeId` |
| **No backdating** | Verification timestamps come from the system clock, not user input | `verifiedAt = DateTime.now()` set server-side |
| **Immutable results** | Completed verification results cannot be edited — only superseded by a new verification | No `PATCH` endpoint for completed verifications |
| **Privacy minimization** | Only transmit fields required by the issuer's API | Adapter validates outbound payload against issuer's configured required fields |
| **Audit completeness** | Every state transition produces an audit entry | Service layer calls `AuditLog.create()` on every status change |
| **Credential isolation** | API credentials never in database; Key Vault references only | Schema stores `apiConfigRef` (URI), not secrets |

---

## 14. Implementation Phases

### Phase 1 — Foundation (Sprint 5-6)

- [ ] Prisma schema: `IssuerRegistry`, `VerificationRequest` models and enums
- [ ] Migration
- [ ] `IssuerRegistry` CRUD endpoints with RBAC
- [ ] `VerificationRequest` create/list/get endpoints
- [ ] Manual verification adapter (CO enters results)
- [ ] Audit trail for all verification events
- [ ] Unit and integration tests

### Phase 2 — Mock Integration (Sprint 6-7)

- [ ] Adapter interface and registry
- [ ] Mock adapter for development/testing (configurable response patterns)
- [ ] Retry logic with exponential backoff
- [ ] Scheduled re-verification cron job
- [ ] Issuer health check endpoint
- [ ] Trust tier impact on readiness score

### Phase 3 — Real Integrations (Sprint 8+)

- [ ] First real adapter (recommend: NCSBN Nursys or FINRA BrokerCheck — well-documented APIs)
- [ ] Azure Key Vault integration for credential storage
- [ ] Background check provider adapter (Checkr or equivalent)
- [ ] Webhook receiver for push-based verifications
- [ ] Integration monitoring and alerting

### Phase 4 — Advanced (Backlog)

- [ ] Batch verification (verify multiple employees against same issuer)
- [ ] Issuer performance dashboard (success rates, latency, cost)
- [ ] Auto-discovery of applicable issuers based on proof type + geography
- [ ] Multi-issuer fallback (if primary issuer fails, try secondary)
