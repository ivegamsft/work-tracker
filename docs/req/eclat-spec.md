# e-clat Specification
## Employee Compliance and Lifecycle Activity Tracker

---

## 1. PRODUCT OVERVIEW

**Purpose:** Workforce readiness and qualification management system for regulated industries. Tracks employee certifications, hours of experience, medical clearance status, and internal test results to maintain continuous proof of competency across multiple industry standards.

**Core Value Proposition:** e-clat builds and proves employee readiness through layered, transparent tracking of qualifications, hours, and validation—earning compliance continuously.

**Key Principles:**
- Transparency: All proof visible through layers (validation visible at every level)
- Earned: Hours and proof accumulate into competency
- Auditable: Complete tracking trail for compliance frameworks
- Multi-source: Hours from clock systems, payroll, scheduling, calendars, manual entry
- Standards-agnostic: Support multiple frameworks (OSHA, FAA, DOT, ISO, etc.)

---

## 2. CORE FUNCTIONALITY

### 2.1 Hours Tracking
- **Clock-in/Clock-out**: Real-time punch system tied to specific jobs/roles
- **Timesheet Imports**: Sync from payroll systems (API integration)
- **Job-Ticket Sync**: Link hours to specific job assignments
- **Calendar Integration**: OAuth2 calendar sync to label work blocks
- **Manual Entry**: Manager-approved manual hour logging
- **Hour Categorization**: Label hours by job type, certification category, project
- **Hour Aggregation**: Combine all sources into single ledger per employee

### 2.2 Certifications Management
- **Certification Tracking**: Store certification name, issuer, date issued, expiration date
- **Document Upload**: Support multiple file formats (PDF, images, documents)
- **AI Document Processing**: 
  - OCR/text extraction from uploaded documents
  - Automatic expiration date detection
  - Certification classification against known standards
  - Standards matching (detect which frameworks the cert satisfies)
- **Manual Entry**: Admin/manager input for pre-digitized certifications
- **Approval Workflow**: Human review and approval of AI-extracted data
- **Expiration Tracking**: Alert managers/employees of upcoming expirations

### 2.3 Medical Clearance Status
- **Fit-for-Duty Status**: Pass/Fail or Cleared/Not Cleared only
- **Expiration Date**: When clearance expires
- **Test Categories**: Visual acuity, color blindness, other role-specific tests
- **No Detailed Records**: Store only status and expiration (HIPAA-safe)
- **Alert System**: Escalate overdue clearances to managers

### 2.4 Standards Framework & Requirements Mapping
- **Framework Support**: Define requirements for multiple standards (OSHA, FAA, DOT, ISO, custom)
- **Role-Based Requirements**: Map which certs/hours/clearances required per job type
- **Requirement Status**: Track completion status for each requirement per employee
- **Auto-Compliance Checking**: Compare employee qualifications against role requirements
- **Gap Identification**: Flag missing certifications, insufficient hours, expired clearances
- **Compliance Readiness Score**: Calculate overall readiness percentage per employee

### 2.5 Notifications & Escalations
- **Manager Escalation**: Alert managers when requirements overdue
- **Employee Reminder**: Notify employees of expiring certifications (self-service)
- **Weekly Compliance Digest**: Aggregate compliance status across team/organization
- **Notification Channels**: In-app, email, SMS (configurable by role)

### 2.6 Audit & Reporting
- **Audit Trail**: Complete log of all changes, approvals, data entries
- **Compliance Report**: Generate reports by employee, role, standard framework
- **Export Capability**: Generate CSV/PDF for regulatory submissions
- **Historical Tracking**: Version control on all certification and hour changes

---

## 3. SCREENS & USER INTERFACES

### 3.1 EMPLOYEE SELF-SERVICE
**Limited visibility to own profile/readiness (MVP)**

#### Screen 1.1: Dashboard
- Employee name, role, job type
- Overall readiness score (%)
- Next expiration date (countdown)
- Upcoming required certifications/hours
- Recent activity log (last 5 entries)

#### Screen 1.2: My Certifications
- Table: Certification name | Issuer | Issued Date | Expiration | Status (Active/Expiring/Expired)
- Upload new certification (button)
- View details: expand cert to see issuer, expiration, linked standards

#### Screen 1.3: My Hours
- Total hours logged (by category)
- Hours by job type/certification category (breakdown)
- Recent entries (table): Date | Job Type | Hours | Source (Clock-in/Timesheet/Manual)
- Calendar view option (visual timeline of hours)

#### Screen 1.4: My Requirements
- Current role requirements (filterable by standard)
- Status per requirement: Met/In Progress/Not Started
- Countdown timers for expiring certifications
- "View Details" for each requirement

#### Screen 1.5: Medical Clearance Status
- Current status: Cleared/Not Cleared
- Expiration date
- Test types required for role
- Alert if expiring

