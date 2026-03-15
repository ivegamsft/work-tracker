import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { QualificationStatus } from "@prisma/client";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_PREFIX = `syd-qual-${randomUUID().split("-")[0]}`;

function buildQualificationPayload(overrides: Partial<{
  employeeId: string;
  standardId: string;
  certificationName: string;
  issuingBody: string;
  issueDate: string;
  expirationDate: string | null;
  documentIds: string[];
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    employeeId: seededTestUsers.employee.id,
    standardId: NON_EXISTENT_ID,
    certificationName: `${TEST_PREFIX} certification ${suffix}`,
    issuingBody: "Sydnor QA Board",
    issueDate: "2026-01-15T00:00:00.000Z",
    expirationDate: "2030-01-15T00:00:00.000Z",
    documentIds: [],
    ...overrides,
  };
}

describe("Qualifications API", () => {
  let app: Express;
  let supervisorToken: string;
  let employeeToken: string;
  let seededQualificationId: string;
  let oshaStandardId: string;
  let hazcomStandardId: string;
  let faaStandardId: string;
  const createdRecordIds: string[] = [];

  beforeAll(async () => {
    app = createTestApp();
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);

    const [seededQualification, oshaStandard, hazcomStandard, faaStandard] = await Promise.all([
      prisma.qualification.findFirst({
        where: {
          employeeId: seededTestUsers.employee.id,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.complianceStandard.findUnique({ where: { code: "OSHA-30-GI" } }),
      prisma.complianceStandard.findUnique({ where: { code: "HAZCOM-1910" } }),
      prisma.complianceStandard.findUnique({ where: { code: "FAA-147-RT" } }),
    ]);

    if (!seededQualification || !oshaStandard || !hazcomStandard || !faaStandard) {
      throw new Error("Expected seeded qualifications and standards to exist for integration tests");
    }

    seededQualificationId = seededQualification.id;
    oshaStandardId = oshaStandard.id;
    hazcomStandardId = hazcomStandard.id;
    faaStandardId = faaStandard.id;
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { recordId: { in: createdRecordIds } } });
    }

    await prisma.qualification.deleteMany({
      where: { certificationName: { startsWith: TEST_PREFIX } },
    });
  });

  describe("POST /api/qualifications", () => {
    it("creates a qualification when the caller is a supervisor-or-higher", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildQualificationPayload({ standardId: hazcomStandardId }));

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        employeeId: seededTestUsers.employee.id,
        standardId: hazcomStandardId,
        certificationName: expect.stringContaining(TEST_PREFIX),
      }));

      createdRecordIds.push(response.body.id);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildQualificationPayload({ standardId: hazcomStandardId }));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/qualifications")
        .send(buildQualificationPayload({ standardId: hazcomStandardId }));

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/qualifications", () => {
    it("lists qualifications with filters for supervisor-or-higher roles", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({
          employeeId: seededTestUsers.employee.id,
          standardId: oshaStandardId,
          status: "active",
          page: 1,
          limit: 10,
        })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 10,
      }));
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((qualification: { employeeId: string; standardId: string; status: string }) =>
        qualification.employeeId === seededTestUsers.employee.id
        && qualification.standardId === oshaStandardId
        && qualification.status === "active")).toBe(true);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get("/api/qualifications")
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/qualifications/:id", () => {
    it("returns a qualification for an authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/qualifications/${seededQualificationId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: seededQualificationId,
        employeeId: seededTestUsers.employee.id,
      }));
    });

    it("returns 404 for a non-existent qualification id", async () => {
      const response = await request(app)
        .get(`/api/qualifications/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/qualifications/${seededQualificationId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/qualifications/:id", () => {
    it("updates a qualification when the caller is a supervisor-or-higher", async () => {
      const fixture = await prisma.qualification.create({
        data: {
          employeeId: seededTestUsers.supervisor.id,
          standardId: hazcomStandardId,
          certificationName: `${TEST_PREFIX} update fixture ${randomUUID().split("-")[0]}`,
          issuingBody: "Sydnor QA Board",
          issueDate: new Date("2026-01-01T00:00:00.000Z"),
          expirationDate: new Date("2030-01-01T00:00:00.000Z"),
          status: QualificationStatus.PENDING_REVIEW,
        },
      });
      createdRecordIds.push(fixture.id);

      const response = await request(app)
        .put(`/api/qualifications/${fixture.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          certificationName: `${TEST_PREFIX} updated`,
          status: "suspended",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: fixture.id,
        certificationName: `${TEST_PREFIX} updated`,
        status: "suspended",
      }));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .put(`/api/qualifications/${seededQualificationId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ status: "suspended" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .put(`/api/qualifications/${seededQualificationId}`)
        .send({ status: "suspended" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/qualifications/employee/:employeeId", () => {
    it("lists qualifications for a specific employee", async () => {
      const response = await request(app)
        .get(`/api/qualifications/employee/${seededTestUsers.employee.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(Array));
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.every((qualification: { employeeId: string }) => qualification.employeeId === seededTestUsers.employee.id)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get(`/api/qualifications/employee/${seededTestUsers.employee.id}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/qualifications/:id/audit", () => {
    it("returns the audit trail for supervisor-or-higher roles", async () => {
      const response = await request(app)
        .get(`/api/qualifications/${seededQualificationId}/audit`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(Array));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .get(`/api/qualifications/${seededQualificationId}/audit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/qualifications/${seededQualificationId}/audit`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/qualifications/compliance/:employeeId/:standardId", () => {
    it("returns compliant=true when an active qualification satisfies the standard", async () => {
      const fixture = await prisma.qualification.create({
        data: {
          employeeId: seededTestUsers.supervisor.id,
          standardId: hazcomStandardId,
          certificationName: `${TEST_PREFIX} compliance fixture ${randomUUID().split("-")[0]}`,
          issuingBody: "Sydnor QA Board",
          issueDate: new Date("2026-01-01T00:00:00.000Z"),
          expirationDate: new Date("2030-01-01T00:00:00.000Z"),
          status: QualificationStatus.ACTIVE,
        },
      });
      createdRecordIds.push(fixture.id);

      const response = await request(app)
        .get(`/api/qualifications/compliance/${seededTestUsers.supervisor.id}/${hazcomStandardId}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        compliant: true,
        employeeId: seededTestUsers.supervisor.id,
        standardId: hazcomStandardId,
        requirements: expect.any(Array),
      }));
      expect(response.body.requirements.every((requirement: { requirementId: string; name: string; met: boolean }) => (
        typeof requirement.requirementId === "string"
        && typeof requirement.name === "string"
        && requirement.met === true
      ))).toBe(true);
    });

    it("returns compliant=false when the employee is missing the required qualification", async () => {
      const response = await request(app)
        .get(`/api/qualifications/compliance/${seededTestUsers.manager.id}/${faaStandardId}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        compliant: false,
        employeeId: seededTestUsers.manager.id,
        standardId: faaStandardId,
        requirements: expect.any(Array),
      }));
      expect(response.body.requirements.every((requirement: { requirementId: string; name: string; met: boolean }) => (
        typeof requirement.requirementId === "string"
        && typeof requirement.name === "string"
        && requirement.met === false
      ))).toBe(true);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .get(`/api/qualifications/compliance/${seededTestUsers.employee.id}/${oshaStandardId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get(`/api/qualifications/compliance/${seededTestUsers.employee.id}/${oshaStandardId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
