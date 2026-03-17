# Template Management UX Spec — E-CLAT

> **Author:** Kima (Frontend Dev)  
> **Date:** 2026-03-20  
> **Status:** Design Specification (Pre-Implementation)  
> **Issue:** #99 (W-30 to W-38 Template Screens)  
> **Related Decisions:** Decision 5 (L1-L4 Attestation Model), Decision 7 (Catalog + Inheritance)  
> **Applies To:** `apps/web/src/pages/Template*`, template management flows  
> **Companion Docs:** `docs/specs/templates-attestation-spec.md`, `docs/specs/proof-taxonomy.md`, `docs/specs/feature-flags-spec.md`

---

## Executive Summary

E-CLAT's **template management** is the centerpiece of compliance orchestration. This spec defines the full UX for templates as a **self-service, role-aware, multi-screen wizard-driven experience** that enables:

- **Template creation** from scratch or via **industry catalog browser** (search, filter, preview)
- **Attestation level configuration** (L1 self-attest → L4 validated) per proof requirement
- **Assignment workflows** (individual, group, bulk upload) with deadline + reminder scheduling
- **Version control** with diff view to compare template iterations
- **Lifecycle management** (draft → published → archived) with inline status indicators
- **Bulk operations** (reassign, extend deadlines, revoke, publish batch)

All screens follow the **My Section + Team Section** pattern established in Phase 2, with inline forms instead of modals, role-based visibility, and graceful degradation when features are flagged off.

---

## 1. User Stories

### 1.1 As a Compliance Officer

I want to **create a new template** for a specific industry + proof requirement (e.g., "Annual CPR Certification") so that I can assign it to all relevant employees.

**Acceptance Criteria:**
- Multi-step wizard: Basic Info → Requirements → Attestation Levels → Preview → Publish
- Step 1: Name, description, industry category, proof type (hours/cert/training/clearance/assessment)
- Step 2: Add requirements (1+); each requirement has: proof subtype, description, threshold (if applicable)
- Step 3: For each requirement, configure L1-L4 attestation levels:
  - L1 (self_attest): employee self-declares; no evidence needed
  - L2 (upload): employee uploads document; no manual verification
  - L3 (third_party): requires external issuer verification (e.g., registry lookup)
  - L4 (validated): requires compliance officer manual review + approval
- Step 4: Preview all requirements with attestation levels side-by-side
- Step 5: Publish template → becomes available for assignment
- Can save as draft and resume later
- Undo/back buttons in each step

### 1.2 As a Compliance Officer

I want to **browse the industry catalog** to see pre-built templates (e.g., "ISO 27001 Security Clearance") so that I don't reinvent the wheel.

**Acceptance Criteria:**
- Dedicated "Template Library" page with search + filter UI
- Filters: Industry (dropdown), Proof Type (multi-select), Attestation Level (multi-select), Last Updated (date range)
- Search: Full-text search on template name + description
- Results: Grid of template cards showing name, industry, proof type, # of requirements, last updated
- Card click → View template details (read-only)
- "Use as base" button → clone template, jump to editor in draft mode
- Pagination: 25 results per page, lazy-load on scroll

### 1.3 As a Compliance Officer

I want to **assign a template** to employees (individually, by group, or bulk upload) so that I can enforce compliance deadlines.

**Acceptance Criteria:**
- Assignment wizard: Select Template → Select Recipients → Configure Deadline → Set Reminders → Review → Submit
- Step 1: Choose template (search or list)
- Step 2: Choose recipients:
  - Option A: Individual search (find employee by name/ID)
  - Option B: Group select (department, role, team)
  - Option C: Bulk upload CSV (name, email, employee ID)
- Step 3: Set deadline (date picker), recurring (annual/bi-annual/custom), reminders (at 30/60/90 days before deadline)
- Step 4: Preview: template name, # of recipients, deadline, attestation levels for each requirement
- Step 5: Submit → creates TemplateAssignment + ProofFulfillment records per employee
- Confirmation: "✓ Assigned CPR Certification to 42 employees. Deadline: 2026-12-31. Reminders set for 30/60/90 days."
- Can save assignment template for recurring use

