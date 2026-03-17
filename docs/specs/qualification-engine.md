# Qualification Engine Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api/src/modules/qualifications`, `data/prisma`  
> **Issue:** #101 (Qualification-01)  
> **Related Docs:** `docs/specs/template-management-strategy.md`, `docs/specs/qualification-engine.md`, `docs/specs/proof-taxonomy.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Standards→Requirements→Proofs Hierarchy](#2-standardsrequirementsproofs-hierarchy)
3. [Layered Customization (Standard → Org → Dept → Individual)](#3-layered-customization-standard--org--dept--individual)
4. [L1-L4 Attestation Flow](#4-l1-l4-attestation-flow)
5. [Override Model (4 Types)](#5-override-model-4-types)
6. [Exemption Lifecycle](#6-exemption-lifecycle)
7. [Strictest Wins Composition](#7-strictest-wins-composition)
8. [Data Model Changes](#8-data-model-changes)
9. [API Contracts](#9-api-contracts)
10. [External Third-Party Invite Flow](#10-external-third-party-invite-flow)
11. [Security Considerations](#11-security-considerations)
12. [Phased Rollout Plan](#12-phased-rollout-plan)
13. [Locked Decisions](#13-locked-decisions)

---

## 1. Problem Statement

Qualifications represent proof of competency or compliance (e.g., "OSHA 30 Certification", "HIPAA Training"). Current implementation lacks:

1. **No immutable baseline:** Regulatory standards can be changed, breaking audit trails
2. **No customization layering:** Company wants to add requirements beyond regulatory baseline
3. **No override taxonomy:** Different override types (expiration extension, proof replacement, requirement waiver, grace period) not distinguished
4. **No exemption lifecycle:** Once granted, exemptions have no audit or expiry
5. **No third-party integration:** Cannot invite external assessors (L3 attestation)
6. **No "strictest wins":** Multiple requirements apply (regulatory + custom); unclear which takes precedence

**Objective:** Implement a layered qualification engine where:
- Regulatory standards are immutable reference data
- Organizations add custom requirements (additive)
- Departments/teams override (narrowing scope)
- Individuals get exemptions/overrides (with justification + audit)
- All override types explicitly tracked (expiry extension, proof override, waiver, grace period)
- External third parties can attest (L3 validation)

---

## 2. Standards→Requirements→Proofs Hierarchy

### 2.1 Logical Flow

```
ComplianceStandard (regulatory baseline; immutable)
├── name: "OSHA 30 Safety"
├── issuedBy: "OSHA"
├── version: "2024.01"
├── immutable: true
└── StandardRequirement[1..N]
    ├── id
    ├── description: "Classroom training (30 hours)"
    ├── type: "TRAINING"
    ├── minimumAttestationLevel: "L2" (supervisor)
    ├── expiryMonths: 24
    └── (no implementation choice; regulatory)

OrgCustomizationStandard (optional; tenant-specific adds)
├── basedOnStandard: ComplianceStandard.id
├── name: "OSHA 30 + Our Safety Policy"
├── immutable: false
└── StandardRequirement[1..N]
    ├── id
    ├── (includes all from base)
    ├── (PLUS custom: "Annual safety audit", "Tool inspection")
    └── (Tenant can remove or modify custom; regulatory stays)

DepartmentOverride (optional; scope narrowing)
├── appliesTo: Department ID
├── baseStandard: OrgCustomizationStandard.id
├── requirements: (base requirements, but may have stricter level)
│   ├── L2 → L3 (department requires third-party assessment)
│   └── OR: Remove non-essential requirement

