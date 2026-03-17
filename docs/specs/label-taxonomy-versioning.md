# Label Taxonomy Versioning and Governance — Domain Design Spec

**Issue:** #44  
**Author:** Bunk (Backend)  
**Status:** Draft  
**Created:** 2026-03-20

---

## 1. Problem Statement

E-CLAT uses labels for cross-cutting categorization of hour records, documents, and qualifications. The current implementation has:

- A flat `Label` model with `ACTIVE`/`DEPRECATED` status — no lifecycle management
- A `LabelMapping` model that maps labels to hour categories with a version integer — but no formal version entity governance
- A `TaxonomyVersion` model that records version numbers and changelogs — but no status lifecycle, approval workflow, or migration tooling
- No mechanism to compare versions, preview impacts of taxonomy changes, or roll back
- No governance model defining who can draft, publish, or deprecate taxonomy versions
- Label service methods are all `notImplemented` stubs

When a regulated industry changes its compliance categories, existing labeled records must be re-mapped without data loss. The current schema cannot support this safely.

## 2. Design Goals

1. **Version lifecycle** — Taxonomy versions progress through a governed state machine: `DRAFT → PUBLISHED → DEPRECATED → ARCHIVED`.
2. **Migration safety** — When a new version publishes, existing labeled items are re-mapped via explicit migration rules — never silently invalidated.
3. **Governance RBAC** — Clear role requirements for each lifecycle transition.
4. **Diff tooling** — API endpoints to compare any two versions and preview migration impact.
5. **Audit completeness** — Every version transition, label change, and migration produces an audit trail.
6. **Backward compatibility** — Existing label references remain valid; resolution uses the active published version by default.

## 3. Taxonomy Version Lifecycle

### 3.1 State Machine

```
                    ┌─────────┐
          create    │  DRAFT  │
          ────────► │         │◄──────────┐
                    └────┬────┘           │
                         │            revert to
                      publish          draft
                         │                │
                    ┌────▼────┐           │
                    │PUBLISHED│───────────┘
                    │         │     (only if no consumers)
                    └────┬────┘
                         │
                     deprecate
                    (new version
                     published)
                         │
                    ┌────▼──────┐
                    │DEPRECATED │
                    │           │
                    └────┬──────┘
                         │
                      archive
                    (after retention
                      period)
                         │
                    ┌────▼────┐
                    │ARCHIVED │
                    └─────────┘
```

### 3.2 Transition Rules

| Transition | Precondition | Minimum Role | Side Effects |
|---|---|---|---|
| → DRAFT | None | COMPLIANCE_OFFICER | Creates version entity |
| DRAFT → PUBLISHED | All migration rules validated; no label conflicts | ADMIN | Runs migration; deprecates prior published version; notifies subscribers |
| PUBLISHED → DRAFT | No records reference this version's labels | ADMIN | Reverts to editable state |
| PUBLISHED → DEPRECATED | A newer version is PUBLISHED | System (automatic) | Sets `deprecatedAt`; starts migration grace period |
| DEPRECATED → ARCHIVED | Grace period elapsed (configurable, default 90 days) | ADMIN | Marks read-only; retains for audit |
| Any → deleted | Never | — | **Taxonomy versions are never deleted** (compliance) |

### 3.3 Invariants

- **Exactly one PUBLISHED version** at any time (the "active" version).
- **DRAFT versions** may exist concurrently (for preparing the next release).
- **DEPRECATED versions** remain readable and resolvable for backward compatibility during the grace period.
- **ARCHIVED versions** are read-only historical records.

## 4. Prisma Schema Changes

### 4.1 Enhanced TaxonomyVersion

```prisma
model TaxonomyVersion {
  id               String              @id @default(uuid())
  versionNumber    Int                 @unique
  status           TaxonomyStatus      @default(DRAFT)
  displayName      String              // Human-readable version name (e.g., "2026-Q2 Compliance Update")
  changeLog        String              // Markdown description of changes
  migrationRules   Json                @default("{}") // Structured migration rule set
  migrationStatus  MigrationStatus?    // Status of migration execution
  migrationLog     Json?               // Detailed migration execution results
  
  // Lifecycle timestamps
  createdBy        String              // User who created the draft
  publishedBy      String?             // User who published
  publishedAt      DateTime?
  deprecatedAt     DateTime?
  deprecatedBy     String?
  archivedAt       DateTime?
  archivedBy       String?
  gracePeriodDays  Int                 @default(90)
  
  // Lineage
  previousVersionId String?
  previousVersion   TaxonomyVersion?   @relation("VersionLineage", fields: [previousVersionId], references: [id])
  nextVersion       TaxonomyVersion?   @relation("VersionLineage")
  
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  labels           VersionLabel[]
  
  @@index([status])
  @@map("taxonomy_versions")
}

enum TaxonomyStatus {
  DRAFT
  PUBLISHED
  DEPRECATED
  ARCHIVED
}

enum MigrationStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  ROLLED_BACK
}
```

