import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { Roles, type Role } from "@e-clat/shared";
import { errorHandler } from "../src/middleware";
import { authRouter } from "../src/modules/auth";
import { employeesRouter } from "../src/modules/employees";
import { labelsRouter } from "../src/modules/labels";
import { hoursRouter } from "../src/modules/hours";
import { documentsRouter } from "../src/modules/documents";
import { qualificationsRouter } from "../src/modules/qualifications";
import { medicalRouter } from "../src/modules/medical";
import { standardsRouter } from "../src/modules/standards";
import { notificationsRouter } from "../src/modules/notifications";

export function createTestApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "e-clat", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api", labelsRouter);
  app.use("/api/hours", hoursRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/qualifications", qualificationsRouter);
  app.use("/api/medical", medicalRouter);
  app.use("/api/standards", standardsRouter);
  app.use("/api/notifications", notificationsRouter);

  app.use(errorHandler);

  return app;
}

export function generateTestToken(role: Role = Roles.EMPLOYEE) {
  return jwt.sign(
    {
      id: `test-${role}-id`,
      email: `${role}@test.local`,
      role,
    },
    process.env.JWT_SECRET ?? "test-only-secret",
    {
      expiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
    },
  );
}