IndividualOverride (exemption or extension)
├── appliesTo: Employee ID
├── baseStandard: ...
├── type: EXPIRY_EXTENSION | PROOF_OVERRIDE | WAIVER | GRACE_PERIOD
├── justification: "Medical leave during training window"
├── approvedBy: Compliance Officer
└── expiresAt: ...
```

### 2.2 Readiness Calculation

**Example:** Employee assigned OSHA 30 (regulatory) + company safety audit (custom) + department L3 assessment requirement

```
Standards applied to employee:
1. OSHA 30 (regulatory baseline): [Classroom(L2), Cert(L3)]
2. Our Safety Policy (org custom): [Classroom(L2), Cert(L3), Annual Audit(L1)]
3. Warehouse Dept override: [Cert(L3→L4), Annual Audit(L1)]
4. Individual exemption: [Annual Audit: WAIVED]

Final effective requirements:
- Classroom: L2 (from base)
- Cert: L4 (strictest: regulatory L3 + dept override L4 = L4)
- Annual Audit: WAIVED (exemption override)

Readiness: Classroom(✓ L2), Cert(✓ L4), Annual Audit(✓ waived) = READY
```

---

## 3. Layered Customization (Standard → Org → Dept → Individual)

### 3.1 Authority at Each Layer

| Layer | Creator | Authority | Scope | Mutability |
|-------|---------|-----------|-------|-----------|
| **Standard** | E-CLAT / Regulatory body | Immutable | All tenants | Read-only |
| **Org** | Tenant ADMIN | Full control (add/remove custom) | Tenant-wide | Modifiable; cannot remove regulatory reqs |
| **Dept** | Manager+ | Narrowing only (stricter level, remove optional) | Department | Modifiable (cannot weaken below org) |
| **Individual** | CO+ | Override or exemption | Single employee | Audit-logged; time-limited |

### 3.2 Modification Rules

**Org adding to Standard:**
```
✓ Add custom requirement: "Annual safety audit"
✓ Change description: "Now includes hands-on equipment inspection"
✓ Remove custom requirement: "But NOT regulatory OSHA reqs"
✗ Modify OSHA requirement level: "Cannot weaken L3 → L2"
```

**Dept narrowing Org:**
```
✓ Raise Classroom from L2 → L3 (stricter)
✓ Remove optional custom requirement: "Annual audit not required in labs"
✗ Lower OSHA level back to L2
✗ Add new requirement: "Only modify; don't add"
```

**Individual override:**
```
✓ Extend expiry: "Medical leave; extend 3 months"
✓ Replace proof: "Cert lost; accept alternative evidence"
✓ Waive requirement: "Medical exemption from physical exam"
✓ Grace period: "New hire; 30 days to complete"
✗ Permanently remove requirement: "Only time-limited overrides"
```

---

## 4. L1-L4 Attestation Flow

### 4.1 Attestation Levels Defined

| Level | Definition | Who Attests | Example |
|-------|-----------|------------|---------|
| **L1** | Self-attestation | Employee | "I completed this training" |
| **L2** | Supervisor attestation | SUPERVISOR+ | "I watched them pass the exam" |
| **L3** | Third-party | External assessor (not employee's chain) | Certification body, licensing board |
| **L4** | Validated | Compliance Officer | CO audits L1/L2/L3; adds final seal |

### 4.2 Requirement States During Fulfillment

```
Requirement: OSHA Certification (min: L3)

1. ASSIGNED → Employee gets task
2. IN_PROGRESS → Employee uploads L1 evidence (self-attest)
   System check: L1 < L3 (minimum) → ERROR
   "Please have a supervisor or third-party validate this"
3. PENDING_SUPERVISOR → Supervisor can attest (L2)
   Supervisor uploads: L2 attestation
   System check: L2 < L3 → Still below minimum
   "Need third-party or CO validation"
4. PENDING_THIRD_PARTY → External assessor invited (L3)
   OR Employee requests CO validation (L4)
5. COMPLETED → L3 or L4 achieved; requirement met ✓
```

### 4.3 Attestation Upgrade (Common Pattern)

```
Scenario: Supervisor reviews L1 self-attest, approves, upgrades to L2

