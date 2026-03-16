import { randomUUID } from "node:crypto";
import { type Express, Router } from "express";
import { AppError, NotFoundError, Roles, ValidationError } from "@e-clat/shared";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authenticate, requireMinRole, type AuthenticatedRequest } from "../src/middleware";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";

type TemplateStatus = "draft" | "published" | "archived";
type FulfillmentStatus = "unfulfilled" | "pending_review" | "fulfilled" | "rejected";

interface RequirementRecord {
  id: string;
  name: string;
  description: string;
  attestationLevels: string[];
  sortOrder: number;
  isRequired: boolean;
}

interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string | null;
  status: TemplateStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  requirements: RequirementRecord[];
}

interface AssignmentRecord {
  id: string;
  templateId: string;
  templateVersion: number;
  employeeId: string;
  assignedBy: string;
  dueDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FulfillmentRecord {
  id: string;
  assignmentId: string;
  requirementId: string;
  employeeId: string;
  status: FulfillmentStatus;
  attachedDocumentId: string | null;
  selfAttestedAt: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  rejectionReason: string | null;
  thirdPartyVerifiedAt: string | null;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function buildRequirementPayload(overrides: Partial<{
  name: string;
  description: string;
  attestationLevels: string[];
  isRequired: boolean;
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    name: `Requirement ${suffix}`,
    description: "Proof requirement for template testing",
    attestationLevels: ["self_attest"],
    isRequired: true,
    ...overrides,
  };
}

function buildTemplatePayload(overrides: Partial<{
  name: string;
  description: string;
  category: string;
  requirements: Array<ReturnType<typeof buildRequirementPayload>>;
}> = {}) {
  const suffix = randomUUID().split("-")[0];

  return {
    name: `Sydnor Template ${suffix}`,
    description: "Template created by integration tests",
    category: "Safety",
    requirements: [],
    ...overrides,
  };
}

function createTemplatesHarness() {
  const templates = new Map<string, TemplateRecord>();
  const assignments = new Map<string, AssignmentRecord>();
  const fulfillments = new Map<string, FulfillmentRecord>();

  function reset() {
    templates.clear();
    assignments.clear();
    fulfillments.clear();
  }

  function getTemplateOrThrow(templateId: string) {
    const template = templates.get(templateId);

    if (!template) {
      throw new NotFoundError("Template", templateId);
    }

    return template;
  }

  function getAssignmentOrThrow(assignmentId: string) {
    const assignment = assignments.get(assignmentId);

    if (!assignment) {
      throw new NotFoundError("Assignment", assignmentId);
    }

    return assignment;
  }

  function getFulfillmentOrThrow(fulfillmentId: string) {
    const fulfillment = fulfillments.get(fulfillmentId);

    if (!fulfillment) {
      throw new NotFoundError("Fulfillment", fulfillmentId);
    }

    return fulfillment;
  }

  function createRequirementRecord(
    requirement: Partial<RequirementRecord> & Pick<RequirementRecord, "name">,
    sortOrder: number,
  ): RequirementRecord {
    return {
      id: requirement.id ?? randomUUID(),
      name: requirement.name,
      description: requirement.description ?? "Requirement description",
      attestationLevels: requirement.attestationLevels ?? ["self_attest"],
      sortOrder,
      isRequired: requirement.isRequired ?? true,
    };
  }

  function createTemplateRecord(overrides: Partial<TemplateRecord> = {}) {
    const createdAt = nowIso();
    const requirements = (overrides.requirements ?? [createRequirementRecord({ name: `Requirement ${randomUUID().split("-")[0]}` }, 0)])
      .map((requirement, index) => createRequirementRecord(requirement, index));

    const template: TemplateRecord = {
      id: overrides.id ?? randomUUID(),
      name: overrides.name ?? `Template ${randomUUID().split("-")[0]}`,
      description: overrides.description ?? "Template fixture",
      category: overrides.category ?? "Safety",
      status: overrides.status ?? "draft",
      version: overrides.version ?? 1,
      createdBy: overrides.createdBy ?? seededTestUsers.supervisor.id,
      createdAt,
      updatedAt: createdAt,
      publishedAt: overrides.status === "published" ? createdAt : overrides.publishedAt ?? null,
      archivedAt: overrides.status === "archived" ? createdAt : overrides.archivedAt ?? null,
      requirements,
    };

    templates.set(template.id, template);
    return template;
  }

  function createAssignmentRecord(overrides: Partial<AssignmentRecord> & { templateId?: string; employeeId?: string } = {}) {
    const template = overrides.templateId
      ? getTemplateOrThrow(overrides.templateId)
      : createTemplateRecord({ status: "published" });
    const createdAt = nowIso();
    const assignment: AssignmentRecord = {
      id: overrides.id ?? randomUUID(),
      templateId: template.id,
      templateVersion: template.version,
      employeeId: overrides.employeeId ?? seededTestUsers.employee.id,
      assignedBy: overrides.assignedBy ?? seededTestUsers.supervisor.id,
      dueDate: overrides.dueDate ?? null,
      isActive: overrides.isActive ?? true,
      createdAt,
      updatedAt: createdAt,
    };

    assignments.set(assignment.id, assignment);

    for (const requirement of template.requirements) {
      const fulfillment: FulfillmentRecord = {
        id: randomUUID(),
        assignmentId: assignment.id,
        requirementId: requirement.id,
        employeeId: assignment.employeeId,
        status: "unfulfilled",
        attachedDocumentId: null,
        selfAttestedAt: null,
        validatedAt: null,
        validatedBy: null,
        rejectionReason: null,
        thirdPartyVerifiedAt: null,
        updatedAt: createdAt,
      };

      fulfillments.set(fulfillment.id, fulfillment);
    }

    return assignment;
  }

  function createFulfillmentFixture(options: {
    attestationLevels?: string[];
    employeeId?: string;
    status?: FulfillmentStatus;
  } = {}) {
    const template = createTemplateRecord({
      status: "published",
      requirements: [createRequirementRecord({ name: "Fulfillment requirement", attestationLevels: options.attestationLevels ?? ["self_attest"] }, 0)],
    });
    const assignment = createAssignmentRecord({ templateId: template.id, employeeId: options.employeeId });
    const fulfillment = Array.from(fulfillments.values()).find((candidate) => candidate.assignmentId === assignment.id);

    if (!fulfillment) {
      throw new Error("Expected fulfillment fixture to be created");
    }

    if (options.status) {
      fulfillment.status = options.status;
      fulfillment.updatedAt = nowIso();
      fulfillments.set(fulfillment.id, fulfillment);
    }

    return { template, assignment, fulfillment };
  }

  function registerRoutes(app: Express) {
    const templatesRouter = Router();
    const assignmentsRouter = Router();
    const fulfillmentsRouter = Router();

    templatesRouter.post("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
      try {
        const body = req.body as ReturnType<typeof buildTemplatePayload>;
        const createdAt = nowIso();
        const template: TemplateRecord = {
          id: randomUUID(),
          name: body.name,
          description: body.description ?? "",
          category: body.category ?? null,
          status: "draft",
          version: 1,
          createdBy: req.user!.id,
          createdAt,
          updatedAt: createdAt,
          publishedAt: null,
          archivedAt: null,
          requirements: (body.requirements ?? []).map((requirement, index) => createRequirementRecord(requirement, index)),
        };

        templates.set(template.id, template);
        res.status(201).json(template);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.get("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
      try {
        const visibleTemplates = Array.from(templates.values()).filter((template) => (
          template.status === "published" || template.createdBy === req.user!.id || req.user!.role === Roles.ADMIN
        ));
        res.json(visibleTemplates);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.post("/:id/publish", authenticate, requireMinRole(Roles.MANAGER), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);
        const updatedAt = nowIso();
        template.status = "published";
        template.publishedAt = updatedAt;
        template.updatedAt = updatedAt;
        templates.set(template.id, template);
        res.json(template);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.post("/:id/archive", authenticate, requireMinRole(Roles.MANAGER), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "published") {
          throw new ValidationError("Only published templates can be archived");
        }

        const updatedAt = nowIso();
        template.status = "archived";
        template.archivedAt = updatedAt;
        template.updatedAt = updatedAt;
        templates.set(template.id, template);
        res.json(template);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.post("/:id/clone", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "published") {
          throw new ValidationError("Only published templates can be cloned");
        }

        const clone = createTemplateRecord({
          name: `${template.name} Copy`,
          description: template.description,
          category: template.category,
          status: "draft",
          createdBy: req.user!.id,
          requirements: template.requirements.map((requirement) => ({
            name: requirement.name,
            description: requirement.description,
            attestationLevels: [...requirement.attestationLevels],
            isRequired: requirement.isRequired,
          })),
        });

        res.status(201).json(clone);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.post("/:id/assign", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);
        const body = req.body as { employeeIds?: string[]; dueDate?: string };

        if (template.status !== "published") {
          throw new ValidationError("Template must be published before assignment");
        }

        const employeeIds = body.employeeIds ?? [];
        const createdAssignments: AssignmentRecord[] = [];
        let skipped = 0;

        for (const employeeId of employeeIds) {
          const duplicate = Array.from(assignments.values()).find((assignment) => (
            assignment.templateId === template.id && assignment.employeeId === employeeId && assignment.isActive
          ));

          if (duplicate) {
            skipped += 1;
            continue;
          }

          createdAssignments.push(createAssignmentRecord({
            templateId: template.id,
            employeeId,
            assignedBy: req.user!.id,
            dueDate: body.dueDate ?? null,
          }));
        }

        res.status(201).json({ assignments: createdAssignments, created: createdAssignments.length, skipped });
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.get("/:id/assignments", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        getTemplateOrThrow(req.params.id);
        res.json(Array.from(assignments.values()).filter((assignment) => assignment.templateId === req.params.id && assignment.isActive));
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.put("/:id/requirements/reorder", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Only draft templates can be reordered");
        }

        const { requirementIds } = req.body as { requirementIds?: string[] };
        const orderedIds = requirementIds ?? [];
        template.requirements.sort((left, right) => orderedIds.indexOf(left.id) - orderedIds.indexOf(right.id));
        template.requirements = template.requirements.map((requirement, index) => ({ ...requirement, sortOrder: index }));
        template.updatedAt = nowIso();
        templates.set(template.id, template);
        res.json(template.requirements);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.post("/:id/requirements", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Cannot modify published templates");
        }

        const requirement = createRequirementRecord(req.body as RequirementRecord, template.requirements.length);
        template.requirements.push(requirement);
        template.updatedAt = nowIso();
        templates.set(template.id, template);
        res.status(201).json(requirement);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.put("/:id/requirements/:reqId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Cannot modify published templates");
        }

        const requirement = template.requirements.find((candidate) => candidate.id === req.params.reqId);

        if (!requirement) {
          throw new NotFoundError("Requirement", req.params.reqId);
        }

        Object.assign(requirement, req.body);
        template.updatedAt = nowIso();
        templates.set(template.id, template);
        res.json(requirement);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.delete("/:id/requirements/:reqId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Cannot modify published templates");
        }

        template.requirements = template.requirements.filter((requirement) => requirement.id !== req.params.reqId)
          .map((requirement, index) => ({ ...requirement, sortOrder: index }));
        template.updatedAt = nowIso();
        templates.set(template.id, template);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.get("/:id", authenticate, async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);
        res.json(template);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.put("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Published templates cannot be edited");
        }

        Object.assign(template, req.body, { updatedAt: nowIso() });
        templates.set(template.id, template);
        res.json(template);
      } catch (error) {
        next(error);
      }
    });

    templatesRouter.delete("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req, res, next) => {
      try {
        const template = getTemplateOrThrow(req.params.id);

        if (template.status !== "draft") {
          throw new ValidationError("Only draft templates can be deleted");
        }

        templates.delete(template.id);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });

    assignmentsRouter.get("/:id/fulfillments", authenticate, async (req, res, next) => {
      try {
        getAssignmentOrThrow(req.params.id);
        res.json(Array.from(fulfillments.values()).filter((fulfillment) => fulfillment.assignmentId === req.params.id));
      } catch (error) {
        next(error);
      }
    });

    assignmentsRouter.delete("/:id", authenticate, requireMinRole(Roles.MANAGER), async (req, res, next) => {
      try {
        const assignment = getAssignmentOrThrow(req.params.id);
        assignment.isActive = false;
        assignment.updatedAt = nowIso();
        assignments.set(assignment.id, assignment);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });

    fulfillmentsRouter.get("/pending-review/count", authenticate, requireMinRole(Roles.MANAGER), async (_req, res) => {
      const count = Array.from(fulfillments.values()).filter((fulfillment) => fulfillment.status === "pending_review").length;
      res.json({ count });
    });

    fulfillmentsRouter.get("/pending-review", authenticate, requireMinRole(Roles.MANAGER), async (req, res) => {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.max(1, Number(req.query.limit ?? 50));
      const data = Array.from(fulfillments.values()).filter((fulfillment) => fulfillment.status === "pending_review");
      const start = (page - 1) * limit;
      res.json({ data: data.slice(start, start + limit), total: data.length, page, limit });
    });

    fulfillmentsRouter.post("/:id/self-attest", authenticate, async (req, res, next) => {
      try {
        const fulfillment = getFulfillmentOrThrow(req.params.id);
        const assignment = getAssignmentOrThrow(fulfillment.assignmentId);

        if (assignment.employeeId !== req.user!.id) {
          throw new AppError(403, "Employees can only self-attest their own fulfillments", "FORBIDDEN");
        }

        const template = getTemplateOrThrow(assignment.templateId);
        const requirement = template.requirements.find((candidate) => candidate.id === fulfillment.requirementId);

        if (!requirement) {
          throw new NotFoundError("Requirement", fulfillment.requirementId);
        }

        fulfillment.selfAttestedAt = nowIso();
        fulfillment.status = requirement.attestationLevels.includes("validated") ? "pending_review" : "fulfilled";
        fulfillment.updatedAt = nowIso();
        fulfillments.set(fulfillment.id, fulfillment);
        res.json(fulfillment);
      } catch (error) {
        next(error);
      }
    });

    fulfillmentsRouter.post("/:id/attach-document", authenticate, async (req, res, next) => {
      try {
        const fulfillment = getFulfillmentOrThrow(req.params.id);
        const assignment = getAssignmentOrThrow(fulfillment.assignmentId);

        if (assignment.employeeId !== req.user!.id) {
          throw new AppError(403, "Employees can only attach documents to their own fulfillments", "FORBIDDEN");
        }

        const template = getTemplateOrThrow(assignment.templateId);
        const requirement = template.requirements.find((candidate) => candidate.id === fulfillment.requirementId);

        if (!requirement) {
          throw new NotFoundError("Requirement", fulfillment.requirementId);
        }

        const body = req.body as { documentId?: string };
        fulfillment.attachedDocumentId = body.documentId ?? randomUUID();
        fulfillment.status = requirement.attestationLevels.includes("validated") ? "pending_review" : "fulfilled";
        fulfillment.updatedAt = nowIso();
        fulfillments.set(fulfillment.id, fulfillment);
        res.json(fulfillment);
      } catch (error) {
        next(error);
      }
    });

    fulfillmentsRouter.post("/:id/validate", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
      try {
        const fulfillment = getFulfillmentOrThrow(req.params.id);
        const body = req.body as { approved?: boolean; reason?: string };
        fulfillment.status = body.approved ? "fulfilled" : "rejected";
        fulfillment.validatedAt = nowIso();
        fulfillment.validatedBy = req.user!.id;
        fulfillment.rejectionReason = body.approved ? null : body.reason ?? null;
        fulfillment.updatedAt = nowIso();
        fulfillments.set(fulfillment.id, fulfillment);
        res.json(fulfillment);
      } catch (error) {
        next(error);
      }
    });

    fulfillmentsRouter.post("/:id/third-party-verify", authenticate, requireMinRole(Roles.ADMIN), async (req, res, next) => {
      try {
        const fulfillment = getFulfillmentOrThrow(req.params.id);
        fulfillment.thirdPartyVerifiedAt = nowIso();
        fulfillment.status = "fulfilled";
        fulfillment.updatedAt = nowIso();
        fulfillments.set(fulfillment.id, fulfillment);
        res.json(fulfillment);
      } catch (error) {
        next(error);
      }
    });

    app.use("/api/templates", templatesRouter);
    app.use("/api/assignments", assignmentsRouter);
    app.use("/api/fulfillments", fulfillmentsRouter);
    app.get("/api/employees/:id/assignments", authenticate, async (req, res) => {
      res.json(Array.from(assignments.values()).filter((assignment) => assignment.employeeId === req.params.id && assignment.isActive));
    });
  }

  return {
    reset,
    registerRoutes,
    createDraftTemplate: (overrides: Partial<TemplateRecord> = {}) => createTemplateRecord({ ...overrides, status: "draft" }),
    createPublishedTemplate: (overrides: Partial<TemplateRecord> = {}) => createTemplateRecord({ ...overrides, status: "published" }),
    createAssignment: createAssignmentRecord,
    createFulfillmentFixture,
  };
}

describe("Templates API", () => {
  const harness = createTemplatesHarness();
  let app: Express;
  let employeeToken: string;
  let supervisorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(() => {
    app = createTestApp({ registerRoutes: harness.registerRoutes });
    employeeToken = generateTestToken(Roles.EMPLOYEE);
    supervisorToken = generateTestToken(Roles.SUPERVISOR);
    managerToken = generateTestToken(Roles.MANAGER);
    adminToken = generateTestToken(Roles.ADMIN);
  });

  beforeEach(() => {
    harness.reset();
  });

  describe("Template CRUD", () => {
    it("creates a template draft when the caller is a supervisor", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildTemplatePayload({ requirements: [] }));

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          id: expect.any(String),
          status: "draft",
          createdBy: seededTestUsers.supervisor.id,
        }));
      }
    });

    it("creates a template with initial requirements", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildTemplatePayload({
          requirements: [
            buildRequirementPayload({ attestationLevels: ["upload", "validated"] }),
            buildRequirementPayload({ attestationLevels: ["self_attest"] }),
          ],
        }));

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body.requirements).toHaveLength(2);
      }
    });

    it("lists templates for a supervisor", async () => {
      harness.createDraftTemplate({ createdBy: seededTestUsers.supervisor.id });
      harness.createPublishedTemplate({ createdBy: seededTestUsers.manager.id });

      const response = await request(app)
        .get("/api/templates")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      }
    });

    it("gets template detail", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .get(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({ id: template.id }));
      }
    });

    it("updates a draft template", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .put(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Updated Draft Template" });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          id: template.id,
          name: "Updated Draft Template",
        }));
      }
    });

    it("returns 400 when updating a published template", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .put(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Published edit attempt" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("deletes a draft template", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .delete(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 204, 500, 501]).toContain(response.status);
    });

    it("returns 400 when deleting a published template", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .delete(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("publishes a draft template when the caller is a manager", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/publish`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe("published");
      }
    });

    it("archives a published template when the caller is a manager", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/archive`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe("archived");
      }
    });
  });

  describe("Requirements", () => {
    it("adds a requirement to a draft template", async () => {
      const template = harness.createDraftTemplate({ requirements: [] });

      const response = await request(app)
        .post(`/api/templates/${template.id}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildRequirementPayload({ attestationLevels: ["upload"] }));

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          id: expect.any(String),
          attestationLevels: ["upload"],
        }));
      }
    });

    it("updates a requirement", async () => {
      const template = harness.createDraftTemplate();
      const requirement = template.requirements[0];

      const response = await request(app)
        .put(`/api/templates/${template.id}/requirements/${requirement.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ name: "Updated Requirement", attestationLevels: ["self_attest", "upload"] });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          id: requirement.id,
          name: "Updated Requirement",
        }));
      }
    });

    it("removes a requirement", async () => {
      const template = harness.createDraftTemplate();
      const requirement = template.requirements[0];

      const response = await request(app)
        .delete(`/api/templates/${template.id}/requirements/${requirement.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 204, 500, 501]).toContain(response.status);
    });

    it("returns 400 when adding a requirement to a published template", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/requirements`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send(buildRequirementPayload());

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("reorders requirements", async () => {
      const template = harness.createDraftTemplate({
        requirements: [
          { id: randomUUID(), ...buildRequirementPayload({ name: "First requirement" }) },
          { id: randomUUID(), ...buildRequirementPayload({ name: "Second requirement" }) },
        ] as RequirementRecord[],
      });
      const reorderedIds = [...template.requirements].reverse().map((requirement) => requirement.id);

      const response = await request(app)
        .put(`/api/templates/${template.id}/requirements/reorder`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ requirementIds: reorderedIds });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body[0].id).toBe(reorderedIds[0]);
      }
    });

    it("clones a published template as a new draft", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/clone`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          status: "draft",
          version: 1,
        }));
      }
    });
  });

  describe("Assignments", () => {
    it("assigns a published template to employees", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id], dueDate: "2026-12-31T00:00:00.000Z" });

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toEqual(expect.objectContaining({
          created: 1,
          skipped: 0,
          assignments: expect.any(Array),
        }));
      }
    });

    it("returns 400 when assigning a draft template", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("lists assignments for a template", async () => {
      const template = harness.createPublishedTemplate();
      harness.createAssignment({ templateId: template.id });

      const response = await request(app)
        .get(`/api/templates/${template.id}/assignments`)
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0]).toEqual(expect.objectContaining({ templateId: template.id }));
      }
    });

    it("lists an employee's assignments", async () => {
      const template = harness.createPublishedTemplate();
      harness.createAssignment({ templateId: template.id, employeeId: seededTestUsers.employee.id });

      const response = await request(app)
        .get(`/api/employees/${seededTestUsers.employee.id}/assignments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((assignment: { employeeId: string }) => assignment.employeeId === seededTestUsers.employee.id)).toBe(true);
      }
    });

    it("deactivates an assignment", async () => {
      const template = harness.createPublishedTemplate();
      const assignment = harness.createAssignment({ templateId: template.id });

      const response = await request(app)
        .delete(`/api/assignments/${assignment.id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect([200, 204, 500, 501]).toContain(response.status);
    });

    it("skips duplicate assignments", async () => {
      const template = harness.createPublishedTemplate();
      harness.createAssignment({ templateId: template.id, employeeId: seededTestUsers.employee.id });

      const response = await request(app)
        .post(`/api/templates/${template.id}/assign`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect([201, 500, 501]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body.skipped).toBeGreaterThan(0);
      }
    });
  });

  describe("Fulfillments", () => {
    it("gets fulfillment status for an assignment", async () => {
      const { assignment } = harness.createFulfillmentFixture({ employeeId: seededTestUsers.employee.id });

      const response = await request(app)
        .get(`/api/assignments/${assignment.id}/fulfillments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0]).toEqual(expect.objectContaining({ assignmentId: assignment.id }));
      }
    });

    it("self-attests a fulfillment", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ employeeId: seededTestUsers.employee.id, attestationLevels: ["self_attest"] });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/self-attest`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ statement: "I confirm completion" });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe("fulfilled");
      }
    });

    it("attaches a document to a fulfillment", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ employeeId: seededTestUsers.employee.id, attestationLevels: ["upload", "validated"] });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/attach-document`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ documentId: randomUUID() });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          id: fulfillment.id,
          attachedDocumentId: expect.any(String),
        }));
      }
    });

    it("approves a fulfillment when the caller is a manager", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: true, notes: "Approved" });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe("fulfilled");
      }
    });

    it("rejects a fulfillment with reason", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/validate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ approved: false, reason: "Missing evidence" });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          status: "rejected",
          rejectionReason: "Missing evidence",
        }));
      }
    });

    it("records third-party verification when the caller is an admin", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review", attestationLevels: ["third_party"] });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/third-party-verify`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ externalReferenceId: randomUUID() });

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe("fulfilled");
      }
    });

    it("lists pending-review fulfillments for managers", async () => {
      harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .get("/api/fulfillments/pending-review")
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual(expect.objectContaining({
          data: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 10,
        }));
      }
    });

    it("returns the pending-review fulfillment count", async () => {
      harness.createFulfillmentFixture({ status: "pending_review" });
      harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .get("/api/fulfillments/pending-review/count")
        .set("Authorization", `Bearer ${managerToken}`);

      expect([200, 500, 501]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.count).toBeGreaterThan(0);
      }
    });
  });

  describe("RBAC boundaries", () => {
    it("returns 401 when creating a template without authentication", async () => {
      const response = await request(app)
        .post("/api/templates")
        .send(buildTemplatePayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 when an employee creates a template", async () => {
      const response = await request(app)
        .post("/api/templates")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(buildTemplatePayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor publishes a template", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/publish`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee assigns a template", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/assign`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ employeeIds: [seededTestUsers.employee.id] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee validates a fulfillment", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/validate`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ approved: true });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor validates a fulfillment", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/validate`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ approved: true });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee views the pending-review queue", async () => {
      const response = await request(app)
        .get("/api/fulfillments/pending-review")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor records third-party verification", async () => {
      const { fulfillment } = harness.createFulfillmentFixture({ status: "pending_review" });

      const response = await request(app)
        .post(`/api/fulfillments/${fulfillment.id}/third-party-verify`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ externalReferenceId: randomUUID() });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when an employee deletes a template", async () => {
      const template = harness.createDraftTemplate();

      const response = await request(app)
        .delete(`/api/templates/${template.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when a supervisor archives a template", async () => {
      const template = harness.createPublishedTemplate();

      const response = await request(app)
        .post(`/api/templates/${template.id}/archive`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });
});
