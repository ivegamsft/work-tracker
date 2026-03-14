import { Router } from "express";
import request from "supertest";
import { Roles } from "@e-clat/shared";
import { describe, expect, it, vi } from "vitest";
import { logger } from "../src/common/utils";
import { authenticate } from "../src/middleware";
import { ConsoleAuditLogger, type AuditEntry, type AuditLogger } from "../src/services/audit";
import { createTestApp, generateTestToken } from "./helpers";

function registerAuditTestRoutes(app: ReturnType<typeof createTestApp>) {
  const router = Router();

  router.get("/:id", authenticate, (req, res) => {
    res.json({ id: req.params.id, ok: true });
  });

  router.post("/", authenticate, (req, res) => {
    res.status(201).json({ id: "audit-created", ...req.body });
  });

  router.put("/:id", authenticate, (req, res) => {
    res.json({ id: req.params.id, ...req.body });
  });

  router.patch("/:id", authenticate, (req, res) => {
    res.json({ id: req.params.id, ...req.body });
  });

  router.delete("/:id", authenticate, (_req, res) => {
    res.status(204).send();
  });

  app.use("/api/audit-tests", router);
  app.post("/api/public-actions", (_req, res) => {
    res.status(201).json({ id: "public-action-1" });
  });
  app.post("/api/slow-actions", (_req, res) => {
    res.status(201).json({ id: "slow-action-1" });
  });
}

function createMockAuditLogger() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } satisfies AuditLogger;
}

async function expectSingleAuditEntry(auditLogger: AuditLogger): Promise<AuditEntry> {
  const mockLog = vi.mocked(auditLogger.log);
  await vi.waitFor(() => expect(mockLog).toHaveBeenCalledTimes(1));
  return mockLog.mock.calls[0][0] as AuditEntry;
}

describe("audit middleware", () => {
  it("does not log GET requests", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .get("/api/audit-tests/read-1")
      .set("Authorization", `Bearer ${generateTestToken(Roles.SUPERVISOR)}`);

    expect(response.status).toBe(200);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it("logs POST requests with action, entity type, actor, and response record id", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .post("/api/audit-tests")
      .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
      .send({ status: "active", reason: "create employee", attestation: "approved", password: "super-secret" });

    expect(response.status).toBe(201);

    const entry = await expectSingleAuditEntry(auditLogger);
    expect(entry).toMatchObject({
      action: "POST /api/audit-tests",
      entityType: "audit-tests",
      recordId: "audit-created",
      actor: "admin@test.local",
      reason: "create employee",
      attestation: "approved",
      changedFields: {
        status: "active",
        reason: "create employee",
        attestation: "approved",
        password: "[REDACTED]",
      },
    });
  });

  it("logs PUT requests with the route parameter as record id", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .put("/api/audit-tests/employee-42")
      .set("Authorization", `Bearer ${generateTestToken(Roles.ADMIN)}`)
      .send({ department: "Ops" });

    expect(response.status).toBe(200);

    const entry = await expectSingleAuditEntry(auditLogger);
    expect(entry).toMatchObject({
      action: "PUT /api/audit-tests/:id",
      entityType: "audit-tests",
      recordId: "employee-42",
      actor: "admin@test.local",
    });
  });

  it("logs PATCH requests", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .patch("/api/audit-tests/employee-99")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(200);

    const entry = await expectSingleAuditEntry(auditLogger);
    expect(entry).toMatchObject({
      action: "PATCH /api/audit-tests/:id",
      entityType: "audit-tests",
      recordId: "employee-99",
      actor: "manager@test.local",
    });
  });

  it("logs DELETE requests", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .delete("/api/audit-tests/employee-7")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(204);

    const entry = await expectSingleAuditEntry(auditLogger);
    expect(entry).toMatchObject({
      action: "DELETE /api/audit-tests/:id",
      entityType: "audit-tests",
      recordId: "employee-7",
      actor: "manager@test.local",
    });
  });

  it("uses anonymous when a mutating request has no authenticated user", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .post("/api/public-actions")
      .send({ reason: "self-service" });

    expect(response.status).toBe(201);

    const entry = await expectSingleAuditEntry(auditLogger);
    expect(entry).toMatchObject({
      action: "POST /api/public-actions",
      entityType: "public-actions",
      recordId: "public-action-1",
      actor: "anonymous",
      reason: "self-service",
    });
  });

  it("does not block the response while audit logging runs", async () => {
    let releaseLog: (() => void) | undefined;
    const auditLogger = {
      log: vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
        releaseLog = resolve;
      })),
    } satisfies AuditLogger;
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .post("/api/slow-actions")
      .send({ reason: "latency check" });

    expect(response.status).toBe(201);
    await vi.waitFor(() => expect(auditLogger.log).toHaveBeenCalledTimes(1));
    releaseLog?.();
  });

  it("skips audit logging when a mutating request fails", async () => {
    const auditLogger = createMockAuditLogger();
    const app = createTestApp({ auditLogger, registerRoutes: registerAuditTestRoutes });

    const response = await request(app)
      .post("/api/audit-tests")
      .send({ status: "blocked" });

    expect(response.status).toBe(401);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});

describe("ConsoleAuditLogger", () => {
  it("writes structured audit events through the shared logger", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const auditLogger = new ConsoleAuditLogger(() => new Date("2026-03-14T00:00:00.000Z"));

    await auditLogger.log({
      action: "POST /api/audit-tests",
      entityType: "audit-tests",
      recordId: "audit-created",
      actor: "admin@test.local",
      changedFields: { status: "active" },
    });

    expect(infoSpy).toHaveBeenCalledWith("Audit log recorded", {
      audit: {
        action: "POST /api/audit-tests",
        entityType: "audit-tests",
        recordId: "audit-created",
        actor: "admin@test.local",
        changedFields: { status: "active" },
        timestamp: "2026-03-14T00:00:00.000Z",
      },
    });
  });
});