### 4.2 Version-Scoped Labels

Labels are associated with specific taxonomy versions via a join model:

```prisma
model VersionLabel {
  id               String           @id @default(uuid())
  versionId        String
  version          TaxonomyVersion  @relation(fields: [versionId], references: [id])
  labelId          String
  label            Label            @relation(fields: [labelId], references: [id])
  
  action           LabelAction      @default(UNCHANGED)
  previousLabelId  String?          // For RENAMED/MERGED: the label this replaced
  previousLabel    Label?           @relation("LabelLineage", fields: [previousLabelId], references: [id])
  
  @@unique([versionId, labelId])
  @@index([versionId])
  @@index([labelId])
  @@map("version_labels")
}

enum LabelAction {
  ADDED       // New label introduced in this version
  UNCHANGED   // Carried forward from previous version
  MODIFIED    // Metadata changed (name, description)
  RENAMED     // Code changed; previousLabelId tracks old label
  MERGED      // Multiple labels merged into this one
  DEPRECATED  // Marked for removal in next version
  REMOVED     // No longer in this version
}
```

### 4.3 Enhanced Label Model

```prisma
model Label {
  id             String      @id @default(uuid())
  code           String      @unique
  name           String
  description    String      @default("")
  status         LabelStatus @default(ACTIVE)
  effectiveDate  DateTime
  retirementDate DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  // ── New fields ──
  category       String?     // Grouping: "compliance", "training", "medical", etc.
  parentId       String?     // Hierarchical taxonomy support
  parent         Label?      @relation("LabelHierarchy", fields: [parentId], references: [id])
  children       Label[]     @relation("LabelHierarchy")
  sortOrder      Int         @default(0)
  metadata       Json?       // Extensible key-value pairs
  createdBy      String?     // Track who created the label

  mappings       LabelMapping[]
  hourRecords    HourRecord[]
  versionLabels  VersionLabel[]
  lineageTargets VersionLabel[]  @relation("LabelLineage")

  @@index([category])
  @@index([parentId])
  @@map("labels")
}

enum LabelStatus {
  ACTIVE
  DEPRECATED
  ARCHIVED      // New: fully retired, read-only
}
```

### 4.4 Migration Rule Model

```prisma
model MigrationRule {
  id               String           @id @default(uuid())
  versionId        String
  version          TaxonomyVersion  @relation(fields: [versionId], references: [id])
  
  ruleType         MigrationRuleType
  sourceLabelId    String           // Label being migrated FROM
  sourceLabel      Label            @relation("MigrationSource", fields: [sourceLabelId], references: [id])
  targetLabelId    String           // Label being migrated TO
  targetLabel      Label            @relation("MigrationTarget", fields: [targetLabelId], references: [id])
  
  condition        Json?            // Optional filter (e.g., only records after date X)
  priority         Int              @default(0) // Execution order
  isActive         Boolean          @default(true)
  
  createdBy        String
  createdAt        DateTime         @default(now())
  
  @@index([versionId])
  @@index([sourceLabelId])
  @@map("migration_rules")
}

enum MigrationRuleType {
  RENAME    // 1:1 label replacement
  MERGE     // N:1 — multiple source labels → one target
  SPLIT     // 1:N — one source label → multiple targets (with condition)
  ARCHIVE   // Remove label reference (set to null)
}
```

### 4.5 Migration Execution Log

```prisma
model MigrationExecution {
  id              String           @id @default(uuid())
  versionId       String
  version         TaxonomyVersion  @relation(fields: [versionId], references: [id])
  
  status          MigrationStatus
  startedAt       DateTime         @default(now())
  completedAt     DateTime?
  executedBy      String
  
  totalRecords    Int              @default(0)
  migratedRecords Int              @default(0)
  failedRecords   Int              @default(0)
  skippedRecords  Int              @default(0)
  
  executionLog    Json?            // Per-rule results
  rollbackData    Json?            // Snapshot for undo
  
  @@index([versionId, status])
  @@map("migration_executions")
}
```

## 5. Migration Strategy

### 5.1 How Migrations Work

When a new taxonomy version is published, the system must re-map all existing labeled items:

