# E-CLAT Compliance Evidence PRD

## Scope
- Documents
- Medical
- Notifications

---

## 1. Documents module
### What exists today
**Endpoints (`apps/api/src/modules/documents/router.ts`)**
- `POST /api/documents/upload`
- `GET /api/documents/:id`
- `GET /api/documents/:id/extraction`
- `PUT /api/documents/:id/extraction/:fieldId/correct`
- `POST /api/documents/:id/review`
- `GET /api/documents/review-queue`
- `GET /api/documents/:id/audit`

**Data model signals**
- Prisma models cover `Document`, `DocumentProcessing`, `ExtractionResult`, and `ReviewQueueItem`
- documents carry status, classified type, detected expiration, review metadata, and links to qualifications
- extraction results track confidence and human correction data
- review queue items support approval/rejection and qualification linkage

**Business rules already encoded**
- upload is employee/authenticated-user initiated
- correction and review require manager+
- audit trail requires supervisor+
- the product expects an OCR/classification/extraction pipeline followed by human review
- document review can attach evidence to a qualification

### What is missing or incomplete
- service methods are stubbed
- upload path uses `Buffer.alloc(0)` as a placeholder; no multipart middleware exists
- document storage integration is absent
- no OCR/provider adapter exists despite config for document processor
- route ordering bug: `GET /:id` is declared before `GET /review-queue`, which will intercept `review-queue`
- no document list endpoint for employees/managers
- no audit persistence
- no MIME/type allowlist or malware scanning

### What should be built next
#### P0
1. Add multipart upload middleware and storage integration.
2. Implement document persistence and `DocumentProcessing` creation.
3. Fix route ordering so review queue is reachable.
4. Implement extraction retrieval/correction and review workflow.
5. Write audit logs for upload, correction, and review decisions.

#### P1
1. Add employee document list/search endpoints.
2. Add asynchronous OCR/classification/extraction processing.
3. Add permission rules for self, reviewer, compliance, and admin access.
4. Validate qualification linkage belongs to the same employee.

### Acceptance criteria
- an uploaded document is stored, processed, reviewable, and traceable
- corrected extraction values preserve original values and reviewer identity
- review decisions can create or update qualification evidence links

---

## 2. Medical module
### What exists today
**Endpoints (`apps/api/src/modules/medical/router.ts`)**
- `POST /api/medical`
- `GET /api/medical/:id`
- `PUT /api/medical/:id`
- `GET /api/medical/employee/:employeeId`
- `GET /api/medical/:id/audit`

**Data model signals**
- Prisma `MedicalClearance` stores type, status, effective/expiration dates, vision results, issuer, timestamps
- shared DTO mirrors the Prisma model closely

**Business rules already encoded**
- supervisors+ create and update clearances
- audit history is expected
- visual acuity and color vision are explicit compliance checks
- expiration is integral to the model

### What is missing or incomplete
- service methods are stubbed
- no status transition rules are defined in code
- `medicalQuerySchema` exists but is unused
- employee clearances list is unpaginated
- clearance type is free text instead of controlled taxonomy
- no automatic expiry job or notification integration
- no document linkage for supporting medical evidence
- ownership/read controls are not enforced beyond authentication

### What should be built next
#### P0
1. Implement create/get/update/listByEmployee/audit using Prisma.
2. Define legal status transitions and validation rules.
3. Add audit logging for medical updates and overrides.
4. Add ownership and role scoping for read access.

#### P1
1. Add pagination and filtering for employee clearance history.
2. Add expiry evaluation job and notifications for expiring or expired clearances.
3. Normalize `clearanceType` against standards or a managed reference set.
4. Add optional document linkage for supporting evidence.

### Acceptance criteria
- medical records have clear lifecycle rules
- expirations are surfaced proactively, not only manually
- sensitive records are visible only to authorized actors
- every status change is auditable

---

## 3. Notifications module
### What exists today
**Endpoints (`apps/api/src/modules/notifications/router.ts`)**
- `GET /api/notifications/preferences`
- `POST /api/notifications/preferences`
- `GET /api/notifications`
- `PUT /api/notifications/:id/read`
- `DELETE /api/notifications/:id`
- `GET /api/notifications/digest/weekly`
- `POST /api/notifications/admin/test`
- `POST /api/notifications/admin/escalation-rules`
- `GET /api/notifications/admin/escalation-rules`

**Data model signals**
- Prisma models include `Notification`, `NotificationPreference`, and `EscalationRule`
- shared types already define delivery channels, frequencies, statuses, and digest shape

**Business rules already encoded**
- preferences are per notification type
- weekly digest is a formal product artifact
- escalation rules are admin-configured policies
- notifications are status-driven (`sent`, `read`, `dismissed`)

### What is missing or incomplete
- service methods are stubbed
- there is no API surface for internal notification creation from domain events
- no delivery integrations exist for email/SMS/in-app beyond the data model
- preference POST is bulk/destructive rather than patch-friendly
- `escalateToRole` is a free string, not validated against shared roles
- no background engine exists for batching, digest generation, or escalations
- notification deletion semantics are ambiguous (soft dismiss vs hard delete)

### What should be built next
#### P0
1. Implement persistence for preferences, listing, mark-as-read, dismiss, digest, and escalation rules.
2. Create an internal notification creation service used by other modules.
3. Decide and document dismissal semantics as soft delete.
4. Validate escalation roles against the shared RBAC vocabulary.

#### P1
1. Add delivery adapters for email and in-app first; SMS later if required.
2. Build background jobs for weekly digests, batching, and escalations.
3. Add PATCH semantics for preference updates.
4. Add resource linking (`resourceType`, `resourceId`) so notifications resolve to domain records.

### Acceptance criteria
- domain events can create notifications without duplicating logic in feature modules
- user preferences are respected by delivery behavior
- digest and escalation jobs operate on real compliance triggers
- dismissed notifications remain auditable for retention windows

---

## 4. Compliance evidence journey to support
1. Evidence is uploaded and stored.
2. AI/manual extraction produces reviewable metadata.
3. Human review decides approval/rejection and qualification linkage.
4. Medical evidence and clearance state feed readiness.
5. Users receive notifications and escalations when action is required.

## 5. Build order inside this PRD
1. Documents upload/review foundation
2. Medical lifecycle + expiry integration
3. Notification creation and delivery primitives
4. Digest/escalation automation
