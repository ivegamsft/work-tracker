import { QualificationStatus as PrismaQualificationStatus, type Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError, type AuditLog, type Qualification } from "@e-clat/shared";
import { prisma } from "../../config/database";
import { CreateQualificationInput, UpdateQualificationInput } from "./validators";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

type QualificationListFilters = {
  employeeId?: string;
  standardId?: string;
  status?: Qualification["status"];
  page?: number;
  limit?: number;
};

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

const standardSummarySelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  issuingBody: true,
  version: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ComplianceStandardSelect;

const qualificationBaseSelect = {
  id: true,
  employeeId: true,
  standardId: true,
  certificationName: true,
  issuingBody: true,
  issueDate: true,
  expirationDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    select: {
      documentId: true,
    },
  },
} satisfies Prisma.QualificationSelect;

const qualificationDetailSelect = {
  ...qualificationBaseSelect,
  employee: {
    select: employeePublicSelect,
  },
  standard: {
    select: standardSummarySelect,
  },
} satisfies Prisma.QualificationSelect;

const qualificationWithStandardSelect = {
  ...qualificationBaseSelect,
  standard: {
    select: standardSummarySelect,
  },
} satisfies Prisma.QualificationSelect;

type QualificationRecord = Prisma.QualificationGetPayload<{ select: typeof qualificationBaseSelect }>;
type QualificationDetailRecord = Prisma.QualificationGetPayload<{ select: typeof qualificationDetailSelect }>;
type QualificationWithStandardRecord = Prisma.QualificationGetPayload<{ select: typeof qualificationWithStandardSelect }>;
type PublicEmployee = Prisma.EmployeeGetPayload<{ select: typeof employeePublicSelect }>;
type StandardSummary = Prisma.ComplianceStandardGetPayload<{ select: typeof standardSummarySelect }>;

export interface QualificationWithStandard extends Qualification {
  standard: StandardSummary;
}

export interface QualificationDetails extends Qualification {
  employee: PublicEmployee;
  standard: StandardSummary;
}

export interface QualificationComplianceResult {
  compliant: boolean;
  employeeId: string;
  standardId: string;
  requirements: Array<{
    requirementId: string;
    name: string;
    met: boolean;
    qualification?: QualificationWithStandard;
  }>;
}

export interface QualificationsService {
  create(input: CreateQualificationInput): Promise<Qualification>;
  getById(id: string): Promise<QualificationDetails>;
  update(id: string, input: UpdateQualificationInput): Promise<Qualification>;
  listByEmployee(employeeId: string): Promise<QualificationWithStandard[]>;
  list(filters?: Record<string, unknown>): Promise<PaginatedResult<Qualification>>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
  checkCompliance(employeeId: string, standardId: string): Promise<QualificationComplianceResult>;
}

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateQualificationStatus(expirationDate?: Date | null): Qualification["status"] {
  if (!expirationDate) {
    return "active";
  }

  const today = dateOnly(new Date());
  const normalizedExpiration = dateOnly(expirationDate);
  const timeUntilExpiration = normalizedExpiration.getTime() - today.getTime();

  if (timeUntilExpiration < 0) {
    return "expired";
  }

  if (timeUntilExpiration <= THIRTY_DAYS_IN_MS) {
    return "expiring_soon";
  }

  return "active";
}

function toPrismaQualificationStatus(status: Qualification["status"]): PrismaQualificationStatus {
  switch (status) {
    case "active":
      return PrismaQualificationStatus.ACTIVE;
    case "expiring_soon":
      return PrismaQualificationStatus.EXPIRING_SOON;
    case "expired":
      return PrismaQualificationStatus.EXPIRED;
    case "pending_review":
      return PrismaQualificationStatus.PENDING_REVIEW;
    case "suspended":
      return PrismaQualificationStatus.SUSPENDED;
  }
}

