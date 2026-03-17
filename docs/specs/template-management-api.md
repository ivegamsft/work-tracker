# Template Management API — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #98  
> **Applies To:** `apps/api/src/modules/templates`, `apps/web` (template UI), `data/prisma/schema.prisma`  
> **Related Decisions:** Decision 5 (L1-L4 attestation), Decision 7 (Catalog + inheritance), Decision 4 (Lock regulatory/flex custom)  
> **Companion Docs:** [Templates Attestation Spec](./templates-attestation-spec.md) · [Proof Taxonomy](./proof-taxonomy.md) · [RBAC API Spec](./rbac-api-spec.md)

---

## 1. Problem Statement

Template management is currently reactive (endpoints exist but lack authoring workflow):

1. **No publish lifecycle** — Templates created in draft state, but no approval/publish mechanism
2. **No versioning** — Cannot track who changed what; no rollback
3. **No catalog integration** — Industry templates (OSHA, HIPAA) not reusable across customers
4. **No assignment engine** — Bulk assignment only; cannot assign by rule (hire date, role change, expiry)
5. **No audit trail for authoring** — Cannot prove template was reviewed by compliance officer
6. **No inheritance** — Custom templates cannot extend industry templates

**Impact:** Compliance teams cannot audit template lineage; bulk assignments miss rule-based cases; custom templates duplicate work.

---

## 2. Solution Overview

Implement **complete template lifecycle management**:

- **Authoring RBAC** — Role matrix: who can create/edit/publish/archive
- **Publish workflow** — Draft → Submitted for Review → Published/Rejected → Archived
- **Versioning** — Every publish creates immutable version; can revert
- **Industry catalog** — Curated templates (OSHA, HIPAA, etc.) inherited and customized
- **Assignment engine** — Individual, group, role-based, rule-based, bulk
- **Auto-assignment triggers** — Hire, role-change, expiry, custom date
- **Template import/export** — Share across tenants (with scrubbing of sensitive data)

---

## 3. API Endpoints

### 3.1 Template CRUD

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/compliance/templates` | GET | List templates (filters: status, category, tenant) |
| `POST /api/v1/compliance/templates` | POST | Create template (draft) |
| `GET /api/v1/compliance/templates/:templateId` | GET | Get template with requirements |
| `PUT /api/v1/compliance/templates/:templateId` | PUT | Update template (draft only) |
| `DELETE /api/v1/compliance/templates/:templateId` | DELETE | Soft-delete template |

#### Request/Response Schemas

**`POST /api/v1/compliance/templates` (Create Template)**

```json
{
  "name": "OSHA 10-Hour Onboarding",
  "description": "Construction site safety requirements",
  "category": "onboarding",
  "proof_requirements": [
    {
      "name": "OSHA 10-Hour Card",
      "description": "Official OSHA training certificate",
      "proof_type": "certification",
      "attestation_levels": ["upload"],
      "is_required": true,
      "expiry_days": 365
    },
    {
      "name": "Drug Screen",
      "description": "Negative drug test result",
      "proof_type": "clearance",
      "attestation_levels": ["third_party"],
      "is_required": true,
      "expiry_days": 365
    }
  ],
  "parent_template_id": null,
  "catalog_id": null,
  "custom_fields": {}
}
```

**Response:**

```json
{
  "id": "template_abc123",
  "name": "OSHA 10-Hour Onboarding",
  "description": "Construction site safety requirements",
  "category": "onboarding",
  "status": "draft",
  "version": 1,
  "created_at": "2026-03-21T10:30:45Z",
  "created_by": "user_001",
  "updated_at": "2026-03-21T10:30:45Z",
  "published_at": null,
  "published_by": null,
  "archived_at": null,
  "parent_template_id": null,
  "proof_requirements": [
    {
      "id": "req_xyz789",
      "name": "OSHA 10-Hour Card",
      "proof_type": "certification",
      "attestation_levels": ["upload"],
      "is_required": true,
      "expiry_days": 365
    }
  ]
}
```

**`PUT /api/v1/compliance/templates/:templateId` (Update Draft)**

```json
{
  "name": "OSHA 10-Hour Onboarding (Updated)",
  "description": "...",
  "proof_requirements": [...]
}
```

### 3.2 Template Publishing & Versioning

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/compliance/templates/:templateId/submit` | POST | Submit draft for review |
| `POST /api/v1/compliance/templates/:templateId/publish` | POST | Publish (compliance officer approval) |
| `POST /api/v1/compliance/templates/:templateId/reject` | POST | Reject review (return to draft) |
| `POST /api/v1/compliance/templates/:templateId/archive` | POST | Archive published template |
| `GET /api/v1/compliance/templates/:templateId/versions` | GET | List all versions |
| `GET /api/v1/compliance/templates/:templateId/versions/:versionNumber` | GET | Get specific version |

