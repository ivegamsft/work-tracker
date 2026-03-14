# E-CLAT Governance and Taxonomy PRD

## Scope
- Qualifications
- Standards
- Labels

---

## 1. Qualifications module
### What exists today
**Endpoints (`apps/api/src/modules/qualifications/router.ts`)**
- `POST /api/qualifications`
- `GET /api/qualifications`
- `GET /api/qualifications/:id`
- `PUT /api/qualifications/:id`
- `GET /api/qualifications/employee/:employeeId`
- `GET /api/qualifications/:id/audit`
- `GET /api/qualifications/compliance/:employeeId/:standardId`

**Data model signals**
- Prisma `Qualification` joins employees and standards and supports linked evidence documents
- status lifecycle includes `ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `PENDING_REVIEW`, `SUSPENDED`
- shared service contract includes `checkCompliance(employeeId, standardId)` returning `{ compliant, gaps }`

**Business rules already encoded**
- supervisors+ can create/update/list broadly
- qualification records are expected to carry supporting document IDs
- audit history is mandatory
- compliance can be checked for a specific employee against a specific standard

### What is missing or incomplete
- service methods are stubbed
- no date relationship validation (`issueDate` vs `expirationDate`)
- no explicit status transition rules
- no delete/archive path
- no real compliance engine for gap analysis
- read endpoints are not ownership-aware beyond authentication

### What should be built next
#### P0
1. Implement qualification CRUD and evidence linkage through Prisma.
2. Define date and state-transition validation.
3. Implement audit logging for create/update/status changes/document linkage.
4. Build the first pass of the compliance-gap engine against standards and requirements.

#### P1
1. Add archive/deactivate behavior if deletion is needed.
2. Auto-calculate `expiring_soon` and `expired` based on dates.
3. Add bulk import for existing workforce qualification history.

### Acceptance criteria
- a qualification can be created, updated, linked to evidence, and evaluated against a standard
- status changes are deterministic and auditable
- compliance output explains missing gaps clearly enough for UI consumption

---

## 2. Standards module
### What exists today
**Endpoints (`apps/api/src/modules/standards/router.ts`)**
- `POST /api/standards`
- `GET /api/standards`
- `GET /api/standards/:id`
- `PUT /api/standards/:id`
- `POST /api/standards/:id/requirements`
- `PUT /api/standards/requirements/:reqId`
- `GET /api/standards/:id/requirements`

**Data model signals**
- Prisma `ComplianceStandard` stores code, name, issuing body, version, active state
- `StandardRequirement` stores category, description, minimum hours, recertification period, and required tests
- standards are the governing source for qualification and hour-based readiness rules

**Business rules already encoded**
- admin-only mutations
- standards can be active/inactive rather than deleted
- requirements are separate managed records
- minimum hours and recertification period are both optional, allowing mixed compliance rule types

### What is missing or incomplete
- service methods are stubbed
- no explicit uniqueness behavior beyond Prisma schema for `code`
- no version-history or publishing workflow beyond a mutable `version` field
- no delete/archive path for requirements
- `requiredTests` references a concept that has no implementation elsewhere
- no search implementation even though filter surface exists

### What should be built next
#### P0
1. Implement standards and requirement CRUD in Prisma.
2. Ensure standards updates are auditable and version-conscious.
3. Use standards as the authoritative source for qualification compliance checks.

#### P1
1. Add requirement retirement or deletion semantics.
2. Add import/versioning workflow for standards updates over time.
3. Define how `requiredTests` will be satisfied or remove it until the product supports it.

### Acceptance criteria
- standards are manageable by admins with complete audit history
- requirements are queryable and consumable by the compliance engine
- changes to standards do not silently erase historical meaning

---

## 3. Labels module
### What exists today
**Endpoints (`apps/api/src/modules/labels/router.ts`)**
- `POST /api/labels/admin`
- `PUT /api/labels/admin/:id`
- `POST /api/labels/admin/:id/deprecate`
- `GET /api/labels/versions`
- `POST /api/labels/mappings`
- `GET /api/labels/resolve`
- `GET /api/labels/audit/:id`

**Data model signals**
- Prisma models include `Label`, `LabelMapping`, and `TaxonomyVersion`
- labels have effective and retirement dates
- mappings connect labels to hour categories
- taxonomy versions support changelog and migration rules

**Business rules already encoded**
- label codes must be uppercase alphanumeric with underscores
- admin-only mutations
- deprecation is a first-class action
- label resolution can be version-aware
- audit trail is expected for taxonomy changes

### What is missing or incomplete
- service methods are stubbed
- route namespace is inconsistent because labels are mounted under `/api` rather than `/api/labels`
- no endpoint exists to fetch a single label directly
- no publish lifecycle for taxonomy versions
- deprecation semantics are incomplete when `migrateTo` is omitted
- no uniqueness/version constraints are enforced at the service layer for mappings

### What should be built next
#### P0
1. Implement label CRUD, deprecation, mapping creation, version listing, resolve, and audit retrieval.
2. Normalize and document the route namespace.
3. Define what deprecation means operationally for existing hour data.
4. Enforce unique active codes and predictable mapping version behavior.

#### P1
1. Add taxonomy publish workflow and version diffing.
2. Add single-label read endpoint and admin label management list.
3. Add migration tooling for hour records when labels are replaced.

### Acceptance criteria
- incoming/imported hour categories can be resolved against a governed taxonomy
- taxonomy changes are versioned, reviewable, and auditable
- deprecated labels do not break historical reporting

---

## 4. Governance journey to support
1. Admins define compliance standards.
2. Requirements express hours/tests/recertification rules.
3. Qualifications provide employee evidence against those standards.
4. Labels normalize operational hour categories so imported data maps cleanly into the compliance model.

## 5. Build order inside this PRD
1. Standards CRUD and requirement management
2. Qualifications CRUD and gap engine
3. Labels implementation and route cleanup
4. Taxonomy publishing and migration behavior
