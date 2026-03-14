import { Router } from "express";
import { authenticate, requireRole, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { param } from "../../common/utils";
import { employeesService } from "./service";
import { createEmployeeSchema, updateEmployeeSchema, employeeQuerySchema } from "./validators";

const router = Router();

// POST /api/employees — Create (Admin only)
router.post("/", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createEmployeeSchema.parse(req.body);
    const employee = await employeesService.create(input);
    res.status(201).json(employee);
  } catch (err) { next(err); }
});

// GET /api/employees — List (Supervisor+)
router.get("/", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = employeeQuerySchema.parse(req.query);
    const result = await employeesService.list(query);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/employees/:id — Get by ID
router.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const employee = await employeesService.getById(param(req, "id"));
    res.json(employee);
  } catch (err) { next(err); }
});

// PUT /api/employees/:id — Update (Admin only)
router.put("/:id", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateEmployeeSchema.parse(req.body);
    const employee = await employeesService.update(param(req, "id"), input);
    res.json(employee);
  } catch (err) { next(err); }
});

// GET /api/employees/:id/readiness — Readiness dashboard
router.get("/:id/readiness", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const readiness = await employeesService.getReadiness(param(req, "id"));
    res.json(readiness);
  } catch (err) { next(err); }
});

export { router as employeesRouter };
