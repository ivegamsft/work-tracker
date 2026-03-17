# Hour Capture and Reconciliation — Domain Design Spec

**Issue:** #43  
**Author:** Bunk (Backend)  
**Status:** Draft  
**Created:** 2026-03-20

---

## 1. Problem Statement

E-CLAT currently captures hour records from five discrete sources (`CLOCK_IN_OUT`, `TIMESHEET_IMPORT`, `JOB_TICKET_SYNC`, `CALENDAR_SYNC`, `MANUAL_ENTRY`), but treats each record as independent. There is no formal model for:

- Declaring which external system produced a record (source system identity, not just source type)
- Establishing trust precedence when the same hours appear from multiple sources
- Auto-detecting conflicts across sources for the same employee + date + category
- Providing a structured reconciliation workflow with escalation
- Maintaining a full compliance audit trail through the reconciliation lifecycle

The existing `HourConflict` model supports basic duplicate/mismatch detection, but lacks source-aware priority, automated resolution, and the batch import provenance needed for regulated-industry audit.

## 2. Design Goals

1. **Source provenance** — Every hour record traces to a named external system and import batch.
2. **Automated conflict detection** — On every write (import, manual, sync), the system checks for overlapping records and creates conflicts automatically.
3. **Trust hierarchy** — A configurable source priority determines which record wins by default, with manual override available.
4. **Reconciliation workflow** — Conflicts flow through a state machine with RBAC-gated transitions.
5. **Audit completeness** — Every conflict detection, auto-resolution, and manual resolution produces an immutable audit entry.
6. **Backward compatibility** — Existing endpoints continue to work; new fields are additive.

## 3. Source Trust Hierarchy

Sources are ranked by institutional trust. Higher-priority sources win in automated conflict resolution.

| Priority | Source Type         | Rationale |
|----------|---------------------|-----------|
| 1 (highest) | `PAYROLL_SYSTEM`   | Authoritative financial system of record |
| 2        | `JOB_TICKET_SYNC`   | Verified by scheduling/dispatch system |
| 3        | `TIMESHEET_IMPORT`  | Supervisor-reviewed batch import |
| 4        | `CLOCK_IN_OUT`      | Employee self-reported via time clock |
| 5        | `CALENDAR_SYNC`     | Inferred from calendar events |
| 6 (lowest) | `MANUAL_ENTRY`     | Employee self-attestation |

### Configuration Model

Trust hierarchy is stored per-tenant and versioned so auditors can see what priority was active when a conflict was resolved.

```prisma
model SourceTrustConfig {
  id            String     @id @default(uuid())
  sourceType    HourSource
  priority      Int        // Lower number = higher trust
  isActive      Boolean    @default(true)
  effectiveFrom DateTime   @default(now())
  effectiveTo   DateTime?
  createdBy     String
  createdAt     DateTime   @default(now())

  @@unique([sourceType, effectiveFrom])
  @@index([isActive, priority])
  @@map("source_trust_configs")
}
```

## 4. Prisma Schema Changes

### 4.1 Enhanced HourRecord

Add source system provenance and batch tracking to existing model:

```prisma
model HourRecord {
  id                    String     @id @default(uuid())
  employeeId            String
  employee              Employee   @relation(fields: [employeeId], references: [id])
  source                HourSource
  date                  DateTime   @db.Date
  hours                 Decimal    @db.Decimal(5, 2)
  qualificationCategory String
  description           String     @default("")
  labelId               String?
  label                 Label?     @relation(fields: [labelId], references: [id])
  verifiedBy            String?
  verifiedAt            DateTime?
  isDeleted             Boolean    @default(false)
  deletedReason         String?
  createdAt             DateTime   @default(now())

  // ── New fields ──
  sourceSystemId        String?    // External system identifier (e.g., "adp-payroll-prod")
  sourceRecordRef       String?    // External record ID for traceability
  importBatchId         String?    // Links to ImportBatch for bulk provenance
  importBatch           ImportBatch? @relation(fields: [importBatchId], references: [id])
  trustPriority         Int?       // Snapshot of source priority at creation time
  isReconciled          Boolean    @default(false) // True when conflict resolution accepted this record
  reconciledAt          DateTime?

  conflicts HourConflictRecord[]

  @@index([employeeId, date])
  @@index([source])
  @@index([importBatchId])
  @@index([employeeId, date, qualificationCategory, source]) // Conflict detection index
  @@map("hour_records")
}
```

