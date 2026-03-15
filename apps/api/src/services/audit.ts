import { logger } from "../common/utils";
import { prisma } from "../config/database";
import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  action: string;
  entityType: string;
  recordId: string;
  changedFields?: unknown;
  actor: string;
  reason?: string;
  attestation?: string;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}

type Clock = () => Date;

export class ConsoleAuditLogger implements AuditLogger {
  constructor(private readonly clock: Clock = () => new Date()) {}

  async log(entry: AuditEntry): Promise<void> {
    logger.info("Audit log recorded", {
      audit: {
        ...entry,
        timestamp: this.clock().toISOString(),
      },
    });
  }
}

export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly clock: Clock = () => new Date()) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      const timestamp = this.clock();
      
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          recordId: entry.recordId,
          changedFields: entry.changedFields as Prisma.InputJsonValue | undefined,
          actor: entry.actor,
          reason: entry.reason,
          attestation: entry.attestation,
          timestamp,
        },
      });

      logger.info("Audit log recorded", {
        audit: {
          ...entry,
          timestamp: timestamp.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to persist audit log", {
        error: error instanceof Error ? error.message : String(error),
        entry,
      });
    }
  }
}
