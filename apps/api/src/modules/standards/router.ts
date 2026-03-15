import { Router } from "express";
import { authenticate, requireRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { param } from "../../common/utils";
import { standardsService } from "./service";
import {
  createStandardSchema,
  updateStandardSchema,
  createRequirementSchema,
  updateRequirementSchema,
  standardQuerySchema,
} from "./validators";

const router = Router();

router.post("/", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createStandardSchema.parse(req.body);
    const standard = await standardsService.create(input);
    res.status(201).json(standard);
  } catch (err) { next(err); }
});

router.get("/", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = standardQuerySchema.parse(req.query);
    const result = await standardsService.list({
      ...query,
      page: req.query.page === undefined ? undefined : query.page,
      limit: req.query.limit === undefined ? undefined : query.limit,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const standard = await standardsService.getById(param(req, "id"));
    res.json(standard);
  } catch (err) { next(err); }
});

router.put("/:id", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateStandardSchema.parse(req.body);
    const standard = await standardsService.update(param(req, "id"), input);
    res.json(standard);
  } catch (err) { next(err); }
});

router.post("/:id/requirements", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { standardId, ...input } = createRequirementSchema.parse({ ...req.body, standardId: param(req, "id") });
    const requirement = await standardsService.createRequirement(standardId, input);
    res.status(201).json(requirement);
  } catch (err) { next(err); }
});

router.put("/requirements/:reqId", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateRequirementSchema.parse(req.body);
    const requirement = await standardsService.updateRequirement(param(req, "reqId"), input);
    res.json(requirement);
  } catch (err) { next(err); }
});

router.get("/:id/requirements", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const requirements = await standardsService.listRequirements(param(req, "id"));
    res.json(requirements);
  } catch (err) { next(err); }
});

export { router as standardsRouter };
