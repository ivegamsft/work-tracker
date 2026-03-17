import { prisma } from "../../config/database";
import { logger } from "../../common/utils";
import type { DependencyStatus } from "./validators";

export interface DependencyCheckResult {
  database: DependencyStatus;
  cache: DependencyStatus;
  auth: DependencyStatus;
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "OK", latency_ms: Date.now() - start };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Database health check failed", { error: msg });
    return { status: "FAILED", latency_ms: Date.now() - start };
  }
}

async function checkCache(): Promise<DependencyStatus> {
  // Redis/cache not yet integrated — report OK with 0ms latency.
  // When a cache layer is added, replace this stub.
  return { status: "OK", latency_ms: 0 };
}

async function checkAuth(): Promise<DependencyStatus> {
  // Auth is local JWT validation — always available when the
  // process is running. Future: ping Entra discovery endpoint.
  return { status: "OK", latency_ms: 0 };
}

export async function checkDependencies(): Promise<DependencyCheckResult> {
  const [database, cache, auth] = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkAuth(),
  ]);

  return { database, cache, auth };
}

export function allHealthy(deps: DependencyCheckResult): boolean {
  return Object.values(deps).every((d) => d.status === "OK");
}

export function overallStatus(deps: DependencyCheckResult): "UP" | "DOWN" | "DEGRADED" {
  const statuses = Object.values(deps).map((d) => d.status);
  if (statuses.every((s) => s === "OK")) return "UP";
  if (statuses.every((s) => s === "FAILED")) return "DOWN";
  return "DEGRADED";
}
