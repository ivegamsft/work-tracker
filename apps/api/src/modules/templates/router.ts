import { Router } from "express";
import { authenticate, requireMinRole, requireRole, AuthenticatedRequest } from "../../middleware";
import { Roles, ValidationError } from "@e-clat/shared";
import { param } from "../../common/utils";
import { templatesService } from "./service";
import {
  assignTemplateSchema,
  attachDocumentSchema,
  createRequirementSchema,
  createTemplateSchema,
  fulfillmentReviewFiltersSchema,
  reorderRequirementsSchema,
  reviewDecisionSchema,
  selfAttestSchema,
  thirdPartyVerifySchema,
  updateRequirementSchema,
  updateTemplateSchema,
  validateFulfillmentSchema,
} from "./validators";

const templatesRouter = Router();
const assignmentsRouter = Router();
const fulfillmentsRouter = Router();
const employeeAssignmentsRouter = Router();

function actorFromRequest(req: AuthenticatedRequest) {
  return { id: req.user!.id, role: req.user!.role };
}

function queryParam(req: AuthenticatedRequest, name: string) {
  const value = req.query[name];
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function parsePositiveInt(value: string | undefined, field: string) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`${field} must be a positive number.`);
  }
  return parsed;
}

templatesRouter.get("/team", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listTeamTemplates({
      page: parsePositiveInt(queryParam(req, "page"), "page"),
      limit: parsePositiveInt(queryParam(req, "limit"), "limit"),
    }, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

templatesRouter.post("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createTemplateSchema.parse(req.body);
    const template = await templatesService.createTemplate(input, actorFromRequest(req));
    res.status(201).json(template);
  } catch (err) { next(err); }
});

templatesRouter.get("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listTemplates({
      status: queryParam(req, "status"),
      category: queryParam(req, "category"),
      standardId: queryParam(req, "standardId"),
      search: queryParam(req, "search"),
      page: parsePositiveInt(queryParam(req, "page"), "page"),
      limit: parsePositiveInt(queryParam(req, "limit"), "limit"),
    }, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

templatesRouter.post("/:id/publish", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const template = await templatesService.publishTemplate(param(req, "id"), actorFromRequest(req));
    res.json(template);
  } catch (err) { next(err); }
});

templatesRouter.post("/:id/archive", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const template = await templatesService.archiveTemplate(param(req, "id"), actorFromRequest(req));
    res.json(template);
  } catch (err) { next(err); }
});

templatesRouter.post("/:id/clone", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const template = await templatesService.cloneTemplate(param(req, "id"), actorFromRequest(req));
    res.status(201).json(template);
  } catch (err) { next(err); }
});

templatesRouter.post("/:id/assign", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = assignTemplateSchema.parse(req.body);
    const result = await templatesService.assignTemplate(param(req, "id"), input, actorFromRequest(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
});

templatesRouter.get("/:id/assignments", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listAssignmentsByTemplate(param(req, "id"), {
      page: parsePositiveInt(queryParam(req, "page"), "page"),
      limit: parsePositiveInt(queryParam(req, "limit"), "limit"),
    }, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

templatesRouter.post("/:id/requirements", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createRequirementSchema.parse(req.body);
    const requirement = await templatesService.addRequirement(param(req, "id"), input, actorFromRequest(req));
    res.status(201).json(requirement);
  } catch (err) { next(err); }
});

templatesRouter.put("/:id/requirements/reorder", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = reorderRequirementsSchema.parse(req.body);
    const requirements = await templatesService.reorderRequirements(param(req, "id"), input, actorFromRequest(req));
    res.json(requirements);
  } catch (err) { next(err); }
});

templatesRouter.put("/:id/requirements/:reqId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateRequirementSchema.parse(req.body);
    const requirement = await templatesService.updateRequirement(param(req, "id"), param(req, "reqId"), input, actorFromRequest(req));
    res.json(requirement);
  } catch (err) { next(err); }
});