**`POST /api/v1/compliance/templates/:templateId/submit` (Submit for Review)**

```json
{
  "reviewers": ["compliance_officer_001"],
  "notes": "Ready for internal review"
}
```

**Response:**

```json
{
  "id": "template_abc123",
  "status": "submitted_for_review",
  "submitted_at": "2026-03-21T10:35:00Z",
  "submitted_by": "user_001",
  "review_deadline": "2026-03-28T23:59:59Z",
  "assigned_reviewers": ["compliance_officer_001"]
}
```

**`POST /api/v1/compliance/templates/:templateId/publish` (Publish)**

```json
{
  "approval_notes": "Reviewed and approved for compliance",
  "effective_date": "2026-03-22T00:00:00Z"
}
```

**Response:**

```json
{
  "id": "template_abc123",
  "status": "published",
  "version": 1,
  "published_at": "2026-03-21T10:40:00Z",
  "published_by": "compliance_officer_001",
  "effective_date": "2026-03-22T00:00:00Z",
  "version_url": "/api/v1/compliance/templates/template_abc123/versions/1"
}
```

### 3.3 Catalog & Inheritance

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/compliance/templates/catalog/list` | GET | List industry catalog templates |
| `GET /api/v1/compliance/templates/catalog/:catalogId` | GET | Get catalog template |
| `POST /api/v1/compliance/templates/catalog/:catalogId/inherit` | POST | Create tenant custom version of catalog template |

**`POST /api/v1/compliance/templates/catalog/{catalogId}/inherit` (Customize HIPAA Clearance for tenant)**

```json
{
  "name": "HIPAA Training (Our Org)",
  "proof_requirements": [
    {
      "inherited_from": "req_hipaa_001",
      "name": "HIPAA Training (Custom)",
      "expiry_days": 24 * 365
    }
  ]
}
```

**Response:**

```json
{
  "id": "template_custom_001",
  "name": "HIPAA Training (Our Org)",
  "status": "draft",
  "parent_catalog_id": "catalog_hipaa_001",
  "parent_template_id": null
}
```

### 3.4 Assignment Engine

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/compliance/assignments` | POST | Create assignments (individual, bulk, rule-based) |
| `GET /api/v1/compliance/assignments` | GET | List assignments (filters: template, employee, status) |
| `GET /api/v1/compliance/assignments/:assignmentId` | GET | Get assignment details |
| `PATCH /api/v1/compliance/assignments/:assignmentId` | PATCH | Update assignment (extend deadline, reassign) |
| `DELETE /api/v1/compliance/assignments/:assignmentId` | DELETE | Delete assignment (soft-delete) |

**`POST /api/v1/compliance/assignments` (Create Assignments)**

```json
{
  "template_id": "template_abc123",
  "assignment_mode": "individual",
  "employee_ids": ["emp_001", "emp_002"],
  "assigned_at": "2026-03-21T00:00:00Z",
  "due_date": "2026-04-21T23:59:59Z",
  "notify": true
}
```

Alternative: **Rule-Based Assignment**

```json
{
  "template_id": "template_abc123",
  "assignment_mode": "rule_based",
  "rule": {
    "type": "role",
    "role": "EMPLOYEE",
    "department": "Construction"
  },
  "due_date": "2026-04-21T23:59:59Z",
  "notify": true
}
```

Alternative: **Auto-Assignment on Trigger**

```json
{
  "template_id": "template_abc123",
  "assignment_mode": "auto_trigger",
  "trigger": {
    "event": "hire",
    "days_offset": 0
  },
  "due_date_offset_days": 30
}
```

**Response:**

```json
{
  "assignments_created": 2,
  "assignment_ids": ["assign_001", "assign_002"],
  "mode": "individual",
  "due_date": "2026-04-21T23:59:59Z"
}
```

### 3.5 Import/Export

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/compliance/templates/:templateId/export` | POST | Export template as JSON |
| `POST /api/v1/compliance/templates/import` | POST | Import template from JSON |

**`POST /api/v1/compliance/templates/{templateId}/export` (Export)**

Response: JSON file download with proof requirements, no PII.

**`POST /api/v1/compliance/templates/import` (Import)**

```json
{
  "template_json": { /* exported template */ },
  "map_catalog": true,
  "create_as_draft": true
}
```

---

## 4. Validation Schemas (Zod)

```typescript
// apps/api/src/modules/templates/validators.ts

import { z } from 'zod';

export const templateStatusSchema = z.enum([
  'draft',
  'submitted_for_review',
  'approved',
  'published',
  'archived',
  'rejected'
]);

