import { Router } from "express";
import type { FeatureFlagEnvironment, FlagResolutionContext } from "@e-clat/shared";
import { UnauthorizedError } from "@e-clat/shared";
import { getFeatureFlagEnvironment } from "../../config/feature-flags";
import { authenticate, type AuthenticatedRequest } from "../../middleware";
import { featureFlagService, type FeatureFlagService } from "../../services/feature-flags";

export interface CreatePlatformRouterOptions {
  featureFlags?: FeatureFlagService;
  resolveEnvironment?: () => FeatureFlagEnvironment;
}

function buildFlagContext(req: AuthenticatedRequest, environment: FeatureFlagEnvironment): FlagResolutionContext {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  return {
    userId: req.user.id,
    email: req.user.email,
    role: req.user.role,
    environment,
  };
}

export function createPlatformRouter(options: CreatePlatformRouterOptions = {}) {
  const router = Router();
  const featureFlags = options.featureFlags ?? featureFlagService;
  const resolveEnvironment = options.resolveEnvironment ?? getFeatureFlagEnvironment;

  router.get("/feature-flags", authenticate, (req: AuthenticatedRequest, res, next) => {
    try {
      const flags = featureFlags.getClientFlags(buildFlagContext(req, resolveEnvironment()));
      res.set("Cache-Control", "private, max-age=300");
      res.json(flags);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const platformRouter = createPlatformRouter();
