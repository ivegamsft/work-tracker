import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared interfaces & factory
// ---------------------------------------------------------------------------
import {
  RepositoryFactory,
  type IRepository,
  type IAuditLogRepository,
  type ICacheRepository,
  type RepositoryConfig,
} from "@e-clat/shared";

// ---------------------------------------------------------------------------
// Concrete implementations
// ---------------------------------------------------------------------------
import { PrismaRepository } from "../../src/common/data/PrismaRepository";
import { PrismaAdapter } from "../../src/common/data/PrismaAdapter";
import { PrismaAuditLogRepository } from "../../src/common/data/PrismaAuditLogRepository";
import { InMemoryCacheRepository } from "../../src/common/data/InMemoryCacheRepository";
import {
  TenantResolver,
  StaticTenantLookup,
  DEFAULT_TENANT_ID,
} from "../../src/common/data/TenantResolver";
import { ConnectionManager } from "../../src/common/data/ConnectionManager";
import type { TenantConfig } from "../../src/common/data/TenantContext";

// ---------------------------------------------------------------------------
// Helpers — mock Prisma delegates
// ---------------------------------------------------------------------------

function mockPrismaDelegate() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
}

function mockPrismaClient(models: Record<string, ReturnType<typeof mockPrismaDelegate>> = {}) {
  return {
    ...models,
    $transaction: vi.fn(async (ops: unknown[]) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      if (typeof ops === "function") {
        return (ops as (tx: unknown) => Promise<unknown>)(models);
      }
      return ops;
    }),
    $disconnect: vi.fn(),
  } as unknown as PrismaClient;
}

// ===========================================================================
// TEST SUITE
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. IRepository<T> — PrismaRepository
// ---------------------------------------------------------------------------