### 1.4 As a Compliance Officer

I want to **see a diff view** when updating a template so that I understand what changed before publishing a new version.

**Acceptance Criteria:**
- Template detail page: "Version History" tab shows list of versions with author, date, change summary
- Click version → open diff view (two-column: before/after)
- Diff highlights: added requirements, removed requirements, changed attestation levels, changed thresholds
- Can revert to previous version (creates new version with "Reverted to v3" comment)

### 1.5 As a Compliance Officer

I want to **perform bulk operations** on assignments (reassign, extend deadline, revoke) so that I can react quickly to compliance changes.

**Acceptance Criteria:**
- Template Assignment page: list of all active assignments with filters (status, template, deadline range)
- Bulk select: checkboxes on rows, "select all" in header
- Bulk actions dropdown: "Extend Deadline", "Revoke", "Send Reminder", "Change Attestation Level"
- Action modals: Extend Deadline (date picker), Revoke (confirm, reason field), Change Attestation Level (select new level for requirement, apply to all selected)
- Bulk operation success: "✓ Extended deadline for 15 assignments to 2027-06-30"

### 1.6 As an Employee

I want to **see which templates are assigned to me** with clear status (pending, in-progress, fulfilled, expired) so that I know what compliance deadlines are coming.

**Acceptance Criteria:**
- My Templates page (`/me/templates`): list of assigned templates with status badges
- Statuses:
  - **Pending**: Not started, deadline > 30 days away
  - **In Progress**: At least one requirement fulfilled but not all, or deadline < 30 days away
  - **Fulfilled**: All requirements met
  - **Expiring Soon**: < 7 days until deadline
  - **Expired**: Past deadline, not fulfilled
- Click template → view fulfillment detail (what's pending, what's done)
- "Complete" button → jump to the next pending requirement fulfillment form

---

## 2. Page & Component Hierarchy

### 2.1 Page Structure

```
TemplateLibraryPage (/compliance/templates)
├── Search + Filter Panel
├── Template Grid (cards with name, industry, proof type, # reqs)
└── Pagination

TemplateEditorPage (/compliance/templates/new or /compliance/templates/:id/edit)
├── Wizard Container
│   ├── Step 1: Basic Info (form)
│   ├── Step 2: Add Requirements (form + list)
│   ├── Step 3: Attestation Levels (table, per-requirement)
│   ├── Step 4: Preview (read-only summary)
│   └── Step 5: Publish (confirm + submit)
├── Draft Auto-Save Status
└── Navigation (Back, Next, Save Draft, Cancel)

TemplateDetailPage (/compliance/templates/:id)
├── Template Header (name, industry, status badge, actions menu)
├── Tabs:
│   ├── Overview (description, proof type, # requirements)
│   ├── Requirements (list of requirements + attestation levels)
│   ├── Version History (timeline of versions with diff view)
│   └── Assignments (list of active assignments with bulk actions)
├── Action Buttons (Clone, Edit, Archive, Publish New Version)
└── Metadata (created by, created at, last modified, version #)

TemplateAssignmentPage (/compliance/assignments)
├── Filter Panel (template, status, deadline range)
├── Assignment List (table: template name, recipients, deadline, status, actions)
├── Bulk Actions (select + dropdown menu)
└── Create New Assignment button → TemplateAssignmentWizardPage

TemplateAssignmentWizardPage (/compliance/assignments/new)
├── Wizard (same as 1.3: Select Template → Recipients → Deadline → Review → Submit)
└── Navigation

MyTemplatesPage (/me/templates)
├── Status Filter Tabs (All, Pending, In Progress, Fulfilled, Expiring, Expired)
├── Template List (cards or table: name, status badge, deadline, progress bar)
├── Card Click → Template Fulfillment Detail
└── "Complete" Quick Action button

TemplateFulfillmentPage (/me/templates/:assignmentId)
├── Header (template name, deadline, overall progress)
├── Requirements List (per-requirement fulfillment status)
├── Current Requirement Form (based on L1-L4 attestation level)
├── Previous/Next buttons (to navigate between requirements)
└── Save & Continue / Submit button
```

