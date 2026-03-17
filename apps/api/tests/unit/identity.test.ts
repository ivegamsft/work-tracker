import request from "supertest";
import { Roles } from "@e-clat/shared";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTestApp, generateTestToken } from "../helpers";
import { normalizeClaims, WELL_KNOWN_MAPPINGS } from "../../src/common/auth/claimsNormalizer";
import { JwksCache } from "../../src/common/auth/jwksCache";
import { getStrategy, registerStrategy, type TokenValidationStrategy } from "../../src/common/auth/tokenValidator";
import * as db from "../../src/config/database";

// ─── Mock Prisma ────────────────────────────────────────

vi.mock("../../src/config/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/config/database")>();
  return {
    ...original,
    prisma: {
      ...original.prisma,
      identityProvider: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $on: vi.fn(),
    },
    disconnectDatabase: vi.fn(),
  };
});

const mockIdentityProvider = vi.mocked(db.prisma.identityProvider as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
});

// ─── Helpers ────────────────────────────────────────────

function buildProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Test OIDC Provider",
    type: "OIDC",
    issuer: "https://login.example.com/v2.0",
    jwksUri: "https://login.example.com/.well-known/jwks.json",
    clientId: "client-id-123",
    clientSecret: "client-secret-456",
    scopes: ["openid", "profile", "email"],
    claimsMapping: { email: "email", sub: "oid" },
    enabled: true,
    deletedAt: null,
    jwksCachedAt: null,
    lastTestAt: null,
    lastTestStatus: null,
    createdAt: new Date("2026-03-21T10:00:00Z"),
    updatedAt: new Date("2026-03-21T10:00:00Z"),
    ...overrides,
  };
}

// ─── Provider CRUD Tests ────────────────────────────────

