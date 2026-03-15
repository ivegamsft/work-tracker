import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ComplianceStandard,
  type StandardRequirement,
} from "@e-clat/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  CreateRequirementInput,
  CreateStandardInput,
  UpdateRequirementInput,
  UpdateStandardInput,
} from "./validators";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StandardListFilters {
  issuingBody?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

type CreateRequirementPayload = Omit<CreateRequirementInput, "standardId">;
type StandardWithRequirements = Prisma.ComplianceStandardGetPayload<{
  include: { requirements: true };
}>;

export interface StandardsService {
  create(input: CreateStandardInput): Promise<ComplianceStandard>;
  list(filters?: StandardListFilters): Promise<PaginatedResult<ComplianceStandard>>;
  getById(id: string): Promise<ComplianceStandard>;
  update(id: string, input: UpdateStandardInput): Promise<ComplianceStandard>;
  createRequirement(standardId: string, input: CreateRequirementPayload): Promise<StandardRequirement>;
  updateRequirement(id: string, input: UpdateRequirementInput): Promise<StandardRequirement>;
  listRequirements(standardId: string): Promise<StandardRequirement[]>;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function normalizeText(value: string) {
  return value.trim();
}

function validateRequiredText(field: string, value: string) {
  if (!value.trim()) {
    throw new ValidationError(`${field} is required`);
  }
}

function normalizeRequiredTests(requiredTests: string[] | undefined) {
  return (requiredTests ?? []).map((test) => test.trim()).filter(Boolean);
}

function mapRequirement(record: Prisma.StandardRequirementGetPayload<object>): StandardRequirement {
  return {
    id: record.id,
    standardId: record.standardId,
    category: record.category,
    description: record.description,
    minimumHours: record.minimumHours ? record.minimumHours.toNumber() : null,
    recertificationPeriodMonths: record.recertificationPeriodMonths,
    requiredTests: [...record.requiredTests],
  };
}

function mapStandard(record: StandardWithRequirements): ComplianceStandard {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    issuingBody: record.issuingBody,
    version: record.version,
    requirements: record.requirements.map(mapRequirement),
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildStandardCreateData(input: CreateStandardInput): Prisma.ComplianceStandardCreateInput {
  validateRequiredText("code", input.code);
  validateRequiredText("name", input.name);
  validateRequiredText("issuingBody", input.issuingBody);
  validateRequiredText("version", input.version);

  return {
    code: normalizeText(input.code),
    name: normalizeText(input.name),
    description: input.description.trim(),
    issuingBody: normalizeText(input.issuingBody),
    version: normalizeText(input.version),
    isActive: true,
  };
}

function buildStandardUpdateData(input: UpdateStandardInput): Prisma.ComplianceStandardUpdateInput {
  const data: Prisma.ComplianceStandardUpdateInput = {};

  if (input.name !== undefined) {
    validateRequiredText("name", input.name);
    data.name = normalizeText(input.name);
  }

  if (input.description !== undefined) {
    data.description = input.description.trim();
  }

  if (input.version !== undefined) {
    validateRequiredText("version", input.version);
    data.version = normalizeText(input.version);
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  return data;
}

function buildStandardWhere(filters: StandardListFilters = {}): Prisma.ComplianceStandardWhereInput {
  const where: Prisma.ComplianceStandardWhereInput = {};

  if (typeof filters.isActive === "boolean") {
    where.isActive = filters.isActive;
  }

  if (filters.issuingBody?.trim()) {
    where.issuingBody = { contains: filters.issuingBody.trim(), mode: "insensitive" };
  }

  if (filters.search?.trim()) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { code: { contains: searchTerm, mode: "insensitive" } },
      { name: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { issuingBody: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  return where;
}

async function ensureStandardExists(id: string) {
  const standard = await prisma.complianceStandard.findUnique({ where: { id }, select: { id: true } });
  if (!standard) {
    throw new NotFoundError("Compliance standard", id);
  }
}

function handleStandardConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : String(error.meta?.target ?? "record");
    throw new ConflictError(`Compliance standard ${target} already exists`);
  }

  throw error;
}

export const standardsService: StandardsService = {
  async create(input) {
    const data = buildStandardCreateData(input);

    try {
      const standard = await prisma.complianceStandard.create({
        data,
        include: { requirements: true },
      });

      return mapStandard(standard);
    } catch (error) {
      return handleStandardConflict(error);
    }
  },

  async list(filters = {}) {
    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const where = buildStandardWhere(filters);

    const [standards, total] = await prisma.$transaction([
      prisma.complianceStandard.findMany({
        where,
        include: { requirements: true },
        orderBy: [{ issuingBody: "asc" }, { code: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.complianceStandard.count({ where }),
    ]);

    return {
      data: standards.map(mapStandard),
      total,
      page,
      limit,
    };
  },

  async getById(id) {
    const standard = await prisma.complianceStandard.findUnique({
      where: { id },
      include: { requirements: true },
    });

    if (!standard) {
      throw new NotFoundError("Compliance standard", id);
    }

    return mapStandard(standard);
  },

  async update(id, input) {
    await ensureStandardExists(id);
    const data = buildStandardUpdateData(input);

    if (Object.keys(data).length === 0) {
      return this.getById(id);
    }

    try {
      const standard = await prisma.complianceStandard.update({
        where: { id },
        data,
        include: { requirements: true },
      });

      return mapStandard(standard);
    } catch (error) {
      return handleStandardConflict(error);
    }
  },

  async createRequirement(standardId, input) {
    await ensureStandardExists(standardId);
    validateRequiredText("category", input.category);

    const requirement = await prisma.standardRequirement.create({
      data: {
        standardId,
        category: normalizeText(input.category),
        description: input.description.trim(),
        minimumHours: input.minimumHours ?? null,
        recertificationPeriodMonths: input.recertificationPeriodMonths ?? null,
        requiredTests: normalizeRequiredTests(input.requiredTests),
      },
    });

    return mapRequirement(requirement);
  },

  async updateRequirement(id, input) {
    const existingRequirement = await prisma.standardRequirement.findUnique({ where: { id } });
    if (!existingRequirement) {
      throw new NotFoundError("Standard requirement", id);
    }

    const data: Prisma.StandardRequirementUpdateInput = {};

    if (input.category !== undefined) {
      validateRequiredText("category", input.category);
      data.category = normalizeText(input.category);
    }

    if (input.description !== undefined) {
      data.description = input.description.trim();
    }

    if (input.minimumHours !== undefined) {
      data.minimumHours = input.minimumHours;
    }

    if (input.recertificationPeriodMonths !== undefined) {
      data.recertificationPeriodMonths = input.recertificationPeriodMonths;
    }

    if (input.requiredTests !== undefined) {
      data.requiredTests = normalizeRequiredTests(input.requiredTests);
    }

    if (Object.keys(data).length === 0) {
      return mapRequirement(existingRequirement);
    }

    const requirement = await prisma.standardRequirement.update({
      where: { id },
      data,
    });

    return mapRequirement(requirement);
  },

  async listRequirements(standardId) {
    await ensureStandardExists(standardId);

    const requirements = await prisma.standardRequirement.findMany({
      where: { standardId },
      orderBy: [{ category: "asc" }, { id: "asc" }],
    });

    return requirements.map(mapRequirement);
  },
};
