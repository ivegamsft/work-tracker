import { Router } from "express";
import { authenticate, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "@e-clat/shared";
import { dashboardService } from "./service";
import { complianceSummaryQuerySchema, teamSummaryQuerySchema } from "./validators";

const router = Router();

// GET /api/dashboard/compliance-summary — Aggregate compliance status for an employee
router.get("/compliance-summary", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = complianceSummaryQuerySchema.parse(req.query);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await dashboardService.getComplianceSummary(query, actor);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/dashboard/team-summary — Team-level compliance rollup (Supervisor+)
router.get("/team-summary", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = teamSummaryQuerySchema.parse(req.query);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await dashboardService.getTeamSummary(query, actor);
    res.json(result);
  } catch (err) { next(err); }
});

export { router as dashboardRouter };
