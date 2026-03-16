import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type Employee,
  type MedicalClearance,
  type MedicalClearanceStatus,
  type Qualification,
  type QualificationStatus,
  type Role,
  type WorkforceCreateEmployeeRequest,
  type WorkforceMedicalReadinessItem,
  type WorkforceQualificationReadinessItem,
  type WorkforceUpdateEmployeeRequest,
} from "@e-clat/shared";
import {
  MedicalClearanceStatus as PrismaMedicalClearanceStatus,
  Prisma,
  QualificationStatus as PrismaQualificationStatus,
  Role as PrismaRole,
} from "@prisma/client";
import { prisma } from "../../config/database";
import type {
  EmployeeDetails,
  EmployeeListFilters,
  EmployeeReadiness,
  IEmployeeRepository,
  PaginatedResult,
} from "../interfaces";

type ReadinessStatus = EmployeeReadiness["overallStatus"];

type QualificationWithDocuments = Prisma.QualificationGetPayload<{
  include: { documents: { select: { documentId: true } } };
}>;

type EmployeeReadinessPayload = Prisma.EmployeeGetPayload<{
  select: {
    id: true;
    qualifications: {
      include: {
        standard: { select: { id: true; code: true; name: true } };
      };
    };
    medicalClearances: true;
  };
}>;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EXPIRING_SOON_DAYS = 30;
const READINESS_WEIGHT: Record<ReadinessStatus, number> = {
  non_compliant: 0,
  at_risk: 1,
  compliant: 2,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeText(value: string) {
  return value.trim();
}

function toPrismaRole(role: string): PrismaRole {
  const normalizedRole = role.trim().toUpperCase();

  if (!Object.values(PrismaRole).includes(normalizedRole as PrismaRole)) {
    throw new ValidationError(`Invalid role '${role}'`);
  }

  return normalizedRole as PrismaRole;
}

function fromPrismaRole(role: PrismaRole): Role {
  return role.toLowerCase() as Role;
}

function fromPrismaQualificationStatus(status: PrismaQualificationStatus): QualificationStatus {
  return status.toLowerCase() as QualificationStatus;
}

function fromPrismaMedicalStatus(status: PrismaMedicalClearanceStatus): MedicalClearanceStatus {
  return status.toLowerCase() as MedicalClearanceStatus;
}

function mapEmployee(record: Prisma.EmployeeGetPayload<object>): Employee {
  return {
    id: record.id,
    employeeNumber: record.employeeNumber,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    role: fromPrismaRole(record.role),
    departmentId: record.departmentId ?? "",
    hireDate: record.hireDate,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapQualification(record: Prisma.QualificationGetPayload<object>): Qualification {
  const qualification = record as QualificationWithDocuments;

  return {
    id: record.id,
    employeeId: record.employeeId,
    standardId: record.standardId,
    certificationName: record.certificationName,
    issuingBody: record.issuingBody,
    issueDate: record.issueDate,
    expirationDate: record.expirationDate,
    status: fromPrismaQualificationStatus(record.status),
    documentIds: qualification.documents?.map((document: { documentId: string }) => document.documentId) ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapMedicalClearance(record: Prisma.MedicalClearanceGetPayload<object>): MedicalClearance {
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

function hasExpired(expirationDate: Date | null, now = new Date()) {
  return expirationDate !== null && expirationDate.getTime() < now.getTime();
}

function isExpiringSoon(expirationDate: Date | null, now = new Date()) {
  if (!expirationDate || hasExpired(expirationDate, now)) {
    return false;
  }

  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + EXPIRING_SOON_DAYS);

  return expirationDate.getTime() <= threshold.getTime();
}

function getQualificationReadinessStatus(status: QualificationStatus, expirationDate: Date | null): ReadinessStatus {
  if (status === "expired" || status === "pending_review" || status === "suspended" || hasExpired(expirationDate)) {
    return "non_compliant";
  }

  if (status === "expiring_soon" || isExpiringSoon(expirationDate)) {
    return "at_risk";
  }

  return "compliant";
}

function getMedicalReadinessStatus(status: MedicalClearanceStatus, expirationDate: Date | null): ReadinessStatus {
  if (status !== "cleared" || hasExpired(expirationDate)) {
    return "non_compliant";
  }

  if (isExpiringSoon(expirationDate)) {
    return "at_risk";
  }

  return "compliant";
}

function compareReadiness(left: ReadinessStatus, right: ReadinessStatus) {
  return READINESS_WEIGHT[left] - READINESS_WEIGHT[right];
}

function pickBestQualification(
  current: WorkforceQualificationReadinessItem | undefined,
  next: WorkforceQualificationReadinessItem,
): WorkforceQualificationReadinessItem {
  if (!current) {
    return next;
  }

  const readinessComparison = compareReadiness(next.readinessStatus, current.readinessStatus);
  if (readinessComparison > 0) {
    return next;
  }

  if (readinessComparison < 0) {
    return current;
  }

  const nextExpiration = next.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const currentExpiration = current.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return nextExpiration >= currentExpiration ? next : current;
}

function pickBestMedicalClearance(
  current: WorkforceMedicalReadinessItem | undefined,
  next: WorkforceMedicalReadinessItem,
): WorkforceMedicalReadinessItem {
  if (!current) {
    return next;
  }

  const readinessComparison = compareReadiness(next.readinessStatus, current.readinessStatus);
  if (readinessComparison > 0) {
    return next;
  }

  if (readinessComparison < 0) {
    return current;
  }

  const nextExpiration = next.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const currentExpiration = current.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return nextExpiration >= currentExpiration ? next : current;
}

function buildEmployeeCreateData(input: WorkforceCreateEmployeeRequest): Prisma.EmployeeCreateInput {
  return {
    employeeNumber: normalizeText(input.employeeNumber),
    firstName: normalizeText(input.firstName),
    lastName: normalizeText(input.lastName),
    email: normalizeEmail(input.email),
    role: toPrismaRole(input.role),
    departmentId: normalizeText(input.departmentId),
    hireDate: input.hireDate,
    isActive: true,
  };
}

function buildEmployeeUpdateData(input: WorkforceUpdateEmployeeRequest): Prisma.EmployeeUpdateInput {
  const data: Prisma.EmployeeUpdateInput = {};

  if (input.firstName !== undefined) {
    data.firstName = normalizeText(input.firstName);
  }

  if (input.lastName !== undefined) {
    data.lastName = normalizeText(input.lastName);
  }

  if (input.email !== undefined) {
    data.email = normalizeEmail(input.email);
  }

  if (input.role !== undefined) {
    data.role = toPrismaRole(input.role);
  }

  if (input.departmentId !== undefined) {
    data.departmentId = normalizeText(input.departmentId);
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  return data;
}

function buildEmployeeWhere(filters: EmployeeListFilters = {}): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = {};
  const departmentFilter = filters.departmentId?.trim();

  if (departmentFilter) {
    where.departmentId = { contains: departmentFilter, mode: "insensitive" };
  }

  if (filters.role) {
    where.role = toPrismaRole(filters.role);
  }

  if (typeof filters.isActive === "boolean") {
    where.isActive = filters.isActive;
  }

  if (filters.search?.trim()) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { firstName: { contains: searchTerm, mode: "insensitive" } },
      { lastName: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { employeeNumber: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildQualificationReadinessItems(
  employee: EmployeeReadinessPayload,
  standards: Array<{ id: string; code: string; name: string }>,
): WorkforceQualificationReadinessItem[] {
  const byStandard = new Map<string, WorkforceQualificationReadinessItem>();

  for (const qualification of employee.qualifications) {
    const mappedStatus = fromPrismaQualificationStatus(qualification.status);
    const item: WorkforceQualificationReadinessItem = {
      qualificationId: qualification.id,
      standardId: qualification.standard.id,
      standardCode: qualification.standard.code,
      standardName: qualification.standard.name,
      certificationName: qualification.certificationName,
      expirationDate: qualification.expirationDate,
      status: mappedStatus,
      readinessStatus: getQualificationReadinessStatus(mappedStatus, qualification.expirationDate),
    };

    byStandard.set(qualification.standardId, pickBestQualification(byStandard.get(qualification.standardId), item));
  }

  return standards.map((standard) => {
    const existing = byStandard.get(standard.id);
    if (existing) {
      return existing;
    }

    return {
      qualificationId: null,
      standardId: standard.id,
      standardCode: standard.code,
      standardName: standard.name,
      certificationName: null,
      expirationDate: null,
      status: "missing",
      readinessStatus: "non_compliant",
    };
  });
}

function buildMedicalReadinessItems(employee: EmployeeReadinessPayload): WorkforceMedicalReadinessItem[] {
  if (employee.medicalClearances.length === 0) {
    return [
      {
        clearanceId: null,
        clearanceType: "Medical clearance",
        expirationDate: null,
        status: "missing",
        readinessStatus: "non_compliant",
      },
    ];
  }

  const byClearanceType = new Map<string, WorkforceMedicalReadinessItem>();

  for (const clearance of employee.medicalClearances) {
    const mappedStatus = fromPrismaMedicalStatus(clearance.status);
    const item: WorkforceMedicalReadinessItem = {
      clearanceId: clearance.id,
      clearanceType: clearance.clearanceType,
      expirationDate: clearance.expirationDate,
      status: mappedStatus,
      readinessStatus: getMedicalReadinessStatus(mappedStatus, clearance.expirationDate),
    };

    byClearanceType.set(
      clearance.clearanceType,
      pickBestMedicalClearance(byClearanceType.get(clearance.clearanceType), item),
    );
  }

  return [...byClearanceType.values()].sort((left, right) => left.clearanceType.localeCompare(right.clearanceType));
}

function resolveOverallReadiness(
  qualifications: WorkforceQualificationReadinessItem[],
  medicalClearances: WorkforceMedicalReadinessItem[],
): ReadinessStatus {
  const readinessItems = [...qualifications, ...medicalClearances];

  if (readinessItems.some((item) => item.readinessStatus === "non_compliant")) {
    return "non_compliant";
  }

  if (readinessItems.some((item) => item.readinessStatus === "at_risk")) {
    return "at_risk";
  }

  return "compliant";
}

function handleEmployeeConflict(error: unknown): never {
  const prismaError = error as Prisma.PrismaClientKnownRequestError | undefined;
  if (prismaError?.code === "P2002") {
    const target = Array.isArray(prismaError.meta?.target)
      ? prismaError.meta.target.join(", ")
      : String(prismaError.meta?.target ?? "record");
    throw new ConflictError(`Employee ${target} already exists`);
  }

  throw error;
}

export class PrismaEmployeeRepository {
  constructor(private readonly client = prisma) {}

  async create(input: WorkforceCreateEmployeeRequest): Promise<Employee> {
    const employeeData = buildEmployeeCreateData(input);
    const existingEmployee = await this.client.employee.findFirst({
      where: {
        OR: [{ email: employeeData.email }, { employeeNumber: employeeData.employeeNumber }],
      },
      select: { email: true, employeeNumber: true },
    });

    if (existingEmployee?.email === employeeData.email) {
      throw new ConflictError(`Employee email '${employeeData.email}' already exists`);
    }

    if (existingEmployee?.employeeNumber === employeeData.employeeNumber) {
      throw new ConflictError(`Employee number '${employeeData.employeeNumber}' already exists`);
    }

    try {
      const employee = await this.client.employee.create({ data: employeeData });
      return mapEmployee(employee);
    } catch (error) {
      return handleEmployeeConflict(error);
    }
  }

  async getById(id: string): Promise<EmployeeDetails> {
    const employee = await this.client.employee.findUnique({
      where: { id },
      include: {
        qualifications: {
          include: { documents: { select: { documentId: true } } },
          orderBy: [{ expirationDate: "asc" }, { updatedAt: "desc" }],
        },
        medicalClearances: {
          orderBy: [{ expirationDate: "asc" }, { updatedAt: "desc" }],
        },
      },
    });

    if (!employee) {
      throw new NotFoundError("Employee", id);
    }

    return {
      ...mapEmployee(employee),
      qualifications: employee.qualifications.map(mapQualification),
      medicalClearances: employee.medicalClearances.map(mapMedicalClearance),
    };
  }

  async update(id: string, input: WorkforceUpdateEmployeeRequest): Promise<Employee> {
    const existingEmployee = await this.client.employee.findUnique({ where: { id } });
    if (!existingEmployee) {
      throw new NotFoundError("Employee", id);
    }

    const data = buildEmployeeUpdateData(input);
    if (Object.keys(data).length === 0) {
      return mapEmployee(existingEmployee);
    }

    try {
      const employee = await this.client.employee.update({ where: { id }, data });
      return mapEmployee(employee);
    } catch (error) {
      return handleEmployeeConflict(error);
    }
  }

  async list(filters: EmployeeListFilters = {}): Promise<PaginatedResult<Employee>> {
    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const where = buildEmployeeWhere(filters);

    const [employees, total] = await this.client.$transaction([
      this.client.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.client.employee.count({ where }),
    ]);

    return {
      data: employees.map(mapEmployee),
      total,
      page,
      limit,
    };
  }

  async getReadiness(id: string): Promise<EmployeeReadiness> {
    const [employee, activeStandards] = await this.client.$transaction([
      this.client.employee.findUnique({
        where: { id },
        select: {
          id: true,
          qualifications: {
            include: { standard: { select: { id: true, code: true, name: true } } },
          },
          medicalClearances: true,
        },
      }),
      this.client.complianceStandard.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
    ]);

    if (!employee) {
      throw new NotFoundError("Employee", id);
    }

    const qualifications = buildQualificationReadinessItems(employee, activeStandards);
    const medicalClearances = buildMedicalReadinessItems(employee);

    return {
      employeeId: employee.id,
      overallStatus: resolveOverallReadiness(qualifications, medicalClearances),
      qualifications,
      medicalClearances,
    };
  }
}

export const prismaEmployeeRepository = new PrismaEmployeeRepository() as IEmployeeRepository;
