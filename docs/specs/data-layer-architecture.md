# Data Layer Architecture Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api/src/common`, `data/prisma`, `infra/layers`  
> **Issue:** #113 (DataLayer-01)  
> **Related Docs:** `docs/specs/multi-tenant-architecture.md`, `docs/specs/service-architecture-spec.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Polyglot Persistence Overview](#2-polyglot-persistence-overview)
3. [Repository Pattern](#3-repository-pattern)
4. [Tenant-Aware Connection Resolver](#4-tenant-aware-connection-resolver)
5. [Store Abstraction (SQL, Cosmos, Mongo, Redis, Blob, ADX)](#5-store-abstraction-sql-cosmos-mongo-redis-blob-adx)
6. [Data Model Mapping](#6-data-model-mapping)
7. [Migration Path (Prisma → Polyglot)](#7-migration-path-prisma--polyglot)
8. [Operational Patterns](#8-operational-patterns)
9. [API Contracts](#9-api-contracts)
10. [Security Considerations](#10-security-considerations)
11. [Performance & Scaling](#11-performance--scaling)
12. [Phased Rollout Plan](#12-phased-rollout-plan)
13. [Locked Decisions](#13-locked-decisions)

---

## 1. Problem Statement

E-CLAT currently uses **Prisma (PostgreSQL only)**. Three limitations prevent optimal scaling:

1. **No polyglot stores:** Blob storage (documents, evidence), cache (sessions, flags), telemetry (compliance audit logs) all go to DB
2. **No abstraction layer:** Stores are tightly coupled to Prisma; switching stores requires code refactors across modules
3. **No on-prem support:** Azure-native services (Cosmos, Storage, App Insights) unavailable in on-prem; need Postgres/MongoDB/Jaeger fallbacks

**Objective:** Implement repository pattern + store abstraction enabling:
- **SaaS:** Postgres (relational) + Cosmos (documents) + Azure Storage (blobs) + Redis (cache) + ADX (telemetry)
- **On-Prem:** Postgres (relational) + MongoDB (documents) + MinIO (blobs) + Redis (cache) + Prometheus (telemetry)
- **Hybrid:** Pick stores per deployment mode; swappable at runtime

---

## 2. Polyglot Persistence Overview

### 2.1 Store Types & Use Cases

| Store | Use Case | SaaS | On-Prem | Shared | Dedicated |
|-------|----------|:----:|:-------:|:------:|:---------:|
| **SQL** (Postgres/Azure SQL) | Relational data (employees, qualifications, standards) | ✓ | ✓ | Shared instance | Per-tenant instance |
| **Cosmos** (or Mongo) | Documents (audit logs, compliance reports, extraction results) | ✓ | MongoDB | Tenant-scoped collections | Per-tenant DB |
| **Blob Storage** (Azure Storage / MinIO) | Files (PDFs, certs, evidence) | ✓ | MinIO | Tenant-prefixed containers | Per-tenant container |
| **Cache** (Redis) | Sessions, feature flags, rate limits | ✓ | ✓ | Shared Redis | Per-tenant key prefix |
| **Telemetry** (ADX / Prometheus) | Compliance audit, performance metrics | ✓ | Prometheus | Tenant-scoped tables | Per-tenant workspace |

### 2.2 Data Distribution Example

**Scenario: Employee submits qualification evidence**

```
1. Employee uploads document
   → Blob Storage: Acme/evidence/qual-123.pdf
2. Document metadata stored
   → SQL: Document(id, name, fileStorageKey, createdBy)
3. Extraction triggered (if doc type = PDF)
   → Cosmos: ExtractionResult(id, documentId, extractedText, confidence)
4. Qualification proof recorded
   → SQL: ProofFulfillment(id, qualificationId, documentId, status)
5. Audit logged
   → Cosmos: AuditLog(id, action, resourceId, timestamp, tenantId)
