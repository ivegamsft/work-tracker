import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  IAuditLogRepository,
  AuditEntry,
  DateRange,
  Filter,
  QueryOptions,
  ITransaction,
  RepositorySchema,
  RepositoryCapability,
  FieldMeta,
} from "@e-clat/shared";

/**
 * Prisma-backed audit log repository — append-only.
 *
 * Compliance constraint: update() and delete() throw unconditionally.
 * Use append() to create new entries.
 */
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // -----------------------------------------------------------------------
  // Audit-specific operations
  // -----------------------------------------------------------------------

  async append(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry> {
    const record = await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        recordId: entry.recordId,
        entityType: entry.entityType,
        changedFields: entry.changedFields as Prisma.InputJsonValue | undefined,
        actor: entry.actor,
        reason: entry.reason,
        attestation: entry.attestation,
      },
    });

    return this.mapRecord(record);
  }

  async queryByResource(entityType: string, recordId: string): Promise<AuditEntry[]> {
    const records = await this.prisma.auditLog.findMany({
      where: { entityType, recordId },
      orderBy: { timestamp: "desc" },
    });
    return records.map(this.mapRecord);
  }

  async queryByActor(actorId: string, dateRange?: DateRange): Promise<AuditEntry[]> {
    const where: Record<string, unknown> = { actor: actorId };
    if (dateRange) {
      where.timestamp = { gte: dateRange.from, lte: dateRange.to };
    }
    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });
    return records.map(this.mapRecord);
  }

  // -----------------------------------------------------------------------
  // IRepository<AuditEntry> — CRUD (restricted)
  // -----------------------------------------------------------------------

  async create(data: Partial<AuditEntry>): Promise<AuditEntry> {
    return this.append(data as Omit<AuditEntry, "id" | "timestamp">);
  }

  async findById(id: string): Promise<AuditEntry | null> {
    const record = await this.prisma.auditLog.findUnique({ where: { id } });
    return record ? this.mapRecord(record) : null;
  }

  async findMany(filter: Filter<AuditEntry>, options?: QueryOptions): Promise<AuditEntry[]> {
    const records = await this.prisma.auditLog.findMany({
      where: filter as Record<string, unknown>,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { timestamp: "desc" },
    });
    return records.map(this.mapRecord);
  }

  async findUnique(filter: Filter<AuditEntry>): Promise<AuditEntry | null> {
    const results = await this.findMany(filter, { limit: 1 });
    return results[0] ?? null;
  }

  async update(_id: string, _data: Partial<AuditEntry>): Promise<AuditEntry> {
    throw new Error("Audit logs are immutable — update is not permitted");
  }

  async delete(_id: string, _soft?: boolean): Promise<void> {
    throw new Error("Audit logs are immutable — delete is not permitted");
  }

  async createMany(data: Partial<AuditEntry>[]): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    for (const entry of data) {
      results.push(await this.create(entry));
    }
    return results;
  }

  async updateMany(_filter: Filter<AuditEntry>, _data: Partial<AuditEntry>): Promise<number> {
    throw new Error("Audit logs are immutable — updateMany is not permitted");
  }

  async deleteMany(_filter: Filter<AuditEntry>, _soft?: boolean): Promise<number> {
    throw new Error("Audit logs are immutable — deleteMany is not permitted");
  }

  async count(filter: Filter<AuditEntry>): Promise<number> {
    return this.prisma.auditLog.count({ where: filter as Record<string, unknown> });
  }

  async beginTransaction(): Promise<ITransaction> {
    throw new Error("Transactions are not supported on append-only audit repositories");
  }

  getSchema(): RepositorySchema {
    return {
      name: "auditLog",
      fields: {
        id: { type: "string", nullable: false, unique: true },
        action: { type: "string", nullable: false, unique: false },
        recordId: { type: "string", nullable: false, unique: false },
        entityType: { type: "string", nullable: false, unique: false },
        actor: { type: "string", nullable: false, unique: false },
        timestamp: { type: "Date", nullable: false, unique: false },
      } as Record<string, FieldMeta>,
    };
  }

  supports(capability: RepositoryCapability): boolean {
    // Only read + append; no transactions, no deletes, no batch updates
    return capability === "batch";
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRecord = (record: any): AuditEntry => ({
    id: record.id,
    action: record.action,
    recordId: record.recordId,
    entityType: record.entityType,
    changedFields:
      record.changedFields && typeof record.changedFields === "object"
        ? (record.changedFields as Record<string, unknown>)
        : null,
    actor: record.actor,
    reason: record.reason ?? null,
    attestation: record.attestation ?? null,
    timestamp: record.timestamp,
  });
}
