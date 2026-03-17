# Template Management Strategy Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api/src/modules/templates`, `data/prisma`  
> **Issue:** #97 (Template-01)  
> **Related Docs:** `docs/specs/templates-attestation-spec.md`, `docs/specs/proof-taxonomy.md`, `docs/specs/qualification-engine.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Template Lifecycle](#2-template-lifecycle)
3. [Industry Catalog Model](#3-industry-catalog-model)
4. [Template Versioning & Assignment](#4-template-versioning--assignment)
5. [Group-Based Assignment (Catalog + Inheritance)](#5-group-based-assignment-catalog--inheritance)
6. [L1-L4 Attestation Integration](#6-l1-l4-attestation-integration)
7. [Data Model Changes](#7-data-model-changes)
8. [API Contracts](#8-api-contracts)
9. [Security Considerations](#9-security-considerations)
10. [Extensibility (Marketplace & AI)](#10-extensibility-marketplace--ai)
11. [Phased Rollout Plan](#11-phased-rollout-plan)
12. [Locked Decisions](#12-locked-decisions)

---

## 1. Problem Statement

Templates are reusable proof-of-compliance packages (e.g., "Safety Certification for Warehouse Staff"). Current spec defines 25 endpoints; gaps prevent production use:

1. **No catalog sourcing:** Templates created ad-hoc in each tenant; no industry profiles or OOTB templates
2. **No lifecycle state machine:** Draft→Review→Published→Deprecated→Archived not explicitly modeled
3. **No attestation integration:** Templates define L1-L4 requirements but assignment/fulfillment don't validate levels
4. **No group assignment:** Template assignments are employee-specific; no bulk group-based assignment
5. **No versioning:** Template updates break existing fulfillments (should track v1, v2, etc.)

**Objective:** Model industry-sourced template catalog with lifecycle, versioning, group-based assignment, and L1-L4 validation. Enable future extensibility to marketplace + AI recommendation.

---

## 2. Template Lifecycle

### 2.1 State Machine

```
DRAFT ──(review)──> UNDER_REVIEW ──(approve)──> PUBLISHED
                         │
                         └─(reject)──> DRAFT
                         
PUBLISHED ──(deprecate)──> DEPRECATED ──(archive)──> ARCHIVED

DRAFT, UNDER_REVIEW, PUBLISHED, DEPRECATED ──(delete)──> (removed if no fulfillments)
```

### 2.2 State Semantics

| State | Allows Creation | Allows Assignment | Allows Fulfillment | Meaning |
|-------|:---------------:|:----------------:|:------------------:|---------|
| **DRAFT** | Editable | No | No | Work in progress; not yet ready for use |
| **UNDER_REVIEW** | Read-only | No | No | Submitted for compliance officer review |
| **PUBLISHED** | Read-only | Yes | Yes | Active; employees can fulfill |
| **DEPRECATED** | Read-only | No (existing assignments remain active) | Yes | Superseded; no new assignments, but active ones continue |
| **ARCHIVED** | Read-only | No | No | Obsolete; kept for audit trail only |

### 2.3 Transitions & Rules

- **DRAFT → UNDER_REVIEW:** Submitter role ≥ MANAGER (or owner)
- **UNDER_REVIEW → PUBLISHED:** Role = CO+ (compliance officer or admin)
- **UNDER_REVIEW → DRAFT:** Reopen for changes (CO+ or original author)
- **PUBLISHED → DEPRECATED:** Mark superseded (CO+)
- **DEPRECATED → ARCHIVED:** Remove from active use after retention period (ADMIN)
- **DELETE:** Only if DRAFT and zero fulfillments

---

## 3. Industry Catalog Model

### 3.1 Catalog Sourcing

**Tiered template sourcing:**

1. **E-CLAT Standard Catalog** (built-in)
   - Pre-built templates for common industries (manufacturing, healthcare, finance)
   - Maintained by E-CLAT team
   - Auto-seeded on tenant creation
   - Examples: "OSHA 30 Safety Certification", "Healthcare HIPAA Training", "Finance SOC 2 Compliance"

2. **Industry Profile** (per tenant)
   - Tenant selects primary industry (e.g., "Manufacturing")
   - Auto-assigned templates from catalog to default groups
   - Example: Manufacturing tenant gets all OSHA, safety, machinery templates

3. **Tenant-Specific Customization** (extends catalog)
   - Tenant admin creates custom templates beyond catalog
   - Example: "Our Company's IT Security Policy Attestation"

4. **Future: Marketplace** (Phase 2+)
   - Share templates across tenants
   - Templates as first-class products
   - Versioning + reviews

5. **Future: AI Recommendation** (Phase 3+)
   - "Based on your industry + regulations, we recommend these templates"
   - ML model suggests gaps in coverage

### 3.2 Catalog Model

```
IndustryProfile
├── id: UUID
├── name: "Manufacturing"
├── description: "OSHA + machinery safety"
├── templates: [ ProofTemplate... ]  // Auto-seeded
└── tenants: [ Tenant... ]           // Many-to-many: tenant picks industry
```

---

## 4. Template Versioning & Assignment

### 4.1 Versioning Strategy

**Each template is a versioned series:**

```
ProofTemplate (v1)
├── id: uuid-1
├── tenantId
├── name: "OSHA 30 Certification"
├── version: 1
├── status: PUBLISHED
├── requirements: [R1, R2, R3]
└── createdAt: 2026-01-01