describe("PrismaRepository", () => {
  let delegate: ReturnType<typeof mockPrismaDelegate>;
  let prisma: PrismaClient;
  let repo: IRepository<{ id: string; name: string }>;

  beforeEach(() => {
    delegate = mockPrismaDelegate();
    prisma = mockPrismaClient({ employee: delegate });
    repo = new PrismaRepository(prisma, "employee");
  });

  it("create() delegates to prisma.model.create", async () => {
    const input = { name: "Alice" };
    delegate.create.mockResolvedValue({ id: "1", name: "Alice" });

    const result = await repo.create(input);
    expect(delegate.create).toHaveBeenCalledWith({ data: input });
    expect(result).toEqual({ id: "1", name: "Alice" });
  });

  it("findById() delegates to prisma.model.findUnique", async () => {
    delegate.findUnique.mockResolvedValue({ id: "1", name: "Bob" });

    const result = await repo.findById("1");
    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: "1" } });
    expect(result).toEqual({ id: "1", name: "Bob" });
  });

  it("findById() returns null when not found", async () => {
    delegate.findUnique.mockResolvedValue(null);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findMany() translates simple equality filter", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({ name: "Alice" } as any);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "Alice" } }),
    );
  });

  it("findMany() translates $in operator to Prisma's in", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({ name: { $in: ["Alice", "Bob"] } } as any);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { in: ["Alice", "Bob"] } },
      }),
    );
  });

  it("findMany() translates $gt/$lt operators", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({ id: { $gt: "5", $lt: "10" } } as any);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { gt: "5", lt: "10" } },
      }),
    );
  });

  it("findMany() translates $like to Prisma contains", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({ name: { $like: "Ali" } } as any);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "Ali", mode: "insensitive" } },
      }),
    );
  });

  it("findMany() applies pagination options", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({}, { limit: 10, offset: 20 });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it("findMany() applies sort options", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({}, { sort: { name: "asc" } });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ name: "asc" }] }),
    );
  });

  it("findMany() applies include options", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({}, { include: ["qualifications"] });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { qualifications: true } }),
    );
  });

  it("findUnique() returns first match from findMany", async () => {
    delegate.findMany.mockResolvedValue([{ id: "1", name: "Alice" }]);

    const result = await repo.findUnique({ name: "Alice" } as any);
    expect(result).toEqual({ id: "1", name: "Alice" });
  });

  it("findUnique() returns null when no match", async () => {
    delegate.findMany.mockResolvedValue([]);
    expect(await repo.findUnique({ name: "Nobody" } as any)).toBeNull();
  });

  it("update() delegates to prisma.model.update", async () => {
    delegate.update.mockResolvedValue({ id: "1", name: "Updated" });

    const result = await repo.update("1", { name: "Updated" });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { name: "Updated" },
    });
    expect(result.name).toBe("Updated");
  });

  it("delete() performs soft delete by default", async () => {
    delegate.update.mockResolvedValue({});

    await repo.delete("1");
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(delegate.delete).not.toHaveBeenCalled();
  });

  it("delete() performs hard delete when soft=false", async () => {
    delegate.delete.mockResolvedValue({});

    await repo.delete("1", false);
    expect(delegate.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("count() delegates to prisma.model.count", async () => {
    delegate.count.mockResolvedValue(42);

    const result = await repo.count({ name: "Alice" } as any);
    expect(result).toBe(42);
  });

  it("createMany() creates each item in a transaction", async () => {
    delegate.create
      .mockResolvedValueOnce({ id: "1", name: "A" })
      .mockResolvedValueOnce({ id: "2", name: "B" });

    const results = await repo.createMany([{ name: "A" }, { name: "B" }]);
    expect(results).toHaveLength(2);
  });

  it("updateMany() delegates to prisma.model.updateMany", async () => {
    delegate.updateMany.mockResolvedValue({ count: 3 });

    const count = await repo.updateMany({ name: "old" } as any, { name: "new" } as any);
    expect(count).toBe(3);
  });

  it("deleteMany() performs soft delete by default", async () => {
    delegate.updateMany.mockResolvedValue({ count: 2 });

    const count = await repo.deleteMany({ name: "remove" } as any);
    expect(count).toBe(2);
  });

  it("deleteMany() performs hard delete when soft=false", async () => {
    delegate.deleteMany.mockResolvedValue({ count: 1 });

    const count = await repo.deleteMany({ name: "remove" } as any, false);
    expect(count).toBe(1);
  });

  it("supports() reports correct capabilities", () => {
    expect(repo.supports("transactions")).toBe(true);
    expect(repo.supports("batch")).toBe(true);
    expect(repo.supports("softDelete")).toBe(true);
    expect(repo.supports("fullTextSearch")).toBe(false);
    expect(repo.supports("blobStorage")).toBe(false);
  });

  it("getSchema() returns model name", () => {
    const schema = repo.getSchema();
    expect(schema.name).toBe("employee");
  });

  it("throws when model name does not exist on PrismaClient", () => {
    const badRepo = new PrismaRepository(prisma, "nonExistentModel");
    expect(() => badRepo.findById("1")).rejects.toThrow("Prisma model");
  });

  it("findMany() translates $or filter", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({
      $or: [{ name: "Alice" } as any, { name: "Bob" } as any],
    });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ name: "Alice" }, { name: "Bob" }] },
      }),
    );
  });

  it("findMany() translates $and filter", async () => {
    delegate.findMany.mockResolvedValue([]);

    await repo.findMany({
      $and: [{ name: "Alice" } as any, { id: "1" } as any],
    });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ name: "Alice" }, { id: "1" }] },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. PrismaAuditLogRepository — append-only
// ---------------------------------------------------------------------------