templatesRouter.delete("/:id/requirements/:reqId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    await templatesService.removeRequirement(param(req, "id"), param(req, "reqId"), actorFromRequest(req));
    res.status(204).send();
  } catch (err) { next(err); }
});

templatesRouter.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await templatesService.getTemplateAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

templatesRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const template = await templatesService.getTemplate(param(req, "id"), actorFromRequest(req));
    res.json(template);
  } catch (err) { next(err); }
});

templatesRouter.put("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateTemplateSchema.parse(req.body);
    const template = await templatesService.updateTemplate(param(req, "id"), input, actorFromRequest(req));
    res.json(template);
  } catch (err) { next(err); }
});

templatesRouter.delete("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    await templatesService.deleteTemplate(param(req, "id"), actorFromRequest(req));
    res.status(204).send();
  } catch (err) { next(err); }
});

employeeAssignmentsRouter.get("/:id/assignments", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listAssignmentsByEmployee(param(req, "id"), {
      page: parsePositiveInt(queryParam(req, "page"), "page"),
      limit: parsePositiveInt(queryParam(req, "limit"), "limit"),
    }, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

assignmentsRouter.get("/:id/fulfillments", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listFulfillmentsByAssignment(param(req, "id"), actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

assignmentsRouter.delete("/:id", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const assignment = await templatesService.deactivateAssignment(param(req, "id"), actorFromRequest(req));
    res.json(assignment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.get("/reviews", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = fulfillmentReviewFiltersSchema.parse({
      status: queryParam(req, "status"),
      proofType: queryParam(req, "proofType"),
      employeeId: queryParam(req, "employeeId"),
      startDate: queryParam(req, "startDate"),
      endDate: queryParam(req, "endDate"),
      page: queryParam(req, "page"),
      limit: queryParam(req, "limit"),
    });
    const result = await templatesService.listFulfillmentReviews(filters, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

fulfillmentsRouter.get("/:id/review", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const detail = await templatesService.getFulfillmentForReview(param(req, "id"), actorFromRequest(req));
    res.json(detail);
  } catch (err) { next(err); }
});

fulfillmentsRouter.post("/:id/review", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = reviewDecisionSchema.parse(req.body);
    const fulfillment = await templatesService.submitReview(param(req, "id"), input, actorFromRequest(req));
    res.json(fulfillment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.get("/pending-review/count", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.countPendingReview(actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

fulfillmentsRouter.get("/pending-review", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await templatesService.listPendingReview({
      page: parsePositiveInt(queryParam(req, "page"), "page"),
      limit: parsePositiveInt(queryParam(req, "limit"), "limit"),
    }, actorFromRequest(req));
    res.json(result);
  } catch (err) { next(err); }
});

fulfillmentsRouter.post("/:id/self-attest", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = selfAttestSchema.parse(req.body);
    const fulfillment = await templatesService.selfAttestFulfillment(param(req, "id"), input, actorFromRequest(req));
    res.json(fulfillment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.post("/:id/attach-document", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = attachDocumentSchema.parse(req.body);
    const fulfillment = await templatesService.attachDocument(param(req, "id"), input, actorFromRequest(req));
    res.json(fulfillment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.post("/:id/validate", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = validateFulfillmentSchema.parse(req.body);
    const fulfillment = await templatesService.validateFulfillment(param(req, "id"), input, actorFromRequest(req));
    res.json(fulfillment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.post("/:id/third-party-verify", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = thirdPartyVerifySchema.parse(req.body);
    const fulfillment = await templatesService.thirdPartyVerify(param(req, "id"), input, actorFromRequest(req));
    res.json(fulfillment);
  } catch (err) { next(err); }
});

fulfillmentsRouter.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await templatesService.getFulfillmentAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

export { templatesRouter, assignmentsRouter, fulfillmentsRouter, employeeAssignmentsRouter };
