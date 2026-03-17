# Data Layer & Repository Pattern — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #114  
> **Applies To:** `apps/api/src/data`, `packages/shared/src/types`, `data/prisma/schema.prisma`  
> **Related Decisions:** Decision 1 (Tiered isolation — shared vs dedicated), Decision 9 (Polyglot storage: Postgres, Cosmos, Redis, Blob)  
> **Companion Docs:** [Service Architecture](./service-architecture-spec.md) · [Multi-Tenant API](./multi-tenant-api.md)

---

## 1. Problem Statement

Data access is currently **tightly coupled to Prisma**, blocking future architecture goals:

1. **No abstraction** — Services call Prisma directly; cannot swap storage layer
2. **No polyglot storage** — Everything in Postgres; cannot use Cosmos for JSON blobs, Redis for cache, Blob for documents
3. **No connection pooling strategy** — Cannot distinguish hot path (cache) from cold path (archive)
4. **No transaction boundaries** — Multi-store transactions (Postgres + Blob) have no coordination
5. **No data residency control** — Tenant's data storage location hardcoded; cannot route based on region
6. **No testing layer** — Cannot mock storage for unit tests; integration tests hit real DB
7. **No audit trail integration** — Deletions don't propagate to audit store

**Impact:** Cannot adopt multi-store architecture; cannot scale independently; cannot test reliably; locked into Postgres forever.

---

## 2. Solution Overview

Implement **repository pattern with polyglot storage adapters**:

- **IRepository<T>** — Generic interface defining CRUD + query operations
- **Concrete adapters** — PrismaRepository (Postgres), CosmosRepository (JSON), RedisCache, BlobStorage, ADXTelemetrySink
- **Composition** — Services depend on IRepository, not concrete implementations
- **Transaction manager** — Coordinate across stores (Postgres write + Blob upload + Audit append)
- **Tenant-aware resolver** — Select correct storage based on tenant tier (shared vs dedicated)
- **Migration path** — Gradual refactoring from direct Prisma to repository pattern

---

## 3. Repository Interfaces

### 3.1 Base Repository<T>

```typescript
// packages/shared/src/repositories/IRepository.ts

export interface IRepository<T> {
  // CRUD operations
  create(data: T, metadata?: Record<string, any>): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>, metadata?: Record<string, any>): Promise<T>;
  delete(id: string, soft?: boolean): Promise<void>;
  
  // Batch operations
  createMany(data: T[]): Promise<T[]>;
  updateMany(ids: string[], data: Partial<T>): Promise<T[]>;
  deleteMany(ids: string[], soft?: boolean): Promise<void>;
  
  // Query operations
  find(filter: Filter<T>, options?: QueryOptions): Promise<T[]>;
  findOne(filter: Filter<T>): Promise<T | null>;
  count(filter: Filter<T>): Promise<number>;
  
  // Transactions
  beginTransaction(): Promise<ITransaction>;
  
  // Metadata
  getSchema(): RepositorySchema;
  supports(capability: string): boolean;
}

export interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name: string): Promise<void>;
}

export interface Filter<T> {
  [key in keyof Partial<T>]: T[key] | { $in: T[key][] } | { $gt: T[key] } | { $lt: T[key] };
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: Record<string, 'asc' | 'desc'>;
  include?: string[];
}

export interface RepositorySchema {
  name: string;
  fields: Record<string, { type: string; nullable: boolean; unique: boolean }>;
}
```

### 3.2 Specialized Repositories

**Audit Repository** — Immutable append-only

```typescript
export interface IAuditRepository extends IRepository<AuditLog> {
  append(log: AuditLog): Promise<AuditLog>; // No update/delete
  queryByResource(resourceType: string, resourceId: string): Promise<AuditLog[]>;
  queryByActor(userId: string, dateRange?: DateRange): Promise<AuditLog[]>;
}
```

**Document Repository** — Blob storage + metadata

