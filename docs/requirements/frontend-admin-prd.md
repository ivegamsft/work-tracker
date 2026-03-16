# E-CLAT Frontend and Admin PRD

## Purpose
`apps/web` and `apps/admin` are currently scaffolds. This PRD defines the minimum viable products those apps must become in order to make the backend useful.

## Current state
### `apps/web`
- package exists
- README states employee self-service, manager dashboard, document upload, and notification center
- no framework, source, routing, design system, or API client exists

### `apps/admin`
- package exists
- README states user/role management, standards configuration, labels, notification rules, integrations, and audit logs
- no framework, source, routing, or API client exists

## Product split
### `apps/web`
Audience:
- employees
- supervisors/managers for day-to-day operations
- compliance officers for evidence and review workflows if a separate admin split is not desired for that function

### `apps/admin`
Audience:
- admins
- possibly compliance officers for governance/configuration functions

---

## 1. Web app requirements
### Core navigation
1. **My Profile**
   - personal information
   - current role and department
   - active/inactive status
2. **My Qualifications**
   - active/expiring/expired certifications
   - linked evidence documents
   - compliance gaps against assigned standards
3. **My Hours**
   - logged hours by source
   - manual entry form with attestation
   - conflict visibility and status
4. **My Documents**
   - upload flow
   - processing/review status
   - extraction corrections if permitted
5. **Notifications**
   - inbox
   - digest view
   - preference management

### Manager/supervisor surfaces
1. **Team Readiness Dashboard**
   - readiness rollup by employee
   - expiring qualifications/medical clearances
   - unresolved hour conflicts
   - pending document reviews
2. **Approvals and Reviews**
   - review queue for documents
   - conflict resolution workflow
3. **Employee Detail Workspace**
   - profile summary
   - qualifications
   - hours history
   - medical summary
   - audit trail access where allowed

### UX requirements
- strong status chips for expiring/expired/review-required states
- timeline or activity log view for evidence-heavy workflows
- attachment and preview support for documents
- clear attestation UI with confirmation text capture
- accessibility and keyboard support for compliance operations

### Technical requirements
- choose a framework that supports routing, forms, and server/client data fetching well (React/Next.js is the most natural fit)
- generate or maintain a typed API client from backend contracts
- centralize auth/session handling
- support role-aware navigation and guarded routes
- preserve server error codes/messages from the API

---

## 2. Admin app requirements
### Core navigation
1. **Users and Roles**
   - create/update/deactivate employees
   - assign roles and departments
   - invite/reset access
2. **Standards**
   - create/update standards
   - manage requirements
   - view version history
3. **Labels and Taxonomy**
   - create/update/deprecate labels
   - manage mappings
   - publish taxonomy versions
   - inspect migration impacts
4. **Notifications and Escalations**
   - manage escalation rules
   - test delivery channels
   - review templates/defaults
5. **Integrations**
   - OAuth providers
   - OCR/document processor selection
   - payroll/scheduling integration settings
6. **Audit and Operations**
   - searchable audit log explorer
   - job/queue health
   - delivery failures and system exceptions

### UX requirements
- admin tables with filtering, pagination, and export
- compare/diff views for standard and taxonomy changes
- explicit warnings for high-risk actions (role changes, deprecations, rule changes)
- immutable event history surfaces for regulated actions

### Technical requirements
- same auth/session model as web, but stricter route guards
- shared component and API layer with web where practical
- optimistic updates only where audit/race conditions are fully understood; otherwise prefer confirmed writes

---

## 3. Shared frontend requirements
### Design system primitives
- tables with pagination
- status badges
- filter panels
- form validation and inline error presentation
- modal confirmations for destructive or attested actions
- timeline/audit components

### API integration requirements
- typed request/response contracts
- standardized error handling
- query caching/invalidation
- upload support with progress state
- background refresh for review queues and notifications

### Security requirements
- secure token storage/session handling
- role-aware route guards
- no client-only trust for access control
- redact or restrict sensitive medical/compliance fields by role

---

## 4. Delivery plan
### MVP for `apps/web`
1. auth shell and route guards
2. employee dashboard
3. hours entry/history
4. document upload + status tracking
5. notifications center
6. manager readiness dashboard

### MVP for `apps/admin`
1. auth shell and admin route guards
2. employee/user management
3. standards management
4. labels/taxonomy management
5. escalation rule management
6. audit explorer

## 5. Acceptance criteria
- an employee can sign in and manage the core self-service workflows
- a manager can view team readiness and act on reviews/conflicts
- an admin can configure the system without direct database changes
- UI states align with the backend status vocabulary and audit expectations