### 2.2 Reusable Components

```
TemplateBrowser
├── SearchInput
├── FilterPanel (industry, proof type, attestation level, date range)
└── TemplateGrid or TemplateTable

TemplateCard
├── Name, Industry Badge, Proof Type Badge
├── Requirement Count
├── Last Updated
└── Actions Menu (View, Clone, Assign)

TemplateWizard
├── StepIndicator (0/5, 1/5, etc.)
├── StepContent (dynamic based on currentStep)
├── Navigation (Back, Next, Save Draft, Cancel)
└── StepProgressBar

RequirementEditor
├── Proof Type Select
├── Subtype Text Input
├── Description Textarea
├── Threshold Input (if applicable; e.g., hours, score)
└── Delete button

AttestationLevelMatrix
├── Table: Requirements × Attestation Levels
├── Cells: Level selector (L1/L2/L3/L4) + description
├── Inline Edit
└── Validation (e.g., no L1-only clearance)

AssignmentBulkActions
├── Select Checkboxes + "Select All" header
├── Action Dropdown Menu (Extend Deadline, Revoke, Send Reminder, Change Level)
└── Modal for each action (confirm + input)

TemplateStatusBadge
├── Badge styles for: Pending, In Progress, Fulfilled, Expiring, Expired, Draft, Published, Archived
└── Optional icon + tooltip on hover

DiffView (Version History)
├── Left column: Before (read-only)
├── Right column: After (read-only)
├── Highlights: Added/removed requirements, changed attestation levels
└── Inline comments (who changed, when, why)
```

---

## 3. Wireframe Descriptions (Text-Based)

### 3.1 Template Library Page

```
Header: "Template Library" + Search Input (full width)
Search icon + "Browse 247 pre-built templates"

Row 1: Filters
  [ Industry: All ▼ ] [ Proof Type: ☐ Cert ☐ Training ☐ Clearance ... ]
  [ Attestation Level: ☐ L1 ☐ L2 ☐ L3 ☐ L4 ] [ Last Updated: ▼ ]
  [ Reset Filters ]

Grid: 3 columns (responsive: 1 mobile, 2 tablet, 3 desktop)
  ┌─────────────────────┐
  │ Card                │
  │ CPR Certification   │
  │ Industry: Healthcare
  │ Type: Certification │
  │ 1 Requirement       │
  │ Updated: 2 months ago
  │ [ View ] [ Use as Base ]
  └─────────────────────┘

Pagination: "Showing 1-25 of 247 templates"
  [ < ] [ 1 ] [ 2 ] [ 3 ] ... [ > ]
```

### 3.2 Template Editor Wizard