```typescript
export interface IDocumentRepository extends IRepository<Document> {
  uploadFile(documentId: string, file: Buffer, mimeType: string): Promise<string>; // Returns URL
  downloadFile(documentId: string): Promise<Buffer>;
  deleteFile(documentId: string): Promise<void>;
  getSignedUrl(documentId: string, expiresIn: number): Promise<string>;
}
```

**Cache Repository** — TTL + pattern matching

```typescript
export interface ICacheRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flush(): Promise<void>;
}
```

**Telemetry Repository** — Time-series optimized

```typescript
export interface ITelemetryRepository {
  writeMetric(metric: Metric): Promise<void>;
  writeBatch(metrics: Metric[]): Promise<void>;
  query(query: TelemetryQuery): Promise<Metric[]>;
}
```

---

## 4. Concrete Implementations

### 4.1 Prisma Repository

```typescript
// apps/api/src/data/repositories/PrismaRepository.ts

export class PrismaRepository<T> implements IRepository<T> {
  constructor(
    private prisma: PrismaClient,
    private modelName: keyof typeof prisma
  ) {}
  
  async create(data: T, metadata?: Record<string, any>): Promise<T> {
    const model = this.prisma[this.modelName];
    return model.create({ data }) as Promise<T>;
  }
  
  async find(filter: Filter<T>, options?: QueryOptions): Promise<T[]> {
    const model = this.prisma[this.modelName];
    return model.findMany({
      where: filter as any,
      take: options?.limit,
      skip: options?.offset,
      orderBy: options?.sort,
      include: this.buildInclude(options?.include),
    }) as Promise<T[]>;
  }
  
  // ... other methods
}
```

### 4.2 Cosmos Repository

```typescript
// apps/api/src/data/repositories/CosmosRepository.ts

export class CosmosRepository<T> implements IRepository<T> {
  constructor(
    private client: CosmosClient,
    private containerId: string
  ) {}
  
  async create(data: T): Promise<T> {
    const container = this.client.database('eclat').container(this.containerId);
    const { resource } = await container.items.create(data);
    return resource as T;
  }
  
  async find(filter: Filter<T>, options?: QueryOptions): Promise<T[]> {
    const container = this.client.database('eclat').container(this.containerId);
    const query = this.buildCosmosQuery(filter);
    const { resources } = await container.items.query(query).fetchAll();
    return resources as T[];
  }
  
  // ... other methods
}
```

### 4.3 Blob Storage Repository

```typescript
// apps/api/src/data/repositories/BlobStorageRepository.ts

export class BlobStorageRepository implements IDocumentRepository {
  constructor(
    private blobClient: BlobServiceClient,
    private containerName: string,
    private dbRepository: IRepository<Document> // Metadata only
  ) {}
  
  async uploadFile(documentId: string, file: Buffer, mimeType: string): Promise<string> {
    const blockBlobClient = this.blobClient
      .getContainerClient(this.containerName)
      .getBlockBlobClient(`${documentId}.bin`);
    
    await blockBlobClient.upload(file, file.length, {
      metadata: { mimeType },
    });
    
    return blockBlobClient.url;
  }
  
  async getSignedUrl(documentId: string, expiresIn: number): Promise<string> {
    const blockBlobClient = this.blobClient
      .getContainerClient(this.containerName)
      .getBlockBlobClient(`${documentId}.bin`);
    
    return generateBlobSASUrl(blockBlobClient, expiresIn);
  }
  
  // ... other methods
}
```

### 4.4 Redis Cache Repository

```typescript
// apps/api/src/data/repositories/RedisRepository.ts

export class RedisRepository implements ICacheRepository {
  constructor(private redis: RedisClient) {}
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }
  
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }
}
```

---

## 5. Tenant-Aware Connection Resolver

