# Specification: Access Visibility Boundaries and Notification Escalation

**Issue:** #46  
**Owner:** Kima (Frontend), Bunk (Backend), Pearlman (Compliance)  
**Status:** Design Spike  
**Last Updated:** 2026-03-20

---

## 1. Executive Summary

This specification defines how E-CLAT enforces role-based visibility boundaries and implements automatic notification escalation workflows. Users see only employees/records they have authority to manage. Supervisors see their direct team; managers see their department; compliance officers see all; admins see all with audit access. Unacknowledged notifications automatically escalate through the hierarchy (employee → supervisor → manager → compliance officer) after configurable delays, ensuring critical compliance tasks don't fall through cracks. The system supports configurable escalation rules and provides admin screens to manage escalation timeouts and bypass conditions.

---

## 2. User Experience Design

### 2.1 Visibility Boundaries Overview

**Screen: Role-Adaptive Dashboard**

```
┌──────────────────────────────────────────────────┐
│  Dashboard (Supervisor)                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  👥 Your Team: 12 employees                      │
│  📋 Pending Qualifications: 3                    │
│  ⚠️  Expiring Soon (30 days): 2                  │
│  🔴 Critical Issues: 1                           │
│                                                  │
│  Quick Actions:                                  │
│  [ View Team Qualifications ] [ View My Team ]   │
│  [ Review Pending Documents ] [ Set Out of Office ] │
│                                                  │
│  Team Compliance Status:                         │
│  ┌──────────────────────────────┐               │
│  │ Employee      │ Certs │ Exp   │               │
│  │ John Smith    │ 5/6   │ 1 due │               │
│  │ Jane Doe      │ 6/6   │ OK    │               │
│  │ Mark Johnson  │ 4/6   │ 2 due │               │
│  └──────────────────────────────┘               │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Data Scoping Principle:**
- **EMPLOYEE:** Can only view their own records (qualifications, documents, hours, notifications)
- **SUPERVISOR:** Can view own records + all direct reports' records (bounded by direct reports list)
- **MANAGER:** Can view own records + all employees in managed department (via organizationUnit or similar)
- **COMPLIANCE_OFFICER:** Can view all employees' records in the entire system
- **ADMIN:** Can view all employees + all records + audit logs

---

### 2.2 Data Filtering by Visibility Boundary

**Implementation Points:**

**Team/Employee List Pages:**
```
GET /api/employees?supervisorId=user-uuid   (SUPERVISOR)
→ Returns only direct reports

GET /api/employees?departmentId=dept-uuid   (MANAGER)
→ Returns only employees in managed department

GET /api/employees                          (COMPLIANCE_OFFICER+)
→ Returns all employees

