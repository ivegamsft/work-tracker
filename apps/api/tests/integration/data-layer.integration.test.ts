/**
 * Data Layer & Repository Pattern — Integration Tests
 *
 * Contract tests for the Foundation Sprint repository abstraction.
 * Spec: docs/specs/data-layer-api.md
 *
 * These tests define the contract that the repository interfaces and
 * storage resolver must satisfy. External dependencies (Prisma, Redis,
 * Cosmos) are mocked — these are contract/interface tests, not DB tests.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Inline type stubs for interfaces that will be defined in
// packages/shared/src/repositories/IRepository.ts once Bunk implements them.
//
// These mirror the spec exactly (§3.1) so that once the real types ship,
// the tests import from @e-clat/shared and these stubs are removed.
// ═══════════════════════════════════════════════════════════════════════════

interface IRepository<T> {
  create(data: T, metadata?: Record<string, unknown>): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>, metadata?: Record<string, unknown>): Promise<T>;
  delete(id: string, soft?: boolean): Promise<void>;
  createMany(data: T[]): Promise<T[]>;
  updateMany(ids: string[], data: Partial<T>): Promise<T[]>;
  deleteMany(ids: string[], soft?: boolean): Promise<void>;
  find(filter: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;
  findOne(filter: Record<string, unknown>): Promise<T | null>;
  count(filter: Record<string, unknown>): Promise<number>;
  beginTransaction(): Promise<ITransaction>;
  getSchema(): RepositorySchema;
  supports(capability: string): boolean;
}

interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name: string): Promise<void>;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: Record<string, "asc" | "desc">;
  include?: string[];
}

interface RepositorySchema {
  name: string;
  fields: Record<string, { type: string; nullable: boolean; unique: boolean }>;
}

// ---------------------------------------------------------------------------
// Mock factory — creates a full IRepository<T> backed by an in-memory Map
// ---------------------------------------------------------------------------

function createMockRepository<T extends { id: string; tenantId?: string }>(
  schemaName: string,
): IRepository<T> {
  const store = new Map<string, T>();

  return {
    async create(data: T) {
      store.set(data.id, data);
      return data;
    },
    async read(id: string) {
      return store.get(id) ?? null;
    },
    async update(id: string, partial: Partial<T>) {
      const existing = store.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      const updated = { ...existing, ...partial } as T;
      store.set(id, updated);
      return updated;
    },
    async delete(id: string, _soft?: boolean) {
      store.delete(id);
    },
    async createMany(items: T[]) {
      for (const item of items) store.set(item.id, item);
      return items;
    },
    async updateMany(ids: string[], partial: Partial<T>) {
      return ids.map((id) => {
        const existing = store.get(id);
        if (!existing) throw new Error(`Not found: ${id}`);
        const updated = { ...existing, ...partial } as T;
        store.set(id, updated);
        return updated;
      });
    },
    async deleteMany(ids: string[], _soft?: boolean) {
      for (const id of ids) store.delete(id);
    },
    async find(filter: Record<string, unknown>, options?: QueryOptions) {
      let results = [...store.values()].filter((item) =>
        Object.entries(filter).every(
          ([key, value]) => (item as Record<string, unknown>)[key] === value,
        ),
      );
      if (options?.limit) results = results.slice(0, options.limit);
      return results;
    },
    async findOne(filter: Record<string, unknown>) {
      return (
        [...store.values()].find((item) =>
          Object.entries(filter).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value,
          ),
        ) ?? null
      );
    },
    async count(filter: Record<string, unknown>) {
      return [...store.values()].filter((item) =>
        Object.entries(filter).every(
          ([key, value]) => (item as Record<string, unknown>)[key] === value,
        ),
      ).length;
    },
    async beginTransaction(): Promise<ITransaction> {
      return {
        async commit() {},
        async rollback() {},
        async savepoint(_name: string) {},
      };
    },
    getSchema(): RepositorySchema {
      return {
        name: schemaName,
        fields: {
          id: { type: "string", nullable: false, unique: true },
          tenantId: { type: "string", nullable: false, unique: false },
        },
      };
    },
    supports(capability: string) {
      return ["crud", "transactions", "softDelete"].includes(capability);
    },
  };
}

// ---------------------------------------------------------------------------
// Lightweight tenant context stub (spec §5: StorageResolver)
// ---------------------------------------------------------------------------

type StorageResolverFn = <T extends { id: string; tenantId?: string }>(
  tenantId: string,
  entityType: string,
) => IRepository<T>;

function createMockStorageResolver(): {
  resolver: StorageResolverFn;
  repos: Map<string, IRepository<unknown>>;
} {
  const repos = new Map<string, IRepository<unknown>>();

  const resolver: StorageResolverFn = <T extends { id: string; tenantId?: string }>(
    tenantId: string,
    entityType: string,
  ): IRepository<T> => {
    const key = `${tenantId}:${entityType}`;
    if (!repos.has(key)) {
      repos.set(key, createMockRepository<T>(entityType));
    }
    return repos.get(key) as IRepository<T>;
  };

  return { resolver, repos };
}

// ---------------------------------------------------------------------------
// Test entity type
// ---------------------------------------------------------------------------

interface TestEntity {
  id: string;
  tenantId: string;
  name: string;
  status: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Repository pattern — interface contract", () => {
  let repo: IRepository<TestEntity>;

  beforeEach(() => {
    repo = createMockRepository<TestEntity>("TestEntity");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1 — Repository factory creates correct implementation
  //     Spec §5: StorageResolver.getRepositoryFor returns typed repo
  // -----------------------------------------------------------------------

  describe("Repository factory", () => {
    it("creates a repository for a given entity type", () => {
      expect(repo).toBeDefined();
      expect(typeof repo.create).toBe("function");
      expect(typeof repo.read).toBe("function");
      expect(typeof repo.update).toBe("function");
      expect(typeof repo.delete).toBe("function");
    });

    it("schema name matches the requested entity type", () => {
      const schema = repo.getSchema();
      expect(schema.name).toBe("TestEntity");
      expect(schema.fields).toHaveProperty("id");
    });

    it("reports supported capabilities", () => {
      expect(repo.supports("crud")).toBe(true);
      expect(repo.supports("transactions")).toBe(true);
      expect(repo.supports("graphQL")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 2 — CRUD operations through repository interface
  //     Spec §3.1: create, read, update, delete, find, findOne, count
  // -----------------------------------------------------------------------

  describe("CRUD operations", () => {
    const tenantId = randomUUID();

    it("create → read round-trip", async () => {
      const entity: TestEntity = {
        id: randomUUID(),
        tenantId,
        name: "Widget A",
        status: "active",
      };

      const created = await repo.create(entity);
      expect(created.id).toBe(entity.id);

      const fetched = await repo.read(entity.id);
      expect(fetched).toEqual(entity);
    });

    it("read returns null for non-existent ID", async () => {
      const result = await repo.read(randomUUID());
      expect(result).toBeNull();
    });

    it("update modifies fields and returns updated entity", async () => {
      const entity: TestEntity = {
        id: randomUUID(),
        tenantId,
        name: "Original",
        status: "active",
      };
      await repo.create(entity);

      const updated = await repo.update(entity.id, { name: "Updated" });
      expect(updated.name).toBe("Updated");
      expect(updated.status).toBe("active"); // unchanged

      const fetched = await repo.read(entity.id);
      expect(fetched?.name).toBe("Updated");
    });

    it("delete removes entity from store", async () => {
      const entity: TestEntity = {
        id: randomUUID(),
        tenantId,
        name: "To Delete",
        status: "active",
      };
      await repo.create(entity);
      await repo.delete(entity.id);

      const result = await repo.read(entity.id);
      expect(result).toBeNull();
    });

    it("createMany inserts batch of entities", async () => {
      const entities = Array.from({ length: 5 }, (_, i) => ({
        id: randomUUID(),
        tenantId,
        name: `Batch ${i}`,
        status: "active",
      }));

      const created = await repo.createMany(entities);
      expect(created).toHaveLength(5);

      const count = await repo.count({ tenantId });
      expect(count).toBe(5);
    });

    it("find with filter returns matching entities", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      await repo.create({ id: id1, tenantId, name: "Active", status: "active" });
      await repo.create({ id: id2, tenantId, name: "Inactive", status: "inactive" });

      const active = await repo.find({ status: "active" });
      expect(active.every((e) => e.status === "active")).toBe(true);
    });

    it("find with limit caps results", async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: randomUUID(),
        tenantId,
        name: `Item ${i}`,
        status: "active",
      }));
      await repo.createMany(items);

      const limited = await repo.find({ status: "active" }, { limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });

    it("findOne returns first matching entity or null", async () => {
      await repo.create({ id: randomUUID(), tenantId, name: "Unique", status: "active" });

      const found = await repo.findOne({ name: "Unique" });
      expect(found?.name).toBe("Unique");

      const notFound = await repo.findOne({ name: "No Such Thing" });
      expect(notFound).toBeNull();
    });

    it("count returns number of matching entities", async () => {
      await repo.create({ id: randomUUID(), tenantId, name: "A", status: "active" });
      await repo.create({ id: randomUUID(), tenantId, name: "B", status: "inactive" });

      expect(await repo.count({ status: "active" })).toBe(1);
      expect(await repo.count({})).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // 3 — Transaction interface
  //     Spec §3.1: beginTransaction → commit / rollback / savepoint
  // -----------------------------------------------------------------------

  describe("Transaction interface", () => {
    it("beginTransaction returns ITransaction with commit/rollback", async () => {
      const tx = await repo.beginTransaction();

      expect(typeof tx.commit).toBe("function");
      expect(typeof tx.rollback).toBe("function");
      expect(typeof tx.savepoint).toBe("function");
    });

    it("commit completes without error", async () => {
      const tx = await repo.beginTransaction();
      await expect(tx.commit()).resolves.toBeUndefined();
    });

    it("rollback completes without error", async () => {
      const tx = await repo.beginTransaction();
      await expect(tx.rollback()).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 4 — Tenant context & isolation
//     Spec §5: StorageResolver routes to correct connection per tenant
// ---------------------------------------------------------------------------

describe("Tenant-aware storage resolver", () => {
  let resolver: StorageResolverFn;

  beforeEach(() => {
    ({ resolver } = createMockStorageResolver());
  });

  it("resolves a repository for a given tenant + entity type", () => {
    const tenantA = randomUUID();
    const repo = resolver<TestEntity>(tenantA, "TestEntity");
    expect(repo).toBeDefined();
    expect(typeof repo.create).toBe("function");
  });

  it("returns the same repository instance for same tenant+entity", () => {
    const tenantA = randomUUID();
    const repo1 = resolver<TestEntity>(tenantA, "TestEntity");
    const repo2 = resolver<TestEntity>(tenantA, "TestEntity");
    expect(repo1).toBe(repo2);
  });

  it("returns different repositories for different tenants", () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const repoA = resolver<TestEntity>(tenantA, "TestEntity");
    const repoB = resolver<TestEntity>(tenantB, "TestEntity");
    expect(repoA).not.toBe(repoB);
  });

  it("tenant isolation: one tenant cannot see another's data", async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    const repoA = resolver<TestEntity>(tenantA, "TestEntity");
    const repoB = resolver<TestEntity>(tenantB, "TestEntity");

    await repoA.create({
      id: randomUUID(),
      tenantId: tenantA,
      name: "Tenant A Secret",
      status: "active",
    });

    await repoB.create({
      id: randomUUID(),
      tenantId: tenantB,
      name: "Tenant B Secret",
      status: "active",
    });

    // Tenant B's repo should never return Tenant A's data
    const bResults = await repoB.find({});
    expect(bResults.every((e) => e.tenantId === tenantB)).toBe(true);
    expect(bResults.some((e) => e.name === "Tenant A Secret")).toBe(false);

    // And vice versa
    const aResults = await repoA.find({});
    expect(aResults.every((e) => e.tenantId === tenantA)).toBe(true);
    expect(aResults.some((e) => e.name === "Tenant B Secret")).toBe(false);
  });

  it("returns different repositories for different entity types", () => {
    const tenantA = randomUUID();
    const templateRepo = resolver<TestEntity>(tenantA, "ProofTemplate");
    const docRepo = resolver<TestEntity>(tenantA, "Document");
    expect(templateRepo).not.toBe(docRepo);
  });
});
