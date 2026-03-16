import {
  ConflictStatus as PrismaConflictStatus,
  ConflictType as PrismaConflictType,
  HourSource as PrismaHourSource,
  ResolutionMethod as PrismaResolutionMethod,
  type Prisma,
} from "@prisma/client";
import {
  AuditLog,
  ConflictError,
  HourConflict,
  HourRecord,
  NotFoundError,
  ValidationError,
} from "@e-clat/shared";
import { prisma } from "../../config/database";
import {
  ClockInInput,
  ClockOutInput,
  ManualEntryInput,
  PayrollImportInput,
  SchedulingImportInput,
  ResolveConflictInput,
  EditHourInput,
} from "./validators";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HoursService {
  clockIn(input: ClockInInput): Promise<HourRecord>;
  clockOut(input: ClockOutInput): Promise<HourRecord>;
  submitManualEntry(input: ManualEntryInput, submittedBy: string): Promise<HourRecord>;
  importPayroll(input: PayrollImportInput): Promise<{ imported: number; conflicts: number }>;
  importScheduling(input: SchedulingImportInput): Promise<{ imported: number; conflicts: number }>;
  syncCalendar(employeeId: string): Promise<{ synced: number }>;
  getEmployeeHours(employeeId: string, from?: Date, to?: Date, page?: number, limit?: number): Promise<PaginatedResult<HourRecord>>;
  listConflicts(page?: number, limit?: number): Promise<PaginatedResult<HourConflict>>;
  resolveConflict(conflictId: string, input: ResolveConflictInput, resolvedBy: string): Promise<HourConflict>;
  editHour(id: string, input: EditHourInput, editedBy: string): Promise<HourRecord>;
  deleteHour(id: string, reason: string, deletedBy: string): Promise<void>;
  getAuditTrail(recordId: string): Promise<AuditLog[]>;
}

type DbClient = typeof prisma | Prisma.TransactionClient;
type HourRecordRow = Prisma.HourRecordGetPayload<{ select: typeof hourRecordSelect }>;
type HourConflictRow = Prisma.HourConflictGetPayload<{ select: typeof hourConflictSelect }>;
type PayrollImportRecord = PayrollImportInput["records"][number];
type SchedulingImportRecord = SchedulingImportInput["records"][number];

const hourRecordSelect = {
  id: true,
  employeeId: true,
  source: true,
  date: true,
  hours: true,
  qualificationCategory: true,
  description: true,
  verifiedBy: true,
  verifiedAt: true,
  createdAt: true,
} satisfies Prisma.HourRecordSelect;

const hourConflictSelect = {
  id: true,
  conflictType: true,
  status: true,
  resolutionMethod: true,
  resolvedBy: true,
  resolvedAt: true,
  attestation: true,
  reason: true,
  createdAt: true,
  records: {
    select: {
      recordId: true,
      record: {
        select: hourRecordSelect,
      },
    },
  },
} satisfies Prisma.HourConflictSelect;

