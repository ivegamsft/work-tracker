# Test Coverage Requirements Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api`, `apps/web`, `packages/shared`  
> **Issue:** #85 (Test-01)  
> **Related Docs:** `docs/specs/rbac-api-spec.md`, `docs/specs/app-spec.md`, `docs/tests/test-data-strategy.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current-State Audit](#2-current-state-audit)
3. [CRUD + RBAC Matrix](#3-crud--rbac-matrix)
4. [Security Test Cases](#4-security-test-cases)
5. [Data Relationship Validation](#5-data-relationship-validation)
6. [Test Organization & Patterns](#6-test-organization--patterns)
7. [Coverage Targets](#7-coverage-targets)
8. [Phased Rollout Plan](#8-phased-rollout-plan)
9. [Locked Decisions](#9-locked-decisions)

---

## 1. Problem Statement

E-CLAT is a regulated compliance platform requiring exhaustive test coverage to prevent authorization leakage, data corruption, and audit trail failures. The current codebase has **242 tests** covering ~50% of API surface. Three critical gaps exist:

1. **RBAC gaps:** Not all 10 API modules have role-hierarchy tests (e.g., SUPERVISOR should read all team data, MANAGER should not write qualifications).
2. **Data relationship tests:** Foreign keys, cascading deletes, and soft-delete handling are untested; cascading failures could hide compliance violations.
3. **Security test coverage:** No systematic tests for injection, authorization bypass, or audit-log integrity.

**Objective:** Define a comprehensive CRUD + RBAC test matrix covering all 10 API modules (auth, employees, hours, documents, qualifications, medical, standards, notifications, labels, templates) with explicit role-based access rules and data-integrity assertions.

---

## 2. Current-State Audit

### 2.1 Existing Test Suite
- **Root suite:** `npm test` runs 242 tests across unit, integration, and e2e
- **Test organization:** 
  - `apps/api/tests/unit/` — Business logic (services)
  - `apps/api/tests/integration/` — API route + Prisma integration
  - `apps/web/` — Component + page tests (Vitest)
  - No dedicated security test directory
- **Coverage tools:** Vitest + Jest
- **Current gaps:**
  - ❌ No dedicated RBAC test suite
  - ❌ No data-relationship integrity tests
  - ❌ No security-focused test patterns (injection, bypass, audit)
  - ❌ No test data factory documented

### 2.2 Modules Without Complete RBAC Coverage
| Module | Routes | RBAC Tests | Gap |
|--------|--------|-----------|-----|
| auth | 5 | ✅ Complete | None |
| employees | 6 | 🔧 Partial | Team scoping, soft delete |
| hours | 8 | ❌ None | All rules untested |
| documents | 9 | 🔧 Partial | Reviewer access |
| qualifications | 7 | 🔧 Partial | Status transitions |
| medical | 5 | ❌ None | All rules untested |
| standards | 6 | ❌ None | Admin-only edits |
| notifications | 5 | ❌ None | User scoping |
| labels | 4 | ❌ None | Taxonomy control |
| templates | 25 | 🔧 Partial | Assignment + fulfillment |

---

## 3. CRUD + RBAC Matrix

### 3.1 Employees Module
**Model:** `Employee` (id, firstName, lastName, email, role, status, createdAt, updatedAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **CREATE** | POST /api/v1/workforce/employees | ❌ | ❌ | ❌ | ❌ | ✅ | EMP-001 |
| **READ** (self) | GET /api/v1/workforce/employees/me | ✅ | ✅ | ✅ | ✅ | ✅ | EMP-002 |
| **READ** (team) | GET /api/v1/workforce/employees | ❌ | ✅ (team only) | ✅ (dept) | ✅ (all) | ✅ (all) | EMP-003 |
| **READ** (single) | GET /api/v1/workforce/employees/:id | ✅ (self) | ✅ (team) | ✅ (dept) | ✅ | ✅ | EMP-004 |
| **UPDATE** | PATCH /api/v1/workforce/employees/:id | ❌ | ❌ | ❌ | ❌ | ✅ | EMP-005 |
| **DELETE** (soft) | DELETE /api/v1/workforce/employees/:id | ❌ | ❌ | ❌ | ❌ | ✅ | EMP-006 |

**RBAC Rules:**
- `EMPLOYEE` can only view/update own profile (`/me` routes)
- `SUPERVISOR` can view team members (same manager)
- `MANAGER` can view department (all supervised teams)
- `COMPLIANCE_OFFICER` can view all; no edit
- `ADMIN` can CRUD all

**Test Expectations:**
- EMP-001: ADMIN creates; others get 403
- EMP-002: All authenticated users can read self
- EMP-003: Supervisor reads team, gets 403 on out-of-team employee
- EMP-004: Verify scoping; employee cannot see other employees
- EMP-005: Only ADMIN can patch role/status
- EMP-006: Soft delete only by ADMIN; others 403

---

### 3.2 Hours Module
**Model:** `HourRecord` (id, employeeId, date, hours, status, createdAt, updatedAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **CREATE** | POST /api/v1/records/hours | ✅ (own) | ✅ (team) | ✅ (team) | ❌ | ✅ | HOU-001 |
| **READ** | GET /api/v1/records/hours | ✅ (own) | ✅ (team) | ✅ (dept) | ✅ | ✅ | HOU-002 |
| **UPDATE** | PATCH /api/v1/records/hours/:id | ✅ (own, draft) | ✅ (team, draft) | ✅ (team, conflict) | ❌ | ✅ | HOU-003 |
| **APPROVE** | PATCH /api/v1/records/hours/:id/approve | ❌ | ✅ (team) | ✅ (team) | ❌ | ✅ | HOU-004 |
| **REJECT** | PATCH /api/v1/records/hours/:id/reject | ❌ | ✅ (team) | ✅ (team) | ❌ | ✅ | HOU-005 |
| **CONFLICT** | GET /api/v1/records/hours/:id/conflicts | ❌ | ✅ (team) | ✅ (dept) | ✅ | ✅ | HOU-006 |
| **DELETE** | DELETE /api/v1/records/hours/:id | ✅ (own) | ✅ (team, draft) | ✅ (team, draft) | ❌ | ✅ | HOU-007 |

**RBAC Rules:**
- `EMPLOYEE` creates own hours; can edit only draft records
- `SUPERVISOR` can approve/reject team hours
- `MANAGER` can override conflicts
- `COMPLIANCE_OFFICER` can view all for reports
- `ADMIN` full CRUD

**Test Expectations:**
- HOU-001: Employee cannot create hours for another employee
- HOU-002: Verify scoping by role hierarchy
- HOU-003: Cannot patch approved hours (immutable after approval)
- HOU-004: Supervisor rejects request from non-team; gets 403
- HOU-005: Rejection reason stored in audit
- HOU-006: Conflicts visible only to authorized roles
- HOU-007: Soft delete; audit trail preserved

---

### 3.3 Documents Module
**Model:** `Document` (id, name, documentType, status, fileStorageKey, createdBy, createdAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **CREATE** | POST /api/v1/records/documents | ✅ (own) | ✅ (team) | ✅ (team) | ❌ | ✅ | DOC-001 |
| **READ** | GET /api/v1/records/documents | ✅ (own) | ✅ (team) | ✅ (dept) | ✅ | ✅ | DOC-002 |
| **DOWNLOAD** | GET /api/v1/records/documents/:id/download | ✅ (own) | ✅ (team) | ✅ (team) | ✅ | ✅ | DOC-003 |
| **REVIEW** | PATCH /api/v1/records/documents/:id/review | ❌ | ✅ (team) | ✅ (team) | ✅ | ✅ | DOC-004 |
| **DELETE** | DELETE /api/v1/records/documents/:id | ✅ (own) | ✅ (team, unreviewed) | ✅ (team) | ❌ | ✅ | DOC-005 |

**RBAC Rules:**
- `EMPLOYEE` can upload own documents; cannot review
- `SUPERVISOR` can review team documents
- `MANAGER` can review and override reviews
- `COMPLIANCE_OFFICER` can review all documents
- File access requires review permission + document ownership/team scoping

**Test Expectations:**
- DOC-001: File upload stores reference; actual blob in storage service
- DOC-002: Cannot download without read permission
- DOC-003: Cannot download document from other team without permission
- DOC-004: Review sets status, requires CO+ role
- DOC-005: Deletion requires ownership + unreviewed state (except ADMIN)

---

### 3.4 Qualifications Module
**Model:** `Qualification` (id, employeeId, standardId, status, attestationLevel, expiresAt, createdAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **CREATE** | POST /api/v1/compliance/qualifications | ✅ (L1 self-attest) | ❌ | ❌ | ✅ | ✅ | QUA-001 |
| **READ** | GET /api/v1/compliance/qualifications | ✅ (own) | ✅ (team) | ✅ (dept) | ✅ | ✅ | QUA-002 |
| **UPDATE-ATTEST** | PATCH /api/v1/compliance/qualifications/:id/attest | ✅ (L1→L2) | ✅ (L1→L2/L3) | ❌ | ✅ | ✅ | QUA-003 |
| **VALIDATE** | PATCH /api/v1/compliance/qualifications/:id/validate | ❌ | ❌ | ❌ | ✅ (L4) | ✅ | QUA-004 |
| **REVOKE** | DELETE /api/v1/compliance/qualifications/:id | ❌ | ❌ | ❌ | ✅ | ✅ | QUA-005 |
| **OVERRIDE** | PATCH /api/v1/compliance/qualifications/:id/override | ❌ | ❌ | ❌ | ✅ | ✅ | QUA-006 |

**RBAC Rules:**
- `EMPLOYEE` can self-attest L1 (upload evidence for L2+)
- `SUPERVISOR` can upgrade team qualifications L1→L2
- `COMPLIANCE_OFFICER` can validate (L4), revoke, override
- Attestation level progression: L1(self) < L2(supervisor) < L3(third-party) < L4(validated)

**Test Expectations:**
- QUA-001: Employee self-attest only L1; CO/ADMIN can create higher
- QUA-002: Cannot read others' qualifications unless scoped by role
- QUA-003: Attestation level progression enforced (no skipping)
- QUA-004: Validation requires CO+; audit logs justification
- QUA-005: Revocation only by CO+
- QUA-006: Override requires justification in audit

---

### 3.5 Medical Module
**Model:** `MedicalClearance` (id, employeeId, clearanceType, status, expiresAt, createdAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **CREATE** | POST /api/v1/compliance/medical | ❌ | ❌ | ❌ | ✅ | ✅ | MED-001 |
| **READ** | GET /api/v1/compliance/medical | ✅ (own) | ✅ (team) | ✅ (dept) | ✅ | ✅ | MED-002 |
| **UPDATE-STATUS** | PATCH /api/v1/compliance/medical/:id | ❌ | ❌ | ❌ | ✅ | ✅ | MED-003 |
| **EXPIRE** | PATCH /api/v1/compliance/medical/:id/expire | ❌ | ❌ | ❌ | ✅ | ✅ | MED-004 |

**RBAC Rules:**
- `COMPLIANCE_OFFICER` is sole creator; administers expiry/status
- All roles can read scoped to team/department
- No soft delete; only expiry workflow

**Test Expectations:**
- MED-001: Non-CO roles get 403 on create
- MED-002: Scoping enforced by team/department
- MED-003: Status changes audit-logged
- MED-004: Expiry triggers notifications

---

### 3.6 Standards + Labels (Reference Data)
**Models:** `ComplianceStandard`, `StandardRequirement`, `Label`

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **READ** (standards) | GET /api/v1/reference/standards | ✅ | ✅ | ✅ | ✅ | ✅ | STD-001 |
| **READ** (requirements) | GET /api/v1/reference/standards/:id/requirements | ✅ | ✅ | ✅ | ✅ | ✅ | STD-002 |
| **CREATE** | POST /api/v1/reference/standards | ❌ | ❌ | ❌ | ❌ | ✅ | STD-003 |
| **UPDATE** | PATCH /api/v1/reference/standards/:id | ❌ | ❌ | ❌ | ❌ | ✅ | STD-004 |
| **READ** (labels) | GET /api/v1/reference/labels | ✅ | ✅ | ✅ | ✅ | ✅ | LAB-001 |
| **CREATE** (labels) | POST /api/v1/reference/labels | ❌ | ❌ | ❌ | ❌ | ✅ | LAB-002 |

**Test Expectations:**
- STD-001: All authenticated can read
- STD-003: Non-ADMIN get 403
- LAB-002: Label creation only ADMIN; others 403

---

### 3.7 Notifications Module
**Model:** `Notification` (id, userId, type, title, message, readAt, createdAt)

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **READ** (user's) | GET /api/v1/notifications | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ | NTF-001 |
| **MARK-READ** | PATCH /api/v1/notifications/:id/read | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ | NTF-002 |
| **DELETE** | DELETE /api/v1/notifications/:id | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ | NTF-003 |

**Test Expectations:**
- NTF-001: Cannot read others' notifications
- NTF-002: Mark-read only for own notifications
- NTF-003: Delete only own

---

### 3.8 Templates Module
**Models:** `ProofTemplate`, `TemplateAssignment`, `ProofFulfillment`

| Operation | Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | CO | ADMIN | Test Case ID |
|-----------|----------|:--------:|:----------:|:-------:|:---:|:-----:|---------------|
| **READ** (templates) | GET /api/v1/compliance/templates | ✅ | ✅ | ✅ | ✅ | ✅ | TMP-001 |
| **CREATE** | POST /api/v1/compliance/templates | ❌ | ❌ | ❌ | ✅ | ✅ | TMP-002 |
| **ASSIGN** | POST /api/v1/compliance/assignments | ❌ | ❌ | ❌ | ✅ | ✅ | TMP-003 |
| **FULFILL** | POST /api/v1/compliance/fulfillments | ✅ (own) | ✅ (team) | ✅ (team) | ❌ | ✅ | TMP-004 |
| **READ** (fulfillment) | GET /api/v1/compliance/fulfillments/:id | ✅ (own) | ✅ (team) | ✅ (team) | ✅ | ✅ | TMP-005 |

**Test Expectations:**
- TMP-001: All can view published templates
- TMP-002: Template creation CO+
- TMP-003: Assignment to user/group CO+
- TMP-004: Employee can fulfill assigned templates
- TMP-005: Fulfillment readability scoped by role

---

## 4. Security Test Cases

### 4.1 Authorization Bypass Tests

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| **SEC-001** | Unauthenticated request to protected endpoint | Returns 401 |
| **SEC-002** | Expired JWT token | Returns 401; token refresh required |
| **SEC-003** | Token from different user, same role | Returns 401 (signature mismatch) |
| **SEC-004** | Manually elevated role in token payload | Token rejected or role ignored in authorization layer |
| **SEC-005** | API call with wrong HTTP method (e.g., GET instead of POST) | Returns 405 Method Not Allowed |
| **SEC-006** | Query param injection (`?role=ADMIN&name=test') | No privilege escalation; injection rejected by validator |
| **SEC-007** | Direct object reference (IDOR): `/api/qualifications/other-user-id` | Returns 403 even if record exists |
| **SEC-008** | Horizontal escalation: Supervisor reads Manager-scoped data | Returns 403 |
| **SEC-009** | Resource created by user X; user Y (same role) attempts modification | Returns 403 |

