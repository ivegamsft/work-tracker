import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "../common/utils";

type GlobalPrisma = typeof globalThis & {
  __eClatPrisma?: PrismaClient;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }],
  });

  if (process.env.NODE_ENV === "development") {
    client.$on("query", (event: Prisma.QueryEvent) => {
      logger.debug("Prisma query", {
        durationMs: event.duration,
        query: event.query,
        target: event.target,
      });
    });
  }

  return client;
}

// Lazy singleton — PrismaClient is NOT created until first use
let _client: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!_client) {
    const g = globalThis as GlobalPrisma;
    _client = g.__eClatPrisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      g.__eClatPrisma = _client;
    }
  }
  return _client;
}

/**
 * Lazy proxy over PrismaClient. All property access is deferred until first
 * use, so the real client is only created after env vars (DATABASE_URL, etc.)
 * have been set — critical for test setup ordering.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});

export async function disconnectDatabase(context = "shutdown") {
  if (!_client) return;
  try {
    await _client.$disconnect();
    logger.info(`Prisma client disconnected (${context})`);
  } catch (error) {
    const disconnectError = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to disconnect Prisma client", {
      context,
      error: disconnectError.message,
      stack: disconnectError.stack,
    });
    throw disconnectError;
  }
}

/** Reset the singleton — for tests only. */
export function _resetPrismaClient() {
  _client = undefined;
  const g = globalThis as GlobalPrisma;
  delete g.__eClatPrisma;
}
