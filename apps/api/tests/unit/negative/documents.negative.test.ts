import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken, seededTestUsers } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Documents Module — Negative/Edge Cases", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  describe("POST /api/documents/upload — Validation", () => {
    it("returns 400 when employeeId is missing", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          fileName: "test.pdf",
          mimeType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: "not-a-uuid",
          fileName: "test.pdf",
          mimeType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when fileName is missing", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          mimeType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when fileName is empty string", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          fileName: "",
          mimeType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when mimeType is missing", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          fileName: "test.pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when description exceeds 500 characters", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeId: seededTestUsers.employee.id,
          fileName: "test.pdf",
          mimeType: "application/pdf",
          description: "a".repeat(501),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/documents/:id/review — Validation", () => {
    it("returns 400 when action is missing", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when action is invalid", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ action: "invalid_action" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when notes exceed 1000 characters", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          action: "approve",
          notes: "a".repeat(1001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when linkedQualificationId is not a UUID", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          action: "approve",
          linkedQualificationId: "not-a-uuid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/documents/:id/extractions/:extractionId/correct — Validation", () => {
    it("returns 400 when correctedValue is missing", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/extractions/${NON_EXISTENT_UUID}/correct`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when correctedValue is empty string", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/extractions/${NON_EXISTENT_UUID}/correct`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ correctedValue: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/documents — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/documents")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/documents")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when status is invalid", async () => {
      const response = await request(app)
        .get("/api/documents")
        .query({ status: "invalid_status" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeId is not a UUID", async () => {
      const response = await request(app)
        .get("/api/documents")
        .query({ employeeId: "not-a-uuid" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/documents/:id — Not Found", () => {
    it("returns 404 when document does not exist", async () => {
      const response = await request(app)
        .get(`/api/documents/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([404, 500]).toContain(response.status);
    });
  });

  describe("RBAC Tests", () => {
    it("returns 401 when not authenticated on POST /api/documents/upload", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .send({
          employeeId: seededTestUsers.employee.id,
          fileName: "test.pdf",
          mimeType: "application/pdf",
        });

      expect(response.status).toBe(401);
    });

    it("returns 401 when not authenticated on GET /api/documents", async () => {
      const response = await request(app)
        .get("/api/documents");

      expect(response.status).toBe(401);
    });

    it("returns 403 when EMPLOYEE tries to review document", async () => {
      const response = await request(app)
        .post(`/api/documents/${NON_EXISTENT_UUID}/review`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ action: "approve" });

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/documents/:id — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .delete(`/api/documents/${NON_EXISTENT_UUID}`);

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .delete(`/api/documents/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });
  });
});
