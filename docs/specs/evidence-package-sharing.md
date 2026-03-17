# Evidence Package Sharing Model — E-CLAT Platform

> **Status:** Design Spike  
> **Owner:** Pearlman (Compliance Specialist)  
> **Created:** 2026-03-20  
> **Issue:** [#33 — Implement evidence-package sharing model](https://github.com/ivegamsft/work-tracker/issues/33)  
> **Applies To:** `apps/api` (new `evidence-packages` module), `data/prisma/schema.prisma`, `packages/shared`  
> **Companion Docs:** [Sharing Spec](./sharing-spec.md) · [Proof Vault Spec](./proof-vault-spec.md) · [Templates & Attestation Spec](./templates-attestation-spec.md) · [Issuer Verification Framework](./issuer-verification-framework.md)  
> **Dependencies:** Proof Vault implementation (Phase 2+)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Evidence Package Concept](#2-evidence-package-concept)
3. [Package Contents](#3-package-contents)
4. [Package Lifecycle](#4-package-lifecycle)
5. [Access Control Model](#5-access-control-model)
6. [Data Model — Prisma Schema Additions](#6-data-model--prisma-schema-additions)
7. [API Endpoints](#7-api-endpoints)
8. [Sharing Mechanisms](#8-sharing-mechanisms)
9. [Versioning & Immutability](#9-versioning--immutability)
10. [Audit Trail](#10-audit-trail)
11. [State Machine](#11-state-machine)
12. [Compliance Guardrails](#12-compliance-guardrails)
13. [Integration Points](#13-integration-points)
14. [Implementation Phases](#14-implementation-phases)

---

## 1. Problem Statement

The current Sharing Spec (§2.4) defines share links for external access — URLs that grant access to vault documents without requiring an E-CLAT account. However, the Proof Vault Spec (§4.5) correctly identifies a fundamental contradiction:

> "Share links for documents must not directly expose raw zero-knowledge vault documents. The system generates an explicit **evidence package** from approved vault content."

Today, there is no mechanism to:

- **Bundle** multiple proof fulfillments, documents, and verification results into a single auditable package
- **Control** what gets included (and what gets redacted) when sharing with an external party
- **Track** who created a package, who accessed it, and when it expires
- **Version** packages so that updates don't silently change what an auditor previously reviewed

This gap is critical for regulated industries. When an FAA inspector asks "show me your pilot compliance records," the response must be a controlled, versioned, auditable package — not a bag of individual share links.

### What This Spec Covers

| In Scope | Out of Scope |
|----------|-------------|
| Evidence package data model | Proof Vault encryption implementation |
| Package creation and assembly workflow | Individual document sharing (covered in sharing-spec.md) |
| Versioning and immutability rules | UI design for package builder |
| External access model (time-limited, audited) | Real-time collaborative editing of packages |
| Approval gates for sensitive content | Payment/billing for external access |
| RBAC for package management | Specific regulatory format requirements (e.g., OSHA 300 format) |

---

## 2. Evidence Package Concept

### 2.1 What Is an Evidence Package?

An **evidence package** is a curated, versioned, auditable collection of compliance evidence assembled for a specific purpose and audience. It decouples what an external party sees from the live data in E-CLAT.

| Aspect | Evidence Package | Raw Vault Sharing |
|--------|-----------------|-------------------|
| **Content** | Curated subset of fulfillments, documents, audit entries | Raw vault document |
| **Mutability** | Frozen at creation; updates create new version | Live data, changes over time |
| **Redaction** | Supports field-level redaction | All or nothing |
| **Audience** | Named purpose + recipient type | Specific user |
| **Audit** | Package-level creation, access, and download logs | Per-document access logs |
| **Expiration** | Mandatory expiration date | Optional |
| **Format** | Structured manifest + documents | Single file |

### 2.2 Use Cases

| Scenario | Creator | Audience | Package Contents |
|----------|---------|----------|-----------------|
| **Regulatory audit** | Compliance Officer | FAA inspector, OSHA auditor | All fulfillments for a standard, verification results, audit trail |
| **New client onboarding** | Manager | Client's safety officer | Employee certifications, training records, clearance status |
| **Insurance renewal** | Compliance Officer | Insurance underwriter | Aggregate compliance scores, training completion rates, incident-free hours |
| **Inter-company transfer** | HR/Manager | Receiving employer | Selected qualifications, relevant hours, unexpired clearances |
| **Legal discovery** | Compliance Officer | Legal counsel | Specific date-range fulfillments, audit trail, chain-of-custody evidence |

### 2.3 Package Anatomy

```
Evidence Package
├── manifest.json           // Package metadata, table of contents, checksums
├── fulfillments/           // Proof fulfillment snapshots
│   ├── f1-cpr-cert.json    // Fulfillment data + status + verification result
│   ├── f2-osha-training.json
│   └── f3-drug-clearance.json
├── documents/              // Supporting evidence files
│   ├── cpr-certificate.pdf
│   ├── osha-completion.pdf
│   └── clearance-letter.pdf  (or redacted version)
├── verifications/          // Issuer verification results
│   ├── v1-nursys-check.json
│   └── v2-checkr-background.json
├── audit-trail/            // Relevant audit log entries
│   └── audit-entries.json
└── signatures/             // Digital signatures (future)
    └── package-signature.json
```

---

## 3. Package Contents

### 3.1 Fulfillment Snapshots

Each included fulfillment is serialized as a point-in-time snapshot:

```typescript
interface FulfillmentSnapshot {
  fulfillmentId: string;
  requirementName: string;
  requirementDescription: string;
  proofType: ProofType;
  proofSubType?: string;
  attestationLevels: AttestationLevel[];
  
  // Status at snapshot time
  status: FulfillmentStatus;
  
  // Level-specific data (redactable)
  selfAttestedAt?: Date;
  selfAttestation?: string;
  uploadedAt?: Date;
  documentReference?: string;  // Reference to document in package
  thirdPartyVerifiedAt?: Date;
  thirdPartySource?: string;
  thirdPartyRefId?: string;    // May be redacted
  validatedAt?: Date;
  validatedBy?: string;        // May show role instead of name
  validatorNotes?: string;     // May be redacted
  
  // Expiration
  expiresAt?: Date;
  
  // Snapshot metadata
  snapshotAt: Date;            // When this snapshot was taken
}
```

### 3.2 Document Inclusions

Documents included in a package are copies (not references to live vault objects):

| Field | Description |
|-------|-------------|
| `originalDocumentId` | UUID of the source document |
| `fileName` | Display name |
| `mimeType` | File type |
| `fileSize` | Size in bytes |
| `checksum` | SHA-256 hash of the included file content |
| `isRedacted` | Whether the document has been redacted |
| `redactionNotes` | What was redacted and why |

**Critical rule:** Documents in an evidence package are decrypted from the vault at package creation time, then re-encrypted with a package-specific key. The package key is derived independently of any user's vault key. This severs the cryptographic link between the live vault and the exported package.

### 3.3 Verification Results

If the package includes fulfillments with L3 (third-party) attestation, the associated verification results are included:

| Field | Description |
|-------|-------------|
| `verificationRequestId` | UUID of the verification request |
| `issuerName` | Name of the verifying issuer |
| `trustTier` | Trust tier at time of verification |
| `verificationStatus` | Result (verified, expired, etc.) |
| `verifiedAt` | When verification was performed |
| `subjectMatchConfidence` | Match confidence score |
| `rawReferenceId` | Issuer's transaction reference |
| `resultExpiresAt` | When this result expires |

**Note:** Raw response data (`rawResponseData`) is NOT included in packages by default. It may contain PII or issuer-proprietary data. Include only by explicit opt-in from ADMIN.

### 3.4 Audit Trail Entries

The package includes relevant audit log entries scoped to the included fulfillments and documents:

```sql
SELECT * FROM audit_logs
WHERE (entity_type = 'ProofFulfillment' AND record_id IN (:fulfillmentIds))
   OR (entity_type = 'VerificationRequest' AND record_id IN (:verificationIds))
   OR (entity_type = 'Document' AND record_id IN (:documentIds))
ORDER BY timestamp ASC
```

Audit entries included in the package are snapshots — they do not update if new audit events occur after package creation.

### 3.5 Redaction Rules

| Data Category | Default | Redactable? | Redaction Method |
|---------------|---------|:-----------:|-----------------|
| Employee name | Included | Yes | Replace with "Employee [ID suffix]" |
| Employee DOB | Excluded | N/A | Never included unless ADMIN opts in |
| Credential IDs | Included | Yes | Partial mask: "RN-****-CA" |
| Validator name | Role only | Yes | Replace with role: "Compliance Officer" |
| Third-party ref ID | Included | Yes | Full redaction |
| Document content | Included | Yes | Redacted PDF (black bars over sensitive fields) |
| Audit trail actor names | Role only | Yes | Replace with role |
| Raw verification data | Excluded | N/A | Never included by default |

---

## 4. Package Lifecycle

### 4.1 State Machine

```
┌─────────┐
│  DRAFT  │────────────────────────────────────────────────┐
└─────────┘                                                 │
     │                                                      │
     │ Creator finalizes                                    │
     ▼                                                      │
┌──────────────────┐     Approver approves     ┌──────────┐│
│ PENDING_APPROVAL │──────────────────────────▶│ APPROVED ││
└──────────────────┘                           └──────────┘│
     │                                              │       │
     │ Approver rejects                             │       │
     ▼                                              │       │
┌──────────┐                                        │       │
│ REJECTED │                                        │       │
└──────────┘                                        │       │
     │                                              │       │
     │ Creator revises → new version                │       │
     └──▶ DRAFT (v2)                                │       │
                                                    │       │
                          ┌─────────────────────────┘       │
                          │                                 │
                          │ Share externally                 │
                          ▼                                 │
                    ┌──────────┐                            │
                    │  SHARED  │                            │
                    └──────────┘                            │
                          │                                 │
                          │ Expiration date reached          │
                          │ or manually revoked             │
                          ▼                                 │
                    ┌──────────┐                            │
                    │ EXPIRED  │                            │
                    └──────────┘                            │
                                                            │
                    ┌──────────┐                            │
                    │ REVOKED  │◀───────────────────────────┘
                    └──────────┘  (from any state except EXPIRED)
```

### 4.2 Status Definitions

| Status | Description | Editable? | Shareable? |
|--------|-------------|:---------:|:----------:|
| `DRAFT` | Package is being assembled; content can be added/removed/redacted | ✅ | ❌ |
| `PENDING_APPROVAL` | Package submitted for review by approver | ❌ | ❌ |
| `REJECTED` | Approver rejected; creator can revise as new version | ❌ | ❌ |
| `APPROVED` | Package approved and sealed; content frozen | ❌ | ✅ |
| `SHARED` | Package has been shared externally (access link generated) | ❌ | ✅ (active) |
| `EXPIRED` | Access period has ended; package is archived for audit | ❌ | ❌ |
| `REVOKED` | Package manually revoked before expiration | ❌ | ❌ |

### 4.3 Approval Gates

| Package Sensitivity | Approval Required? | Approver |
|--------------------|:-----------------:|----------|
| Contains only `self_attest` or `upload` fulfillments | Optional | MANAGER+ |
| Contains `third_party` verified fulfillments | Required | COMPLIANCE_OFFICER+ |
| Contains `clearance` proof type | Required | COMPLIANCE_OFFICER+ |
| Contains medical records (`clearance.medical_clearance`) | Required | ADMIN |
| Contains PII beyond employee name | Required | ADMIN |
| Audience is "legal" or "regulatory" | Required | COMPLIANCE_OFFICER+ |

### 4.4 Expiration Rules

| Rule | Value |
|------|-------|
| Default expiration | 30 days from approval |
| Maximum expiration | 90 days (ADMIN can override) |
| Minimum expiration | 1 day |
| Extension | COMPLIANCE_OFFICER can extend by up to 30 days, once |
| Post-expiration retention | Package metadata retained for 7 years; content purged after configurable retention period |

---

## 5. Access Control Model

### 5.1 Package Roles

| Role | Who | Can Do |
|------|-----|--------|
| **Creator** | The user who initiated the package | Assemble draft, add/remove content, apply redactions, submit for approval |
| **Approver** | Assigned reviewer (CO or ADMIN per sensitivity) | Review contents, approve or reject, add approval notes |
| **Viewer** (internal) | E-CLAT users granted view access | View package manifest and contents; cannot modify or share externally |
| **External Recipient** | Non-E-CLAT user accessing via share link | View/download within access window; all access logged |

### 5.2 Who Can Create Packages?

| Role | Can Create? | Scope |
|------|:----------:|-------|
| EMPLOYEE | ❌ | Cannot create packages (prevents unauthorized disclosure) |
| SUPERVISOR | ✅ | Own team's fulfillments only |
| MANAGER | ✅ | Own department's fulfillments |
| COMPLIANCE_OFFICER | ✅ | Any employee's fulfillments |
| ADMIN | ✅ | Any employee's fulfillments + system-wide |

### 5.3 Who Can Approve Packages?

| Approver Role | Can Approve |
|---------------|------------|
| MANAGER | Packages not containing clearance/medical data |
| COMPLIANCE_OFFICER | All packages except those containing PII beyond employee name |
| ADMIN | All packages |

**Separation of duties:** The creator of a package cannot also be its approver.

### 5.4 External Access Model

External access uses time-limited, audited share links:

| Property | Description |
|----------|-------------|
| `accessToken` | 256-bit cryptographically random token |
| `packageId` | UUID of the evidence package |
| `permission` | `view` or `download` |
| `expiresAt` | Must not exceed package expiration |
| `maxAccessCount` | Optional limit on total accesses |
| `passwordHash` | Optional bcrypt-hashed passphrase |
| `recipientName` | Name of intended recipient (for audit) |
| `recipientOrg` | Organization of intended recipient (for audit) |
| `purpose` | Why the package is being shared |
| `createdBy` | User who generated the link |

**Rules:**
- Only COMPLIANCE_OFFICER+ can generate external share links
- All external accesses logged with IP, user agent, timestamp
- Expired/exhausted links return generic "Not available" (no info leakage)
- ADMIN can revoke any share link at any time
- Revoking a share link does not revoke the package itself

---

## 6. Data Model — Prisma Schema Additions

### 6.1 New Models

```prisma
// ─── Evidence Packages ──────────────────────────────────

enum PackageStatus {
  DRAFT
  PENDING_APPROVAL
  REJECTED
  APPROVED
  SHARED
  EXPIRED
  REVOKED
}

enum PackageSensitivity {
  STANDARD            // No special restrictions
  SENSITIVE           // Contains third-party/clearance data
  HIGHLY_SENSITIVE    // Contains medical/PII data
}

model EvidencePackage {
  id                String            @id @default(uuid())
  name              String            // e.g., "Q1 2026 Pilot Compliance — Jane Smith"
  description       String            @default("")
  purpose           String            // e.g., "FAA Part 135 audit response"
  audienceType      String            // e.g., "regulatory", "client", "insurance", "legal", "internal"
  audienceDetail    String?           // e.g., "FAA FSDO Inspector John Doe"
  
  status            PackageStatus     @default(DRAFT)
  sensitivity       PackageSensitivity @default(STANDARD)
  version           Int               @default(1)
  previousVersionId String?           // FK to prior version for audit chain
  
  // Content checksum (computed when sealed/approved)
  manifestChecksum  String?           // SHA-256 of the manifest JSON
  
  // Encryption
  packageKeyRef     String?           // Key Vault URI for package encryption key
  
  // Creator
  createdBy         String
  createdByEmployee Employee          @relation("PackageCreator", fields: [createdBy], references: [id])
  
  // Approver
  approverId        String?
  approverEmployee  Employee?         @relation("PackageApprover", fields: [approverId], references: [id])
  approvedAt        DateTime?
  approvalNotes     String?
  rejectedAt        DateTime?
  rejectionReason   String?
  
  // Expiration
  expiresAt         DateTime?
  extendedAt        DateTime?
  extendedBy        String?
  originalExpiresAt DateTime?         // Before extension
  
  // Lifecycle timestamps
  sealedAt          DateTime?         // When content was frozen
  sharedAt          DateTime?         // When first external link created
  revokedAt         DateTime?
  revokedBy         String?
  revocationReason  String?
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  // Contents
  items             PackageItem[]
  accessLinks       PackageAccessLink[]
  accessLogs        PackageAccessLog[]

  @@index([status])
  @@index([createdBy])
  @@index([expiresAt])
  @@index([previousVersionId])
  @@map("evidence_packages")
}

model PackageItem {
  id                String          @id @default(uuid())
  packageId         String
  package           EvidencePackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  
  // What's included
  itemType          String          // "fulfillment", "document", "verification", "audit_entry"
  sourceId          String          // UUID of the source record
  
  // Snapshot data (frozen at seal time)
  snapshotData      Json            // Serialized snapshot per §3
  snapshotAt        DateTime?
  
  // Document-specific
  storageKey        String?         // Encrypted blob storage key (for document items)
  fileChecksum      String?         // SHA-256 of the included file
  fileName          String?
  mimeType          String?
  fileSize          Int?
  
  // Redaction
  isRedacted        Boolean         @default(false)
  redactionConfig   Json?           // Fields redacted and replacement values
  redactionNotes    String?
  
  sortOrder         Int             @default(0)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([packageId])
  @@index([itemType])
  @@index([sourceId])
  @@map("package_items")
}

model PackageAccessLink {
  id                String          @id @default(uuid())
  packageId         String
  package           EvidencePackage @relation(fields: [packageId], references: [id])
  
  accessToken       String          @unique  // 256-bit random token
  permission        String          // "view" or "download"
  
  // Recipient info (for audit)
  recipientName     String
  recipientOrg      String?
  purpose           String?
  
  // Limits
  expiresAt         DateTime
  maxAccessCount    Int?
  currentAccessCount Int            @default(0)
  passwordHash      String?         // bcrypt hash of optional passphrase
  
  // Lifecycle
  isActive          Boolean         @default(true)
  revokedAt         DateTime?
  revokedBy         String?
  
  createdBy         String
  createdByEmployee Employee        @relation("AccessLinkCreator", fields: [createdBy], references: [id])
  createdAt         DateTime        @default(now())

  @@index([packageId])
  @@index([accessToken])
  @@index([expiresAt])
  @@map("package_access_links")
}

model PackageAccessLog {
  id                String          @id @default(uuid())
  packageId         String
  package           EvidencePackage @relation(fields: [packageId], references: [id])
  
  // Who accessed
  accessLinkId      String?         // If external access via link
  userId            String?         // If internal E-CLAT user
  
  // Access details
  action            String          // "view_manifest", "view_item", "download_item", "download_package"
  itemId            String?         // Specific item accessed (null if whole package)
  
  // Client info
  ipAddress         String?
  userAgent         String?
  
  accessedAt        DateTime        @default(now())

  @@index([packageId])
  @@index([accessLinkId])
  @@index([accessedAt])
  @@map("package_access_logs")
}
```

### 6.2 Modifications to Existing Models

```prisma
model Employee {
  // ... existing fields ...
  createdPackages        EvidencePackage[]    @relation("PackageCreator")
  approvedPackages       EvidencePackage[]    @relation("PackageApprover")
  createdAccessLinks     PackageAccessLink[]  @relation("AccessLinkCreator")
}
```

### 6.3 Index Strategy

| Index | Purpose |
|-------|---------|
| `evidence_packages.status` | Filter by lifecycle state |
| `evidence_packages.createdBy` | Find packages by creator |
| `evidence_packages.expiresAt` | Expiration cron job |
| `package_items.packageId` | List items in a package |
| `package_items.sourceId` | Find which packages include a given fulfillment/document |
| `package_access_links.accessToken` (unique) | Fast token lookup for external access |
| `package_access_links.expiresAt` | Link expiration cleanup |
| `package_access_logs.packageId` | Access audit per package |
| `package_access_logs.accessedAt` | Time-based access queries |

---

## 7. API Endpoints

### 7.1 Package Management

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `POST` | `/api/evidence-packages` | Create a new draft package | SUPERVISOR |
| `GET` | `/api/evidence-packages` | List packages (paginated, filterable) | SUPERVISOR |
| `GET` | `/api/evidence-packages/:id` | Get package details + items | SUPERVISOR |
| `PATCH` | `/api/evidence-packages/:id` | Update draft package metadata | SUPERVISOR* |
| `DELETE` | `/api/evidence-packages/:id` | Delete a draft package | SUPERVISOR* |

*Only the package creator or ADMIN can update/delete.

### 7.2 Package Items

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `POST` | `/api/evidence-packages/:id/items` | Add item to draft package | SUPERVISOR* |
| `DELETE` | `/api/evidence-packages/:id/items/:itemId` | Remove item from draft | SUPERVISOR* |
| `PATCH` | `/api/evidence-packages/:id/items/:itemId/redaction` | Apply/update redaction to item | SUPERVISOR* |
| `GET` | `/api/evidence-packages/:id/items` | List all items in package | SUPERVISOR |

### 7.3 Package Lifecycle

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `POST` | `/api/evidence-packages/:id/submit` | Submit for approval (seals content) | SUPERVISOR* |
| `POST` | `/api/evidence-packages/:id/approve` | Approve package | COMPLIANCE_OFFICER** |
| `POST` | `/api/evidence-packages/:id/reject` | Reject with reason | COMPLIANCE_OFFICER** |
| `POST` | `/api/evidence-packages/:id/revoke` | Revoke package access | COMPLIANCE_OFFICER |
| `POST` | `/api/evidence-packages/:id/extend` | Extend expiration (once, max 30 days) | COMPLIANCE_OFFICER |
| `POST` | `/api/evidence-packages/:id/new-version` | Create new version from rejected/expired package | SUPERVISOR* |

*Creator only. **Approver must differ from creator.

### 7.4 External Sharing

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| `POST` | `/api/evidence-packages/:id/share` | Generate external access link | COMPLIANCE_OFFICER |
| `GET` | `/api/evidence-packages/:id/access-links` | List access links for package | COMPLIANCE_OFFICER |
| `DELETE` | `/api/evidence-packages/:id/access-links/:linkId` | Revoke specific access link | COMPLIANCE_OFFICER |
| `GET` | `/api/evidence-packages/:id/access-logs` | View access logs for package | COMPLIANCE_OFFICER |

### 7.5 External Access (Unauthenticated)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/packages/access/:token` | View package manifest via share link | Token only |
| `GET` | `/api/packages/access/:token/items/:itemId` | View/download specific item | Token only |
| `POST` | `/api/packages/access/:token/verify` | Verify password for password-protected links | Token only |

### 7.6 Package Creation Request Body

```json
{
  "name": "Q1 2026 Pilot Compliance — Jane Smith",
  "description": "FAA Part 135 compliance evidence for annual audit",
  "purpose": "FAA Part 135 annual audit response",
  "audienceType": "regulatory",
  "audienceDetail": "FAA FSDO Inspector John Doe",
  "expiresAt": "2026-04-20T00:00:00Z"
}
```

### 7.7 Add Item Request Body

```json
{
  "itemType": "fulfillment",
  "sourceId": "uuid-of-fulfillment",
  "redactionConfig": {
    "thirdPartyRefId": "REDACTED",
    "validatorNotes": "REDACTED"
  },
  "redactionNotes": "Third-party reference ID and validator notes redacted per company policy"
}
```

### 7.8 Share Link Creation Request Body

```json
{
  "permission": "view",
  "recipientName": "Inspector John Doe",
  "recipientOrg": "FAA",
  "purpose": "Part 135 audit evidence review",
  "expiresAt": "2026-04-15T00:00:00Z",
  "maxAccessCount": 10,
  "password": "optional-passphrase"
}
```

---

## 8. Sharing Mechanisms

### 8.1 Internal Sharing

For sharing packages with other E-CLAT users:

1. Creator adds users as "viewers" to the package
2. Viewers see the package in their "Shared With Me" section
3. All internal views are logged with user identity
4. Viewers cannot modify the package or create external links

### 8.2 External Sharing (Evidence Package Links)

External sharing replaces raw vault share links for compliance disclosures:

```
┌─────────────────────────────────┐
│         CO creates link         │
│ ┌─────────────────────────────┐ │
│ │ https://eclat.example.com/  │ │
│ │ packages/access/abc123...   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
         │
         │ Sends link to external party
         │ (email, secure message, etc.)
         ▼
┌─────────────────────────────────┐
│    External party clicks link   │
│                                 │
│  ┌────────────────────────────┐ │
│  │ Password? (if required)   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌────────────────────────────┐ │
│  │ Package manifest:         │ │
│  │ • 3 fulfillments          │ │
│  │ • 2 supporting documents  │ │
│  │ • 1 verification result   │ │
│  │                           │ │
│  │ [View Item] [Download]    │ │
│  └────────────────────────────┘ │
│                                 │
│  Footer: "Expires Apr 15, 2026" │
│  Footer: "E-CLAT Evidence Pkg"  │
└─────────────────────────────────┘
```

### 8.3 Relationship to Existing Share Links

The existing share link model in the Sharing Spec (§2.4) continues to work for individual internal document sharing. Evidence packages are the **required** mechanism for:

- External disclosure of compliance evidence
- Multi-document sharing with external parties
- Audit-grade evidence bundles
- Any share that must be version-controlled

**Migration path:** Existing share links that target vault documents should be migrated to evidence packages. New external share functionality should default to evidence packages.

---

## 9. Versioning & Immutability

### 9.1 Immutability Rules

| Package State | Rule |
|---------------|------|
| `DRAFT` | Fully mutable — items can be added, removed, redacted |
| `PENDING_APPROVAL` | Content frozen (sealed); metadata editable by approver (notes only) |
| `APPROVED` through `EXPIRED` | Fully immutable — no changes to content or metadata |
| `REVOKED` | Immutable + access terminated |

### 9.2 Sealing Process

When a package is submitted for approval:

1. All included fulfillments are snapshotted (current state frozen into `snapshotData`)
2. All included documents are copied to package-specific encrypted storage
3. The package manifest is generated with SHA-256 checksums for every item
4. The manifest itself is checksummed and stored as `manifestChecksum`
5. `sealedAt` timestamp is recorded

After sealing, any changes to the underlying live data (e.g., a fulfillment status change) do NOT affect the sealed package. The package represents the state at seal time.

### 9.3 Version Chain

When a rejected or expired package needs revision:

1. Creator clicks "New Version" → creates a new `EvidencePackage` with `previousVersionId` pointing to the old one
2. Items from the previous version are copied to the new draft (creator can modify)
3. Version number increments: `version = previousVersion.version + 1`
4. The old package remains as-is for audit trail

```
v1 (REJECTED) ──▶ v2 (APPROVED) ──▶ v3 (DRAFT)
                        │
                   previousVersionId = v1.id
```

---

## 10. Audit Trail

Every package event produces an audit log entry:

| Event | `action` | `entityType` | Details |
|-------|----------|-------------|---------|
| Package created | `package_create` | `EvidencePackage` | Name, purpose, audience, creator |
| Item added | `package_item_add` | `PackageItem` | Item type, source ID |
| Item removed | `package_item_remove` | `PackageItem` | Item type, source ID, reason |
| Redaction applied | `package_item_redact` | `PackageItem` | Redacted fields, notes |
| Submitted for approval | `package_submit` | `EvidencePackage` | Manifest checksum, seal timestamp |
| Approved | `package_approve` | `EvidencePackage` | Approver, notes |
| Rejected | `package_reject` | `EvidencePackage` | Rejector, reason |
| Share link created | `package_share_link_create` | `PackageAccessLink` | Recipient, permission, expiration |
| Share link revoked | `package_share_link_revoke` | `PackageAccessLink` | Revoked by, reason |
| External access | `package_external_access` | `PackageAccessLog` | IP, user agent, action, item |
| Internal view | `package_internal_view` | `PackageAccessLog` | User ID, action |
| Package expired | `package_expire` | `EvidencePackage` | Expired at |
| Package revoked | `package_revoke` | `EvidencePackage` | Revoked by, reason |
| Package extended | `package_extend` | `EvidencePackage` | New expiration, extended by |
| New version created | `package_new_version` | `EvidencePackage` | Previous version ID |

**Compliance requirement:** Package audit entries MUST be retained for the organization's regulatory retention period (default: 7 years). Package content may be purged per retention policy, but audit entries persist.

---

## 11. State Machine

### 11.1 Valid State Transitions

| From | To | Trigger | Actor |
|------|----|---------|-------|
| `DRAFT` | `PENDING_APPROVAL` | Creator submits | Creator |
| `DRAFT` | `REVOKED` | Creator cancels | Creator or ADMIN |
| `PENDING_APPROVAL` | `APPROVED` | Approver approves | Approver |
| `PENDING_APPROVAL` | `REJECTED` | Approver rejects | Approver |
| `PENDING_APPROVAL` | `REVOKED` | Emergency revocation | ADMIN |
| `APPROVED` | `SHARED` | External link created | COMPLIANCE_OFFICER+ |
| `APPROVED` | `REVOKED` | Compliance concern | COMPLIANCE_OFFICER+ |
| `APPROVED` | `EXPIRED` | Expiration date reached | System (cron) |
| `SHARED` | `EXPIRED` | Expiration date reached | System (cron) |
| `SHARED` | `REVOKED` | Compliance concern | COMPLIANCE_OFFICER+ |
| `REJECTED` | `DRAFT` | Creator creates new version | Creator |

### 11.2 Terminal States

`EXPIRED` and `REVOKED` are terminal — a package cannot transition out of these states. To share the same evidence again, create a new version.

---

## 12. Compliance Guardrails

| Guardrail | Rule | Enforcement |
|-----------|------|-------------|
| **Mandatory expiration** | All packages must have an expiration date | Validation rejects packages without `expiresAt` |
| **Separation of duties** | Creator ≠ Approver | Service layer rejects approval if `approverId === createdBy` |
| **No employee self-packaging** | Employees cannot create evidence packages | RBAC: minimum SUPERVISOR role |
| **Sensitive content gates** | Medical/clearance data requires ADMIN approval | Sensitivity auto-calculated from items; approval routing adjusted |
| **External access requires CO** | Only CO+ can generate external share links | RBAC on share link endpoints |
| **Sealed content immutability** | Sealed packages cannot be modified | Service layer rejects mutations when `sealedAt` is set |
| **Audit completeness** | Every state transition logged | Service layer calls `AuditLog.create()` for all events |
| **Checksum verification** | Package integrity verifiable | Manifest checksum computed at seal time; verifiable on download |
| **Retention compliance** | Package metadata retained per regulatory period | Expiration cron preserves metadata; content purge is separate |
| **Redaction audit** | All redactions documented | `redactionConfig` and `redactionNotes` required when `isRedacted = true` |
| **No PII leakage on expired links** | Expired links return generic message | Access endpoint returns 404-style "Not available" for expired/revoked |

---

## 13. Integration Points

### 13.1 With Proof Fulfillments

- Package items reference `ProofFulfillment` by ID
- At seal time, fulfillment data is snapshotted (not linked live)
- If a fulfillment expires after a package is sealed, the package is unaffected

### 13.2 With Issuer Verification Framework (#32)

- Verification results are includable as package items
- Trust tier and verification status are captured in the snapshot
- If a verification result expires, it can trigger a notification that a package may contain stale data (but the sealed package itself is unaffected)

### 13.3 With Proof Vault

- Document items in packages are re-encrypted from vault DEKs to package-specific keys
- The vault's zero-knowledge property is preserved: the server handles re-encryption only during package creation by the authenticated user (client-side DEK decryption → server-side package key re-encryption)
- Raw vault access is never granted to external parties

### 13.4 With Notification System

| Event | Notification |
|-------|-------------|
| Package submitted for approval | Notify approver |
| Package approved | Notify creator |
| Package rejected | Notify creator with reason |
| External access occurred | Notify creator (optional, configurable) |
| Package approaching expiration (7 days) | Notify creator and CO |
| Package expired | Notify creator |
| Package revoked | Notify creator and all internal viewers |

### 13.5 With Readiness Dashboard

- Packages can display aggregate readiness data (if included fulfillments support it)
- Dashboard can show "active evidence packages" count per employee/department

---

## 14. Implementation Phases

### Phase 1 — Core Model (Sprint 6-7)

- [ ] Prisma schema: `EvidencePackage`, `PackageItem`, `PackageAccessLink`, `PackageAccessLog`
- [ ] Migration
- [ ] Package CRUD endpoints with RBAC
- [ ] Item add/remove endpoints
- [ ] Basic redaction support (field-level JSON config)
- [ ] Draft → submit → approve/reject workflow
- [ ] Audit trail for all package events
- [ ] Unit and integration tests

### Phase 2 — Sealing & Integrity (Sprint 7-8)

- [ ] Fulfillment snapshot serialization
- [ ] Document copy to package-specific storage
- [ ] Manifest generation with SHA-256 checksums
- [ ] Immutability enforcement for sealed packages
- [ ] Version chain support
- [ ] Approval sensitivity routing

### Phase 3 — External Sharing (Sprint 8-9)

- [ ] Share link generation with token, expiration, optional password
- [ ] External access endpoints (unauthenticated, token-gated)
- [ ] Access logging (IP, user agent, action)
- [ ] Expiration cron job
- [ ] Notification integration for access events
- [ ] Package-specific encryption key management (Key Vault integration)

### Phase 4 — Advanced (Backlog)

- [ ] PDF redaction engine (visual redaction of document content)
- [ ] Bulk package creation (e.g., "create package for all pilots in department")
- [ ] Package templates (pre-configured item sets for common audit types)
- [ ] Digital signatures for package integrity (future compliance requirement)
- [ ] Export to regulatory-specific formats (OSHA 300, FAA Part 135 packet)
- [ ] Analytics: package creation frequency, access patterns, expiration compliance