describe("PrismaAuditLogRepository", () => {
  let auditDelegate: ReturnType<typeof mockPrismaDelegate>;
  let prisma: PrismaClient;
  let repo: IAuditLogRepository;

  const sampleEntry = {
    action: "inserted",
    recordId: "emp-1",
    entityType: "employee",
    changedFields: { name: "Alice" },
    actor: "admin@test.com",
    reason: null,
    attestation: null,
  };

  beforeEach(() => {
    auditDelegate = mockPrismaDelegate();
    prisma = mockPrismaClient({ auditLog: auditDelegate });
    repo = new PrismaAuditLogRepository(prisma);
  });

  it("append() creates an audit entry", async () => {
    auditDelegate.create.mockResolvedValue({
      id: "audit-1",
      ...sampleEntry,
      timestamp: new Date(),
    });

    const result = await repo.append(sampleEntry);
    expect(result.id).toBe("audit-1");
    expect(result.action).toBe("inserted");
    expect(auditDelegate.create).toHaveBeenCalled();
  });

  it("queryByResource() filters by entityType and recordId", async () => {
    auditDelegate.findMany.mockResolvedValue([]);

    await repo.queryByResource("employee", "emp-1");
    expect(auditDelegate.findMany).toHaveBeenCalledWith({
      where: { entityType: "employee", recordId: "emp-1" },
      orderBy: { timestamp: "desc" },
    });
  });

  it("queryByActor() filters by actor", async () => {
    auditDelegate.findMany.mockResolvedValue([]);

    await repo.queryByActor("admin@test.com");
    expect(auditDelegate.findMany).toHaveBeenCalledWith({
      where: { actor: "admin@test.com" },
      orderBy: { timestamp: "desc" },
    });
  });

  it("queryByActor() filters by actor with date range", async () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    auditDelegate.findMany.mockResolvedValue([]);

    await repo.queryByActor("admin@test.com", { from, to });
    expect(auditDelegate.findMany).toHaveBeenCalledWith({
      where: {
        actor: "admin@test.com",
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "desc" },
    });
  });

  it("update() throws — audit logs are immutable", async () => {
    await expect(repo.update("audit-1", { action: "hacked" })).rejects.toThrow(
      "immutable",
    );
  });

  it("delete() throws — audit logs are immutable", async () => {
    await expect(repo.delete("audit-1")).rejects.toThrow("immutable");
  });

  it("updateMany() throws — audit logs are immutable", async () => {
    await expect(repo.updateMany({}, { action: "hacked" })).rejects.toThrow(
      "immutable",
    );
  });

  it("deleteMany() throws — audit logs are immutable", async () => {
    await expect(repo.deleteMany({})).rejects.toThrow("immutable");
  });

  it("findById() returns entry by id", async () => {
    auditDelegate.findUnique.mockResolvedValue({
      id: "audit-1",
      ...sampleEntry,
      timestamp: new Date(),
    });

    const result = await repo.findById("audit-1");
    expect(result?.id).toBe("audit-1");
  });

  it("count() delegates to prisma auditLog.count", async () => {
    auditDelegate.count.mockResolvedValue(5);
    expect(await repo.count({ entityType: "employee" } as any)).toBe(5);
  });

  it("supports() reports batch but not transactions", () => {
    expect(repo.supports("batch")).toBe(true);
    expect(repo.supports("transactions")).toBe(false);
  });

  it("beginTransaction() throws — not supported for audit", async () => {
    await expect(repo.beginTransaction()).rejects.toThrow("not supported");
  });
});

// ---------------------------------------------------------------------------
// 3. InMemoryCacheRepository
// ---------------------------------------------------------------------------