ProofTemplate (v2) — newer version
├── id: uuid-2
├── tenantId
├── name: "OSHA 30 Certification"
├── version: 2
├── status: PUBLISHED
├── requirements: [R1, R2, R3, R4]  // Added R4
└── createdAt: 2026-03-15
├── supersedes: uuid-1 (previous version)
```

**Active assignments:**
- Existing assignments stay on v1 until completion
- New assignments created after v2 use v2
- Manager can "upgrade" in-progress assignment: v1 → v2 (audited)

### 4.2 Requirement Versioning

Each requirement linked to specific template version:

```
ProofRequirement
├── id
├── templateId  // Points to specific version
├── templateVersion: 1
├── proofType: "certification"
├── minimumAttestationLevel: "L3" (third-party)
├── description
```

If template updated (v1 → v2):
- Old requirements keep templateVersion: 1
- New requirements get templateVersion: 2
- Fulfillments reference specific requirement ID (immutable)

---

## 5. Group-Based Assignment (Catalog + Inheritance)

### 5.1 Group Model

```
EmployeeGroup
├── id: UUID
├── tenantId
├── name: "Warehouse Staff"
├── parentGroupId (optional, for hierarchy)
├── members: [ Employee... ]  // Many-to-many: employee → group
└── assignments: [ TemplateAssignment... ]
```

### 5.2 Auto-Assignment via Catalog

**Scenario:** Tenant selects Manufacturing industry profile.

```
1. Tenant created; industry = Manufacturing
2. System calls: AssignTemplatesForIndustry(tenantId, "Manufacturing")
3. Get all templates tagged "manufacturing": [OSHA, Machinery, Safety]
4. For each template:
   - Create auto-assignment: TemplateAssignment(
       templateId: osha_id,
       type: "GROUP",
       groupId: "default_warehouse_staff",
       source: "INDUSTRY_PROFILE"
     )
5. All employees in "Warehouse Staff" group automatically assigned OSHA template
```

### 5.3 Group Inheritance

**Parent-child groups inherit parent assignments:**

```
Engineering (parent)
├── Frontend Team (child)
├── Backend Team (child)

Templates assigned to "Engineering" auto-flow to Frontend + Backend teams
```

**Conflict resolution:**
- Child group explicit assignment overrides parent
- Explicit deassignment removes inherited assignment
- Audit trail tracks all flows

---

## 6. L1-L4 Attestation Integration

### 6.1 Template-Level Attestation Requirement

Each requirement specifies minimum attestation level:

```
ProofTemplate: "OSHA 30 Certification"
├── ProofRequirement[1]:
│   ├── name: "Classroom Training"
│   ├── minimumAttestationLevel: "L2" (supervisor attestation)
│
├── ProofRequirement[2]:
│   ├── name: "Certificate of Completion"
│   └── minimumAttestationLevel: "L3" (third-party issuer)
│
└── ProofRequirement[3]:
    ├── name: "Practical Exam"
    └── minimumAttestationLevel: "L1" (self-attest is OK)