```
1. VALIDATION PHASE (pre-publish)
   - Parse all MigrationRules for the version
   - Verify source labels exist and are in the current published version
   - Verify target labels exist and are in the new version
   - Run dry-run migration to count affected records
   - Report impact summary to the publishing user

2. EXECUTION PHASE (on publish)
   - Create MigrationExecution record (status: IN_PROGRESS)
   - For each MigrationRule (ordered by priority):
     a. Find all records referencing sourceLabelId
     b. Apply condition filter if present
     c. Update labelId to targetLabelId
     d. Log each update to AuditLog
     e. Increment migratedRecords counter
   - On completion: set status = COMPLETED

3. ROLLBACK (on failure)
   - Use rollbackData snapshot to reverse changes
   - Set MigrationExecution status = ROLLED_BACK
   - Revert TaxonomyVersion status to DRAFT
   - Notify ADMIN of failure with error details
```

### 5.2 Affected Entity Types

Migration rules apply to all entities with a `labelId` foreign key:

| Entity | Label Field | Migration Behavior |
|---|---|---|
| `HourRecord` | `labelId` | Update to target label |
| `LabelMapping` | `labelId` | Update mapping + create new version |
| `Document` | (future) | Planned label support |
| `Qualification` | (future) | Planned label support |

### 5.3 Safety Constraints

- **Atomic execution**: The entire migration runs in a single database transaction. All records migrate or none do.
- **Rollback window**: Migration rollback is available for 24 hours after completion.
- **No orphans**: After migration, no active records should reference labels not in the published version (enforced by validation query).
- **Audit trail**: Each individual record migration creates an `AuditLog` entry with `LABEL_MIGRATED` action.

## 6. Governance RBAC Model

### 6.1 Permission Matrix

| Action | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|---|---|---|---|---|---|
| View published taxonomy | ✅ | ✅ | ✅ | ✅ | ✅ |
| View draft versions | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create draft version | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit draft version (add/modify/remove labels) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Define migration rules | ❌ | ❌ | ❌ | ✅ | ✅ |
| Preview migration impact | ❌ | ❌ | ✅ | ✅ | ✅ |
| Publish version | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deprecate version | ❌ | ❌ | ❌ | ❌ | ✅ (system auto) |
| Archive version | ❌ | ❌ | ❌ | ❌ | ✅ |
| Rollback migration | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit trail | ❌ | ✅ | ✅ | ✅ | ✅ |

### 6.2 Separation of Duties

- The user who **creates** a draft cannot **publish** it (4-eyes principle for compliance).
- The user who **defines migration rules** should not be the sole **publisher** (recommended but not enforced in v1).

## 7. API Endpoint Design

### 7.1 Taxonomy Version CRUD

#### `GET /api/labels/versions`
List taxonomy versions with filtering.

```typescript
// Query params
{
  status?: TaxonomyStatus | TaxonomyStatus[],
  page?: number,    // Default: 1
  limit?: number    // Default: 50
}

// Response: PaginatedResult<TaxonomyVersion>
// Includes label count per version
```

**RBAC:** Authenticated (EMPLOYEE+ sees PUBLISHED only; MANAGER+ sees all)

#### `GET /api/labels/versions/:id`
Get version details with full label list.

```typescript
// Response
{
  id: string,
  versionNumber: number,
  status: TaxonomyStatus,
  displayName: string,
  changeLog: string,
  labels: VersionLabel[],       // All labels in this version with action
  migrationRules: MigrationRule[], // Only for DRAFT versions
  publishedAt: Date | null,
  createdBy: string,
  // ... other metadata
}
```

**RBAC:** Authenticated (restricted by version status per §6.1)

#### `POST /api/labels/versions`
Create a new draft version.

```typescript
// Request
{
  displayName: string,
  changeLog: string,
  basedOnVersionId?: string    // Clone labels from existing version; defaults to current PUBLISHED
}

// Response: TaxonomyVersion (status: DRAFT)
```

**RBAC:** COMPLIANCE_OFFICER+

#### `PUT /api/labels/versions/:id`
Update draft version metadata.

```typescript
// Request
{
  displayName?: string,
  changeLog?: string,
  gracePeriodDays?: number
}
```

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

### 7.2 Version Label Management

#### `POST /api/labels/versions/:versionId/labels`
Add a label to a draft version.

```typescript
// Request
{
  code: string,        // Uppercase alphanumeric with underscores
  name: string,
  description?: string,
  category?: string,
  parentId?: string,   // For hierarchy
  action: "ADDED"      // Must be ADDED for new labels
}

// Response: VersionLabel with nested Label
```

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

#### `PUT /api/labels/versions/:versionId/labels/:labelId`
Modify a label in a draft version.

