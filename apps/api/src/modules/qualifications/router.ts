import { Router } from "express";
import { authenticate, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { param } from "../../common/utils";
import { qualificationsService } from "./service";
import { createQualificationSchema, updateQualificationSchema, qualificationQuerySchema } from "./validators";

const router = Router();

router.post("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createQualificationSchema.parse(req.body);
    const qual = await qualificationsService.create(input);
    res.status(201).json(qual);
  } catch (err) { next(err); }
});

router.get("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = qualificationQuerySchema.parse(req.query);
    const result = await qualificationsService.list(query);
    res.json(result);
  } catch (err) { next(err); }
});

router.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const qual = await qualificationsService.getById(param(req, "id"));
    res.json(qual);
  } catch (err) { next(err); }
});

router.put("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateQualificationSchema.parse(req.body);
    const qual = await qualificationsService.update(param(req, "id"), input);
    res.json(qual);
  } catch (err) { next(err); }
});

router.get("/employee/:employeeId", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = qualificationQuerySchema.parse(req.query);
    const result = await qualificationsService.listByEmployee(param(req, "employeeId"), query.page, query.limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await qualificationsService.getAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

router.get("/compliance/:employeeId/:standardId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await qualificationsService.checkCompliance(param(req, "employeeId"), param(req, "standardId"));
    res.json(result);
  } catch (err) { next(err); }
});

export { router as qualificationsRouter };
