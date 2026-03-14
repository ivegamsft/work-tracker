import { Router } from "express";
import { authenticate, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { param } from "../../common/utils";
import { medicalService } from "./service";
import { createMedicalClearanceSchema, updateMedicalClearanceSchema } from "./validators";

const router = Router();

router.post("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createMedicalClearanceSchema.parse(req.body);
    const clearance = await medicalService.create(input);
    res.status(201).json(clearance);
  } catch (err) { next(err); }
});

router.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const clearance = await medicalService.getById(param(req, "id"));
    res.json(clearance);
  } catch (err) { next(err); }
});

router.put("/:id", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateMedicalClearanceSchema.parse(req.body);
    const clearance = await medicalService.update(param(req, "id"), input);
    res.json(clearance);
  } catch (err) { next(err); }
});

router.get("/employee/:employeeId", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const clearances = await medicalService.listByEmployee(param(req, "employeeId"));
    res.json(clearances);
  } catch (err) { next(err); }
});

router.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await medicalService.getAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

export { router as medicalRouter };