GET /api/employees                          (EMPLOYEE)
→ Returns 403 FORBIDDEN (employees can't list others)
```

**Qualification/Medical/Document Queries:**
```
GET /api/qualifications/employee/:id
→ If requester is EMPLOYEE and id != own: 403 FORBIDDEN
→ If requester is SUPERVISOR: allow if employee is direct report
→ If requester is MANAGER+: allow if employee in managed department
→ If requester is COMPLIANCE_OFFICER+: allow (all employees)

GET /api/qualifications/team                (SUPERVISOR+)
→ Returns only requester's team (supervisor: direct reports, manager: department)

GET /api/qualifications                     (COMPLIANCE_OFFICER+)
→ Returns all qualifications (paginated)
```

**Documents:**
```
GET /api/documents/employee/:id
→ Same visibility rules as qualifications

GET /api/documents/review-queue            (MANAGER+)
→ If MANAGER: only documents from managed department
→ If COMPLIANCE_OFFICER+: all documents

POST /api/admin/review-queue/:id { decision }  (COMPLIANCE_OFFICER+)
→ Compliance officer can only approve documents within visibility boundary
→ (Unless ADMIN or special audit role)
```

**Hours/Medical/Standards:**
- Same visibility boundary pattern applies
- Supervisor sees team, manager sees department, compliance sees all

---

### 2.3 Notification Escalation UI (Compliance Officer)

**Screen: Escalation Rules Configuration**

```
┌─────────────────────────────────────────────────┐
│  Escalation Rules (Admin/Compliance Officer)     │
├─────────────────────────────────────────────────┤
│                                                 │
│  System Escalation Rules:                       │
│                                                 │
│  ┌─ Rule: Unreviewed Documents ──────────────┐  │
│  │ Trigger: Document pending review >48h     │  │
│  │ Initial Notified: Compliance Officer      │  │
│  │ Escalate To: Director (after 48h)        │  │
│  │ Max Escalations: 3                        │  │
│  │ Active: ☑ Yes                              │  │
│  │ [ Edit ] [ Disable ]                      │  │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ Rule: Expiring Qualifications ──────────┐   │
│  │ Trigger: Qualification expiring in 30d   │  │
│  │ Initial Notified: Employee                │  │
│  │ Escalate To: Supervisor (after 14d)      │  │
│  │ Max Escalations: 2                        │  │
│  │ Active: ☑ Yes                              │  │
│  │ [ Edit ] [ Disable ]                      │  │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ Rule: Missing Medical Clearances ──────┐   │
│  │ Trigger: Medical clearance required     │  │
│  │ Initial Notified: Employee                │  │
│  │ Escalate To: Supervisor (after 3d)       │  │
│  │ Max Escalations: 3                        │  │
│  │ Active: ☑ Yes                              │  │
│  │ [ Edit ] [ Disable ]                      │  │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  [ + New Rule ]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Screen: Edit Escalation Rule**

```
┌───────────────────────────────────────────┐
│  Edit Escalation Rule                     │
├───────────────────────────────────────────┤
│                                           │
│  Rule Name: Unreviewed Documents          │
│  [Unreviewed Documents]                   │
│                                           │
│  Trigger Condition:                       │
│  [Document in review_required status >X]  │
│  Hours before escalation: [48]            │
│                                           │
│  Escalation Path:                         │
│  [ ] EMPLOYEE                              │
│  [✓] SUPERVISOR                            │
│  [✓] MANAGER                               │
│  [✓] COMPLIANCE_OFFICER                    │
│  [ ] ADMIN                                 │
│                                           │
│  Max Escalations: [3]                     │
│                                           │
│  ☑ Active   ☐ Dry Run (log only)          │
│                                           │
│  Notification Template:                   │
│  Title: [Unreviewed document awaiting...] │
│  Message: [...........................] │
│                                           │
│  [ Cancel ]  [ Save ]                     │
│                                           │
└───────────────────────────────────────────┘
```

---

### 2.4 Employee & Manager Notification Experience

**Notification Inbox (My Notifications)**

```
┌──────────────────────────────────────────────────┐
│  My Notifications                                │
├──────────────────────────────────────────────────┤
│  Filters: [ All ] [ Unread ] [ Urgent ] [ Today ]│
│  Sort:    [ Newest ] [ Oldest ]                  │
│                                                  │
│  🔴 ┌─────────────────────────────────────────┐  │
│  🆕 │ CRITICAL: Your certification expires    │  │
│     │ in 15 days                              │  │
│     │ AWS Solutions Architect                 │  │
│     │ Expires: Mar 30, 2026                   │  │
│     │ Today @ 9:30 AM                         │  │
│     │ [ Take Action ] [ Dismiss ]              │  │
│     └─────────────────────────────────────────┘  │
│                                                  │
│  🟡 ┌─────────────────────────────────────────┐  │
│     │ Your document is under review           │  │
│     │ Certification: scan_cert_2026.pdf       │  │
│     │ Submitted 5 hours ago                   │  │
│     │ [ View Document ] [ Dismiss ]            │  │
│     └─────────────────────────────────────────┘  │
│                                                  │
│  ✓ ┌─────────────────────────────────────────┐   │
│     │ Certification approved                  │   │
│     │ AWS Solutions Architect                 │   │
│     │ Added to your profile                   │   │
│     │ Yesterday @ 2:15 PM                     │   │
│     │ [ View ] [ Dismiss ]                    │   │
│     └─────────────────────────────────────────┘   │
│                                                  │
│  [1]  [2]  [3]  [Next]                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Escalation Notification (Supervisor receives escalated notification)**

```
┌──────────────────────────────────────────────────┐
│  🔴 ESCALATED: Unreviewed Document               │
├──────────────────────────────────────────────────┤
│                                                  │
│  John Smith's certification has been pending    │
│  review for 48 hours. This task requires        │
│  compliance review.                             │
│                                                  │
│  Document: AWS_Cert_2024.pdf                    │
│  Uploaded by: John Smith                        │
│  Pending since: Mar 19 @ 2:30 PM                │
│  Escalated to you: Today @ 2:30 PM              │
│                                                  │
│  Escalation Chain:                              │
│  Original Assignment: Compliance Officer        │
│  → Escalated to: Manager                        │
│  → Escalated to: Your Team (Supervisor)         │
│  → Final: Director (if still unreviewed)        │
│                                                  │
│  [ Review Now ] [ Assign to Colleague ]         │
│  [ Acknowledge ] [ Snooze 24h ]                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

### 2.5 Notification State Machine

**States:**
- **SENT:** Notification created, user hasn't seen it
- **READ:** User has viewed/acknowledged notification
- **DISMISSED:** User dismissed or archived notification
- **ESCALATED:** Notification escalated to next level in hierarchy

**Transitions:**
```
SENT
  ↓
[User reads/acknowledges]
  ↓
READ
  ↓
[User dismisses or auto-archived after N days]
  ↓
DISMISSED

OR

SENT
  ↓
[Unacknowledged for N hours per EscalationRule]
  ↓
Escalation triggered:
  - Create new Notification for escalation target
  - Original notification marked ESCALATED
  ↓
New SENT notification to escalation target
```

---

## 3. System Architecture

### 3.1 Data Model (Existing + Enhancements)

**EscalationRule (Existing in Schema)**
```prisma
model EscalationRule {
  id              String   @id @default(uuid())
  trigger         String   // "unreviewed_document", "expiring_qualification", etc.
  delayHours      Int      // delay before escalation (e.g., 48)
  escalateToRole  String   // target role: "SUPERVISOR", "MANAGER", "COMPLIANCE_OFFICER"
  maxEscalations  Int      @default(3)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Notification Model (Existing, Enhanced)**
```prisma
model Notification {
  id              String             @id @default(uuid())
  userId          String
  user            Employee           @relation(fields: [userId], references: [id])
  type            String             // "document_review", "expiring_qualification", etc.
  title           String
  message         String
  actionUrl       String?
  status          NotificationStatus @default(SENT)    // SENT, READ, DISMISSED, ESCALATED
  deliveryChannel String             // "in-app", "email", "sms"
  createdAt       DateTime           @default(now())
  readAt          DateTime?
  escalatedAt     DateTime?          // when escalation occurred
  escalatedFrom   String?            // ID of original notification (parent)
  escalationPath  String?            // JSON: ["EMPLOYEE", "SUPERVISOR", "MANAGER"]
  
  @@index([userId, status])
  @@index([createdAt])
  @@map("notifications")
}
```

**New Table: EmployeeHierarchy (for visibility boundaries)**
```prisma
model EmployeeHierarchy {
  id              String   @id @default(uuid())
  employeeId      String
  employee        Employee @relation("EmployeeHierarchy", fields: [employeeId], references: [id])
  supervisorId    String?  // direct supervisor
  supervisor      Employee? @relation("SupervisorOf", fields: [supervisorId], references: [id])
  departmentId    String?  // department assignment
  organizationUnit String? // org unit for manager visibility
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([employeeId])
  @@index([supervisorId])
  @@index([departmentId])
  @@map("employee_hierarchy")
}
```

**New Table: AuditLog (compliance requirement)**
```prisma
model AuditLog {
  id              String   @id @default(uuid())
  action          String   // "DOCUMENT_VIEWED", "QUALIFICATION_APPROVED", etc.
  actorId         String   // user who performed action
  targetId        String?  // record ID (document, qualification, etc.)
  targetType      String?  // "Document", "Qualification", etc.
  details         String?  // JSON with additional context
  timestamp       DateTime @default(now())
  
  @@index([actorId, timestamp])
  @@index([targetId, targetType])
  @@map("audit_logs")
}
```

---

### 3.2 API Endpoints for Visibility Boundaries

#### Employee List with Visibility Scoping

**GET /api/employees** (SUPERVISOR+)
```json
Request:
  ?page=1&limit=50&scope=team
  // scope values: team (SUPERVISOR), department (MANAGER), all (COMPLIANCE_OFFICER+)

Response: 200 OK
{
  "items": [
    {
      "id": "emp-uuid",
      "employeeNumber": "EMP001",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john@company.com",
      "role": "EMPLOYEE",
      "departmentId": "dept-123",
      "hireDate": "2024-01-15",
      "isActive": true
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 50,
  "visibilityScope": "team"  // for client awareness
}
```

#### Team Qualifications (Visibility-Scoped)

**GET /api/qualifications/team** (SUPERVISOR+)
```json
Request:
  ?page=1&limit=20&status=EXPIRING_SOON

Response: 200 OK
{
  "items": [
    {
      "id": "qual-uuid",
      "employeeId": "emp-uuid",
      "employeeName": "John Smith",
      "standardId": "std-uuid",
      "standardName": "AWS Solutions Architect",
      "status": "EXPIRING_SOON",
      "issueDate": "2024-03-15",
      "expirationDate": "2026-03-15",
      "daysUntilExpiry": 21
    }
  ],
  "total": 3,
  "visibilityScope": "team"  // SUPERVISOR sees only direct reports
}
```

#### Documents (Visibility-Scoped)

**GET /api/documents/review-queue** (MANAGER+)
```json
Request:
  ?page=1&limit=20&status=PENDING&scope=department

Response: 200 OK
{
  "items": [
    {
      "id": "queue-item-uuid",
      "documentId": "doc-uuid",
      "employeeId": "emp-uuid",
      "employeeName": "John Smith",
      "documentType": "certification",
      "status": "PENDING",
      "overallConfidence": 87,
      "submittedAt": "2026-03-19T14:30:00Z"
    }
  ],
  "total": 5,
  "visibilityScope": "department"  // MANAGER sees only managed department
}
```

#### Audit Log (ADMIN/COMPLIANCE_OFFICER only)

**GET /api/admin/audit-logs** (ADMIN+)
```json
Request:
  ?actor=user-uuid&startDate=2026-03-01&endDate=2026-03-31&action=QUALIFICATION_APPROVED

Response: 200 OK
{
  "items": [
    {
      "id": "audit-uuid",
      "action": "QUALIFICATION_APPROVED",
      "actorId": "user-uuid",
      "actorName": "Jane Smith",
      "targetId": "qual-uuid",
      "targetType": "Qualification",
      "details": {
        "qualificationName": "AWS Solutions Architect",
        "employeeId": "emp-uuid",
        "employeeName": "John Smith"
      },
      "timestamp": "2026-03-19T16:15:00Z"
    }
  ],
  "total": 145,
  "page": 1
}
```

---

### 3.3 API Endpoints for Escalation Management

#### Create Escalation Rule (ADMIN only)

**POST /api/admin/escalation-rules** (ADMIN)
```json
Request:
{
  "trigger": "unreviewed_document",
  "delayHours": 48,
  "escalateToRole": "SUPERVISOR",
  "maxEscalations": 3,
  "notificationTitle": "Unreviewed Document Escalation",
  "notificationMessage": "A document submitted by one of your team members is awaiting compliance review.",
  "isActive": true
}

Response: 201 Created
{
  "id": "rule-uuid",
  "trigger": "unreviewed_document",
  "delayHours": 48,
  "escalateToRole": "SUPERVISOR",
  "maxEscalations": 3,
  "notificationTitle": "Unreviewed Document Escalation",
  "notificationMessage": "...",
  "isActive": true,
  "createdAt": "2026-03-20T10:00:00Z"
}
```

#### List Escalation Rules (ADMIN/COMPLIANCE_OFFICER)

**GET /api/admin/escalation-rules** (ADMIN+)
```json
Response: 200 OK
{
  "items": [
    {
      "id": "rule-uuid",
      "trigger": "unreviewed_document",
      "delayHours": 48,
      "escalateToRole": "SUPERVISOR",
      "maxEscalations": 3,
      "isActive": true
    }
  ],
  "total": 5
}
```

#### Update Escalation Rule (ADMIN only)

**PUT /api/admin/escalation-rules/:id** (ADMIN)
```json
Request:
{
  "delayHours": 72,
  "maxEscalations": 4,
  "isActive": true
}

Response: 200 OK
{
  "id": "rule-uuid",
  "delayHours": 72,
  "maxEscalations": 4,
  "isActive": true
}
```

#### Get Escalation Status (For audit/monitoring)

**GET /api/admin/escalations/pending** (ADMIN+)
```json
Response: 200 OK
{
  "pending": [
    {
      "notificationId": "notif-uuid",
      "trigger": "unreviewed_document",
      "targetId": "doc-uuid",
      "targetEmployee": "John Smith",
      "createdAt": "2026-03-19T14:30:00Z",
      "escalatesAt": "2026-03-21T14:30:00Z",  // (createdAt + delayHours)
      "hoursUntilEscalation": 38
    }
  ],
  "total": 12
}
```

---

### 3.4 Notification Escalation Service

**`notificationsService.escalateUnacknowledged()`**
- Runs on scheduled task (e.g., every 15 minutes)
- Query: Notifications where status=SENT AND createdAt < (now - rule.delayHours)
- For each unacknowledged notification:
  - Look up escalation rule by trigger
  - Find escalation target role (SUPERVISOR → MANAGER → COMPLIANCE_OFFICER → ADMIN)
  - Find users with that role in visibility hierarchy (supervisor of original recipient, etc.)
  - Create new Notification for escalation target
  - Mark original notification status = ESCALATED
  - Log audit event: "NOTIFICATION_ESCALATED"

---

### 3.5 Query Scoping Helper (Backend)

**Helper Function: `getVisibilityScope(user, resource?)`**
```typescript
function getVisibilityScope(user: Employee, resource?: string): VisibilityFilter {
  if (user.role === Roles.EMPLOYEE) {
    return { ownRecordsOnly: true, employeeId: user.id };
  }
  
  if (user.role === Roles.SUPERVISOR) {
    const directReports = await db.employeeHierarchy.findMany({
      where: { supervisorId: user.id }
    });
    return { employeeIds: directReports.map(r => r.employeeId) };
  }
  
  if (user.role === Roles.MANAGER) {
    const departmentEmployees = await db.employeeHierarchy.findMany({
      where: { departmentId: user.department.id }
    });
    return { employeeIds: departmentEmployees.map(e => e.employeeId) };
  }
  
  if ([Roles.COMPLIANCE_OFFICER, Roles.ADMIN].includes(user.role)) {
    return { allRecords: true };
  }
}

// Usage in route handler:
const scope = getVisibilityScope(req.user);
const qualifications = await db.qualification.findMany({
  where: scope.allRecords ? {} : { employeeId: { in: scope.employeeIds } }
});
```

---

## 4. Frontend Component Architecture

### 4.1 New Components

**`VisibilityScopedEmployeeList.tsx`**
- Renders employee list based on user's visibility boundary
- Props: `scope: "team" | "department" | "all"`, `onEmployeeSelect`
- Automatically disables selection if scope doesn't allow visibility
- Shows clear messaging ("Viewing your team of 12 employees")

**`NotificationInbox.tsx` (Enhanced)**
- Displays personal notifications + escalated notifications
- Shows escalation status in notification cards
- Read/Dismiss actions per notification
- Filters: Unread, Urgent (critical), Today

**`NotificationBadge.tsx` (Enhanced)**
- Shows unread count + escalated count separately
- Red badge for escalated notifications
- Click to open inbox

**`EscalationRulesManager.tsx` (Admin/Compliance Officer)**
- List of escalation rules with enable/disable toggles
- + New Rule button opens form
- Edit/Delete actions per rule
- Shows rule status (active, dry-run, inactive)

**`EditEscalationRuleForm.tsx`**
- Form fields: trigger, delayHours, escalateToRole, maxEscalations, notificationTemplate
- Zod validation for inputs
- Save/Cancel buttons

**`AuditLogViewer.tsx` (Admin/Compliance Officer)**
- Searchable/filterable log of all system actions
- Columns: timestamp, action, actor, target, details
- Pagination
- Export as CSV option

### 4.2 Visibility Boundary Enforcement (Frontend)

```typescript
// Example: MyDocumentsPage visibility check
const [documents, setDocuments] = useState([]);

useEffect(() => {
  const fetchDocuments = async () => {
    // All users can view own documents
    const res = await apiClient.get(`/api/documents/employee/${authContext.user.id}`);
    setDocuments(res.items);
  };
  
  fetchDocuments();
}, [authContext.user.id]);

// Example: TeamDocumentsPage visibility check
const [teamDocuments, setTeamDocuments] = useState([]);
const [visibilityScope, setVisibilityScope] = useState<"team" | "department">("team");

useEffect(() => {
  if (![Roles.SUPERVISOR, Roles.MANAGER].includes(authContext.user.role)) {
    // Non-supervisors can't view team documents
    return;
  }
  
  const scope = authContext.user.role === Roles.MANAGER ? "department" : "team";
  setVisibilityScope(scope);
  
  const res = await apiClient.get(`/api/documents/review-queue?scope=${scope}`);
  setTeamDocuments(res.items);
}, [authContext.user.role]);

return (
  <VisibilityScopedEmployeeList
    scope={visibilityScope}
    onEmployeeSelect={(emp) => navigate(`/team/documents/${emp.id}`)}
  />
);
```

---

## 5. State Machines

### 5.1 Notification Escalation State Machine

```
Create Notification (trigger event: document uploaded, qualification expiring, etc.)
  ↓
Notification.status = SENT
Notification.createdAt = now
  ↓
[Unacknowledged for < delayHours]
  ↓
User reads → status = READ (no escalation)
OR
[Unacknowledged for >= delayHours AND escalation rule exists]
  ↓
Escalation triggered:
  - Find escalation target role (e.g., SUPERVISOR)
  - Create new Notification for users in that role
  - Original notification.status = ESCALATED
  - New notification.escalatedFrom = original.id
  ↓
[New notification unacknowledged for another delayHours]
  ↓
Next escalation (SUPERVISOR → MANAGER → etc.)
  ↓
[Max escalations reached OR user reads]
  ↓
Final state (READ or ESCALATED)
```

### 5.2 Employee Visibility Boundary State Machine

```
Employee requests /api/qualifications/team
  ↓
AuthMiddleware checks role
  ↓
getVisibilityScope(user)
  ↓
EMPLOYEE role?
  → ownRecordsOnly = true
SUPERVISOR role?
  → Query supervisor's direct reports
MANAGER role?
  → Query department's employees
COMPLIANCE_OFFICER+ role?
  → allRecords = true
  ↓
Apply scope filter to Prisma query
  ↓
Return only visible records
  ↓
Frontend renders with visibility indicator
```

---

## 6. Integration Points

### 6.1 Notification Module Integration

Existing notification endpoints enhanced with escalation support:
- `GET /api/notifications` returns all notifications (including escalated)
- `PUT /api/notifications/:id/read` prevents further escalation
- `DELETE /api/notifications/:id` dismisses notification + stops escalation

### 6.2 Document Review Flow Integration

When document is submitted for review:
1. Create Notification for Compliance Officer: "New document for review"
2. Notification.type = "document_review"
3. Create escalation task: if unreviewed for 48h, escalate to MANAGER
4. Manager receives escalated notification with doc details
5. Manager can approve/reject OR escalate further to Director

### 6.3 Qualification Expiration Integration

Scheduled job runs nightly:
1. Query qualifications expiring in 30 days
2. Create Notification for employee: "Your certification expires in 30 days"
3. Create escalation task: if employee doesn't acknowledge in 14 days, notify SUPERVISOR
4. SUPERVISOR sees escalated notification + can auto-renew or follow up

---

## 7. RBAC Matrix (Visibility + Actions)

| Action | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|--------|----------|------------|---------|-------------------|-------|
| View own documents | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team documents | ✗ | ✓ (direct team) | ✓ (department) | ✓ (all) | ✓ (all) |
| View own qualifications | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team qualifications | ✗ | ✓ (direct team) | ✓ (department) | ✓ (all) | ✓ (all) |
| Approve documents | ✗ | ✗ | ✓ (department) | ✓ (all) | ✓ (all) |
| Create escalation rule | ✗ | ✗ | ✗ | ✗ | ✓ |
| View escalation rules | ✗ | ✗ | ✗ | ✓ | ✓ |
| View audit logs | ✗ | ✗ | ✗ | ✗ | ✓ |
| Receive escalated notifications | ✗ | ✓ | ✓ | ✓ | ✓ |

---

## 8. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Employee requests colleague's documents | 403 Forbidden: "You don't have permission to view this employee's records" |
| Supervisor views another supervisor's team | 403 Forbidden: "You can only view your direct reports" |
| Manager requests documents from different department | 403 Forbidden: "You can only view your department's records" |
| Escalation rule max reached | Don't escalate further; mark final notification with "Final escalation" flag |
| Supervisor out of office | Escalation bypasses supervisor, goes to manager (if configured) |
| Compliance officer rate-limited by escalations | Batch escalations; don't fire all at once (queue + throttle) |

---

## 9. Testing Strategy

### Backend (Bunk)

- **Unit Tests:**
  - `getVisibilityScope()` returns correct employee IDs per role
  - Escalation service identifies pending notifications correctly
  - EscalationRule CRUD operations
  
- **Integration Tests:**
  - SUPERVISOR queries /api/qualifications/team → returns only direct reports
  - EMPLOYEE queries /api/qualifications/team → 403 FORBIDDEN
  - MANAGER queries review queue → returns only department documents
  - Escalation triggered after delayHours → new notification created
  - User reads notification → status = READ, no escalation
  
- **Contract Tests:**
  - Notification schema includes escalatedFrom, escalationPath fields

### Frontend (Kima)

- **Component Tests:**
  - VisibilityScopedEmployeeList shows correct scope label
  - NotificationInbox filters unread vs. escalated
  - EscalationRulesManager enable/disable works
  
- **Page Tests:**
  - MyDocumentsPage loads own documents
  - TeamDocumentsPage shows "Forbidden" if EMPLOYEE role
  - TeamQualificationsPage shows supervisor's team (SUPERVISOR) vs. entire department (MANAGER)
  
- **E2E Tests:**
  - Employee receives escalated notification after 48h timeout
  - Manager can view all department documents in review queue

---

## 10. Acceptance Criteria

- [x] Employees see only own records; supervisors see team; managers see department; compliance sees all
- [x] API queries automatically filtered by visibility boundary
- [x] Unacknowledged notifications escalate after configurable timeout
- [x] Escalation rules configurable by admin (create/read/update/delete)
- [x] Escalation path stored in notification audit trail
- [x] Out-of-office escalation bypass (manager notified instead of supervisor)
- [x] Audit log tracks all access + approvals (compliance requirement)
- [x] RBAC enforced at API + Frontend layers
- [x] Error messages clear about visibility boundaries

---

## 11. Success Metrics

- Critical compliance tasks never missed (escalation success rate >99%)
- Average escalation time <24 hours from deadline
- 0 unauthorized data access attempts (RBAC enforcement)
- Audit trail 100% complete for compliance reporting
- User satisfaction with escalation: >80% find helpful

---

## 12. Open Questions & Risks

1. **Out-of-Office Flow:** How is "supervisor is out of office" marked? Manual flag or integrated with calendar?
2. **Escalation Fatigue:** If multiple escalations hit same user, should we batch them or send individually?
3. **Delegation:** Can a manager delegate their review queue to another manager?
4. **Soft Boundaries:** Should MANAGER see redacted info about other departments, or truly see nothing?
5. **Historical Access:** If employee transfers departments, can manager see old records?

---

## Appendix A: Escalation Rule Examples

### Rule 1: Unreviewed Documents

```json
{
  "trigger": "document_pending_review",
  "delayHours": 48,
  "escalateToRole": "SUPERVISOR",
  "maxEscalations": 3,
  "escalationPath": ["EMPLOYEE", "SUPERVISOR", "MANAGER", "COMPLIANCE_OFFICER"],
  "notificationTitle": "Document Awaiting Review",
  "notificationMessage": "A team member's document has been pending review for 48 hours.",
  "isActive": true
}
```

### Rule 2: Expiring Qualifications

```json
{
  "trigger": "qualification_expiring_30d",
  "delayHours": 336,  // 14 days
  "escalateToRole": "SUPERVISOR",
  "maxEscalations": 2,
  "escalationPath": ["EMPLOYEE", "SUPERVISOR", "MANAGER"],
  "notificationTitle": "Critical: Qualification Expiring Soon",
  "notificationMessage": "A required certification will expire in 30 days. Please renew immediately.",
  "isActive": true
}
```

### Rule 3: Missing Medical Clearance

```json
{
  "trigger": "medical_clearance_required",
  "delayHours": 72,  // 3 days
  "escalateToRole": "SUPERVISOR",
  "maxEscalations": 2,
  "escalationPath": ["EMPLOYEE", "SUPERVISOR", "MANAGER"],
  "notificationTitle": "Required: Medical Clearance",
  "notificationMessage": "Your annual medical clearance is required. Schedule an appointment immediately.",
  "isActive": true
}
```

---

## Appendix B: Visibility Boundary Decision Tree

```
User requests /api/qualifications/team?page=1&limit=20

Is user EMPLOYEE?
  → Return 403 FORBIDDEN (employees cannot list others)

Is user SUPERVISOR?
  → Get supervisorId = user.id
  → Query: qualifications WHERE employeeId IN (
      SELECT employeeId FROM employee_hierarchy WHERE supervisorId = supervisorId
    )
  → Return team's qualifications

Is user MANAGER?
  → Get departmentId = user.departmentId
  → Query: qualifications WHERE employeeId IN (
      SELECT employeeId FROM employee_hierarchy WHERE departmentId = departmentId
    )
  → Return department's qualifications

Is user COMPLIANCE_OFFICER or ADMIN?
  → Query: qualifications (no filter)
  → Return all qualifications

Apply pagination + sorting
Return response with visibilityScope header
```

