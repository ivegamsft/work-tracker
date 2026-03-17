import { Request, Response, NextFunction } from "express";
import { logger } from "../common/utils";
import { getMeter } from "../config/telemetry";

let httpRequestsTotal: ReturnType<ReturnType<typeof getMeter>["createCounter"]> | undefined;
let httpRequestDuration: ReturnType<ReturnType<typeof getMeter>["createHistogram"]> | undefined;
let httpActiveRequests: ReturnType<ReturnType<typeof getMeter>["createUpDownCounter"]> | undefined;

function ensureMetrics() {
  if (httpRequestsTotal) return;
  const meter = getMeter();
  httpRequestsTotal = meter.createCounter("http_requests_total", {
    description: "Total HTTP requests by method, status, and path",
  });
  httpRequestDuration = meter.createHistogram("http_request_duration_ms", {
    description: "HTTP request latency in milliseconds",
    unit: "ms",
  });
  httpActiveRequests = meter.createUpDownCounter("http_active_requests", {
    description: "Number of in-flight HTTP requests",
  });
}

/** Normalise route path to avoid high-cardinality metric labels. */
function normalisePath(req: Request): string {
  // Use the matched route pattern when available (e.g. /api/employees/:id)
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }
  // Collapse UUIDs and numeric IDs
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+/g, "/:id");
}

/**
 * Structured request/response logging middleware.
 * Logs every request with correlation ID, method, path, status, and duration.
 * Also records OTel metrics (counters, histograms, gauges).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  ensureMetrics();

  const start = process.hrtime.bigint();
  const correlationId = req.correlationId ?? "unknown";

  httpActiveRequests!.add(1);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const status = res.statusCode;
    const method = req.method;
    const path = normalisePath(req);

    httpActiveRequests!.add(-1);
    httpRequestsTotal!.add(1, { method, status: String(status), path });
    httpRequestDuration!.record(durationMs, { method, path });

    const logData = {
      correlationId,
      method,
      path: req.path,
      status,
      durationMs: Math.round(durationMs * 100) / 100,
      userAgent: req.headers["user-agent"],
    };

    if (status >= 500) {
      logger.error("request completed", logData);
    } else if (status >= 400) {
      logger.warn("request completed", logData);
    } else {
      logger.info("request completed", logData);
    }
  });

  next();
}
