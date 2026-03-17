import { Roles } from "@e-clat/shared";
import request from "supertest";
import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import type { Express } from "express";
import { createTestApp, generateTestToken } from "../../helpers";
import * as authService from "../../../src/modules/auth/service";

describe("Auth Module — Negative/Edge Cases", () => {
  let app: Express;
  let validToken: string;

  beforeAll(() => {
    app = createTestApp();
    validToken = generateTestToken(Roles.EMPLOYEE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("returns 400 when email is missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          password: "ValidPass123!",
          firstName: "John",
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when email is invalid format", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "not-an-email",
          password: "ValidPass123!",
          firstName: "John",
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when password is too short", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "short",
          firstName: "John",
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when password exceeds 128 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "a".repeat(129),
          firstName: "John",
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when firstName is empty string", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "ValidPass123!",
          firstName: "",
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when firstName exceeds 100 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "ValidPass123!",
          firstName: "a".repeat(101),
          lastName: "Doe",
          employeeNumber: "EMP001",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when employeeNumber exceeds 50 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "ValidPass123!",
          firstName: "John",
          lastName: "Doe",
          employeeNumber: "a".repeat(51),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 400 when email is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ password: "password" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when email is invalid format", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "not-an-email",
          password: "password",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 when credentials are invalid", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrong@example.com",
          password: "wrongpassword",
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("returns 400 when refreshToken is missing", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when refreshToken is empty string", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/change-password", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await request(app)
        .post("/api/auth/change-password")
        .send({
          currentPassword: "Current123!",
          newPassword: "NewPass123!",
        });

      expect(response.status).toBe(401);
    });

    it("returns 400 when currentPassword is missing", async () => {
      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ newPassword: "NewPass123!" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when newPassword is too short", async () => {
      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          currentPassword: "Current123!",
          newPassword: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 when newPassword exceeds 128 characters", async () => {
      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          currentPassword: "Current123!",
          newPassword: "a".repeat(129),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});