1. Employee submits: { status: L1, evidence: "training cert" }
2. Supervisor reviews: "Looks good"
3. Supervisor upgrades: { status: L2, supervisorApprovedAt: now() }
   Audit: "SUPERVISOR upgraded L1 → L2 for OSHA Cert (emp: id, sup: mgr_id)"
4. If requirement min = L2, completed ✓
   If requirement min = L3, still waiting for third-party
```

---

## 5. Override Model (4 Types)

### 5.1 Type 1: Expiry Extension

**Use case:** Employee's OSHA cert expires next week; on medical leave; cannot retrain right now.

```
QualificationOverride {
  type: EXPIRY_EXTENSION
  qualificationId
  employeeId
  originalExpiresAt: 2026-04-15
  newExpiresAt: 2026-07-15
  justification: "Medical leave (surgical recovery); cannot attend training until June"
  approvedBy: CO.id
  approvedAt: 2026-04-10
  expiresAt: 2026-07-15  // Override itself expires when new expiry reached
}

Audit log: "CO approved 3-month extension for OSHA cert; justification: medical leave"
```

**Consequences:**
- Cert shows extended expiry in reports
- System won't mark as expired until new date
- Original date preserved (audit trail)

### 5.2 Type 2: Proof Override (Evidence Replacement)

**Use case:** Employee lost certification; supervisor approves alternative evidence.

```
QualificationOverride {
  type: PROOF_OVERRIDE
  qualificationId
  employeeId
  previousProof: { documentId, url, timestamp }
  newProof: { documentId, url, timestamp }
  justification: "Original cert lost in office move; accepting employer records as proof"
  approvedBy: CO.id
  approvedAt: 2026-03-20
  expiresAt: NULL  // Permanent (unless time-limited override needed)
}

Audit log: "CO replaced proof for OSHA cert; old: doc_123, new: doc_456"
```

**Consequences:**
- Fulfillment updated to new proof
- Previous proof archived (audit trail)
- Employee gets confirmation email

### 5.3 Type 3: Requirement Waiver

**Use case:** Employee has medical exemption from physical exam; all other OSHA reqs met.

```
QualificationOverride {
  type: WAIVER
  qualificationId
  employeeId
  requirementId: "OSHA_physical_exam"
  justification: "Medical accommodation: chronic pain syndrome; physical exam not required per ADA"
  approvedBy: CO.id
  approvedAt: 2026-03-15
  expiresAt: NULL  // Permanent; may review annually
}

Audit log: "CO granted ADA waiver for OSHA physical exam"
```

**Consequences:**
- Requirement no longer required for this employee
- Qualification can complete without this req
- Manager notified; documented for ADA compliance

### 5.4 Type 4: Grace Period

**Use case:** New hire; allow 30 days to complete onboarding training before deadline.

```
QualificationOverride {
  type: GRACE_PERIOD
  qualificationId
  employeeId
  originalDueDate: 2026-04-15
  gracePeriodExpiresAt: 2026-05-15
  gracePeriodReason: "New hire onboarding; training scheduled for week of May 1"
  approvedBy: Manager.id
  approvedAt: 2026-04-01
  expiresAt: 2026-05-15  // Grace period itself expires
}

Audit log: "Manager granted 30-day grace period for onboarding training"
```

**Consequences:**
- Due date moved 30 days out
- System sends reminder on day 29 of grace period
- After grace expires, standard deadline applies

---

## 6. Exemption Lifecycle

### 6.1 Exemption Workflow (WAIVER Type)

```
1. PROPOSED → Manager or CO initiates
2. PENDING_REVIEW → Awaiting CO approval (may require committee in large orgs)
3. APPROVED → Exemption active
4. EXPIRED → Time-limited exemption passed
5. REVOKED → CO cancels exemption (e.g., accommodation no longer valid)
```

### 6.2 Exemption Review & Audit

**Annual review requirement:**
- Exemptions reviewed at least annually
- System generates "Exemption Review Due" task for CO
- Review updates expiresAt or revokes

**Audit captures:**
- Who granted exemption + approval date
- Original justification (e.g., ADA accommodation)
- Who reviewed + approval date
- Any changes to exemption terms
- Who revoked (if revoked) + reason

---

## 7. Strictest Wins Composition

### 7.1 Conflict Resolution

**Scenario:** Employee subject to multiple standards with conflicting requirements.

```
Standards applied:
1. OSHA 30 (regulatory): Classroom(L2), Cert(L3)
2. Facility-specific (org): Bloodborne Pathogens(L2)
3. Department override: Classroom(L3), Cert(L4)