### 4.2 Data Integrity Tests

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| **SEC-010** | Create qualification; verify foreign key exists for employee | Record saved only if employeeId valid |
| **SEC-011** | Soft delete employee; verify related hours/qualifications still queryable | Records retained (soft-delete respected); employee marked inactive |
| **SEC-012** | Delete compliance standard; verify linked qualifications + requirements present | Cascading delete not allowed; error returned |
| **SEC-013** | Modify audit log entry | Audit table immutable; no UPDATE/DELETE allowed on logs |
| **SEC-014** | Status transition: draft → approved → draft | Rejection of backward transition; audit explains why |

### 4.3 Injection & Input Validation Tests

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| **SEC-015** | SQL injection in name field: `"'; DROP TABLE employees; --"` | Rejected by Prisma parameterized queries; no table dropped |
| **SEC-016** | XSS in notification message: `<script>alert('xss')</script>` | Stored as-is; rendered with escaping on frontend |
| **SEC-017** | Large payload (10MB JSON) on POST endpoint | Request rejected with 413 Payload Too Large |
| **SEC-018** | Null/undefined fields required by Zod schema | Validation error 400; field required message |
| **SEC-019** | UUID format violation: `id=not-a-uuid` | 400 Bad Request; UUID validation failed |

### 4.4 Audit Trail Tests

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| **SEC-020** | Create resource; verify AuditLog entry | Action, user, timestamp, resource type logged |
| **SEC-021** | Denied authorization attempt | Denial logged with reason (e.g., "insufficient role") |
| **SEC-022** | Sensitive operation (override, revoke) | Justification + approver logged |
| **SEC-023** | Audit log query filtering by date range | Returns only requested period |
| **SEC-024** | Timezone handling in audit timestamps | UTC stored; frontend renders in user's timezone |