```typescript
// apps/api/src/config/storage-resolver.ts

export class StorageResolver {
  constructor(
    private tenantService: ITenantService,
    private sharedDb: PrismaClient,
    private dedicatedDbs: Map<string, PrismaClient>,
    private cache: RedisClient,
    private blob: BlobServiceClient
  ) {}
  
  async getRepositoryFor<T>(
    tenantId: string,
    entityType: string,
    storageType?: 'shared' | 'dedicated'
  ): Promise<IRepository<T>> {
    // 1. Get tenant config
    const tenant = await this.tenantService.getTenant(tenantId);
    
    // 2. Determine storage tier
    const tier = storageType || (tenant.tier === 'enterprise' ? 'dedicated' : 'shared');
    
    // 3. Select database connection
    const db = tier === 'dedicated' 
      ? this.dedicatedDbs.get(tenantId)
      : this.sharedDb;
    
    if (!db) {
      throw new Error(`No database connection for tenant ${tenantId}`);
    }
    
    // 4. Select repository adapter
    switch (entityType) {
      case 'ProofTemplate':
        return new PrismaRepository(db, 'proofTemplate');
      case 'Document':
        return new BlobStorageRepository(this.blob, `documents-${tenantId}`, 
          new PrismaRepository(db, 'document'));
      case 'Event':
        return new CosmosRepository(this.cosmos, `events-${tenantId}`);
      default:
        return new PrismaRepository(db, entityType as any);
    }
  }
  
  async getCacheRepository(): Promise<ICacheRepository> {
    return new RedisRepository(this.cache);
  }
}
```

---

## 6. Service Layer Integration

### 6.1 Template Service (Before)

```typescript
// OLD: Tightly coupled to Prisma

export class TemplateService {
  constructor(private prisma: PrismaClient) {}
  
  async createTemplate(data: TemplateInput, tenantId: string) {
    return this.prisma.proofTemplate.create({
      data: { ...data, tenantId },
    });
  }
}
```

### 6.2 Template Service (After)

```typescript
// NEW: Depends on IRepository abstraction

export class TemplateService {
  constructor(
    private templateRepo: IRepository<ProofTemplate>,
    private requirementRepo: IRepository<ProofRequirement>,
    private auditRepo: IAuditRepository,
    private cache: ICacheRepository
  ) {}
  
  async createTemplate(data: TemplateInput, tenantId: string, actor: User) {
    // 1. Create template
    const template = await this.templateRepo.create({
      ...data,
      tenantId,
      createdBy: actor.id,
    });
    
    // 2. Create requirements (batch)
    await this.requirementRepo.createMany(
      data.requirements.map(r => ({ ...r, templateId: template.id }))
    );
    
    // 3. Append audit log (immutable)
    await this.auditRepo.append({
      resourceType: 'ProofTemplate',
      resourceId: template.id,
      action: 'CREATE',
      actor: actor.id,
      timestamp: new Date(),
    });
    
    // 4. Cache invalidation
    await this.cache.del(`templates:list:${tenantId}`);
    
    return template;
  }
  
  async getTemplateWithCache(templateId: string, tenantId: string) {
    const cacheKey = `template:${templateId}`;
    
    // Try cache first
    let template = await this.cache.get<ProofTemplate>(cacheKey);
    if (template) return template;
    
    // Cache miss: query repository
    template = await this.templateRepo.read(templateId);
    if (!template) return null;
    
    // Populate cache for 1 hour
    await this.cache.set(cacheKey, template, 3600);
    
    return template;
  }
}
```

---

## 7. Transaction Coordinator

```typescript
// apps/api/src/data/transaction-coordinator.ts

export class TransactionCoordinator {
  async executeWithTransaction<T>(
    tenantId: string,
    work: (repos: RepositoryContext) => Promise<T>
  ): Promise<T> {
    const tx = await this.dbRepository.beginTransaction();
    
    try {
      const context: RepositoryContext = {
        template: new PrismaRepository(this.db, 'proofTemplate'),
        requirement: new PrismaRepository(this.db, 'proofRequirement'),
        audit: new PrismaAuditRepository(this.db),
        // All repos in same transaction
      };
      
      const result = await work(context);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
}
```

---

## 8. Data Model Considerations

