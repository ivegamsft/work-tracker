import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { MedicalClearanceStatus } from "@prisma/client";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_PREFIX = `syd-med-${randomUUID().split("-")[0]}`;

function buildMedicalPayload(overrides: Partial<{
  employeeId: string;
  clearanceType: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  visualAcuityResult: "pass" | "fail" | null;
  colorVisionResult: "pass" | "fail" | null;
  issuedBy: string;
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    employeeId: seededTestUsers.employee.id,
    clearanceType: `${TEST_PREFIX} clearance ${suffix}`,
    status: "cleared",
    effectiveDate: "2026-01-15T00:00:00.000Z",
    expirationDate: "2030-01-15T00:00:00.000Z",
    visualAcuityResult: "pass",
    colorVisionResult: "pass",
    issuedBy: `${TEST_PREFIX} clinic`,
    ...overrides,
  };
}

describe("Medical API", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;
  let seededClearanceId: string;
  const createdRecordIds: string[] = [];

  beforeAll(async () => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);

    const seededClearance = await prisma.medicalClearance.findFirst({
      where: { employeeId: seededTestUsers.employee.id },
      orderBy: { createdAt: "asc" },
    });

    if (!seededClearance) {
      throw new Error("Expected seeded medical clearance to exist for integration tests");
    }

    seededClearanceId = seededClearance.id;
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { recordId: { in: createdRecordIds } } });
    }

    await prisma.medicalClearance.deleteMany({
      where: {
        OR: [
          { clearanceType: { startsWith: TEST_PREFIX } },
          { issuedBy: { startsWith: TEST_PREFIX } },
        ],
      },
    });
  });

  describe("POST /api/medical", () => {
    it("creates a medical clearance when the caller is a supervisor-or-higher", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildMedicalPayload());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        employeeId: seededTestUsers.employee.id,
        clearanceType: expect.stringContaining(TEST_PREFIX),
        status: "cleared",
      }));

      createdRecordIds.push(response.body.id);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .post("/api/medical")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildMedicalPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/medical")
        .send(buildMedicalPayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/medical/:id", () => {
    it("returns a clearance for an authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/medical/${seededClearanceId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: seededClearanceId,
        employeeId: seededTestUsers.employee.id,
      }));
    });

    it("returns 404 for a non-existent medical clearance id", async () => {
      const response = await request(app)
        .get(`/api/medical/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/medical/${seededClearanceId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/medical/:id", () => {
    it("updates a medical clearance when the caller is a supervisor-or-higher", async () => {
      const fixture = await prisma.medicalClearance.create({
        data: {
          employeeId: seededTestUsers.supervisor.id,
          clearanceType: `${TEST_PREFIX} update fixture ${randomUUID().split("-")[0]}`,
          status: MedicalClearanceStatus.PENDING,
          effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
          expirationDate: new Date("2030-01-01T00:00:00.000Z"),
          visualAcuityResult: "pass",
          colorVisionResult: "pass",
          issuedBy: `${TEST_PREFIX} clinic`,
        },
      });
      createdRecordIds.push(fixture.id);

      const response = await request(app)
        .put(`/api/medical/${fixture.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          status: "restricted",
          visualAcuityResult: "fail",
          colorVisionResult: "pass",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: fixture.id,
        status: "restricted",
        visualAcuityResult: "fail",
        colorVisionResult: "pass",
      }));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .put(`/api/medical/${seededClearanceId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ status: "restricted" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .put(`/api/medical/${seededClearanceId}`)
        .send({ status: "restricted" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/medical/employee/:employeeId", () => {
    it("lists clearances for a specific employee", async () => {
      const response = await request(app)
        .get(`/api/medical/employee/${seededTestUsers.employee.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(Array));
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.every((clearance: { employeeId: string }) => clearance.employeeId === seededTestUsers.employee.id)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/medical/employee/${seededTestUsers.employee.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/medical/:id/audit", () => {
    it("returns the audit trail for supervisor-or-higher roles", async () => {
      const response = await request(app)
        .get(`/api/medical/${seededClearanceId}/audit`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(Array));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .get(`/api/medical/${seededClearanceId}/audit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/medical/${seededClearanceId}/audit`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