Effective requirements:
- Classroom: max(L2, L3) = L3
- Cert: max(L3, L4) = L4
- Bloodborne Pathogens: L2

Final readiness: ALL of [Classroom(L3), Cert(L4), Bloodborne(L2)]
```

### 7.2 Implementation

**Requirement aggregation algorithm:**

```
def getEffectiveRequirements(employee, startDate):
  requirements = {}
  
  # Collect all standards applicable to employee at startDate
  for standard in getApplicableStandards(employee):
    for requirement in standard.requirements:
      key = requirement.name + requirement.type
      if key not in requirements:
        requirements[key] = { level: requirement.level, sources: [] }
      else:
        # Take strictest (highest level)
        requirements[key].level = max(level, requirement.level)
      requirements[key].sources.append(standard.id)
  
  # Apply dept-level overrides (narrowing)
  for override in getDepartmentOverrides(employee.departmentId):
    for req in override.requirements:
      key = req.name + req.type
      if key in requirements:
        requirements[key].level = max(requirements[key].level, override.level)
        requirements[key].sources.append(override.id)
  
  # Apply individual overrides (exemptions, extensions)
  for override in getIndividualOverrides(employee.id):
    if override.type == WAIVER:
      del requirements[override.requirementId]  # Remove from effective set
    elif override.type == GRACE_PERIOD:
      requirements[override.requirementId].dueDate = override.gracePeriodExpiresAt
  
  return requirements
```

---

## 8. Data Model Changes

```prisma
model ComplianceStandard {
  // MODIFIED: Add immutability flag
  id                String    @id @default(uuid())
  tenantId          String
  name              String
  description       String?
  issuedBy          String?   // OSHA, FDA, etc.
  version           String    // "2024.01"
  immutable         Boolean   @default(false) // true for regulatory baselines
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  requirements      StandardRequirement[]
  customizations    StandardCustomization[]
  
  @@index([tenantId])
  @@unique([tenantId, name, immutable])
}

model StandardRequirement {
  id                String    @id @default(uuid())
  standardId        String
  standard          ComplianceStandard @relation(fields: [standardId], references: [id], onDelete: Cascade)
  
  description       String
  type              String    // TRAINING, CERTIFICATION, ASSESSMENT, CLEARANCE, AUDIT, etc.
  minimumAttestationLevel String // L1, L2, L3, L4
  expiryMonths      Int?      // NULL if never expires
  isOptional        Boolean   @default(false)
  
  createdAt         DateTime  @default(now())
  
  // Relations
  customizations    StandardRequirementCustomization[]
  
  @@index([standardId])
}

// ============ CUSTOMIZATION LAYER ============

model StandardCustomization {
  // Org-level customization (adds to standard)
  id                String    @id @default(uuid())
  tenantId          String
  basedOnStandard   String
  standard          ComplianceStandard @relation(fields: [basedOnStandard], references: [id])
  
  name              String    // "OSHA 30 + Our Safety Policy"
  description       String?
  
  createdBy         String    // Profile ID
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  customRequirements StandardRequirementCustomization[]
  overrides         QualificationOverride[]
  
  @@index([tenantId])
  @@unique([tenantId, basedOnStandard])
}

