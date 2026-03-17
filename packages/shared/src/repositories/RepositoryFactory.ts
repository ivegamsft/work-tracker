import type { IRepository, RepositoryCapability } from "./IRepository";
import type { IAuditLogRepository } from "./IAuditLogRepository";
import type { ICacheRepository } from "./ICacheRepository";
import type { IDocumentRepository } from "./IDocumentRepository";

// ---------------------------------------------------------------------------
// Store type enum — polyglot storage backends E-CLAT supports
// ---------------------------------------------------------------------------

export type StoreType = "sql" | "cosmos" | "blob" | "redis" | "adx";

// ---------------------------------------------------------------------------
// Repository configuration
// ---------------------------------------------------------------------------

export interface RepositoryConfig {
  /** Which store backend to use. Default: "sql" */
  storeType?: StoreType;

  /** Tenant ID for tenant-scoped repositories */
  tenantId?: string;

  /** The domain entity name (e.g. "Employee", "Document") */
  entityName: string;

  /** Additional adapter-specific options */
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Factory adapter — implemented per store type in apps/api
// ---------------------------------------------------------------------------

export interface IRepositoryAdapter {
  storeType: StoreType;
  createRepository<T>(config: RepositoryConfig): IRepository<T>;
  createAuditRepository?(config: RepositoryConfig): IAuditLogRepository;
  createDocumentRepository?(config: RepositoryConfig): IDocumentRepository;
  createCacheRepository?(config: RepositoryConfig): ICacheRepository;
  supports(capability: RepositoryCapability): boolean;
}

// ---------------------------------------------------------------------------
// RepositoryFactory — the single entry-point for creating repositories
// ---------------------------------------------------------------------------

export class RepositoryFactory {
  private adapters = new Map<StoreType, IRepositoryAdapter>();

  /** Register a concrete adapter (e.g. PrismaAdapter, RedisAdapter) */
  registerAdapter(adapter: IRepositoryAdapter): void {
    this.adapters.set(adapter.storeType, adapter);
  }

  /** Get an adapter by store type */
  getAdapter(storeType: StoreType): IRepositoryAdapter {
    const adapter = this.adapters.get(storeType);
    if (!adapter) {
      throw new Error(
        `No repository adapter registered for store type "${storeType}". ` +
          `Registered: [${[...this.adapters.keys()].join(", ")}]`,
      );
    }
    return adapter;
  }

  /** Create a generic typed repository */
  createRepository<T>(config: RepositoryConfig): IRepository<T> {
    const storeType = config.storeType ?? "sql";
    return this.getAdapter(storeType).createRepository<T>(config);
  }

  /** Create an audit-log repository (append-only) */
  createAuditRepository(config: RepositoryConfig): IAuditLogRepository {
    const storeType = config.storeType ?? "sql";
    const adapter = this.getAdapter(storeType);
    if (!adapter.createAuditRepository) {
      throw new Error(`Adapter "${storeType}" does not support audit repositories`);
    }
    return adapter.createAuditRepository(config);
  }

  /** Create a document repository (metadata + blob) */
  createDocumentRepository(config: RepositoryConfig): IDocumentRepository {
    const storeType = config.storeType ?? "sql";
    const adapter = this.getAdapter(storeType);
    if (!adapter.createDocumentRepository) {
      throw new Error(`Adapter "${storeType}" does not support document repositories`);
    }
    return adapter.createDocumentRepository(config);
  }

  /** Create a cache repository (Redis or in-memory) */
  createCacheRepository(config: RepositoryConfig): ICacheRepository {
    const storeType = config.storeType ?? "redis";
    const adapter = this.getAdapter(storeType);
    if (!adapter.createCacheRepository) {
      throw new Error(`Adapter "${storeType}" does not support cache repositories`);
    }
    return adapter.createCacheRepository(config);
  }

  /** List all registered store types */
  registeredStoreTypes(): StoreType[] {
    return [...this.adapters.keys()];
  }
}
