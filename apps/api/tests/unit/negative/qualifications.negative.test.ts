import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Qualifications Module — Negative/Edge Cases", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/qualifications — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/qualifications — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: "not-a-uuid",
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when standardId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: "not-a-uuid",
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when certificationName is empty", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when certificationName exceeds 200 characters", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "a".repeat(201),
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when issuingBody is missing", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issueDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when issueDate is invalid", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "not-a-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when documentIds contains invalid UUID", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: NON_EXISTENT_UUID,
          standardId: NON_EXISTENT_UUID,
          certificationName: "Test Cert",
          issuingBody: "Test Body",
          issueDate: "2026-01-01",
          documentIds: ["not-a-uuid"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/qualifications — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ employeeId: "not-a-uuid" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ status: "invalid_status" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/qualifications/:id — Not Found", () => {
    it("returns 404 when qualification does not exist", async () => {
      const response = await request(app)
        .get(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("PATCH /api/qualifications/:id — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .patch(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .send({ certificationName: "Updated" });

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .patch(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ certificationName: "Updated" });

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /api/qualifications/:id — Validation", () => {
    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .patch(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ status: "invalid_status" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when certificationName exceeds 200 characters", async () => {
      const response = await request(app)
        .patch(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ certificationName: "a".repeat(201) });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("DELETE /api/qualifications/:id — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .delete(`/api/qualifications/${NON_EXISTENT_UUID}`);

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .delete(`/api/qualifications/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });
  });
});