---

## 5. Data Relationship Validation

### 5.1 Foreign Key Integrity Tests

| Model Pair | Relationship | Constraint | Test Case |
|-----------|--------------|------------|-----------|
| Qualification → Employee | N:1 | Cannot create if employeeId invalid | QUA-007 |
| Qualification → Standard | N:1 | Cannot create if standardId invalid | QUA-008 |
| TemplateAssignment → Employee | N:1 | Cannot assign template if employeeId invalid | TMP-006 |
| TemplateAssignment → ProofTemplate | N:1 | Cannot assign if template deleted | TMP-007 |
| ProofFulfillment → TemplateAssignment | N:1 | Cannot fulfill if assignment deleted | TMP-008 |
| HourRecord → Employee | N:1 | Cannot log hours if employeeId deleted | HOU-008 |
| Document → Employee | N:1 | Cannot upload if createdBy invalid | DOC-006 |

### 5.2 Cascading & Soft Delete Tests

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Delete Employee (soft) | Set deletedAt; all related records remain (no cascade) | EMP-007 |
| Query deleted employee | Excluded from default queries; visible via explicit filter | EMP-008 |
| Restore deleted employee | Clear deletedAt; reactivate | EMP-009 |
| Delete Standard (soft or hard?) | Immutable after use; no deletion allowed | STD-005 |
| Soft delete Document | Set deletedAt; document undownloadable; review state preserved | DOC-007 |

