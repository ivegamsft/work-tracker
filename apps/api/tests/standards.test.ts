import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { createTestApp, generateTestToken } from "./helpers";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_PREFIX = `syd-std-${randomUUID().split("-")[0]}`;
const STANDARD_CODE_PREFIX = TEST_PREFIX.toUpperCase();

function buildStandardPayload(overrides: Partial<{
  code: string;
  name: string;
  description: string;
  issuingBody: string;
  version: string;
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    code: `${STANDARD_CODE_PREFIX}-${suffix}`.slice(0, 50),
    name: `${TEST_PREFIX} standard ${suffix}`,
    description: "Integration-test standard for validating CRUD and requirement workflows.",
    issuingBody: "Sydnor QA Board",
    version: `v${suffix}`,
    ...overrides,
  };
}

function buildRequirementPayload(overrides: Partial<{
  category: string;
  description: string;
  minimumHours: number | null;
  recertificationPeriodMonths: number | null;
  requiredTests: string[];
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    category: `${TEST_PREFIX} category ${suffix}`,
    description: "Integration-test requirement covering admin-only standard requirement management.",
    minimumHours: 12,
    recertificationPeriodMonths: 24,
    requiredTests: ["practical assessment", "written review"],
    ...overrides,
  };
}

describe("Standards API", () => {
  let app: Express;
  let adminToken: string;
  let supervisorToken: string;
  let employeeToken: string;
  let seededStandardId: string;
  const createdRecordIds: string[] = [];

  beforeAll(async () => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);

    const seededStandard = await prisma.complianceStandard.findUnique({
      where: { code: "FAA-147-RT" },
      include: { requirements: true },
    });

    if (!seededStandard) {
      throw new Error("Expected seeded compliance standard to exist for integration tests");
    }

    seededStandardId = seededStandard.id;
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { recordId: { in: createdRecordIds } } });
    }

    const createdStandards = await prisma.complianceStandard.findMany({
      where: { code: { startsWith: STANDARD_CODE_PREFIX } },
      select: { id: true },
    });

    if (createdStandards.length > 0) {
      await prisma.standardRequirement.deleteMany({
        where: { standardId: { in: createdStandards.map((standard) => standard.id) } },
      });
    }

    await prisma.complianceStandard.deleteMany({
      where: { code: { startsWith: STANDARD_CODE_PREFIX } },
    });
  });

  describe("POST /api/standards", () => {
    it("creates a standard when the caller is an admin", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(buildStandardPayload());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        code: expect.stringContaining(STANDARD_CODE_PREFIX),
        name: expect.any(String),
        issuingBody: "Sydnor QA Board",
        isActive: true,
      }));

      createdRecordIds.push(response.body.id);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildStandardPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .post("/api/standards")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildStandardPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/standards")
        .send(buildStandardPayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/standards", () => {
    it("lists standards for any authenticated caller", async () => {
      const response = await request(app)
        .get("/api/standards")
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 10,
      }));
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/standards").query({ page: 1, limit: 10 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/standards/:id", () => {
    it("returns a standard with its requirements for any authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/standards/${seededStandardId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: seededStandardId,
        code: "FAA-147-RT",
        requirements: expect.any(Array),
      }));
      expect(response.body.requirements.length).toBeGreaterThan(0);
    });

    it("returns 404 for a non-existent standard id", async () => {
      const response = await request(app)
        .get(`/api/standards/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/standards/${seededStandardId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/standards/:id", () => {
    it("updates a standard when the caller is an admin", async () => {
      const fixture = await prisma.complianceStandard.create({
        data: buildStandardPayload(),
      });
      createdRecordIds.push(fixture.id);

      const response = await request(app)
        .put(`/api/standards/${fixture.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated standard name",
          version: "2026.2",
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: fixture.id,
        name: "Updated standard name",
        version: "2026.2",
        isActive: false,
      }));
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .put(`/api/standards/${seededStandardId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .put(`/api/standards/${seededStandardId}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .put(`/api/standards/${seededStandardId}`)
        .send({ name: "Rejected" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/standards/:id/requirements", () => {
    it("creates a requirement when the caller is an admin", async () => {
      const standard = await prisma.complianceStandard.create({
        data: buildStandardPayload(),
      });
      createdRecordIds.push(standard.id);

      const response = await request(app)
        .post(`/api/standards/${standard.id}/requirements`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(buildRequirementPayload());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        standardId: standard.id,
        category: expect.stringContaining(TEST_PREFIX),
        requiredTests: expect.any(Array),
      }));

      createdRecordIds.push(response.body.id);
    });

    it("returns 403 when the caller is an employee", async () => {
      const response = await request(app)
        .post(`/api/standards/${seededStandardId}/requirements`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildRequirementPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .post(`/api/standards/${seededStandardId}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildRequirementPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post(`/api/standards/${seededStandardId}/requirements`)
        .send(buildRequirementPayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/standards/requirements/:reqId", () => {
    it("updates a requirement when the caller is an admin", async () => {
      const standard = await prisma.complianceStandard.create({
        data: buildStandardPayload(),
      });
      createdRecordIds.push(standard.id);

      const requirement = await prisma.standardRequirement.create({
        data: {
          standardId: standard.id,
          ...buildRequirementPayload(),
        },
      });
      createdRecordIds.push(requirement.id);

      const response = await request(app)
        .put(`/api/standards/requirements/${requirement.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Updated requirement description",
          minimumHours: 18,
          recertificationPeriodMonths: 36,
          requiredTests: ["scenario evaluation"],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: requirement.id,
        description: "Updated requirement description",
        minimumHours: 18,
        recertificationPeriodMonths: 36,
        requiredTests: ["scenario evaluation"],
      }));
    });

    it("returns 403 when the caller is an employee", async () => {
      const requirement = await prisma.standardRequirement.findFirst({
        where: { standardId: seededStandardId },
      });

      if (!requirement) {
        throw new Error("Expected seeded requirement to exist for RBAC coverage");
      }

      const response = await request(app)
        .put(`/api/standards/requirements/${requirement.id}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ description: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const requirement = await prisma.standardRequirement.findFirst({
        where: { standardId: seededStandardId },
      });

      if (!requirement) {
        throw new Error("Expected seeded requirement to exist for RBAC coverage");
      }

      const response = await request(app)
        .put(`/api/standards/requirements/${requirement.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ description: "Rejected" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without authentication", async () => {
      const requirement = await prisma.standardRequirement.findFirst({
        where: { standardId: seededStandardId },
      });

      if (!requirement) {
        throw new Error("Expected seeded requirement to exist for unauthenticated coverage");
      }

      const response = await request(app)
        .put(`/api/standards/requirements/${requirement.id}`)
        .send({ description: "Rejected" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/standards/:id/requirements", () => {
    it("lists requirements for any authenticated caller", async () => {
      const response = await request(app)
        .get(`/api/standards/${seededStandardId}/requirements`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(Array));
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.every((requirement: { standardId: string }) => requirement.standardId === seededStandardId)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/standards/${seededStandardId}/requirements`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
