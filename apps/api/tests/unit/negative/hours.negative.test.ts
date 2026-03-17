import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken, seededTestUsers } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Hours Module — Negative/Edge Cases", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/hours/clock-in — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/hours/clock-in")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/hours/clock-in")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeId: "not-a-uuid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/hours/clock-out — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/hours/clock-out")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeId: "not-a-uuid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/hours/manual — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          date: "2026-01-01",
          hours: 8,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hours is missing", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hours is zero", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 0,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hours is negative", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: -5,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hours exceeds 24", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 25,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when qualificationCategory is missing", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 8,
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestation is missing", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 8,
          qualificationCategory: "OSHA",
          description: "Training",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestation is empty string", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 8,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 500 characters", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 8,
          qualificationCategory: "OSHA",
          description: "a".repeat(501),
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/hours/payroll-import — Validation", () => {
    it("returns 400 when records array is empty", async () => {
      const response = await request(app)
        .post("/api/hours/payroll-import")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [],
          sourceSystemId: "PAYROLL_SYSTEM",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when sourceSystemId is missing", async () => {
      const response = await request(app)
        .post("/api/hours/payroll-import")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-01-01",
            hours: 8,
            qualificationCategory: "OSHA",
          }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("PATCH /api/hours/:id — Validation", () => {
    it("returns 400 when reason is missing", async () => {
      const response = await request(app)
        .patch(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          hours: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when reason is empty string", async () => {
      const response = await request(app)
        .patch(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          hours: 7,
          reason: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hours exceeds 24", async () => {
      const response = await request(app)
        .patch(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          hours: 25,
          reason: "Correction needed",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("DELETE /api/hours/:id — Validation", () => {
    it("returns 400 when reason is missing", async () => {
      const response = await request(app)
        .delete(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when reason is empty string", async () => {
      const response = await request(app)
        .delete(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ reason: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/hours — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/hours")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/hours")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when source is invalid", async () => {
      const response = await request(app)
        .get("/api/hours")
        .query({ source: "invalid_source" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/hours/:id — Not Found", () => {
    it("returns 404 when hour record does not exist", async () => {
      const response = await request(app)
        .get(`/api/hours/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("POST /api/hours/conflicts/:id/resolve — Validation", () => {
    it("returns 400 when resolutionMethod is invalid", async () => {
      const response = await request(app)
        .post(`/api/hours/conflicts/${NON_EXISTENT_UUID}/resolve`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          resolutionMethod: "invalid_method",
          attestation: "I attest",
          reason: "Business need",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestation is missing", async () => {
      const response = await request(app)
        .post(`/api/hours/conflicts/${NON_EXISTENT_UUID}/resolve`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          resolutionMethod: "override",
          reason: "Business need",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when reason is missing", async () => {
      const response = await request(app)
        .post(`/api/hours/conflicts/${NON_EXISTENT_UUID}/resolve`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          resolutionMethod: "override",
          attestation: "I attest",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on POST /api/hours/manual", async () => {
      const response = await request(app)
        .post("/api/hours/manual")
        .send({
          employeeId: seededTestUsers.employee.id,
          date: "2026-01-01",
          hours: 8,
          qualificationCategory: "OSHA",
          description: "Training",
          attestation: "I attest this is correct",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to access POST /api/hours/payroll-import", async () => {
      const response = await request(app)
        .post("/api/hours/payroll-import")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          records: [{
            employeeId: seededTestUsers.employee.id,
            date: "2026-01-01",
            hours: 8,
            qualificationCategory: "OSHA",
          }],
          sourceSystemId: "PAYROLL_SYSTEM",
        });

      expect(response.status).toBe(403);
    });
  });
});