6. Notification sent
   → Cache (Redis): pending_notifications:emp_123
7. Metrics emitted
   → Telemetry (ADX): compliance_event(tenant, employee, qualification, timestamp)
```

---

## 3. Repository Pattern

### 3.1 Repository Interface (Abstracted)

```typescript
// packages/shared/src/repository/types.ts

export interface IRepository<T> {
  create(data: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(filter: Filter<T>): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  findUnique(where: UniqueWhere<T>): Promise<T | null>;
}

export interface IDocumentRepository extends IRepository<Document> {
  // Document-specific methods
  findByEmployee(employeeId: string): Promise<Document[]>;
  download(id: string): Promise<Buffer>;
  store(id: string, file: Buffer): Promise<string>;
}

export interface IAuditLogRepository extends IRepository<AuditLog> {
  // Audit-specific methods
  findByAction(action: string, since: Date): Promise<AuditLog[]>;
  findByResource(resourceType: string, resourceId: string): Promise<AuditLog[]>;
  export(tenantId: string, dateRange: DateRange): Promise<AuditLog[]>;
}

export interface ICacheRepository {
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any | null>;
  del(key: string): Promise<void>;
  lpush(key: string, value: any): Promise<number>;
  lpop(key: string): Promise<any | null>;
}
```

### 3.2 Repository Implementation (Pluggable)

```typescript
// apps/api/src/repositories/document.repository.ts

export class DocumentRepository implements IDocumentRepository {
  constructor(private sqlClient: PrismaClient, private blobStore: IBlobStore) {}

  async create(data: Document): Promise<Document> {
    // Create metadata in SQL
    return await this.sqlClient.document.create({ data });
  }

  async download(id: string): Promise<Buffer> {
    const doc = await this.sqlClient.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError('Document', id);
    
    // Fetch actual file from blob store
    return await this.blobStore.get(doc.fileStorageKey);
  }

  async store(id: string, file: Buffer): Promise<string> {
    // Store file in blob store
    const key = `documents/${id}/${Date.now()}`;
    await this.blobStore.put(key, file);
    
    // Update metadata
    await this.sqlClient.document.update({
      where: { id },
      data: { fileStorageKey: key },
    });
    
    return key;
  }
}

// Factory: Instantiate based on deployment mode
export function createDocumentRepository(config: Config): IDocumentRepository {
  const sqlClient = createSqlClient(config);
  const blobStore = createBlobStore(config.blobStore.type); // AZURE, MINIO, etc.
  return new DocumentRepository(sqlClient, blobStore);
}
```

### 3.3 Service Layer (Uses Repository)

```typescript
// apps/api/src/modules/documents/service.ts

export class DocumentService {
  constructor(private documentRepo: IDocumentRepository) {}

  async uploadDocument(employeeId: string, file: Buffer, name: string): Promise<Document> {
    // Service logic: validation, ACL checks, etc.
    const doc = await this.documentRepo.create({
      id: uuid(),
      name,
      employeeId,
      status: 'UPLOADED',
    });

    await this.documentRepo.store(doc.id, file);
    return doc;
  }

  async getDocument(id: string): Promise<Document> {
    return await this.documentRepo.findById(id);
  }

