# Proof Template & Attestation Levels Architecture — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Created:** 2026-03-18  
> **Applies To:** `apps/api` (templates module), `apps/web` (template UI), `apps/admin` (template management), `packages/shared` (template types)  
> **Companion Docs:** [App Spec](./app-spec.md) · [RBAC API Spec](./rbac-api-spec.md) · [Proof Vault Spec](./proof-vault-spec.md) · [Proof Taxonomy](./proof-taxonomy.md) · [PRD](../prds/eclat-spec.md)  
> **Triggered By:** User directive — proof templates with attestation levels for manager-to-employee compliance workflows

---

## Table of Contents

1. [Overview](#1-overview)
2. [Attestation Level System](#2-attestation-level-system)
3. [Template Data Model](#3-template-data-model)
4. [Template Lifecycle](#4-template-lifecycle)
5. [Template Assignment](#5-template-assignment)
6. [Proof Fulfillment Workflow](#6-proof-fulfillment-workflow)
7. [Readiness Score Integration](#7-readiness-score-integration)
8. [API Endpoints](#8-api-endpoints)
9. [RBAC Permissions](#9-rbac-permissions)
10. [UI Screens](#10-ui-screens)
11. [Integration with Existing Systems](#11-integration-with-existing-systems)
12. [Phase Recommendation](#12-phase-recommendation)
13. [Implementation Notes](#13-implementation-notes)

---

## 1. Overview

### What Are Proof Templates?

A **Proof Template** is a reusable compliance requirement bundle that managers assign to employees. Each template contains a list of **proof requirements** — things an employee must demonstrate (certifications, clearances, training completions). Each proof requirement has an **attestation level** defining *how* the employee must prove it.

### Example Use Cases

| Industry | Template Name | Proof Requirements |
|----------|--------------|-------------------|
| **Construction** | "Forklift Operator Onboarding" | OSHA 10-Hour Card (Upload), Drug Test Clearance (Third-Party), Forklift Certification (Validated) |
| **Healthcare** | "Nursing Staff Annual Renewal" | CPR Certification (Upload), TB Test (Third-Party), HIPAA Training (Self-Attest), License Verification (Validated) |
| **Manufacturing** | "Safety Team Requirements" | Lockout/Tagout Training (Upload), First Aid Certification (Upload), Respirator Fit Test (Third-Party) |

### Key Concepts

| Concept | Definition |
|---------|------------|
| **Proof Template** | A named collection of proof requirements, created by managers, versioned, and assignable to employees |
| **Proof Requirement** | A single item within a template (e.g., "CPR Certification") with an attestation level |
| **Attestation Level** | The trust tier defining how an employee fulfills a proof (self-attest, upload, third-party, validated) |
| **Assignment** | Linking a template to an employee — creates proof fulfillment records for each requirement |
| **Fulfillment** | An employee's response to a single proof requirement (their attestation/upload/verification status) |

### Value Proposition

1. **Standardization** — Managers define once, assign to many employees
2. **Flexibility** — Different roles/departments can have different templates
3. **Trust Gradient** — Attestation levels encode organizational trust policies
4. **Auditability** — Every fulfillment is tracked with timestamps and evidence
5. **Readiness Integration** — Template completion feeds directly into employee readiness scores

---

## 2. Attestation Level System

### 2.1 Level Definitions

| Level | Name | Code | Description | Trust | Evidence Stored |
|:-----:|------|------|-------------|:-----:|-----------------|
| **1** | Self-Attestation | `self_attest` | Employee declares "I have completed this" via checkbox/statement | Lowest | Boolean + timestamp |
| **2** | Document Upload | `upload` | Employee uploads supporting documentation (PDF, image, scan) | Medium | File reference to Proof Vault |
| **3** | Third-Party Verification | `third_party` | External system confirms status (API check, issuer portal, background check service) | High | External reference ID + verification timestamp |
| **4** | Internal Validation | `validated` | Authorized internal reviewer (manager, compliance officer) reviews and approves | Highest | Reviewer ID + approval timestamp + optional notes |

### 2.2 Compound Levels (Level Combinations)

Proof requirements can require **multiple attestation levels** to be completed. This handles the "Upload + Validated" scenario:

| Compound Code | Meaning | Example Use Case |
|---------------|---------|------------------|
| `upload_validated` | Employee uploads document, then reviewer validates it | Medical clearance: upload the form, then compliance officer verifies authenticity |
| `third_party_validated` | Third-party provides data, then reviewer validates interpretation | Background check results returned, compliance officer confirms clearance |
| `self_attest_upload` | Employee self-attests AND uploads evidence | Training acknowledgment: check the box AND upload signed form |

**Implementation:** `attestationLevels` is stored as a Postgres array (`String[]`), allowing any combination. The fulfillment is considered complete only when **all specified levels are satisfied**.

### 2.3 Level Upgrade Path

Proofs can be **upgraded** over time — start at a lower level and strengthen later:

| From | To | Scenario |
|------|-----|----------|
| `self_attest` → `upload` | Employee initially declares completion, later uploads certificate when received |
| `upload` → `validated` | Employee uploads document, manager later verifies it |
| `upload` → `upload_validated` | Policy change: existing uploads now require validation |

**Rule:** Level downgrades are not permitted. Once a proof has been validated (Level 4), it cannot be reduced to a lower level. This maintains audit integrity.

### 2.4 Expiration Behavior

| Event | Fulfillment Status | Attestation Effect |
|-------|-------------------|-------------------|
| Proof expires (per `expiresAt` date) | `expired` | Entire fulfillment resets to `unfulfilled` — employee must re-attest at the required level |
| Template is re-assigned | Preserves existing fulfillments if same requirements | See §5.4 |
| Underlying qualification expires | Linked fulfillments marked `expired` | Triggers re-fulfillment workflow |

### 2.5 Attestation Level Trust Matrix (for Readiness Scoring)

| Level | Trust Weight | Readiness Contribution | Audit-Ready |
|:-----:|:------------:|:----------------------:|:-----------:|
| 1 | 0.25 | Partial (25%) | ⚠️ May require upgrade for audit |
| 2 | 0.60 | Substantial (60%) | ⚠️ Depends on document quality |
| 3 | 0.85 | High (85%) | ✅ Third-party verified |
| 4 | 1.00 | Full (100%) | ✅ Internally validated |

Compound levels use the **highest** weight of their components (e.g., `upload_validated` = 1.00).

---

## 3. Template Data Model

### 3.1 Prisma Schema Additions

```prisma
// ─── Proof Templates ────────────────────────────────────────

enum TemplateStatus {
  draft
  published
  archived
}

enum AttestationLevel {
  self_attest
  upload
  third_party
  validated
}

enum FulfillmentStatus {
  unfulfilled
  pending_review    // For validated levels awaiting reviewer
  fulfilled
  expired
  rejected          // Reviewer rejected the submission
}

model ProofTemplate {
  id              String           @id @default(uuid())
  name            String
  description     String           @default("")
  category        String?          // e.g., "Onboarding", "Annual Renewal", "Safety"
  status          TemplateStatus   @default(draft)
  version         Int              @default(1)
  previousVersion String?          // References prior version's ID for audit trail
  createdBy       String           // userId who created
  createdByUser   User             @relation("TemplateCreator", fields: [createdBy], references: [id])
  updatedBy       String?          // userId who last updated
  standardId      String?          // Optional link to a compliance standard
  standard        Standard?        @relation(fields: [standardId], references: [id])
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  publishedAt     DateTime?
  archivedAt      DateTime?

  requirements    ProofRequirement[]
  assignments     TemplateAssignment[]

  @@index([status])
  @@index([createdBy])
  @@index([standardId])
  @@map("proof_templates")
}

model ProofRequirement {
  id               String             @id @default(uuid())
  templateId       String
  template         ProofTemplate      @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  name             String             // e.g., "CPR Certification"
  description      String             @default("")
  attestationLevels AttestationLevel[] // Array: ["upload", "validated"] for compound
  
  // Proof type classification — see proof-taxonomy.md §3 for full taxonomy
  proofType         ProofType?         // hours, certification, training, clearance, assessment, compliance
  proofSubType      String?            // Sub-type within proofType (e.g., "flight_hours", "license")
  typeConfig        Json?              // Type-specific configuration (see proof-taxonomy.md §6.3)
  threshold         Float?             // For accumulative types: target quantity
  thresholdUnit     String?            // Unit for threshold (hours, credits, days)
  rollingWindowDays Int?               // Rolling window for recency requirements
  universalCategory String?            // initial_qualification, recency_proof, clearance_status, continuing_competency, audit_trail
  
  // Optional linking to existing E-CLAT concepts
  qualificationType String?           // Links to a qualification type/label
  medicalTestType   String?           // Links to a medical test type
  standardReqId     String?           // Links to a StandardRequirement
  standardReq       StandardRequirement? @relation(fields: [standardReqId], references: [id])
  
  // Expiration rules
  validityDays      Int?              // If set, fulfillment expires N days after completion
  renewalWarningDays Int?             // Days before expiry to warn (default: 30)
  
  // Ordering
  sortOrder         Int               @default(0)
  isRequired        Boolean           @default(true) // Optional requirements exist
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  fulfillments      ProofFulfillment[]

  @@index([templateId])
  @@map("proof_requirements")
}

model TemplateAssignment {
  id              String         @id @default(uuid())
  templateId      String
  template        ProofTemplate  @relation(fields: [templateId], references: [id])
  templateVersion Int            // Snapshot of template version at assignment time
  
  // Assignment target (one of: employee, role, department)
  employeeId      String?
  employee        Employee?      @relation(fields: [employeeId], references: [id])
  role            String?        // Role name (if assigned to all employees with this role)
  department      String?        // Department (if assigned to entire department)
  
  assignedBy      String         // userId who made the assignment
  assignedByUser  User           @relation("AssignmentCreator", fields: [assignedBy], references: [id])
  
  dueDate         DateTime?      // Optional deadline for full completion
  isActive        Boolean        @default(true)
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  completedAt     DateTime?      // When all fulfillments completed

  fulfillments    ProofFulfillment[]

  @@unique([templateId, employeeId]) // One assignment per template per employee
  @@index([employeeId])
  @@index([role])
  @@index([department])
  @@index([assignedBy])
  @@map("template_assignments")
}

model ProofFulfillment {
  id              String            @id @default(uuid())
  assignmentId    String
  assignment      TemplateAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  requirementId   String
  requirement     ProofRequirement   @relation(fields: [requirementId], references: [id])
  employeeId      String             // Denormalized for query efficiency
  employee        Employee           @relation(fields: [employeeId], references: [id])
  
  status          FulfillmentStatus  @default(unfulfilled)
  
  // Level-specific fulfillment data
  selfAttestedAt  DateTime?          // Level 1
  selfAttestation String?            // Optional statement/acknowledgment text
  
  uploadedAt      DateTime?          // Level 2
  vaultDocumentId String?            // Reference to VaultDocument
  vaultDocument   VaultDocument?     @relation(fields: [vaultDocumentId], references: [id])
  documentId      String?            // Alternative: reference to Document (unencrypted)
  
  thirdPartyVerifiedAt DateTime?     // Level 3
  thirdPartySource     String?       // e.g., "Checkr", "CastleBranch", "StateRegistry"
  thirdPartyRefId      String?       // External reference ID
  thirdPartyData       Json?         // Raw response data (encrypted at rest)
  
  validatedAt     DateTime?          // Level 4
  validatedBy     String?            // userId of validator
  validatorUser   User?              @relation("FulfillmentValidator", fields: [validatedBy], references: [id])
  validatorNotes  String?
  rejectedAt      DateTime?          // If rejected
  rejectionReason String?
  
  // Expiration tracking
  expiresAt       DateTime?
  expiredAt       DateTime?          // When it actually expired
  
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@unique([assignmentId, requirementId]) // One fulfillment per requirement per assignment
  @@index([employeeId])
  @@index([status])
  @@index([expiresAt])
  @@map("proof_fulfillments")
}
```

### 3.2 Model Relations Update

Add to existing models:

```prisma
model User {
  // ... existing fields ...
  createdTemplates     ProofTemplate[]      @relation("TemplateCreator")
  templateAssignments  TemplateAssignment[] @relation("AssignmentCreator")
  validatedFulfillments ProofFulfillment[]  @relation("FulfillmentValidator")
}

model Employee {
  // ... existing fields ...
  templateAssignments  TemplateAssignment[]
  proofFulfillments    ProofFulfillment[]
}

model Standard {
  // ... existing fields ...
  templates            ProofTemplate[]
}

model StandardRequirement {
  // ... existing fields ...
  proofRequirements    ProofRequirement[]
}

model VaultDocument {
  // ... existing fields ...
  fulfillments         ProofFulfillment[]
}
```

### 3.3 Design Rationale

| Decision | Rationale |
|----------|-----------|
| **`attestationLevels` as array** | Enables compound levels without additional tables. Most requirements have 1-2 levels max. |
| **`templateVersion` on assignment** | Freezes the version at assignment time so changes to the template don't retroactively change requirements |
| **Separate `ProofFulfillment` model** | Decouples template structure from employee progress. Enables per-employee tracking at the requirement level. |
| **`employeeId` denormalized on fulfillment** | Avoids expensive joins through assignment for common queries (e.g., "all fulfillments for employee X") |
| **`vaultDocumentId` vs `documentId`** | Supports both encrypted vault uploads and existing document pipeline. Vault preferred for sensitive proofs. |
| **`isRequired` flag** | Some proofs are "nice to have" — template can include optional requirements that don't block completion |
| **`standardReqId` link** | Bridges templates to existing standards framework — a template requirement can map to a standard requirement |

---

## 4. Template Lifecycle

### 4.1 State Machine

```
                     ┌─────────────────────────────────────────────────┐
                     │                                                 │
                     ▼                                                 │
┌─────────┐     ┌───────────┐     ┌───────────────┐     ┌───────────┐ │
│  Draft  │────▶│ Published │────▶│   Archived    │     │  (Clone)  │─┘
└─────────┘     └───────────┘     └───────────────┘     └───────────┘
     │               │                                        ▲
     │               │         ┌──────────────────────────────┘
     │               ▼         │
     │          ┌───────────┐  │
     │          │  New Ver  │──┘
     │          │  (Draft)  │
     │          └───────────┘
     │
     └──────────────────────▶ (Delete - if never published)
```

### 4.2 Status Definitions

| Status | Can Edit? | Can Assign? | Can Delete? | Description |
|--------|:---------:|:-----------:|:-----------:|-------------|
| `draft` | ✅ | ❌ | ✅ | Work in progress. Only creator/admin can see. |
| `published` | ❌ | ✅ | ❌ | Live and assignable. Edits create new version. |
| `archived` | ❌ | ❌ | ❌ | Retired. Existing assignments continue but no new ones. |

### 4.3 Versioning Rules

When a **published** template needs modification:

1. **Clone to draft** — Create new template with `version = previousVersion + 1`, `previousVersion = oldTemplateId`, `status = draft`
2. **Edit the draft** — Modify requirements as needed
3. **Publish the draft** — Original template remains published for existing assignments
4. **Archive the original** (optional) — Prevents new assignments to old version

### 4.4 What Happens to Existing Assignments on Version Change?

| Scenario | Behavior |
|----------|----------|
| Employee has v1, manager publishes v2 | **No automatic migration.** Employee continues on v1 until explicitly re-assigned. |
| Manager re-assigns v2 to same employee | **Preserve fulfilled requirements** where the requirement ID matches (same name + same attestation level). New requirements start unfulfilled. |
| Requirement removed in v2 | Employee's v1 fulfillment for that requirement is preserved (for audit) but not counted in v2 completion. |
| Requirement attestation level increased | Employee must re-fulfill at the higher level. Previous fulfillment preserved in audit log. |

**Architecture Decision:** Templates are **point-in-time snapshots**. The `templateVersion` on `TemplateAssignment` captures exactly what the employee was assigned. This prevents "moving goalposts" in compliance scenarios.

### 4.5 Audit Trail

All template lifecycle events are logged:

| Event | Audit Action | Details Captured |
|-------|-------------|-----------------|
| Template created | `template_create` | Name, creator, initial requirements |
| Template published | `template_publish` | Version number, publishedAt |
| Template archived | `template_archive` | Reason (optional) |
| Template cloned | `template_clone` | Source template ID, new template ID |
| Requirement added | `requirement_add` | Requirement details |
| Requirement modified | `requirement_update` | Before/after attestation levels |
| Requirement removed | `requirement_delete` | Requirement details |

---

## 5. Template Assignment

### 5.1 Assignment Types

| Type | Target | How It Works | Use Case |
|------|--------|--------------|----------|
| **Individual** | Single employee | Creates one `TemplateAssignment` with `employeeId` | Ad-hoc assignments, new hire specific |
| **By Role** | All employees with role X | Creates assignments for all matching employees. New hires with role auto-assigned. | "All Supervisors must complete Leadership Training" |
| **By Department** | All employees in department Y | Creates assignments for all in department. New hires auto-assigned. | "Operations team must have safety certs" |

### 5.2 Assignment Creation Flow

```
Manager creates assignment
        │
        ▼
┌────────────────────────────┐
│ Resolve target employees   │
│ (expand role/department)   │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│ Check for existing         │
│ assignments (dedup)        │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│ Create TemplateAssignment  │
│ for each employee          │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│ Create ProofFulfillment    │
│ for each requirement       │
│ (status: unfulfilled)      │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│ Send notification to       │
│ assigned employees         │
└────────────────────────────┘
```

### 5.3 Auto-Assignment Rules

Role-based and department-based assignments are **dynamic**:

| Event | Action |
|-------|--------|
| New employee hired with role X | Check for role-based template assignments → auto-create assignment |
| Employee changes role | Remove assignments from old role templates, add from new role templates |
| Employee changes department | Remove assignments from old dept templates, add from new dept templates |

**Implementation:** A background job (`templateAssignmentSync`) runs on employee create/update to reconcile assignments.

### 5.4 Overlapping Templates

When an employee has **multiple templates** with **overlapping proofs** (same proof in different templates):

| Scenario | Resolution |
|----------|------------|
| Same proof, same attestation level | **Share fulfillment.** Completing once satisfies both. |
| Same proof, different attestation level | **Require highest level.** If Template A needs Level 2 and Template B needs Level 4, employee fulfills at Level 4. Both assignments show fulfilled. |
| Same proof name, different details | Treated as **distinct** proofs. Employee must fulfill each. |

**Implementation:** Proof matching uses a composite key: `(qualificationType || medicalTestType || standardReqId || name)`. If these match, fulfillments are shared.

### 5.5 Deactivating Assignments

| Action | Result |
|--------|--------|
| **Deactivate assignment** | `isActive = false`. Fulfillments preserved. Assignment stops affecting readiness score. |
| **Delete assignment** | Cascade delete fulfillments. Assignment removed from employee view. Audit log retained. |
| **Archive template** | All assignments remain active but template marked "(Archived)" in UI. No new assignments. |

---

## 6. Proof Fulfillment Workflow

### 6.1 Employee View

```
┌─────────────────────────────────────────────────────────────────────┐
│  My Proof Templates                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Forklift Operator Onboarding ────────────────────────────┐   │
│  │ Due: March 30, 2026         Progress: ████████░░ 80%        │   │
│  │                                                              │   │
│  │ ✅ OSHA 10-Hour Card        │ Uploaded Feb 15               │   │
│  │ ✅ Drug Test Clearance      │ Verified via Checkr           │   │
│  │ ⏳ Forklift Certification   │ Pending validation            │   │
│  │ ⬜ Equipment Familiarization│ Self-attest required          │   │
│  │                                                              │   │
│  │ [Continue]                                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Annual Safety Renewal ───────────────────────────────────┐   │
│  │ Due: April 15, 2026         Progress: ██░░░░░░░░ 20%        │   │
│  │ [Start]                                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Fulfillment State Machine (per Requirement)

```
┌─────────────┐
│ unfulfilled │ ─────────────────────────────────────────────┐
└─────────────┘                                               │
      │                                                       │
      │ Employee submits                                      │
      ▼                                                       │
┌─────────────────┐      Reviewer approves      ┌───────────┐│
│ pending_review  │ ──────────────────────────▶ │ fulfilled ││
│ (for validated) │                             └───────────┘│
└─────────────────┘                                   │       │
      │                                               │       │
      │ Reviewer rejects                              │       │
      ▼                                               │       │
┌──────────┐                                          │       │
│ rejected │ ◀────────────────────────────────────────┘       │
└──────────┘      (Proof expires)                             │
      │                                                       │
      │ Employee re-submits                                   │
      └───────────────────────────────────────────────────────┘
```

### 6.3 Fulfillment Actions by Attestation Level

#### Level 1: Self-Attestation

```typescript
// Employee clicks checkbox
POST /api/fulfillments/:id/self-attest
{
  statement: "I acknowledge I have completed this requirement."
}
// Response: fulfillment updated with selfAttestedAt, status = fulfilled
```

#### Level 2: Document Upload

```typescript
// Employee uploads to proof vault (or document module)
POST /api/vault/documents  // or POST /api/documents/upload
// Then links to fulfillment:
POST /api/fulfillments/:id/attach-document
{
  vaultDocumentId: "uuid",  // or documentId for non-vault
}
// Response: fulfillment updated with uploadedAt, status = fulfilled (unless also requires validation)
```

#### Level 3: Third-Party Verification

```typescript
// System initiates third-party check (or receives webhook callback)
POST /api/fulfillments/:id/third-party-verify
{
  source: "Checkr",
  referenceId: "CHK-ABC123",
  verifiedAt: "2026-03-18T10:00:00Z",
  data: { /* raw response */ }
}
// Response: fulfillment updated with thirdPartyVerifiedAt, status = fulfilled
```

**Note:** Third-party verification is typically initiated by a background job or webhook handler, not direct employee action.

#### Level 4: Internal Validation

```typescript
// Reviewer (manager/compliance) approves
POST /api/fulfillments/:id/validate
{
  approved: true,
  notes: "Verified original document in person."
}
// Response: fulfillment updated with validatedAt, validatedBy, status = fulfilled

// Or reviewer rejects
POST /api/fulfillments/:id/validate
{
  approved: false,
  reason: "Document image is unreadable. Please re-upload."
}
// Response: fulfillment updated with rejectedAt, rejectionReason, status = rejected
```

### 6.4 Compound Level Handling

For requirements with multiple attestation levels (e.g., `["upload", "validated"]`):

1. Employee uploads document → `uploadedAt` set, status remains `pending_review`
2. Reviewer validates → `validatedAt` set, status becomes `fulfilled`

**Status logic:**

```typescript
function computeFulfillmentStatus(fulfillment, requiredLevels): FulfillmentStatus {
  const levelsSatisfied = requiredLevels.every(level => {
    switch (level) {
      case 'self_attest': return !!fulfillment.selfAttestedAt;
      case 'upload': return !!fulfillment.uploadedAt;
      case 'third_party': return !!fulfillment.thirdPartyVerifiedAt;
      case 'validated': return !!fulfillment.validatedAt;
    }
  });
  
  if (levelsSatisfied) return 'fulfilled';
  if (fulfillment.rejectedAt) return 'rejected';
  if (fulfillment.expiresAt && fulfillment.expiresAt < now()) return 'expired';
  
  // Check if any submission made for validated level
  if (requiredLevels.includes('validated') && 
      (fulfillment.uploadedAt || fulfillment.thirdPartyVerifiedAt || fulfillment.selfAttestedAt)) {
    return 'pending_review';
  }
  
  return 'unfulfilled';
}
```

### 6.5 Expiration Handling

A background job (`fulfillmentExpirationCheck`) runs daily:

```typescript
// Find fulfillments where expiresAt <= now() and status != 'expired'
// Update status to 'expired', set expiredAt
// Clear the level-specific timestamps (selfAttestedAt, uploadedAt, etc.)
// Create notification for employee: "Your [proof name] has expired. Please re-certify."
// Create notification for manager: "[Employee name]'s [proof name] has expired."
```

---

## 7. Readiness Score Integration

### 7.1 Template Contribution to Readiness

Template completion affects the employee's overall readiness score:

```typescript
function calculateTemplateReadiness(assignment: TemplateAssignment): number {
  const requirements = assignment.template.requirements.filter(r => r.isRequired);
  if (requirements.length === 0) return 1.0;
  
  let totalWeight = 0;
  let earnedWeight = 0;
  
  for (const req of requirements) {
    const fulfillment = assignment.fulfillments.find(f => f.requirementId === req.id);
    const maxTrustWeight = Math.max(...req.attestationLevels.map(levelToWeight));
    totalWeight += maxTrustWeight;
    
    if (fulfillment?.status === 'fulfilled') {
      earnedWeight += maxTrustWeight;
    } else if (fulfillment?.status === 'pending_review') {
      earnedWeight += maxTrustWeight * 0.5; // Partial credit while awaiting validation
    }
  }
  
  return earnedWeight / totalWeight;
}

function levelToWeight(level: AttestationLevel): number {
  switch (level) {
    case 'self_attest': return 0.25;
    case 'upload': return 0.60;
    case 'third_party': return 0.85;
    case 'validated': return 1.00;
  }
}
```

### 7.2 Integration with `GET /employees/:id/readiness`

The existing readiness endpoint is extended:

```typescript
// Response structure
{
  overall: {
    status: "at_risk",
    score: 0.72,
    breakdown: {
      qualifications: { score: 0.80, weight: 0.40 },
      medical: { score: 0.90, weight: 0.30 },
      templates: { score: 0.45, weight: 0.30 }  // NEW
    }
  },
  templates: [
    {
      templateId: "...",
      templateName: "Forklift Operator Onboarding",
      progress: 0.80,  // 4 of 5 requirements fulfilled
      dueDate: "2026-03-30",
      status: "in_progress",
      requirements: [
        { name: "OSHA 10-Hour Card", status: "fulfilled", fulfillmentMethod: "upload" },
        { name: "Drug Test Clearance", status: "fulfilled", fulfillmentMethod: "third_party" },
        { name: "Forklift Certification", status: "pending_review", fulfillmentMethod: "upload_validated" },
        // ...
      ]
    }
  ]
}
```

### 7.3 Overall Status Impact

| Scenario | Readiness Status Impact |
|----------|------------------------|
| All assigned templates 100% fulfilled | No negative impact |
| Any template < 100% with passed due date | `non_compliant` |
| Any template < 100% with due date within 30 days | `at_risk` |
| Template with expired proofs | `at_risk` or `non_compliant` depending on count/severity |

---

## 8. API Endpoints

### 8.1 New Module: `apps/api/src/modules/templates/`

All template endpoints are prefixed: `/api/templates`

### 8.2 Endpoint Catalog

| # | Method | Path | Description | Min Role | Scope |
|---|--------|------|-------------|----------|-------|
| **Templates CRUD** |||||
| T-01 | `POST` | `/api/templates` | Create new template (draft) | Supervisor | Own |
| T-02 | `GET` | `/api/templates` | List templates | Supervisor | Created by self, or published |
| T-03 | `GET` | `/api/templates/:id` | Get template details | Employee | Published, or own draft |
| T-04 | `PUT` | `/api/templates/:id` | Update template (draft only) | Supervisor | Own draft |
| T-05 | `DELETE` | `/api/templates/:id` | Delete template (draft only) | Supervisor | Own draft |
| T-06 | `POST` | `/api/templates/:id/publish` | Publish template | Manager | Own or has edit permission |
| T-07 | `POST` | `/api/templates/:id/archive` | Archive template | Manager | Own or has edit permission |
| T-08 | `POST` | `/api/templates/:id/clone` | Clone template as new draft | Supervisor | Any published |
| **Requirements** |||||
| T-09 | `POST` | `/api/templates/:id/requirements` | Add requirement | Supervisor | Own draft |
| T-10 | `PUT` | `/api/templates/:id/requirements/:reqId` | Update requirement | Supervisor | Own draft |
| T-11 | `DELETE` | `/api/templates/:id/requirements/:reqId` | Remove requirement | Supervisor | Own draft |
| T-12 | `PUT` | `/api/templates/:id/requirements/reorder` | Reorder requirements | Supervisor | Own draft |
| **Assignments** |||||
| T-13 | `POST` | `/api/templates/:id/assign` | Assign template to employee(s) | Supervisor | Team/Dept scope |
| T-14 | `GET` | `/api/templates/:id/assignments` | List assignments for template | Supervisor | Team/Dept scope |
| T-15 | `DELETE` | `/api/assignments/:id` | Deactivate/delete assignment | Manager | Team/Dept scope |
| T-16 | `GET` | `/api/employees/:id/assignments` | List assignments for employee | Employee | Own, or team scope |
| **Fulfillments** |||||
| T-17 | `GET` | `/api/assignments/:id/fulfillments` | Get fulfillment status for assignment | Employee | Own, or team scope |
| T-18 | `POST` | `/api/fulfillments/:id/self-attest` | Self-attest a proof | Employee | Own assignment |
| T-19 | `POST` | `/api/fulfillments/:id/attach-document` | Attach uploaded document | Employee | Own assignment |
| T-20 | `POST` | `/api/fulfillments/:id/validate` | Approve/reject fulfillment | Manager | Team/Dept scope |
| T-21 | `POST` | `/api/fulfillments/:id/third-party-verify` | Record third-party verification | Admin | Any (system use) |
| **Review Queue** |||||
| T-22 | `GET` | `/api/fulfillments/pending-review` | List fulfillments awaiting validation | Manager | Team/Dept scope |
| T-23 | `GET` | `/api/fulfillments/pending-review/count` | Count pending validations | Manager | Team/Dept scope |
| **Audit** |||||
| T-24 | `GET` | `/api/templates/:id/audit` | Template audit trail | Supervisor | Team scope |
| T-25 | `GET` | `/api/fulfillments/:id/audit` | Fulfillment audit trail | Supervisor | Team scope |

### 8.3 Endpoint Details

#### T-01: Create Template

```typescript
// POST /api/templates
// Body:
{
  name: string;                    // Required: "Forklift Operator Onboarding"
  description?: string;
  category?: string;               // "Onboarding", "Annual", "Safety"
  standardId?: string;             // Optional link to compliance standard
  requirements?: [                 // Optional: create with initial requirements
    {
      name: string;
      description?: string;
      attestationLevels: AttestationLevel[];  // ["upload", "validated"]
      qualificationType?: string;
      medicalTestType?: string;
      standardReqId?: string;
      validityDays?: number;
      isRequired?: boolean;
    }
  ]
}
// Response: 201
{
  id: string;
  name: string;
  status: "draft";
  version: 1;
  createdBy: string;
  createdAt: string;
  requirements: [...]
}
```

#### T-13: Assign Template

```typescript
// POST /api/templates/:id/assign
// Body (one of):
{
  employeeIds: string[];           // Assign to specific employees
  dueDate?: string;
}
// OR
{
  role: string;                    // Assign to all with this role
  dueDate?: string;
}
// OR
{
  department: string;              // Assign to entire department
  dueDate?: string;
}

// Response: 201
{
  assignments: [
    {
      id: string;
      employeeId: string;
      employeeName: string;
      createdAt: string;
      dueDate?: string;
    }
  ],
  created: number;                 // Count of new assignments
  skipped: number;                 // Already had this template
}
```

#### T-18: Self-Attest

```typescript
// POST /api/fulfillments/:id/self-attest
// Body:
{
  statement?: string;              // Optional acknowledgment text
}
// Response: 200
{
  id: string;
  status: "fulfilled",             // or "pending_review" if also needs validation
  selfAttestedAt: string;
  updatedAt: string;
}
```

#### T-20: Validate Fulfillment

```typescript
// POST /api/fulfillments/:id/validate
// Body:
{
  approved: boolean;
  notes?: string;                  // For approval
  reason?: string;                 // For rejection
}
// Response: 200
{
  id: string;
  status: "fulfilled" | "rejected";
  validatedAt?: string;
  validatedBy?: string;
  validatorNotes?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}
```

---

## 9. RBAC Permissions

### 9.1 New Permission Set

| Permission | Description |
|-----------|-------------|
| `templates:read` | View templates (filtered by status/ownership) |
| `templates:create` | Create new templates |
| `templates:update` | Edit own draft templates |
| `templates:publish` | Publish templates (draft → published) |
| `templates:archive` | Archive templates |
| `templates:assign` | Assign templates to employees |
| `templates:validate` | Approve/reject fulfillments awaiting validation |
| `fulfillments:read` | View fulfillment status |
| `fulfillments:submit` | Submit self-attestations, attach documents |

### 9.2 Role-Permission Matrix

| Permission | Employee | Supervisor | Manager | Comp. Officer | Admin |
|-----------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| `templates:read` | ✅¹ | ✅ | ✅ | ✅ | ✅ |
| `templates:create` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `templates:update` | ❌ | ✅² | ✅² | ✅² | ✅ |
| `templates:publish` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `templates:archive` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `templates:assign` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `templates:validate` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `fulfillments:read` | ✅¹ | ✅ | ✅ | ✅ | ✅ |
| `fulfillments:submit` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Notes:**
1. Own assignments only
2. Own drafts only (Admin can edit any)

### 9.3 Data Scoping

| Role | Templates Visible | Assignments Visible | Validation Scope |
|------|------------------|--------------------|--------------------|
| Employee | Published templates (read-only), own drafts | Own assignments only | N/A |
| Supervisor | Published + own drafts | Team (direct reports) | N/A |
| Manager | All published + own drafts | Department | Department |
| Compliance Officer | All | Organization | Organization |
| Admin | All (including others' drafts) | Organization | Organization |

---

## 10. UI Screens

### 10.1 New `apps/web` Screens

| # | Screen | Route | Description | Min Role |
|---|--------|-------|-------------|----------|
| W-30 | My Templates | `/me/templates` | Employee's assigned templates with progress | Employee |
| W-31 | Template Fulfillment | `/me/templates/:assignmentId` | Complete proofs for a single template | Employee |
| W-32 | Template Library | `/templates` | Browse available templates | Supervisor |
| W-33 | Template Detail | `/templates/:id` | View template requirements | Supervisor |
| W-34 | Template Editor | `/templates/:id/edit` | Edit draft template (requirements) | Supervisor |
| W-35 | Template Assign | `/templates/:id/assign` | Assign template to employees | Supervisor |
| W-36 | Team Templates | `/team/templates` | View team members' template progress | Supervisor |
| W-37 | Fulfillment Review Queue | `/reviews/templates` | Pending fulfillment validations | Manager |
| W-38 | Fulfillment Review Detail | `/reviews/templates/:fulfillmentId` | Review single fulfillment | Manager |

### 10.2 New `apps/admin` Screens

| # | Screen | Route | Description |
|---|--------|-------|-------------|
| A-11 | Template Management | `/templates` | Admin view of all templates (all statuses, all creators) |
| A-12 | Template Stats | `/templates/stats` | Analytics: most assigned, completion rates, expiration trends |

### 10.3 Screen Wireframes

#### W-30: My Templates (Employee View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard > My Templates                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  You have 2 active template assignments                             │
│                                                                     │
│  ┌─── Forklift Operator Onboarding ────────────────────────────┐   │
│  │ Assigned by: John Smith       Due: March 30, 2026           │   │
│  │                                                              │   │
│  │ Progress: ████████████████░░░░ 80%                          │   │
│  │                                                              │   │
│  │ ✅ OSHA 10-Hour Card          Uploaded Feb 15                │   │
│  │ ✅ Drug Test Clearance        Verified via Checkr            │   │
│  │ ⏳ Forklift Certification     Pending validation (uploaded)  │   │
│  │ ⬜ Equipment Familiarization  Not started                    │   │
│  │                                                              │   │
│  │ [Continue ▶]                                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Annual Safety Renewal ───────────────────────────────────┐   │
│  │ Assigned by: Sarah Mgr        Due: April 15, 2026           │   │
│  │                                                              │   │
│  │ Progress: ████░░░░░░░░░░░░░░░░ 20%                          │   │
│  │                                                              │   │
│  │ ✅ First Aid Refresher        Completed (self-attested)      │   │
│  │ ⬜ Fire Safety Training       Not started                    │   │
│  │ ⬜ Evacuation Drill Cert      Not started                    │   │
│  │ ⬜ Updated Emergency Contact  Not started                    │   │
│  │                                                              │   │
│  │ [Start ▶]                                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### W-31: Template Fulfillment (Single Requirement)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Forklift Operator Onboarding > Equipment Familiarization          │
│  ← Back to Template                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Equipment Familiarization ───────────────────────────────┐   │
│  │                                                              │   │
│  │ Description:                                                 │   │
│  │ Confirm that you have completed the equipment               │   │
│  │ familiarization walkthrough with your supervisor.           │   │
│  │                                                              │   │
│  │ Required: ☑️ Self-Attestation                                │   │
│  │                                                              │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │                                                              │   │
│  │ ☐ I confirm that I have completed the equipment             │   │
│  │   familiarization walkthrough with my supervisor.           │   │
│  │                                                              │   │
│  │ Optional notes:                                              │   │
│  │ ┌──────────────────────────────────────────────────────┐    │   │
│  │ │ Completed with John on March 10th                    │    │   │
│  │ └──────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │ [Submit Attestation]                                        │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### W-32: Template Library (Supervisor+ View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard > Template Library                              [+ New]  │
├─────────────────────────────────────────────────────────────────────┤
│  [Filter: Category ▾] [Status ▾] [Standard ▾] [Search: ______]     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Name                    │ Category    │ Status    │ Actions   │ │
│  │─────────────────────────│─────────────│───────────│───────────│ │
│  │ Forklift Operator       │ Onboarding  │ Published │ [Assign]  │ │
│  │ Annual Safety Renewal   │ Annual      │ Published │ [Assign]  │ │
│  │ New Hire Orientation    │ Onboarding  │ Published │ [Assign]  │ │
│  │ Hazmat Handler          │ Safety      │ Draft     │ [Edit]    │ │
│  │ CDL Driver Compliance   │ Annual      │ Archived  │ [Clone]   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Showing 5 templates                                   [< 1 2 >]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### W-37: Fulfillment Review Queue (Manager+ View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard > Template Reviews                                       │
├─────────────────────────────────────────────────────────────────────┤
│  [Filter: Template ▾] [Employee ▾] [Date range ▾]                  │
│                                                                     │
│  Pending validations: 3                                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Proof               │ Employee   │ Template        │ Submitted│ │
│  │─────────────────────│────────────│─────────────────│──────────│ │
│  │ Forklift Cert       │ Jane Doe   │ Forklift Onbrd  │ Mar 15   │ │
│  │ Medical Clearance   │ Bob Lee    │ Annual Safety   │ Mar 14   │ │
│  │ CPR Certification   │ Alice Wang │ First Aid Ready │ Mar 13   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Click a row to review                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Integration with Existing Systems

### 11.1 Proof Vault Integration

| Integration Point | Description |
|-------------------|-------------|
| **Document storage** | Level 2 (upload) fulfillments link to `VaultDocument` via `vaultDocumentId` |
| **Encryption** | Vault documents are encrypted; template system stores only references |
| **Visibility** | Reviewers validating Level 4 fulfillments can view vault metadata but cannot access encrypted content without employee passphrase |
| **Alternative** | For non-sensitive proofs, use existing `Document` model (unencrypted) |

### 11.2 Qualifications Integration

| Integration Point | Description |
|-------------------|-------------|
| **`qualificationType` mapping** | Proof requirements can link to qualification types via label |
| **Auto-fulfillment** | If employee has a valid qualification matching `qualificationType`, auto-fulfill the requirement |
| **Expiration sync** | When linked qualification expires, mark fulfillment expired |

```typescript
// Background job: syncQualificationFulfillments
// For each fulfillment with qualificationType:
//   1. Find employee's qualifications of that type
//   2. If valid qualification exists with expiresAt > now(), mark fulfilled
//   3. If qualification expired, mark fulfillment expired
```

### 11.3 Medical Integration

| Integration Point | Description |
|-------------------|-------------|
| **`medicalTestType` mapping** | Proof requirements can link to medical test types |
| **Auto-fulfillment** | Valid medical clearance with matching test type auto-fulfills |
| **Status-only** | Medical clearances are pass/fail only; no document content exposed |

### 11.4 Standards Framework Integration

| Integration Point | Description |
|-------------------|-------------|
| **`standardId` on template** | Templates can be associated with a compliance standard |
| **`standardReqId` on requirement** | Individual proofs can map to specific standard requirements |
| **Gap analysis** | Templates bridge the gap between high-level standards and actionable employee proofs |
| **Reporting** | "Show all employees with Template X fulfilling Standard Y requirements" |

### 11.5 Notifications Integration

| Event | Notification Triggered |
|-------|----------------------|
| Template assigned | Employee: "You have a new template: [Name]. Due: [Date]" |
| Fulfillment due soon | Employee: "[Proof] is due in [N] days" |
| Fulfillment overdue | Employee + Assignor: "[Proof] is overdue" |
| Fulfillment pending review | Reviewers: "New fulfillment awaiting validation" |
| Fulfillment approved | Employee: "Your [Proof] has been validated" |
| Fulfillment rejected | Employee: "Your [Proof] was rejected: [Reason]" |
| Proof expired | Employee + Manager: "[Proof] has expired. Re-certification required." |

### 11.6 Readiness Score Integration

See §7 for full details. Summary:

- Template completion is a new component of readiness calculation
- Incomplete/overdue templates negatively impact status
- Trust weights (attestation levels) affect score contribution

---

## 12. Phase Recommendation

### 12.1 Feature Complexity Analysis

| Feature | Complexity | Dependencies | Priority |
|---------|:----------:|--------------|:--------:|
| Template CRUD | Medium | None | P0 |
| Attestation level system | Low | Template CRUD | P0 |
| Individual assignment | Low | Template CRUD | P0 |
| Level 1 (self-attest) fulfillment | Low | Assignment | P0 |
| Level 2 (upload) fulfillment | Medium | Proof Vault or Documents | P1 |
| Level 4 (validation) fulfillment | Medium | Assignment, Level 2 | P1 |
| Review queue | Medium | Level 4 | P1 |
| Role/department assignment | Medium | Assignment, Employee sync | P1 |
| Level 3 (third-party) fulfillment | High | External integrations | P2 |
| Auto-fulfillment from qualifications | High | Qualifications module | P2 |
| Readiness score integration | Medium | Existing readiness system | P2 |
| Analytics/reporting | Medium | All above | P3 |

### 12.2 Recommended Phasing

#### **Phase 2b** (with Proof Vault — current roadmap)

**Scope:**
- Template CRUD (draft/publish/archive lifecycle)
- Proof requirements with attestation levels (1, 2, 4)
- Individual employee assignment
- Level 1 self-attestation
- Level 2 document upload (linked to Proof Vault)
- Level 4 validation workflow + review queue
- Basic notifications

**Effort:** ~3-4 weeks for Bunk (API) + Kima (UI)

**Rationale:** Templates are a natural extension of the Proof Vault work. Managers can create templates with upload requirements that employees fulfill via the vault.

#### **Phase 3**

**Scope:**
- Role-based and department-based assignments
- Auto-assignment on employee changes
- Level 3 third-party verification (initial integrations)
- Auto-fulfillment from qualifications/medical
- Readiness score integration

**Effort:** ~2-3 weeks

#### **Phase 3+**

**Scope:**
- Template analytics (completion rates, time-to-fulfill)
- Advanced third-party integrations
- Template versioning UI improvements
- Bulk assignment management
- Standards-to-template generator (AI-assisted)

---

## 13. Implementation Notes

### 13.1 For Bunk (API)

1. **New module:** `apps/api/src/modules/templates/`
   - `templates.router.ts` — routes
   - `templates.service.ts` — business logic
   - `templates.validators.ts` — Zod schemas
   
2. **Schema migration:** Add all models from §3.1 to `data/prisma/schema.prisma`

3. **Background jobs:**
   - `fulfillmentExpirationCheck` — daily job for expiration handling
   - `templateAssignmentSync` — runs on employee create/update for role/dept assignments
   
4. **Audit integration:** Use existing `PrismaAuditLogger` for template/fulfillment events

5. **Test coverage targets:**
   - Template CRUD: 10 tests
   - Assignment logic: 8 tests
   - Fulfillment workflow: 12 tests
   - RBAC boundaries: 15 tests
   - Compound level logic: 6 tests

### 13.2 For Kima (UI)

1. **New screens:** W-30 through W-38, A-11, A-12

2. **Component reuse:**
   - Progress bars from existing dashboard widgets
   - Document upload from Proof Vault screens
   - Review queue patterns from W-16 (Document Review)
   
3. **State management:**
   - Template fulfillment wizard (multi-step form)
   - Optimistic UI updates for self-attestation
   
4. **Accessibility:**
   - Checkbox announcements for self-attest
   - Progress indicator aria labels

### 13.3 Architecture Decisions Summary

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Templates are versioned, not edited in place | Prevents "moving goalposts" for assigned employees |
| 2 | Attestation levels stored as array | Enables compound levels (Upload + Validated) |
| 3 | Fulfillments track each level separately | Supports partial progress and audit trail |
| 4 | `employeeId` denormalized on fulfillment | Query performance for employee-centric views |
| 5 | Proof vault preferred over document module | Sensitive compliance evidence should be encrypted |
| 6 | Auto-fulfillment from qualifications is Phase 3 | Requires careful edge case handling |
| 7 | Third-party verification via system endpoints | Employees don't trigger; background jobs/webhooks do |
| 8 | Templates can link to standards but don't require | Flexibility for non-standard-mapped templates |
| 9 | Review queue is Manager+ only | Supervisors can create templates but not validate |

---

## Appendix A: Attestation Level Quick Reference

```
Level 1: Self-Attest     ☑️  "I confirm..."        Trust: 25%   Employee checks box
Level 2: Upload          📄  "Here's my proof"    Trust: 60%   Employee uploads file
Level 3: Third-Party     🔗  "External verified"   Trust: 85%   System checks API
Level 4: Validated       ✅  "Reviewer approved"   Trust: 100%  Manager/CO approves

Compound:
  upload_validated      📄→✅  Upload then validate  Trust: 100%
  third_party_validated 🔗→✅  Third-party then val  Trust: 100%
  self_attest_upload    ☑️+📄  Attest AND upload     Trust: 60%
```

---

## Appendix B: API Permission Quick Reference

| Endpoint Pattern | Permission | Min Role |
|-----------------|------------|----------|
| `POST /api/templates` | `templates:create` | Supervisor |
| `PUT /api/templates/:id` | `templates:update` | Supervisor (own draft) |
| `POST /api/templates/:id/publish` | `templates:publish` | Manager |
| `POST /api/templates/:id/assign` | `templates:assign` | Supervisor |
| `POST /api/fulfillments/:id/validate` | `templates:validate` | Manager |
| `POST /api/fulfillments/:id/self-attest` | `fulfillments:submit` | Employee |
| `GET /api/employees/:id/assignments` | `fulfillments:read` | Employee (own) |

---

*End of Specification*