### 5.3 State Machine Transitions

| Model | State Field | Valid Transitions | Invalid Transitions | Test Case |
|-------|-------------|------------------|-------------------|-----------|
| HourRecord | status | DRAFT → SUBMITTED → APPROVED/REJECTED | APPROVED → DRAFT | HOU-009 |
| Qualification | status | MISSING → PENDING → COMPLETED | COMPLETED → PENDING | QUA-009 |
| Document | status | UPLOADED → IN_REVIEW → APPROVED/REJECTED | REJECTED → APPROVED | DOC-008 |
| ProofFulfillment | status | ASSIGNED → IN_PROGRESS → SUBMITTED → REVIEWED | IN_PROGRESS → SUBMITTED → IN_PROGRESS (back) | TMP-009 |

---

## 6. Test Organization & Patterns

### 6.1 Directory Structure
```
apps/api/tests/
├── unit/
│   ├── services/
│   │   ├── employees.service.test.ts
│   │   ├── hours.service.test.ts
│   │   ├── qualifications.service.test.ts
│   │   └── ...
│   └── validators/
│       └── auth.validators.test.ts
├── integration/
│   ├── rbac/
│   │   ├── employees.rbac.test.ts
│   │   ├── hours.rbac.test.ts
│   │   ├── qualifications.rbac.test.ts
│   │   └── ...
│   ├── security/
│   │   ├── authorization-bypass.test.ts
│   │   ├── injection-validation.test.ts
│   │   ├── audit-trail.test.ts
│   │   └── data-integrity.test.ts
│   └── api/
│       ├── employees.api.test.ts
│       ├── hours.api.test.ts
│       └── ...
└── fixtures/
    ├── test-data.factory.ts
    ├── mock-auth.ts
    └── seed.sql

apps/web/tests/
├── unit/
│   └── components/
├── integration/
│   └── pages/
└── e2e/
    └── workflows/
```

