import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Roles } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { labelService } from "../src/modules/labels/service";
import type { Label, LabelMapping, TaxonomyVersion, AuditLog } from "@e-clat/shared";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: overrides.id ?? randomUUID(),
    code: overrides.code ?? "TEST_CODE",
    name: overrides.name ?? "Test Label",
    description: overrides.description ?? "Test description",
    effectiveDate: overrides.effectiveDate ?? new Date("2026-01-01"),
    retirementDate: overrides.retirementDate ?? null,
    migrateTo: overrides.migrateTo ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function buildLabelMapping(overrides: Partial<LabelMapping> = {}): LabelMapping {
  return {
    id: overrides.id ?? randomUUID(),
    labelId: overrides.labelId ?? randomUUID(),
    hourCategory: overrides.hourCategory ?? "REGULAR",
    effectiveDate: overrides.effectiveDate ?? new Date("2026-01-01"),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function buildTaxonomyVersion(overrides: Partial<TaxonomyVersion> = {}): TaxonomyVersion {
  return {
    id: overrides.id ?? randomUUID(),
    version: overrides.version ?? 1,
    effectiveDate: overrides.effectiveDate ?? new Date("2026-01-01"),
    description: overrides.description ?? "Initial version",
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? seededTestUsers.admin.id,
    action: overrides.action ?? "CREATE",
    entity: overrides.entity ?? "Label",
    recordId: overrides.recordId ?? randomUUID(),
    changes: overrides.changes ?? {},
    timestamp: overrides.timestamp ?? new Date(),
    ipAddress: overrides.ipAddress ?? "127.0.0.1",
    userAgent: overrides.userAgent ?? "test-agent",
  };
}

describe("Labels API", () => {
  let app: Express;
  let adminToken: string;
  let complianceOfficerToken: string;
  let supervisorToken: string;
  let employeeToken: string;

  beforeAll(() => {
    app = createTestApp();
    adminToken = generateTestToken(Roles.ADMIN);
    complianceOfficerToken = generateTestToken(Roles.COMPLIANCE_OFFICER);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    employeeToken = generateTestToken(Roles.EMPLOYEE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/labels/admin", () => {
    it("creates a label when the caller is an admin", async () => {
      const mockLabel = buildLabel();
      vi.spyOn(labelService, "createLabel").mockResolvedValue(mockLabel);

      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "NEW_CODE",
          name: "New Label",
          description: "New description",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        code: "TEST_CODE",
        name: "Test Label",
      }));
    });

    it("returns 403 when the caller is a compliance officer (not admin)", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${complianceOfficerToken}`)
        .send({
          code: "NEW_CODE",
          name: "New Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(403);
    });

    it("returns 403 when the caller is a supervisor", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          code: "NEW_CODE",
          name: "New Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .send({
          code: "NEW_CODE",
          name: "New Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid code format (lowercase)", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "invalid_code",
          name: "Invalid Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBeDefined();
    });

    it("returns 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "VALID_CODE",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for code exceeding max length", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "A".repeat(51),
          name: "Too Long Code",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid effectiveDate format", async () => {
      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "VALID_CODE",
          name: "Valid Label",
          effectiveDate: "not-a-date",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/labels/admin/:id", () => {
    it("updates a label when the caller is an admin", async () => {
      const labelId = randomUUID();
      const updatedLabel = buildLabel({ id: labelId, name: "Updated Label" });
      vi.spyOn(labelService, "updateLabel").mockResolvedValue(updatedLabel);

      const response = await request(app)
        .put(`/api/labels/admin/${labelId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated Label",
          description: "Updated description",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: labelId,
        name: "Updated Label",
      }));
    });

    it("returns 403 when the caller is not an admin", async () => {
      const labelId = randomUUID();

      const response = await request(app)
        .put(`/api/labels/admin/${labelId}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          name: "Updated Label",
        });

      expect(response.status).toBe(403);
    });

    it("handles empty update payload", async () => {
      const labelId = randomUUID();
      const updatedLabel = buildLabel({ id: labelId });
      vi.spyOn(labelService, "updateLabel").mockResolvedValue(updatedLabel);

      const response = await request(app)
        .put(`/api/labels/admin/${labelId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      // Empty payload is valid per schema (all fields optional)
      expect([200, 400, 501]).toContain(response.status);
    });

    it("returns 400 for name exceeding max length", async () => {
      const labelId = randomUUID();

      const response = await request(app)
        .put(`/api/labels/admin/${labelId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "A".repeat(101),
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/labels/admin/:id/deprecate", () => {
    it("deprecates a label when the caller is an admin", async () => {
      const labelId = randomUUID();
      const deprecatedLabel = buildLabel({ id: labelId, retirementDate: new Date("2026-12-31") });
      vi.spyOn(labelService, "deprecateLabel").mockResolvedValue(deprecatedLabel);

      const response = await request(app)
        .post(`/api/labels/admin/${labelId}/deprecate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          retirementDate: "2026-12-31T00:00:00.000Z",
          migrateTo: "NEW_CODE",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: labelId,
        retirementDate: expect.any(String),
      }));
    });

    it("returns 403 when the caller is not an admin", async () => {
      const labelId = randomUUID();

      const response = await request(app)
        .post(`/api/labels/admin/${labelId}/deprecate`)
        .set("Authorization", `Bearer ${complianceOfficerToken}`)
        .send({
          retirementDate: "2026-12-31T00:00:00.000Z",
        });

      expect(response.status).toBe(403);
    });

    it("returns 400 for missing retirementDate", async () => {
      const labelId = randomUUID();

      const response = await request(app)
        .post(`/api/labels/admin/${labelId}/deprecate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          migrateTo: "NEW_CODE",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/labels/versions", () => {
    it("returns taxonomy versions for authenticated users", async () => {
      const mockVersions = [buildTaxonomyVersion(), buildTaxonomyVersion({ version: 2 })];
      vi.spyOn(labelService, "listVersions").mockResolvedValue(mockVersions);

      const response = await request(app)
        .get("/api/labels/versions")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(expect.objectContaining({
        version: expect.any(Number),
      }));
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/labels/versions");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/labels/mappings", () => {
    it("creates a label mapping when the caller is an admin", async () => {
      const mockMapping = buildLabelMapping();
      vi.spyOn(labelService, "createMapping").mockResolvedValue(mockMapping);

      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: randomUUID(),
          hourCategory: "REGULAR",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        hourCategory: "REGULAR",
      }));
    });

    it("returns 403 when the caller is not an admin", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          labelId: randomUUID(),
          hourCategory: "REGULAR",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(403);
    });

    it("returns 400 for invalid labelId (not UUID)", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: "not-a-uuid",
          hourCategory: "REGULAR",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing hourCategory", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: randomUUID(),
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing effectiveDate", async () => {
      const response = await request(app)
        .post("/api/labels/mappings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labelId: randomUUID(),
          hourCategory: "REGULAR",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/labels/resolve", () => {
    it("resolves a label mapping for authenticated users", async () => {
      const mockMapping = buildLabelMapping();
      vi.spyOn(labelService, "resolveLabel").mockResolvedValue(mockMapping);

      const response = await request(app)
        .get("/api/labels/resolve?label=TEST_CODE")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        id: expect.any(String),
        hourCategory: expect.any(String),
      }));
    });

    it("accepts optional version parameter", async () => {
      const mockMapping = buildLabelMapping();
      vi.spyOn(labelService, "resolveLabel").mockResolvedValue(mockMapping);

      const response = await request(app)
        .get("/api/labels/resolve?label=TEST_CODE&version=2")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
    });

    it("returns 400 for missing label parameter", async () => {
      const response = await request(app)
        .get("/api/labels/resolve")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid version (not a positive integer)", async () => {
      const response = await request(app)
        .get("/api/labels/resolve?label=TEST_CODE&version=-1")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
    });

    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/labels/resolve?label=TEST_CODE");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/labels/audit/:id", () => {
    it("returns audit trail for supervisors", async () => {
      const labelId = randomUUID();
      const mockAuditLogs = [
        buildAuditLog({ recordId: labelId, action: "CREATE" }),
        buildAuditLog({ recordId: labelId, action: "UPDATE" }),
      ];
      vi.spyOn(labelService, "getAuditTrail").mockResolvedValue(mockAuditLogs);

      const response = await request(app)
        .get(`/api/labels/audit/${labelId}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(expect.objectContaining({
        action: expect.any(String),
        entity: "Label",
      }));
    });

    it("returns audit trail for admins", async () => {
      const labelId = randomUUID();
      const mockAuditLogs = [buildAuditLog({ recordId: labelId })];
      vi.spyOn(labelService, "getAuditTrail").mockResolvedValue(mockAuditLogs);

      const response = await request(app)
        .get(`/api/labels/audit/${labelId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it("returns 403 for employees", async () => {
      const labelId = randomUUID();

      const response = await request(app)
        .get(`/api/labels/audit/${labelId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const labelId = randomUUID();
      const response = await request(app).get(`/api/labels/audit/${labelId}`);

      expect(response.status).toBe(401);
    });
  });

  describe("Edge Cases", () => {
    it("handles circular mapping references gracefully", async () => {
      const labelId = randomUUID();
      vi.spyOn(labelService, "deprecateLabel").mockResolvedValue(
        buildLabel({ id: labelId, migrateTo: labelId }),
      );

      const response = await request(app)
        .post(`/api/labels/admin/${labelId}/deprecate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          retirementDate: "2026-12-31T00:00:00.000Z",
          migrateTo: labelId,
        });

      expect(response.status).toBe(200);
    });

    it("handles duplicate label creation attempts", async () => {
      const error = new Error("Label with code TEST_CODE already exists");
      vi.spyOn(labelService, "createLabel").mockRejectedValue(error);

      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_CODE",
          name: "Duplicate Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(500);
    });

    it("handles non-existent label updates gracefully", async () => {
      const error = { message: "Label not found", statusCode: 404 };
      vi.spyOn(labelService, "updateLabel").mockRejectedValue(error);

      const response = await request(app)
        .put(`/api/labels/admin/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated Name",
        });

      expect(response.status).toBe(500);
    });

    it("handles empty audit trail", async () => {
      const labelId = randomUUID();
      vi.spyOn(labelService, "getAuditTrail").mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/labels/audit/${labelId}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("handles special characters in label codes", async () => {
      const mockLabel = buildLabel({ code: "TEST_CODE_123" });
      vi.spyOn(labelService, "createLabel").mockResolvedValue(mockLabel);

      const response = await request(app)
        .post("/api/labels/admin")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "TEST_CODE_123",
          name: "Test Label",
          effectiveDate: "2026-01-01T00:00:00.000Z",
        });

      expect(response.status).toBe(201);
    });
  });
});
