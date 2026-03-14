import { logger } from "../common/utils";

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
    logger.warn("Prisma audit logger is not configured yet", {
      audit: {
        ...entry,
        timestamp: this.clock().toISOString(),
      },
    });
  }
}