### 4.2 Import Batch Tracking

New model for batch provenance — every import operation (payroll, CSV, scheduling) creates one batch:

```prisma
model ImportBatch {
  id              String        @id @default(uuid())
  source          HourSource
  sourceSystemId  String        // e.g., "adp-payroll-prod"
  fileName        String?       // Original file name for CSV/Excel imports
  fileHash        String?       // SHA-256 of import file for dedup
  recordCount     Int
  successCount    Int           @default(0)
  conflictCount   Int           @default(0)
  errorCount      Int           @default(0)
  status          ImportStatus  @default(PROCESSING)
  importedBy      String        // User who triggered the import
  startedAt       DateTime      @default(now())
  completedAt     DateTime?
  errorLog        Json?         // Structured error details

  records         HourRecord[]

  @@index([sourceSystemId, startedAt])
  @@index([status])
  @@map("import_batches")
}

enum ImportStatus {
  PROCESSING
  COMPLETED
  COMPLETED_WITH_CONFLICTS
  FAILED
}
```

### 4.3 Enhanced HourConflict

Extend conflict model with source-aware resolution and escalation:

```prisma
model HourConflict {
  id               String           @id @default(uuid())
  conflictType     ConflictType
  status           ConflictStatus   @default(PENDING)
  resolutionMethod ResolutionMethod?
  resolvedBy       String?
  resolvedAt       DateTime?
  attestation      String?
  reason           String?
  createdAt        DateTime         @default(now())

  // ── New fields ──
  detectedBy       String           @default("system") // "system" or userId
  autoResolvable   Boolean          @default(false)     // Can trust hierarchy resolve this?
  autoResolvedAt   DateTime?
  winningRecordId  String?          // Which record was accepted
  escalationLevel  Int              @default(0)         // 0=normal, 1=escalated to compliance
  escalatedAt      DateTime?
  escalatedBy      String?
  dueBy            DateTime?        // SLA deadline for resolution
  employeeId       String?          // Denormalized for efficient querying
  conflictDate     DateTime?        @db.Date // Denormalized date of the conflicting hours

  records HourConflictRecord[]

  @@index([status])
  @@index([employeeId, conflictDate])
  @@index([dueBy, status])
  @@map("hour_conflicts")
}
```

### 4.4 Extended Enums

```prisma
enum HourSource {
  CLOCK_IN_OUT
  TIMESHEET_IMPORT
  JOB_TICKET_SYNC
  CALENDAR_SYNC
  MANUAL_ENTRY
  PAYROLL_SYSTEM     // New: dedicated payroll integration
  SUPERVISOR_ATTEST  // New: supervisor direct attestation
  API_INTEGRATION    // New: generic external API
}

enum ConflictType {
  DUPLICATE          // Same hours reported twice from same source
  MISMATCH           // Different hours for same employee+date+category from different sources
  OVERLAP            // New: time ranges overlap across sources
  THRESHOLD_EXCEEDED // New: total hours exceed plausible daily limit (e.g., >16h)
}

enum ConflictStatus {
  PENDING            // Awaiting review
  AUTO_RESOLVED      // New: system resolved via trust hierarchy
  RESOLVED           // Manually resolved by authorized user
  ESCALATED          // New: flagged for compliance review
  DISMISSED          // New: conflict determined to be false positive
}

enum ResolutionMethod {
  PRECEDENCE         // Higher-priority source wins
  OVERRIDE           // Manual selection of winning record
  MERGE              // Combine data from multiple records
  SPLIT              // New: apportion hours across categories
  DISMISS            // New: mark conflict as non-issue
}
```

## 5. Conflict Detection Algorithm

### 5.1 Detection Triggers

Conflict detection runs automatically on:
1. **Single record creation** — clock-in, clock-out, manual entry
2. **Batch import completion** — after all records in an import batch are persisted
3. **Scheduled reconciliation job** — nightly sweep for cross-source conflicts

### 5.2 Detection Rules

```
For each new HourRecord R:

1. DUPLICATE check:
   - Find existing records with same (employeeId, date, source, qualificationCategory, hours)
   - If found → create DUPLICATE conflict

2. MISMATCH check:
   - Find existing records with same (employeeId, date, qualificationCategory) but different source
   - If hours differ by more than threshold (configurable, default 0.25h) → create MISMATCH conflict

3. OVERLAP check:
   - For clock-in/out records with time ranges
   - Find existing records whose time range overlaps
   - If overlap > threshold (configurable, default 15min) → create OVERLAP conflict

4. THRESHOLD check:
   - Sum all non-deleted hours for (employeeId, date)
   - If total > configurable daily max (default 16h) → create THRESHOLD_EXCEEDED conflict
```