export const proofRequirementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  proof_type: z.enum(['hours', 'certification', 'training', 'clearance', 'assessment', 'compliance']),
  attestation_levels: z.array(z.enum(['self_attest', 'upload', 'third_party', 'validated'])).min(1),
  is_required: z.boolean().default(true),
  expiry_days: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().default(0),
});

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1).max(100),
  proof_requirements: z.array(proofRequirementSchema).min(1),
  parent_template_id: z.string().uuid().optional(),
  catalog_id: z.string().uuid().optional(),
  custom_fields: z.record(z.any()).optional(),
});

export const templateUpdateSchema = templateCreateSchema.partial().extend({
  name: templateCreateSchema.shape.name.optional(),
});

export const assignmentModeSchema = z.enum(['individual', 'group', 'role_based', 'rule_based', 'auto_trigger']);

export const assignmentCreateSchema = z.object({
  template_id: z.string().uuid(),
  assignment_mode: assignmentModeSchema,
  employee_ids: z.array(z.string().uuid()).optional(),
  rule: z.object({
    type: z.enum(['role', 'department', 'date_range']),
    role: z.string().optional(),
    department: z.string().optional(),
  }).optional(),
  trigger: z.object({
    event: z.enum(['hire', 'role_change', 'expiry', 'custom_date']),
    days_offset: z.number().int(),
  }).optional(),
  due_date: z.string().datetime(),
  notify: z.boolean().default(true),
});

export const templateSubmitSchema = z.object({
  reviewers: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
});