```

**Levels:**
- **L1 (Self-Attest):** Employee uploads evidence; no review needed
- **L2 (Supervisor):** Supervisor reviews + confirms
- **L3 (Third-Party):** Issuer (e.g., certification body) confirms
- **L4 (Validated):** Compliance Officer performs final audit

### 6.2 Fulfillment Validation

When employee fulfills requirement:

```
1. ProofFulfillment created for Requirement[2] (min: L3)
2. Employee uploads: L1 (self-attest only)
3. System check: L1 < L3 (minimum not met) → ERROR
   "This requirement needs L3 (third-party) attestation. 
    You provided L1 (self-attest). Invite issuer or upload L3 evidence."

4. If employee invites third-party + gets approval → L3 ✓
5. If supervisor upgrades after review → L2 ✓ (still < L3)
6. If CO validates → L4 ✓ (meets/exceeds L3)
```

### 6.3 Template Readiness Calculation

**Overall template readiness = MIN(requirement fulfillment levels)**

```
Template: OSHA 30
├── Req 1: L3 required, L3 provided ✓
├── Req 2: L2 required, L1 provided ❌ (BLOCKING)
└── Req 3: L1 required, L1 provided ✓

Overall readiness: INCOMPLETE (waiting for Req 2 L2 upgrade)
Recommended action: "Supervisor review to upgrade Req 2 to L2"
```

---

## 7. Data Model Changes

### 7.1 New & Modified Models

```prisma
model ProofTemplate {
  id                String    @id @default(uuid())
  tenantId          String
  name              String
  description       String?
  version           Int       @default(1)
  status            String    // DRAFT, UNDER_REVIEW, PUBLISHED, DEPRECATED, ARCHIVED
  
  supersedes        String?   // Previous version template ID
  catalogSource     String?   // BUILTIN, MARKETPLACE, CUSTOM
  industryProfile   String?   // Industry this is tagged for
  
  // L1-L4 configuration
  minimumAttestationLevel String? // L1, L2, L3, L4 (default: varies per requirement)
  
  createdBy         String    // Profile ID
  reviewedBy        String?   // Profile ID (if CO reviewed)
  reviewedAt        DateTime?
  publishedAt       DateTime?
  deprecatedAt      DateTime?
  archivedAt        DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  requirements      ProofRequirement[]
  assignments       TemplateAssignment[]
  groupAssignments  GroupTemplateAssignment[]
  
  @@index([tenantId, status])
  @@index([tenantId, catalogSource])
  @@unique([tenantId, name, version])
}

model ProofRequirement {
  id                String    @id @default(uuid())
  templateId        String
  template          ProofTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  templateVersion   Int       // Immutable copy of template version
  
  proofType         String    // hours, certification, training, clearance, assessment, compliance
  description       String
  minimumAttestationLevel String // L1, L2, L3, L4
  
  // Optional constraints
  expiryMonths      Int?      // If null, never expires
  quantitative      Boolean?  // True if needs numeric value (e.g., hours)
  quantitativeValue Int?      // Expected value (e.g., 40 hours)
  
  ordinal           Int       // Display order in template
  createdAt         DateTime  @default(now())
  
  // Relations
  fulfillments      ProofFulfillment[]
  
  @@index([templateId])
}

model TemplateAssignment {
  id                String    @id @default(uuid())
  templateId        String
  template          ProofTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  // Target: either individual employee or group
  assignmentType    String    // EMPLOYEE, GROUP
  employeeId        String?   // NULL if groupId set
  groupId           String?   // NULL if employeeId set
  
  source            String    // MANUAL, INDUSTRY_PROFILE, SCIM, AI_RECOMMENDATION
  
  // Lifecycle
  assignedBy        String    // Profile ID (ADMIN/CO)
  assignedAt        DateTime
  dueDate           DateTime?
  status            String    // PENDING, IN_PROGRESS, SUBMITTED, COMPLETED, OVERDUE
  completedAt       DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  fulfillments      ProofFulfillment[]
  
  @@index([templateId])
  @@index([employeeId])
  @@index([groupId])
  @@unique([templateId, employeeId]) // No duplicate individual assignments
}