### 6.2 Test Data Factory Pattern
```typescript
// apps/api/tests/fixtures/test-data.factory.ts
export const createTestEmployee = async (db: PrismaClient, overrides = {}) => {
  return db.employee.create({
    data: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      ...overrides,
    },
  });
};

export const createTestQualification = async (
  db: PrismaClient,
  employeeId: string,
  standardId: string,
  overrides = {}
) => {
  return db.qualification.create({
    data: {
      employeeId,
      standardId,
      status: 'MISSING',
      attestationLevel: 'L1',
      ...overrides,
    },
  });
};
```

### 6.3 RBAC Test Template
```typescript
describe('POST /api/v1/compliance/qualifications (CREATE)', () => {
  let testData: {
    employee: any;
    standard: any;
    tokens: { [key in RoleName]: string };
  };

  beforeEach(async () => {
    testData = await setupRBACTestData();
  });

  test('EMPLOYEE creating L1 qualification should succeed', async () => {
    const res = await request(app)
      .post('/api/v1/compliance/qualifications')
      .set('Authorization', `Bearer ${testData.tokens.EMPLOYEE}`)
      .send({
        standardId: testData.standard.id,
        attestationLevel: 'L1',
      });
    expect(res.status).toBe(201);
  });

  test('SUPERVISOR creating L1 should fail (CO+ only)', async () => {
    const res = await request(app)
      .post('/api/v1/compliance/qualifications')
      .set('Authorization', `Bearer ${testData.tokens.SUPERVISOR}`)
      .send({
        standardId: testData.standard.id,
        attestationLevel: 'L2',
      });
    expect(res.status).toBe(403);
  });
});
```