```typescript
// Request
{
  name?: string,
  description?: string,
  category?: string,
  action?: "MODIFIED" | "DEPRECATED" | "REMOVED"
}
```

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

#### `DELETE /api/labels/versions/:versionId/labels/:labelId`
Remove a label from a draft version (marks as REMOVED action).

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

### 7.3 Migration Rules

#### `GET /api/labels/versions/:versionId/migration-rules`
List migration rules for a version.

**RBAC:** MANAGER+

#### `POST /api/labels/versions/:versionId/migration-rules`
Create a migration rule.

```typescript
// Request
{
  ruleType: "RENAME" | "MERGE" | "SPLIT" | "ARCHIVE",
  sourceLabelId: string,
  targetLabelId: string,
  condition?: object,
  priority?: number
}
```

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

#### `PUT /api/labels/versions/:versionId/migration-rules/:ruleId`
Update a migration rule.

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

#### `DELETE /api/labels/versions/:versionId/migration-rules/:ruleId`
Delete a migration rule.

**RBAC:** COMPLIANCE_OFFICER+ (DRAFT only)

### 7.4 Version Lifecycle Actions

#### `POST /api/labels/versions/:id/publish`
Publish a draft version (triggers migration).

```typescript
// Request
{
  attestation: string,      // "I confirm this taxonomy change has been reviewed..."
  skipDryRun?: boolean      // Default: false — always dry-run first
}

// Response
{
  version: TaxonomyVersion,
  migration: {
    executionId: string,
    status: MigrationStatus,
    summary: {
      totalRecords: number,
      migratedRecords: number,
      failedRecords: number
    }
  }
}
```

**RBAC:** ADMIN only. **Constraint:** Publisher ≠ Creator (4-eyes).

#### `POST /api/labels/versions/:id/deprecate`
Deprecate a published version (usually automatic when new version publishes).

**RBAC:** ADMIN

#### `POST /api/labels/versions/:id/archive`
Archive a deprecated version after grace period.

**RBAC:** ADMIN

#### `POST /api/labels/versions/:id/rollback`
Roll back a published version's migration.

```typescript
// Request
{
  reason: string,
  attestation: string
}

// Response
{
  rolledBack: boolean,
  recordsReverted: number,
  previousVersionRestored: string  // Version ID that becomes PUBLISHED again
}
```

**RBAC:** ADMIN. **Constraint:** Only within 24-hour rollback window.

### 7.5 Version Comparison and Diff

#### `GET /api/labels/versions/diff`
Compare two taxonomy versions.

```typescript
// Query params
{
  baseVersionId: string,    // The "old" version
  compareVersionId: string  // The "new" version
}

// Response
{
  base: { id: string, versionNumber: number },
  compare: { id: string, versionNumber: number },
  diff: {
    added: Label[],
    removed: Label[],
    modified: { label: Label, changes: FieldDiff[] }[],
    renamed: { from: Label, to: Label }[],
    merged: { sources: Label[], target: Label }[]
  },
  migrationImpact: {
    totalAffectedRecords: number,
    byEntity: { entityType: string, count: number }[],
    byRule: { ruleId: string, ruleType: string, affectedCount: number }[]
  }
}
```

**RBAC:** MANAGER+

#### `POST /api/labels/versions/:id/preview-migration`
Dry-run migration to see impact without executing.

```typescript
// Response
{
  wouldMigrate: number,
  wouldFail: number,
  wouldSkip: number,
  byRule: {
    ruleId: string,
    sourceLabelCode: string,
    targetLabelCode: string,
    recordCount: number,
    sampleRecords: { id: string, entityType: string, currentLabel: string }[]
  }[]
}
```

**RBAC:** MANAGER+

### 7.6 Label Resolution

#### `GET /api/labels/resolve`
Enhanced label resolution (extends existing endpoint).

```typescript
// Query params
{
  label: string,           // Label code
  version?: number,        // Specific version number; defaults to active PUBLISHED
  includeDeprecated?: boolean  // Also search DEPRECATED versions
}

// Response
{
  label: Label,
  version: TaxonomyVersion,
  mappings: LabelMapping[],
  isDeprecated: boolean,
  migratesTo?: Label        // If deprecated, the target label in current version
}
```

**RBAC:** Authenticated

## 8. Audit Trail Requirements

