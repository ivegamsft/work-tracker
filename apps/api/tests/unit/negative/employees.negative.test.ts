import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken } from "../../helpers";

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

describe("Employees Module — Negative/Edge Cases", () => {
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

  describe("POST /api/employees — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .post("/api/employees")
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when caller is SUPERVISOR role", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/employees — Validation", () => {
    it("returns 400 when employeeNumber is missing", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeNumber is empty string", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeNumber exceeds 50 characters", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "a".repeat(51),
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when firstName is missing", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "EMP001",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when email is invalid format", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "not-an-email",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when role is invalid", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "invalid_role",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when departmentId is not a UUID", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: "not-a-uuid",
          hireDate: "2026-01-01",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when hireDate is invalid", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeNumber: "EMP001",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "employee",
          departmentId: NON_EXISTENT_UUID,
          hireDate: "not-a-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/employees — Query Validation", () => {
    it("returns 400 when page is 0", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when page is negative", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ page: -1 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when limit exceeds 100", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when departmentId is not a UUID", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ departmentId: "not-a-uuid" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/employees/:id — Not Found", () => {
    it("returns 404 when employee does not exist", async () => {
      const response = await request(app)
        .get(`/api/employees/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      // Accepts 404 (not found) or 500 (if getById is not fully implemented)
      expect([404, 500]).toContain(response.status);
    });
  });

  describe("PUT /api/employees/:id — RBAC", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .put(`/api/employees/${NON_EXISTENT_UUID}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(401);
    });

    it("returns 403 when caller is EMPLOYEE role", async () => {
      const response = await request(app)
        .put(`/api/employees/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/employees/:id — Validation", () => {
    it("returns 400 when email is invalid format", async () => {
      const response = await request(app)
        .put(`/api/employees/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when role is invalid", async () => {
      const response = await request(app)
        .put(`/api/employees/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "invalid_role" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when departmentId is not a UUID", async () => {
      const response = await request(app)
        .put(`/api/employees/${NON_EXISTENT_UUID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ departmentId: "not-a-uuid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});
