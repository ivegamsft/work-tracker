import { Router } from "express";
import { authenticate, requireRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "../../common/types";
import { param } from "../../common/utils";
import { notificationsService } from "./service";
import { setPreferencesSchema, notificationQuerySchema, createEscalationRuleSchema } from "./validators";

const router = Router();

// GET /api/notifications/preferences
router.get("/preferences", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const prefs = await notificationsService.getPreferences(req.user!.id);
    res.json(prefs);
  } catch (err) { next(err); }
});

// POST /api/notifications/preferences
router.post("/preferences", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = setPreferencesSchema.parse(req.body);
    const prefs = await notificationsService.setPreferences(req.user!.id, input);
    res.json(prefs);
  } catch (err) { next(err); }
});

// GET /api/notifications
router.get("/", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = notificationQuerySchema.parse(req.query);
    const result = await notificationsService.listNotifications(req.user!.id, query.page, query.limit);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const notification = await notificationsService.markAsRead(param(req, "id"), req.user!.id);
    res.json(notification);
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    await notificationsService.dismiss(param(req, "id"), req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/notifications/digest/weekly
router.get("/digest/weekly", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const digest = await notificationsService.getWeeklyDigest(req.user!.id);
    res.json(digest);
  } catch (err) { next(err); }
});

// POST /api/admin/notifications/test — Admin only
router.post("/admin/test", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await notificationsService.sendTestNotification(req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/admin/notifications/escalation-rules — Admin only
router.post("/admin/escalation-rules", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createEscalationRuleSchema.parse(req.body);
    const rule = await notificationsService.createEscalationRule(input);
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

// GET /api/admin/notifications/escalation-rules — Admin only
router.get("/admin/escalation-rules", authenticate, requireRole(Roles.ADMIN), async (_req: AuthenticatedRequest, res, next) => {
  try {
    const rules = await notificationsService.listEscalationRules();
    res.json(rules);
  } catch (err) { next(err); }
});

export { router as notificationsRouter };