  async downloadDocument(id: string): Promise<Buffer> {
    return await this.documentRepo.download(id);
  }
}
```

---

## 4. Tenant-Aware Connection Resolver

### 4.1 Connection Strategy

**Resolve tenant → store connections:**

```typescript
// apps/api/src/config/store-resolver.ts

export async function createStoreConnections(
  tenantId: string,
  config: Config
): Promise<StoreConnections> {
  const tenantConfig = await getTenantConfig(tenantId);
  
  // Shared tier: All tenants share stores; use tenant-scoped keys/tables
  if (tenantConfig.tier === 'SHARED') {
    return {
      sql: sharedSqlClient,  // All queries filter by tenantId
      cosmos: sharedCosmosClient, // Collections named 'shared'
      blob: sharedBlobStore, // Prefix: tenants/{tenantId}/
      cache: sharedRedis,    // Key prefix: tenant:{tenantId}:
      telemetry: sharedADX,  // Scoped table: audit_logs_shared
    };
  }
  
  // Dedicated tier: Per-tenant connections
  else if (tenantConfig.tier === 'DEDICATED') {
    return {
      sql: new PrismaClient({
        datasources: {
          db: {
            url: await keyVault.getSecret(`tenant-${tenantId}-db-uri`),
          },
        },
      }),
      cosmos: new CosmosClient({
        endpoint: await keyVault.getSecret(`tenant-${tenantId}-cosmos-endpoint`),
        key: await keyVault.getSecret(`tenant-${tenantId}-cosmos-key`),
      }),
      blob: new BlobServiceClient(
        `https://${tenantId}.blob.core.windows.net/`,
        new ClientSecretCredential(...)
      ),
      cache: new Redis({
        host: `redis-${tenantId}.redis.cache.windows.net`,
        password: await keyVault.getSecret(`tenant-${tenantId}-redis-key`),
      }),
      telemetry: new ADXClient({
        cluster: `https://${tenantId}-adx.eastus.kusto.windows.net`,
        database: `eclat_${tenantId}`,
      }),
    };
  }
}

// Middleware: Attach connections to request
app.use(async (req, res, next) => {
  if (req.tenant?.id) {
    req.stores = await createStoreConnections(req.tenant.id, config);
  }
  next();
});
```

### 4.2 Dependency Injection

**Repositories injected with store connections:**

```typescript
// apps/api/src/modules/documents/router.ts

router.post('/documents', authenticate, async (req, res, next) => {
  try {
    const docRepo = new DocumentRepository(req.stores.sql, req.stores.blob);
    const service = new DocumentService(docRepo);
    
    const doc = await service.uploadDocument(
      req.user.id,
      req.file.buffer,
      req.file.originalname
    );
    
    res.json(doc);
  } catch (err) {
    next(err);
  }
});
```

---

## 5. Store Abstraction (SQL, Cosmos, Mongo, Redis, Blob, ADX)

### 5.1 SQL (Postgres / Azure SQL)

**Relational data:** Employees, Qualifications, Standards, Templates, Assignments

```typescript
export interface ISqlClient {
  employee: {
    create(data: any): Promise<any>;
    findById(id: string): Promise<any | null>;
    findMany(where: any): Promise<any[]>;
    update(id: string, data: any): Promise<any>;
  };
  // ... other tables
}

// Implementation: Prisma (shared or dedicated)
```

### 5.2 Document Store (Cosmos / MongoDB)

**Document data:** Audit logs, extraction results, compliance reports, structured metadata

```typescript
export interface IDocumentStore {
  insert(collection: string, doc: any): Promise<string>;
  findById(collection: string, id: string): Promise<any | null>;
  find(collection: string, query: any): Promise<any[]>;
  update(collection: string, id: string, doc: any): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  bulk(operations: BulkOperation[]): Promise<void>;
}

// SaaS implementation: Cosmos DB
class CosmosDocumentStore implements IDocumentStore {
  constructor(private client: CosmosClient) {}
  
  async insert(collection: string, doc: any): Promise<string> {
    const container = this.client.database('eclat').container(collection);
    const { resource } = await container.items.create({
      id: doc.id || uuid(),
      ...doc,
      // Ensure tenant scoping
      _partitionKey: doc.tenantId,
    });
    return resource.id;
  }
}

// On-Prem implementation: MongoDB
class MongoDocumentStore implements IDocumentStore {
  constructor(private client: MongoClient) {}
  