model GroupTemplateAssignment {
  id                String    @id @default(uuid())
  templateId        String
  template          ProofTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  groupId           String
  // group: EmployeeGroup (no FK; part of existing model)
  
  source            String    // INDUSTRY_PROFILE, MANUAL, CATALOG
  inheritedFromGroup String? // If assigned via parent group
  
  createdBy         String    // Profile ID
  createdAt         DateTime  @default(now())
  
  @@unique([templateId, groupId])
  @@index([templateId])
  @@index([groupId])
}

model ProofFulfillment {
  id                String    @id @default(uuid())
  assignmentId      String
  assignment        TemplateAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  
  requirementId     String
  requirement       ProofRequirement @relation(fields: [requirementId], references: [id])
  
  status            String    // ASSIGNED, IN_PROGRESS, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
  attestationLevel  String    // L1, L2, L3, L4 (actual level submitted)
  
  // Evidence
  evidenceType      String?   // certificate, upload, third_party_url, validated
  evidenceUrl       String?   // Link to document/certificate
  submittedAt       DateTime?
  
  // Review
  reviewedBy        String?   // Profile ID (if L2+ required)
  reviewedAt        DateTime?
  reviewComment     String?
  
  validatedBy       String?   // Profile ID (if L4 required)
  validatedAt       DateTime?
  
  expiresAt         DateTime? // If requirement.expiryMonths set
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([assignmentId])
  @@index([requirementId])
  @@index([status])
}

model EmployeeGroup {
  // NEW TABLE
  id                String    @id @default(uuid())
  tenantId          String
  name              String
  description       String?
  
  parentGroupId     String?   // Self-reference for hierarchy
  
  createdBy         String    // Profile ID
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  members           GroupMembership[]
  assignments       GroupTemplateAssignment[]
  
  @@unique([tenantId, name])
  @@index([tenantId])
}

model GroupMembership {
  id                String    @id @default(uuid())
  groupId           String
  group             EmployeeGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  employeeId        String
  // employee: Employee (no explicit FK; logical reference)
  
  addedAt           DateTime
  addedBy           String    // Profile ID
  
  @@unique([groupId, employeeId])
  @@index([groupId])
  @@index([employeeId])
}

model IndustryProfile {
  // NEW TABLE
  id                String    @id @default(uuid())
  name              String    @unique // "Manufacturing", "Healthcare", "Finance"
  description       String?
  
  // Template seeding: which templates to auto-assign
  defaultTemplates  String[]  @db.Text // JSON array of template IDs
  defaultGroups     String[]  @db.Text // JSON array of group names to create
  
  createdAt         DateTime  @default(now())
}
```

---

## 8. API Contracts

### 8.1 Template Lifecycle Routes

```
POST /api/v1/compliance/templates
  Requires: CO+ role
  Body: { name, description, minimumAttestationLevel? }
  Response: { id, version: 1, status: DRAFT, ... }

GET /api/v1/compliance/templates
  Query: { status?, industryProfile?, catalogOnly? }
  Response: { templates: [...] }

GET /api/v1/compliance/templates/:id
  Response: { id, name, status, version, requirements: [...], ... }

PATCH /api/v1/compliance/templates/:id
  Requires: CO+, status = DRAFT
  Body: { name?, description?, minimumAttestationLevel? }
  Response: { id, status: DRAFT, ... }

POST /api/v1/compliance/templates/:id/submit-review
  Requires: MANAGER+
  Response: { id, status: UNDER_REVIEW, ... }

PATCH /api/v1/compliance/templates/:id/approve
  Requires: CO+, status = UNDER_REVIEW
  Response: { id, status: PUBLISHED, publishedAt, ... }

PATCH /api/v1/compliance/templates/:id/reject
  Requires: CO+, status = UNDER_REVIEW
  Body: { reason }
  Response: { id, status: DRAFT, ... }

PATCH /api/v1/compliance/templates/:id/deprecate
  Requires: CO+, status = PUBLISHED
  Response: { id, status: DEPRECATED, deprecatedAt, ... }

PATCH /api/v1/compliance/templates/:id/archive
  Requires: ADMIN, status = DEPRECATED
  Response: { id, status: ARCHIVED, archivedAt, ... }

