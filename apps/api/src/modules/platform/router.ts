import { Router } from "express";
import type { FeatureFlagEnvironment, FlagResolutionContext } from "@e-clat/shared";
import { UnauthorizedError } from "@e-clat/shared";
import { getFeatureFlagEnvironment } from "../../config/feature-flags";
import { authenticate, type AuthenticatedRequest } from "../../middleware";
import { featureFlagService, type FeatureFlagService } from "../../services/feature-flags";
import { getUptimeSeconds } from "../../config/telemetry";
import { checkDependencies, allHealthy, overallStatus } from "./service";

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

  // --- Health & Readiness (Issues #121, #127) ---

  router.get("/health", (_req, res) => {
    const status = "UP";
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: getUptimeSeconds(),
    });
  });

  router.get("/ready", async (_req, res) => {
    try {
      const deps = await checkDependencies();
      const checks: Record<string, "OK" | "FAILED"> = {};
      for (const [name, dep] of Object.entries(deps)) {
        checks[name] = dep.status;
      }
      const ready = allHealthy(deps);
      res.status(ready ? 200 : 503).json({
        status: ready ? "READY" : "NOT_READY",
        timestamp: new Date().toISOString(),
        checks,
      });
    } catch (_error) {
      res.status(503).json({
        status: "NOT_READY",
        timestamp: new Date().toISOString(),
        checks: { database: "FAILED", cache: "FAILED", auth: "FAILED" },
      });
    }
  });

  router.get("/detailed-health", async (_req, res) => {
    try {
      const deps = await checkDependencies();
      const status = overallStatus(deps);
      res.status(status === "DOWN" ? 503 : 200).json({
        status,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION ?? "0.4.0",
        environment: process.env.NODE_ENV ?? "development",
        uptime_seconds: getUptimeSeconds(),
        dependencies: deps,
      });
    } catch (_error) {
      res.status(503).json({
        status: "DOWN",
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION ?? "0.4.0",
        environment: process.env.NODE_ENV ?? "development",
        uptime_seconds: getUptimeSeconds(),
        dependencies: {},
      });
    }
  });

  // --- Feature Flags ---

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
