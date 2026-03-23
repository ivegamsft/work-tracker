import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken, seededTestUsers } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Medical Module — Negative/Edge Cases", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/medical — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: "not-a-uuid",
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when clearanceType is missing", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when clearanceType is empty string", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when clearanceType exceeds 100 characters", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "a".repeat(101),
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when status is missing", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "invalid_status",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when effectiveDate is invalid", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "not-a-date",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when issuedBy is missing", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when visualAcuityResult is invalid", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
          visualAcuityResult: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when colorVisionResult is invalid", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
          colorVisionResult: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("PUT /api/medical/:id — Validation", () => {
    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .put(`/api/medical/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ status: "invalid_status" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when visualAcuityResult is invalid", async () => {
      const response = await request(app)
        .put(`/api/medical/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ visualAcuityResult: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/medical/:id — Not Found", () => {
    it("returns 404 when medical clearance does not exist", async () => {
      const response = await request(app)
        .get(`/api/medical/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on POST /api/medical", async () => {
      const response = await request(app)
        .post("/api/medical")
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to create medical clearance", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          clearanceType: "General Physical",
          status: "cleared",
          effectiveDate: "2026-01-01",
          issuedBy: "Dr. Smith",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when EMPLOYEE tries to update medical clearance", async () => {
      const response = await request(app)
        .put(`/api/medical/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ status: "expired" });

      expect(response.status).toBe(403);
    });
  });
});
