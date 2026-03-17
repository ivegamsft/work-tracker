# Multi-Tenant UX Spec — E-CLAT

> **Author:** Kima (Frontend Dev)  
> **Date:** 2026-03-20  
> **Status:** Design Specification (Pre-Implementation)  
> **Issue:** #108 (SA-11)  
> **Related Decisions:** Decision 1 (Tiered Isolation), Decision 8 (Group Mapping + Claims), Decision 11 (Logical Environments)  
> **Applies To:** `apps/admin`, `apps/web` (admin section), tenant settings, multi-environment workflows  
> **Companion Docs:** `docs/specs/entra-auth-design.md`, `docs/specs/rbac-api-spec.md`

---

## Executive Summary

E-CLAT serves **multiple independent tenants** (organizations) with **isolated data, users, and compliance settings**. This spec defines the **Admin Portal** experience (separate SPA at `apps/admin`) that enables:

- **Tenant admin dashboard** with read-only organization view, user roster, compliance overview
- **Environment switcher** (prod/staging/dev/custom) for viewing tenant data across deployment tiers
- **Environment creation/cloning wizard** for setting up test/staging from production snapshots
- **User invitation flows:** search Entra directory, send B2B invites, or create local accounts
- **Group management UI** to define organizational groups (departments, roles) and map to Entra groups
- **Claim-driven auto-assignment rules editor** to configure which groups get which templates/assignments automatically
- **Cross-environment aggregate dashboard** showing compliance status, critical incidents, outliers across all environments
- **Provider configuration** (Entra tenant ID, SAML issuer, feature flag overrides per environment)

All screens follow React best practices with role-based access (Admin-only), feature flags for beta features, and graceful degradation when external services (Entra, SAML) are unavailable.

---

## 1. User Stories

### 1.1 As a Tenant Admin

I want to **view a dashboard** of my organization's compliance status across all environments so that I can spot critical issues quickly.

**Acceptance Criteria:**
- Dashboard shows: total employees, total assigned templates, compliance summary (% compliant, % at-risk, % non-compliant)
- Critical incidents panel: flagged assignments (past deadline, high failure rate, escalation needed)
- User roster quick-view: # active users, # disabled, # pending invitation
- Templates summary: # published, # in-draft, # archived, # active assignments
- Environment selector at top (prod, staging, dev) — dashboard updates on environment change
- All metrics updated in real-time or near real-time (polling every 30s or WebSocket push if Decision 9 implemented)

### 1.2 As a Tenant Admin

I want to **switch between environments** (prod, staging, dev) without logging out so that I can test changes before deploying to production.

**Acceptance Criteria:**
- Environment switcher dropdown in header/sidebar (always visible)
- Current environment highlighted; click to change
- On environment change: reload dashboard + navigation context; preserve authentication token but switch tenant/environment context
- Can only access environments for which user has permission (e.g., admin can access all; manager can access only prod)
- URL includes environment param for bookmarking/sharing (e.g., `/dashboard?env=staging`)
- Switching environments doesn't reload entire page (smooth SPA transition)

### 1.3 As a Tenant Admin

I want to **create a new environment** by cloning production as a test sandbox so that I can safely test new templates + features.

**Acceptance Criteria:**
- "Create Environment" button → modal/wizard
- Wizard Step 1: Name, type (staging, dev, custom), clone from (dropdown: prod, none)
- Wizard Step 2: Select what to clone (all, templates only, users only, settings only)
- Wizard Step 3: Review + confirm
- Clone operation: Creates new environment with copied data (anonymized if copying templates + assignments)
- Confirmation: "✓ Staging environment created. You can now switch to it above."

### 1.4 As a Tenant Admin

I want to **invite users** via multiple methods so that new team members get access.

**Acceptance Criteria:**
- Invite panel in User Management section
- Three methods:
  1. **Entra Directory Search:** Search user by email/name → shows user details from Entra → click "Invite" → sends B2B invite to email
  2. **Bulk Invite (CSV):** Upload CSV (email, role) → preview invitations → send batch
  3. **Local Account:** Create account without Entra (name, email, password set via link) — for external users
