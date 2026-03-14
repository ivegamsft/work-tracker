import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env, loadEnv } from "./config/env";
import { errorHandler } from "./middleware";
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

export function createApp() {
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "e-clat", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/labels", labelsRouter);
  app.use("/api/hours", hoursRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/qualifications", qualificationsRouter);
  app.use("/api/medical", medicalRouter);
  app.use("/api/standards", standardsRouter);
  app.use("/api/notifications", notificationsRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

const app = createApp();

async function startServer() {
  await loadEnv();

  app.listen(env.PORT, () => {
    logger.info(`🚀 e-clat server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

if (require.main === module) {
  void startServer().catch((error: unknown) => {
    const startupError = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to start server", { error: startupError.message, stack: startupError.stack });
    process.exit(1);
  });
}

export default app;