| Action | Entity Type | Required Fields |
|---|---|---|
| `VERSION_CREATED` | `TaxonomyVersion` | createdBy, basedOnVersionId |
| `VERSION_PUBLISHED` | `TaxonomyVersion` | publishedBy, attestation, migrationExecutionId |
| `VERSION_DEPRECATED` | `TaxonomyVersion` | deprecatedBy, reason, replacedByVersionId |
| `VERSION_ARCHIVED` | `TaxonomyVersion` | archivedBy |
| `VERSION_ROLLED_BACK` | `TaxonomyVersion` | rolledBackBy, reason, recordsReverted |
| `LABEL_ADDED` | `Label` | versionId, labelCode, addedBy |
| `LABEL_MODIFIED` | `Label` | versionId, changedFields, modifiedBy |
| `LABEL_DEPRECATED` | `Label` | versionId, retirementDate, migratesTo |
| `LABEL_MIGRATED` | (per entity) | ruleId, sourceLabelId, targetLabelId, entityId |
| `MIGRATION_RULE_CREATED` | `MigrationRule` | ruleType, source, target, createdBy |
| `MIGRATION_EXECUTED` | `MigrationExecution` | summary counts, duration |

## 9. Zod Validator Additions

```typescript
// Taxonomy status enum
const taxonomyStatusEnum = z.enum(["DRAFT", "PUBLISHED", "DEPRECATED", "ARCHIVED"]);

// Create version
export const createVersionSchema = z.object({
  displayName: z.string().min(1).max(200),
  changeLog: z.string().min(1).max(5000),
  basedOnVersionId: z.string().uuid().optional(),
});

// Update version (draft only)
export const updateVersionSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  changeLog: z.string().min(1).max(5000).optional(),
  gracePeriodDays: z.number().int().min(1).max(365).optional(),
});

// Add label to version
export const addVersionLabelSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, "Code must be uppercase alphanumeric with underscores"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  parentId: z.string().uuid().optional(),
});

// Update label in version
export const updateVersionLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  action: z.enum(["MODIFIED", "DEPRECATED", "REMOVED"]).optional(),
});

// Migration rule
export const createMigrationRuleSchema = z.object({
  ruleType: z.enum(["RENAME", "MERGE", "SPLIT", "ARCHIVE"]),
  sourceLabelId: z.string().uuid(),
  targetLabelId: z.string().uuid(),
  condition: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

// Publish version
export const publishVersionSchema = z.object({
  attestation: z.string().min(10, "Attestation must be at least 10 characters"),
  skipDryRun: z.boolean().default(false),
});

// Rollback
export const rollbackVersionSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  attestation: z.string().min(10, "Attestation must be at least 10 characters"),
});

// Version diff query
export const versionDiffQuery = z.object({
  baseVersionId: z.string().uuid(),
  compareVersionId: z.string().uuid(),
});

// Version list query
export const versionListQuery = z.object({
  status: z.union([
    taxonomyStatusEnum,
    z.array(taxonomyStatusEnum),
  ]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
```

## 10. Migration Strategy (Implementation Rollout)

### Phase 1: Schema Migration (Non-breaking)
1. Add new fields to `TaxonomyVersion` (status, displayName, lifecycle timestamps, lineage)
2. Add `ARCHIVED` to `LabelStatus` enum
3. Create `VersionLabel`, `MigrationRule`, `MigrationExecution` tables
4. Add new fields to `Label` (category, parentId, sortOrder, metadata, createdBy)
5. Backfill: Set existing TaxonomyVersion records to `PUBLISHED` status; create `VersionLabel` entries for all active labels

### Phase 2: API Implementation
1. Implement version CRUD and label management endpoints
2. Implement migration rule CRUD
3. Implement diff and preview endpoints

### Phase 3: Governance Enforcement
1. Enable lifecycle state machine with RBAC checks
2. Implement publish workflow with migration execution
3. Enable 4-eyes publishing constraint
4. Deploy notification hooks for version transitions

### Phase 4: Operational Tooling
1. Scheduled job to auto-archive versions past grace period
2. Dashboard for taxonomy health metrics
3. Migration impact reports for compliance audits

## 11. Open Questions

1. **Label hierarchy depth** — Should we enforce a maximum depth for parent/child label hierarchies? Deep trees complicate migration rules.
2. **Concurrent drafts** — If multiple DRAFT versions exist, how do we handle conflicts when both try to publish? First-wins, or explicit conflict resolution?
3. **Cross-version label identity** — When a label code changes across versions (RENAME), should the system maintain a stable "canonical ID" separate from the label's UUID?
4. **Partial migration** — For SPLIT rules, how does the system determine which target label to assign when conditions overlap? Priority ordering or rejection?
5. **External taxonomy sources** — Should we support importing taxonomy definitions from external standards bodies (e.g., OSHA categories)?