describe("InMemoryCacheRepository", () => {
  let cache: ICacheRepository;

  beforeEach(() => {
    cache = new InMemoryCacheRepository();
  });

  it("get() returns null for missing key", async () => {
    expect(await cache.get("missing")).toBeNull();
  });

  it("set()/get() round-trips a value", async () => {
    await cache.set("key1", { hello: "world" });
    expect(await cache.get("key1")).toEqual({ hello: "world" });
  });

  it("set() with TTL expires the entry", async () => {
    vi.useFakeTimers();
    try {
      await cache.set("ttl-key", "value", 1); // 1 second TTL
      expect(await cache.get("ttl-key")).toBe("value");

      vi.advanceTimersByTime(1500);
      expect(await cache.get("ttl-key")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("del() removes a key", async () => {
    await cache.set("key1", "val");
    await cache.del("key1");
    expect(await cache.get("key1")).toBeNull();
  });

  it("has() returns true/false correctly", async () => {
    expect(await cache.has("nope")).toBe(false);
    await cache.set("yes", 1);
    expect(await cache.has("yes")).toBe(true);
  });

  it("keys() matches glob patterns", async () => {
    await cache.set("templates:list:t1", "a");
    await cache.set("templates:list:t2", "b");
    await cache.set("employees:e1", "c");

    const matched = await cache.keys("templates:*");
    expect(matched).toHaveLength(2);
    expect(matched).toContain("templates:list:t1");
    expect(matched).toContain("templates:list:t2");
  });

  it("delByPattern() removes matching keys and returns count", async () => {
    await cache.set("a:1", "x");
    await cache.set("a:2", "y");
    await cache.set("b:1", "z");

    const deleted = await cache.delByPattern("a:*");
    expect(deleted).toBe(2);
    expect(await cache.has("a:1")).toBe(false);
    expect(await cache.has("b:1")).toBe(true);
  });

  it("flush() clears all entries", async () => {
    await cache.set("k1", "v1");
    await cache.set("k2", "v2");
    await cache.flush();
    expect(await cache.keys("*")).toHaveLength(0);
  });

  it("has() returns false for expired keys", async () => {
    vi.useFakeTimers();
    try {
      await cache.set("exp", "val", 1);
      vi.advanceTimersByTime(2000);
      expect(await cache.has("exp")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. RepositoryFactory — factory creation & adapter registration
// ---------------------------------------------------------------------------

describe("RepositoryFactory", () => {
  let factory: RepositoryFactory;
  let prisma: PrismaClient;

  beforeEach(() => {
    const delegate = mockPrismaDelegate();
    const auditDelegate = mockPrismaDelegate();
    prisma = mockPrismaClient({
      employee: delegate,
      auditLog: auditDelegate,
    });
    factory = new RepositoryFactory();
  });

  it("throws when no adapter is registered for a store type", () => {
    expect(() => factory.createRepository({ entityName: "Employee" })).toThrow(
      "No repository adapter registered",
    );
  });

  it("creates a repository after registering PrismaAdapter", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));

    const repo = factory.createRepository({ entityName: "Employee" });
    expect(repo).toBeInstanceOf(PrismaRepository);
  });

  it("creates an audit repository via PrismaAdapter", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));

    const auditRepo = factory.createAuditRepository({ entityName: "AuditLog" });
    expect(auditRepo).toBeInstanceOf(PrismaAuditLogRepository);
  });

  it("creates a cache repository (in-memory for MVP)", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));

    const cacheRepo = factory.createCacheRepository({
      entityName: "Cache",
      storeType: "sql",
    });
    expect(cacheRepo).toBeInstanceOf(InMemoryCacheRepository);
  });

  it("lists registered store types", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));
    expect(factory.registeredStoreTypes()).toEqual(["sql"]);
  });

  it("defaults to 'sql' store type when not specified", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));

    const repo = factory.createRepository({ entityName: "Employee" });
    expect(repo).toBeInstanceOf(PrismaRepository);
  });

  it("throws for document repository when adapter doesn't support it", () => {
    factory.registerAdapter(new PrismaAdapter(prisma));

    expect(() =>
      factory.createDocumentRepository({ entityName: "Document" }),
    ).toThrow("does not support document repositories");
  });
});

// ---------------------------------------------------------------------------
// 5. TenantResolver — tenant context extraction
// ---------------------------------------------------------------------------

