import { Router } from "express";
import { Roles } from "@e-clat/shared";
import { authenticate, requireRole, requireMinRole, type AuthenticatedRequest } from "../../middleware";
import { param } from "../../common/utils";
import { identityService } from "./service";
import {
  createProviderSchema,
  updateProviderSchema,
  providerIdParamSchema,
  validateTokenSchema,
} from "./validators";
import { tokenValidator } from "../../common/auth/tokenValidator";

const router = Router();

// POST /api/v1/auth/providers — create identity provider (ADMIN only)
router.post("/providers", authenticate, requireRole(Roles.ADMIN), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createProviderSchema.parse(req.body);
    const provider = await identityService.createProvider(input, req.user!.id);
    res.status(201).json(provider);
  } catch (err) { next(err); }
});

// GET /api/v1/auth/providers — list active providers (COMPLIANCE_OFFICER+)
router.get("/providers", authenticate, requireMinRole(Roles.COMPLIANCE_OFFICER), async (_req, res, next) => {
  try {
    const providers = await identityService.listProviders();
    res.json(providers);
  } catch (err) { next(err); }
});

// GET /api/v1/auth/providers/:id — get single provider (COMPLIANCE_OFFICER+)
router.get("/providers/:id", authenticate, requireMinRole(Roles.COMPLIANCE_OFFICER), async (req, res, next) => {
  try {
    const { id } = providerIdParamSchema.parse({ id: param(req, "id") });
    const provider = await identityService.getProvider(id);
    res.json(provider);
  } catch (err) { next(err); }
});

// PUT /api/v1/auth/providers/:id — update provider (ADMIN only)
router.put("/providers/:id", authenticate, requireRole(Roles.ADMIN), async (req, res, next) => {
  try {
    const { id } = providerIdParamSchema.parse({ id: param(req, "id") });
    const input = updateProviderSchema.parse(req.body);
    const provider = await identityService.updateProvider(id, input);
    res.json(provider);
  } catch (err) { next(err); }
});

// DELETE /api/v1/auth/providers/:id — soft-delete provider (ADMIN only)
router.delete("/providers/:id", authenticate, requireRole(Roles.ADMIN), async (req, res, next) => {
  try {
    const { id } = providerIdParamSchema.parse({ id: param(req, "id") });
    await identityService.deleteProvider(id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/v1/auth/validate — validate token from any provider (all authenticated)
router.post("/validate", async (req, res, next) => {
  try {
    const input = validateTokenSchema.parse(req.body);
    const result = await tokenValidator.validate(input.token, input.provider_id);
    res.json(result);
  } catch (err) { next(err); }
});

export { router as identityRouter };
