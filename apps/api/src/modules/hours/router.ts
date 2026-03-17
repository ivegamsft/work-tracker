import { Router } from "express";
import { authenticate, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { param } from "../../common/utils";
import { hoursService } from "./service";
import {
  clockInSchema,
  clockOutSchema,
  manualEntrySchema,
  payrollImportSchema,
  schedulingImportSchema,
  resolveConflictSchema,
  editHourSchema,
  deleteHourSchema,
  hoursQuerySchema,
  progressQuerySchema,
  teamProgressQuerySchema,
} from "./validators";

const router = Router();

// POST /api/hours/clock-in
router.post("/clock-in", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = clockInSchema.parse(req.body);
    const record = await hoursService.clockIn(input);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// POST /api/hours/clock-out
router.post("/clock-out", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = clockOutSchema.parse(req.body);
    const record = await hoursService.clockOut(input);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// POST /api/hours/manual — Manual entry with attestation
router.post("/manual", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = manualEntrySchema.parse(req.body);
    const record = await hoursService.submitManualEntry(input, req.user!.id);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// POST /api/hours/import/payroll — Bulk payroll import (Supervisor+)
router.post("/import/payroll", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = payrollImportSchema.parse(req.body);
    const result = await hoursService.importPayroll(input);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/hours/import/scheduling — Job-ticket sync
router.post("/import/scheduling", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = schedulingImportSchema.parse(req.body);
    const result = await hoursService.importScheduling(input);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/hours/calendar/sync — OAuth calendar sync
router.post("/calendar/sync", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await hoursService.syncCalendar(req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/hours/progress — Authenticated employee's hours progress by proof type
router.get("/progress", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = progressQuerySchema.parse(req.query);
    const result = await hoursService.getEmployeeProgress(req.user!.id, filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/hours/team-progress — Team-wide hours progress (Supervisor+)
router.get("/team-progress", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = teamProgressQuerySchema.parse(req.query);
    const result = await hoursService.getTeamProgress(filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/hours/progress/:employeeId — Manager view of employee hours progress (Supervisor+)
router.get("/progress/:employeeId", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = progressQuerySchema.parse(req.query);
    const result = await hoursService.getEmployeeProgress(param(req, "employeeId"), filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/hours/employee/:id — Retrieve hours
router.get("/employee/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = hoursQuerySchema.parse(req.query);
    const result = await hoursService.getEmployeeHours(param(req, "id"), query.from, query.to, query.page, query.limit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/hours/conflicts — List unresolved conflicts (Manager+)
router.get("/conflicts", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = hoursQuerySchema.parse(req.query);
    const result = await hoursService.listConflicts(query.page, query.limit);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/hours/conflicts/:id/resolve — Resolve conflict with attestation
router.post("/conflicts/:id/resolve", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = resolveConflictSchema.parse(req.body);
    const conflict = await hoursService.resolveConflict(param(req, "id"), input, req.user!.id);
    res.json(conflict);
  } catch (err) { next(err); }
});

// PUT /api/hours/:id — Edit hour record with audit
router.put("/:id", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = editHourSchema.parse(req.body);
    const record = await hoursService.editHour(param(req, "id"), input, req.user!.id);
    res.json(record);
  } catch (err) { next(err); }
});

// DELETE /api/hours/:id — Soft-delete with reason
router.delete("/:id", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reason } = deleteHourSchema.parse(req.body);
    await hoursService.deleteHour(param(req, "id"), reason, req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/hours/:id/audit — Full audit trail
router.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await hoursService.getAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

export { router as hoursRouter };