model StandardRequirementCustomization {
  id                String    @id @default(uuid())
  customizationId   String
  customization     StandardCustomization @relation(fields: [customizationId], references: [id], onDelete: Cascade)
  
  basedOnRequirement String?   // NULL if new requirement
  requirement       StandardRequirement? @relation(fields: [basedOnRequirement], references: [id])
  
  description       String
  type              String
  minimumAttestationLevel String
  expiryMonths      Int?
  isOptional        Boolean   @default(false)
  
  // Track if this is added (new) or modified (base)
  isNewRequirement  Boolean   @default(false)
  
  @@index([customizationId])
}

model DepartmentOverride {
  id                String    @id @default(uuid())
  tenantId          String
  departmentId      String    // Department the override applies to
  basedOnStandard   String    // ComplianceStandard or StandardCustomization ID
  
  createdBy         String    // Manager+
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations (requirement-specific overrides)
  requirementMods   DepartmentRequirementOverride[]
  
  @@index([tenantId, departmentId])
  @@unique([tenantId, departmentId, basedOnStandard])
}

model DepartmentRequirementOverride {
  id                String    @id @default(uuid())
  deptOverrideId    String
  deptOverride      DepartmentOverride @relation(fields: [deptOverrideId], references: [id], onDelete: Cascade)
  
  requirementId     String    // StandardRequirement ID
  newAttestationLevel String? // NULL if removed/optional
  isRemoved         Boolean   @default(false)  // Requirement removed at dept level
  
  @@index([deptOverrideId])
  @@unique([deptOverrideId, requirementId])
}

// ============ INDIVIDUAL OVERRIDES ============

model QualificationOverride {
  id                String    @id @default(uuid())
  tenantId          String
  qualificationId   String
  qualification     Qualification @relation(fields: [qualificationId], references: [id], onDelete: Cascade)
  
  employeeId        String
  
  overrideType      String    // EXPIRY_EXTENSION, PROOF_OVERRIDE, WAIVER, GRACE_PERIOD
  justification     String    @db.Text
  
  // Type-specific fields
  newExpiryDate     DateTime?           // For EXPIRY_EXTENSION
  newProofId        String?             // For PROOF_OVERRIDE (Document)
  oldProofId        String?             // For PROOF_OVERRIDE (archived)
  requirementId     String?             // For WAIVER (StandardRequirement)
  gracePeriodDays   Int?                // For GRACE_PERIOD
  originalDueDate   DateTime?           // For GRACE_PERIOD
  
  approvedBy        String              // Profile ID (CO+)
  approvedAt        DateTime
  
  expiresAt         DateTime?           // Override itself expires (except permanent waivers)
  revokedBy         String?             // Profile ID (if revoked)
  revokedAt         DateTime?
  revocationReason  String?
  
  createdAt         DateTime  @default(now())
  
  @@index([qualificationId])
  @@index([employeeId])
  @@index([tenantId])
}

model Qualification {
  // MODIFIED: Link to standards + customizations
  id                String    @id @default(uuid())
  tenantId          String
  employeeId        String
  
  standardId        String    // ComplianceStandard or StandardCustomization ID
  
  status            String    // ASSIGNED, IN_PROGRESS, COMPLETED, EXPIRED, REVOKED
  attestationLevel  String    // L1, L2, L3, L4 (actual achieved)
  
  assignedAt        DateTime
  completedAt       DateTime?
  expiresAt         DateTime?
  
  // Relations
  proofs            ProofFulfillment[]
  overrides         QualificationOverride[]
  
  @@index([tenantId, employeeId, status])
  @@index([standardId])
}
```

---

## 9. API Contracts

### 9.1 Standard Routes (Read-Only for Regulatory)

```
GET /api/v1/reference/standards
  Response: { standards: [...] }

GET /api/v1/reference/standards/:id
  Response: { id, name, immutable, requirements: [...], version, ... }

POST /api/v1/reference/standards
  Requires: ADMIN
  Creates new tenant-specific standard (immutable: false)
  Body: { name, description, basedOnStandard? }
  Response: { id, name, immutable: false, ... }