describe("Identity Provider CRUD", () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/providers", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .send({ name: "Test", type: "oidc", issuer: "https://test.com" });

      expect(response.status).toBe(401);
    });

    it("requires ADMIN role", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`)
        .send({ name: "Test", type: "oidc", issuer: "https://test.com" });

      expect(response.status).toBe(403);
    });

    it("creates a provider with valid input", async () => {
      const provider = buildProvider();
      mockIdentityProvider.findFirst.mockResolvedValue(null);
      mockIdentityProvider.create.mockResolvedValue(provider);

      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({
          name: "Test OIDC Provider",
          type: "oidc",
          issuer: "https://login.example.com/v2.0",
          jwks_uri: "https://login.example.com/.well-known/jwks.json",
          client_id: "client-id-123",
          client_secret: "client-secret-456",
          claims_mapping: { email: "email", sub: "oid" },
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Test OIDC Provider");
      expect(response.body.type).toBe("oidc");
      expect(response.body.issuer).toBe("https://login.example.com/v2.0");
    });

    it("rejects duplicate provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(buildProvider());

      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({
          name: "Duplicate",
          type: "oidc",
          issuer: "https://login.example.com/v2.0",
        });

      expect(response.status).toBe(409);
    });

    it("validates required fields", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("validates issuer is a URL", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({ name: "Test", type: "oidc", issuer: "not-a-url" });

      expect(response.status).toBe(400);
    });

    it("validates provider type enum", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({ name: "Test", type: "invalid_type", issuer: "https://test.com" });

      expect(response.status).toBe(400);
    });

    it("rejects COMPLIANCE_OFFICER role", async () => {
      const response = await request(app)
        .post("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.COMPLIANCE_OFFICER)}`)
        .send({ name: "Test", type: "oidc", issuer: "https://test.com" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/auth/providers", () => {
    it("requires authentication", async () => {
      const response = await request(app).get("/api/v1/auth/providers");
      expect(response.status).toBe(401);
    });

    it("requires COMPLIANCE_OFFICER or above", async () => {
      const response = await request(app)
        .get("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

      expect(response.status).toBe(403);
    });

    it("returns active providers for COMPLIANCE_OFFICER", async () => {
      mockIdentityProvider.findMany.mockResolvedValue([buildProvider()]);

      const response = await request(app)
        .get("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.COMPLIANCE_OFFICER)}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe("oidc");
    });

    it("returns active providers for ADMIN", async () => {
      mockIdentityProvider.findMany.mockResolvedValue([
        buildProvider(),
        buildProvider({ id: "b1ffcd00-ad1c-5fa9-cc7e-7cc0ce491b22", name: "Okta", type: "OIDC" }),
      ]);

      const response = await request(app)
        .get("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it("returns empty array when no providers configured", async () => {
      mockIdentityProvider.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/auth/providers")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("GET /api/v1/auth/providers/:id", () => {
    it("returns a single provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(buildProvider());

      const response = await request(app)
        .get("/api/v1/auth/providers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    });

    it("returns 404 for non-existent provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/auth/providers/c2aade11-be2d-4fab-9d8f-8dd1df502c33")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(404);
    });

    it("rejects invalid UUID", async () => {
      const response = await request(app)
        .get("/api/v1/auth/providers/not-a-uuid")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/auth/providers/:id", () => {
    it("requires ADMIN role", async () => {
      const response = await request(app)
        .put("/api/v1/auth/providers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        .set("Authorization", `Bearer ${generateTestToken(Roles.COMPLIANCE_OFFICER)}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(403);
    });

    it("updates provider fields", async () => {
      const existing = buildProvider();
      const updated = buildProvider({ name: "Updated Provider" });
      mockIdentityProvider.findFirst.mockResolvedValue(existing);
      mockIdentityProvider.update.mockResolvedValue(updated);

      const response = await request(app)
        .put("/api/v1/auth/providers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({ name: "Updated Provider" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Provider");
    });

    it("returns 404 for non-existent provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/v1/auth/providers/c2aade11-be2d-4fab-9d8f-8dd1df502c33")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/auth/providers/:id", () => {
    it("requires ADMIN role", async () => {
      const response = await request(app)
        .delete("/api/v1/auth/providers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

      expect(response.status).toBe(403);
    });

    it("soft-deletes a provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(buildProvider());
      mockIdentityProvider.update.mockResolvedValue(buildProvider({ deletedAt: new Date(), enabled: false }));

      const response = await request(app)
        .delete("/api/v1/auth/providers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(204);
      expect(mockIdentityProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
          data: expect.objectContaining({ deletedAt: expect.any(Date), enabled: false }),
        }),
      );
    });

    it("returns 404 for already-deleted provider", async () => {
      mockIdentityProvider.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/auth/providers/c2aade11-be2d-4fab-9d8f-8dd1df502c33")
        .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`);

      expect(response.status).toBe(404);
    });
  });
});

// ─── Claims Normalizer Tests ────────────────────────────

describe("Claims Normalizer", () => {
  it("maps claims using provider-specific mapping", () => {
    const raw = { oid: "user-123", email: "john@example.com", given_name: "John", family_name: "Doe" };
    const mapping = WELL_KNOWN_MAPPINGS.entra;

    const result = normalizeClaims(raw, mapping);

    expect(result.sub).toBe("user-123");
    expect(result.email).toBe("john@example.com");
    expect(result.given_name).toBe("John");
    expect(result.family_name).toBe("Doe");
  });

  it("handles Okta claims mapping", () => {
    const raw = { sub: "okta-user-456", email: "alice@company.com", groups: ["admins", "engineers"] };
    const mapping = WELL_KNOWN_MAPPINGS.okta;

    const result = normalizeClaims(raw, mapping);

    expect(result.sub).toBe("okta-user-456");
    expect(result.email).toBe("alice@company.com");
    expect(result.groups).toEqual(["admins", "engineers"]);
  });

  it("handles Auth0 claims mapping", () => {
    const raw = { sub: "auth0|789", email: "bob@org.io", name: "Bob Smith" };
    const mapping = WELL_KNOWN_MAPPINGS.auth0;

    const result = normalizeClaims(raw, mapping);

    expect(result.sub).toBe("auth0|789");
    expect(result.email).toBe("bob@org.io");
    expect(result.name).toBe("Bob Smith");
  });

  it("falls back to standard claims when mapping is empty", () => {
    const raw = { sub: "fallback-user", email: "fallback@test.com" };

    const result = normalizeClaims(raw, {});

    expect(result.sub).toBe("fallback-user");
    expect(result.email).toBe("fallback@test.com");
  });

  it("handles UPN fallback for email", () => {
    const raw = { sub: "user-1", upn: "user@domain.com" };

    const result = normalizeClaims(raw, {});

    expect(result.email).toBe("user@domain.com");
  });

  it("handles preferred_username fallback for email", () => {
    const raw = { sub: "user-2", preferred_username: "user@sso.com" };

    const result = normalizeClaims(raw, {});

    expect(result.email).toBe("user@sso.com");
  });

  it("normalizes single string role to array", () => {
    const raw = { sub: "u1", email: "e@e.com", roles: "ADMIN" };

    const result = normalizeClaims(raw, {});

    expect(result.roles).toEqual(["ADMIN"]);
  });

  it("handles missing optional fields", () => {
    const raw = { sub: "u1", email: "e@e.com" };

    const result = normalizeClaims(raw, {});

    expect(result.given_name).toBeUndefined();
    expect(result.family_name).toBeUndefined();
    expect(result.roles).toBeUndefined();
    expect(result.groups).toBeUndefined();
  });
});

// ─── JWKS Cache Tests ───────────────────────────────────

describe("JWKS Cache", () => {
  it("caches keys within TTL", async () => {
    const cache = new JwksCache(60000); // 1 min TTL
    const mockKeys = [{ kid: "key-1", kty: "RSA", alg: "RS256" }];

    // Inject keys via the internal cache for unit testing
    const cacheMap = (cache as unknown as { cache: Map<string, { keys: typeof mockKeys; cachedAt: number }> }).cache;
    cacheMap.set("https://example.com/.well-known/jwks.json", {
      keys: mockKeys,
      cachedAt: Date.now(),
    });

    const keys = await cache.getKeys("https://example.com/.well-known/jwks.json");

    expect(keys).toEqual(mockKeys);
    expect(keys).toHaveLength(1);
    expect(keys[0].kid).toBe("key-1");
  });

  it("finds key by kid", () => {
    const cache = new JwksCache();
    const keys = [
      { kid: "key-1", kty: "RSA", alg: "RS256" },
      { kid: "key-2", kty: "RSA", alg: "RS256" },
    ];

    const found = cache.getKeyById(keys, "key-2");
    expect(found?.kid).toBe("key-2");
  });

  it("returns undefined for missing kid", () => {
    const cache = new JwksCache();
    const keys = [{ kid: "key-1", kty: "RSA" }];

    const found = cache.getKeyById(keys, "key-999");
    expect(found).toBeUndefined();
  });

  it("invalidates cache for specific URI", async () => {
    const cache = new JwksCache(60000);
    const uri = "https://example.com/.well-known/jwks.json";
    const cacheMap = (cache as unknown as { cache: Map<string, unknown> }).cache;

    cacheMap.set(uri, { keys: [{ kid: "old", kty: "RSA" }], cachedAt: Date.now() });
    expect(cacheMap.has(uri)).toBe(true);

    cache.invalidate(uri);
    expect(cacheMap.has(uri)).toBe(false);
  });

  it("clears all cached keys", async () => {
    const cache = new JwksCache(60000);
    const cacheMap = (cache as unknown as { cache: Map<string, unknown> }).cache;

    cacheMap.set("uri-1", { keys: [], cachedAt: Date.now() });
    cacheMap.set("uri-2", { keys: [], cachedAt: Date.now() });

    cache.clear();
    expect(cacheMap.size).toBe(0);
  });
});

// ─── Token Validator Strategy Registry Tests ────────────

describe("Token Validator Strategy Registry", () => {
  it("has OIDC strategy registered by default", () => {
    const strategy = getStrategy("oidc");
    expect(strategy).toBeDefined();
    expect(strategy!.type).toBe("oidc");
  });

  it("has local strategy registered by default", () => {
    const strategy = getStrategy("local");
    expect(strategy).toBeDefined();
    expect(strategy!.type).toBe("local");
  });

  it("returns undefined for unknown strategy", () => {
    const strategy = getStrategy("unknown_type");
    expect(strategy).toBeUndefined();
  });

  it("allows registering custom strategies", () => {
    const customStrategy: TokenValidationStrategy = {
      type: "custom_test",
      async validate(_token, _providerConfig) {
        return { valid: true, provider_id: "test" };
      },
    };

    registerStrategy(customStrategy);
    const retrieved = getStrategy("custom_test");

    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe("custom_test");
  });
});

// ─── Token Validation Endpoint Tests ────────────────────

describe("POST /api/v1/auth/validate", () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty token", async () => {
    const response = await request(app)
      .post("/api/v1/auth/validate")
      .send({ token: "" });

    expect(response.status).toBe(400);
  });

  it("returns provider not found when no provider matches issuer", async () => {
    mockIdentityProvider.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/auth/validate")
      .send({
        token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3Qta2V5In0.eyJzdWIiOiJ1c2VyLTEiLCJpc3MiOiJodHRwczovL3Vua25vd24uY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.fake-sig",
        provider_id: "c2aade11-be2d-4fab-9d8f-8dd1df502c33",
      });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.error).toBe("PROVIDER_NOT_FOUND");
  });

  it("validates required token field", async () => {
    const response = await request(app)
      .post("/api/v1/auth/validate")
      .send({});

    expect(response.status).toBe(400);
  });
});