function normalizeDateOnly(value: Date): Date {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function toRoundedHours(start: Date, end: Date): number {
  return Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100;
}

function fromPrismaHourSource(source: PrismaHourSource): HourRecord["source"] {
  switch (source) {
    case PrismaHourSource.CLOCK_IN_OUT:
      return "clock_in_out";
    case PrismaHourSource.TIMESHEET_IMPORT:
      return "timesheet_import";
    case PrismaHourSource.JOB_TICKET_SYNC:
      return "job_ticket_sync";
    case PrismaHourSource.CALENDAR_SYNC:
      return "calendar_sync";
    case PrismaHourSource.MANUAL_ENTRY:
      return "manual_entry";
  }
}

function fromPrismaConflictType(type: PrismaConflictType): HourConflict["conflictType"] {
  switch (type) {
    case PrismaConflictType.DUPLICATE:
      return "duplicate";
    case PrismaConflictType.MISMATCH:
      return "mismatch";
  }
}

function fromPrismaConflictStatus(status: PrismaConflictStatus): HourConflict["status"] {
  switch (status) {
    case PrismaConflictStatus.PENDING:
      return "pending";
    case PrismaConflictStatus.RESOLVED:
      return "resolved";
  }
}

function fromPrismaResolutionMethod(method: PrismaResolutionMethod | null): HourConflict["resolutionMethod"] {
  if (!method) {
    return null;
  }

  switch (method) {
    case PrismaResolutionMethod.PRECEDENCE:
      return "precedence";
    case PrismaResolutionMethod.OVERRIDE:
      return "override";
    case PrismaResolutionMethod.MERGE:
      return "merge";
  }
}

function toPrismaResolutionMethod(method: ResolveConflictInput["resolutionMethod"]): PrismaResolutionMethod {
  switch (method) {
    case "precedence":
      return PrismaResolutionMethod.PRECEDENCE;
    case "override":
      return PrismaResolutionMethod.OVERRIDE;
    case "merge":
      return PrismaResolutionMethod.MERGE;
  }
}

function mapHourRecord(record: HourRecordRow): HourRecord {
  return {
    id: record.id,
    employeeId: record.employeeId,
    source: fromPrismaHourSource(record.source),
    date: record.date,
    hours: Number(record.hours),
    qualificationCategory: record.qualificationCategory,
    description: record.description,
    verifiedBy: record.verifiedBy,
    verifiedAt: record.verifiedAt,
    createdAt: record.createdAt,
  };
}

function mapHourConflict(record: HourConflictRow): HourConflict {
  return {
    id: record.id,
    recordIds: record.records.map((item) => item.recordId),
    conflictType: fromPrismaConflictType(record.conflictType),
    status: fromPrismaConflictStatus(record.status),
    resolutionMethod: fromPrismaResolutionMethod(record.resolutionMethod),
    resolvedBy: record.resolvedBy,
    resolvedAt: record.resolvedAt,
    attestation: record.attestation,
    reason: record.reason,
    createdAt: record.createdAt,
  };
}

function mapAuditLog(record: Prisma.AuditLogGetPayload<Record<string, never>>): AuditLog {
  const changedFields =
    record.changedFields && typeof record.changedFields === "object" && !Array.isArray(record.changedFields)
      ? (record.changedFields as Record<string, unknown>)
      : null;

  return {
    id: record.id,
    action: record.action as AuditLog["action"],
    recordId: record.recordId,
    entityType: record.entityType,
    changedFields,
    actor: record.actor,
    reason: record.reason,
    attestation: record.attestation,
    timestamp: record.timestamp,
  };
}

async function ensureEmployeeExists(db: DbClient, employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  if (!employee) {
    throw new NotFoundError("Employee", employeeId);
  }
}

async function ensureLabelExists(db: DbClient, labelId: string) {
  const label = await db.label.findUnique({
    where: { id: labelId },
    select: { id: true },
  });

  if (!label) {
    throw new NotFoundError("Label", labelId);
  }
}

async function createImportConflict(
  db: Prisma.TransactionClient,
  existingRecordId: string,
  importedRecordId: string,
) {
  await db.hourConflict.create({
    data: {
      conflictType: PrismaConflictType.MISMATCH,
      status: PrismaConflictStatus.PENDING,
      records: {
        create: [
          {
            record: {
              connect: { id: existingRecordId },
            },
          },
          {
            record: {
              connect: { id: importedRecordId },
            },
          },
        ],
      },
    },
  });
}

async function importHourRecords<T extends {
  employeeId: string;
  date: Date;
  hours: number;
  qualificationCategory: string;
  description?: string;
}>(
  records: readonly T[],
  source: PrismaHourSource,
  buildDescription: (record: T) => string,
  getLabelId?: (record: T) => string | undefined,
): Promise<{ imported: number; conflicts: number }> {
  let imported = 0;
  let conflicts = 0;

  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      await ensureEmployeeExists(tx, record.employeeId);

      const labelId = getLabelId?.(record);
      if (labelId) {
        await ensureLabelExists(tx, labelId);
      }

      const normalizedDate = normalizeDateOnly(record.date);
      const existing = await tx.hourRecord.findFirst({
        where: {
          employeeId: record.employeeId,
          date: normalizedDate,
          isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, hours: true },
      });

      if (existing && Number(existing.hours) === record.hours) {
        continue;
      }

      const created = await tx.hourRecord.create({
        data: {
          employeeId: record.employeeId,
          source,
          date: normalizedDate,
          hours: record.hours,
          qualificationCategory: record.qualificationCategory,
          description: buildDescription(record),
          labelId: labelId ?? null,
        },
        select: hourRecordSelect,
      });

      imported += 1;

      if (existing) {
        await createImportConflict(tx, existing.id, created.id);
        conflicts += 1;
      }
    }
  });

  return { imported, conflicts };
}