  async insert(collection: string, doc: any): Promise<string> {
    const db = this.client.db('eclat');
    const result = await db.collection(collection).insertOne({
      _id: doc.id || new ObjectId(),
      ...doc,
    });
    return result.insertedId.toString();
  }
}
```

### 5.3 Blob Store (Azure Storage / MinIO)

**Files:** Evidence documents, certificates, uploaded files

```typescript
export interface IBlobStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// SaaS implementation: Azure Blob Storage
class AzureBlobStore implements IBlobStore {
  constructor(private client: BlobServiceClient) {}
  
  async put(key: string, data: Buffer): Promise<void> {
    const container = this.client.getContainerClient('eclat');
    const blob = container.getBlockBlobClient(key);
    await blob.upload(data, data.length);
  }

  async get(key: string): Promise<Buffer> {
    const container = this.client.getContainerClient('eclat');
    const blob = container.getBlockBlobClient(key);
    const download = await blob.download();
    return await streamToBuffer(download.readableStreamBody);
  }
}

// On-Prem implementation: MinIO
class MinioBlobStore implements IBlobStore {
  constructor(private client: Client) {}
  
  async put(key: string, data: Buffer): Promise<void> {
    await this.client.putObject('eclat', key, data, data.length);
  }

  async get(key: string): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
      this.client.getObject('eclat', key, (err, dataStream) => {
        if (err) return reject(err);
        let data = Buffer.alloc(0);
        dataStream.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
  }
}
```

### 5.4 Cache (Redis)

**Ephemeral data:** Sessions, feature flags, rate limits, pending notifications

```typescript
export interface ICacheStore {
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any | null>;
  del(key: string): Promise<void>;
  lpush(key: string, value: any): Promise<number>;
  lpop(key: string): Promise<any | null>;
  hset(key: string, field: string, value: any): Promise<void>;
  hget(key: string, field: string): Promise<any | null>;
}

// Both SaaS & On-Prem: Redis
class RedisCache implements ICacheStore {
  constructor(private client: Redis) {}
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get(key: string): Promise<any | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }
}
```

### 5.5 Telemetry (ADX / Prometheus)

**Analytics & compliance audit:** Compliance events, performance metrics, regulatory audit trails

```typescript
export interface ITelemetryStore {
  emit(event: TelemetryEvent): Promise<void>;
  query(table: string, kusto: string): Promise<any[]>;
}

// SaaS: Azure Data Explorer (ADX)
class ADXTelemetry implements ITelemetryStore {
  constructor(private client: KustoClient) {}
  
  async emit(event: TelemetryEvent): Promise<void> {
    // Ingest via ADX REST API
    await this.client.executeQuery('eclat', {
      table: `compliance_events`,
      data: [event],
    });
  }

  async query(table: string, kusto: string): Promise<any[]> {
    const result = await this.client.executeQuery('eclat', kusto);
    return result.rows;
  }
}

// On-Prem: Prometheus (+ Loki for logs)
class PrometheusMetrics implements ITelemetryStore {
  constructor(private client: PrometheusClient) {}
  