```
Header: "Create New Template" or "Edit Template: CPR Certification"

StepIndicator: [●] Step 1: Basic Info  [○] Step 2: Requirements  [○] Step 3: Attestation  [○] Step 4: Preview  [○] Step 5: Publish

STEP 1: BASIC INFO
┌──────────────────────────────────────────────────────┐
│ Template Name *                                      │
│ [___________________________]                        │
│                                                      │
│ Description                                         │
│ [_________________________________]                │
│ [_________________________________]                │
│                                                      │
│ Industry Category *                                 │
│ [Healthcare ▼]                                      │
│                                                      │
│ Proof Type *                                        │
│ (●) Certification  (○) Training  (○) Clearance     │
│ (○) Assessment     (○) Compliance Hours            │
│                                                      │
│ [ ← Back ] [ Next → ]  [ Save Draft ]  [ Cancel ]  │
└──────────────────────────────────────────────────────┘

STEP 2: ADD REQUIREMENTS
┌──────────────────────────────────────────────────────┐
│ Requirement 1: CPR Certification                    │
│ Subtype: [BLS ▼]                                    │
│ Description: [____________________]                 │
│ Threshold: [___] hours                              │
│ [ + Add Another ] [ Remove ]                        │
│                                                      │
│ [ ← Back ] [ Next → ]  [ Save Draft ]  [ Cancel ]  │
└──────────────────────────────────────────────────────┘

STEP 3: ATTESTATION LEVELS
┌──────────────────────────────────────────────────────┐
│ Requirement: CPR Certification                      │
│                                                      │
│ ┌─────────┬──────────────────────────────────────┐ │
│ │ Level   │ Description                          │ │
│ ├─────────┼──────────────────────────────────────┤ │
│ │ L1: Self │[●] Employee declares; no evidence   │ │
│ ├─────────┼──────────────────────────────────────┤ │
│ │ L2: Uplod│[○] Employee uploads document        │ │
│ ├─────────┼──────────────────────────────────────┤ │
│ │ L3: Verf │[○] External issuer verification    │ │
│ ├─────────┼──────────────────────────────────────┤ │
│ │ L4: Valid│[○] Compliance officer review + OK  │ │
│ └─────────┴──────────────────────────────────────┘ │
│                                                      │
│ [ ← Back ] [ Next → ]  [ Save Draft ]  [ Cancel ]  │
└──────────────────────────────────────────────────────┘

STEP 4: PREVIEW
┌──────────────────────────────────────────────────────┐
│ Template: CPR Certification (Draft)                 │
│ Industry: Healthcare                                │
│ Proof Type: Certification                           │
│                                                      │
│ Requirement 1: CPR Certification                    │
│   Subtype: BLS                                      │
│   Attestation: L1 (Self-declare)                    │
│                                                      │
│ Ready to publish? Review above and confirm.         │
│                                                      │
│ [ ← Back ] [ Publish ] [ Save Draft ]  [ Cancel ]  │
└──────────────────────────────────────────────────────┘

STEP 5: PUBLISH (or CONFIRMATION)
✓ Template published successfully!
Template: CPR Certification (Published v1)
[ View Template ] [ Assign Now ] [ Create Another ]
```

### 3.3 My Templates Page

```
Header: "My Compliance Templates"

Tabs: [ All ] [ Pending ] [ In Progress ] [ Fulfilled ] [ Expiring ] [ Expired ]

Card Layout (or table, responsive):
┌─────────────────────────────────────┐
│ CPR Certification                   │
│ Status: In Progress                 │
│ Deadline: 2026-09-15 (45 days left) │
│                                     │
│ Progress: ████░░░░░░ 50% (1 of 2)   │
│                                     │
│ Next: Renewal form upload           │
│ [ Complete This ] [ View Details ]  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Annual Training Module              │
│ Status: Expiring Soon (5 days left) │
│ Deadline: 2026-03-25                │
│                                     │
│ Progress: ███░░░░░░░ 30%            │
│ [ Complete This ] [ View Details ]  │
└─────────────────────────────────────┘
```

### 3.4 Template Assignment Wizard

```
STEP 1: SELECT TEMPLATE
Search: [__________________]
Template options:
  [ ] CPR Certification
  [ ] Annual Training
  [X] ISO 27001 Security Clearance
Select → Next

STEP 2: SELECT RECIPIENTS
Choose method:
  (●) Individual (search by name/email)
  (○) Group (department/role/team)
  (○) Bulk Upload (CSV)

Individual:
  Search: [__________________]
  Results: [ ] Alice Johnson, [ ] Bob Smith, ...
  Selected: 3 employees

[ ← Back ] [ Next → ]

STEP 3: DEADLINE & REMINDERS
Deadline: [2026-12-31] (date picker)
Recurring: (○) One-time  (●) Annual  (○) Bi-annual

Reminders:
  [ ] 30 days before
  [ ] 60 days before
  [ ] 90 days before

[ ← Back ] [ Next → ]

STEP 4: REVIEW & SUBMIT
Template: ISO 27001 Security Clearance
Recipients: 3 employees (Alice, Bob, Carol)
Deadline: 2026-12-31
Reminders: 30, 60, 90 days before
Attestation Levels: L1-L3 (preview)

[ ← Back ] [ Submit ] [ Cancel ]
```

### 3.5 Assignment List with Bulk Actions