### 5.3 Auto-Resolution via Trust Hierarchy

When a conflict is auto-resolvable (two sources with clear priority difference):

```
1. Look up SourceTrustConfig for each record's source type
2. If priorities differ by ≥ 1 level:
   a. Mark higher-priority record as winner (winningRecordId)
   b. Set status = AUTO_RESOLVED, autoResolvedAt = now()
   c. Create AuditLog entry with resolution details
   d. Set isReconciled = true on winning record
3. If priorities are equal → cannot auto-resolve; stays PENDING
```

### 5.4 SLA and Escalation

- Unresolved PENDING conflicts older than 48 hours auto-escalate to `ESCALATED` status
- ESCALATED conflicts notify COMPLIANCE_OFFICER role via notification system
- An `EscalationRule` (existing model) can define custom SLA windows per conflict type

## 6. Reconciliation State Machine

```
                          ┌──────────────┐
            ┌─────────────│   PENDING    │─────────────┐
            │             └──────┬───────┘             │
            │                    │                     │
      auto-resolve          manual review         SLA timeout
      (trust hierarchy)         │                     │
            │                   │                     │
            ▼                   ▼                     ▼
   ┌────────────────┐   ┌────────────┐       ┌────────────┐
   │  AUTO_RESOLVED │   │  RESOLVED  │       │  ESCALATED │
   └────────────────┘   └────────────┘       └─────┬──────┘
                                                    │
                                              compliance review
                                                    │
                                         ┌──────────┴──────────┐
                                         ▼                     ▼
                                  ┌────────────┐       ┌────────────┐
                                  │  RESOLVED  │       │  DISMISSED │
                                  └────────────┘       └────────────┘
```

### Transition RBAC

| Transition | Minimum Role | Attestation Required |
|---|---|---|
| PENDING → AUTO_RESOLVED | System | No (logged automatically) |
| PENDING → RESOLVED | MANAGER | Yes |
| PENDING → DISMISSED | MANAGER | Yes (reason required) |
| PENDING → ESCALATED | System (SLA) or SUPERVISOR | No |
| ESCALATED → RESOLVED | COMPLIANCE_OFFICER | Yes |
| ESCALATED → DISMISSED | COMPLIANCE_OFFICER | Yes (reason required) |

## 7. API Endpoint Design

### 7.1 Import Endpoints

#### `POST /api/hours/import`
Generic import endpoint supporting multiple formats.

```typescript
// Request
{
  source: "PAYROLL_SYSTEM" | "TIMESHEET_IMPORT" | "SUPERVISOR_ATTEST" | "API_INTEGRATION",
  sourceSystemId: string,        // e.g., "adp-payroll-prod"
  format: "json" | "csv",       // CSV parsed server-side
  records: ImportRecord[],
  options?: {
    autoResolveConflicts: boolean,  // Default: true
    dryRun: boolean,                // Default: false — preview without persisting
    conflictThresholdHours: number  // Override default 0.25h threshold
  }
}

// ImportRecord
{
  employeeId: string,            // UUID
  date: string,                  // ISO date
  hours: number,
  qualificationCategory: string,
  description?: string,
  labelId?: string,
  sourceRecordRef?: string       // External system record ID
}

// Response
{
  batchId: string,
  status: "COMPLETED" | "COMPLETED_WITH_CONFLICTS" | "FAILED",
  summary: {
    total: number,
    imported: number,
    conflicts: number,
    errors: number,
    autoResolved: number
  },
  conflicts: ConflictSummary[],  // Only if conflicts > 0
  errors: ImportError[]          // Only if errors > 0
}
```

**RBAC:** SUPERVISOR+ for all imports.

#### `POST /api/hours/import/csv`
File upload endpoint for CSV/Excel timesheet import.

```typescript
// Request: multipart/form-data
// Fields: file (CSV/XLSX), sourceSystemId, qualificationCategory, options (JSON)

// Response: same as POST /api/hours/import
```

**RBAC:** SUPERVISOR+

#### `GET /api/hours/import/batches`
List import batches with filtering.

```typescript
// Query params
{
  source?: HourSource,
  sourceSystemId?: string,
  status?: ImportStatus,
  from?: Date,
  to?: Date,
  page?: number,      // Default: 1
  limit?: number      // Default: 50, max: 100
}

// Response: PaginatedResult<ImportBatch>
```