- Invitation status tracking: Pending, Accepted, Resent
- Can resend invitations, revoke pending invites
- Invited users appear in User Roster with "Pending" status until they accept

### 1.5 As a Tenant Admin

I want to **manage groups** and map them to Entra groups so that I can use directory-based access controls.

**Acceptance Criteria:**
- Group Management page: List of groups (Department, Role, Team)
- Add Group button → modal: name, description, type (department/role/team), map to Entra group (dropdown or search)
- Group detail page: members list, mapped Entra group, permissions/scopes
- Bulk member management: Add/remove users from group (updates group membership + Entra group claim if connected)
- Group creation auto-syncs with Entra if connected; otherwise manual member management

### 1.6 As a Tenant Admin

I want to **configure claim-driven auto-assignment rules** so that new employees automatically get compliance templates based on their group.

**Acceptance Criteria:**
- Rules Editor page: Table of rules (Group → Template, Condition, Status)
- Add Rule button → modal: Select Group, Select Template, Set Condition (e.g., "all members", "role = manager")
- Rule preview: "Whenever a user joins [Department], assign [Annual CPR] with deadline [90 days]"
- Toggle rule on/off without deleting
- Rule execution: When user joins group → API creates TemplateAssignment automatically
- Audit log: Track auto-assignment events per rule

### 1.7 As a Tenant Admin

I want to **view and configure provider settings** (Entra tenant ID, SAML issuer, feature flags) so that I control how auth works.

**Acceptance Criteria:**
- Settings page with tabs: Authentication, Feature Flags, Integrations
- Auth tab: Display Entra Tenant ID (read-only), SAML metadata URL (read-only), test connection button
- Feature Flags tab: List of tenant-specific flags that can be overridden (master `compliance.templates`, `records.hours-ui`, etc.)
- Integrations tab: List of enabled integrations (Entra, SAML, API keys for third-party services)
- All settings changes logged to audit trail with timestamp + admin email

### 1.8 As a Compliance Officer

I want to **see a cross-environment compliance summary** so that I can compare deployment performance.

**Acceptance Criteria:**
- Compliance Dashboard (separate from tenant admin dashboard)
- Side-by-side comparison: Prod vs Staging vs Dev
- Metrics per environment: Total assignments, % fulfilled, % at-risk, % expired
- Outliers flagged: Prod has much lower compliance than staging → investigate
- Drill-down: Click environment → open tenant admin dashboard for that environment

---

## 2. Page & Component Hierarchy

### 2.1 Page Structure

```
AdminApp
├── AdminLayout (header with environment switcher, logout)
│   ├── AdminSidebar
│   │   ├── Dashboard link
│   │   ├── Users link
│   │   ├── Groups link
│   │   ├── Templates link (future)
│   │   ├── Rules link
│   │   ├── Settings link
│   │   └── Audit Log link
│   │
│   └── Main Content Area
│       ├── DashboardPage (/dashboard)
│       ├── UserManagementPage (/users)
│       ├── GroupManagementPage (/groups)
│       ├── RulesEditorPage (/rules)
│       ├── SettingsPage (/settings)
│       ├── AuditLogPage (/audit)
│       └── EnvironmentCreationWizardPage (/environments/new)
│
└── ComplianceDashboardPage (cross-environment view)
    └── /compliance/dashboard
```

### 2.2 Reusable Components

```
EnvironmentSwitcher
├── Dropdown: [Current Env ▼]
├── Options: Prod, Staging, Dev
└── [+] Create New Environment

DashboardCard
├── Title + Metric + Trend (↑ or ↓)
├── ChartContent (optional)
└── DrillDown link

UserRosterTable
├── Columns: Name, Email, Role, Status, Actions
├── Bulk select + actions (disable, enable, reset password)
└── Pagination

GroupList
├── Group cards: Name, # members, mapped Entra group, actions
└── Add/Edit/Delete modals

RuleEditor
├── Table: Group → Template, Condition, Status, Actions
├── Inline editing or modal editing
└── Toggle on/off

InvitePanel
├── Tabs: Directory Search, Bulk Upload, Local Account
├── Form for each method
└── Preview + send

SettingsTabs
├── Authentication settings
├── Feature flags toggle list
├── Integrations list
└── Save/Reset buttons
```