```
Header: "Active Assignments"

Filters: [ Template: All ▼ ] [ Status: All ▼ ] [ Deadline: All ▼ ]

Table:
┌─────────────────────────────────────────────────────────┐
│ [☐] Template            │ Recipients │ Deadline  │ Status │
├─────────────────────────────────────────────────────────┤
│ [X] CPR Certification   │ 42         │ 2026-12-31│ Active │
│ [  ] Annual Training    │ 156        │ 2026-11-30│ Active │
│ [  ] ISO 27001 Sec.     │ 7          │ 2026-09-15│ Expiring
└─────────────────────────────────────────────────────────┘

Selected: 1 | [Select All] [Bulk Actions ▼]
  Bulk Actions:
    [ Extend Deadline ]
    [ Send Reminder ]
    [ Change Attestation Level ]
    [ Revoke ]

[ + New Assignment ]
```

---

## 4. State Management Approach

### 4.1 Wizard State

```typescript
// src/contexts/TemplateWizardContext.ts
interface WizardState {
  // Shared wizard state
  currentStep: 1 | 2 | 3 | 4 | 5;
  isSubmitting: boolean;
  isDraftSaved: boolean;
  draftSaveError?: string;

  // Step 1: Basic Info
  basicInfo: {
    name: string;
    description: string;
    industryCategory: string;
    proofType: ProofType;
  };

  // Step 2: Requirements
  requirements: Requirement[];

  // Step 3: Attestation Levels
  attestationLevels: Map<string, AttestationLevelConfig>; // requirement ID -> config

  // Step 4: Preview (computed, read-only)

  // Navigation
  goToStep: (step: number) => void;
  saveAsDraft: () => Promise<void>;
  publish: () => Promise<void>;
  resetWizard: () => void;
}

// Usage in component
const { basicInfo, requirements, goToStep, saveAsDraft } = useTemplateWizard();
```

### 4.2 Template List Filtering

```typescript
// src/hooks/useTemplateFilters.ts
interface FilterState {
  search: string;
  industry?: string;
  proofTypes: ProofType[];
  attestationLevels: AttestationLevel[];
  dateRange?: { start: Date; end: Date };
  sort: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
  page: number;
  limit: number;
}

const { filters, setFilter, clearFilters, results, totalCount, loading } = useTemplateFilters();
```

### 4.3 Assignment Bulk Actions

```typescript
// src/contexts/BulkActionContext.ts
interface BulkActionState {
  selected: string[]; // assignment IDs
  action?: 'extend_deadline' | 'send_reminder' | 'change_level' | 'revoke';
  actionData?: any; // action-specific data (new deadline, new level, etc.)
  isSubmitting: boolean;
  result?: BulkActionResult;

  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  submitAction: () => Promise<void>;
}
```

---

## 5. API Integration Points

### 5.1 Template CRUD

```
GET    /api/v1/compliance/templates               # List all templates (with filters)
POST   /api/v1/compliance/templates               # Create new template
GET    /api/v1/compliance/templates/:id           # Get template detail
PATCH  /api/v1/compliance/templates/:id           # Update template (draft only)
DELETE /api/v1/compliance/templates/:id           # Archive template
POST   /api/v1/compliance/templates/:id/publish   # Publish draft → published
POST   /api/v1/compliance/templates/:id/clone     # Clone existing template
GET    /api/v1/compliance/templates/:id/versions  # Get version history
GET    /api/v1/compliance/templates/:id/versions/:versionId # Get specific version
POST   /api/v1/compliance/templates/:id/versions/:versionId/revert # Revert to version
```

**Query Params for List:**
- `search`, `industry`, `proofTypes[]`, `attestationLevels[]`, `dateRange`, `sort`, `page`, `limit`

### 5.2 Template Assignment