function fromPrismaQualificationStatus(status: PrismaQualificationStatus): Qualification["status"] {
  switch (status) {
    case PrismaQualificationStatus.ACTIVE:
      return "active";
    case PrismaQualificationStatus.EXPIRING_SOON:
      return "expiring_soon";
    case PrismaQualificationStatus.EXPIRED:
      return "expired";
    case PrismaQualificationStatus.PENDING_REVIEW:
      return "pending_review";
    case PrismaQualificationStatus.SUSPENDED:
      return "suspended";
  }
}

function normalizeDocumentIds(documentIds?: string[]) {
  const ids = documentIds ?? [];
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length !== ids.length) {
    throw new ConflictError("Duplicate document IDs are not allowed on a qualification.");
  }

  return uniqueIds;
}

function validateQualificationDates(issueDate: Date, expirationDate?: Date | null) {
  if (expirationDate && expirationDate.getTime() < issueDate.getTime()) {
    throw new ValidationError("Qualification expirationDate cannot be earlier than issueDate.");
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

async function ensureStandardExists(standardId: string) {
  const standard = await prisma.complianceStandard.findUnique({
    where: { id: standardId },
    select: { id: true },
  });

  if (!standard) {
    throw new NotFoundError("ComplianceStandard", standardId);
  }
}

async function validateQualificationDocuments(employeeId: string, documentIds: string[]) {
  if (documentIds.length === 0) {
    return;
  }

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, employeeId: true },
  });

  if (documents.length !== documentIds.length) {
    const foundDocumentIds = new Set(documents.map((document) => document.id));
    const missingDocumentIds = documentIds.filter((documentId) => !foundDocumentIds.has(documentId));
    throw new ValidationError("One or more qualification documents were not found.", { missingDocumentIds });
  }

  const mismatchedDocumentIds = documents
    .filter((document) => document.employeeId !== employeeId)
    .map((document) => document.id);

  if (mismatchedDocumentIds.length > 0) {
    throw new ValidationError("Qualification documents must belong to the same employee.", { mismatchedDocumentIds });
  }
}

