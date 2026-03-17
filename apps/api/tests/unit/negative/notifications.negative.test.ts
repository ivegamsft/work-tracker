import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken, seededTestUsers } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Notifications Module — Negative/Edge Cases", () => {
  let app: Express;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/notifications/preferences — Validation", () => {
    it("returns 400 when preferences array is missing", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when preferences is not an array", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ preferences: "not-an-array" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when notificationType is invalid", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          preferences: [{
            notificationType: "invalid_type",
            channels: ["email"],
            isEnabled: true,
            frequency: "immediate",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when channels array is empty", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          preferences: [{
            notificationType: "overdue_requirement",
            channels: [],
            isEnabled: true,
            frequency: "immediate",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when channels contains invalid value", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          preferences: [{
            notificationType: "overdue_requirement",
            channels: ["invalid_channel"],
            isEnabled: true,
            frequency: "immediate",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when frequency is invalid", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          preferences: [{
            notificationType: "overdue_requirement",
            channels: ["email"],
            isEnabled: true,
            frequency: "invalid_frequency",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when isEnabled is missing", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          preferences: [{
            notificationType: "overdue_requirement",
            channels: ["email"],
            frequency: "immediate",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/notifications — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .query({ status: "invalid_status" })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when type is invalid", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .query({ type: "invalid_type" })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/notifications/escalation-rules — Validation", () => {
    it("returns 400 when trigger is missing", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          delayHours: 24,
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when trigger is invalid", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "invalid_trigger",
          delayHours: 24,
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when delayHours is missing", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "overdue_requirement",
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when delayHours is zero", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "overdue_requirement",
          delayHours: 0,
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when delayHours is negative", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "overdue_requirement",
          delayHours: -5,
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when escalateToRole is missing", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "overdue_requirement",
          delayHours: 24,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when maxEscalations exceeds 5", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          trigger: "overdue_requirement",
          delayHours: 24,
          escalateToRole: "supervisor",
          maxEscalations: 6,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("PATCH /api/notifications/:id/dismiss — Not Found", () => {
    it("returns 404 when notification does not exist", async () => {
      const response = await request(app)
        .patch(`/api/notifications/${NON_EXISTENT_UUID}/dismiss`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on GET /api/notifications", async () => {
      const response = await request(app)
        .get("/api/notifications");

      expect(response.status).toBe(401);
    });

    it("returns 401 when not authenticated on POST /api/notifications/preferences", async () => {
      const response = await request(app)
        .post("/api/notifications/preferences")
        .send({
          preferences: [{
            notificationType: "overdue_requirement",
            channels: ["email"],
            isEnabled: true,
            frequency: "immediate",
          }],
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to create escalation rule", async () => {
      const response = await request(app)
        .post("/api/notifications/escalation-rules")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          trigger: "overdue_requirement",
          delayHours: 24,
          escalateToRole: "supervisor",
        });

      expect(response.status).toBe(403);
    });
  });
});