  async emit(event: TelemetryEvent): Promise<void> {
    // Emit as metrics
    const metric = new Counter({
      name: `eclat_${event.type}`,
      help: event.type,
      labelNames: ['tenant', 'action'],
    });
    metric.inc({ tenant: event.tenantId, action: event.action });
  }
}
```

---

## 6. Data Model Mapping

### 6.1 Where Data Lives

| Entity | Store | Rationale |
|--------|-------|-----------|
| **Employee** | SQL | Relational; frequent joins (qualifications, hours, assignments) |
| **Qualification** | SQL | Relational; time-series (status updates, expirations) |
| **Document** | SQL (metadata) + Blob (file) | Metadata indexed; files stored separately |
| **AuditLog** | Cosmos (or Mongo) | Append-only; immutable; high volume; queried by time range |
| **ExtractionResult** | Cosmos | Unstructured (extracted text, confidence scores, metadata) |
| **ComplianceReport** | Cosmos | Generated on-demand; cached; complex nested structure |
| **Session** | Redis | Ephemeral; fast access; auto-expire |
| **FeatureFlag** | SQL + Cache (layered) | SQL is source; Redis cache for 5min TTL |
| **Metrics** | ADX (or Prometheus) | Time-series analytics; retention policy |

---

## 7. Migration Path (Prisma → Polyglot)

### 7.1 Phase 1: Introduce Repository Abstraction (v0.5.0)

**Keep Prisma for all stores; add repository layer:**

```typescript
// All implementations use Prisma + Prisma ORM
class EmployeeRepository implements IRepository<Employee> {
  constructor(private prisma: PrismaClient) {}
  async create(data: Employee) { return this.prisma.employee.create({ data }); }
  // ...
}

class AuditLogRepository implements IRepository<AuditLog> {
  constructor(private prisma: PrismaClient) {}
  async create(data: AuditLog) { return this.prisma.auditLog.create({ data }); }
  // ...
}
```

**Result:** No logic changes; repositories encapsulate Prisma calls.

### 7.2 Phase 2: Offload Non-Relational Data (v0.6.0)

**Migrate audit logs, extraction results to Cosmos:**

```typescript
// New implementation for AuditLog
class AuditLogRepository implements IRepository<AuditLog> {
  constructor(private cosmos: IDocumentStore) {}
  async create(data: AuditLog) {
    return this.cosmos.insert('audit_logs', data);
  }
}

// Migration job: Backfill existing audit logs from Prisma → Cosmos
async function migrateAuditLogs(prisma: PrismaClient, cosmos: IDocumentStore) {
  const logs = await prisma.auditLog.findMany();
  const operations = logs.map(log => ({ operation: 'insert', collection: 'audit_logs', doc: log }));
  await cosmos.bulk(operations);
}
```

**Result:** Large audit log table removed from Postgres; Cosmos now handles compliance events.

### 7.3 Phase 3: Offload Blobs (v0.7.0)

**Move document files to blob storage; keep metadata in SQL:**

```typescript
// Document metadata stays in SQL; files go to blob store
class DocumentRepository implements IDocumentRepository {
  constructor(private sql: PrismaClient, private blob: IBlobStore) {}
  
