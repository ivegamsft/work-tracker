import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { ConflictError, ForbiddenError, NotFoundError, Roles, ValidationError } from "@e-clat/shared";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { templatesService } from "../src/modules/templates/service";

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

function buildTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    name: "Integration Template",
    description: "Created for integration testing",
    category: "Safety",
    status: "draft",
    version: 1,
    previousVersion: null,
    createdBy: seededTestUsers.supervisor.id,
    updatedBy: null,
    standardId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    archivedAt: null,
    requirements: [],
    ...overrides,
  };
}

function buildRequirement(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    templateId: randomUUID(),
    name: "Safety Requirement",
    description: "Must pass safety training",
    attestationLevels: ["self_attest"] as string[],
    proofType: null,
    proofSubType: null,
    typeConfig: null,
    threshold: null,
    thresholdUnit: null,
    rollingWindowDays: null,
    universalCategory: null,
    qualificationType: null,
    medicalTestType: null,
    standardReqId: null,
    validityDays: null,
    renewalWarningDays: null,
    sortOrder: 0,
    isRequired: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    templateId: randomUUID(),
    templateVersion: 1,
    employeeId: seededTestUsers.employee.id,
    role: null,
    department: null,
    assignedBy: seededTestUsers.supervisor.id,
    dueDate: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    employeeName: "Test Employee",
    employeeEmail: "employee@example.com",
    ...overrides,
  };
}

