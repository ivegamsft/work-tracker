import type { Request, RequestHandler } from "express";
import { logger } from "../common/utils";
import type { AuthenticatedRequest } from "./auth";
import { ConsoleAuditLogger, type AuditEntry, type AuditLogger } from "../services/audit";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_FIELD_PATTERN = /(pass(word)?|token|secret|authorization)/i;

type RouteAwareRequest = Request & {
  route?: {
    path?: string | string[];
  };
};

export interface CreateAuditMiddlewareOptions {
  auditLogger?: AuditLogger;
  entityTypeResolver?: (req: Request) => string;
  recordIdResolver?: (req: Request, responseBody: unknown) => string;
}

export function createAuditMiddleware(options: CreateAuditMiddlewareOptions = {}): RequestHandler {
  const auditLogger = options.auditLogger ?? new ConsoleAuditLogger();
  const entityTypeResolver = options.entityTypeResolver ?? defaultEntityTypeResolver;
  const recordIdResolver = options.recordIdResolver ?? defaultRecordIdResolver;

  return (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    const entityType = entityTypeResolver(req);
    let responseBody: unknown;

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      responseBody = body;
      return originalJson(body);
    }) as typeof res.json;

    res.once("finish", () => {
      if (res.statusCode >= 400) {
        return;
      }

      const request = req as AuthenticatedRequest;
      const changedFields = buildChangedFields(req.body);
      const entry: AuditEntry = {
        action: `${method} ${buildActionPath(req, entityType)}`,
        entityType,
        recordId: recordIdResolver(req, responseBody),
        actor: request.user?.email ?? request.user?.id ?? "anonymous",
        ...(changedFields === undefined ? {} : { changedFields }),
        ...pickOptionalMetadata(req.body, "reason"),
        ...pickOptionalMetadata(req.body, "attestation"),
      };

      setImmediate(() => {
        Promise.resolve()
          .then(() => auditLogger.log(entry))
          .catch((error: unknown) => {
            const details = error instanceof Error
              ? { error: error.message, stack: error.stack }
              : { error: String(error) };

            logger.error("Failed to record audit log", {
              ...details,
              audit: entry,
            });
          });
      });
    });

    next();
  };
}

function defaultEntityTypeResolver(req: Request): string {
  if (typeof req.params.entityType === "string" && req.params.entityType.length > 0) {
    return req.params.entityType;
  }

  const segments = stripQuery(req.originalUrl).split("/").filter(Boolean);
  if (segments[0] === "api" && segments[1]) {
    return segments[1];
  }

  return "unknown";
}

function defaultRecordIdResolver(req: Request, responseBody: unknown): string {
  const paramRecordId = Object.values(req.params ?? {}).find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (paramRecordId) {
    return paramRecordId;
  }

  const responseRecordId = pickRecordId(responseBody);
  if (responseRecordId) {
    return responseRecordId;
  }

  const bodyRecordId = pickRecordId(req.body);
  if (bodyRecordId) {
    return bodyRecordId;
  }

  const request = req as AuthenticatedRequest;
  return request.user?.id ?? "unknown";
}

function buildActionPath(req: Request, entityType: string): string {
  const routePath = (req as RouteAwareRequest).route?.path;
  if (typeof routePath === "string") {
    if (routePath.startsWith("/api/")) {
      return normalizeRoutePath(routePath);
    }

    return normalizeRoutePath(`/api/${entityType}${routePath === "/" ? "" : routePath}`);
  }

  return stripQuery(req.originalUrl);
}

function pickRecordId(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["id", "recordId"]) {
    const candidate = value[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }

  if ("data" in value) {
    return pickRecordId(value.data);
  }

  return undefined;
}

function buildChangedFields(body: unknown): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (Array.isArray(body)) {
    return body.length > 0 ? body.map(sanitizeAuditValue) : undefined;
  }

  if (isRecord(body)) {
    return Object.keys(body).length > 0 ? sanitizeAuditValue(body) : undefined;
  }

  return sanitizeAuditValue(body);
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? "[REDACTED]" : sanitizeAuditValue(nestedValue),
    ]),
  );
}

function pickOptionalMetadata(body: unknown, key: "reason" | "attestation"): Partial<AuditEntry> {
  if (!isRecord(body)) {
    return {};
  }

  const value = body[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return { [key]: value.trim() } as Pick<AuditEntry, typeof key>;
  }

  return {};
}

function normalizeRoutePath(path: string): string {
  const normalized = path.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized.length > 0 ? normalized : "/";
}

function stripQuery(path: string): string {
  return path.split("?")[0] ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
