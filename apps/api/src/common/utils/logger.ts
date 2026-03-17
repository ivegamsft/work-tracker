import winston from "winston";
import { trace, context } from "@opentelemetry/api";

const isProduction = process.env.NODE_ENV === "production";

/** Injects OTel trace/span IDs into every log entry when a span is active. */
const otelContextFormat = winston.format((info) => {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    const spanCtx = activeSpan.spanContext();
    info.traceId = spanCtx.traceId;
    info.spanId = spanCtx.spanId;
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    otelContextFormat(),
    isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  defaultMeta: { service: "e-clat" },
  transports: [new winston.transports.Console()],
});