DELETE /api/v1/compliance/templates/:id
  Requires: CO+, status = DRAFT, zero fulfillments
  Response: { ok: true }
```

### 8.2 Requirement Routes

```
POST /api/v1/compliance/templates/:id/requirements
  Requires: CO+, template.status = DRAFT
  Body: { proofType, description, minimumAttestationLevel, expiryMonths?, quantitative? }
  Response: { id, templateId, templateVersion, ... }

GET /api/v1/compliance/templates/:id/requirements
  Response: { requirements: [...] }

PATCH /api/v1/compliance/templates/:id/requirements/:reqId
  Requires: CO+, template.status = DRAFT
  Body: { description?, minimumAttestationLevel?, ... }
  Response: { id, ... }

DELETE /api/v1/compliance/templates/:id/requirements/:reqId
  Requires: CO+, template.status = DRAFT, zero fulfillments
  Response: { ok: true }
```

### 8.3 Assignment Routes (Individual)

```
POST /api/v1/compliance/assignments
  Requires: CO+ role
  Body: { templateId, employeeId, dueDate? }
  Response: { id, templateId, employeeId, status: PENDING, ... }

GET /api/v1/compliance/assignments
  Query: { templateId?, employeeId?, status? }
  Response: { assignments: [...] }

GET /api/v1/compliance/assignments/:id
  Response: { id, templateId, employeeId, fulfillments: [...], readiness: { ... } }

PATCH /api/v1/compliance/assignments/:id
  Requires: CO+
  Body: { dueDate? }
  Response: { id, ... }

DELETE /api/v1/compliance/assignments/:id
  Requires: CO+, status = PENDING
  Response: { ok: true }
```

### 8.4 Group Assignment Routes

```
POST /api/v1/compliance/groups
  Requires: ADMIN role
  Body: { name, description?, parentGroupId? }
  Response: { id, name, ... }

GET /api/v1/compliance/groups
  Response: { groups: [...] }

POST /api/v1/compliance/groups/:id/members
  Requires: ADMIN
  Body: { employeeIds: [...]  }
  Response: { groupId, membersAdded: ... }

POST /api/v1/compliance/groups/:id/templates
  Requires: CO+
  Body: { templateId, source: "MANUAL" | "INDUSTRY_PROFILE" }
  Side effect: Auto-assigns to all group members
  Response: { groupId, templateId, assignmentsCreated: ... }

GET /api/v1/compliance/groups/:id/templates
  Response: { templates: [...] }

DELETE /api/v1/compliance/groups/:id/templates/:templateId
  Requires: CO+
  Side effect: Unassigns from all group members
  Response: { ok: true, assignmentsRemoved: ... }
```

### 8.5 Fulfillment Routes

```
POST /api/v1/compliance/fulfillments
  Requires: EMPLOYEE+
  Body: { assignmentId, requirementId, attestationLevel, evidenceType, evidenceUrl? }
  Validates: attestationLevel ≥ requirement.minimumAttestationLevel
  Response: { id, status: IN_PROGRESS, attestationLevel, ... }

PATCH /api/v1/compliance/fulfillments/:id/submit
  Requires: EMPLOYEE
  Body: { evidenceUrl?, comment? }
  Response: { id, status: SUBMITTED, submittedAt, ... }

PATCH /api/v1/compliance/fulfillments/:id/review
  Requires: SUPERVISOR+
  Body: { approved: boolean, comment? }
  If approved && level = L2: status = APPROVED
  If approved && level = L3: mark for L3 validation
  Response: { id, status, ... }

PATCH /api/v1/compliance/fulfillments/:id/validate
  Requires: CO+
  Body: { approved: boolean, comment? }
  Response: { id, status: APPROVED | REJECTED, validatedAt, ... }

GET /api/v1/compliance/fulfillments
  Query: { assignmentId?, status?, ... }
  Response: { fulfillments: [...] }