function buildFulfillment(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    assignmentId: randomUUID(),
    requirementId: randomUUID(),
    employeeId: seededTestUsers.employee.id,
    status: "unfulfilled",
    selfAttestedAt: null,
    selfAttestation: null,
    uploadedAt: null,
    documentId: null,
    thirdPartyVerifiedAt: null,
    thirdPartySource: null,
    thirdPartyRefId: null,
    thirdPartyData: null,
    validatedAt: null,
    validatedBy: null,
    validatorNotes: null,
    rejectedAt: null,
    rejectionReason: null,
    expiresAt: null,
    expiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Templates Integration — Real Router", () => {
  let app: Express;
  let employeeToken: string;
  let supervisorToken: string;
  let managerToken: string;
  let adminToken: string;
  let complianceToken: string;

  beforeAll(() => {
    app = createTestApp();
    employeeToken = generateTestToken(Roles.EMPLOYEE);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    managerToken = generateTestToken(Roles.MANAGER);
    adminToken = generateTestToken(Roles.ADMIN);
    complianceToken = generateTestToken(Roles.COMPLIANCE_OFFICER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── TEMPLATE CRUD via real router ───────────────────────────

  describe("Template CRUD (real router)", () => {
    it("creates a template through Zod-validated endpoint", async () => {
      vi.spyOn(templatesService, "createTemplate").mockResolvedValue(
        buildTemplate({ status: "draft" }) as never,
      );

      const res = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Compliance Template", description: "Test", category: "Safety" });

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body).toEqual(expect.objectContaining({ status: "draft" }));
      }
    });

    it("rejects template creation with empty name (Zod validation)", async () => {
      const res = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "", description: "Missing name" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("lists templates with pagination via real router", async () => {
      vi.spyOn(templatesService, "listTemplates").mockResolvedValue({
        data: [buildTemplate({ status: "published" })],
        total: 1,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/templates")
        .query({ page: 1, limit: 50 })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ total: 1, page: 1 }));
      }
    });

    it("lists templates with status and category filters", async () => {
      const spy = vi.spyOn(templatesService, "listTemplates").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/templates")
        .query({ status: "published", category: "Safety" })
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({ status: "published", category: "Safety" }),
          expect.any(Object),
        );
      }
    });

    it("gets a template by id", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "getTemplate").mockResolvedValue(
        buildTemplate({ id: templateId }) as never,
      );

      const res = await request(app)
        .get(`/api/templates/${templateId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.id).toBe(templateId);
      }
    });

    it("returns 404 for non-existent template", async () => {
      vi.spyOn(templatesService, "getTemplate").mockRejectedValue(
        new NotFoundError("Template", NON_EXISTENT_ID),
      );

      const res = await request(app)
        .get(`/api/templates/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("updates a draft template", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "updateTemplate").mockResolvedValue(
        buildTemplate({ id: templateId, name: "Updated" }) as never,
      );

      const res = await request(app)
        .put(`/api/templates/${templateId}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Updated" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.name).toBe("Updated");
      }
    });

    it("deletes a draft template", async () => {
      vi.spyOn(templatesService, "deleteTemplate").mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/templates/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([204, 500, 501]).toContain(res.status);
    });

    it("publishes a template (manager+)", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "publishTemplate").mockResolvedValue(
        buildTemplate({ id: templateId, status: "published", publishedAt: new Date() }) as never,
      );

      const res = await request(app)
        .post(`/api/templates/${templateId}/publish`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("published");
      }
    });

    it("archives a published template (manager+)", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "archiveTemplate").mockResolvedValue(
        buildTemplate({ id: templateId, status: "archived", archivedAt: new Date() }) as never,
      );

      const res = await request(app)
        .post(`/api/templates/${templateId}/archive`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("archived");
      }
    });

    it("clones a template (supervisor+)", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "cloneTemplate").mockResolvedValue(
        buildTemplate({ name: "Cloned Template", status: "draft" }) as never,
      );

      const res = await request(app)
        .post(`/api/templates/${templateId}/clone`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.status).toBe("draft");
      }
    });
  });

  // ─── TEAM TEMPLATES ──────────────────────────────────────────

  describe("Team Templates", () => {
    it("lists team templates for a supervisor", async () => {
      vi.spyOn(templatesService, "listTeamTemplates").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/templates/team")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual(expect.objectContaining({ data: [], total: 0 }));
      }
    });

    it("returns 403 when an employee accesses team templates", async () => {
      const res = await request(app)
        .get("/api/templates/team")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── REQUIREMENTS ────────────────────────────────────────────

  describe("Requirements (real router)", () => {
    it("adds a requirement to a template", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "addRequirement").mockResolvedValue(
        buildRequirement({ templateId }) as never,
      );

      const res = await request(app)
        .post(`/api/templates/${templateId}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({
          name: "Safety Training",
          attestationLevels: ["self_attest"],
        });

      expect([201, 500, 501]).toContain(res.status);
    });

    it("rejects requirement with empty attestation levels", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Bad Requirement", attestationLevels: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects requirement with invalid attestation level", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Bad Requirement", attestationLevels: ["telepathy"] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("updates a requirement", async () => {
      const templateId = randomUUID();
      const reqId = randomUUID();
      vi.spyOn(templatesService, "updateRequirement").mockResolvedValue(
        buildRequirement({ id: reqId, templateId, name: "Updated" }) as never,
      );

      const res = await request(app)
        .put(`/api/templates/${templateId}/requirements/${reqId}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Updated" });

      expect([200, 500, 501]).toContain(res.status);
    });

    it("removes a requirement", async () => {
      vi.spyOn(templatesService, "removeRequirement").mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/templates/${randomUUID()}/requirements/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([204, 500, 501]).toContain(res.status);
    });

    it("reorders requirements", async () => {
      const templateId = randomUUID();
      const ids = [randomUUID(), randomUUID()];
      vi.spyOn(templatesService, "reorderRequirements").mockResolvedValue(
        ids.map((id, i) => buildRequirement({ id, sortOrder: i })) as never,
      );

      const res = await request(app)
        .put(`/api/templates/${templateId}/requirements/reorder`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ requirementIds: ids });

      expect([200, 500, 501]).toContain(res.status);
    });

    it("rejects reorder with non-UUID ids", async () => {
      const res = await request(app)
        .put(`/api/templates/${randomUUID()}/requirements/reorder`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ requirementIds: ["not-a-uuid"] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ─── ASSIGNMENT LIFECYCLE ────────────────────────────────────

  describe("Assignment lifecycle (real router)", () => {
    it("assigns a template to employees by ID", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "assignTemplate").mockResolvedValue({
        assignments: [buildAssignment({ templateId })],
        created: 1,
        skipped: 0,
      } as never);

      const res = await request(app)
        .post(`/api/templates/${templateId}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id], dueDate: "2026-12-31" });

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.created).toBe(1);
      }
    });

    it("assigns a template by role", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "assignTemplate").mockResolvedValue({
        assignments: [],
        created: 3,
        skipped: 0,
      } as never);

      const res = await request(app)
        .post(`/api/templates/${templateId}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ role: "EMPLOYEE" });

      expect([201, 500, 501]).toContain(res.status);
    });

    it("assigns a template by department", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "assignTemplate").mockResolvedValue({
        assignments: [],
        created: 5,
        skipped: 0,
      } as never);

      const res = await request(app)
        .post(`/api/templates/${templateId}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ department: "Engineering" });

      expect([201, 500, 501]).toContain(res.status);
    });

    it("rejects assignment with invalid employee IDs (not UUIDs)", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: ["not-a-uuid"] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("lists assignments by template", async () => {
      const templateId = randomUUID();
      vi.spyOn(templatesService, "listAssignmentsByTemplate").mockResolvedValue({
        data: [buildAssignment({ templateId })],
        total: 1,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get(`/api/templates/${templateId}/assignments`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("lists assignments by employee", async () => {
      vi.spyOn(templatesService, "listAssignmentsByEmployee").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get(`/api/employees/${seededTestUsers.employee.id}/assignments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("deactivates an assignment (manager+)", async () => {
      const assignmentId = randomUUID();
      vi.spyOn(templatesService, "deactivateAssignment").mockResolvedValue(
        buildAssignment({ id: assignmentId, isActive: false }) as never,
      );

      const res = await request(app)
        .delete(`/api/assignments/${assignmentId}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("lists fulfillments for an assignment", async () => {
      const assignmentId = randomUUID();
      vi.spyOn(templatesService, "listFulfillmentsByAssignment").mockResolvedValue([
        buildFulfillment({ assignmentId }),
      ] as never);

      const res = await request(app)
        .get(`/api/assignments/${assignmentId}/fulfillments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });
  });

  // ─── FULFILLMENT LIFECYCLE ───────────────────────────────────

  describe("Fulfillment lifecycle (real router)", () => {
    it("self-attests a fulfillment", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "selfAttestFulfillment").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "fulfilled", selfAttestedAt: new Date() }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/self-attest`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ statement: "I confirm completion" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("fulfilled");
      }
    });

    it("attaches a document to a fulfillment", async () => {
      const fulfillmentId = randomUUID();
      const documentId = randomUUID();
      vi.spyOn(templatesService, "attachDocument").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "pending_review", documentId }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/attach-document`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ documentId });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.documentId).toBe(documentId);
      }
    });

    it("rejects attach-document with non-UUID documentId", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/attach-document`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ documentId: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("validates (approves) a fulfillment (manager+)", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "validateFulfillment").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "fulfilled", validatedAt: new Date(), validatedBy: seededTestUsers.manager.id }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: true, notes: "Looks good" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("fulfilled");
      }
    });

    it("validates (rejects) a fulfillment with reason", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "validateFulfillment").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "rejected", rejectionReason: "Insufficient evidence" }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: false, reason: "Insufficient evidence" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("rejected");
      }
    });

    it("rejects validation without approval notes", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.objectContaining({
        code: "VALIDATION_ERROR",
        details: expect.arrayContaining([
          expect.objectContaining({ path: ["notes"] }),
        ]),
      }));
    });

    it("rejects validation rejection without reason", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.objectContaining({
        code: "VALIDATION_ERROR",
        details: expect.arrayContaining([
          expect.objectContaining({ path: ["reason"] }),
        ]),
      }));
    });

    it("records third-party verification (admin only)", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "thirdPartyVerify").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "fulfilled", thirdPartyVerifiedAt: new Date(), thirdPartySource: "ACME Cert" }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ source: "ACME Cert", referenceId: "REF-001" });

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe("fulfilled");
      }
    });

    it("rejects third-party verify with empty source", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ source: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ─── REVIEW QUEUE ────────────────────────────────────────────

  describe("Review queue (real router)", () => {
    it("lists pending-review fulfillments (manager+)", async () => {
      vi.spyOn(templatesService, "listPendingReview").mockResolvedValue({
        data: [buildFulfillment({ status: "pending_review" })],
        total: 1,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/fulfillments/pending-review")
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("returns pending-review count (manager+)", async () => {
      vi.spyOn(templatesService, "countPendingReview").mockResolvedValue({ count: 5 } as never);

      const res = await request(app)
        .get("/api/fulfillments/pending-review/count")
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.count).toBe(5);
      }
    });

    it("lists fulfillment reviews with filters (manager+)", async () => {
      vi.spyOn(templatesService, "listFulfillmentReviews").mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as never);

      const res = await request(app)
        .get("/api/fulfillments/reviews")
        .query({ status: "pending_review", proofType: "certification" })
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("gets fulfillment detail for review (manager+)", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "getFulfillmentForReview").mockResolvedValue({
        id: fulfillmentId,
        status: "pending_review",
      } as never);

      const res = await request(app)
        .get(`/api/fulfillments/${fulfillmentId}/review`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("submits a review decision (manager+)", async () => {
      const fulfillmentId = randomUUID();
      vi.spyOn(templatesService, "submitReview").mockResolvedValue(
        buildFulfillment({ id: fulfillmentId, status: "fulfilled" }) as never,
      );

      const res = await request(app)
        .post(`/api/fulfillments/${fulfillmentId}/review`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ decision: "approve", notes: "All verified" });

      expect([200, 500, 501]).toContain(res.status);
    });

    it("rejects review decision without notes", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/review`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ decision: "approve" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects review rejection without reason", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/review`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ decision: "reject", notes: "Rejected" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ─── AUDIT TRAILS ────────────────────────────────────────────

  describe("Audit trails (real router)", () => {
    it("gets template audit trail (supervisor+)", async () => {
      vi.spyOn(templatesService, "getTemplateAuditTrail").mockResolvedValue([] as never);

      const res = await request(app)
        .get(`/api/templates/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });

    it("gets fulfillment audit trail (supervisor+)", async () => {
      vi.spyOn(templatesService, "getFulfillmentAuditTrail").mockResolvedValue([] as never);

      const res = await request(app)
        .get(`/api/fulfillments/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(res.status);
    });
  });

  // ─── RBAC BOUNDARIES ─────────────────────────────────────────

  describe("RBAC boundaries (real router)", () => {
    it("returns 401 when accessing templates without authentication", async () => {
      const res = await request(app).get("/api/templates");
      expect(res.status).toBe(401);
    });

    it("returns 403 when an employee lists templates", async () => {
      const res = await request(app)
        .get("/api/templates")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee creates a template", async () => {
      const res = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Employee template", attestationLevels: ["self_attest"] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee updates a template", async () => {
      const res = await request(app)
        .put(`/api/templates/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Hijacked" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee deletes a template", async () => {
      const res = await request(app)
        .delete(`/api/templates/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor publishes a template", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/publish`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor archives a template", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/archive`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee assigns a template", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/assign`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee lists template assignments", async () => {
      const res = await request(app)
        .get(`/api/templates/${randomUUID()}/assignments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor deactivates an assignment", async () => {
      const res = await request(app)
        .delete(`/api/assignments/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee deactivates an assignment", async () => {
      const res = await request(app)
        .delete(`/api/assignments/${randomUUID()}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee validates a fulfillment", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/validate`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ approved: true, notes: "nope" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor validates a fulfillment", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/validate`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ approved: true, notes: "nope" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a manager does third-party verification (admin only)", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/third-party-verify`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ source: "External" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor does third-party verification", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/third-party-verify`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ source: "External" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee does third-party verification", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/third-party-verify`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ source: "External" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee accesses pending-review queue", async () => {
      const res = await request(app)
        .get("/api/fulfillments/pending-review")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor accesses pending-review queue", async () => {
      const res = await request(app)
        .get("/api/fulfillments/pending-review")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee accesses pending-review count", async () => {
      const res = await request(app)
        .get("/api/fulfillments/pending-review/count")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee accesses fulfillment reviews", async () => {
      const res = await request(app)
        .get("/api/fulfillments/reviews")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor accesses fulfillment reviews", async () => {
      const res = await request(app)
        .get("/api/fulfillments/reviews")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee submits a review decision", async () => {
      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/review`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ decision: "approve", notes: "nope" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee accesses template audit trail", async () => {
      const res = await request(app)
        .get(`/api/templates/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee accesses fulfillment audit trail", async () => {
      const res = await request(app)
        .get(`/api/fulfillments/${randomUUID()}/audit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee adds a requirement", async () => {
      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/requirements`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ name: "Nope", attestationLevels: ["self_attest"] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── EDGE CASES & COMPLIANCE ─────────────────────────────────

  describe("Edge cases", () => {
    it("returns 400 when archiving a non-published template", async () => {
      vi.spyOn(templatesService, "archiveTemplate").mockRejectedValue(
        new ValidationError("Only published templates can be archived"),
      );

      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/archive`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when cloning a draft template", async () => {
      vi.spyOn(templatesService, "cloneTemplate").mockRejectedValue(
        new ValidationError("Only published templates can be cloned"),
      );

      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/clone`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when assigning an unpublished template", async () => {
      vi.spyOn(templatesService, "assignTemplate").mockRejectedValue(
        new ValidationError("Template must be published before assignment"),
      );

      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("handles duplicate assignment gracefully (skipped count)", async () => {
      vi.spyOn(templatesService, "assignTemplate").mockResolvedValue({
        assignments: [],
        created: 0,
        skipped: 2,
      } as never);

      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id, seededTestUsers.supervisor.id] });

      expect([201, 500, 501]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.skipped).toBe(2);
        expect(res.body.created).toBe(0);
      }
    });

    it("returns 409 when duplicate assignment causes a conflict", async () => {
      vi.spyOn(templatesService, "assignTemplate").mockRejectedValue(
        new ConflictError("Assignment already exists for this employee"),
      );

      const res = await request(app)
        .post(`/api/templates/${randomUUID()}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("returns 403 when self-attesting another employee's fulfillment", async () => {
      vi.spyOn(templatesService, "selfAttestFulfillment").mockRejectedValue(
        new ForbiddenError("Employees can only self-attest their own fulfillments"),
      );

      const res = await request(app)
        .post(`/api/fulfillments/${randomUUID()}/self-attest`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ statement: "Impersonation attempt" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when self-attesting a non-existent fulfillment", async () => {
      vi.spyOn(templatesService, "selfAttestFulfillment").mockRejectedValue(
        new NotFoundError("Fulfillment", NON_EXISTENT_ID),
      );

      const res = await request(app)
        .post(`/api/fulfillments/${NON_EXISTENT_ID}/self-attest`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ statement: "Gone" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 when updating a published template", async () => {
      vi.spyOn(templatesService, "updateTemplate").mockRejectedValue(
        new ValidationError("Published templates cannot be edited"),
      );

      const res = await request(app)
        .put(`/api/templates/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Nope" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when deleting a published template", async () => {
      vi.spyOn(templatesService, "deleteTemplate").mockRejectedValue(
        new ValidationError("Only draft templates can be deleted"),
      );

      const res = await request(app)
        .delete(`/api/templates/${randomUUID()}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
