import { MedicalClearanceStatus as PrismaMedicalClearanceStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError, type AuditLog, type MedicalClearance } from "@e-clat/shared";
import { prisma } from "../../config/database";
import { CreateMedicalClearanceInput, UpdateMedicalClearanceInput } from "./validators";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const employeePublicSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  departmentId: true,
  hireDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmployeeSelect;

const medicalBaseSelect = {
  id: true,
  employeeId: true,
  clearanceType: true,
  status: true,
  effectiveDate: true,
  expirationDate: true,
  visualAcuityResult: true,
  colorVisionResult: true,
  issuedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicalClearanceSelect;

const medicalDetailSelect = {
  ...medicalBaseSelect,
  employee: {
    select: employeePublicSelect,
  },
} satisfies Prisma.MedicalClearanceSelect;

type MedicalRecord = Prisma.MedicalClearanceGetPayload<{ select: typeof medicalBaseSelect }>;
type MedicalDetailRecord = Prisma.MedicalClearanceGetPayload<{ select: typeof medicalDetailSelect }>;
type PublicEmployee = Prisma.EmployeeGetPayload<{ select: typeof employeePublicSelect }>;

export interface MedicalClearanceDetails extends MedicalClearance {
  employee: PublicEmployee;
}

export interface MedicalService {
  create(input: CreateMedicalClearanceInput): Promise<MedicalClearance>;
  getById(id: string): Promise<MedicalClearanceDetails>;
  update(id: string, input: UpdateMedicalClearanceInput): Promise<MedicalClearance>;
  listByEmployee(employeeId: string): Promise<MedicalClearance[]>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
}

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateMedicalStatus(
  expirationDate: Date | null | undefined,
  fallbackStatus: Exclude<MedicalClearance["status"], "expired"> = "cleared",
): MedicalClearance["status"] {
  if (expirationDate) {
    const today = dateOnly(new Date());
    const normalizedExpiration = dateOnly(expirationDate);

    if (normalizedExpiration.getTime() < today.getTime()) {
      return "expired";
    }
  }

  return fallbackStatus;
}

function toPrismaMedicalStatus(status: MedicalClearance["status"]): PrismaMedicalClearanceStatus {
  switch (status) {
    case "cleared":
      return PrismaMedicalClearanceStatus.CLEARED;
    case "pending":
      return PrismaMedicalClearanceStatus.PENDING;
    case "restricted":
      return PrismaMedicalClearanceStatus.RESTRICTED;
    case "expired":
      return PrismaMedicalClearanceStatus.EXPIRED;
  }
}

function fromPrismaMedicalStatus(status: PrismaMedicalClearanceStatus): MedicalClearance["status"] {
  switch (status) {
    case PrismaMedicalClearanceStatus.CLEARED:
      return "cleared";
    case PrismaMedicalClearanceStatus.PENDING:
      return "pending";
    case PrismaMedicalClearanceStatus.RESTRICTED:
      return "restricted";
    case PrismaMedicalClearanceStatus.EXPIRED:
      return "expired";
  }
}

function validateMedicalDates(effectiveDate: Date, expirationDate?: Date | null) {
  if (expirationDate && expirationDate.getTime() < effectiveDate.getTime()) {
    throw new ValidationError("Medical clearance expirationDate cannot be earlier than effectiveDate.");
  }
}

async function ensureEmployeeExists(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  if (!employee) {
    throw new NotFoundError("Employee", employeeId);
  }
}

function mapMedicalClearance(record: MedicalRecord): MedicalClearance {
  return {
    id: record.id,
    employeeId: record.employeeId,
    clearanceType: record.clearanceType,
    status: fromPrismaMedicalStatus(record.status),
    effectiveDate: record.effectiveDate,
    expirationDate: record.expirationDate,
    visualAcuityResult: record.visualAcuityResult,
    colorVisionResult: record.colorVisionResult,
    issuedBy: record.issuedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapMedicalClearanceDetails(record: MedicalDetailRecord): MedicalClearanceDetails {
  return {
    ...mapMedicalClearance(record),
    employee: record.employee,
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

export const medicalService: MedicalService = {
  async create(input) {
    validateMedicalDates(input.effectiveDate, input.expirationDate);
    await ensureEmployeeExists(input.employeeId);

    const clearance = await prisma.medicalClearance.create({
      data: {
        employeeId: input.employeeId,
        clearanceType: input.clearanceType,
        status: toPrismaMedicalStatus(
          calculateMedicalStatus(input.expirationDate, input.status === "expired" ? "cleared" : input.status),
        ),
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate ?? null,
        visualAcuityResult: input.visualAcuityResult ?? null,
        colorVisionResult: input.colorVisionResult ?? null,
        issuedBy: input.issuedBy,
      },
      select: medicalBaseSelect,
    });

    return mapMedicalClearance(clearance);
  },

  async getById(id) {
    const clearance = await prisma.medicalClearance.findUnique({
      where: { id },
      select: medicalDetailSelect,
    });

    if (!clearance) {
      throw new NotFoundError("MedicalClearance", id);
    }

    return mapMedicalClearanceDetails(clearance);
  },

  async update(id, input) {
    const existing = await prisma.medicalClearance.findUnique({
      where: { id },
      select: medicalBaseSelect,
    });

    if (!existing) {
      throw new NotFoundError("MedicalClearance", id);
    }

    const nextExpirationDate = input.expirationDate !== undefined ? input.expirationDate : existing.expirationDate;
    validateMedicalDates(existing.effectiveDate, nextExpirationDate);

    const resolvedFallbackStatus = input.status ?? (fromPrismaMedicalStatus(existing.status) === "expired" ? "cleared" : fromPrismaMedicalStatus(existing.status));
    const fallbackStatus = resolvedFallbackStatus === "expired" ? "cleared" : resolvedFallbackStatus;
    const nextStatus =
      input.expirationDate !== undefined
        ? calculateMedicalStatus(nextExpirationDate, fallbackStatus)
        : input.status ?? fromPrismaMedicalStatus(existing.status);

    const clearance = await prisma.medicalClearance.update({
      where: { id },
      data: {
        ...(input.expirationDate !== undefined ? { expirationDate: input.expirationDate } : {}),
        ...(input.visualAcuityResult !== undefined ? { visualAcuityResult: input.visualAcuityResult } : {}),
        ...(input.colorVisionResult !== undefined ? { colorVisionResult: input.colorVisionResult } : {}),
        status: toPrismaMedicalStatus(nextStatus),
      },
      select: medicalBaseSelect,
    });

    return mapMedicalClearance(clearance);
  },

  async listByEmployee(employeeId) {
    await ensureEmployeeExists(employeeId);

    const clearances = await prisma.medicalClearance.findMany({
      where: { employeeId },
      orderBy: [{ expirationDate: "desc" }, { effectiveDate: "desc" }],
      select: medicalBaseSelect,
    });

    return clearances.map(mapMedicalClearance);
  },

  async getAuditTrail(id) {
    const auditTrail = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["medical_clearance", "medical"] },
        recordId: id,
      },
      orderBy: { timestamp: "desc" },
    });

    return auditTrail.map(mapAuditLog);
  },
};