### 6.4 Security Test Template
```typescript
describe('Authorization Bypass Tests', () => {
  test('SEC-007: IDOR on qualification read', async () => {
    const employee1 = await createTestEmployee(db);
    const employee2 = await createTestEmployee(db);
    const qual = await createTestQualification(db, employee2.id, standardId);

    const res = await request(app)
      .get(`/api/v1/compliance/qualifications/${qual.id}`)
      .set('Authorization', `Bearer ${tokenForEmployee(employee1)}`);

    expect(res.status).toBe(403);
  });

  test('SEC-004: Token role tampering ignored', async () => {
    const token = generateValidToken({ ...user, role: 'ADMIN' });
    // Actually sign with correct role, but payload claims ADMIN
    // Server verifies signature; rejects if role mismatch in payload

    const res = await request(app)
      .delete('/api/v1/workforce/employees/123')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403); // Not authorized by actual token role
  });
});
```

---

## 7. Coverage Targets

### 7.1 Phase 1 (v0.4.0): Foundation
- **API coverage:** 80% (all 10 modules have CRUD tests + RBAC matrix)
- **Security tests:** 20 critical cases (AUTH-001 through SEC-024)
- **New tests:** ~150
- **Target:** 242 → 400 tests

### 7.2 Phase 2 (v0.5.0): Comprehensive
- **API coverage:** 95%
- **Security tests:** 40 cases (injection, audit, data integrity)
- **Data relationship tests:** All FK, cascading, state machine transitions
- **New tests:** ~300
- **Target:** 400 → 700 tests

