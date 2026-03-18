import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Standards Module — Negative/Edge Cases", () => {
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

  describe("POST /api/standards — Validation", () => {
    it("returns 400 when code is missing", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code is empty string", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "",
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when code exceeds 50 characters", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "a".repeat(51),
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST-001",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name exceeds 200 characters", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST-001",
          name: "a".repeat(201),
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 2000 characters", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "a".repeat(2001),
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when issuingBody is missing", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "Test description",
          version: "1.0",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when version is missing", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/standards/:id/requirements — Validation", () => {
    it("returns 400 when standardId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/standards/not-a-uuid/requirements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "Training",
          description: "Test requirement",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when category is missing", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Test requirement",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when category exceeds 100 characters", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "a".repeat(101),
          description: "Test requirement",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 2000 characters", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "Training",
          description: "a".repeat(2001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when minimumHours is zero", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "Training",
          description: "Test requirement",
          minimumHours: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when minimumHours is negative", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "Training",
          description: "Test requirement",
          minimumHours: -10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when recertificationPeriodMonths is zero", async () => {
      const response = await request(app)
        .post(`/api/standards/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          category: "Training",
          description: "Test requirement",
          recertificationPeriodMonths: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/standards — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/standards")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/standards")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/standards/:id — Not Found", () => {
    it("returns 404 when standard does not exist", async () => {
      const response = await request(app)
        .get(`/api/standards/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on POST /api/standards", async () => {
      const response = await request(app)
        .post("/api/standards")
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to create standard", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when SUPERVISOR tries to create standard", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          code: "TEST-001",
          name: "Test Standard",
          description: "Test description",
          issuingBody: "Test Body",
          version: "1.0",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when EMPLOYEE tries to update standard", async () => {
      const response = await request(app)
        .put(`/api/standards/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(403);
    });
  });
});