```

---

## 9. Security Considerations

### 9.1 Template Authorization

- **DRAFT:** Only creator + ADMIN can view/edit
- **UNDER_REVIEW:** Creator + ADMIN + CO can view (CO can approve/reject)
- **PUBLISHED:** All authenticated can view; only CO can deprecate
- **DEPRECATED/ARCHIVED:** Read-only for audit trail

### 9.2 Assignment Authorization

- **Create:** CO+ only
- **View:** Employee (own), SUPERVISOR (team), CO (all)
- **Modify:** Original assigner (CO) or ADMIN
- **Delete:** Only if PENDING

### 9.3 Fulfillment Authorization

- **Create:** Employee (own assignment)
- **Submit:** Employee (own)
- **Review:** SUPERVISOR (team), CO (all)
- **Validate:** CO+ only

### 9.4 Industry Profile Seeding

- **Builtin templates:** Read-only; tenants inherit but cannot modify source
- **Copies:** Tenant can create custom v2+ versions (preserves v1 as baseline)

---

## 10. Extensibility (Marketplace & AI)

### 10.1 Marketplace Phase 2+

**Future: Templates as products**
- Templates published to marketplace by creators
- Other tenants can discover, review, purchase (free or paid)
- Versioning + reviews (like npm registry)

**Schema readiness:**
```
ProofTemplate.catalogSource = "MARKETPLACE"
ProofTemplate.sourceOrganization = "TrustSafe Inc"  // Add field for marketplace
```

### 10.2 AI Recommendation Phase 3+

**Future: ML-suggested templates**
- "Based on your industry + regulations, you're missing..."
- Recommend templates from catalog + marketplace
- Auto-suggest assignments for groups

**Schema readiness:**
```
TemplateAssignment.source = "AI_RECOMMENDATION"
GroupTemplateAssignment.source = "AI_RECOMMENDATION"
```

---

## 11. Phased Rollout Plan

### 11.1 Sprint 6 (2 weeks): Core Lifecycle + Versioning
- [x] ProofTemplate + ProofRequirement lifecycle (DRAFT → PUBLISHED → DEPRECATED)
- [x] Version tracking (v1 → v2)
- [x] Requirement validators (minimumAttestationLevel)
- **Deliverable:** Template CRUD + state transitions working

### 11.2 Sprint 7 (2 weeks): Group Assignment + Catalog
- [x] EmployeeGroup + GroupMembership models
- [x] GroupTemplateAssignment (auto-flow via inheritance)
- [x] IndustryProfile seeding (builtin templates)
- [x] Group-based assignment routes
- **Deliverable:** Group assignment + industry profiles working

### 11.3 Sprint 8 (1 week): Fulfillment + Readiness
- [x] ProofFulfillment L1-L4 validation
- [x] Fulfillment status machine (ASSIGNED → SUBMITTED → APPROVED)
- [x] Template readiness calculation (MIN of requirement fulfillments)
- **Deliverable:** Full template fulfillment flow tested

### 11.4 Sprint 9+ (Ongoing)
- [ ] Marketplace schema extensions (Phase 2+)
- [ ] AI recommendation placeholders (Phase 3+)
- [ ] Performance optimization (bulk group assignments)

---

## 12. Locked Decisions

### 12.1 Decision #5: L1-L4 Attestation
- **Relevance:** Templates define minimum attestation level per requirement; fulfillment validates progression.
- **Implementation:** ProofRequirement.minimumAttestationLevel; ProofFulfillment.attestationLevel comparison.

### 12.2 Decision #7: Catalog + Inheritance
- **Relevance:** Industry profiles auto-seed templates; group assignments cascade to children.
- **Implementation:** IndustryProfile → GroupTemplateAssignment with source tracking.

### 12.3 Decision #6: Full Overrides
- **Relevance:** Template deprecation + version upgrades allow grace periods + audit trails.
- **Implementation:** deprecatedAt, version tracking, assignment upgrade audit log.

### 12.4 Decision #1: Tiered Isolation
- **Relevance:** Tenants inherit builtin catalog; custom templates stay within tenant.
- **Implementation:** catalogSource = BUILTIN (read-only across tenants) vs CUSTOM (tenant-scoped).

---

## Next Steps

1. **Sprint 6:** Implement template lifecycle + versioning
2. **Sprint 7:** Implement group assignment + industry profiles
3. **Sprint 8:** Implement fulfillment + readiness calculation
4. **Sprint 9+:** Performance + marketplace/AI extensibility

**Completion Target:** v0.5.0 (template management production-ready; v0.6.0+ adds marketplace + AI)
