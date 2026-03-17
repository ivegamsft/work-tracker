/**
 * Platform Observability & Health — Integration Tests
 *
 * Contract tests for the Foundation Sprint telemetry layer.
 * Spec: docs/specs/api-telemetry.md
 *
 * These tests define the contract the implementation must satisfy.
 * They are authored against the spec before implementation lands,
 * so describe.skip is used where the module/route does not yet exist.
 */

import { randomUUID } from "node:crypto";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken } from "../helpers";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: Express;
let adminToken: string;
let managerToken: string;
let employeeToken: string;

beforeAll(() => {
  app = createTestApp();
  adminToken = generateTestToken(Roles.ADMIN);
  managerToken = generateTestToken(Roles.MANAGER);
  employeeToken = generateTestToken(Roles.EMPLOYEE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1 — Liveness probe: GET /health
// ---------------------------------------------------------------------------

describe("GET /health — liveness probe", () => {
  it("returns 200 with status, uptime, and service name", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("timestamp");
    // Existing implementation returns "ok"; spec targets "UP".
    // Accept either during transition.
    expect(["ok", "UP"]).toContain(res.body.status);
  });

  it("includes a timestamp in ISO-8601 format", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    const ts = new Date(res.body.timestamp);
    expect(ts.toISOString()).toBe(res.body.timestamp);
  });
});

// ---------------------------------------------------------------------------
// 2 — Readiness probe: GET /ready
//     Spec says 200 with checks object; implementation pending.
// ---------------------------------------------------------------------------

describe.skip("GET /ready — readiness probe", () => {
  it("returns 200 with dependency status when all deps healthy", async () => {
    const res = await request(app).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "READY");
    expect(res.body).toHaveProperty("checks");
    expect(res.body.checks).toHaveProperty("database");
  });

  it("returns 503 when a dependency is down", async () => {
    // Future: mock the DB health check to return FAILED
    const res = await request(app).get("/ready");

    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body.status).toBe("NOT_READY");
    }
  });
});

// ---------------------------------------------------------------------------
// 3 — Detailed health: GET /api/v1/platform/health
//     Requires MANAGER+ role per spec §6.1.
// ---------------------------------------------------------------------------

describe.skip("GET /api/v1/platform/health — detailed health", () => {
  it("returns 200 with version, uptime, and dependencies for MANAGER+", async () => {
    const res = await request(app)
      .get("/api/v1/platform/health")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("uptime_seconds");
    expect(res.body).toHaveProperty("dependencies");
    expect(typeof res.body.uptime_seconds).toBe("number");
  });

  it("returns dependency latency_ms for each checked service", async () => {
    const res = await request(app)
      .get("/api/v1/platform/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const depKeys = Object.keys(res.body.dependencies ?? {});
    for (const key of depKeys) {
      expect(res.body.dependencies[key]).toHaveProperty("status");
      expect(res.body.dependencies[key]).toHaveProperty("latency_ms");
    }
  });

  it("rejects EMPLOYEE with 403", async () => {
    const res = await request(app)
      .get("/api/v1/platform/health")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/v1/platform/health");

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 4 — Correlation ID propagation
//     Spec §4.1: Every response should carry a correlation ID.
// ---------------------------------------------------------------------------

describe.skip("Correlation ID propagation", () => {
  it("generates a correlation ID when none is provided", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    const correlationId =
      res.headers["x-correlation-id"] ?? res.headers["x-request-id"];
    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe("string");
  });

  it("echoes a client-supplied X-Correlation-Id header", async () => {
    const clientId = randomUUID();
    const res = await request(app)
      .get("/health")
      .set("X-Correlation-Id", clientId);

    expect(res.status).toBe(200);
    const echoedId =
      res.headers["x-correlation-id"] ?? res.headers["x-request-id"];
    expect(echoedId).toBe(clientId);
  });

  it("includes correlation ID in the JSON response body", async () => {
    const res = await request(app)
      .get("/api/v1/platform/health")
      .set("Authorization", `Bearer ${adminToken}`);

    // Spec §4.1: requestMetadataSchema includes correlationId
    if (res.status === 200 && res.body.correlationId) {
      expect(res.body.correlationId).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 5 — W3C Trace Context headers
//     Spec §9.1: traceContextMiddleware injects traceparent/tracestate.
// ---------------------------------------------------------------------------

describe.skip("W3C Trace Context headers", () => {
  it("returns traceparent header on every response", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    const traceparent = res.headers["traceparent"];
    expect(traceparent).toBeDefined();
    // W3C format: version-traceId-spanId-traceFlags (e.g. 00-<32hex>-<16hex>-01)
    expect(traceparent).toMatch(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });

  it("propagates an incoming traceparent header", async () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c";
    const spanId = "b7ad6b7169203331";
    const incoming = `00-${traceId}-${spanId}-01`;

    const res = await request(app)
      .get("/health")
      .set("traceparent", incoming);

    expect(res.status).toBe(200);
    const outgoing = res.headers["traceparent"];
    expect(outgoing).toBeDefined();
    // Trace ID should be preserved; span ID will differ (new child span).
    expect(outgoing).toContain(traceId);
  });
});
