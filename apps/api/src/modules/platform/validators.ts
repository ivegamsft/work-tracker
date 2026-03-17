import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["UP", "DOWN"]),
  timestamp: z.string().datetime(),
  uptime_seconds: z.number().int().nonnegative(),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["READY", "NOT_READY"]),
  timestamp: z.string().datetime(),
  checks: z.record(z.enum(["OK", "FAILED"])),
});

export const dependencyStatusSchema = z.object({
  status: z.enum(["OK", "FAILED"]),
  latency_ms: z.number().int().nonnegative(),
});

export const detailedHealthResponseSchema = z.object({
  status: z.enum(["UP", "DOWN", "DEGRADED"]),
  timestamp: z.string().datetime(),
  version: z.string(),
  environment: z.string(),
  uptime_seconds: z.number().int().nonnegative(),
  dependencies: z.record(dependencyStatusSchema),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type DetailedHealthResponse = z.infer<typeof detailedHealthResponseSchema>;