```
GET    /api/v1/compliance/assignments               # List assignments
POST   /api/v1/compliance/assignments               # Create assignment (bulk or individual)
GET    /api/v1/compliance/assignments/:id           # Get assignment detail
PATCH  /api/v1/compliance/assignments/:id           # Update assignment
DELETE /api/v1/compliance/assignments/:id           # Revoke assignment

# Bulk operations
POST   /api/v1/compliance/assignments/bulk/extend-deadline
POST   /api/v1/compliance/assignments/bulk/send-reminder
POST   /api/v1/compliance/assignments/bulk/change-level
POST   /api/v1/compliance/assignments/bulk/revoke

# Search recipients for assignment
GET    /api/v1/workforce/employees/search?q={query}
GET    /api/v1/workforce/groups                      # Get all groups (for group selection)
```

### 5.3 Template Fulfillment (Employee Side)

```
GET    /api/v1/compliance/fulfillments?assignmentId={id}       # Get assigned templates for user
GET    /api/v1/compliance/fulfillments/:fulfillmentId          # Get fulfillment detail
PATCH  /api/v1/compliance/fulfillments/:fulfillmentId          # Update fulfillment (L1 submit, L2 upload, etc.)
GET    /api/v1/compliance/fulfillments/:fulfillmentId/requirements # Get requirements with status
```

### 5.4 Industry Catalog

```
GET    /api/v1/compliance/catalog                  # List industry catalog templates
GET    /api/v1/compliance/catalog/:id              # Get catalog template detail
GET    /api/v1/compliance/catalog/search?q={query} # Search catalog
```

---

## 6. Accessibility Considerations

### 6.1 Wizard Navigation

- Heading: `<h1>Create New Template</h1>` clearly states mode
- Step indicator: `<ol aria-label="Steps">` with current step marked `aria-current="step"`
- Form inputs: Proper `<label>` association, `aria-required="true"` for mandatory fields
- Error messages: Announced with `role="alert"`, linked to input with `aria-describedby`
- Navigation buttons: "Next" button disabled if current step invalid; `aria-disabled="true"` + visible disabled state

### 6.2 Table Sorting & Selection

- "Select All" checkbox: `aria-label="Select all assignments"`
- Bulk action dropdown: Keyboard accessible, `aria-haspopup="menu"`, arrow keys to navigate
- Sort headers: Clickable with `aria-sort="ascending/descending/none"`, keyboard focused

### 6.3 Template Cards

- Card heading: Semantic `<h3>`
- Status badge: Color + text (not color alone)
- Action buttons: Descriptive `aria-label` (e.g., "View CPR Certification assignment details")
- "Complete" button: Visible and keyboard accessible

### 6.4 Diff View

- Split layout: Both columns announced via `role="article"` or `<main>`
- Changes highlighted: Underline + background color (not color alone)
- Changelog: List of changes announced as `<ul>`, each change with `<li>`

---

## 7. Responsive Design Notes

### 7.1 Wizard

- **Mobile:** Single-column form, buttons stack vertically, step indicator horizontal scroller
- **Tablet:** Single-column form, wider inputs, buttons in row at bottom
- **Desktop:** Optional sidebar step indicator (fixed or sticky), main form area wider

### 7.2 Template Grid / Library

- **Mobile:** 1 column (full width with margin)
- **Tablet:** 2 columns
- **Desktop:** 3 columns, max 400px per card
- Cards scale with font size; touch targets ≥48px

### 7.3 Assignment Table

- **Mobile:** Horizontal scroll or card-based view (not data table)
- **Tablet:** Table with reduced padding
- **Desktop:** Full table with standard spacing

### 7.4 Bulk Actions Menu

- **Mobile:** Full-width dropdown or modal with stacked buttons
- **Desktop:** Inline dropdown menu

---

## 8. Phased Rollout

### **Phase 1 (Sprint 7): Template Library & Editor (MVP)**
- Implement TemplateLibraryPage with search + filters
- Build TemplateEditorPage wizard (Steps 1-4, no publish yet)
- Implement TemplateBrowser component (reusable)
- Feature flag: `compliance.templates` gates template pages in nav
- **Status:** Can create draft templates, view catalog
- Tests: Wizard steps validate, search/filter works, draft save works