---

## 3. Wireframe Descriptions (Text-Based)

### 3.1 Admin Dashboard

```
Header:
┌──────────────────────────────────────────────────────────┐
│ E-CLAT Admin | Environment: [Prod ▼] [+ Create New]     │
│ Logged in as: alice@company.com [ Logout ]              │
└──────────────────────────────────────────────────────────┘

Sidebar:
│ Dashboard         ●
│ User Management
│ Groups
│ Auto-Assignment Rules
│ Settings
│ Audit Log
│ Compliance (cross-env)

Main:
┌──────────────────────────────────────────────────────────┐
│                         DASHBOARD                        │
├──────────────────────────────────────────────────────────┤
│
│ ORGANIZATION HEALTH
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────┐
│ │ 245 Employees    │ │ 1,267 Assigned   │ │ 87% Active │
│ │ ↓ 2% from last mo│ │ Templates        │ │ Users      │
│ └──────────────────┘ └──────────────────┘ └────────────┘
│
│ COMPLIANCE SUMMARY
│ Compliant:    ███████░░░░ 73% (1,180 / 1,620)
│ At Risk:      ██░░░░░░░░░ 18% (291 / 1,620)
│ Non-Compliant: █░░░░░░░░░░  9% (149 / 1,620)
│
│ CRITICAL INCIDENTS
│ ┌────────────────────────────────────────────────────────┐
│ │ ⚠ 42 assignments past deadline (last 7 days)         │
│ │ ⚠ CPR Certification - 15% failure rate (high)        │
│ │ ⚠ Finance Dept - 3 escalations pending review        │
│ └────────────────────────────────────────────────────────┘
│
│ TEMPLATES & ASSIGNMENTS
│ Published: 18  |  Draft: 3  |  Active Assignments: 1,267
│
│ USER ROSTER
│ Active: 245  |  Disabled: 12  |  Pending Invitations: 8
│
└──────────────────────────────────────────────────────────┘
```

### 3.2 Environment Switcher Dropdown

```
Environment Switcher:
┌───────────────┐
│ Prod      ✓   │  ← Current (highlighted)
├───────────────┤
│ Staging       │
├───────────────┤
│ Dev           │
├───────────────┤
│ [+] New...    │  ← Opens Environment Creation Wizard
└───────────────┘

On click "New...":
  → EnvironmentCreationWizardPage
```

### 3.3 User Management Page

```
Header: "User Management"

Invite Panel (collapsible):
  [ ▼ Invite Users ]
  ┌─────────────────────────────────────────────────────────┐
  │ Invite Method: (●) Directory Search (○) Bulk (○) Local  │
  │                                                          │
  │ Search Entra Directory:                                 │
  │ [__________________________] (email or name)            │
  │                                                          │
  │ Results:                                                │
  │ [ ] alice@company.com - Alice Johnson (active)          │
  │ [ ] bob@company.com   - Bob Smith (active)              │
  │                                                          │
  │ [ Send Invitations ] [ Cancel ]                         │
  └─────────────────────────────────────────────────────────┘

User Roster Table:
┌─────────────────────────────────────────────────────────┐
│ [☐] Name           │ Email         │ Role       │ Status │
├─────────────────────────────────────────────────────────┤
│ [X] Alice Johnson  │ alice@...     │ Admin      │ Active │
│ [  ] Bob Smith     │ bob@...       │ Manager    │ Active │
│ [  ] Carol Davis   │ carol@...     │ Employee   │ Pending│
│ [  ] David Brown   │ david@...     │ Supervisor │ Disabled
└─────────────────────────────────────────────────────────┘

Bulk Actions: [ Disable Users ] [ Reset Passwords ] [ Resend Invites ]
```

### 3.4 Group Management Page