**RBAC:** SUPERVISOR+

#### `GET /api/hours/import/batches/:id`
Get import batch details with record summary.

**RBAC:** SUPERVISOR+

### 7.2 Conflict Management Endpoints

#### `GET /api/hours/conflicts`
Enhanced conflict listing (extends existing endpoint).

```typescript
// Query params (new filters)
{
  status?: ConflictStatus | ConflictStatus[],
  conflictType?: ConflictType,
  employeeId?: string,
  from?: Date,
  to?: Date,
  escalationLevel?: number,
  overdueSlaOnly?: boolean,   // Only show past-due conflicts
  page?: number,
  limit?: number
}

// Response: PaginatedResult<HourConflict>
// Each conflict includes nested records with source info
```

**RBAC:** MANAGER+ (unchanged)

#### `POST /api/hours/conflicts/:id/resolve`
Enhanced conflict resolution (extends existing endpoint).

```typescript
// Request
{
  resolutionMethod: "precedence" | "override" | "merge" | "split" | "dismiss",
  winningRecordId?: string,    // Required for "override"
  attestation: string,
  reason: string,
  splitAllocation?: {          // Required for "split"
    recordId: string,
    allocatedHours: number
  }[]
}
```

**RBAC:** MANAGER+ (COMPLIANCE_OFFICER+ if escalated)

#### `POST /api/hours/conflicts/:id/escalate`
Manually escalate a conflict to compliance.

```typescript
// Request
{
  reason: string
}
```

**RBAC:** SUPERVISOR+

#### `POST /api/hours/conflicts/bulk-resolve`
Batch resolution for multiple conflicts with the same resolution method.

```typescript
// Request
{
  conflictIds: string[],       // Max 50 per request
  resolutionMethod: "precedence" | "dismiss",
  attestation: string,
  reason: string
}

// Response
{
  resolved: number,
  failed: { conflictId: string, error: string }[]
}
```

**RBAC:** MANAGER+

#### `GET /api/hours/conflicts/dashboard`
Conflict summary dashboard for managers.

```typescript
// Response
{
  summary: {
    pending: number,
    escalated: number,
    overdueSlа: number,
    resolvedToday: number,
    autoResolvedToday: number
  },
  byType: { type: ConflictType, count: number }[],
  byEmployee: { employeeId: string, name: string, pendingCount: number }[],
  recentResolutions: ConflictResolution[]  // Last 10
}
```

**RBAC:** MANAGER+

### 7.3 Source Configuration Endpoints

#### `GET /api/hours/sources/trust-config`
Get active trust hierarchy.

**RBAC:** SUPERVISOR+ (read), ADMIN (write)

#### `PUT /api/hours/sources/trust-config`
Update trust hierarchy (creates new versioned config).

```typescript
// Request
{
  sources: {
    sourceType: HourSource,
    priority: number
  }[],
  reason: string  // Audit trail
}
```

**RBAC:** ADMIN

### 7.4 Supervisor Attestation Endpoint

#### `POST /api/hours/attest`
Supervisor attests hours for an employee (new source type).

```typescript
// Request
{
  employeeId: string,
  date: string,
  hours: number,
  qualificationCategory: string,
  description: string,
  attestation: string    // Supervisor's attestation statement
}
```

**RBAC:** SUPERVISOR+ (cannot attest own hours)

## 8. Audit Trail Requirements

Every write operation in the hours reconciliation domain produces an `AuditLog` entry:

| Action | Entity Type | Required Fields |
|---|---|---|
| `HOUR_RECORD_CREATED` | `HourRecord` | source, sourceSystemId, importBatchId |
| `HOUR_RECORD_IMPORTED` | `HourRecord` | batchId, sourceRecordRef |
| `CONFLICT_DETECTED` | `HourConflict` | conflictType, recordIds, detectionMethod |
| `CONFLICT_AUTO_RESOLVED` | `HourConflict` | winningRecordId, trustPriorities |
| `CONFLICT_RESOLVED` | `HourConflict` | resolutionMethod, attestation, reason |
| `CONFLICT_ESCALATED` | `HourConflict` | escalationLevel, reason |
| `CONFLICT_DISMISSED` | `HourConflict` | reason, attestation |
| `TRUST_CONFIG_UPDATED` | `SourceTrustConfig` | old priorities, new priorities |
| `IMPORT_BATCH_CREATED` | `ImportBatch` | source, recordCount, sourceSystemId |
| `IMPORT_BATCH_COMPLETED` | `ImportBatch` | successCount, conflictCount, errorCount |