### **Phase 2 (Sprint 8): Template Publishing & Assignment**
- Complete Step 5 (Publish)
- Implement TemplateDetailPage with Version History tab
- Build TemplateAssignmentWizardPage
- Implement TemplateAssignmentPage with list view
- Feature flag: `compliance.template-assignment` gates assignment workflows
- **Status:** Can publish templates and assign to employees
- Tests: Publish validation, assignment creation, bulk retrieval works

### **Phase 3 (Sprint 9): Fulfillment UX & Bulk Operations**
- Build MyTemplatesPage (employee side)
- Implement TemplateFulfillmentPage (fulfillment per requirement)
- Build bulk actions (extend deadline, revoke, change level)
- Implement diff view for version history
- **Status:** Employees see assigned templates; compliance officers can bulk-manage assignments
- Tests: Fulfillment form renders per attestation level, bulk actions work, diff view accurate

### **Phase 4 (v0.6.0+): Catalog Search & Advanced Features**
- Integrate with Industry Catalog backend API
- Add "Use as Base" cloning with template inheritance
- Implement recurring assignment templates (save + reuse)
- Add advanced search (by standard requirement, by role, by department)
- **Status:** Self-service template management fully operational
- Tests: Catalog search, clone, inheritance all working

---

## 9. Dependencies & Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| `react-hook-form` | ^7.48+ | Form state in wizard |
| `zod` (shared) | ^3.22+ | Validation for template shape |
| `react-router-dom` | ^7.0+ | Route to wizard/detail pages |
| `@radix-ui/dialog` | ^1.1+ | Modal for bulk actions |
| `@radix-ui/select` | ^2.0+ | Industry/proof type selects |
| `date-fns` | ^2.30+ | Deadline date handling |
| `lucide-react` | ^0.294+ | Icons for status badges |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **TemplateWizard:** Each step validates independently; state persists between steps; save draft calls API
- **TemplateFilter:** Filter state updates, results filtered correctly, pagination works
- **BulkActions:** Selection toggle works, action submission calls correct API, result displayed

### 10.2 Integration Tests

- **Wizard Flow:** Create template → draft → publish → appears in library
- **Assignment Flow:** Select template → select recipients (individual/group/bulk) → set deadline → submit → assignments created
- **Fulfillment Flow:** Employee sees assigned template → completes L1/L2 requirement → status updates → completes L3/L4 requirement → template marked fulfilled

### 10.3 E2E Tests (Staging)

- Compliance officer flow: Create template (5 steps) → Publish → Assign to group → Bulk extend deadline
- Employee flow: See assigned template on dashboard → Open template → Complete L1 self-attest → Upload L2 document → Fulfill requirement → See progress
- Version control: Edit published template → publish v2 → diff view shows changes → revert to v1

---

## 11. Rollback Plan

If template assignment is causing errors:

1. Set `compliance.template-assignment` flag to `false`
2. Assignment workflows disappear from UI; existing assignments remain active
3. Fix backend API; re-enable flag when ready

If wizard is causing page crashes:

1. Set `compliance.templates` flag to `false`
2. All template pages show "Coming Soon" UX via TemplatesFeatureUnavailablePage
3. Investigate error logs; fix and re-enable

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Template creation time | <5 min (wizard) | Time from page open to publish button click |
| Catalog adoption rate | >70% of new assignments use catalog template | Count assignments sourced from catalog vs custom-built |
| Bulk operation efficiency | 100+ assignments in <30s | Time to select + extend deadline for bulk set |
| Employee fulfillment rate | >85% within 30 days of deadline | Percentage of assignments with all requirements fulfilled before deadline |
| Wizard completion rate | >90% (abandon rate <10%) | Count of draft templates vs published |

---

## 13. Known Limitations & Future Work

1. **No template inheritance** — future: child templates inherit from parent, cascade updates to assignments
2. **No conditional requirements** — future: show/hide requirements based on employee role or department
3. **No template versioning for assignments** — future: track which version employee was assigned
4. **No rollback after publish** — future: allow reverting published template to prior version
5. **No A/B testing** — future: run two versions of template, measure compliance rate per variant
