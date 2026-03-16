# RBAC API Specification — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Last Updated:** 2026-03-17  
> **Applies To:** All API modules, UI applications, data access layer  
> **Source PRD:** [`docs/requirements/eclat-spec.md`](../requirements/eclat-spec.md) — Product north star. This spec is the implementation authority for RBAC.  
> **Companion Docs:** [App Spec](./app-spec.md) · [Entra Auth Design](./entra-auth-design.md) · [Test Data Strategy](../tests/test-data-strategy.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Role Definitions](#2-role-definitions)
3. [Permission Model](#3-permission-model)
4. [Role-Permission Matrix](#4-role-permission-matrix)
5. [API Endpoint Access Table](#5-api-endpoint-access-table)
6. [Data Scoping Rules](#6-data-scoping-rules)
7. [UI Visibility Rules](#7-ui-visibility-rules)
8. [Entra ID Group Mapping](#8-entra-id-group-mapping)
9. [Implementation Patterns](#9-implementation-patterns)
10. [Future Extensibility](#10-future-extensibility)
11. [Appendix: Permission Quick Reference](#appendix-permission-quick-reference)

---

## 1. Overview

E-CLAT enforces role-based access control at three layers:

| Layer | Mechanism | Enforcement Point |
|-------|-----------|-------------------|
| **UI** | Route guards, component visibility | Frontend (MSAL.js + React context) |
| **API** | Middleware (`authenticate`, `requireRole`, `requireMinRole`) | Express middleware chain |
| **Data** | Row-level filtering (Prisma `where` clauses) | Service layer |

All three layers **must agree**. A user who cannot see a button in the UI must also be rejected at the API, and must receive no data they should not see even if they craft a direct API call.

### Design Principles

1. **Permission-first, not role-first** — Business logic checks `hasPermission('employees:read')`, not `isRole('admin')`.
2. **Deny by default** — Every endpoint requires authentication. Unauthenticated access is limited to `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/oauth/callback`, and `/health`.
3. **Hierarchy is additive** — Higher roles inherit all permissions of lower roles.
4. **Data scope is mandatory** — Read permissions without scope narrowing are meaningless in compliance contexts.
5. **Audit everything** — Every authorization decision that grants or denies access to regulated data is logged.

---

### Terminology Mapping (PRD → Implementation)

The PRD ([`docs/requirements/eclat-spec.md`](../requirements/eclat-spec.md)) uses different terminology than our implementation. This table is the authoritative cross-reference:

| PRD Term | Implementation Term | API Module | Prisma Model | Notes |
|----------|-------------------|------------|-------------|-------|
| **Certifications** | **Qualifications** | `qualifications` | `Qualification` | PRD §4.4 `/certifications/*` → Our `/api/qualifications/*` |
| **Clearance** / Medical Clearance | **Medical** | `medical` | `MedicalClearance` | PRD §4.5 `/clearance/*` → Our `/api/medical/*` |
| **Standard Framework** | **Standard** | `standards` | `Standard` | PRD §4.6 `/standards/*` → Our `/api/standards/*` |
| **Requirement** | **StandardRequirement** | `standards` | `StandardRequirement` | Nested under standards |
| **Hours Entry** | **HourEntry** | `hours` | `HourEntry` | PRD §4.3 `/hours/*` → Our `/api/hours/*` |
| **Employee Profile** | **Employee** | `employees` | `Employee` | PRD §4.2 `/employees/*` → Our `/api/employees/*` |
| **Audit Log** | **AuditLog** | (cross-cutting) | `AuditLog` | PRD §4.7 audit trail → Our per-module `/:id/audit` sub-endpoints |

### PRD Role Reconciliation

The PRD (§5.1) defines **4 roles**. Our implementation uses **5 roles** by splitting the PRD's "Manager" into two tiers:

| PRD Role | Our Role(s) | Level | Rationale |
|----------|------------|:-----:|-----------|
| Employee | Employee | 0 | 1:1 |
| Manager | **Supervisor** + **Manager** | 1 + 2 | The PRD's "Manager" covers both team oversight (approve hours/certs for team) and department operations (document review, conflict resolution). In regulated industries, these are distinct responsibilities. Supervisor handles team-level qualification/medical management; Manager adds document review and conflict resolution authority. |
| Compliance Officer | Compliance Officer | 3 | 1:1 |
| Admin | Admin | 4 | 1:1 |

> **Architecture decision:** We keep 5 roles. The PRD's access matrix for "Manager" is split: actions scoped to "team" map to Supervisor, actions scoped to "department" or involving approval workflows map to Manager. See PRD §5.2 for the original access matrix.

### PRD RBAC Deltas

Comparing PRD §5 against this spec, the following differences exist:

| Area | PRD Says | We Say | Resolution |
|------|---------|--------|------------|
| Employees write | Manager can edit team employees | Only Admin can edit employees | **Keep ours.** Employee record editing is an admin function to prevent field-level conflicts. |
| Hours approval | Manager has `POST /hours/approve` and `POST /hours/reject` | No approve/reject endpoints; conflict resolution instead | **Deferred.** Our architecture uses conflict detection. Explicit approve/reject for manual entries is a Phase 2 feature. |
| Certs approval | Manager has `POST /certifications/approve/:id` | No qualification approval endpoints | **Deferred.** Manual qualifications created by Supervisor+ bypass approval. Document-based certs go through Document Review. |
| Compliance Officer writes | CO cannot edit employee records | CO has department-scope write on qualifications/medical | **Keep ours.** CO needs department-scope write for compliance remediation workflows. |
| Data scoping | 2-tier: Employee (own), Manager (team) | 4-tier: Own, Team, Department, Organization | **Keep ours.** Finer-grained scoping is an implementation strength. |
| Reports API | `GET /reports/*` with 6 endpoints | No reports module | **Deferred.** Phase 2+ feature. Client-side aggregation for MVP. |
| Compliance API | `GET /compliance/*` with 6 endpoints | Readiness via employees module only | **Deferred.** Compliance module is Phase 2+. |
| Integration endpoints | `POST /integrations/*` with 4 endpoints | Not implemented | **Deferred.** Phase 2+ per MVP scope. |

### PRD Data Model Cross-Reference (PRD §8)

| PRD Entity | Our Entity | Prisma Model | Status |
|-----------|-----------|-------------|--------|
| User | User | `User` | ✅ Implemented |
| Employee Profile | Employee | `Employee` | ✅ Implemented |
| Hours Entry | HourEntry | `HourEntry` | ✅ Implemented |
| Certification | Qualification | `Qualification` | ✅ Implemented (renamed) |
| Medical Clearance | MedicalClearance | `MedicalClearance` | ✅ Implemented (renamed) |
| Requirement | StandardRequirement | `StandardRequirement` | ✅ Implemented |
| Standard Framework | Standard | `Standard` | ✅ Implemented |
| Notification | Notification | `Notification` | ✅ Implemented |
| Audit Log | AuditLog | `AuditLog` | ✅ Implemented |

---

## 2. Role Definitions

### 2.1 Role Hierarchy

```
Level 4  ┌──────────┐
         │  Admin   │  Full platform control
Level 3  ├──────────┤
         │ Comp.Off │  Cross-org compliance authority
Level 2  ├──────────┤
         │ Manager  │  Department-wide operations
Level 1  ├──────────┤
         │Supervisor│  Team oversight
Level 0  ├──────────┤
         │ Employee │  Self-service only
         └──────────┘
```

**Source of truth:** `packages/shared/src/types/roles.ts`

```typescript
export const RoleHierarchy: Record<Role, number> = {
  employee: 0,
  supervisor: 1,
  manager: 2,
  compliance_officer: 3,
  admin: 4,
};
```

### 2.2 Role Descriptions

#### Employee (Level 0)

| Attribute | Value |
|-----------|-------|
| **Internal value** | `employee` |
| **Entra app role** | `Employee` |
| **Persona** | Frontline worker, technician, operator |
| **Can do** | View own profile, qualifications, medical clearances, documents, hours, notifications. Upload documents for own records. Clock in/out. |
| **Cannot do** | View other employees' data. Create or modify compliance standards. Approve documents. Access review queues. View audit trails. Export reports. |

#### Supervisor (Level 1)

| Attribute | Value |
|-----------|-------|
| **Internal value** | `supervisor` |
| **Entra app role** | `Supervisor` |
| **Persona** | Team lead, shift lead, foreman |
| **Can do** | Everything an Employee can do, plus: view direct reports' records, create/update qualifications and medical clearances for team members, view audit trails for team, view label audit history. |
| **Cannot do** | View employees outside their team. Access review queues. Import payroll data. Manage standards or labels. Create escalation rules. |

#### Manager (Level 2)

| Attribute | Value |
|-----------|-------|
| **Internal value** | `manager` |
| **Entra app role** | `Manager` |
| **Persona** | Department manager, operations manager, site lead |
| **Can do** | Everything a Supervisor can do, plus: view all employees in their department, access document review queue, approve/reject documents, correct AI extractions, resolve hour conflicts, edit/delete hour records, import payroll and scheduling data. |
| **Cannot do** | View employees outside their department. Manage compliance standards. Manage taxonomy/labels. Create escalation rules. Full admin operations. |

#### Compliance Officer (Level 3)

| Attribute | Value |
|-----------|-------|
| **Internal value** | `compliance_officer` |
| **Entra app role** | `ComplianceOfficer` |
| **Persona** | Compliance manager, regulatory affairs officer, quality assurance lead |
| **Can do** | Everything a Manager can do, plus: read all employee data across the organization, view all qualifications and medical records, access all audit trails, generate compliance reports, view all document review queues. |
| **Cannot do** | Create or modify compliance standards (read-only on standards config). Manage taxonomy/labels. Administer user accounts. Manage escalation rules. |

#### Admin (Level 4)

| Attribute | Value |
|-----------|-------|
| **Internal value** | `admin` |
| **Entra app role** | `Admin` |
| **Persona** | System administrator, IT admin, platform owner |
| **Can do** | Full unrestricted access to all platform capabilities. Create/update employees. Create/update compliance standards and requirements. Manage taxonomy (labels). Manage escalation rules. Send test notifications. Access all data with no scope restrictions. |
| **Cannot do** | Nothing is restricted for Admin. |

---

## 3. Permission Model

### 3.1 Permission Syntax

Permissions follow the pattern:

```
{resource}:{action}
```

**Resources** map to API modules:

| Resource | API Module | Description |
|----------|-----------|-------------|
| `auth` | auth | Authentication and account management |
| `employees` | employees | Employee records and readiness |
| `standards` | standards | Compliance standards and requirements |
| `qualifications` | qualifications | Employee qualifications and certifications |
| `medical` | medical | Medical clearances |
| `documents` | documents | Document upload, review, extraction |
| `hours` | hours | Time tracking, clock in/out, imports |
| `labels` | labels | Taxonomy management |
| `notifications` | notifications | Notification preferences and delivery |
| `audit` | (cross-cutting) | Audit trail access on any module |

**Actions:**

| Action | Description |
|--------|-------------|
| `read` | View/list records |
| `create` | Create new records |
| `update` | Modify existing records |
| `delete` | Remove records (soft-delete) |
| `approve` | Approve/reject in review workflows |
| `export` | Export data or generate reports |

### 3.2 Special Permissions

| Permission | Description |
|-----------|-------------|
| `employees:readiness` | Access readiness dashboard for an employee |
| `qualifications:compliance` | Check compliance status against standards |
| `documents:review` | Access document review queue |
| `documents:extract` | View/correct AI extraction results |
| `hours:import` | Bulk import from payroll/scheduling systems |
| `hours:conflicts` | View and resolve hour conflicts |
| `labels:admin` | Create, update, deprecate labels |
| `labels:resolve` | Resolve label by code/version |
| `notifications:admin` | Manage escalation rules, send test notifications |

### 3.3 Scoped vs. Unscoped Permissions

A permission alone does not determine *which* records are accessible. Permissions answer "can this role perform this action?" while **data scoping** (Section 6) answers "on which records?"

Example: Both Supervisor and Compliance Officer hold `employees:read`, but Supervisor sees only direct reports while Compliance Officer sees all employees.

---

## 4. Role-Permission Matrix

### 4.1 Core Permissions

| Permission | Employee | Supervisor | Manager | Comp. Officer | Admin |
|-----------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| `auth:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `auth:update` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |
| `employees:read` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `employees:create` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `employees:update` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `employees:readiness` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `standards:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `standards:create` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `standards:update` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `qualifications:read` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `qualifications:create` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `qualifications:update` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `qualifications:compliance` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `medical:read` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `medical:create` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `medical:update` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `documents:read` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `documents:create` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `documents:review` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `documents:approve` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `documents:extract` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `hours:read` | ✅² | ✅ | ✅ | ✅ | ✅ |
| `hours:create` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `hours:update` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `hours:delete` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `hours:import` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `hours:conflicts` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `labels:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `labels:resolve` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `labels:admin` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `notifications:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notifications:update` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notifications:delete` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notifications:admin` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `audit:read` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `export:reports` | ❌ | ❌ | ❌ | ✅ | ✅ |

**Notes:**
1. `auth:update` — All authenticated users can change their own password. Admin can manage any account.
2. Scoped to own records only. See [Section 6](#6-data-scoping-rules) for data scoping details.

### 4.2 Permission Inheritance

Because the hierarchy is additive, the matrix can be read as "minimum role required":

| Minimum Role | Permissions Gained at This Level |
|-------------|--------------------------------|
| Employee (0) | `auth:*`, `employees:read`(own), `standards:read`, `qualifications:read`(own), `medical:read`(own), `documents:read`(own), `documents:create`, `hours:read`(own), `hours:create`, `labels:read`, `labels:resolve`, `notifications:read/update/delete` |
| Supervisor (1) | `qualifications:create/update`, `medical:create/update`, `hours:import`, `qualifications:compliance`, `audit:read`, expanded data scope (team) |
| Manager (2) | `documents:review/approve/extract`, `hours:update/delete/conflicts`, expanded data scope (department) |
| Compliance Officer (3) | `export:reports`, expanded data scope (organization-wide read) |
| Admin (4) | `employees:create/update`, `standards:create/update`, `labels:admin`, `notifications:admin`, unrestricted data scope |

---

## 5. API Endpoint Access Table

### Legend

| Column | Description |
|--------|-------------|
| **Endpoint** | HTTP method + path |
| **Permission** | Required `{resource}:{action}` permission |
| **Min Role** | Minimum role level required (hierarchy-enforced) |
| **Auth** | `public` = no auth, `auth` = any authenticated user, `role` = role-restricted |
| **Data Scope** | What records the caller can access |

### 5.1 Auth Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/auth/register` | — | — | public | N/A |
| `POST /api/auth/login` | — | — | public | N/A |
| `POST /api/auth/refresh` | — | — | public | N/A |
| `POST /api/auth/change-password` | `auth:update` | Employee | auth | Own account only |
| `GET /api/auth/oauth/callback` | — | — | public | N/A |

### 5.2 Employees Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/employees` | `employees:create` | Admin | role | N/A (creates new) |
| `GET /api/employees` | `employees:read` | Supervisor | role | Supervisor: direct reports · Manager: department · CO/Admin: all |
| `GET /api/employees/:id` | `employees:read` | Employee | auth | Employee: own record only · Supervisor: team · Manager: department · CO/Admin: all |
| `PUT /api/employees/:id` | `employees:update` | Admin | role | Admin: any record |
| `GET /api/employees/:id/readiness` | `employees:readiness` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |

### 5.3 Standards Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/standards` | `standards:create` | Admin | role | N/A (creates new) |
| `GET /api/standards` | `standards:read` | Employee | auth | All (standards are global reference data) |
| `GET /api/standards/:id` | `standards:read` | Employee | auth | All |
| `PUT /api/standards/:id` | `standards:update` | Admin | role | Any standard |
| `POST /api/standards/:id/requirements` | `standards:create` | Admin | role | N/A (creates new) |
| `GET /api/standards/:id/requirements` | `standards:read` | Employee | auth | All |
| `PUT /api/standards/requirements/:reqId` | `standards:update` | Admin | role | Any requirement |

### 5.4 Qualifications Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/qualifications` | `qualifications:create` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `GET /api/qualifications` | `qualifications:read` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/qualifications/employee/:employeeId` | `qualifications:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/qualifications/compliance/:employeeId/:standardId` | `qualifications:compliance` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/qualifications/:id` | `qualifications:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `PUT /api/qualifications/:id` | `qualifications:update` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `GET /api/qualifications/:id/audit` | `audit:read` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |

### 5.5 Medical Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/medical` | `medical:create` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `GET /api/medical/:id` | `medical:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `PUT /api/medical/:id` | `medical:update` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `GET /api/medical/employee/:employeeId` | `medical:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/medical/:id/audit` | `audit:read` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |

### 5.6 Documents Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/documents/upload` | `documents:create` | Employee | auth | Creates document linked to uploading user |
| `GET /api/documents/review-queue` | `documents:review` | Manager | role | Manager: department · CO/Admin: all |
| `GET /api/documents/:id` | `documents:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/documents/:id/extraction` | `documents:extract` | Manager | role | Manager: department · CO/Admin: all |
| `PUT /api/documents/:id/extraction/:fieldId/correct` | `documents:extract` | Manager | role | Manager: department · CO/Admin: all |
| `POST /api/documents/:id/review` | `documents:approve` | Manager | role | Manager: department · CO/Admin: all |
| `GET /api/documents/:id/audit` | `audit:read` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |

### 5.7 Hours Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/hours/clock-in` | `hours:create` | Employee | auth | Own record (employeeId must match caller or be authorized) |
| `POST /api/hours/clock-out` | `hours:create` | Employee | auth | Own record |
| `POST /api/hours/manual` | `hours:create` | Employee | auth | Own record (with attestation) |
| `POST /api/hours/import/payroll` | `hours:import` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `POST /api/hours/import/scheduling` | `hours:import` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: any |
| `POST /api/hours/calendar/sync` | `hours:create` | Employee | auth | Own calendar only |
| `GET /api/hours/employee/:id` | `hours:read` | Employee | auth | Employee: own only · Supervisor: team · Manager: department · CO/Admin: all |
| `GET /api/hours/conflicts` | `hours:conflicts` | Manager | role | Manager: department · CO/Admin: all |
| `POST /api/hours/conflicts/:id/resolve` | `hours:conflicts` | Manager | role | Manager: department · CO/Admin: any |
| `PUT /api/hours/:id` | `hours:update` | Manager | role | Manager: department · CO/Admin: any |
| `DELETE /api/hours/:id` | `hours:delete` | Manager | role | Manager: department · CO/Admin: any |
| `GET /api/hours/:id/audit` | `audit:read` | Supervisor | role | Supervisor: team · Manager: department · CO/Admin: all |

### 5.8 Labels Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `POST /api/labels/admin` | `labels:admin` | Admin | role | N/A (creates new) |
| `PUT /api/labels/admin/:id` | `labels:admin` | Admin | role | Any label |
| `POST /api/labels/admin/:id/deprecate` | `labels:admin` | Admin | role | Any label |
| `GET /api/labels/versions` | `labels:read` | Employee | auth | All (reference data) |
| `POST /api/labels/mappings` | `labels:admin` | Admin | role | N/A (creates new) |
| `GET /api/labels/resolve` | `labels:resolve` | Employee | auth | All (reference data) |
| `GET /api/labels/audit/:id` | `audit:read` | Supervisor | role | All (audit data scoped by label) |

### 5.9 Notifications Module

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `GET /api/notifications/preferences` | `notifications:read` | Employee | auth | Own preferences only |
| `POST /api/notifications/preferences` | `notifications:update` | Employee | auth | Own preferences only |
| `GET /api/notifications` | `notifications:read` | Employee | auth | Own notifications only |
| `PUT /api/notifications/:id/read` | `notifications:update` | Employee | auth | Own notifications only |
| `DELETE /api/notifications/:id` | `notifications:delete` | Employee | auth | Own notifications only |
| `GET /api/notifications/digest/weekly` | `notifications:read` | Employee | auth | Own digest only |
| `POST /api/notifications/admin/test` | `notifications:admin` | Admin | role | Any user |
| `POST /api/notifications/admin/escalation-rules` | `notifications:admin` | Admin | role | N/A (creates new) |
| `GET /api/notifications/admin/escalation-rules` | `notifications:admin` | Admin | role | All rules |

### 5.10 Global Endpoints

| Endpoint | Permission | Min Role | Auth | Data Scope |
|----------|-----------|----------|------|-----------|
| `GET /health` | — | — | public | N/A |

### 5.11 Endpoint Count Summary

| Module | Total Endpoints | Public | Auth-only | Role-restricted |
|--------|:--------------:|:------:|:---------:|:---------------:|
| Auth | 5 | 4 | 1 | 0 |
| Employees | 5 | 0 | 2 | 3 |
| Standards | 7 | 0 | 3 | 4 |
| Qualifications | 7 | 0 | 3 | 4 |
| Medical | 5 | 0 | 2 | 3 |
| Documents | 7 | 0 | 2 | 5 |
| Hours | 12 | 0 | 5 | 7 |
| Labels | 7 | 0 | 3 | 4 |
| Notifications | 9 | 0 | 6 | 3 |
| Global | 1 | 1 | 0 | 0 |
| **Total** | **65** | **5** | **27** | **33** |

---

## 6. Data Scoping Rules

### 6.1 Scope Definitions

| Scope | Rule | SQL Pattern |
|-------|------|-------------|
| **Own** | Only the authenticated user's records | `WHERE employeeId = :callerId` |
| **Team** | Direct reports + own records | `WHERE employeeId IN (SELECT id FROM employees WHERE supervisorId = :callerId) OR employeeId = :callerId` |
| **Department** | All employees in the same department | `WHERE departmentId = :callerDeptId` |
| **Organization** | All records across all departments | No filter (or `WHERE 1=1`) |

### 6.2 Scope by Role

| Role | Default Scope | Read | Write | Notes |
|------|:------------:|:----:|:-----:|-------|
| Employee | Own | Own records only | Own records only | Cannot read other employees' data even by ID |
| Supervisor | Team | Direct reports + own | Direct reports + own | Determined by `supervisorId` relationship |
| Manager | Department | All in department | All in department | Determined by `departmentId` match |
| Compliance Officer | Organization | All (read) | Department (write) | Can read everything; write limited to department scope |
| Admin | Organization | All | All | No restrictions |

### 6.3 Per-Module Scoping Details

#### Employees

| Role | `GET /employees` | `GET /employees/:id` | `GET /employees/:id/readiness` |
|------|-----------------|---------------------|-------------------------------|
| Employee | N/A (no list access) | Own record only (`:id` must equal caller) | Own readiness only |
| Supervisor | Direct reports list | Direct reports + own | Team readiness |
| Manager | Department employees | Department employees | Department readiness |
| Compliance Officer | All employees | All employees | All readiness |
| Admin | All employees | All employees | All readiness |

#### Qualifications / Medical

| Role | List | Get by Employee | Get by ID | Create/Update |
|------|------|----------------|-----------|--------------|
| Employee | N/A | Own only | Own only | N/A |
| Supervisor | Team | Team | Team | Team |
| Manager | Department | Department | Department | Department |
| Compliance Officer | All | All | All | Department |
| Admin | All | All | All | All |

#### Documents

| Role | Upload | Get Document | Review Queue | Approve/Reject |
|------|--------|-------------|-------------|----------------|
| Employee | Own documents | Own only | N/A | N/A |
| Supervisor | Own documents | Team | N/A | N/A |
| Manager | Own documents | Department | Department pending docs | Department |
| Compliance Officer | Own documents | All | All pending docs | All |
| Admin | Any | All | All | All |

#### Hours

| Role | Clock In/Out | Manual Entry | Get Hours | Edit/Delete | Conflicts | Import |
|------|:------------|:------------|:---------|:-----------|:----------|:-------|
| Employee | Own | Own | Own | N/A | N/A | N/A |
| Supervisor | Own | Own | Team | N/A | N/A | Team |
| Manager | Own | Own | Department | Department | Department | Department |
| Compliance Officer | Own | Own | All | Department | All | All |
| Admin | Any | Any | All | All | All | All |

#### Reference Data (Standards, Labels)

Standards and labels are **global reference data** — all authenticated users can read them. Write access is Admin-only. No row-level scoping applies; these are organizational resources, not per-employee data.

#### Notifications

Notifications are **always scoped to own records** regardless of role. The exception is Admin-only endpoints (`/admin/*`) which operate on system-wide configuration (escalation rules, test notifications targeting any user).

### 6.4 Scope Enforcement Pattern

```typescript
// Service layer — applied in every query method
function buildScopeFilter(caller: AuthenticatedUser, targetEmployeeId?: string): PrismaWhere {
  switch (caller.role) {
    case 'employee':
      return { employeeId: caller.id };

    case 'supervisor':
      return {
        OR: [
          { employeeId: caller.id },
          { employee: { supervisorId: caller.id } },
        ],
      };

    case 'manager':
      return { employee: { departmentId: caller.departmentId } };

    case 'compliance_officer':
      // Read: no filter. Write: department filter.
      return {}; // Caller must check read vs. write context

    case 'admin':
      return {};

    default:
      throw new ForbiddenError();
  }
}
```

### 6.5 Ownership Validation for Write Operations

When a Supervisor or Manager creates/updates records (qualifications, medical, hours), the target employee must be within their scope:

```typescript
async function validateWriteScope(caller: AuthenticatedUser, targetEmployeeId: string): Promise<void> {
  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { id: true, supervisorId: true, departmentId: true },
  });

  if (!target) throw new NotFoundError('Employee');

  switch (caller.role) {
    case 'supervisor':
      if (target.id !== caller.id && target.supervisorId !== caller.id)
        throw new ForbiddenError('Employee not in your team');
      break;
    case 'manager':
    case 'compliance_officer':
      if (target.departmentId !== caller.departmentId)
        throw new ForbiddenError('Employee not in your department');
      break;
    case 'admin':
      break; // No restriction
    default:
      throw new ForbiddenError();
  }
}
```

---

## 7. UI Visibility Rules

### 7.1 Navigation Items

| Navigation Item | Employee | Supervisor | Manager | Comp. Officer | Admin |
|----------------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Qualifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Medical | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team Overview | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee List | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Detail | ❌ | ✅ | ✅ | ✅ | ✅ |
| Document Review | ❌ | ❌ | ✅ | ✅ | ✅ |
| Hour Conflicts | ❌ | ❌ | ✅ | ✅ | ✅ |
| Compliance Reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Standards Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| Label/Taxonomy Mgmt | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| Escalation Rules | ❌ | ❌ | ❌ | ❌ | ✅ |
| System Settings | ❌ | ❌ | ❌ | ❌ | ✅ |

### 7.2 Dashboard Content

| Dashboard Widget | Employee | Supervisor | Manager | Comp. Officer | Admin |
|-----------------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| Personal readiness status | ✅ | ✅ | ✅ | ✅ | ✅ |
| Expiring qualifications (own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recent notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team readiness summary | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team expiring qualifications | ❌ | ✅ | ✅ | ✅ | ✅ |
| Department compliance overview | ❌ | ❌ | ✅ | ✅ | ✅ |
| Documents pending review | ❌ | ❌ | ✅ | ✅ | ✅ |
| Unresolved hour conflicts | ❌ | ❌ | ✅ | ✅ | ✅ |
| Organization-wide compliance | ❌ | ❌ | ❌ | ✅ | ✅ |
| System health / audit summary | ❌ | ❌ | ❌ | ❌ | ✅ |

### 7.3 Action Buttons

| Action | Employee | Supervisor | Manager | Comp. Officer | Admin |
|--------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| Upload Document (own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clock In/Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Manual Hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Qualification | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Qualification | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Medical Clearance | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Medical Clearance | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approve/Reject Document | ❌ | ❌ | ✅ | ✅ | ✅ |
| Resolve Hour Conflict | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit Hour Record | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete Hour Record | ❌ | ❌ | ✅ | ✅ | ✅ |
| Import Payroll/Scheduling | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export Compliance Report | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create Employee | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit Employee | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create/Edit Standard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage Labels | ❌ | ❌ | ❌ | ❌ | ✅ |
| Send Test Notification | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage Escalation Rules | ❌ | ❌ | ❌ | ❌ | ✅ |

### 7.4 Frontend Implementation Pattern

```tsx
// Permission-based component visibility
function PermissionGate({ permission, children }: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!hasPermission(user.role, permission)) return null;
  return <>{children}</>;
}

// Usage
<PermissionGate permission="documents:review">
  <ReviewQueueButton />
</PermissionGate>

// Route guard
function ProtectedRoute({ minRole, children }: {
  minRole: Role;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (RoleHierarchy[user.role] < RoleHierarchy[minRole]) {
    return <Navigate to="/unauthorized" />;
  }
  return <>{children}</>;
}
```

---

## 8. Entra ID Group Mapping

### 8.1 Security Groups

| Entra Group Name | App Role Assigned | E-CLAT Role | Hierarchy Level |
|------------------|------------------|-------------|:---------------:|
| `eclat-{env}-employees` | `Employee` | `employee` | 0 |
| `eclat-{env}-supervisors` | `Supervisor` | `supervisor` | 1 |
| `eclat-{env}-managers` | `Manager` | `manager` | 2 |
| `eclat-{env}-compliance-officers` | `ComplianceOfficer` | `compliance_officer` | 3 |
| `eclat-{env}-admins` | `Admin` | `admin` | 4 |

**`{env}`** = `dev`, `staging`, or `prod`.

### 8.2 Nested Groups for Hierarchy

Entra security groups support nesting to enforce the additive hierarchy principle:

```
eclat-{env}-admins
  └── eclat-{env}-compliance-officers
       └── eclat-{env}-managers
            └── eclat-{env}-supervisors
                 └── eclat-{env}-employees
```

> **Important:** While Entra supports nested groups, the `groups` claim in access tokens only includes the direct group memberships by default. The E-CLAT backend resolves hierarchy through the `RoleHierarchy` map in code, not through group nesting. Nesting is used primarily for organizational clarity and Entra Conditional Access policies.

### 8.3 App Registration Scopes

Defined on the **`eclat-api-{env}`** app registration:

| Scope | URI | Description | Consumed By |
|-------|-----|-------------|-------------|
| `Employees.Read` | `api://eclat-api-{env}/Employees.Read` | Read employee records | web, admin |
| `Employees.ReadWrite` | `api://eclat-api-{env}/Employees.ReadWrite` | Create/update employees | web, admin |
| `Qualifications.Read` | `api://eclat-api-{env}/Qualifications.Read` | Read qualifications | web, admin |
| `Qualifications.ReadWrite` | `api://eclat-api-{env}/Qualifications.ReadWrite` | Manage qualifications | web, admin |
| `Medical.Read` | `api://eclat-api-{env}/Medical.Read` | Read medical clearances | web, admin |
| `Medical.ReadWrite` | `api://eclat-api-{env}/Medical.ReadWrite` | Manage medical clearances | web, admin |
| `Standards.Read` | `api://eclat-api-{env}/Standards.Read` | Read standards | admin |
| `Standards.ReadWrite` | `api://eclat-api-{env}/Standards.ReadWrite` | Manage standards | admin |
| `Documents.Read` | `api://eclat-api-{env}/Documents.Read` | Read documents | web, admin |
| `Documents.ReadWrite` | `api://eclat-api-{env}/Documents.ReadWrite` | Manage documents | web, admin |
| `Admin.Full` | `api://eclat-api-{env}/Admin.Full` | Full administrative access | admin |

**Scopes vs. Roles:** Scopes control *what the client app can request*. Roles control *what the user is allowed to do*. Both must be valid for an operation to succeed. A web app with `Employees.Read` scope and a user with the `Manager` role can read department employees. The same user accessing via an app without `Employees.Read` scope would be denied.

### 8.4 App Role Definition (Terraform)

```hcl
# In 05-identity layer
resource "azuread_application" "api" {
  display_name = "eclat-api-${var.environment}"

  app_role {
    allowed_member_types = ["User"]
    display_name         = "Employee"
    value                = "Employee"
    id                   = "<stable-uuid>"
    description          = "Base access for employee self-service"
  }

  app_role {
    allowed_member_types = ["User"]
    display_name         = "Supervisor"
    value                = "Supervisor"
    id                   = "<stable-uuid>"
    description          = "Team oversight and qualification management"
  }

  app_role {
    allowed_member_types = ["User"]
    display_name         = "Manager"
    value                = "Manager"
    id                   = "<stable-uuid>"
    description          = "Department operations and document review"
  }

  app_role {
    allowed_member_types = ["User"]
    display_name         = "ComplianceOfficer"
    value                = "ComplianceOfficer"
    id                   = "<stable-uuid>"
    description          = "Organization-wide compliance authority"
  }

  app_role {
    allowed_member_types = ["User"]
    display_name         = "Admin"
    value                = "Admin"
    id                   = "<stable-uuid>"
    description          = "Full platform administration"
  }
}
```

### 8.5 Token Claims

When a user authenticates, their access token includes:

```json
{
  "roles": ["Manager"],
  "groups": ["<group-object-id>"],
  "scp": "Employees.Read Employees.ReadWrite Qualifications.Read"
}
```

The backend maps `roles[0]` → internal `Role` enum using `EntraAppRoleToRole` mapping:

```typescript
const EntraAppRoleToRole: Record<string, Role> = {
  'Employee':          'employee',
  'Supervisor':        'supervisor',
  'Manager':           'manager',
  'ComplianceOfficer': 'compliance_officer',
  'Admin':             'admin',
};
```

If a user has multiple roles (e.g., `["Manager", "ComplianceOfficer"]`), the system uses the **highest** role for authorization decisions.

---

## 9. Implementation Patterns

### 9.1 API Middleware

#### `authenticate` — Token Validation

Validates the Bearer token and populates `req.user`. Applied to all non-public endpoints.

```typescript
// apps/api/src/middleware/auth.ts
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next(new UnauthorizedError());

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    req.user = verifyAccessToken(token); // Returns { id, email, role }
    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
```

#### `requireRole` — Exact Role Match

Restricts access to specific roles. Use when **only certain roles** should access an endpoint (not hierarchy-based).

```typescript
export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!allowedRoles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}

// Usage: Only Admin can create employees
router.post('/', authenticate, requireRole(Roles.ADMIN), createEmployee);
```

#### `requireMinRole` — Hierarchy-Based Access

Restricts access to a minimum role level and above. **Preferred** for most endpoints because it respects the hierarchy.

```typescript
export function requireMinRole(minRole: Role) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (RoleHierarchy[req.user.role] < RoleHierarchy[minRole]) return next(new ForbiddenError());
    next();
  };
}

// Usage: Supervisor and above can create qualifications
router.post('/', authenticate, requireMinRole(Roles.SUPERVISOR), createQualification);
```

#### `requirePermission` — Permission-Based Access (Target State)

For the permission-first architecture, implement a permission-checking middleware:

```typescript
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!hasPermission(req.user.role, permission)) return next(new ForbiddenError());
    next();
  };
}

function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Usage: More expressive and future-proof
router.post('/', authenticate, requirePermission('employees:create'), createEmployee);
```

### 9.2 When to Use Which Middleware

| Middleware | Use When | Example |
|-----------|---------|---------|
| `authenticate` only | Any authenticated user can access, but data scoping applies in the service layer | `GET /employees/:id` (employee sees own, supervisor sees team) |
| `requireRole(ADMIN)` | Only a specific role should ever access this | `POST /employees` (only Admin creates users) |
| `requireMinRole(SUPERVISOR)` | A minimum level is required, hierarchy applies | `GET /qualifications` (Supervisor and above) |
| `requirePermission('x:y')` | Permission-based (target state for custom roles) | `POST /documents/:id/review` |

### 9.3 Frontend Route Guards

```tsx
// apps/web/src/router.tsx
const routes = [
  // Public
  { path: '/login', element: <Login />, public: true },

  // Any authenticated user
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/profile', element: <Profile /> },

  // Supervisor+
  { path: '/team', element: <TeamOverview />, minRole: 'supervisor' },
  { path: '/employees', element: <EmployeeList />, minRole: 'supervisor' },
  { path: '/employees/:id', element: <EmployeeDetail />, minRole: 'supervisor' },

  // Manager+
  { path: '/review-queue', element: <DocumentReview />, minRole: 'manager' },
  { path: '/conflicts', element: <HourConflicts />, minRole: 'manager' },

  // Compliance Officer+
  { path: '/reports', element: <ComplianceReports />, minRole: 'compliance_officer' },

  // Admin only
  { path: '/admin/standards', element: <StandardsManagement />, minRole: 'admin' },
  { path: '/admin/labels', element: <LabelManagement />, minRole: 'admin' },
  { path: '/admin/users', element: <UserManagement />, minRole: 'admin' },
  { path: '/admin/escalation', element: <EscalationRules />, minRole: 'admin' },
];
```

### 9.4 Data Layer Filtering (Prisma)

```typescript
// Generic scope filter builder
function scopedWhere(caller: AuthenticatedUser): Prisma.QualificationWhereInput {
  const role = caller.role;

  if (role === 'admin' || role === 'compliance_officer') {
    return {}; // No filter — sees everything
  }

  if (role === 'manager') {
    return { employee: { departmentId: caller.departmentId } };
  }

  if (role === 'supervisor') {
    return {
      OR: [
        { employeeId: caller.id },
        { employee: { supervisorId: caller.id } },
      ],
    };
  }

  // Employee — own records only
  return { employeeId: caller.id };
}

// Service method example
async function listQualifications(caller: AuthenticatedUser, query: QualificationQuery) {
  return prisma.qualification.findMany({
    where: {
      ...scopedWhere(caller),
      ...(query.standardId ? { standardId: query.standardId } : {}),
    },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
}
```

### 9.5 Audit Trail for Authorization Decisions

Every denied authorization attempt and every access to regulated data must be logged:

```typescript
// Audit on denial (in middleware)
export function requireMinRole(minRole: Role) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());

    if (RoleHierarchy[req.user.role] < RoleHierarchy[minRole]) {
      await auditLogger.log({
        action: 'access_denied',
        entityType: 'authorization',
        recordId: req.path,
        actor: req.user.id,
        changedFields: {
          requiredRole: minRole,
          actualRole: req.user.role,
          method: req.method,
          path: req.originalUrl,
        },
      });
      return next(new ForbiddenError());
    }
    next();
  };
}

// Audit on access to sensitive data
async function getMedicalClearance(caller: AuthenticatedUser, id: string) {
  const clearance = await prisma.medicalClearance.findUnique({ where: { id } });

  await auditLogger.log({
    action: 'read',
    entityType: 'medical_clearance',
    recordId: id,
    actor: caller.id,
    changedFields: { accessedEmployeeId: clearance?.employeeId },
  });

  return clearance;
}
```

### 9.6 Testing Authorization

Every endpoint must have tests for:

1. **401 Unauthorized** — No token provided
2. **403 Forbidden** — Valid token, insufficient role
3. **200/201 OK** — Valid token, sufficient role
4. **Data scope** — Correct role but accessing out-of-scope data returns 403 or empty results

```typescript
describe('POST /api/qualifications', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/qualifications').send(validPayload);
    expect(res.status).toBe(401);
  });

  it('returns 403 for Employee role', async () => {
    const res = await request(app)
      .post('/api/qualifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('returns 201 for Supervisor with team member', async () => {
    const res = await request(app)
      .post('/api/qualifications')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ ...validPayload, employeeId: directReportId });
    expect(res.status).toBe(201);
  });

  it('returns 403 for Supervisor with non-team member', async () => {
    const res = await request(app)
      .post('/api/qualifications')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ ...validPayload, employeeId: otherDeptEmployeeId });
    expect(res.status).toBe(403);
  });
});
```

---

## 10. Future Extensibility

### 10.1 Custom Roles

When the platform supports custom roles (Phase 2+), the model extends naturally:

#### How It Works

1. **Admin creates a custom role** via the admin UI or API
2. **System creates an Entra security group** named `eclat-{env}-custom-{role-slug}`
3. **Admin assigns permissions** from the existing `{resource}:{action}` permission set
4. **System creates an app role** on the API app registration (or reuses permission groups)
5. **Users are assigned** to the custom group
6. **Token includes** the custom role in the `roles` claim
7. **Backend maps** the custom role to its permission set and applies them

#### Schema Extension

```typescript
// Future: Custom role definition
interface CustomRole {
  id: string;
  name: string;           // "Shift Lead"
  slug: string;           // "shift-lead"
  description: string;
  entraGroupId: string;   // Entra security group object ID
  permissions: string[];  // ["employees:read", "qualifications:read", "hours:read"]
  dataScope: DataScope;   // "team" | "department" | "organization"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

enum DataScope {
  Own = 'own',
  Team = 'team',
  Department = 'department',
  Organization = 'organization',
}
```

#### Database Model (Future)

```prisma
model CustomRole {
  id           String   @id @default(uuid())
  name         String   @unique
  slug         String   @unique
  description  String?
  entraGroupId String?
  dataScope    DataScope @default(OWN)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  permissions  CustomRolePermission[]
}

model CustomRolePermission {
  id         String     @id @default(uuid())
  roleId     String
  role       CustomRole @relation(fields: [roleId], references: [id])
  permission String     // "employees:read"

  @@unique([roleId, permission])
}
```

### 10.2 No Hardcoded Role Names in Business Logic

**Critical rule for implementation:** Business logic must never check role names directly. Always use permission checks.

```typescript
// ❌ WRONG — Breaks when custom roles are added
if (user.role === 'manager' || user.role === 'admin') {
  // allow document review
}

// ✅ CORRECT — Works with predefined and custom roles
if (hasPermission(user, 'documents:review')) {
  // allow document review
}

// ❌ WRONG — Hardcoded hierarchy check
if (RoleHierarchy[user.role] >= 2) {
  // allow something
}

// ✅ CORRECT — Permission-based
if (hasPermission(user, 'documents:approve')) {
  // allow something
}
```

### 10.3 Permission Resolution for Custom Roles

```typescript
async function hasPermission(user: AuthenticatedUser, permission: string): Promise<boolean> {
  // 1. Check predefined role permissions (fast, in-memory)
  if (PREDEFINED_ROLE_PERMISSIONS[user.role]?.includes(permission)) {
    return true;
  }

  // 2. Check custom role permissions (database lookup, cached)
  if (user.customRoles?.length) {
    const customPerms = await getCustomRolePermissions(user.customRoles);
    return customPerms.includes(permission);
  }

  return false;
}
```

### 10.4 Migration Path

| Phase | State | Notes |
|-------|-------|-------|
| **Now (MVP)** | 5 predefined roles, `requireRole` / `requireMinRole` middleware | Simple, proven pattern |
| **Phase 2** | Add `requirePermission` middleware alongside existing | Both patterns coexist; predefined roles resolved from static map |
| **Phase 3** | Custom roles in database + Entra groups | `requirePermission` resolves from both static map and database |
| **Phase 4** | Deprecate `requireRole` / `requireMinRole` | All authorization through permission checks |

---

## Appendix: Permission Quick Reference

### Complete Permission List

| # | Permission | Description | Min Predefined Role |
|---|-----------|-------------|:-------------------:|
| 1 | `auth:read` | View own auth info | Employee |
| 2 | `auth:update` | Change own password | Employee |
| 3 | `employees:read` | View employee records | Employee (own) |
| 4 | `employees:create` | Create employee accounts | Admin |
| 5 | `employees:update` | Modify employee records | Admin |
| 6 | `employees:readiness` | View readiness dashboard | Employee (own) |
| 7 | `standards:read` | View compliance standards | Employee |
| 8 | `standards:create` | Create standards | Admin |
| 9 | `standards:update` | Modify standards | Admin |
| 10 | `qualifications:read` | View qualifications | Employee (own) |
| 11 | `qualifications:create` | Create qualifications | Supervisor |
| 12 | `qualifications:update` | Modify qualifications | Supervisor |
| 13 | `qualifications:compliance` | Check compliance status | Supervisor |
| 14 | `medical:read` | View medical clearances | Employee (own) |
| 15 | `medical:create` | Create medical clearances | Supervisor |
| 16 | `medical:update` | Modify medical clearances | Supervisor |
| 17 | `documents:read` | View documents | Employee (own) |
| 18 | `documents:create` | Upload documents | Employee |
| 19 | `documents:review` | Access review queue | Manager |
| 20 | `documents:approve` | Approve/reject documents | Manager |
| 21 | `documents:extract` | View/correct AI extractions | Manager |
| 22 | `hours:read` | View hour records | Employee (own) |
| 23 | `hours:create` | Clock in/out, manual entry | Employee |
| 24 | `hours:update` | Edit hour records | Manager |
| 25 | `hours:delete` | Soft-delete hour records | Manager |
| 26 | `hours:import` | Bulk payroll/scheduling import | Supervisor |
| 27 | `hours:conflicts` | View/resolve conflicts | Manager |
| 28 | `labels:read` | View labels and versions | Employee |
| 29 | `labels:resolve` | Resolve label by code/version | Employee |
| 30 | `labels:admin` | Create/update/deprecate labels | Admin |
| 31 | `notifications:read` | View own notifications | Employee |
| 32 | `notifications:update` | Mark read, set preferences | Employee |
| 33 | `notifications:delete` | Dismiss notifications | Employee |
| 34 | `notifications:admin` | Escalation rules, test sends | Admin |
| 35 | `audit:read` | View audit trails | Supervisor |
| 36 | `export:reports` | Generate compliance reports | Compliance Officer |

**Total: 36 permissions across 11 resource categories.**

---

*This document is the single source of truth for RBAC in E-CLAT. All implementation by Bunk (backend), Kima (frontend), and Sydnor (testing) must conform to the access rules defined here. The Source PRD ([`docs/requirements/eclat-spec.md`](../requirements/eclat-spec.md)) is the product north star; where this spec differs from the PRD, the deltas are documented in the "PRD RBAC Deltas" section above. Any deviation requires an architecture decision record and Freamon's approval.*