function mapQualification(record: QualificationRecord): Qualification {
  return {
    id: record.id,
    employeeId: record.employeeId,
    standardId: record.standardId,
    certificationName: record.certificationName,
    issuingBody: record.issuingBody,
    issueDate: record.issueDate,
    expirationDate: record.expirationDate,
    status: fromPrismaQualificationStatus(record.status),
    documentIds: record.documents.map((document) => document.documentId),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapQualificationDetails(record: QualificationDetailRecord): QualificationDetails {
  return {
    ...mapQualification(record),
    employee: record.employee,
    standard: record.standard,
  };
}

function mapQualificationWithStandard(record: QualificationWithStandardRecord): QualificationWithStandard {
  return {
    ...mapQualification(record),
    standard: record.standard,
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

function buildQualificationDocumentWrites(documentIds: string[]) {
  return documentIds.length > 0
    ? {
        create: documentIds.map((documentId) => ({
          document: {
            connect: { id: documentId },
          },
        })),
      }
    : undefined;
}

export const qualificationsService: QualificationsService = {
  async create(input) {
    validateQualificationDates(input.issueDate, input.expirationDate);
    const documentIds = normalizeDocumentIds(input.documentIds);

    await ensureEmployeeExists(input.employeeId);
    await ensureStandardExists(input.standardId);
    await validateQualificationDocuments(input.employeeId, documentIds);

    const qualification = await prisma.qualification.create({
      data: {
        employeeId: input.employeeId,
        standardId: input.standardId,
        certificationName: input.certificationName,
        issuingBody: input.issuingBody,
        issueDate: input.issueDate,
        expirationDate: input.expirationDate ?? null,
        status: toPrismaQualificationStatus(calculateQualificationStatus(input.expirationDate)),
        documents: buildQualificationDocumentWrites(documentIds),
      },
      select: qualificationBaseSelect,
    });

    return mapQualification(qualification);
  },

  async list(filters = {}) {
    const { employeeId, standardId, status, page = 1, limit = 20 } = filters as QualificationListFilters;
    const where: Prisma.QualificationWhereInput = {
      ...(employeeId ? { employeeId } : {}),
      ...(standardId ? { standardId } : {}),
      ...(status ? { status: toPrismaQualificationStatus(status) } : {}),
    };
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.qualification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expirationDate: "asc" }, { issueDate: "desc" }],
        select: qualificationBaseSelect,
      }),
      prisma.qualification.count({ where }),
    ]);

    return {
      data: data.map(mapQualification),
      total,
      page,
      limit,
    };
  },

  async getById(id) {
    const qualification = await prisma.qualification.findUnique({
      where: { id },
      select: qualificationDetailSelect,
    });

    if (!qualification) {
      throw new NotFoundError("Qualification", id);
    }

    return mapQualificationDetails(qualification);
  },

  async update(id, input) {
    const existing = await prisma.qualification.findUnique({
      where: { id },
      select: qualificationBaseSelect,
    });

    if (!existing) {
      throw new NotFoundError("Qualification", id);
    }

    const nextExpirationDate = input.expirationDate !== undefined ? input.expirationDate : existing.expirationDate;
    validateQualificationDates(existing.issueDate, nextExpirationDate);

    const documentIds = input.documentIds !== undefined ? normalizeDocumentIds(input.documentIds) : undefined;

    if (documentIds) {
      await validateQualificationDocuments(existing.employeeId, documentIds);
    }

    const nextStatus =
      input.expirationDate !== undefined
        ? calculateQualificationStatus(input.expirationDate)
        : input.status ?? fromPrismaQualificationStatus(existing.status);

    const qualification = await prisma.qualification.update({
      where: { id },
      data: {
        ...(input.certificationName !== undefined ? { certificationName: input.certificationName } : {}),
        ...(input.issuingBody !== undefined ? { issuingBody: input.issuingBody } : {}),
        ...(input.expirationDate !== undefined ? { expirationDate: input.expirationDate } : {}),
        status: toPrismaQualificationStatus(nextStatus),
        ...(documentIds !== undefined
          ? {
              documents: {
                deleteMany: {},
                ...buildQualificationDocumentWrites(documentIds),
              },
            }
          : {}),
      },
      select: qualificationBaseSelect,
    });

    return mapQualification(qualification);
  },

  async listByEmployee(employeeId) {
    await ensureEmployeeExists(employeeId);

    const qualifications = await prisma.qualification.findMany({
      where: { employeeId },
      orderBy: [{ expirationDate: "asc" }, { issueDate: "desc" }],
      select: qualificationWithStandardSelect,
    });

    return qualifications.map(mapQualificationWithStandard);
  },

  async getAuditTrail(id) {
    const auditTrail = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["qualification", "qualifications"] },
        recordId: id,
      },
      orderBy: { timestamp: "desc" },
    });

    return auditTrail.map(mapAuditLog);
  },

  async checkCompliance(employeeId, standardId) {
    await ensureEmployeeExists(employeeId);

    const standard = await prisma.complianceStandard.findUnique({
      where: { id: standardId },
      select: {
        id: true,
        requirements: {
          select: {
            id: true,
            category: true,
            description: true,
          },
          orderBy: { category: "asc" },
        },
      },
    });

    if (!standard) {
      throw new NotFoundError("ComplianceStandard", standardId);
    }

    const qualifications = await prisma.qualification.findMany({
      where: {
        employeeId,
        standardId,
        status: { in: [PrismaQualificationStatus.ACTIVE, PrismaQualificationStatus.EXPIRING_SOON] },
      },
      orderBy: [{ expirationDate: "desc" }, { issueDate: "desc" }],
      select: qualificationWithStandardSelect,
    });

    const qualifyingQualification = qualifications[0];
    const requirements = standard.requirements.map((requirement) => ({
      requirementId: requirement.id,
      name: requirement.category,
      met: Boolean(qualifyingQualification),
      ...(qualifyingQualification ? { qualification: mapQualificationWithStandard(qualifyingQualification) } : {}),
    }));

    return {
      compliant: requirements.every((requirement) => requirement.met),
      employeeId,
      standardId: standard.id,
      requirements,
    };
  },
};