describe("TenantResolver", () => {
  let lookup: StaticTenantLookup;
  let resolver: TenantResolver;

  const sharedTenant: TenantConfig = {
    tenantId: "acme",
    tier: "shared",
    region: "eastus",
  };

  const dedicatedTenant: TenantConfig = {
    tenantId: "bigcorp",
    tier: "dedicated",
    region: "westus",
    connectionStringSecretName: "db-connection-bigcorp",
  };

  beforeEach(() => {
    lookup = new StaticTenantLookup([sharedTenant, dedicatedTenant]);
    resolver = new TenantResolver(lookup);
  });

  function fakeRequest(overrides: {
    user?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}) {
    return {
      user: overrides.user,
      headers: overrides.headers ?? {},
    } as any;
  }

  it("extracts tenant_id from JWT claim", async () => {
    const req = fakeRequest({ user: { tenant_id: "acme" } });
    const ctx = await resolver.resolve(req);
    expect(ctx.tenantId).toBe("acme");
    expect(ctx.tier).toBe("shared");
    expect(ctx.region).toBe("eastus");
  });

  it("extracts tenant from X-Tenant-ID header when no JWT claim", async () => {
    const req = fakeRequest({ headers: { "x-tenant-id": "bigcorp" } });
    const ctx = await resolver.resolve(req);
    expect(ctx.tenantId).toBe("bigcorp");
    expect(ctx.tier).toBe("dedicated");
  });

  it("falls back to default tenant when no JWT or header", async () => {
    const req = fakeRequest();
    const ctx = await resolver.resolve(req);
    expect(ctx.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(ctx.tier).toBe("shared"); // default tier
  });

  it("JWT claim takes precedence over header", async () => {
    const req = fakeRequest({
      user: { tenant_id: "acme" },
      headers: { "x-tenant-id": "bigcorp" },
    });
    const ctx = await resolver.resolve(req);
    expect(ctx.tenantId).toBe("acme");
  });

  it("extracts environment_id from X-Environment-ID header", async () => {
    const req = fakeRequest({
      headers: { "x-tenant-id": "acme", "x-environment-id": "staging" },
    });
    const ctx = await resolver.resolve(req);
    expect(ctx.environmentId).toBe("staging");
  });

  it("extracts environment_id from ENVIRONMENT_ID env var", async () => {
    const originalEnv = process.env.ENVIRONMENT_ID;
    process.env.ENVIRONMENT_ID = "production";
    try {
      const req = fakeRequest({ headers: { "x-tenant-id": "acme" } });
      const ctx = await resolver.resolve(req);
      expect(ctx.environmentId).toBe("production");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.ENVIRONMENT_ID;
      } else {
        process.env.ENVIRONMENT_ID = originalEnv;
      }
    }
  });

  it("returns unknown tenant with shared tier", async () => {
    const req = fakeRequest({ headers: { "x-tenant-id": "unknown-tenant" } });
    const ctx = await resolver.resolve(req);
    expect(ctx.tenantId).toBe("unknown-tenant");
    expect(ctx.tier).toBe("shared"); // defaults when not in lookup
  });
});

// ---------------------------------------------------------------------------
// 6. StaticTenantLookup
// ---------------------------------------------------------------------------

describe("StaticTenantLookup", () => {
  it("returns null for unknown tenant", async () => {
    const lookup = new StaticTenantLookup();
    expect(await lookup.getTenantConfig("nope")).toBeNull();
  });

  it("returns config for registered tenant", async () => {
    const lookup = new StaticTenantLookup([
      { tenantId: "t1", tier: "shared" },
    ]);
    const config = await lookup.getTenantConfig("t1");
    expect(config?.tier).toBe("shared");
  });

  it("supports runtime registration", async () => {
    const lookup = new StaticTenantLookup();
    lookup.register({ tenantId: "new", tier: "dedicated" });
    expect(await lookup.getTenantConfig("new")).toEqual({
      tenantId: "new",
      tier: "dedicated",
    });
  });
});

// ---------------------------------------------------------------------------
// 7. ConnectionManager — shared vs dedicated connections
// ---------------------------------------------------------------------------