```
Header: "Group Management"

[ + Create Group ]

Group Cards (grid or list):
┌──────────────────────────┐
│ Finance Department       │
│ 24 members               │
│ Mapped to: Finance-Team  │
│                          │
│ [ View Members ]         │
│ [ Edit ] [ Delete ]      │
└──────────────────────────┘

Modal on "Edit":
┌─────────────────────────────────────────────────────────┐
│ Edit Group: Finance Department                         │
│                                                         │
│ Name: [Finance Department]                             │
│ Type: [Department ▼]                                   │
│ Description: [_________________]                       │
│                                                         │
│ Mapped Entra Group: [Finance-Team ▼]                   │
│ [ + Map to Different Group ]                           │
│                                                         │
│ Members (24):                                           │
│ ┌─────────────────────────────────────────────────────┐
│ │ [☐] alice@company.com - Manager                    │
│ │ [☐] bob@company.com   - Analyst                    │
│ └─────────────────────────────────────────────────────┘
│
│ [ + Add Member ] [ Remove Selected ]                    │
│ [ Save ] [ Cancel ]                                    │
└─────────────────────────────────────────────────────────┘
```

### 3.5 Auto-Assignment Rules Page

```
Header: "Auto-Assignment Rules"
Description: "Automatically assign templates to new group members"

[ + Create Rule ]

Rules Table:
┌────────────────────────────────────────────────────────────┐
│ [☐] Group          │ Template          │ Status │ Actions  │
├────────────────────────────────────────────────────────────┤
│ [  ] Finance Dept  │ Annual Training   │ ✓ On   │ [ E ] [ X ]
│ [X] IT Department  │ Security Training │ ✓ On   │ [ E ] [ X ]
│ [  ] Managers      │ CPR Certification │ ✗ Off  │ [ E ] [ X ]
└────────────────────────────────────────────────────────────┘

Modal on "Create" or "Edit":
┌─────────────────────────────────────────────────────────┐
│ Create Auto-Assignment Rule                             │
│                                                         │
│ Group: [Finance Department ▼]                           │
│ Template: [Annual Training ▼]                           │
│                                                         │
│ Condition:                                              │
│ (●) All members of group                               │
│ (○) Members with role: [____] (optional)               │
│                                                         │
│ Deadline offset: [90] days from assignment date         │
│ Reminders: [☐ 30d] [☐ 60d] [☐ 90d]                     │
│                                                         │
│ [ Save ] [ Cancel ]                                     │
└─────────────────────────────────────────────────────────┘
```

### 3.6 Settings Page

```
Header: "Settings"

Tabs: [ Authentication ] [ Feature Flags ] [ Integrations ] [ Audit ]

TAB: AUTHENTICATION
┌─────────────────────────────────────────────────────────┐
│ Entra Configuration                                     │
│                                                         │
│ Tenant ID:                                              │
│ [12345678-1234-1234-1234-123456789012] (read-only)    │
│                                                         │
│ SAML Metadata URL:                                      │
│ [https://login.microsoftonline.com/...] (read-only)   │
│                                                         │
│ [ Test Connection ] → "✓ Connected to Entra tenant"    │
│                                                         │
│ [ Save Changes ]                                        │
└─────────────────────────────────────────────────────────┘

TAB: FEATURE FLAGS
┌─────────────────────────────────────────────────────────┐
│ Override Feature Flags (tenant-specific)               │
│                                                         │
│ [☐] compliance.templates    (default: on)  → [On ▼]   │
│ [☐] compliance.template-assignment (default: on)       │
│ [☐] records.hours-ui        (default: on)              │
│ [☐] web.error-boundary-verbose (default: off)          │
│                                                         │
│ Note: If unchecked, uses global default value          │
│                                                         │
│ [ Save Changes ]                                        │
└─────────────────────────────────────────────────────────┘

TAB: INTEGRATIONS
┌─────────────────────────────────────────────────────────┐
│ Enabled Integrations                                    │
│                                                         │
│ ✓ Microsoft Entra ID - Connected (last checked: 1h ago)
│ ✗ SAML - Not configured                                │
│ ✓ API Keys - 2 keys active                             │
│                                                         │
│ [ Manage ] [ Test ] buttons per integration             │
└─────────────────────────────────────────────────────────┘
```

### 3.7 Environment Creation Wizard

