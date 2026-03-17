import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

const CORRELATION_HEADER = "x-correlation-id";
const TRACEPARENT_HEADER = "traceparent";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Injects or propagates a correlation ID on every request.
 * If the caller supplies `x-correlation-id`, it is reused;
 * otherwise a new UUID v4 is generated. The value is echoed
 * back on the response and also forwarded as W3C traceparent
 * when no traceparent header already exists.
 */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers[CORRELATION_HEADER];
  const id = typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();

  req.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);

  // W3C Trace Context propagation: if no traceparent exists,
  // synthesise one from the correlation ID so downstream services
  // can correlate. Format: version-traceId-spanId-flags
  if (!req.headers[TRACEPARENT_HEADER]) {
    const traceId = id.replace(/-/g, "");
    const spanId = uuidv4().replace(/-/g, "").slice(0, 16);
    res.setHeader(TRACEPARENT_HEADER, `00-${traceId}-${spanId}-01`);
  }

  next();
}
