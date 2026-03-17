import type { PrismaClient } from "@prisma/client";
import type {
  IRepositoryAdapter,
  IRepository,
  IAuditLogRepository,
  ICacheRepository,
  RepositoryConfig,
  RepositoryCapability,
  StoreType,
} from "@e-clat/shared";
import { PrismaRepository } from "./PrismaRepository";
import { PrismaAuditLogRepository } from "./PrismaAuditLogRepository";
import { InMemoryCacheRepository } from "./InMemoryCacheRepository";

/**
 * Prisma adapter for the RepositoryFactory.
 *
 * Registers as store type "sql" and creates PrismaRepository instances
 * scoped to a specific Prisma model name.
 */
export class PrismaAdapter implements IRepositoryAdapter {
  readonly storeType: StoreType = "sql";

  constructor(private readonly prisma: PrismaClient) {}

  createRepository<T>(config: RepositoryConfig): IRepository<T> {
    const modelName = this.toModelName(config.entityName);
    return new PrismaRepository<T>(this.prisma, modelName);
  }

  createAuditRepository(_config: RepositoryConfig): IAuditLogRepository {
    return new PrismaAuditLogRepository(this.prisma);
  }

  createCacheRepository(_config: RepositoryConfig): ICacheRepository {
    // MVP: in-memory cache; Redis adapter will be added in a later sprint
    return new InMemoryCacheRepository();
  }

  supports(capability: RepositoryCapability): boolean {
    return ["transactions", "batch", "softDelete"].includes(capability);
  }

  /** Convert PascalCase entity name to camelCase Prisma delegate name */
  private toModelName(entityName: string): string {
    if (!entityName) throw new Error("entityName is required");
    return entityName.charAt(0).toLowerCase() + entityName.slice(1);
  }
}