  async store(id: string, file: Buffer): Promise<string> {
    const key = `documents/${id}/${Date.now()}`;
    await this.blob.put(key, file);
    await this.sql.document.update({
      where: { id },
      data: { fileStorageKey: key },
    });
    return key;
  }
}
```

**Result:** Postgres no longer stores large BLOBs; blob store scales independently.

### 7.4 Phase 4: Dedicated Tenant Deployments (v0.8.0+)

**Enterprise tenants get isolated store instances:**

```typescript
// Tenant config: DEDICATED tier
// Provision separate:
// - Postgres instance (Azure SQL Managed Instance)
// - Cosmos DB account
// - Blob Storage account
// - Redis cluster

// Store resolver picks dedicated instances per tenant
await createStoreConnections('acme_corp', config);
```

**Result:** Enterprise customers have dedicated, isolated data stores; SaaS tenants share but isolated by tenantId.

---

## 8. Operational Patterns

### 8.1 Transactional Data (SQL)

**Consistency matters: Employee updates, Qualifications, Assignments**

```typescript
// Use SQL transactions
await prisma.$transaction(async (tx) => {
  const emp = await tx.employee.findUnique({ where: { id: empId } });
  await tx.qualification.create({
    data: { employeeId: empId, standardId: stdId },
  });
  await tx.auditLog.create({
    data: {
      action: 'CREATE',
      resourceType: 'Qualification',
      resourceId: qual.id,
      userId: req.user.id,
    },
  });
});
```

### 8.2 Eventual Consistency (Cosmos)

**Audit logs, reports can be eventually consistent:**

```typescript
// Fire-and-forget audit to Cosmos
async function logAction(action: string, resource: any, user: string, cosmos: IDocumentStore) {
  cosmos.insert('audit_logs', {
    id: uuid(),
    action,
    resourceId: resource.id,
    userId: user,
    timestamp: new Date(),
  }).catch(err => logger.error('Audit log failed', err));
  
  // Don't wait; request completes
  return;
}
```

### 8.3 Caching Strategy

**Cache SQL queries; invalidate on updates:**

```typescript
async function getEmployeeWithCache(id: string, cache: ICacheStore, sql: ISqlClient) {
  const cached = await cache.get(`employee:${id}`);
  if (cached) return cached;
  
  const emp = await sql.employee.findById(id);
  await cache.set(`employee:${id}`, emp, 300); // 5min TTL
  return emp;
}

// Invalidate on update
async function updateEmployee(id: string, data: any, cache: ICacheStore, sql: ISqlClient) {
  const emp = await sql.employee.update(id, data);
  await cache.del(`employee:${id}`); // Invalidate cache
  return emp;
}
```

---

## 9. API Contracts

### 9.1 Store Configuration Routes

```
GET /api/v1/platform/stores
  Requires: ADMIN role
  Response: {
    tier: 'SHARED' | 'DEDICATED',
    stores: {
      sql: { type: 'postgres' | 'azuresql', host: '...' },
      cosmos: { type: 'cosmos' | 'mongodb', endpoint: '...' },
      blob: { type: 'azure' | 'minio', endpoint: '...' },
      cache: { type: 'redis', host: '...' },
      telemetry: { type: 'adx' | 'prometheus', endpoint: '...' }
    }
  }

POST /api/v1/platform/stores/test-connection
  Requires: ADMIN role
  Body: { storeType: 'sql' | 'cosmos' | 'blob' | 'cache' | 'telemetry' }
  Response: { ok: true, latency: ms }
```

### 9.2 Migration Routes

```
POST /api/v1/platform/migrations/audit-logs
  Requires: ADMIN role
  Body: { sourceStore: 'sql', targetStore: 'cosmos', dryRun?: true }
  Response: { jobId, status: 'QUEUED', recordCount: ... }

GET /api/v1/platform/migrations/:jobId
  Response: { id, status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', progress: %, error?: ... }
```

---

## 10. Security Considerations

### 10.1 Encryption at Rest

**All stores encrypt sensitive data:**

```
- SQL: Transparent Data Encryption (TDE)
- Cosmos: Encryption at Rest (enabled by default)
- Blob: Client-side encryption (AES-256-GCM)
- Redis: Encryption (Enterprise tier)
- Telemetry: Encrypted transmission (HTTPS)
```

### 10.2 Access Control

**Key Vault manages all connection strings:**

```typescript
// Never hardcode connection strings
const dbUri = await keyVault.getSecret(`tenant-${tenantId}-db-uri`);
const cosmosKey = await keyVault.getSecret(`tenant-${tenantId}-cosmos-key`);

// Rotate secrets without code changes
await keyVault.rotateSecret(`tenant-${tenantId}-db-uri`);
```

### 10.3 Audit Trail

**All store operations logged:**

```typescript
async function logStoreAccess(store: string, op: string, resource: string, userId: string) {
  await telemetry.emit({
    type: 'STORE_ACCESS',
    store,
    operation: op,
    resourceId: resource,
    userId,
    timestamp: new Date(),
  });
}
```

---

## 11. Performance & Scaling

### 11.1 Indexing Strategy

**SQL: Composite indexes on (tenantId, ...)**

```sql
CREATE INDEX idx_employees_tenant_status
ON employee(tenantId, status);

CREATE INDEX idx_qualifications_tenant_employee_status
ON qualification(tenantId, employeeId, status);
```

**Cosmos: Partition key = tenantId**

```json
{
  "id": "audit-log-123",
  "tenantId": "acme_corp",
  "action": "CREATE",
  "/": "tenantId"  // Partition key
}
```

### 11.2 Connection Pooling

**Reuse store connections:**

```typescript
const storePool = new Map<string, StoreConnections>();

export async function getStoreConnections(tenantId: string) {
  if (storePool.has(tenantId)) {
    return storePool.get(tenantId);
  }
  
  const connections = await createStoreConnections(tenantId, config);
  storePool.set(tenantId, connections);
  return connections;
}
```

### 11.3 Query Optimization

**Batch operations:**

```typescript
// Bulk insert audit logs (instead of individual inserts)
async function logAuditBatch(logs: AuditLog[], cosmos: IDocumentStore) {
  const operations = logs.map(log => ({
    operation: 'insert',
    collection: 'audit_logs',
    doc: log,
  }));
  await cosmos.bulk(operations);
}
```

---

## 12. Phased Rollout Plan

### 12.1 Sprint 6 (2 weeks): Repository Abstraction
- [x] Define IRepository, IDocumentStore, IBlobStore, ICacheStore, ITelemetryStore interfaces
- [x] Implement Prisma-backed repositories (no new stores yet)
- [x] Inject repositories into services
- **Deliverable:** All modules use repositories; logic unchanged

### 12.2 Sprint 7 (2 weeks): Cosmos Integration
- [x] Implement Cosmos (SaaS) + MongoDB (on-prem) document stores
- [x] Migrate audit logs from SQL → Cosmos
- [x] Migrate extraction results from SQL → Cosmos
- [x] Update repository implementations
- **Deliverable:** Audit logs in Cosmos; SQL schema simplified

### 12.3 Sprint 8 (1 week): Blob Store
- [x] Implement Azure Blob Storage (SaaS) + MinIO (on-prem) stores
- [x] Migrate document files from SQL BLOB → blob store
- [x] Update DocumentRepository to use blob store
- **Deliverable:** Documents stored in blob; SQL lighter

### 12.4 Sprint 9 (1 week): Caching + Telemetry
- [x] Implement Redis cache (both tiers)
- [x] Add ADX (SaaS) + Prometheus (on-prem) telemetry
- [x] Cache critical queries (employee, feature flags)
- [x] Emit compliance events to telemetry
- **Deliverable:** Full polyglot persistence ready

### 12.5 Sprint 10+ (Ongoing)
- [ ] Dedicated tenant store provisioning
- [ ] Performance optimization (indexing, batching)
- [ ] Backup & disaster recovery per store
- [ ] Cost optimization (archival, retention policies)

---

## 13. Locked Decisions

### 13.1 Decision #1: Tiered Isolation
- **Relevance:** Shared tier uses row-level filtering; dedicated uses separate stores per tenant.
- **Implementation:** Store resolver picks shared vs dedicated connections; tenant-aware connection pooling.

### 13.2 Decision #9: Event-Driven + Polyglot
- **Relevance:** Stores are swappable; repositories abstract implementation.
- **Implementation:** IRepository interfaces; factory functions create implementations per deployment mode.

### 13.3 Decision #10: OTel + ADX + App Insights
- **Relevance:** Vendor-neutral instrumentation; polyglot telemetry (ADX/Prometheus).
- **Implementation:** ITelemetryStore interface; ADX (SaaS) / Prometheus (on-prem) implementations.

### 13.4 Decision #3: Modular Monolith
- **Relevance:** Repository layer isolates modules from store coupling.
- **Implementation:** Service layer depends on repositories, not Prisma directly.

---

## Next Steps

1. **Sprint 6:** Define & implement repository abstraction
2. **Sprint 7:** Migrate audit logs to Cosmos
3. **Sprint 8:** Migrate documents to blob store
4. **Sprint 9:** Add caching + telemetry
5. **Sprint 10+:** Dedicated provisioning + optimization

**Completion Target:** v0.6.0–v0.7.0 (full polyglot persistence; SaaS & on-prem support; scalable architecture)
