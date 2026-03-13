import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../common/errors";
import { Role, RoleHierarchy } from "../common/types";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

// Placeholder: replace with real JWT verification
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  // TODO: verify JWT token and attach user
  // const token = authHeader.split(" ")[1];
  // const decoded = jwt.verify(token, env.JWT_SECRET);
  // req.user = decoded;

  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (RoleHierarchy[req.user.role] < RoleHierarchy[minRole]) {
      return next(new ForbiddenError());
    }
    next();
  };
}
