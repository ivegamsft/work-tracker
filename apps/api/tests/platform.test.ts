import request from "supertest";
import { Roles } from "@e-clat/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { createPlatformRouter } from "../src/modules/platform";
import type { FeatureFlagService } from "../src/services/feature-flags";

// Mock the database for health-check tests so we don't need a real Postgres
vi.mock("../src/config/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/config/database")>();
  return {
    ...original,
    prisma: {
      ...original.prisma,
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $on: vi.fn(),
    },
    disconnectDatabase: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Platform feature flags endpoint", () => {
  it("requires authentication", async () => {
    const response = await request(createTestApp()).get("/api/v1/platform/feature-flags");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns only client-visible flags for authenticated users", async () => {
    const response = await request(createTestApp())
      .get("/api/v1/platform/feature-flags")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=300");
    expect(response.body).toEqual({
      "records.hours-ui": false,
      "reference.labels-admin": false,
      "compliance.templates": false,
      "web.team-subnav": false,
    });
    expect(response.body).not.toHaveProperty("notifications.escalation-rules");
  });

  it("builds the resolution context from the authenticated user", async () => {
    const getClientFlags = vi.fn().mockReturnValue({ "records.hours-ui": true });
    const featureFlags: FeatureFlagService = {
      isEnabled: vi.fn().mockReturnValue(true),
      requireEnabled: vi.fn(),
      getClientFlags,
    };

    const app = createTestApp({
      registerRoutes(expressApp) {
        expressApp.use(
          "/test-platform",
          createPlatformRouter({
            featureFlags,
            resolveEnvironment: () => "staging",
          }),
        );
      },
    });

    const response = await request(app)
      .get("/test-platform/feature-flags")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ "records.hours-ui": true });
    expect(getClientFlags).toHaveBeenCalledWith({
      userId: seededTestUsers.manager.id,
      email: seededTestUsers.manager.email,
      role: Roles.MANAGER,
      environment: "staging",
    });
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #121 — Correlation ID middleware
// ──────────────────────────────────────────────────────────────
describe("Correlation ID middleware", () => {
  it("generates a correlation ID when none is provided", async () => {
    const res = await request(createTestApp()).get("/api/v1/platform/health");
    expect(res.headers["x-correlation-id"]).toBeDefined();
    expect(res.headers["x-correlation-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("propagates a caller-supplied correlation ID", async () => {
    const customId = "my-custom-correlation-id-12345";
    const res = await request(createTestApp())
      .get("/api/v1/platform/health")
      .set("x-correlation-id", customId);
    expect(res.headers["x-correlation-id"]).toBe(customId);
  });

  it("synthesises W3C traceparent when none is provided", async () => {
    const res = await request(createTestApp()).get("/api/v1/platform/health");
    expect(res.headers.traceparent).toBeDefined();
    expect(res.headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #121 — GET /api/v1/platform/health (liveness)
// ──────────────────────────────────────────────────────────────
describe("GET /api/v1/platform/health (liveness)", () => {
  it("returns 200 with UP status", async () => {
    const res = await request(createTestApp()).get("/api/v1/platform/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #121 — GET /api/v1/platform/ready (readiness)
// ──────────────────────────────────────────────────────────────
describe("GET /api/v1/platform/ready (readiness)", () => {
  it("returns READY when all dependencies are healthy", async () => {
    const res = await request(createTestApp()).get("/api/v1/platform/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("READY");
    expect(res.body.checks).toEqual({
      database: "OK",
      cache: "OK",
      auth: "OK",
    });
  });

  it("returns 503 NOT_READY when database is unavailable", async () => {
    const db = await import("../src/config/database");
    vi.mocked(db.prisma.$queryRaw).mockRejectedValueOnce(new Error("Connection refused"));

    const res = await request(createTestApp()).get("/api/v1/platform/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("NOT_READY");
    expect(res.body.checks.database).toBe("FAILED");
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #127 — GET /api/v1/platform/detailed-health
// ──────────────────────────────────────────────────────────────
describe("GET /api/v1/platform/detailed-health", () => {
  it("returns detailed health with dependency latencies", async () => {
    const res = await request(createTestApp()).get("/api/v1/platform/detailed-health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
    expect(res.body.version).toBeDefined();
    expect(res.body.environment).toBeDefined();
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.dependencies.database).toMatchObject({
      status: "OK",
      latency_ms: expect.any(Number),
    });
    expect(res.body.dependencies.cache).toMatchObject({ status: "OK" });
    expect(res.body.dependencies.auth).toMatchObject({ status: "OK" });
  });

  it("returns DEGRADED when one dependency fails", async () => {
    const db = await import("../src/config/database");
    vi.mocked(db.prisma.$queryRaw).mockRejectedValueOnce(new Error("timeout"));

    const res = await request(createTestApp()).get("/api/v1/platform/detailed-health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DEGRADED");
    expect(res.body.dependencies.database.status).toBe("FAILED");
    expect(res.body.dependencies.cache.status).toBe("OK");
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #126 — Request logger middleware (structured logging)
// ──────────────────────────────────────────────────────────────
describe("Request logger middleware", () => {
  it("logs request with correlation ID on every response", async () => {
    const { logger } = await import("../src/common/utils/logger");
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await request(createTestApp()).get("/api/v1/platform/health");

    const logCall = infoSpy.mock.calls.find(
      ([msg]) => msg === "request completed",
    );
    expect(logCall).toBeDefined();
    const logData = logCall![1] as Record<string, unknown>;
    expect(logData.correlationId).toBeDefined();
    expect(logData.method).toBe("GET");
    expect(logData.status).toBe(200);
    expect(typeof logData.durationMs).toBe("number");
  });
});

// ──────────────────────────────────────────────────────────────
// Issue #121 — OTel telemetry config
// ──────────────────────────────────────────────────────────────
describe("Telemetry config", () => {
  it("exports initTelemetry and shutdownTelemetry", async () => {
    const telemetry = await import("../src/config/telemetry");
    expect(typeof telemetry.initTelemetry).toBe("function");
    expect(typeof telemetry.shutdownTelemetry).toBe("function");
    expect(typeof telemetry.getMeter).toBe("function");
    expect(typeof telemetry.getUptimeSeconds).toBe("function");
  });

  it("getUptimeSeconds returns a non-negative integer", async () => {
    const { getUptimeSeconds } = await import("../src/config/telemetry");
    const uptime = getUptimeSeconds();
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(uptime)).toBe(true);
  });

  it("getMeter returns a valid OTel Meter", async () => {
    const { getMeter } = await import("../src/config/telemetry");
    const meter = getMeter("test-meter");
    expect(meter).toBeDefined();
    expect(typeof meter.createCounter).toBe("function");
    expect(typeof meter.createHistogram).toBe("function");
  });
});

// ──────────────────────────────────────────────────────────────
// Platform service unit tests
// ──────────────────────────────────────────────────────────────
describe("Platform service", () => {
  it("checkDependencies returns status for all three dependencies", async () => {
    const { checkDependencies } = await import("../src/modules/platform/service");
    const result = await checkDependencies();
    expect(result).toHaveProperty("database");
    expect(result).toHaveProperty("cache");
    expect(result).toHaveProperty("auth");
    expect(result.database.status).toBe("OK");
  });

  it("allHealthy returns true when all dependencies pass", async () => {
    const { allHealthy } = await import("../src/modules/platform/service");
    expect(
      allHealthy({
        database: { status: "OK", latency_ms: 1 },
        cache: { status: "OK", latency_ms: 0 },
        auth: { status: "OK", latency_ms: 0 },
      }),
    ).toBe(true);
  });

  it("allHealthy returns false when any dependency fails", async () => {
    const { allHealthy } = await import("../src/modules/platform/service");
    expect(
      allHealthy({
        database: { status: "FAILED", latency_ms: 5000 },
        cache: { status: "OK", latency_ms: 0 },
        auth: { status: "OK", latency_ms: 0 },
      }),
    ).toBe(false);
  });

  it("overallStatus returns DEGRADED when some deps fail", async () => {
    const { overallStatus } = await import("../src/modules/platform/service");
    expect(
      overallStatus({
        database: { status: "FAILED", latency_ms: 5000 },
        cache: { status: "OK", latency_ms: 0 },
        auth: { status: "OK", latency_ms: 0 },
      }),
    ).toBe("DEGRADED");
  });

  it("overallStatus returns DOWN when all deps fail", async () => {
    const { overallStatus } = await import("../src/modules/platform/service");
    expect(
      overallStatus({
        database: { status: "FAILED", latency_ms: 0 },
        cache: { status: "FAILED", latency_ms: 0 },
        auth: { status: "FAILED", latency_ms: 0 },
      }),
    ).toBe("DOWN");
  });
});
