import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "@e-clat/shared";
import { ZodError, type ZodIssue } from "zod";
import { logger } from "../common/utils";

type AppErrorLike = Error & {
  statusCode: number;
  code?: string;
  details?: unknown;
};

function sendAppError(res: Response, err: AppErrorLike) {
  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

function isAppErrorLike(err: unknown): err is AppErrorLike {
  if (!(err instanceof Error)) {
    return false;
  }

  const candidate = err as Partial<AppErrorLike>;

  return Number.isInteger(candidate.statusCode)
    && candidate.statusCode! >= 400
    && candidate.statusCode! < 600
    && (candidate.code === undefined || typeof candidate.code === "string");
}

function formatZodIssues(issues: ZodIssue[]) {
  return issues.map(({ code, message, path }) => ({ code, message, path }));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    sendAppError(res, new ValidationError("Validation failed", formatZodIssues(err.issues)));
    return;
  }

  if (err instanceof AppError || isAppErrorLike(err)) {
    sendAppError(res, err);
    return;
  }

  const unexpectedError = err instanceof Error ? err : new Error(String(err));

  logger.error("Unhandled error", { error: unexpectedError.message, stack: unexpectedError.stack });

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
