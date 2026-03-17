import type { IRepository } from "./IRepository";

/**
 * Audit log repository — append-only by design.
 *
 * Compliance constraint: audit records MUST NOT be updated or hard-deleted.
 * The base IRepository update/delete methods throw if called.
 *
 * @see docs/specs/data-layer-api.md — Section 3.2 (Specialized Repositories)
 */

export interface AuditEntry {
  id: string;
  action: string;
  recordId: string;
  entityType: string;
  changedFields: Record<string, unknown> | null;
  actor: string;
  reason: string | null;
  attestation: string | null;
  timestamp: Date;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface IAuditLogRepository extends IRepository<AuditEntry> {
  /** Append an immutable audit entry (preferred over `create`) */
  append(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry>;

  /** Query audit entries by the resource they relate to */
  queryByResource(entityType: string, recordId: string): Promise<AuditEntry[]>;

  /** Query audit entries by the actor who performed the action */
  queryByActor(actorId: string, dateRange?: DateRange): Promise<AuditEntry[]>;
}