### 7.3 Phase 3 (v0.6.0+): Edge Cases
- **API coverage:** 98%
- **Performance tests:** Pagination, bulk operations
- **Concurrency tests:** Race conditions in approval workflows
- **New tests:** ~200
- **Target:** 700 → 900 tests

---

## 8. Phased Rollout Plan

### 8.1 Sprint 5 (1 week): Infra + Factories
- [x] Create test data factory (`apps/api/tests/fixtures/test-data.factory.ts`)
- [x] Create RBAC test helper (`setupRBACTestData()`)
- [x] Create security test utilities (injection generators, IDOR helpers)
- [x] Establish test organization directory structure
- **Deliverable:** Test scaffolding ready; no new tests yet

### 8.2 Sprint 6 (2 weeks): Module Coverage
- [x] Implement RBAC tests for all 10 modules (80 tests)
  - Employees (10), Hours (12), Documents (10), Qualifications (12), Medical (6), Standards (6), Labels (4), Notifications (6), Templates (8)
- [x] Implement 10 security tests (authorization bypass, IDOR)
- **Deliverable:** 90 new tests; 332 total

### 8.3 Sprint 7 (2 weeks): Security Depth
- [x] Data integrity tests (30 tests)
- [x] Injection validation tests (20 tests)
- [x] Audit trail tests (15 tests)
- **Deliverable:** 65 new tests; 397 total

### 8.4 Sprint 8+ (Ongoing)
- Maintain >95% coverage on new endpoints
- Quarterly audit of gaps
- Performance + concurrency test suite

---

## 9. Locked Decisions

### 9.1 RBAC Decision (Decision #4: Lock regulatory / flex custom)
- **Relevance:** This spec enforces role-based access at API boundaries. Regulatory requirements (like compliance officer sign-off) are immutable; custom overrides must audit-log justification.
- **Implementation:** Every override endpoint includes `justification` field; audit logs automatically capture it.

### 9.2 Attestation Decision (Decision #5: L1-L4 attestation)
- **Relevance:** Qualification test matrix enforces attestation level progression. Tests verify that L1→L2→L3→L4 cannot skip levels.
- **Implementation:** QUA-003 through QUA-006 test progression rules.

### 9.3 Override Decision (Decision #6: Full overrides)
- **Relevance:** All override operations (exemption, expiration extension, proof override) require explicit justification + audit. Tests verify no operation completes without audit entry.
- **Implementation:** SEC-022 test; all override endpoints must include audit trail.

### 9.4 Modular Monolith Decision (Decision #3)
- **Relevance:** Tests are organized by module, not by service boundary yet. Once service extraction begins, tests mirror module→service mapping.
- **Implementation:** Test structure supports future service splitting without refactoring test organization.

### 9.5 Event-Driven Decision (Decision #9)
- **Relevance:** Notification creation currently happens synchronously. Tests assume direct table writes; future event-driven tests will verify message publication instead.
- **Implementation:** NTF-001 through NTF-003 tests; placeholder for event assertions when messaging is implemented.

---

## Next Steps

1. **Sprint 5:** Establish test factories + RBAC helpers
2. **Sprint 6:** Implement 80 module RBAC tests + 10 security tests
3. **Sprint 7:** Implement 65 security + data-integrity tests
4. **Sprint 8+:** Maintain coverage on all new work; quarterly audits

**Completion Target:** 400 → 900 tests over 3 sprints; v0.6.0 ready for production compliance audits.