```prisma
// data/prisma/schema.prisma (schema design for repository pattern)

// All models require these fields for repository pattern
model BaseEntity {
  id              String   @id @default(uuid())
  tenantId        String   // Multi-tenancy
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String   // Audit trail
  updatedBy       String?
  
  // Soft delete support
  deletedAt       DateTime?
  deletedBy       String?
  
  // Version tracking (for optimistic locking)
  version         Int      @default(1)
}
```

---

## 9. Migration Path: Direct Prisma → Repository

### Phase 1 (Sprint 5) — Interfaces & Adapters

- [ ] Define IRepository<T>, ITransaction interfaces
- [ ] Implement PrismaRepository adapter
- [ ] Create StorageResolver
- [ ] Zero production code refactoring yet
- **Success Criteria:** Repository pattern defined, adapter compiles

### Phase 2 (Sprint 6) — New Services Use Repository

- [ ] Refactor TemplateService to depend on IRepository
- [ ] Implement cache integration (Redis adapter)
- [ ] Add audit repository usage
- [ ] Integration tests for service layer
- **Success Criteria:** Template service tests pass with repository mocks

### Phase 3 (Sprint 7) — Migrate Existing Services

- [ ] Refactor QualificationService, MedicalService, DocumentService
- [ ] Implement BlobStorageRepository for documents
- [ ] Add transaction coordinator usage
- [ ] Zero breaking changes to API endpoints
- **Success Criteria:** All services use repository pattern; same API behavior

### Phase 4 (Sprint 8+) — Polyglot Storage

- [ ] Add CosmosRepository for event sourcing
- [ ] Implement ADXTelemetryRepository
- [ ] Tenant-aware storage selection (enterprise → dedicated DB)
- [ ] Data migration scripts
- **Success Criteria:** Enterprise tenants route to dedicated storage; cache layer active

---

## 10. Acceptance Criteria

✅ **Phase 1 Acceptance:**

- [ ] IRepository<T> interface defined with CRUD + query operations
- [ ] PrismaRepository implements interface for all existing models
- [ ] StorageResolver routes to correct storage (shared vs dedicated)
- [ ] Transaction interface supports begin/commit/rollback
- [ ] Zero production code changes; interfaces only

---

## 11. Compliance Notes

- **Audit immutability** — IAuditRepository append-only, no updates/deletes ✓
- **Data residency** — StorageResolver selects connection by tenant region ✓
- **Soft deletes** — Repository.delete() defaults soft; hard delete requires explicit flag ✓
- **Version tracking** — Optimistic locking via `version` field prevents lost updates ✓

---

## 12. Performance Considerations

- **Cache-aside pattern** — Hot entities (templates, employees) cached in Redis; 1-hour TTL default
- **Batch operations** — Repository.createMany() batches DB inserts; 100x faster than loop
- **Query filtering** — Repository.find() delegates to adapter; Prisma uses indexes
- **Connection pooling** — Dedicated DB has own pool; shared DB has larger pool
- **Lazy loading** — `include` parameter controls relationship fetching

---

## 13. Testing Strategy

```typescript
// tests/unit/services/TemplateService.test.ts

import { MockRepository } from '@test/mocks';

describe('TemplateService', () => {
  let service: TemplateService;
  let templateRepoMock: MockRepository<ProofTemplate>;
  let auditRepoMock: IAuditRepository;
  
  beforeEach(() => {
    templateRepoMock = new MockRepository<ProofTemplate>();
    auditRepoMock = new MockAuditRepository();
    service = new TemplateService(templateRepoMock, null, auditRepoMock, null);
  });
  
  it('should create template and audit log', async () => {
    const template = await service.createTemplate({...}, 'tenant_123', actor);
    
    expect(templateRepoMock.created).toHaveLength(1);
    expect(auditRepoMock.appended).toHaveLength(1);
  });
});
```

---

## 14. Related Specs

- **Service Architecture:** `service-architecture-spec.md` (polyglot storage decision)
- **Multi-Tenant API:** `multi-tenant-api.md` (tenant-aware connection resolution)
- **API Telemetry:** `api-telemetry.md` (telemetry repository for ADX)