export const templatePublishSchema = z.object({
  approval_notes: z.string().optional(),
  effective_date: z.string().datetime(),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
```

---

## 5. Data Model Changes (Prisma)

```prisma
// data/prisma/schema.prisma (additions to existing models)

model ProofTemplate {
  id              String   @id @default(uuid())
  tenantId        String
  
  name            String
  description     String?
  category        String
  
  status          String   @default("draft")
  version         Int      @default(1)
  
  // Authoring
  createdAt       DateTime @default(now())
  createdBy       String   // user_id
  updatedAt       DateTime @updatedAt
  updatedBy       String?
  
  // Publishing
  submittedAt     DateTime?
  submittedBy     String?
  reviewDeadline  DateTime?
  assignedReviewers String[] @default([])
  
  publishedAt     DateTime?
  publishedBy     String?
  effectiveDate   DateTime?
  
  // Versioning
  priorVersionId  String?
  priorVersion    ProofTemplate? @relation("TemplateVersions", fields: [priorVersionId], references: [id])
  nextVersions    ProofTemplate[] @relation("TemplateVersions")
  
  // Inheritance
  parentTemplateId String?
  parentTemplate  ProofTemplate? @relation("InheritanceChain", fields: [parentTemplateId], references: [id])
  childTemplates  ProofTemplate[] @relation("InheritanceChain")
  
  catalogId       String?  // reference to industry catalog
  
  // Soft delete
  archivedAt      DateTime?
  archivedBy      String?
  
  // Relations
  requirements    ProofRequirement[]
  assignments     TemplateAssignment[]
  
  @@unique([tenantId, name, version])
  @@index([tenantId, status])
  @@index([createdBy])
  @@index([publishedAt])
}

model ProofRequirement {
  id              String   @id @default(uuid())
  templateId      String
  template        ProofTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  name            String
  description     String?
  proofType       String   // hours, certification, training, clearance, assessment, compliance
  attestationLevels String[] // [self_attest, upload, third_party, validated]
  
  isRequired      Boolean  @default(true)
  expiryDays      Int?
  order           Int      @default(0)
  
  @@index([templateId])
}

model TemplateAssignment {
  id              String   @id @default(uuid())
  tenantId        String
  templateId      String
  template        ProofTemplate @relation(fields: [templateId], references: [id])
  
  // Assignment target
  employeeId      String?
  groupId         String?
  roleId          String?
  rule            Json?    // {type: "department", value: "Engineering"}
  
  // Timing
  assignedAt      DateTime @default(now())
  assignedBy      String   // user_id
  dueDate         DateTime
  
  // Auto-assignment trigger
  autoTrigger     String?  // hire, role_change, expiry, custom_date
  triggerOffset   Int?     // days offset from event
  
  // Status
  status          String   @default("active")
  completedAt     DateTime?
  
  notify          Boolean  @default(true)
  notifiedAt      DateTime?
  
  @@index([tenantId, templateId])
  @@index([employeeId])
  @@index([dueDate])
}
```

---

## 6. RBAC Matrix

### 6.1 Template Authoring RBAC

| Action | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|--------|:---:|:---:|:---:|:---:|:---:|
| Create template | ✗ | ✗ | ✓ | ✓ | ✓ |
| Edit own draft | ✗ | ✗ | ✓ | ✓ | ✓ |
| Submit for review | ✗ | ✗ | ✓ | ✓ | ✓ |
| Review/approve publish | ✗ | ✗ | ✗ | ✓ | ✓ |
| Reject review | ✗ | ✗ | ✗ | ✓ | ✓ |
| Publish | ✗ | ✗ | ✗ | ✓ | ✓ |
| Archive | ✗ | ✗ | ✗ | ✓ | ✓ |
| View published templates | ✓ | ✓ | ✓ | ✓ | ✓ |

### 6.2 Assignment RBAC

| Action | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|--------|:---:|:---:|:---:|:---:|:---:|
| Assign individual template | ✗ | ✓ | ✓ | ✓ | ✓ |
| Assign rule-based | ✗ | ✗ | ✓ | ✓ | ✓ |
| Set auto-triggers | ✗ | ✗ | ✗ | ✓ | ✓ |
| View own assignments | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team assignments | ✗ | ✓ | ✓ | ✓ | ✓ |
| View all assignments | ✗ | ✗ | ✗ | ✓ | ✓ |

---

## 7. Error Responses

```json
{
  "error": {
    "code": "TEMPLATE_ERROR",
    "message": "Description",
    "details": {}
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Template not found | 404 | `TEMPLATE_NOT_FOUND` |
| Cannot edit published template | 409 | `TEMPLATE_PUBLISHED` |
| Cannot publish without approval | 403 | `NOT_APPROVED` |
| Insufficient review time | 400 | `REVIEW_WINDOW_TOO_SHORT` |
| Assignment deadline in past | 400 | `INVALID_DUE_DATE` |
| Rule syntax invalid | 400 | `INVALID_RULE` |
| Catalog template not found | 404 | `CATALOG_TEMPLATE_NOT_FOUND` |
| Import validation failed | 400 | `IMPORT_VALIDATION_FAILED` |

---

## 8. Security & Compliance

### 8.1 Change Control

- **Immutable versions** — Each publish creates versioned snapshot; cannot be edited
- **Approval trail** — Who submitted, who approved, when, notes all recorded
- **Rollback capability** — Can restore previous version if needed
- **Audit log** — Every template action (create, edit, submit, publish, archive) logged

### 8.2 Inheritance Safety

- **Parent lock** — Inherited template locked if parent changes; must explicitly sync
- **Custom override visible** — Audit trail shows what was customized vs inherited
- **Prevent circular inheritance** — Validate no cycles in parent-child graph

### 8.3 Regulatory Flexibility

- **Industry templates** — Curated by compliance team, immutable for customers
- **Tenant customization** — Can extend/inherit, cannot modify core industry templates
- **Field governance** — Core proof types/attestation levels locked; custom metadata allowed

---

## 9. Phased Rollout

### Phase 1 (Sprint 5) — Core CRUD

- [ ] Create Prisma models (ProofTemplate, ProofRequirement, TemplateAssignment)
- [ ] Implement GET/POST/PUT/DELETE endpoints for templates
- [ ] Status workflow (draft → published → archived)
- [ ] Unit tests for template creation & updates
- **Success Criteria:** Can create/edit/publish templates

### Phase 2 (Sprint 6) — Authoring Workflow

- [ ] Implement submit/approve/reject/publish flow
- [ ] Version tracking on publish
- [ ] Approval notifications
- [ ] Integration tests for workflow
- **Success Criteria:** Can submit template for review, compliance officer can approve

### Phase 3 (Sprint 7) — Assignment Engine

- [ ] Implement individual + bulk assignment
- [ ] Rule-based assignment (by role, department)
- [ ] Auto-trigger logic (hire, role-change, expiry)
- [ ] Assignment notifications
- **Success Criteria:** Can assign templates, assignments triggered on employee hire

### Phase 4 (Sprint 8) — Catalog & Inheritance

- [ ] Set up industry catalog (OSHA, HIPAA, etc.)
- [ ] Inheritance & customization logic
- [ ] Import/export endpoints
- [ ] Catalog UI
- **Success Criteria:** Customer can inherit OSHA template, customize it for their org

---

## 10. Acceptance Criteria

✅ **Phase 1 Acceptance:**

- [ ] Can POST template with requirements
- [ ] Cannot edit published template
- [ ] Status transitions follow lifecycle (draft → published → archived)
- [ ] All status changes logged to AuditLog

---

## 11. Related Specs

- **Templates Attestation:** `templates-attestation-spec.md` (L1-L4 system)
- **RBAC API:** `rbac-api-spec.md` (role enforcement)
- **Proof Taxonomy:** `proof-taxonomy.md` (proof type definitions)

