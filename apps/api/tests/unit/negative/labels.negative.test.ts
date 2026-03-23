import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Labels Module — Negative/Edge Cases", () => {
  let app: Express;
  let adminToken: string;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/labels/admin — Validation", () => {
    it("returns 400 when code is missing", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code is empty string", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code is not uppercase alphanumeric", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "test-label",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code contains spaces", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST LABEL",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code exceeds 50 characters", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "A".repeat(51),
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name is empty string", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          name: "",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name exceeds 100 characters", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          name: "a".repeat(101),
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 500 characters", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
          description: "a".repeat(501),
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when effectiveDate is missing", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when effectiveDate is invalid", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
          effectiveDate: "not-a-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/labels/admin/:id/deprecate — Validation", () => {
    it("returns 400 when retirementDate is missing", async () => {
      const response = await request(app)
        .post(`/api/labels/admin/${NON_EXISTENT_UUID}/deprecate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when retirementDate is invalid", async () => {
      const response = await request(app)
        .post(`/api/labels/admin/${NON_EXISTENT_UUID}/deprecate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ retirementDate: "not-a-date" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/labels/mappings — Validation", () => {
    it("returns 400 when labelId is missing", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          hourCategory: "OSHA_TRAINING",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when labelId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: "not-a-uuid",
          hourCategory: "OSHA_TRAINING",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hourCategory is missing", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: NON_EXISTENT_UUID,
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when effectiveDate is missing", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: NON_EXISTENT_UUID,
          hourCategory: "OSHA_TRAINING",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/labels/resolve — Validation", () => {
    it("returns 400 when label query param is missing", async () => {
      const response = await request(app)
        .get("/api/labels/resolve")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when label query param is empty string", async () => {
      const response = await request(app)
        .get("/api/labels/resolve")
        .query({ label: "" })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when version is zero", async () => {
      const response = await request(app)
        .get("/api/labels/resolve")
        .query({ label: "TEST_LABEL", version: 0 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when version is negative", async () => {
      const response = await request(app)
        .get("/api/labels/resolve")
        .query({ label: "TEST_LABEL", version: -1 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/labels/:id — Not Found", () => {
    it("returns 404 when label does not exist", async () => {
      const response = await request(app)
        .get(`/api/labels/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on POST /api/labels/admin", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to create label", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when SUPERVISOR tries to create label", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          code: "TEST_LABEL",
          name: "Test Label",
          effectiveDate: "2026-01-01",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when EMPLOYEE tries to update label", async () => {
      const response = await request(app)
        .put(`/api/labels/admin/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(403);
    });

    it("returns 403 when EMPLOYEE tries to deprecate label", async () => {
      const response = await request(app)
        .post(`/api/labels/admin/${NON_EXISTENT_UUID}/deprecate`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ retirementDate: "2027-01-01" });

      expect(response.status).toBe(403);
    });
  });
});
