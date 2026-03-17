# Data Layer Foundation — Decisions

**Author:** Daniels (Microservices Engineer)
**Date:** 2026-03-17
**Issues:** #181, #183
**Status:** Implemented

---

## Decision: Repository Interfaces Live in `packages/shared`

**Context:** The repository interfaces (`IRepository<T>`, `IAuditLogRepository`, `ICacheRepository`, `IDocumentRepository`) need to be importable by both the API and future service extractions.

**Decision:** All repository interfaces and the `RepositoryFactory` class are defined in `packages/shared/src/repositories/`. Concrete implementations (PrismaRepository, InMemoryCacheRepository, etc.) live in `apps/api/src/common/data/`.

**Rationale:** When services are extracted (per Decision #3 — Modular Monolith), they can depend on `@e-clat/shared` for the interfaces and bring their own implementations. This keeps the shared package lightweight (interfaces + factory only) while allowing implementation-specific code to stay in the API workspace.

---

## Decision: Filter Operators Map 1:1 to Prisma Query Syntax

**Context:** `IRepository<T>.findMany()` accepts a `Filter<T>` object with operators like `$in`, `$gt`, `$like`. These need to translate to the backing store's query language.

**Decision:** The PrismaRepository translates filter operators as:
- `$in` → `{ in: [...] }`
- `$gt/$gte/$lt/$lte` → `{ gt/gte/lt/lte: value }`
- `$ne` → `{ not: value }`
- `$like` → `{ contains: value, mode: "insensitive" }`
- `$or` → `{ OR: [...] }`
- `$and` → `{ AND: [...] }`

**Rationale:** This operator set covers 95%+ of existing E-CLAT queries while remaining store-agnostic. When Cosmos or other adapters are added, they'll translate the same operators to their native syntax.

---

## Decision: Audit Repository Enforces Immutability at Interface Level

**Context:** Compliance requires audit logs to be append-only. The `IAuditLogRepository` extends `IRepository<AuditEntry>`, which includes `update()` and `delete()` methods.

**Decision:** `PrismaAuditLogRepository.update()` and `delete()` (and their batch variants) throw unconditionally with "Audit logs are immutable" errors. The `append()` method is the canonical way to create entries.

**Rationale:** Rather than creating a separate interface without update/delete, we keep the type hierarchy consistent (IAuditLogRepository extends IRepository) and enforce immutability at runtime. This means services can still receive an `IRepository<AuditEntry>` without knowing it's append-only — but any attempt to mutate will fail loudly.

---

## Decision: In-Memory Cache as MVP; Redis Adapter Deferred

**Context:** The spec calls for Redis-backed caching, but the Redis infrastructure is not yet provisioned.

**Decision:** Ship `InMemoryCacheRepository` as the default `ICacheRepository` implementation. It supports the full interface (get, set, del, TTL, pattern matching, flush). Redis adapter will be added when the infrastructure layer provides a Redis instance.

**Rationale:** This unblocks service development immediately. Services code against `ICacheRepository` and won't need any changes when Redis is swapped in. The in-memory implementation is also ideal for unit testing.

---

## Decision: Tenant Resolution Priority — JWT > Header > Default

**Context:** Multi-tenant requests need a tenant identifier to route to the correct database connection.

**Decision:** The `TenantResolver` extracts tenant ID in this priority order:
1. JWT claim `tenant_id` (from authenticated user)
2. Request header `X-Tenant-ID` (for service-to-service or API testing)
3. `DEFAULT_TENANT_ID` ("default") — single-tenant fallback

**Rationale:** JWT is the most secure source (signed, verified). Header fallback enables service-to-service calls and testing scenarios. Default ensures backward compatibility for the current single-tenant MVP.

---

## Decision: ConnectionManager Uses Constructor Injection for Secret Resolution

**Context:** The `ConnectionManager` needs to resolve connection strings from Key Vault for dedicated-tier tenants. Directly importing `getKeyVaultSecret` makes the class hard to test.

**Decision:** `ConnectionManager` accepts an optional `resolveSecret` function in its constructor options. Production wires in the Key Vault resolver; tests inject a mock.

**Rationale:** Constructor injection enables pure unit testing without module mocking complexity (vi.doMock). It also makes the class portable for future environments where secrets may come from a different source (e.g., environment variables, HashiCorp Vault).
