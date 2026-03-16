import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env, loadEnv } from "./config/env";
import { disconnectDatabase, prisma } from "./config/database";
import { createAuditMiddleware, errorHandler } from "./middleware";
import { logger } from "./common/utils";
import { authRouter } from "./modules/auth";
import { employeesRouter } from "./modules/employees";
import { labelsRouter } from "./modules/labels";
import { hoursRouter } from "./modules/hours";
import { documentsRouter } from "./modules/documents";
import { qualificationsRouter } from "./modules/qualifications";
import { medicalRouter } from "./modules/medical";
import { standardsRouter } from "./modules/standards";
import { notificationsRouter } from "./modules/notifications";
import { assignmentsRouter, employeeAssignmentsRouter, fulfillmentsRouter, templatesRouter } from "./modules/templates";
import { PrismaAuditLogger, type AuditLogger } from "./services/audit";

export interface CreateAppOptions {
  auditLogger?: AuditLogger;
  registerRoutes?: (app: Express) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const auditLogger = options.auditLogger ?? new PrismaAuditLogger();

  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/:entityType", createAuditMiddleware({ auditLogger }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "e-clat", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/employees", employeeAssignmentsRouter);
  app.use("/api/labels", labelsRouter);
  app.use("/api/hours", hoursRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/qualifications", qualificationsRouter);
  app.use("/api/medical", medicalRouter);
  app.use("/api/standards", standardsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/assignments", assignmentsRouter);
  app.use("/api/fulfillments", fulfillmentsRouter);
  options.registerRoutes?.(app);

  // Error handling
  app.use(errorHandler);

  return app;
}

const app = createApp();

async function startServer() {
  await loadEnv();
  await prisma.$connect();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 e-clat server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info(`Received ${signal}. Shutting down API server.`);

    server.close((error) => {
      if (error) {
        logger.error("Failed to close HTTP server", { error: error.message, stack: error.stack });
        void disconnectDatabase(signal).finally(() => process.exit(1));
        return;
      }

      void disconnectDatabase(signal).finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) {
  void startServer().catch((error: unknown) => {
    const startupError = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to start server", { error: startupError.message, stack: startupError.stack });
    void disconnectDatabase("startup-failure").finally(() => process.exit(1));
  });
}

export default app;