#### Screen 1.6: Notifications
- List of unread notifications (escalations, reminders, digests)
- Notification preferences (email/SMS/in-app toggle)

### 3.2 MANAGER/SUPERVISOR
**Supervision, approval, team oversight**

#### Screen 2.1: Team Dashboard
- Team roster with readiness score per employee (color-coded)
- Open escalations (overdue requirements)
- Weekly compliance digest preview
- Filterable by job type, standard framework

#### Screen 2.2: Employee Profile (Manager View)
- All employee data: certifications, hours, medical status, requirements
- Readiness score breakdown by standard
- Edit permissions: approve manual hours, update certifications
- Action buttons: approve entry, flag for attention, send notification

#### Screen 2.3: Certifications Approval Queue
- Pending AI-extracted certifications awaiting approval
- Preview extracted data: certification name, issuer, dates, detected standards
- Approve/Reject buttons
- Bulk approval capability

#### Screen 2.4: Hours Verification
- Pending manual hour entries awaiting approval
- Show: employee, date range, hours, category, notes
- Approve/Reject with comments
- View clock-in/out data for verification if available

#### Screen 2.5: Requirements & Gaps
- Team requirements view (by standard or role)
- Employees with missing certifications (list)
- Employees with insufficient hours (breakdown by category)
- Employees with expired/expiring clearances
- Batch notification capability (send reminder to multiple employees)

#### Screen 2.6: Escalations & Alerts
- All active escalations (due/overdue items)
- Filter by: employee, requirement type, urgency
- Mark resolved, snooze, or escalate to compliance
- History of escalation actions

#### Screen 2.7: Reports
- Compliance report: PDF export of team readiness
- Certification status report
- Hours summary report
- Audit trail export

### 3.3 COMPLIANCE/AUDITOR
**Full visibility, audit, reporting, standards configuration**

#### Screen 3.1: Organization Dashboard
- High-level compliance metrics (% workforce ready by framework)
- Risk indicators (employees near expiration, missing critical certs)
- Framework status (OSHA, FAA, DOT, etc.)
- Audit-ready indicators

#### Screen 3.2: Employee Directory & Bulk Search
- Search/filter all employees
- Advanced filters: role, job type, certification status, clearance status, readiness score range
- Bulk actions: generate report, send notification, export data

#### Screen 3.3: Compliance Audit View
- Complete audit trail (searchable, filterable by date/employee/action)
- Change log: who changed what, when, why
- Approval chain visibility
- Data integrity checks (flags inconsistencies)

#### Screen 3.4: Standards Configuration
- Manage certification frameworks (OSHA, FAA, DOT, custom)
- Define requirements per job type/role
- Map certifications to standards
- Set renewal intervals per certification
- Configure alerts and escalation rules

#### Screen 3.5: Reports & Analytics
- Compliance dashboard (by framework, by department, by role)
- Certification expiration forecast
- Hours trend analysis
- Employee readiness timeline
- Export full dataset for regulatory submission

#### Screen 3.6: Document Processing Configuration
- AI settings: enable/disable automatic extraction, set confidence thresholds
- Document classification rules
- Supported document types and formats
- API key management for AI services

#### Screen 3.7: User & Role Management
- Manage user accounts, roles, permissions
- Configure notification channels/preferences per role
- Audit user access logs

---

## 4. API SPECIFICATIONS

### 4.1 Authentication & Authorization
```
POST /auth/login
POST /auth/logout
POST /auth/refresh-token
GET /auth/me (current user info)
```

### 4.2 Employees
```
GET /employees
POST /employees
GET /employees/{id}
PUT /employees/{id}
DELETE /employees/{id}
GET /employees/{id}/readiness (readiness score and status)
GET /employees/{id}/requirements-status
```

### 4.3 Hours
```
POST /hours (clock-in/clock-out, manual entry)
GET /hours (list all)
GET /hours/{id}
PUT /hours/{id} (edit manual entry)
DELETE /hours/{id}
GET /hours/employee/{employeeId} (all hours for employee)
GET /hours/summary/{employeeId} (aggregated by category)
GET /hours/calendar/{employeeId} (calendar view)
POST /hours/import/timesheet (bulk import from payroll)
POST /hours/import/schedule (sync from job-ticket system)
POST /hours/import/calendar (sync from OAuth2 calendar)
POST /hours/approve/{id} (manager approval)
POST /hours/reject/{id}
```

### 4.4 Certifications
```
POST /certifications (manual entry or AI-processed)
GET /certifications
GET /certifications/{id}
PUT /certifications/{id}
DELETE /certifications/{id}
GET /certifications/employee/{employeeId}
POST /certifications/upload (upload document)
POST /certifications/process (AI extraction/classification)
GET /certifications/pending-approval (queue for manager)
POST /certifications/approve/{id}
POST /certifications/reject/{id}
GET /certifications/expiring-soon (all expiring within X days)
```

