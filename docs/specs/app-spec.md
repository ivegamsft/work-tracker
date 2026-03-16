# Application Specification — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Last Updated:** 2026-03-17  
> **Applies To:** `apps/web` (employee/manager SPA), `apps/admin` (admin SPA), all API modules  
> **Source PRD:** [`docs/requirements/eclat-spec.md`](../requirements/eclat-spec.md) — Product north star. This spec is the implementation authority.  
> **Companion Docs:** [RBAC API Spec](./rbac-api-spec.md) · [Entra Auth Design](./entra-auth-design.md)  
> **Triggered By:** User feedback — "this screen is really confusing. no quick actions. employees should be trimmed. what is the directory?"
>
> ### Terminology Mapping (PRD → Implementation)
>
> | PRD Term | Implementation Term | Notes |
> |----------|-------------------|-------|
> | Certifications | Qualifications | API module: `qualifications`, Prisma model: `Qualification` |
> | Clearance / Medical Clearance | Medical | API module: `medical`, Prisma model: `MedicalClearance` |
> | Manager (PRD role) | Supervisor + Manager | PRD's single "Manager" role maps to our Supervisor (team lead, Level 1) + Manager (department ops, Level 2). See §1.4. |
> | Standard Framework | Standard | API module: `standards`, Prisma model: `Standard` |
> | Compliance Officer | Compliance Officer | Same; internal value: `compliance_officer` |
>
> ### Role Mapping: PRD (4 roles) → Implementation (5 roles)
>
> The PRD defines 4 roles: Employee, Manager, Compliance Officer, Admin. Our implementation uses 5 roles by splitting the PRD's "Manager" into two tiers:
>
> | PRD Role | Implementation Role(s) | Rationale |
> |----------|----------------------|-----------|
> | Employee | Employee (Level 0) | 1:1 mapping |
> | Manager | **Supervisor (Level 1)** + **Manager (Level 2)** | Regulated industries need a team-lead tier that can manage qualifications/medical but cannot approve documents or resolve conflicts. The Supervisor handles day-to-day team oversight; the Manager handles department-wide operations. |
> | Compliance Officer | Compliance Officer (Level 3) | 1:1 mapping |
> | Admin | Admin (Level 4) | 1:1 mapping |

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Screen Inventory](#2-screen-inventory)
3. [Per-Screen Functionality Matrix](#3-per-screen-functionality-matrix)
4. [Screen → API Mapping](#4-screen--api-mapping)
5. [Navigation Structure](#5-navigation-structure)
6. [Employee Role UX — Special Focus](#6-employee-role-ux--special-focus)
7. [Role-Specific Dashboard Widgets](#7-role-specific-dashboard-widgets)
8. [RBAC Master Cross-Reference](#8-rbac-master-cross-reference)
9. [PRD Coverage Analysis](#9-prd-coverage-analysis)
10. [Implementation Notes for Kima & Bunk](#10-implementation-notes-for-kima--bunk)

---

## 1. Design Principles

### 1.1 What Triggered This Spec

The current UI has four screens, a broken employee experience, and a nav that shows items users can't access. The dashboard shows employee counts to everyone (even employees who can't see the list), has no quick actions, and the "Employees" nav label is confusing — it's a directory, not a list of employees in the user's scope.

### 1.2 Guiding Rules

1. **Show only what you can use.** If a role cannot access a feature, it does not appear in their UI. No grayed-out links. No 403 screens during normal navigation.
2. **Employee-first design.** Employees are 90%+ of users. Their dashboard must be immediately useful: "Am I compliant? What's expiring? Clock in."
3. **Progressive disclosure by role.** Higher roles see everything lower roles see, plus their management tools. The experience grows with the role, it doesn't transform.
4. **Self-service is sovereign.** Every role has a "My" section for their own records (profile, hours, qualifications, documents). A Manager managing their team still has their own personal view.
5. **Two apps, clear boundary.** `apps/web` serves roles Employee through Compliance Officer. `apps/admin` serves Admin for platform configuration (standards, labels, escalation rules, user management). Admins can access `apps/web` too — they just get the management view.

### 1.3 Terminology Fixes

| Old (Broken) | New (This Spec) | Rationale |
|---|---|---|
| "Employees" nav item | "Team" (Supervisor/Manager) or removed (Employee) | Employees don't need a directory of other employees |
| "Employee List" page | "Team Directory" (Supervisor+) | Clarifies it shows YOUR scoped team, not all employees |
| Generic dashboard | Role-aware dashboard with widgets | Each role gets relevant information at a glance |

---

## 2. Screen Inventory

### 2.1 `apps/web` Screens (Employee → Compliance Officer)

| # | Screen | Route | Description | Min Role | Status |
|---|--------|-------|-------------|----------|--------|
| W-01 | Login | `/login` | Email + password login; Entra SSO button (Phase 2) | Public | ✅ Exists |
| W-02 | Dashboard | `/` | Role-adaptive home screen with widgets and quick actions | Employee | ✅ Exists (broken) |
| W-03 | My Profile | `/me` | Authenticated user's own employee record + readiness summary | Employee | 🆕 New |
| W-04 | My Qualifications | `/me/qualifications` | List of own qualifications with status indicators | Employee | 🆕 New |
| W-05 | My Medical | `/me/medical` | Own medical clearances with expiration tracking | Employee | 🆕 New |
| W-06 | My Documents | `/me/documents` | Own uploaded documents + upload action | Employee | 🆕 New |
| W-07 | My Hours | `/me/hours` | Own hour records, clock in/out, manual entry | Employee | 🆕 New |
| W-08 | My Notifications | `/me/notifications` | Notification feed + preferences | Employee | 🆕 New |
| W-09 | Team Directory | `/team` | Scoped list of employees (direct reports or department) | Supervisor | ✅ Exists as `/employees` |
| W-10 | Employee Detail | `/team/:id` | Individual employee profile + readiness + qualifications + medical | Supervisor | ✅ Exists as `/employees/:id` |
| W-11 | Employee Qualifications | `/team/:id/qualifications` | All qualifications for a specific team member | Supervisor | 🆕 New |
| W-12 | Employee Medical | `/team/:id/medical` | Medical clearances for a specific team member | Supervisor | 🆕 New |
| W-13 | Employee Documents | `/team/:id/documents` | Documents for a specific team member | Supervisor | 🆕 New |
| W-14 | Employee Hours | `/team/:id/hours` | Hour records for a specific team member | Supervisor | 🆕 New |
| W-15 | Compliance Check | `/team/:employeeId/compliance/:standardId` | Check one employee against one standard | Supervisor | 🆕 New |
| W-16 | Document Review Queue | `/reviews` | Pending documents needing approval | Manager | 🆕 New |
| W-17 | Document Review Detail | `/reviews/:id` | Review a single document + extraction + approve/reject | Manager | 🆕 New |
| W-18 | Hour Conflicts | `/conflicts` | Unresolved hour conflicts across scope | Manager | 🆕 New |
| W-19 | Compliance Overview | `/compliance` | Organization-wide compliance dashboard + reports | Compliance Officer | 🆕 New |
| W-20 | Standards Reference | `/standards` | Read-only view of all compliance standards + requirements | Employee | 🆕 New |
| W-21 | Standard Detail | `/standards/:id` | Single standard with its requirements | Employee | 🆕 New |
| W-22 | Unauthorized | `/unauthorized` | "You don't have access" — with a link back to Dashboard | Employee | 🆕 New |
| W-23 | Not Found | `/404` | Catch-all for unknown routes | Public | 🆕 New |

### 2.2 `apps/admin` Screens (Admin Only)

| # | Screen | Route | Description | Status |
|---|--------|-------|-------------|--------|
| A-01 | Admin Login | `/login` | Admin SSO login (same Entra, admin app role required) | 🆕 New |
| A-02 | Admin Dashboard | `/` | System overview: health, user counts, recent audit entries | 🆕 New |
| A-03 | Employee Management | `/employees` | Full CRUD employee list — create, edit, activate/deactivate | 🆕 New |
| A-04 | Employee Create/Edit | `/employees/new`, `/employees/:id/edit` | Create or edit employee record | 🆕 New |
| A-05 | Standards Management | `/standards` | CRUD for compliance standards | 🆕 New |
| A-06 | Standard Editor | `/standards/new`, `/standards/:id/edit` | Create/edit standard + manage requirements | 🆕 New |
| A-07 | Label Management | `/labels` | Create, edit, deprecate taxonomy labels | 🆕 New |
| A-08 | Escalation Rules | `/escalation-rules` | Create and manage notification escalation rules | 🆕 New |
| A-09 | Notification Testing | `/notifications/test` | Send test notifications to any user | 🆕 New |

### 2.3 Screen Wireframes (Text-Based)

#### W-02: Dashboard (Employee View)

```
┌─────────────────────────────────────────────────────────────┐
│  E-CLAT                                        Jane Doe ▾  │
├────────┬────────────────────────────────────────────────────┤
│        │  Welcome back, Jane                               │
│ 📊 Home│                                                    │
│ 👤 Me  │  ┌─── My Readiness ─────┐  ┌─── Upcoming ───────┐│
│ 📋 Stds│  │ ● Compliant          │  │ ⚠ CPR cert expires ││
│ 🔔 Notf│  │                      │  │   in 23 days       ││
│        │  │ 4/5 quals current    │  │ ⚠ Medical due      ││
│        │  │ 1 expiring soon      │  │   in 45 days       ││
│        │  │ Medical: ✅ Current   │  │                    ││
│        │  └──────────────────────┘  └────────────────────┘│
│        │                                                    │
│        │  ┌─── Quick Actions ─────────────────────────────┐│
│        │  │ [🕐 Clock In]  [📄 Upload Doc]  [👤 My Profile]││
│        │  │ [📊 My Hours]  [📋 My Quals]                   ││
│        │  └───────────────────────────────────────────────┘│
│        │                                                    │
│        │  ┌─── Recent Notifications ──────────────────────┐│
│        │  │ • Qualification "Forklift" verified by Smith   ││
│        │  │ • Weekly digest available                      ││
│        │  └───────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────────┘
```

#### W-02: Dashboard (Supervisor View)

```
┌─────────────────────────────────────────────────────────────┐
│  E-CLAT                                     John Smith ▾   │
├────────┬────────────────────────────────────────────────────┤
│        │  Welcome back, John                               │
│ 📊 Home│                                                    │
│ 👤 Me  │  ┌─── My Readiness ─────┐  ┌─── Team Summary ──┐│
│ 👥 Team│  │ ● Compliant          │  │ 8 direct reports  │││
│ 📋 Stds│  │ All quals current    │  │ 6 compliant       ││
│ 🔔 Notf│  │ Medical: ✅ Current   │  │ 1 at risk ⚠      ││
│        │  └──────────────────────┘  │ 1 non-compliant ❌││
│        │                             └────────────────────┘│
│        │  ┌─── Team Expiring Soon ────────────────────────┐│
│        │  │ ⚠ Jane Doe — CPR cert expires in 23 days     ││
│        │  │ ⚠ Bob Lee — Medical clearance due in 12 days ││
│        │  └───────────────────────────────────────────────┘│
│        │                                                    │
│        │  ┌─── Quick Actions ─────────────────────────────┐│
│        │  │ [👥 View Team]  [➕ Add Qualification]         ││
│        │  │ [🕐 Clock In]  [📄 Upload Doc]                ││
│        │  └───────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────────┘
```

#### W-02: Dashboard (Manager View)

```
┌─────────────────────────────────────────────────────────────┐
│  E-CLAT                                     Sarah Mgr ▾   │
├────────┬────────────────────────────────────────────────────┤
│        │  Welcome back, Sarah                              │
│ 📊 Home│                                                    │
│ 👤 Me  │  ┌── Dept Compliance ──┐  ┌─── Action Items ───┐│
│ 👥 Team│  │ 42 employees        │  │ 📄 3 docs pending  ││
│ 📄 Revw│  │ 87% compliant       │  │ ⚡ 2 hour conflicts││
│ ⚡ Conf│  │ 5 at risk           │  │ ⚠ 4 expiring soon ││
│ 📋 Stds│  │ 1 non-compliant     │  │                    ││
│ 🔔 Notf│  └─────────────────────┘  └────────────────────┘│
│        │                                                    │
│        │  ┌─── Quick Actions ─────────────────────────────┐│
│        │  │ [📄 Review Docs]  [⚡ Resolve Conflicts]      ││
│        │  │ [👥 View Team]  [🕐 Clock In]                 ││
│        │  └───────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────────┘
```

#### W-02: Dashboard (Compliance Officer View)

```
┌─────────────────────────────────────────────────────────────┐
│  E-CLAT                                      CO User ▾    │
├────────┬────────────────────────────────────────────────────┤
│        │  Welcome back                                     │
│ 📊 Home│                                                    │
│ 👤 Me  │  ┌── Org Compliance ───┐  ┌─── At-Risk ────────┐│
│ 👥 Team│  │ 312 total employees │  │ 14 employees at    ││
│ 📄 Revw│  │ 91% compliant       │  │ risk across 4 depts││
│ ⚡ Conf│  │ 22 at risk ⚠       │  │                    ││
│ 🏛 Cmpl│  │ 6 non-compliant ❌  │  │ Top: Operations(8) ││
│ 📋 Stds│  └─────────────────────┘  │      Safety(4)     ││
│ 🔔 Notf│                             │      Maint(2)      ││
│        │                             └────────────────────┘│
│        │  ┌─── Quick Actions ─────────────────────────────┐│
│        │  │ [🏛 Compliance Overview]  [📊 Export Report]  ││
│        │  │ [👥 View All Employees]  [📄 Review Docs]     ││
│        │  └───────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────────┘
```

#### W-03: My Profile

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard > My Profile                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Personal Info ──────────────────────────────────────┐ │
│  │ Name: Jane Doe          Employee ID: EMP-00142         │ │
│  │ Department: Operations  Position: Forklift Operator    │ │
│  │ Supervisor: John Smith  Hire Date: 2024-06-15          │ │
│  │ Status: ● Active                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Readiness Summary ─────────────────────────────────┐ │
│  │ Overall: ⚠ At Risk                                     │ │
│  │                                                         │ │
│  │ Qualifications: 4/5 current  │  Medical: ✅ Current     │ │
│  │ ❌ CPR Certification — Expired 2026-02-28               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [📋 View Qualifications] [🏥 View Medical] [📄 My Docs]    │
│  [📊 My Hours] [🔐 Change Password]                         │
└─────────────────────────────────────────────────────────────┘
```

#### W-09: Team Directory (Supervisor+)

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard > Team Directory                                  │
├─────────────────────────────────────────────────────────────┤
│  [Search: ___________]  [Filter: Status ▾] [Dept ▾]        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Name           │ Dept       │ Status     │ Readiness  │  │
│  │────────────────│────────────│────────────│────────────│  │
│  │ Jane Doe       │ Operations │ Active     │ ⚠ At Risk  │  │
│  │ Bob Lee        │ Operations │ Active     │ ❌ Non-Cmpl │  │
│  │ Alice Wang     │ Operations │ Active     │ ✅ Compliant│  │
│  │ ...            │            │            │            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Showing 1-8 of 8 employees                  [< 1 >]        │
└─────────────────────────────────────────────────────────────┘
```

#### W-16: Document Review Queue (Manager+)

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard > Document Review                                 │
├─────────────────────────────────────────────────────────────┤
│  [Filter: Status ▾]  [Employee ▾]  [Date range ▾]          │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Document       │ Employee   │ Uploaded   │ Action     │  │
│  │────────────────│────────────│────────────│────────────│  │
│  │ CPR Cert.pdf   │ Jane Doe   │ Mar 15     │ [Review]   │  │
│  │ Medical_clear  │ Bob Lee    │ Mar 14     │ [Review]   │  │
│  │ Safety_train   │ Alice Wang │ Mar 13     │ [Review]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  3 documents pending review                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Per-Screen Functionality Matrix

Legend: ✅ = can do | ❌ = hidden/no access | 👁️ = read-only | 🔒 = visible but disabled

### W-01: Login

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Email/password login | ✅ | ✅ | ✅ | ✅ | ✅ |
| Entra SSO button | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register (self-service) | ✅ | ✅ | ✅ | ✅ | ✅ |

### W-02: Dashboard

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Personal readiness widget | ✅ | ✅ | ✅ | ✅ | ✅ |
| Expiring qualifications (own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recent notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick action: Clock In/Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick action: Upload Document | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick action: My Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick action: My Hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick action: My Qualifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team readiness summary widget | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team expiring qualifications | ❌ | ✅ | ✅ | ✅ | ✅ |
| Quick action: View Team | ❌ | ✅ | ✅ | ✅ | ✅ |
| Quick action: Add Qualification | ❌ | ✅ | ✅ | ✅ | ✅ |
| Department compliance widget | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pending reviews count | ❌ | ❌ | ✅ | ✅ | ✅ |
| Hour conflicts count | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quick action: Review Documents | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quick action: Resolve Conflicts | ❌ | ❌ | ✅ | ✅ | ✅ |
| Organization compliance widget | ❌ | ❌ | ❌ | ✅ | ✅ |
| At-risk employees list | ❌ | ❌ | ❌ | ✅ | ✅ |
| Quick action: Export Report | ❌ | ❌ | ❌ | ✅ | ✅ |
| Quick action: Compliance Overview | ❌ | ❌ | ❌ | ✅ | ✅ |

### W-03: My Profile

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own personal info | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own readiness summary | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |
| Navigate to own qualifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Navigate to own medical | ✅ | ✅ | ✅ | ✅ | ✅ |
| Navigate to own documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own profile fields | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** No role can self-edit profile fields (name, department, etc.) — that's an Admin function via `apps/admin`. Self-edit is limited to password change and notification preferences.

### W-04: My Qualifications

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own qualifications list | ✅ | ✅ | ✅ | ✅ | ✅ |
| View qualification detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| View expiration dates/status | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create qualification (own) | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Employees cannot self-create qualifications. Qualifications are managed by Supervisors+ via the team view. This prevents self-attestation in a regulated environment.

### W-05: My Medical

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own medical clearances | ✅ | ✅ | ✅ | ✅ | ✅ |
| View expiration dates/status | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create medical record (own) | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Same as qualifications — medical clearances are verified by Supervisors+, not self-reported.

### W-06: My Documents

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own documents list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload new document | ✅ | ✅ | ✅ | ✅ | ✅ |
| View document detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| View extraction results (own doc) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Review/approve document | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Review/approve happens on the Review Queue screen (W-16), not in the personal documents view.

### W-07: My Hours

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own hour records | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clock in | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clock out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit manual hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sync calendar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit hour record | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete hour record | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Hour editing/deletion requires Manager+ and is done from the team view, not self-service. This maintains audit integrity.

### W-08: My Notifications

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View notification feed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark as read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dismiss notification | ✅ | ✅ | ✅ | ✅ | ✅ |
| View weekly digest | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit notification preferences | ✅ | ✅ | ✅ | ✅ | ✅ |

### W-09: Team Directory

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View employee list | ❌ | ✅ (team) | ✅ (dept) | ✅ (org) | ✅ (all) |
| Search/filter employees | ❌ | ✅ | ✅ | ✅ | ✅ |
| Click into employee detail | ❌ | ✅ | ✅ | ✅ | ✅ |
| See readiness status column | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-10: Employee Detail

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View employee info | ❌ | ✅ | ✅ | ✅ | ✅ |
| View readiness summary | ❌ | ✅ | ✅ | ✅ | ✅ |
| Navigate to employee quals | ❌ | ✅ | ✅ | ✅ | ✅ |
| Navigate to employee medical | ❌ | ✅ | ✅ | ✅ | ✅ |
| Navigate to employee docs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Navigate to employee hours | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit employee record | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Employee record editing is Admin-only via `apps/admin`. The `apps/web` detail view is read-only for all roles.

### W-11: Employee Qualifications

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View qualifications list | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create qualification | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit qualification | ❌ | ✅ | ✅ | ✅ | ✅ |
| View audit trail | ❌ | ✅ | ✅ | ✅ | ✅ |
| Check compliance vs standard | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-12: Employee Medical

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View medical clearances | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create medical clearance | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit medical clearance | ❌ | ✅ | ✅ | ✅ | ✅ |
| View audit trail | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-13: Employee Documents

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View documents list | ❌ | 👁️ | ✅ | ✅ | ✅ |
| View document detail | ❌ | 👁️ | ✅ | ✅ | ✅ |
| View extraction results | ❌ | ❌ | ✅ | ✅ | ✅ |
| View audit trail | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-14: Employee Hours

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View hour records | ❌ | 👁️ | ✅ | ✅ | ✅ |
| Edit hour record | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete hour record | ❌ | ❌ | ✅ | ✅ | ✅ |
| View audit trail | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-15: Compliance Check

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View compliance status | ❌ | ✅ | ✅ | ✅ | ✅ |
| View requirement gaps | ❌ | ✅ | ✅ | ✅ | ✅ |

### W-16: Document Review Queue

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View pending documents | ❌ | ❌ | ✅ (dept) | ✅ (org) | ✅ (all) |
| Open document for review | ❌ | ❌ | ✅ | ✅ | ✅ |

### W-17: Document Review Detail

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View document | ❌ | ❌ | ✅ | ✅ | ✅ |
| View extraction fields | ❌ | ❌ | ✅ | ✅ | ✅ |
| Correct extraction field | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve document | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reject document | ❌ | ❌ | ✅ | ✅ | ✅ |
| View audit trail | ❌ | ❌ | ✅ | ✅ | ✅ |

### W-18: Hour Conflicts

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View conflict list | ❌ | ❌ | ✅ (dept) | ✅ (org) | ✅ (all) |
| Resolve conflict | ❌ | ❌ | ✅ | ✅ | ✅ |

### W-19: Compliance Overview

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View org-wide compliance metrics | ❌ | ❌ | ❌ | ✅ | ✅ |
| View at-risk employees | ❌ | ❌ | ❌ | ✅ | ✅ |
| View by-department breakdown | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export compliance report | ❌ | ❌ | ❌ | ✅ | ✅ |

### W-20/W-21: Standards Reference / Detail

| Feature/Action | Employee | Supervisor | Manager | Compliance Officer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View standards list | ✅ | ✅ | ✅ | ✅ | ✅ |
| View standard detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| View requirements | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit standard | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Standards CRUD is exclusively in `apps/admin`. The web app shows read-only reference data so employees can understand what's required of them.

---

## 4. Screen → API Mapping

### W-01: Login

| When | API Call | Response Data |
|------|----------|---------------|
| Submit login form | `POST /api/auth/login` | `{ token, user: { id, name, role } }` |
| Submit register form | `POST /api/auth/register` | `{ token, user }` |
| Token refresh (background) | `POST /api/auth/refresh` | `{ token }` |
| Entra SSO redirect | `GET /api/auth/oauth/callback` | Redirect with auth code |

### W-02: Dashboard

| When | API Call | Response Data | Roles |
|------|----------|---------------|-------|
| Page load | `GET /api/employees/:myId` | Own employee record | All |
| Page load | `GET /api/employees/:myId/readiness` | Own readiness status | All |
| Page load | `GET /api/qualifications/employee/:myId` | Own qualifications (check expiring) | All |
| Page load | `GET /api/notifications` | Recent notifications | All |
| Page load | `GET /api/employees` | Team/dept employee list (for summary widget) | Supervisor+ |
| Page load | `GET /api/documents/review-queue` | Pending review count | Manager+ |
| Page load | `GET /api/hours/conflicts` | Conflict count | Manager+ |
| Click Clock In | `POST /api/hours/clock-in` | Clock-in confirmation | All |
| Click Clock Out | `POST /api/hours/clock-out` | Clock-out confirmation | All |

### W-03: My Profile

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/employees/:myId` | Own employee record |
| Page load | `GET /api/employees/:myId/readiness` | Own readiness summary |
| Change password | `POST /api/auth/change-password` | Success confirmation |

### W-04: My Qualifications

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/qualifications/employee/:myId` | List of own qualifications |
| Click qualification | `GET /api/qualifications/:id` | Qualification detail |

### W-05: My Medical

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/medical/employee/:myId` | List of own medical clearances |
| Click clearance | `GET /api/medical/:id` | Medical clearance detail |

### W-06: My Documents

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | (needs new endpoint or filtered `GET /api/documents/employee/:myId`) | Own documents list |
| Upload document | `POST /api/documents/upload` | Created document |
| Click document | `GET /api/documents/:id` | Document detail |
| View extraction | `GET /api/documents/:id/extraction` | Extraction fields |

> **⚠️ Gap:** There is no `GET /api/documents/employee/:employeeId` endpoint. Either add one, or the frontend uses the user's own ID context from the auth token + a filtered general endpoint. **Recommendation: Add `GET /api/documents/employee/:employeeId`** to match the qualifications and medical patterns. See [Section 10](#10-implementation-notes-for-kima--bunk).

### W-07: My Hours

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/hours/employee/:myId` | Own hour records |
| Clock in | `POST /api/hours/clock-in` | Clock-in record |
| Clock out | `POST /api/hours/clock-out` | Clock-out record |
| Submit manual entry | `POST /api/hours/manual` | Hour record |
| Sync calendar | `POST /api/hours/calendar/sync` | Sync result |

### W-08: My Notifications

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/notifications` | Notification list |
| Page load | `GET /api/notifications/preferences` | Current preferences |
| Mark read | `PUT /api/notifications/:id/read` | Updated notification |
| Dismiss | `DELETE /api/notifications/:id` | Confirmation |
| View digest | `GET /api/notifications/digest/weekly` | Weekly digest |
| Save preferences | `POST /api/notifications/preferences` | Updated preferences |

### W-09: Team Directory

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/employees` | Scoped employee list (auto-filtered by role) |
| Click employee row | Navigate to `/team/:id` | — |

### W-10: Employee Detail

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/employees/:id` | Employee record |
| Page load | `GET /api/employees/:id/readiness` | Readiness summary |

### W-11: Employee Qualifications

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/qualifications/employee/:employeeId` | Qualifications list |
| Click qualification | `GET /api/qualifications/:id` | Qualification detail |
| Create qualification | `POST /api/qualifications` | Created qualification |
| Edit qualification | `PUT /api/qualifications/:id` | Updated qualification |
| View audit | `GET /api/qualifications/:id/audit` | Audit trail |
| Check compliance | `GET /api/qualifications/compliance/:employeeId/:standardId` | Compliance status |

### W-12: Employee Medical

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/medical/employee/:employeeId` | Medical clearances list |
| Click clearance | `GET /api/medical/:id` | Clearance detail |
| Create clearance | `POST /api/medical` | Created clearance |
| Edit clearance | `PUT /api/medical/:id` | Updated clearance |
| View audit | `GET /api/medical/:id/audit` | Audit trail |

### W-13: Employee Documents

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | (needs `GET /api/documents/employee/:employeeId`) | Documents list |
| Click document | `GET /api/documents/:id` | Document detail |
| View extraction | `GET /api/documents/:id/extraction` | Extraction data |
| View audit | `GET /api/documents/:id/audit` | Audit trail |

### W-14: Employee Hours

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/hours/employee/:employeeId` | Hour records |
| Edit record | `PUT /api/hours/:id` | Updated record |
| Delete record | `DELETE /api/hours/:id` | Confirmation |
| View audit | `GET /api/hours/:id/audit` | Audit trail |

### W-15: Compliance Check

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/qualifications/compliance/:employeeId/:standardId` | Compliance status with requirement gaps |
| Page load | `GET /api/standards/:standardId/requirements` | Standard requirements for context |

### W-16: Document Review Queue

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/documents/review-queue` | Scoped pending documents |
| Click document | Navigate to `/reviews/:id` | — |

### W-17: Document Review Detail

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/documents/:id` | Document detail |
| Page load | `GET /api/documents/:id/extraction` | Extraction fields |
| Correct field | `PUT /api/documents/:id/extraction/:fieldId/correct` | Updated field |
| Approve | `POST /api/documents/:id/review` (body: `{ action: "approve" }`) | Review result |
| Reject | `POST /api/documents/:id/review` (body: `{ action: "reject" }`) | Review result |
| View audit | `GET /api/documents/:id/audit` | Audit trail |

### W-18: Hour Conflicts

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/hours/conflicts` | Conflict list |
| Resolve conflict | `POST /api/hours/conflicts/:id/resolve` | Resolution result |

### W-19: Compliance Overview

| When | API Call | Response Data |
|------|----------|---------------|
| Page load | `GET /api/employees` | All employees (org-wide for CO) |
| For each employee | `GET /api/employees/:id/readiness` | Readiness status |
| Export report | (needs new endpoint or client-side aggregation) | Compliance report data |

> **⚠️ Gap:** No dedicated compliance report endpoint exists. For MVP, the frontend can aggregate readiness data client-side. Post-MVP, add `GET /api/reports/compliance` as a dedicated endpoint. See [Section 10](#10-implementation-notes-for-kima--bunk).

### W-20/W-21: Standards Reference / Detail

| When | API Call | Response Data |
|------|----------|---------------|
| Page load (list) | `GET /api/standards` | Standards list |
| Page load (detail) | `GET /api/standards/:id` | Standard detail |
| Page load (detail) | `GET /api/standards/:id/requirements` | Requirements list |

---

## 5. Navigation Structure

### 5.1 Sidebar Navigation by Role

#### Employee

```
📊  Dashboard          →  /
👤  My Profile         →  /me
📋  Standards          →  /standards
🔔  Notifications      →  /me/notifications
```

**What's NOT shown:** Team, Reviews, Conflicts, Compliance. The employee sees only self-service items.

#### Supervisor

```
📊  Dashboard          →  /
👤  My Profile         →  /me
👥  Team               →  /team
📋  Standards          →  /standards
🔔  Notifications      →  /me/notifications
```

#### Manager

```
📊  Dashboard          →  /
👤  My Profile         →  /me
👥  Team               →  /team
📄  Document Review    →  /reviews
⚡  Hour Conflicts     →  /conflicts
📋  Standards          →  /standards
🔔  Notifications      →  /me/notifications
```

#### Compliance Officer

```
📊  Dashboard          →  /
👤  My Profile         →  /me
👥  Team               →  /team
📄  Document Review    →  /reviews
⚡  Hour Conflicts     →  /conflicts
🏛  Compliance         →  /compliance
📋  Standards          →  /standards
🔔  Notifications      →  /me/notifications
```

#### Admin (in `apps/web`)

Same as Compliance Officer. Admin-specific features (standards CRUD, labels, user management) live in `apps/admin`.

### 5.2 "My" Sub-Navigation

When on any `/me/*` page, show a horizontal tab bar:

```
[Profile] [Qualifications] [Medical] [Documents] [Hours] [Notifications]
   /me      /me/qualifications  /me/medical  /me/documents  /me/hours  /me/notifications
```

All roles see all tabs — these are self-service views of your own data.

### 5.3 "Team" Sub-Navigation

When viewing a specific employee (`/team/:id/*`), show a horizontal tab bar:

```
[Overview] [Qualifications] [Medical] [Documents] [Hours]
  /team/:id  /team/:id/qualifications  /team/:id/medical  /team/:id/documents  /team/:id/hours
```

Visible to Supervisor+ only. Tab availability matches per-screen role matrix above.

### 5.4 Quick Actions by Role (Dashboard)

| Role | Quick Actions |
|------|--------------|
| Employee | Clock In/Out, Upload Document, My Profile, My Hours, My Qualifications |
| Supervisor | View Team, Add Qualification, Clock In/Out, Upload Document |
| Manager | Review Documents, Resolve Conflicts, View Team, Clock In/Out |
| Compliance Officer | Compliance Overview, Export Report, View All Employees, Review Documents |
| Admin | (Same as CO in `apps/web`; admin actions in `apps/admin`) |

### 5.5 Breadcrumb Structure

| Page | Breadcrumb |
|------|-----------|
| Dashboard | Dashboard |
| My Profile | Dashboard > My Profile |
| My Qualifications | Dashboard > My Profile > Qualifications |
| My Medical | Dashboard > My Profile > Medical |
| My Documents | Dashboard > My Profile > Documents |
| My Hours | Dashboard > My Profile > Hours |
| My Notifications | Dashboard > Notifications |
| Team Directory | Dashboard > Team |
| Employee Detail | Dashboard > Team > {Employee Name} |
| Employee Qualifications | Dashboard > Team > {Employee Name} > Qualifications |
| Employee Medical | Dashboard > Team > {Employee Name} > Medical |
| Employee Documents | Dashboard > Team > {Employee Name} > Documents |
| Employee Hours | Dashboard > Team > {Employee Name} > Hours |
| Compliance Check | Dashboard > Team > {Employee Name} > Compliance > {Standard Name} |
| Document Review Queue | Dashboard > Document Review |
| Document Review Detail | Dashboard > Document Review > {Document Name} |
| Hour Conflicts | Dashboard > Hour Conflicts |
| Compliance Overview | Dashboard > Compliance |
| Standards List | Dashboard > Standards |
| Standard Detail | Dashboard > Standards > {Standard Name} |

---

## 6. Employee Role UX — Special Focus

### 6.1 Problem Statement

The current employee dashboard is broken:
- Shows employee count stats that employees cannot access (triggers a 403)
- Has a "View All Employees" link that leads to a 403
- Shows "Employees" in the sidebar that employees can't use
- Has no quick actions — the only action is a dead link
- Says "Employee directory access is available to supervisors and above" — this is an apology, not a feature

### 6.2 Design Goal

An employee logs in and immediately sees: **Am I compliant? What's expiring? What can I do?**

### 6.3 Employee Dashboard Specification

**Widgets (in order):**

1. **My Readiness** — Overall status badge (Compliant ✅ / At Risk ⚠️ / Non-Compliant ❌), qualification completion fraction, medical status.
   - API: `GET /api/employees/:myId/readiness`

2. **Upcoming Expirations** — List of qualifications and medical clearances expiring within 60 days, sorted by nearest expiration.
   - API: `GET /api/qualifications/employee/:myId` (filter client-side by expiresAt < now + 60d)
   - API: `GET /api/medical/employee/:myId` (filter client-side by expiresAt < now + 60d)

3. **Quick Actions** — Button grid:
   - 🕐 **Clock In / Clock Out** (toggle based on current state)
   - 📄 **Upload Document**
   - 👤 **My Profile**
   - 📊 **My Hours**
   - 📋 **My Qualifications**
   - 🏥 **My Medical**

4. **Recent Notifications** — Last 5 notifications with "View All" link.
   - API: `GET /api/notifications` (limit=5)

### 6.4 What Employees Do NOT See

| Element | Reason |
|---------|--------|
| "Employees" / "Team" nav item | No access to other employees' data |
| Employee count stats | Cannot call `GET /api/employees` |
| "View All Employees" link | 403 — removed entirely |
| Document Review nav/widget | Not a reviewer |
| Hour Conflicts nav/widget | Not a conflict resolver |
| Compliance Overview | No org-wide access |
| Any audit trail links | No `audit:read` permission |
| Create/Edit Qualification buttons | Managed by Supervisor+ |
| Create/Edit Medical buttons | Managed by Supervisor+ |

### 6.5 Employee Navigation (Sidebar)

```
📊  Dashboard               ← Home screen with readiness + quick actions
👤  My Profile               ← Own record + readiness
📋  Standards                ← Read-only: "what do I need to be compliant?"
🔔  Notifications            ← My alerts + preferences
```

Four items. Clean. No dead ends. Every link works.

### 6.6 Employee User Flow

```
Login
  → Dashboard (Am I compliant? What's expiring?)
    → Clock In (one click from dashboard)
    → My Profile (see my record + readiness detail)
      → My Qualifications (what do I have?)
      → My Medical (am I cleared?)
      → My Documents (what have I uploaded?)
      → My Hours (my time records)
    → Standards (what's required of me?)
    → Notifications (what's new?)
      → Notification Preferences (how do I want to be notified?)
```

---

## 7. Role-Specific Dashboard Widgets

### 7.1 Widget Inventory

| Widget ID | Widget Name | Description |
|-----------|------------|-------------|
| `DW-01` | My Readiness | Personal compliance status badge + summary |
| `DW-02` | Upcoming Expirations (Own) | Own quals/medical expiring within 60 days |
| `DW-03` | Quick Actions | Role-appropriate action button grid |
| `DW-04` | Recent Notifications | Last 5 notifications |
| `DW-05` | Team Summary | Team member count + compliance breakdown |
| `DW-06` | Team Expirations | Team members with quals/medical expiring soon |
| `DW-07` | Department Compliance | Department-wide compliance percentage + trend |
| `DW-08` | Pending Reviews | Count of documents awaiting review |
| `DW-09` | Hour Conflicts | Count of unresolved hour conflicts |
| `DW-10` | Org Compliance | Organization-wide compliance metrics |
| `DW-11` | At-Risk Employees | Employees at risk across departments |

### 7.2 Widget Visibility by Role

| Widget | Employee | Supervisor | Manager | Compliance Officer | Admin |
|--------|:--------:|:----------:|:-------:|:------------------:|:-----:|
| `DW-01` My Readiness | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DW-02` Upcoming Expirations (Own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DW-03` Quick Actions | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DW-04` Recent Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DW-05` Team Summary | ❌ | ✅ | ✅ | ✅ | ✅ |
| `DW-06` Team Expirations | ❌ | ✅ | ✅ | ✅ | ✅ |
| `DW-07` Department Compliance | ❌ | ❌ | ✅ | ✅ | ✅ |
| `DW-08` Pending Reviews | ❌ | ❌ | ✅ | ✅ | ✅ |
| `DW-09` Hour Conflicts | ❌ | ❌ | ✅ | ✅ | ✅ |
| `DW-10` Org Compliance | ❌ | ❌ | ❌ | ✅ | ✅ |
| `DW-11` At-Risk Employees | ❌ | ❌ | ❌ | ✅ | ✅ |

### 7.3 Widget → API Mapping

| Widget | API Calls | Notes |
|--------|-----------|-------|
| `DW-01` | `GET /api/employees/:myId/readiness` | Single call, cached for session |
| `DW-02` | `GET /api/qualifications/employee/:myId`, `GET /api/medical/employee/:myId` | Filter expiring < 60 days client-side |
| `DW-03` | None (static per role) | Links only |
| `DW-04` | `GET /api/notifications?limit=5` | Last 5 |
| `DW-05` | `GET /api/employees` | Scoped by role; derive counts |
| `DW-06` | `GET /api/employees` → for each: `GET /api/employees/:id/readiness` | **Perf concern:** batch endpoint needed post-MVP |
| `DW-07` | Same as DW-05 + readiness aggregation | Department scope |
| `DW-08` | `GET /api/documents/review-queue` | Count only — header request or `?limit=0` |
| `DW-09` | `GET /api/hours/conflicts` | Count only |
| `DW-10` | `GET /api/employees` (CO: all) + readiness aggregation | Cross-department |
| `DW-11` | Derived from DW-10 data | Filter to at_risk + non_compliant |

> **⚠️ Performance Note:** Widgets DW-06, DW-07, and DW-10 require N+1 API calls (one per employee for readiness). For MVP, this is acceptable with small team sizes. Post-MVP, add a batch readiness endpoint: `GET /api/employees/readiness?scope=team|department|org`. See [Section 10](#10-implementation-notes-for-kima--bunk).

---

## 8. RBAC Master Cross-Reference

This is the single authoritative table mapping Screen × Role × API × Permission. It references but does not duplicate the [RBAC API Spec](./rbac-api-spec.md).

### 8.1 Screen Access by Role

| Screen | Route | Employee | Supervisor | Manager | CO | Admin |
|--------|-------|:--------:|:----------:|:-------:|:--:|:-----:|
| Login | `/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | `/` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Profile | `/me` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Qualifications | `/me/qualifications` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Medical | `/me/medical` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Documents | `/me/documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Hours | `/me/hours` | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Notifications | `/me/notifications` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team Directory | `/team` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Detail | `/team/:id` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Qualifications | `/team/:id/qualifications` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Medical | `/team/:id/medical` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Documents | `/team/:id/documents` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Employee Hours | `/team/:id/hours` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Compliance Check | `/team/:eid/compliance/:sid` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Document Review Queue | `/reviews` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Document Review Detail | `/reviews/:id` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Hour Conflicts | `/conflicts` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Compliance Overview | `/compliance` | ❌ | ❌ | ❌ | ✅ | ✅ |
| Standards Reference | `/standards` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Standard Detail | `/standards/:id` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unauthorized | `/unauthorized` | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.2 Screen → API → Permission Cross-Reference

| Screen | Primary API Calls | Required Permissions | Data Scope |
|--------|-------------------|---------------------|------------|
| Dashboard | `GET /employees/:myId`, `GET /employees/:myId/readiness`, `GET /qualifications/employee/:myId`, `GET /notifications` | `employees:read`(own), `employees:readiness`(own), `qualifications:read`(own), `notifications:read` | Own |
| Dashboard (Supervisor+) | + `GET /employees` | + `employees:read`(scoped) | Team/Dept/Org |
| Dashboard (Manager+) | + `GET /documents/review-queue`, `GET /hours/conflicts` | + `documents:review`, `hours:conflicts` | Dept/Org |
| My Profile | `GET /employees/:myId`, `GET /employees/:myId/readiness`, `POST /auth/change-password` | `employees:read`(own), `employees:readiness`(own), `auth:update` | Own |
| My Qualifications | `GET /qualifications/employee/:myId`, `GET /qualifications/:id` | `qualifications:read`(own) | Own |
| My Medical | `GET /medical/employee/:myId`, `GET /medical/:id` | `medical:read`(own) | Own |
| My Documents | `GET /documents/employee/:myId`†, `POST /documents/upload`, `GET /documents/:id` | `documents:read`(own), `documents:create` | Own |
| My Hours | `GET /hours/employee/:myId`, `POST /hours/clock-in`, `POST /hours/clock-out`, `POST /hours/manual` | `hours:read`(own), `hours:create` | Own |
| My Notifications | `GET /notifications`, `GET /notifications/preferences`, `PUT /notifications/:id/read`, `DELETE /notifications/:id`, `POST /notifications/preferences` | `notifications:read`, `notifications:update`, `notifications:delete` | Own |
| Team Directory | `GET /employees` | `employees:read` | Team/Dept/Org |
| Employee Detail | `GET /employees/:id`, `GET /employees/:id/readiness` | `employees:read`, `employees:readiness` | Scoped |
| Employee Qualifications | `GET /qualifications/employee/:eid`, `POST /qualifications`, `PUT /qualifications/:id`, `GET /qualifications/:id/audit`, `GET /qualifications/compliance/:eid/:sid` | `qualifications:read`, `qualifications:create`, `qualifications:update`, `qualifications:compliance`, `audit:read` | Scoped |
| Employee Medical | `GET /medical/employee/:eid`, `POST /medical`, `PUT /medical/:id`, `GET /medical/:id/audit` | `medical:read`, `medical:create`, `medical:update`, `audit:read` | Scoped |
| Employee Documents | `GET /documents/employee/:eid`†, `GET /documents/:id`, `GET /documents/:id/audit` | `documents:read`, `audit:read` | Scoped |
| Employee Hours | `GET /hours/employee/:eid`, `PUT /hours/:id`, `DELETE /hours/:id`, `GET /hours/:id/audit` | `hours:read`, `hours:update`, `hours:delete`, `audit:read` | Scoped |
| Compliance Check | `GET /qualifications/compliance/:eid/:sid`, `GET /standards/:sid/requirements` | `qualifications:compliance`, `standards:read` | Scoped |
| Document Review Queue | `GET /documents/review-queue` | `documents:review` | Dept/Org |
| Document Review Detail | `GET /documents/:id`, `GET /documents/:id/extraction`, `PUT /documents/:id/extraction/:fid/correct`, `POST /documents/:id/review`, `GET /documents/:id/audit` | `documents:read`, `documents:extract`, `documents:approve`, `audit:read` | Dept/Org |
| Hour Conflicts | `GET /hours/conflicts`, `POST /hours/conflicts/:id/resolve` | `hours:conflicts` | Dept/Org |
| Compliance Overview | `GET /employees` (all), readiness aggregation | `employees:read`(org), `employees:readiness`(org), `export:reports` | Org |
| Standards Reference | `GET /standards`, `GET /standards/:id`, `GET /standards/:id/requirements` | `standards:read` | All (global) |

> † Endpoint `GET /api/documents/employee/:employeeId` does not yet exist — see [Section 10](#10-implementation-notes-for-kima--bunk).

### 8.3 Route Guard Configuration

For Kima to implement in `App.tsx`:

```tsx
// Route guards for apps/web
const routes = [
  // Public
  { path: '/login', element: <LoginPage />, auth: false },

  // All authenticated users
  { path: '/', element: <DashboardPage />, auth: true },
  { path: '/me', element: <MyProfilePage />, auth: true },
  { path: '/me/qualifications', element: <MyQualificationsPage />, auth: true },
  { path: '/me/medical', element: <MyMedicalPage />, auth: true },
  { path: '/me/documents', element: <MyDocumentsPage />, auth: true },
  { path: '/me/hours', element: <MyHoursPage />, auth: true },
  { path: '/me/notifications', element: <MyNotificationsPage />, auth: true },
  { path: '/standards', element: <StandardsPage />, auth: true },
  { path: '/standards/:id', element: <StandardDetailPage />, auth: true },

  // Supervisor+ (minRole: 'supervisor')
  { path: '/team', element: <TeamDirectoryPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id', element: <EmployeeDetailPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id/qualifications', element: <EmployeeQualificationsPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id/medical', element: <EmployeeMedicalPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id/documents', element: <EmployeeDocumentsPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id/hours', element: <EmployeeHoursPage />, auth: true, minRole: 'supervisor' },
  { path: '/team/:id/compliance/:standardId', element: <ComplianceCheckPage />, auth: true, minRole: 'supervisor' },

  // Manager+ (minRole: 'manager')
  { path: '/reviews', element: <DocumentReviewQueuePage />, auth: true, minRole: 'manager' },
  { path: '/reviews/:id', element: <DocumentReviewDetailPage />, auth: true, minRole: 'manager' },
  { path: '/conflicts', element: <HourConflictsPage />, auth: true, minRole: 'manager' },

  // Compliance Officer+ (minRole: 'compliance_officer')
  { path: '/compliance', element: <ComplianceOverviewPage />, auth: true, minRole: 'compliance_officer' },

  // Error pages
  { path: '/unauthorized', element: <UnauthorizedPage />, auth: true },
  { path: '*', element: <NotFoundPage />, auth: false },
];
```

---

## 9. PRD Coverage Analysis

> Cross-reference with [Source PRD](../requirements/eclat-spec.md). This section documents which PRD screens and features are covered, deferred, or intentionally omitted.

### 9.1 PRD Screens → App-Spec Coverage

#### Employee Self-Service (PRD §3.1)

| PRD Screen | App-Spec Screen | Status | Notes |
|-----------|----------------|--------|-------|
| 1.1 Dashboard | W-02 Dashboard | ✅ Covered | Role-adaptive; exceeds PRD spec |
| 1.2 My Certifications | W-04 My Qualifications | ✅ Covered | PRD allows employee cert upload; we restrict self-creation (Supervisor+ only). Employees can upload *documents* (W-06) which enter the review queue. |
| 1.3 My Hours | W-07 My Hours | ✅ Covered | Clock in/out, manual entry, calendar sync |
| 1.4 My Requirements | W-15 Compliance Check + W-20/W-21 Standards | ⚠️ Partial | PRD has a standalone "My Requirements" screen showing per-requirement status. We have Standards Reference (read-only) and per-employee Compliance Check (Supervisor+). **Gap:** Employee cannot self-serve their own compliance status against a standard. Consider adding a self-service variant of W-15 at `/me/compliance` in Phase 2. |
| 1.5 Medical Clearance Status | W-05 My Medical | ✅ Covered | |
| 1.6 Notifications | W-08 My Notifications | ✅ Covered | |

#### Manager/Supervisor (PRD §3.2)

| PRD Screen | App-Spec Screen | Status | Notes |
|-----------|----------------|--------|-------|
| 2.1 Team Dashboard | W-02 Dashboard (Supervisor/Manager view) | ✅ Covered | Role-adaptive dashboard with team/dept widgets |
| 2.2 Employee Profile (Manager View) | W-10 Employee Detail + W-11 through W-14 | ✅ Covered | Tab-based sub-navigation covers all data categories |
| 2.3 Certifications Approval Queue | W-16 Document Review Queue | ⚠️ Redirected | PRD treats cert approvals separately; our architecture routes cert documents through the general Document Review Queue. **Approval workflow for qualifications entered manually (not via document upload) is not yet covered — deferred.** |
| 2.4 Hours Verification | W-18 Hour Conflicts | ⚠️ Partial | PRD has explicit approve/reject for manual hours. Our W-18 covers conflict resolution but **we lack dedicated hours approve/reject endpoints and a standalone hours approval screen. Deferred: needs `POST /api/hours/:id/approve` and `POST /api/hours/:id/reject` endpoints.** |
| 2.5 Requirements & Gaps | W-15 Compliance Check | ⚠️ Partial | PRD shows team-wide gaps view; W-15 is per-employee. The Team Directory (W-09) shows readiness column which partially covers this. **Gap: no dedicated team gaps view. Consider adding a batch compliance gaps screen in Phase 2.** |
| 2.6 Escalations & Alerts | W-08 Notifications (Supervisor+ view) | ⚠️ Partial | PRD has a dedicated escalations screen with resolve/snooze/escalate actions. **Our notifications screen covers escalation viewing but lacks escalation management actions. Deferred to Phase 2.** |
| 2.7 Reports | W-19 Compliance Overview | ⚠️ Partial | PRD's Manager reports (PDF export, cert status, hours summary, audit trail) are partially covered by W-19 (CO+). **Manager-scoped reports not yet available. Deferred: needs Reports API module.** |

#### Compliance/Auditor (PRD §3.3)

| PRD Screen | App-Spec Screen | Status | Notes |
|-----------|----------------|--------|-------|
| 3.1 Organization Dashboard | W-19 Compliance Overview | ✅ Covered | |
| 3.2 Employee Directory & Bulk Search | W-09 Team Directory (CO view: org-wide) | ✅ Covered | CO sees all employees; advanced filters are implementation details |
| 3.3 Compliance Audit View | — | ❌ Not covered | PRD has a dedicated audit trail screen with search, change log, and approval chain visibility. **Deferred: needs dedicated audit screen + `GET /api/audit/trail` endpoint. Phase 2+.** |
| 3.4 Standards Configuration | A-05/A-06 Standards Management | ✅ Covered | In `apps/admin` |
| 3.5 Reports & Analytics | W-19 Compliance Overview (partial) | ⚠️ Partial | PRD has expiration forecast, hours trend analysis, readiness timeline, full export. **W-19 covers basic metrics + export. Advanced analytics deferred to Phase 3.** |
| 3.6 Document Processing Configuration | — | ❌ Not covered | AI/OCR configuration screen. **Deferred: AI document processing is Phase 2+ per MVP scope.** |
| 3.7 User & Role Management | `apps/admin` (A-03/A-04 + future) | ⚠️ Partial | Employee CRUD exists in admin. User account management + role assignment not yet in admin screen inventory. |

### 9.2 PRD Approval Workflows → Implementation Status

| PRD Workflow | API Support | Screen Support | Status |
|-------------|------------|----------------|--------|
| Hours approve/reject (§4.3) | ❌ No `POST /hours/approve/:id` or `POST /hours/reject/:id` | ❌ No approval screen | **Deferred.** Our architecture uses conflict resolution (W-18) rather than per-entry approval. PRD's approve/reject model may be needed for manual entries. |
| Certifications approve/reject (§4.4) | ❌ No `POST /qualifications/approve/:id` or `POST /qualifications/reject/:id` | ❌ No qualification approval screen | **Deferred.** Document-based certs go through Document Review (W-16/W-17). Manual qualification entry by Supervisor+ bypasses approval. |
| Document approve/reject (§4.10) | ✅ `POST /api/documents/:id/review` | ✅ W-16/W-17 Document Review | **Covered.** |

### 9.3 PRD API Modules Not Yet Implemented

| PRD API Section | Our Status | Notes |
|----------------|-----------|-------|
| §4.7 Compliance & Readiness | ⚠️ Partial | Readiness via `GET /api/employees/:id/readiness`. No dedicated compliance module. Gaps, forecast, batch check, audit trail endpoints deferred. |
| §4.9 Reports | ❌ Not implemented | No reports module. W-19 uses client-side aggregation. Reports API deferred to Phase 2+. |
| §4.11 Integration Endpoints | ❌ Not implemented | OAuth calendar, payroll import, scheduling sync. Deferred to Phase 2+ per MVP scope. |
| §4.12 Admin & Configuration | ⚠️ Partial | User management not yet in API. Standards config exists. Notification rules are admin-only endpoint. Custom framework config deferred. |

---

## 10. Implementation Notes for Kima & Bunk

### 10.1 API Gaps to Address (Bunk)

| Gap | Priority | Description | Recommended Endpoint |
|-----|----------|-------------|---------------------|
| **Documents by employee** | P0 | No way to list documents for a specific employee. Qualifications and medical both have `/employee/:employeeId` endpoints; documents should match. | `GET /api/documents/employee/:employeeId` — auth: Employee (own only), Supervisor+ (scoped) |
| **Batch readiness** | P1 | Dashboard widgets require N+1 calls for team/dept readiness. OK for MVP but will not scale. | `GET /api/employees/readiness/summary?scope=team|department|org` — returns aggregate counts by status |
| **Compliance report** | P2 | No report generation endpoint. CO Overview page needs aggregated data. | `GET /api/reports/compliance?format=json|csv` — CO+ only |

### 10.2 Frontend Architecture Changes (Kima)

1. **Route restructure:** Rename `/employees` → `/team`, add `/me/*` routes, add role-gated routes.
2. **Layout refactor:** Make sidebar dynamic based on `user.role`. Use the nav structure from [Section 5.1](#51-sidebar-navigation-by-role).
3. **ProtectedRoute enhancement:** Add `minRole` prop per [Section 8.3](#83-route-guard-configuration). Redirect to `/unauthorized` on insufficient role.
4. **Dashboard refactor:** Replace current employee-count dashboard with role-adaptive widget system per [Section 7](#7-role-specific-dashboard-widgets).
5. **PermissionGate component:** Implement per [RBAC API Spec §7.4](./rbac-api-spec.md) for conditional rendering of actions.
6. **Tab navigation:** Add horizontal tab bars for `/me/*` and `/team/:id/*` sub-navigation.

### 10.3 Implementation Order

| Phase | Screens | Dependencies |
|-------|---------|-------------|
| **Phase 1: Employee UX** | W-02 (Dashboard rewrite), W-03 (My Profile), W-04, W-05, W-06, W-07, W-08, W-22, W-23 + nav restructure | Bunk: `GET /api/documents/employee/:employeeId` |
| **Phase 2: Team Management** | W-09 (Team Directory), W-10, W-11, W-12, W-13, W-14, W-15 | Phase 1 complete |
| **Phase 3: Manager Operations** | W-16, W-17, W-18 | Phase 2 complete |
| **Phase 4: Compliance & Standards** | W-19, W-20, W-21 | Phase 2 complete (can parallel with Phase 3) |
| **Phase 5: Admin App** | A-01 through A-09 | Core API implementations complete |

### 10.4 Key Design Decisions in This Spec

1. **No "Employees" nav for employees.** The employee directory is renamed "Team" and hidden from the Employee role entirely.
2. **Self-service cannot create compliance records.** Qualifications and medical clearances are managed by Supervisors+ — employees can only view their own. This is a deliberate choice for regulated industries.
3. **Two apps remain the right split.** `apps/web` for day-to-day operations (all roles), `apps/admin` for platform configuration (Admin only). Admins who need to check compliance status use `apps/web` like everyone else.
4. **MVP accepts N+1 readiness queries.** Team/department dashboards will make one readiness call per employee. This is fine for teams < 50. A batch endpoint should be added before scaling past that.
5. **Standards are read-only in `apps/web`.** Employees and supervisors need to see what's required of them, but modification is admin-only.
6. **Document review is Manager+, not Supervisor+.** Supervisors can view team documents but cannot approve/reject. This matches the `documents:review` and `documents:approve` permission assignments in the RBAC spec.

---

*This specification is the authoritative reference for what the E-CLAT UI should look like and how it should behave. All frontend work should trace back to a screen, widget, or action defined here. If something isn't in this spec, it's not in MVP.*