### Compliance Constraint

Audit log entries for conflict resolution **must** include:
- The identity of the resolver (never "system" for manual resolutions)
- The attestation text (minimum 10 characters)
- The business reason (minimum 10 characters)
- Snapshot of the conflicting records' hours values at resolution time

## 9. Zod Validator Additions

```typescript
// New source types
const hourSourceEnum = z.enum([
  "clock_in_out", "timesheet_import", "job_ticket_sync",
  "calendar_sync", "manual_entry", "payroll_system",
  "supervisor_attest", "api_integration"
]);

// Generic import schema
export const importSchema = z.object({
  source: z.enum(["payroll_system", "timesheet_import", "supervisor_attest", "api_integration"]),
  sourceSystemId: z.string().min(1).max(100),
  format: z.enum(["json", "csv"]).default("json"),
  records: z.array(z.object({
    employeeId: z.string().uuid(),
    date: z.coerce.date(),
    hours: z.number().positive().max(24),
    qualificationCategory: z.string().min(1),
    description: z.string().max(500).optional(),
    labelId: z.string().uuid().optional(),
    sourceRecordRef: z.string().max(200).optional(),
  })).min(1).max(1000),
  options: z.object({
    autoResolveConflicts: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    conflictThresholdHours: z.number().positive().max(8).default(0.25),
  }).optional(),
});

// Enhanced conflict resolution
export const resolveConflictSchemaV2 = z.object({
  resolutionMethod: z.enum(["precedence", "override", "merge", "split", "dismiss"]),
  winningRecordId: z.string().uuid().optional(),
  attestation: z.string().min(10, "Attestation must be at least 10 characters"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  splitAllocation: z.array(z.object({
    recordId: z.string().uuid(),
    allocatedHours: z.number().positive().max(24),
  })).optional(),
}).refine(
  (data) => data.resolutionMethod !== "override" || data.winningRecordId,
  { message: "winningRecordId required for override resolution" }
).refine(
  (data) => data.resolutionMethod !== "split" || (data.splitAllocation && data.splitAllocation.length >= 2),
  { message: "splitAllocation with ≥2 entries required for split resolution" }
);

// Bulk resolution
export const bulkResolveSchema = z.object({
  conflictIds: z.array(z.string().uuid()).min(1).max(50),
  resolutionMethod: z.enum(["precedence", "dismiss"]),
  attestation: z.string().min(10),
  reason: z.string().min(10),
});

// Supervisor attestation
export const supervisorAttestSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.number().positive().max(24),
  qualificationCategory: z.string().min(1),
  description: z.string().min(1).max(500),
  attestation: z.string().min(10, "Supervisor attestation must be at least 10 characters"),
});
```

## 10. Migration Strategy

### Phase 1: Schema Migration (Non-breaking)
1. Add new nullable columns to `HourRecord` (`sourceSystemId`, `sourceRecordRef`, `importBatchId`, `trustPriority`, `isReconciled`, `reconciledAt`)
2. Add new enum values to `HourSource`, `ConflictType`, `ConflictStatus`, `ResolutionMethod`
3. Create `ImportBatch` and `SourceTrustConfig` tables
4. Add new columns to `HourConflict` (all nullable/defaulted)
5. Backfill `trustPriority` for existing records based on default hierarchy

### Phase 2: API Additions (Additive)
1. Deploy new import, conflict management, and trust config endpoints
2. Existing endpoints remain unchanged
3. Conflict detection logic added to existing write paths behind feature flag

### Phase 3: Enable Automated Detection
1. Enable conflict detection on all write paths
2. Deploy nightly reconciliation job
3. Enable auto-resolution via trust hierarchy

## 11. Open Questions

1. **CSV format standardization** — Should we define a canonical CSV schema, or support configurable column mapping per source system?
2. **Real-time vs. batch conflict detection** — For high-volume payroll imports (1000+ records), should conflict detection be synchronous or queued?
3. **Historical reconciliation** — Should we run conflict detection retroactively on existing hour records when the feature is enabled?
4. **Source system registration** — Should external source systems be formally registered entities with API keys, or is a string identifier sufficient?
5. **Conflict notification routing** — Should conflict notifications go to the employee's direct supervisor, or to a configurable compliance queue?
