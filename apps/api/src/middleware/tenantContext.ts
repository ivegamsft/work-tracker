import type { Request, Response, NextFunction } from "express";
import { TenantResolver } from "../common/data/TenantResolver";
import type { TenantContext } from "../common/data/TenantContext";
import type { TenantLookup } from "../common/data/TenantResolver";

/**
 * Express middleware that resolves tenant context from the incoming request
 * and attaches it as `req.tenantContext`.
 *
 * Must run AFTER the authenticate middleware (so JWT claims are available).
 *
 * @see Decision #1 — Tiered Data Isolation
 * @see Decision #11 — Logical Partition Environments
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export function createTenantMiddleware(lookup: TenantLookup) {
  const resolver = new TenantResolver(lookup);

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.tenantContext = await resolver.resolve(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}