```
Header: "Create New Environment"

STEP 1: BASIC INFO
┌─────────────────────────────────────────────────────────┐
│ Environment Name: [_________________]                   │
│ Environment Type: (●) Staging (○) Dev (○) Custom       │
│                                                         │
│ Clone from (optional):                                  │
│ (●) Production                                          │
│ (○) Staging                                             │
│ (○) None (empty environment)                            │
│                                                         │
│ [ ← Back ] [ Next → ]                                   │
└─────────────────────────────────────────────────────────┘

STEP 2: SELECT DATA TO CLONE
┌─────────────────────────────────────────────────────────┐
│ (●) Clone all data (users, templates, assignments)     │
│ (○) Clone templates only                                │
│ (○) Clone users only                                    │
│ (○) Custom selection:                                  │
│     [☐] Users                                           │
│     [☐] Templates                                       │
│     [☐] Assignments (requires templates)               │
│     [☐] Groups                                          │
│                                                         │
│ Note: User data will be anonymized                      │
│                                                         │
│ [ ← Back ] [ Next → ]                                   │
└─────────────────────────────────────────────────────────┘

STEP 3: REVIEW & CONFIRM
┌─────────────────────────────────────────────────────────┐
│ Environment: Staging                                    │
│ Clone from: Production                                  │
│ Data included: Users, Templates, Assignments, Groups   │
│                                                         │
│ This will create a new environment and copy data from  │
│ Production. The operation may take several minutes.    │
│                                                         │
│ [ ← Back ] [ Create ] [ Cancel ]                        │
└─────────────────────────────────────────────────────────┘
```

---

## 4. State Management Approach

### 4.1 Admin Context

```typescript
// src/contexts/AdminContext.ts
interface AdminContextValue {
  // Current environment
  currentEnvironment: Environment;
  environments: Environment[];
  switchEnvironment: (env: Environment) => void;
  createEnvironment: (config: EnvironmentConfig) => Promise<void>;

  // Current tenant
  tenantId: string;
  tenantName: string;
  tenantSettings: TenantSettings;

  // Permissions
  canViewAllEnvironments: boolean;
  canCreateEnvironments: boolean;
  canManageUsers: boolean;
  canManageGroups: boolean;
  canManageRules: boolean;

  // UI state
  isLoading: boolean;
  error?: string;
}

export const useAdmin = (): AdminContextValue => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin called outside AdminProvider');
  return ctx;
};
```

### 4.2 User Management State

```typescript
// src/hooks/useUserManagement.ts
interface UserManagementState {
  users: User[];
  selectedUsers: string[];
  filter: UserFilter;
  isLoading: boolean;

  // Actions
  toggleUserSelection: (userId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  disableUsers: (userIds: string[]) => Promise<void>;
  enableUsers: (userIds: string[]) => Promise<void>;
  resendInvites: (userIds: string[]) => Promise<void>;
  inviteFromDirectory: (emails: string[]) => Promise<void>;
  createLocalAccount: (data: LocalAccountData) => Promise<void>;
}
```

### 4.3 Rules Editor State

```typescript
// src/hooks/useRulesEditor.ts
interface RulesEditorState {
  rules: AutoAssignmentRule[];
  selectedRule?: AutoAssignmentRule;
  isEditing: boolean;
  isSaving: boolean;

  // Actions
  selectRule: (rule: AutoAssignmentRule) => void;
  startEdit: (rule: AutoAssignmentRule) => void;
  cancelEdit: () => void;
  saveRule: (rule: AutoAssignmentRule) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  toggleRuleStatus: (ruleId: string) => Promise<void>;
}
```

---

## 5. API Integration Points

### 5.1 Environment Management

```
GET    /api/v1/platform/environments                # List environments for tenant
POST   /api/v1/platform/environments                # Create environment
GET    /api/v1/platform/environments/:id            # Get environment detail
PATCH  /api/v1/platform/environments/:id            # Update environment
DELETE /api/v1/platform/environments/:id            # Delete environment
POST   /api/v1/platform/environments/:id/clone      # Clone environment

# Query params for context switching
GET    /api/v1/**?environment={env-id}             # All API calls scoped by env
```

### 5.2 User Management