### 4.5 Medical Clearance
```
POST /clearance
GET /clearance/{employeeId}
PUT /clearance/{employeeId}
DELETE /clearance/{employeeId}
GET /clearance/expired-or-expiring
```

### 4.6 Standards & Requirements
```
GET /standards (list all frameworks)
POST /standards (create custom framework)
GET /standards/{id}/requirements
POST /standards/{id}/requirements (add requirement)
PUT /requirements/{id}
DELETE /requirements/{id}
GET /requirements/by-role/{roleId} (requirements for specific role)
POST /requirements/map-certification (link cert to framework)
```

### 4.7 Compliance & Readiness
```
GET /compliance/readiness/{employeeId} (full readiness status)
GET /compliance/readiness/batch (all employees)
GET /compliance/gaps/{employeeId} (missing certs, hours, clearances)
GET /compliance/forecast (upcoming expirations)
POST /compliance/check (run compliance check for employee)
GET /compliance/audit-trail (searchable audit log)
```

### 4.8 Notifications
```
POST /notifications/escalate (send manager escalation)
POST /notifications/send (send notification)
GET /notifications/employee/{employeeId}
GET /notifications/pending-escalations
POST /notifications/digest/weekly (generate weekly digest)
PUT /notifications/preferences/{userId}
```

### 4.9 Reports
```
GET /reports/compliance (PDF/CSV export)
GET /reports/certifications (by employee, by framework)
GET /reports/hours (summary by employee/category)
GET /reports/audit-trail (export audit log)
GET /reports/readiness-timeline (historical readiness)
POST /reports/custom (build custom report)
```

### 4.10 Document Processing (AI)
```
POST /documents/upload
POST /documents/process (OCR, extraction, classification)
GET /documents/{id}/extracted-data
POST /documents/{id}/approve (approve AI extraction)
POST /documents/{id}/reject (reject and re-process)
GET /documents/pending-review
```

### 4.11 Integration Endpoints
```
POST /integrations/oauth/calendar (OAuth2 callback for calendar sync)
POST /integrations/payroll/import (timesheet import)
POST /integrations/scheduling/import (job-ticket sync)
PUT /integrations/{integrationId}/sync (trigger manual sync)
```

### 4.12 Admin & Configuration
```
GET /config/frameworks (all available standards)
POST /config/custom-framework
PUT /config/notification-rules
GET /users
POST /users (create user)
PUT /users/{id}
DELETE /users/{id}
PUT /users/{id}/role (assign role)
GET /audit/user-access-log
```

---

## 5. RBAC (ROLE-BASED ACCESS CONTROL) MATRIX

### 5.1 Role Definitions

| Role | Purpose | Primary Actions |
|------|---------|-----------------|
| **Employee** | Self-service profile/readiness | View own data, upload certs, accept notifications |
| **Manager** | Team oversight, approval | Approve hours/certs, escalate, manage team requirements |
| **Compliance Officer** | Audit, reporting, configuration | Configure standards, generate reports, audit trail access |
| **Admin** | System configuration | User management, integrations, system settings |

### 5.2 Access Matrix by Resource

#### Employees Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /employees (self) | ✅ | ✅ | ✅ | ✅ |
| GET /employees (all) | ❌ | ✅ (team) | ✅ | ✅ |
| POST /employees | ❌ | ❌ | ❌ | ✅ |
| PUT /employees/{id} (self) | ✅ (limited) | ✅ (team) | ❌ | ✅ |
| DELETE /employees | ❌ | ❌ | ❌ | ✅ |

