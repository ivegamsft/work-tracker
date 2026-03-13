import { Router } from "express";
import { authenticate, requireRole, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "../../common/types";
import { param } from "../../common/utils";
import { labelService } from "./service";
import {
  createLabelSchema,
  updateLabelSchema,
  deprecateLabelSchema,
  createLabelMappingSchema,
  resolveLabelQuery,
} from "./validators";

const router = Router();

router.post("/admin/labels", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createLabelSchema.parse(req.body);
    const label = await labelService.createLabel(input);
    res.status(201).json(label);
  } catch (err) { next(err); }
});

router.put("/admin/labels/:id", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateLabelSchema.parse(req.body);
    const label = await labelService.updateLabel(param(req, "id"), input);
    res.json(label);
  } catch (err) { next(err); }
});

router.post("/admin/labels/:id/deprecate", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = deprecateLabelSchema.parse(req.body);
    const label = await labelService.deprecateLabel(param(req, "id"), input);
    res.json(label);
  } catch (err) { next(err); }
});

router.get("/labels/versions", authenticate, async (_req: AuthenticatedRequest, res, next) => {
  try {
    const versions = await labelService.listVersions();
    res.json(versions);
  } catch (err) { next(err); }
});

router.post("/admin/label-mappings", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createLabelMappingSchema.parse(req.body);
    const mapping = await labelService.createMapping(input);
    res.status(201).json(mapping);
  } catch (err) { next(err); }
});

router.get("/labels/resolve", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = resolveLabelQuery.parse(req.query);
    const mapping = await labelService.resolveLabel(query.label, query.version);
    res.json(mapping);
  } catch (err) { next(err); }
});

router.get("/labels/audit/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await labelService.getAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

export { router as labelsRouter };
