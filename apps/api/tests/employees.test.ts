import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Role as PrismaRole } from "@prisma/client";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_PREFIX = `syd-emp-${randomUUID().split("-")[0]}`;
const EMPLOYEE_NUMBER_PREFIX = TEST_PREFIX.toUpperCase();

function buildEmployeePayload(overrides: Partial<{
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string;
  hireDate: string;
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    employeeNumber: `${EMPLOYEE_NUMBER_PREFIX}-${suffix}`.slice(0, 50),
    firstName: "Sydnor",
    lastName: "Tester",
    email: `${TEST_PREFIX}.${suffix}@example.com`,
    role: Roles.EMPLOYEE,
    departmentId: randomUUID(),
    hireDate: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("Employees API", () => {
  let app: Express;
  let adminToken: string;
  let supervisorToken: string;
  let employeeToken: string;
  let existingEmployeeId: string;
  const createdRecordIds: string[] = [];

  beforeAll(async () => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: seededTestUsers.employee.id },
    });

    if (!existingEmployee) {
      throw new Error("Expected seeded employee record to exist for integration tests");
    }

    existingEmployeeId = existingEmployee.id;
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { recordId: { in: createdRecordIds } } });
    }

    await prisma.employee.deleteMany({
      where: {
        OR: [
          { email: { startsWith: `${TEST_PREFIX}.` } },
          { employeeNumber: { startsWith: EMPLOYEE_NUMBER_PREFIX } },
        ],
      },
    });
  });

  describe("POST /api/employees", () => {
    it("creates an employee when the caller is an admin", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(buildEmployeePayload());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        email: expect.stringContaining(`${TEST_PREFIX}.`),
        employeeNumber: expect.stringContaining(EMPLOYEE_NUMBER_PREFIX),
        role: Roles.EMPLOYEE,
        isActive: true,
      }));

      createdRecordIds.push(response.body.id);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildEmployeePayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildEmployeePayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/employees")
        .send(buildEmployeePayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 409 when the email already exists", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(buildEmployeePayload({ email: seededTestUsers.employee.email }));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("returns 409 when the employee number already exists", async () => {
      const response = await request(app)
        .post("/api/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(buildEmployeePayload({ employeeNumber: "ECL-1001" }));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CONFLICT");
    });
  });

  describe("GET /api/employees", () => {
    it("lists employees with pagination for supervisor-or-higher roles", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ page: 1, limit: 2 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 2,
      }));
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ page: 1, limit: 2 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get("/api/employees")
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/employees/:id", () => {
    it("returns an employee for an authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/employees/${existingEmployeeId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: existingEmployeeId,
        email: seededTestUsers.employee.email,
      }));
    });

    it("returns 404 for a non-existent employee id", async () => {
      const response = await request(app)
        .get(`/api/employees/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/employees/${existingEmployeeId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/employees/:id", () => {
    it("updates an employee when the caller is an admin", async () => {
      const suffix = randomUUID().split("-")[0];
      const fixture = await prisma.employee.create({
        data: {
          employeeNumber: `${EMPLOYEE_NUMBER_PREFIX}-FIX-${suffix}`.slice(0, 50),
          firstName: "Fixture",
          lastName: "Employee",
          email: `${TEST_PREFIX}.fixture.${suffix}@example.com`,
          passwordHash: null,
          role: PrismaRole.EMPLOYEE,
          departmentId: randomUUID(),
          hireDate: new Date("2026-01-01T00:00:00.000Z"),
          isActive: true,
        },
      });
      createdRecordIds.push(fixture.id);

      const response = await request(app)
        .put(`/api/employees/${fixture.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Updated",
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: fixture.id,
        firstName: "Updated",
        isActive: false,
      }));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .put(`/api/employees/${existingEmployeeId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ firstName: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .put(`/api/employees/${existingEmployeeId}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ firstName: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .put(`/api/employees/${existingEmployeeId}`)
        .send({ firstName: "Rejected" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/employees/:id/readiness", () => {
    it("returns the readiness dashboard for an authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/employees/${existingEmployeeId}/readiness`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        employeeId: existingEmployeeId,
        overallStatus: expect.any(String),
        qualifications: expect.any(Array),
        medicalClearances: expect.any(Array),
      }));
      expect(["compliant", "at_risk", "non_compliant"]).toContain(response.body.overallStatus);
      expect(response.body.qualifications.every((item: {
        standardId: string;
        standardCode: string;
        standardName: string;
        status: string;
        readinessStatus: string;
      }) => (
        typeof item.standardId === "string"
        && typeof item.standardCode === "string"
        && typeof item.standardName === "string"
        && ["active", "expired", "expiring_soon", "missing", "pending_review", "suspended"].includes(item.status)
        && ["compliant", "at_risk", "non_compliant"].includes(item.readinessStatus)
      ))).toBe(true);
      expect(response.body.medicalClearances.every((item: { clearanceType: string; status: string; readinessStatus: string }) => (
        typeof item.clearanceType === "string"
        && ["cleared", "missing", "pending", "restricted", "suspended"].includes(item.status)
        && ["compliant", "at_risk", "non_compliant"].includes(item.readinessStatus)
      ))).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/employees/${existingEmployeeId}/readiness`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