#### Hours Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| POST /hours (manual, self) | ✅ | ✅ (team) | ❌ | ✅ |
| GET /hours (self) | ✅ | ✅ (team) | ✅ | ✅ |
| PUT /hours (self, pending approval) | ✅ | ✅ (team) | ❌ | ✅ |
| POST /hours/approve | ❌ | ✅ (team) | ❌ | ✅ |
| POST /hours/import/* | ❌ | ❌ | ❌ | ✅ |

#### Certifications Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| POST /certifications (manual, self) | ✅ | ✅ (team) | ❌ | ✅ |
| GET /certifications (self) | ✅ | ✅ (team) | ✅ | ✅ |
| POST /certifications/upload (self) | ✅ | ✅ (team) | ❌ | ✅ |
| POST /certifications/approve | ❌ | ✅ (team) | ❌ | ✅ |
| PUT /certifications/{id} | ❌ | ✅ (team) | ❌ | ✅ |

#### Medical Clearance Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /clearance (self) | ✅ | ✅ (team) | ✅ | ✅ |
| POST /clearance | ❌ | ✅ (team) | ❌ | ✅ |
| PUT /clearance | ❌ | ✅ (team) | ❌ | ✅ |

#### Compliance & Requirements Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /compliance/readiness (self) | ✅ | ✅ (team) | ✅ | ✅ |
| GET /compliance/readiness/batch | ❌ | ❌ | ✅ | ✅ |
| GET /compliance/gaps (self) | ✅ | ✅ (team) | ✅ | ✅ |
| GET /standards | ✅ | ✅ | ✅ | ✅ |
| POST /standards | ❌ | ❌ | ✅ | ✅ |
| PUT /requirements | ❌ | ❌ | ✅ | ✅ |

#### Notifications Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /notifications (self) | ✅ | ✅ | ✅ | ✅ |
| POST /notifications/escalate | ❌ | ✅ (team) | ✅ | ✅ |
| PUT /notifications/preferences (self) | ✅ | ✅ | ✅ | ✅ |
| POST /notifications/digest | ❌ | ❌ | ✅ | ✅ |

#### Reports Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /reports/compliance (own role) | ❌ | ✅ (team) | ✅ | ✅ |
| GET /reports/* (all) | ❌ | ❌ | ✅ | ✅ |
| POST /reports/custom | ❌ | ❌ | ✅ | ✅ |

#### Admin Resource
| Action | Employee | Manager | Compliance | Admin |
|--------|----------|---------|------------|-------|
| GET /users | ❌ | ❌ | ❌ | ✅ |
| POST /users | ❌ | ❌ | ❌ | ✅ |
| PUT /users | ❌ | ❌ | ❌ | ✅ |
| PUT /config/* | ❌ | ❌ | ❌ | ✅ |
| GET /audit/user-access-log | ❌ | ❌ | ✅ | ✅ |

### 5.3 Data Scoping Rules

- **Employee**: Can only see/access own data (certifications, hours, clearance, requirements)
- **Manager**: Can see/access data for employees in their team/department (if team-based structure exists)
- **Compliance Officer**: Can see all employee data across organization; cannot edit specific employee records (audit-only)
- **Admin**: Full access to all data and system configuration

### 5.4 Field-Level Access

- Medical clearance **status** (Cleared/Not Cleared): Visible to Employee, Manager, Compliance, Admin
- Medical clearance **details** (test type, scores): Visible to Manager, Compliance, Admin only
- Audit trail: Visible to Compliance Officer and Admin only
- User access logs: Admin only

---

## 6. FEATURE MODULES (Top-Level)

Each feature below is a detailed module to be defined separately:

1. **Hour Aggregation & Sync** — Clock systems, payroll, scheduling, calendar integration
2. **AI Document Processing** — OCR, classification, expiration detection, standards matching
3. **Certification Lifecycle** — Upload, process, approve, track, expire, renew
4. **Medical Clearance Management** — Status tracking, expiration, fit-for-duty validation
5. **Standards Framework Engine** — Multi-standard support, requirement mapping, gap detection
6. **Readiness Scoring** — Calculate compliance percentage, readiness by framework
7. **Notification System** — Escalations, reminders, digest generation, channel management
8. **Audit & Reporting** — Trail logging, report generation, compliance export
9. **User & Integration Management** — Roles, OAuth2 integrations, system config

---

## 7. MVP SCOPE (Phase 1)

- Employee self-service (view own profile, upload certs, see requirements)
- Manager approval workflows (hours, certifications)
- Basic hour tracking (manual + clock-in/out)
- Basic certification management (upload + AI extraction)
- Medical clearance tracking (status only)
- Single standards framework (configurable)
- Readiness score calculation
- Manager escalations and notifications
- Basic compliance report

**Out of MVP:**
- Multi-standard framework support (Phase 2)
- Advanced integrations (payroll, scheduling, OAuth calendar) (Phase 2)
- Custom reporting (Phase 2)
- Advanced analytics (Phase 3)

---

## 8. DATA MODEL (High-Level)

### Core Entities
- **User** (Employee, Manager, Compliance Officer, Admin)
- **Employee Profile** (hours, certifications, clearance, role, job type)
- **Hours Entry** (date, amount, category, source, status, approver)
- **Certification** (name, issuer, issued date, expiration, status, document reference)
- **Medical Clearance** (status, expiration, test type)
- **Requirement** (linked to standard, job type, certification name, hour minimum)
- **Standard Framework** (OSHA, FAA, DOT, custom)
- **Notification** (recipient, type, payload, status, timestamp)
- **Audit Log** (entity, action, old value, new value, user, timestamp)

---

## 9. SECURITY & COMPLIANCE NOTES

- **Medical Data**: Store only fit-for-duty status + expiration (not HIPAA-protected detail)
- **PII**: Encrypt at rest; secure transmission over HTTPS
- **Audit Trail**: Immutable log of all changes
- **Authentication**: OAuth2/JWT recommended
- **Data Retention**: Define per regulatory requirement (GDPR, CCPA, industry standards)

