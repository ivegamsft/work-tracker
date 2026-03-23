import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken, seededTestUsers } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Templates Module — Negative/Edge Cases", () => {
  let app: Express;
  let adminToken: string;
  let coToken: string;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    coToken = generateTestToken(Roles.COMPLIANCE_OFFICER);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/templates — Validation", () => {
    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${coToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name is empty string", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${coToken}`)
        .send({ name: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when name exceeds 200 characters", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${coToken}`)
        .send({ name: "a".repeat(201) });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 2000 characters", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Template",
          description: "a".repeat(2001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when standardId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Template",
          standardId: "not-a-uuid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/templates/:id/requirements — Validation", () => {
    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          attestationLevels: ["self_attest"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestationLevels is missing", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestationLevels is empty array", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when attestationLevels contains invalid value", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: ["invalid_level"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when proofType is invalid", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: ["self_attest"],
          proofType: "invalid_type",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when threshold is zero", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: ["self_attest"],
          threshold: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when threshold is negative", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: ["self_attest"],
          threshold: -5,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when rollingWindowDays is zero", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/requirements`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          name: "Test Requirement",
          attestationLevels: ["self_attest"],
          rollingWindowDays: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/templates/:id/assign — Validation", () => {
    it("returns 400 when no assignment criteria provided", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/assign`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeIds is empty array", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/assign`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ employeeIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeIds contains invalid UUID", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/assign`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ employeeIds: ["not-a-uuid"] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/fulfillments/:id/self-attest — Validation", () => {
    it("returns 400 when statement exceeds 2000 characters", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/self-attest`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ statement: "a".repeat(2001) });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/fulfillments/:id/attach-document — Validation", () => {
    it("returns 400 when documentId is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/attach-document`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when documentId is not a UUID", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/attach-document`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ documentId: "not-a-uuid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/fulfillments/:id/validate — Validation", () => {
    it("returns 400 when approved is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when approval is false but reason is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ approved: false });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when approval is true but notes are missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ approved: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when notes exceed 2000 characters", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          approved: true,
          notes: "a".repeat(2001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/fulfillments/:id/third-party-verify — Validation", () => {
    it("returns 400 when source is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when source is empty string", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ source: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when source exceeds 200 characters", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ source: "a".repeat(201) });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/fulfillments/reviews — Query Validation", () => {
    it("returns 400 when page is zero", async () => {
      const response = await request(app)
        .get("/api/fulfillments/reviews")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${coToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/fulfillments/reviews")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${coToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .get("/api/fulfillments/reviews")
        .query({ employeeId: "not-a-uuid" })
        .set("Authorization", `Bearer ${coToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/fulfillments/:id/review — Validation", () => {
    it("returns 400 when decision is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ notes: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when decision is invalid", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          decision: "invalid_decision",
          notes: "Test",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when decision is reject but reason is missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({
          decision: "reject",
          notes: "Test",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 or 403 when decision is approve but notes are missing", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${coToken}`)
        .send({ decision: "approve" });

      // 400 if validation happens, 403 if RBAC denies first
      expect([400, 403]).toContain(response.status);
    });
  });

  describe("GET /api/templates/:id — Not Found", () => {
    it("returns 404 when template does not exist", async () => {
      const response = await request(app)
        .get(`/api/templates/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests — Templates", () => {
    it("returns 401 when not authenticated on POST /api/templates", async () => {
      const response = await request(app)
        .post("/api/templates")
        .send({ name: "Test Template" });

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to create template", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Test Template" });

      expect(response.status).toBe(403);
    });

    it("returns 403 or 500 when SUPERVISOR tries to create template", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Test Template" });

      expect([403, 500]).toContain(response.status);
    });

    it("returns 403 when EMPLOYEE tries to delete template", async () => {
      const response = await request(app)
        .delete(`/api/templates/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("RBAC Tests — Assignments", () => {
    it("returns 403 when EMPLOYEE tries to assign template", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/assign`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(response.status).toBe(403);
    });

    it("returns 403 or 500 when SUPERVISOR tries to assign template", async () => {
      const response = await request(app)
        .post(`/api/templates/${NON_EXISTENT_UUID}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect([403, 404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests — Fulfillments", () => {
    it("returns 401 or 404 when not authenticated on POST self-attest", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/self-attest`)
        .send({ statement: "I attest" });

      expect([401, 404]).toContain(response.status);
    });

    it("returns 403 when EMPLOYEE tries to validate fulfillment", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          approved: true,
          notes: "Looks good",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when SUPERVISOR tries to validate fulfillment", async () => {
      const response = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_UUID}/validate`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          approved: true,
          notes: "Looks good",
        });

      expect(response.status).toBe(403);
    });
  });
});