```
GET    /api/v1/platform/users                       # List users in tenant
POST   /api/v1/platform/users                       # Create user (local account)
GET    /api/v1/platform/users/:id                   # Get user detail
PATCH  /api/v1/platform/users/:id                   # Update user (disable, etc.)
DELETE /api/v1/platform/users/:id                   # Remove user

# Invitations
POST   /api/v1/platform/invitations                 # Send invitation (batch)
GET    /api/v1/platform/invitations/:id             # Get invitation status
PATCH  /api/v1/platform/invitations/:id/resend      # Resend invitation

# Directory Search
GET    /api/v1/platform/directory/search?q={query} # Search Entra directory
```

### 5.3 Group Management

```
GET    /api/v1/platform/groups                      # List groups
POST   /api/v1/platform/groups                      # Create group
GET    /api/v1/platform/groups/:id                  # Get group detail
PATCH  /api/v1/platform/groups/:id                  # Update group
DELETE /api/v1/platform/groups/:id                  # Delete group

# Group members
GET    /api/v1/platform/groups/:id/members          # List members
POST   /api/v1/platform/groups/:id/members          # Add member
DELETE /api/v1/platform/groups/:id/members/:userId  # Remove member

# Entra group mapping
POST   /api/v1/platform/groups/:id/map-entra        # Map to Entra group
DELETE /api/v1/platform/groups/:id/map-entra        # Unmap from Entra group
```

### 5.4 Auto-Assignment Rules

```
GET    /api/v1/compliance/rules                     # List rules
POST   /api/v1/compliance/rules                     # Create rule
GET    /api/v1/compliance/rules/:id                 # Get rule detail
PATCH  /api/v1/compliance/rules/:id                 # Update rule
DELETE /api/v1/compliance/rules/:id                 # Delete rule
PATCH  /api/v1/compliance/rules/:id/status          # Toggle on/off
```

### 5.5 Tenant Settings

```
GET    /api/v1/platform/tenant/settings             # Get all settings
PATCH  /api/v1/platform/tenant/settings             # Update settings (auth, flags, etc.)
GET    /api/v1/platform/tenant/settings/audit       # Get settings change history

# Feature flag overrides
GET    /api/v1/platform/tenant/flags                # Get tenant flag overrides
PATCH  /api/v1/platform/tenant/flags/:flagKey       # Override single flag

# Audit log
GET    /api/v1/platform/audit-log                   # Get tenant audit log
```

### 5.6 Dashboard Metrics

```
GET    /api/v1/platform/dashboard/metrics           # Get compliance summary
GET    /api/v1/platform/dashboard/incidents         # Get critical incidents
GET    /api/v1/compliance/dashboard/cross-env       # Cross-environment comparison
```

---

## 6. Accessibility Considerations

### 6.1 Environment Switcher

- Dropdown button: `aria-haspopup="listbox"`, `aria-expanded="true/false"`
- Options: `role="option"`, `aria-selected="true"` for current env
- Keyboard: Arrow keys to navigate, Enter to select, Escape to close

### 6.2 User Management Table

- Table: Proper `<table>` with `<thead>` + `<tbody>`
- "Select All" checkbox: `aria-label="Select all users"`
- Bulk actions dropdown: `aria-haspopup="menu"`, keyboard accessible
- Delete actions: Confirmation dialog with descriptive text

### 6.3 Settings Tabs

- Tabs: `role="tablist"`, each tab `role="tab"` with `aria-selected`
- Tab panels: `role="tabpanel"`, hidden panels marked `hidden` attribute
- Form controls: Proper `<label>` association, `aria-required` for mandatory fields

### 6.4 Modals & Forms

- Modal: `role="dialog"`, `aria-modal="true"`, focus trap
- Close button: Escape key + visible close button
- Form submission: Error messages announced with `role="alert"`

---

## 7. Responsive Design Notes

### 7.1 Dashboard

- **Mobile:** Single-column card layout; metrics stack vertically
- **Tablet:** 2-column card grid; incidents list below
- **Desktop:** 3-column grid; sidebar fixed; main area fluid

### 7.2 Tables (Users, Groups, Rules)

- **Mobile:** Convert to card-based list view (no data table); horizontal scroll not ideal
- **Tablet:** Table with reduced padding, collapsible columns
- **Desktop:** Full table, all columns visible

### 7.3 Modals & Forms