describe("ConnectionManager", () => {
  let sharedClient: PrismaClient;
  let manager: ConnectionManager;
  const mockResolveSecret = vi.fn<(name: string) => Promise<string | undefined>>();

  beforeEach(() => {
    sharedClient = mockPrismaClient();
    mockResolveSecret.mockResolvedValue("postgresql://dedicated-db");
    manager = new ConnectionManager({
      sharedClient,
      createClient: (_connStr: string) => mockPrismaClient(),
      resolveSecret: mockResolveSecret,
    });
  });

  it("returns shared client for shared-tier tenants", async () => {
    const client = await manager.getClient({
      tenantId: "acme",
      tier: "shared",
    });
    expect(client).toBe(sharedClient);
  });

  it("creates a dedicated client for dedicated-tier tenants", async () => {
    const client = await manager.getClient({
      tenantId: "bigcorp",
      tier: "dedicated",
    });
    expect(client).not.toBe(sharedClient);
    expect(manager.dedicatedConnectionCount).toBe(1);
    expect(mockResolveSecret).toHaveBeenCalledWith("db-connection-bigcorp");
  });

  it("caches dedicated clients for the same tenant", async () => {
    const client1 = await manager.getClient({ tenantId: "t1", tier: "dedicated" });
    const client2 = await manager.getClient({ tenantId: "t1", tier: "dedicated" });
    expect(client1).toBe(client2);
    expect(manager.dedicatedConnectionCount).toBe(1);
    // resolveSecret should only be called once
    expect(mockResolveSecret).toHaveBeenCalledTimes(1);
  });

  it("disconnectTenant() removes a dedicated client", async () => {
    await manager.getClient({ tenantId: "t1", tier: "dedicated" });
    expect(manager.dedicatedConnectionCount).toBe(1);

    await manager.disconnectTenant("t1");
    expect(manager.dedicatedConnectionCount).toBe(0);
  });

  it("throws when Key Vault secret is not found", async () => {
    mockResolveSecret.mockResolvedValue(undefined);

    await expect(
      manager.getClient({ tenantId: "no-secret", tier: "dedicated" }),
    ).rejects.toThrow("Cannot resolve database connection");
  });

  it("disconnectAll() disconnects shared and dedicated clients", async () => {
    await manager.disconnectAll();
    expect((sharedClient.$disconnect as any)).toHaveBeenCalled();
  });

  it("starts with zero dedicated connections", () => {
    expect(manager.dedicatedConnectionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. PrismaAdapter — entity name to model name conversion
// ---------------------------------------------------------------------------

describe("PrismaAdapter", () => {
  it("converts PascalCase entity name to camelCase model name", () => {
    const delegate = mockPrismaDelegate();
    const prisma = mockPrismaClient({ employee: delegate });
    const adapter = new PrismaAdapter(prisma);

    const repo = adapter.createRepository({ entityName: "Employee" });
    expect(repo).toBeInstanceOf(PrismaRepository);
  });

  it("throws for empty entity name", () => {
    const prisma = mockPrismaClient();
    const adapter = new PrismaAdapter(prisma);

    expect(() => adapter.createRepository({ entityName: "" })).toThrow(
      "entityName is required",
    );
  });

  it("supports transactions, batch, softDelete", () => {
    const prisma = mockPrismaClient();
    const adapter = new PrismaAdapter(prisma);

    expect(adapter.supports("transactions")).toBe(true);
    expect(adapter.supports("batch")).toBe(true);
    expect(adapter.supports("blobStorage")).toBe(false);
  });

  it("storeType is 'sql'", () => {
    const prisma = mockPrismaClient();
    const adapter = new PrismaAdapter(prisma);
    expect(adapter.storeType).toBe("sql");
  });
});

// ---------------------------------------------------------------------------
// 9. Repository isolation — services use interface, not concrete
// ---------------------------------------------------------------------------

describe("Repository isolation", () => {
  it("PrismaRepository satisfies IRepository interface", () => {
    const delegate = mockPrismaDelegate();
    const prisma = mockPrismaClient({ employee: delegate });
    const repo: IRepository<{ id: string }> = new PrismaRepository(prisma, "employee");

    // Type-level check — if this compiles, the interface is satisfied
    expect(repo.create).toBeDefined();
    expect(repo.findById).toBeDefined();
    expect(repo.findMany).toBeDefined();
    expect(repo.findUnique).toBeDefined();
    expect(repo.update).toBeDefined();
    expect(repo.delete).toBeDefined();
    expect(repo.createMany).toBeDefined();
    expect(repo.updateMany).toBeDefined();
    expect(repo.deleteMany).toBeDefined();
    expect(repo.count).toBeDefined();
    expect(repo.beginTransaction).toBeDefined();
    expect(repo.getSchema).toBeDefined();
    expect(repo.supports).toBeDefined();
  });

  it("PrismaAuditLogRepository satisfies IAuditLogRepository interface", () => {
    const prisma = mockPrismaClient({ auditLog: mockPrismaDelegate() });
    const repo: IAuditLogRepository = new PrismaAuditLogRepository(prisma);

    expect(repo.append).toBeDefined();
    expect(repo.queryByResource).toBeDefined();
    expect(repo.queryByActor).toBeDefined();
    // Also has IRepository methods
    expect(repo.create).toBeDefined();
    expect(repo.findById).toBeDefined();
  });

  it("InMemoryCacheRepository satisfies ICacheRepository interface", () => {
    const cache: ICacheRepository = new InMemoryCacheRepository();

    expect(cache.get).toBeDefined();
    expect(cache.set).toBeDefined();
    expect(cache.del).toBeDefined();
    expect(cache.delByPattern).toBeDefined();
    expect(cache.keys).toBeDefined();
    expect(cache.has).toBeDefined();
    expect(cache.flush).toBeDefined();
  });
});