```

### 9.2 Customization Routes

```
POST /api/v1/reference/standards/:id/customize
  Requires: ADMIN role
  Creates org-level customization (copy + extend)
  Body: { name, description }
  Response: { customizationId, customRequirements: [...] }

POST /api/v1/reference/customizations/:custId/requirements
  Requires: ADMIN role
  Adds custom requirement
  Body: { description, type, level, expiryMonths? }
  Response: { requirementId, ... }

PATCH /api/v1/reference/customizations/:custId/requirements/:reqId
  Requires: ADMIN role
  Modifies custom requirement (only)
  Body: { description?, type?, level?, expiryMonths? }
  Cannot modify regulatory requirements
  Response: { requirementId, ... }

DELETE /api/v1/reference/customizations/:custId/requirements/:reqId
  Requires: ADMIN role
  Removes custom requirement (not regulatory)
  Response: { ok: true }
```

### 9.3 Department Override Routes

```
POST /api/v1/reference/standards/:id/department-override
  Requires: MANAGER+ role
  Body: { departmentId, requirementMods: [{ reqId, newLevel?, remove? }] }
  Validates: Cannot weaken below org level
  Response: { overrideId, requirementMods: [...] }

PATCH /api/v1/reference/department-overrides/:id
  Requires: MANAGER+ role
  Updates override
  Body: { requirementMods: [...] }
  Response: { id, ... }

DELETE /api/v1/reference/department-overrides/:id
  Requires: MANAGER+ role
  Response: { ok: true }
```

### 9.4 Individual Override Routes

```
POST /api/v1/compliance/qualifications/:id/overrides
  Requires: CO+ role
  Body: {
    type: "EXPIRY_EXTENSION" | "PROOF_OVERRIDE" | "WAIVER" | "GRACE_PERIOD",
    justification,
    newExpiryDate?, // For EXPIRY_EXTENSION
    newProofId?,    // For PROOF_OVERRIDE
    requirementId?, // For WAIVER
    gracePeriodDays? // For GRACE_PERIOD
  }
  Response: { overrideId, type, approvedAt, expiresAt, ... }

GET /api/v1/compliance/qualifications/:id/overrides
  Response: { overrides: [...] }

PATCH /api/v1/compliance/qualifications/:id/overrides/:overrideId
  Requires: CO+ role
  Only updates expiry date / revocation
  Body: { expiresAt?, revoke: boolean, revocationReason? }
  Response: { overrideId, ... }

DELETE /api/v1/compliance/qualifications/:id/overrides/:overrideId
  Requires: CO+ role (revokes override)
  Response: { ok: true }
```

### 9.5 Qualification Routes (Enhanced)

```
GET /api/v1/compliance/qualifications
  Query: { standardId?, customizationId?, status? }
  Response: { qualifications: [...], effectiveRequirements: [...] }

GET /api/v1/compliance/qualifications/:id
  Response: {
    id, standardId, employeeId, status,
    effectiveRequirements: [...],
    proofs: [...],
    overrides: [...],
    readiness: { status, missingProofs: [...], expiringIn: days }
  }

POST /api/v1/compliance/qualifications/:id/review
  Requires: SUPERVISOR+ role
  Calculates effective requirements + readiness
  Response: { status, missingProofs, strictestRequirements: [...] }
```

---

## 10. External Third-Party Invite Flow

### 10.1 L3 Attestation (Third-Party Assessor)

**Scenario:** Employee needs OSHA cert validated by external body; invite them.

```
1. Manager creates Qualification with L3 required
2. Employee submits L1 evidence; insufficient
3. Employee clicks "Invite External Assessor"
4. System generates invite link: /invite/assessment?token={token}
5. Email sent to assessor@certbody.com
6. Assessor logs in (optional password), reviews evidence
7. Assessor submits: { status: APPROVED, evidence: "Certificate XYZ123", timestamp: now() }
8. System records: Proof(attestationLevel: L3, validatedAt, assessor: assessor_profile)
9. Qualification marked: L3 achieved ✓
```

**API:**

```
POST /api/v1/compliance/qualifications/:id/invite-assessor
  Requires: EMPLOYEE (self) or SUPERVISOR (team)
  Body: { assessorEmail, proofType: "CERTIFICATION" | "VALIDATION" }
  Response: { token, expiresAt, inviteUrl }
  Side effect: Email sent to assessor

