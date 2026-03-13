import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware";
import { logger } from "./common/utils";

const app = express();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "e-clat", timestamp: new Date().toISOString() });
});

// API routes (mount modules here)
// app.use("/api/auth", authRouter);
// app.use("/api/employees", employeesRouter);
// app.use("/api/qualifications", qualificationsRouter);
// app.use("/api/hours", hoursRouter);
// app.use("/api/documents", documentsRouter);
// app.use("/api/standards", standardsRouter);
// app.use("/api/medical", medicalRouter);
// app.use("/api/notifications", notificationsRouter);

// Error handling
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`🚀 e-clat server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

export default app;