- **Mobile:** Full-screen modal (header + content + footer)
- **Desktop:** Centered modal (max 600px width)

---

## 8. Phased Rollout

### **Phase 1 (Sprint 9): Admin Shell & Dashboard**
- Scaffold AdminApp layout (header, sidebar, main area)
- Build DashboardPage with metrics cards + critical incidents
- Implement EnvironmentSwitcher (read-only; no create yet)
- Feature flag: `web.admin-portal` gates admin app access
- **Status:** Admin can view dashboard, switch environments (if multiple exist)
- Tests: Dashboard loads, environment switcher works, metrics display

### **Phase 2 (Sprint 10): User Management & Invitations**
- Implement UserManagementPage with roster table
- Build invite panel (Entra directory search, bulk upload, local account)
- Implement user disable/enable, password reset, resend invite
- **Status:** Admin can manage user roster and send invitations
- Tests: Entra search works (mock), bulk invite submission succeeds, user actions work

### **Phase 3 (Sprint 11): Group Management & Rules**
- Build GroupManagementPage with CRUD
- Implement RulesEditorPage with auto-assignment rule creation
- Add rule execution trigger (on user join group)
- **Status:** Admin can define groups, configure auto-assignment
- Tests: Group CRUD works, rules save correctly, Entra mapping works

### **Phase 4 (v0.7.0+): Environment Cloning & Cross-Env Dashboard**
- Build EnvironmentCreationWizardPage with clone capability
- Implement cross-environment compliance dashboard (separate app or admin section)
- Add settings UI (auth, feature flags, integrations)
- **Status:** Full admin portal with environment lifecycle + reporting
- Tests: Clone operation succeeds, cross-env dashboard accurate, settings persist

---

## 9. Dependencies & Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| `react-router-dom` | ^7.0+ | Routing in admin SPA |
| `react-hook-form` | ^7.48+ | Form state for wizard |
| `@microsoft/graph-client` | ^3.0+ | Entra directory search (optional) |
| `zustand` (or Context) | ^4.4+ | Admin state management |
| `lucide-react` | ^0.294+ | Icons for dashboard, buttons |
| `recharts` | ^2.10+ | Dashboard metrics charts |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **EnvironmentSwitcher:** Dropdown open/close, selected env highlighted, API call on change
- **UserRosterTable:** Sorting, filtering, bulk select, disable/enable actions
- **RuleEditor:** Rule form validates, save calls API, toggle works
- **SettingsTabs:** Tab switching, form submission, flag override persists

### 10.2 Integration Tests

- **Invite Flow:** Search directory (mock) → select users → send → invitations created
- **Group Creation:** Create group → map to Entra group (mock) → members synced
- **Rule Execution:** Create rule (Group → Template) → user joins group → assignment created

### 10.3 E2E Tests (Staging)

- Admin login → switch to staging env → invite new user → verify invitation sent
- Create auto-assignment rule → add user to group → verify template assigned
- Clone prod environment → verify data copied correctly

---

## 11. Rollback Plan

If admin portal is causing issues:

1. Set `web.admin-portal` feature flag to `false`
2. Admin app route returns 403 or redirects to docs
3. Investigate error; fix and re-enable flag

If environment switching breaks tenant isolation:

1. Disable environment switcher (hide in UI)
2. Hard-code current environment to production
3. Investigate context leak; fix and re-enable

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Admin task time | <5 min per task (invite, group, rule) | Time from task start to confirmation |
| Entra sync accuracy | 100% of group mappings correct | Compare admin-defined groups to Entra groups |
| Auto-assignment reliability | 99% of rules execute correctly | Count successful assignments vs failed |
| Cross-env isolation | 0 data leaks between environments | Audit logs + compliance test coverage |
| Dashboard load time | <2s (P75) | Measure from page request to render complete |

---

## 13. Known Limitations & Future Work

1. **No webhook sync with Entra** — future: real-time group membership sync instead of polling
2. **No admin delegations** — future: allow admin to delegate specific permissions to managers
3. **No audit dashboard** — future: admin UX for searching + exporting audit logs
4. **No tenant branding** — future: allow custom logo, colors per tenant
5. **No advanced analytics** — future: cohort analysis, compliance trend forecasting