export const hoursService: HoursService = {
  async clockIn(input) {
    await ensureEmployeeExists(prisma, input.employeeId);

    const existingOpenRecord = await prisma.hourRecord.findFirst({
      where: {
        employeeId: input.employeeId,
        source: PrismaHourSource.CLOCK_IN_OUT,
        hours: 0,
        isDeleted: false,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingOpenRecord) {
      throw new ConflictError("Employee already has an open clock-in record.");
    }

    const timestamp = input.timestamp ?? new Date();
    const record = await prisma.hourRecord.create({
      data: {
        employeeId: input.employeeId,
        source: PrismaHourSource.CLOCK_IN_OUT,
        date: normalizeDateOnly(timestamp),
        hours: 0,
        qualificationCategory: "clock_in_out",
        description: "Clock-in pending clock-out",
        createdAt: timestamp,
      },
      select: hourRecordSelect,
    });

    return mapHourRecord(record);
  },

  async clockOut(input) {
    await ensureEmployeeExists(prisma, input.employeeId);

    const timestamp = input.timestamp ?? new Date();
    const record = await prisma.$transaction(async (tx) => {
      const openRecord = await tx.hourRecord.findFirst({
        where: {
          employeeId: input.employeeId,
          source: PrismaHourSource.CLOCK_IN_OUT,
          hours: 0,
          isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      });

      if (!openRecord) {
        throw new ValidationError("No open clock-in record found for this employee.");
      }

      if (timestamp <= openRecord.createdAt) {
        throw new ValidationError("Clock-out time must be after the open clock-in time.");
      }

      const hoursWorked = toRoundedHours(openRecord.createdAt, timestamp);
      if (hoursWorked <= 0 || hoursWorked > 24) {
        throw new ValidationError("Calculated hours must be greater than 0 and no more than 24.");
      }

      return tx.hourRecord.update({
        where: { id: openRecord.id },
        data: { hours: hoursWorked },
        select: hourRecordSelect,
      });
    });

    return mapHourRecord(record);
  },

  async submitManualEntry(input, _submittedBy) {
    if (input.hours > 24) {
      throw new ValidationError("Manual hour entries cannot exceed 24 hours.");
    }

    await ensureEmployeeExists(prisma, input.employeeId);
    if (input.labelId) {
      await ensureLabelExists(prisma, input.labelId);
    }

    const record = await prisma.hourRecord.create({
      data: {
        employeeId: input.employeeId,
        source: PrismaHourSource.MANUAL_ENTRY,
        date: normalizeDateOnly(input.date),
        hours: input.hours,
        qualificationCategory: input.qualificationCategory,
        description: input.description,
        labelId: input.labelId ?? null,
      },
      select: hourRecordSelect,
    });

    return mapHourRecord(record);
  },

  async importPayroll(input) {
    return importHourRecords(
      input.records,
      PrismaHourSource.TIMESHEET_IMPORT,
      (record: PayrollImportRecord) => record.description?.trim() || `Imported from payroll system ${input.sourceSystemId}`,
      (record: PayrollImportRecord) => record.labelId,
    );
  },

  async importScheduling(input) {
    return importHourRecords(
      input.records,
      PrismaHourSource.JOB_TICKET_SYNC,
      (record: SchedulingImportRecord) =>
        record.description?.trim() || `Imported from scheduling system ${input.sourceSystemId} job ${record.jobTicketId}`,
    );
  },

  async syncCalendar(employeeId) {
    await ensureEmployeeExists(prisma, employeeId);
    return { synced: 0 };
  },

  async getEmployeeHours(employeeId, from, to, page = 1, limit = 50) {
    await ensureEmployeeExists(prisma, employeeId);

    const boundedLimit = Math.min(limit, 100);
    const skip = (page - 1) * boundedLimit;
    const where: Prisma.HourRecordWhereInput = {
      employeeId,
      isDeleted: false,
      ...(from ? { date: { gte: normalizeDateOnly(from) } } : {}),
      ...(to
        ? {
            date: {
              ...(from ? { gte: normalizeDateOnly(from) } : {}),
              lte: normalizeDateOnly(to),
            },
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      prisma.hourRecord.findMany({
        where,
        skip,
        take: boundedLimit,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: hourRecordSelect,
      }),
      prisma.hourRecord.count({ where }),
    ]);

    return {
      data: records.map(mapHourRecord),
      total,
      page,
      limit: boundedLimit,
    };
  },

  async listConflicts(page = 1, limit = 50) {
    const boundedLimit = Math.min(limit, 100);
    const skip = (page - 1) * boundedLimit;
    const where = { status: PrismaConflictStatus.PENDING } satisfies Prisma.HourConflictWhereInput;

    const [conflicts, total] = await Promise.all([
      prisma.hourConflict.findMany({
        where,
        skip,
        take: boundedLimit,
        orderBy: { createdAt: "desc" },
        select: hourConflictSelect,
      }),
      prisma.hourConflict.count({ where }),
    ]);

    return {
      data: conflicts.map(mapHourConflict),
      total,
      page,
      limit: boundedLimit,
    };
  },

  async resolveConflict(conflictId, input, resolvedBy) {
    const existing = await prisma.hourConflict.findUnique({
      where: { id: conflictId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError("HourConflict", conflictId);
    }

    if (existing.status === PrismaConflictStatus.RESOLVED) {
      throw new ValidationError("Conflict has already been resolved.");
    }

    const conflict = await prisma.hourConflict.update({
      where: { id: conflictId },
      data: {
        status: PrismaConflictStatus.RESOLVED,
        resolutionMethod: toPrismaResolutionMethod(input.resolutionMethod),
        resolvedBy,
        resolvedAt: new Date(),
        attestation: input.attestation,
        reason: input.reason,
      },
      select: hourConflictSelect,
    });

    return mapHourConflict(conflict);
  },

  async editHour(id, input, _editedBy) {
    const existing = await prisma.hourRecord.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("HourRecord", id);
    }

    if (input.hours !== undefined && input.hours > 24) {
      throw new ValidationError("Hour edits cannot exceed 24 hours.");
    }

    if (
      input.hours === undefined
      && input.qualificationCategory === undefined
      && input.description === undefined
    ) {
      throw new ValidationError("At least one hour field must be provided to edit.");
    }

    const record = await prisma.hourRecord.update({
      where: { id },
      data: {
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.qualificationCategory !== undefined ? { qualificationCategory: input.qualificationCategory } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      select: hourRecordSelect,
    });

    return mapHourRecord(record);
  },

  async deleteHour(id, reason, _deletedBy) {
    const existing = await prisma.hourRecord.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("HourRecord", id);
    }

    await prisma.hourRecord.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedReason: reason,
      },
    });
  },

  async getAuditTrail(recordId) {
    const record = await prisma.hourRecord.findUnique({
      where: { id: recordId },
      select: { id: true },
    });

    if (!record) {
      throw new NotFoundError("HourRecord", recordId);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        recordId,
        entityType: { in: ["HourRecord", "hour_record", "hours"] },
      },
      orderBy: { timestamp: "desc" },
    });

    return auditLogs.map(mapAuditLog);
  },
};