POST /api/v1/compliance/assessments/:token/submit
  (Unauthenticated, token-based)
  Body: { approved: boolean, evidence: { type, url, comment } }
  Response: { status, proofId, ... }
```

---

## 11. Security Considerations

### 11.1 Immutability of Regulatory Standards

- Regulatory standards (immutable: true) are read-only to all users
- Changes to standards always create a new version (never in-place modification)
- Audit trail captures who created baseline + when

### 11.2 Override Justification & Approval Chain

- **All overrides require:**
  - Clear justification (free text or structured)
  - Approval by CO+ (recorded + timestamped)
  - Audit log entry
  - Expiry (except permanent waivers)

- **Override approval chain:**
  - Manager proposes → CO approves (future: add approval workflow stage)
  - CO can unilaterally approve/revoke

### 11.3 Strictest Wins Audit

- Requirement calculation logged (which standard → which requirement → final level)
- If conflict detected, log indicates it
- Manager cannot override system-calculated strictest level (must use explicit override)

---

## 12. Phased Rollout Plan

### 12.1 Sprint 6 (1 week): Schema + Customization
- [x] Add immutability flag to ComplianceStandard
- [x] Create StandardCustomization + StandardRequirementCustomization
- [x] Create DepartmentOverride model
- **Deliverable:** Schema ready; no API changes

### 12.2 Sprint 7 (2 weeks): Customization Routes + Overrides
- [x] Implement customization CRUD routes (org-level adds)
- [x] Implement department override routes (narrowing)
- [x] Implement individual override routes (EXPIRY_EXTENSION, WAIVER, etc.)
- [x] Implement "strictest wins" requirement aggregation
- **Deliverable:** All override types tested; customization working

### 12.3 Sprint 8 (1 week): Effective Requirements + Readiness
- [x] Implement getEffectiveRequirements() algorithm
- [x] Implement qualification readiness calculation
- [x] Add third-party invite flow (L3 attestation)
- **Deliverable:** Qualification engine production-ready

### 12.4 Sprint 9+: Testing + Exemption Workflows
- [ ] 50+ tests for override scenarios
- [ ] Exemption annual review workflow
- [ ] Performance optimization (large customization sets)

---

## 13. Locked Decisions

### 13.1 Decision #4: Lock Regulatory / Flex Custom
- **Relevance:** Immutable regulatory standards; org/dept/individual can customize.
- **Implementation:** ComplianceStandard.immutable flag; StandardCustomization model for org-level adds.

### 13.2 Decision #6: Full Overrides
- **Relevance:** 4 override types (EXPIRY_EXTENSION, PROOF_OVERRIDE, WAIVER, GRACE_PERIOD) with justification + approval.
- **Implementation:** QualificationOverride.overrideType enum; all require CO+ approval + audit log.

### 13.3 Decision #5: L1-L4 Attestation
- **Relevance:** Qualification flow validates attestation level progression; strictest wins across standards.
- **Implementation:** Attestation level aggregation; requirement validation on proof submission.

### 13.4 Decision #7: Catalog + Inheritance
- **Relevance:** DepartmentOverride implements inheritance (narrowing); org customization adds to baseline.
- **Implementation:** DepartmentOverride references parent standard + child overrides; no weakening allowed.

---

## Next Steps

1. **Sprint 6:** Implement customization schema
2. **Sprint 7:** Implement override routes + aggregation algorithm
3. **Sprint 8:** Implement effective requirements + readiness
4. **Sprint 9+:** Testing + exemption workflows

**Completion Target:** v0.5.0 (qualification engine production-ready; supports regulatory immutability + org/dept/individual customization)
