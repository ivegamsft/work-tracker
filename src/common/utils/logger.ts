import winston from "winston";
import { env } from "../../config/env";

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  defaultMeta: { service: "e-clat" },
  transports: [new winston.transports.Console()],
});
