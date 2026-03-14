import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "../common/utils";

type GlobalPrisma = typeof globalThis & {
  __eClatPrisma?: PrismaClient;
};

function createPrismaClient() {
  const prisma = new PrismaClient({
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
    prisma.$on("query", (event: Prisma.QueryEvent) => {
      logger.debug("Prisma query", {
        durationMs: event.duration,
        query: event.query,
        target: event.target,
      });
    });
  }

  return prisma;
}

const globalForPrisma = globalThis as GlobalPrisma;

export const prisma = globalForPrisma.__eClatPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__eClatPrisma = prisma;
}

export async function disconnectDatabase(context = "shutdown") {
  try {
    await prisma.$disconnect();
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
