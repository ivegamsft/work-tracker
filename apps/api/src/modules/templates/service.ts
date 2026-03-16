import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuditLog,
  type Role,
  Roles,
} from "@e-clat/shared";
import {
  AttestationLevel as PrismaAttestationLevel,
  FulfillmentStatus as PrismaFulfillmentStatus,
  Prisma,
  ProofType as PrismaProofType,
  Role as PrismaRole,
  TemplateStatus as PrismaTemplateStatus,
} from "@prisma/client";
import { prisma } from "../../config/database";
import { canValidateOwnProof, normalizeAttestationLevels as normalizeAttestationLevelsPolicy } from "./policies";
import {
  AssignTemplateInput,
  AttachDocumentInput,
  CreateRequirementInput,
  CreateTemplateInput,
  FulfillmentReviewFiltersInput,
  ReorderRequirementsInput,
  ReviewDecisionInput,
  SelfAttestInput,
  ThirdPartyVerifyInput,
  UpdateRequirementInput,
  UpdateTemplateInput,
  ValidateFulfillmentInput,
} from "./validators";

type TemplateStatus = "draft" | "published" | "archived";
type AttestationLevel = "self_attest" | "upload" | "third_party" | "validated";
type FulfillmentStatus = "unfulfilled" | "pending_review" | "fulfilled" | "expired" | "rejected";
type ProofType = "hours" | "certification" | "training" | "clearance" | "assessment" | "compliance";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProofRequirement {
  id: string;
  templateId: string;
  name: string;
  description: string;
  attestationLevels: AttestationLevel[];
  proofType: ProofType | null;
  proofSubType: string | null;
  typeConfig: Prisma.JsonValue | null;
  threshold: number | null;
  thresholdUnit: string | null;
  rollingWindowDays: number | null;
  universalCategory: string | null;
  qualificationType: string | null;
  medicalTestType: string | null;
  standardReqId: string | null;
  validityDays: number | null;
  renewalWarningDays: number | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProofTemplate {
  id: string;
  name: string;
  description: string;
  category: string | null;
  status: TemplateStatus;
  version: number;
  previousVersion: string | null;
  createdBy: string;
  updatedBy: string | null;
  standardId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  archivedAt: Date | null;
  requirements: ProofRequirement[];
}

export interface TemplateAssignment {
  id: string;
  templateId: string;
  templateVersion: number;
  employeeId: string | null;
  role: string | null;
  department: string | null;
  assignedBy: string;
  dueDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface TemplateAssignmentWithEmployee extends TemplateAssignment {
  employeeName: string | null;
  employeeEmail: string | null;
}

export interface TemplateAssignmentWithTemplate extends TemplateAssignment {
  templateName: string;
  templateStatus: TemplateStatus;
}

export interface ProofFulfillment {
  id: string;
  assignmentId: string;
  requirementId: string;
  employeeId: string;
  status: FulfillmentStatus;
  selfAttestedAt: Date | null;
  selfAttestation: string | null;
  uploadedAt: Date | null;
  documentId: string | null;
  thirdPartyVerifiedAt: Date | null;
  thirdPartySource: string | null;
  thirdPartyRefId: string | null;
  thirdPartyData: Prisma.JsonValue | null;
  validatedAt: Date | null;
  validatedBy: string | null;
  validatorNotes: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiresAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requirement?: ProofRequirement;
}

export interface TemplatesService {
  createTemplate(input: CreateTemplateInput, actor: Actor): Promise<ProofTemplate>;
  listTemplates(filters: TemplateListFilters, actor: Actor): Promise<PaginatedResult<ProofTemplate>>;
  getTemplate(id: string, actor: Actor): Promise<ProofTemplate>;
  updateTemplate(id: string, input: UpdateTemplateInput, actor: Actor): Promise<ProofTemplate>;
  deleteTemplate(id: string, actor: Actor): Promise<void>;
  publishTemplate(id: string, actor: Actor): Promise<ProofTemplate>;
  archiveTemplate(id: string, actor: Actor): Promise<ProofTemplate>;
  cloneTemplate(id: string, actor: Actor): Promise<ProofTemplate>;
  addRequirement(templateId: string, input: CreateRequirementInput, actor: Actor): Promise<ProofRequirement>;
  updateRequirement(templateId: string, requirementId: string, input: UpdateRequirementInput, actor: Actor): Promise<ProofRequirement>;
  removeRequirement(templateId: string, requirementId: string, actor: Actor): Promise<void>;
  reorderRequirements(templateId: string, input: ReorderRequirementsInput, actor: Actor): Promise<ProofRequirement[]>;
  assignTemplate(templateId: string, input: AssignTemplateInput, actor: Actor): Promise<{
    assignments: TemplateAssignmentWithEmployee[];
    created: number;
    skipped: number;
  }>;
  listAssignmentsByTemplate(templateId: string, filters: AssignmentListFilters, actor: Actor): Promise<PaginatedResult<TemplateAssignmentWithEmployee>>;
  listAssignmentsByEmployee(employeeId: string, filters: AssignmentListFilters, actor: Actor): Promise<PaginatedResult<TemplateAssignmentWithTemplate>>;
  deactivateAssignment(assignmentId: string, actor: Actor): Promise<TemplateAssignment>;
  listFulfillmentsByAssignment(assignmentId: string, actor: Actor): Promise<ProofFulfillment[]>;
  selfAttestFulfillment(fulfillmentId: string, input: SelfAttestInput, actor: Actor): Promise<ProofFulfillment>;
  attachDocument(fulfillmentId: string, input: AttachDocumentInput, actor: Actor): Promise<ProofFulfillment>;
  validateFulfillment(fulfillmentId: string, input: ValidateFulfillmentInput, actor: Actor): Promise<ProofFulfillment>;
  thirdPartyVerify(fulfillmentId: string, input: ThirdPartyVerifyInput, actor: Actor): Promise<ProofFulfillment>;
  listPendingReview(filters: AssignmentListFilters, actor: Actor): Promise<PaginatedResult<ProofFulfillment>>;
  countPendingReview(actor: Actor): Promise<{ count: number }>;
  getTemplateAuditTrail(id: string): Promise<AuditLog[]>;
  getFulfillmentAuditTrail(id: string): Promise<AuditLog[]>;
  listTeamTemplates(filters: TeamTemplateFilters, actor: Actor): Promise<PaginatedResult<TeamTemplateProgress>>;
  listFulfillmentReviews(filters: FulfillmentReviewFilters, actor: Actor): Promise<PaginatedResult<FulfillmentReviewItem>>;
  getFulfillmentForReview(id: string, actor: Actor): Promise<FulfillmentReviewDetail>;
  submitReview(id: string, input: ReviewDecisionInput, actor: Actor): Promise<ProofFulfillment>;
}

interface Actor {
  id: string;
  role: Role;
}

interface TemplateListFilters {
  status?: string;
  category?: string;
  standardId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AssignmentListFilters {
  page?: number;
  limit?: number;
}

interface TeamTemplateFilters {
  page?: number;
  limit?: number;
}

interface FulfillmentReviewFilters {
  status?: string;
  proofType?: string;
  employeeId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TeamTemplateProgress {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  assignments: {
    id: string;
    templateId: string;
    templateName: string;
    status: string;
    dueDate: Date | null;
    completedAt: Date | null;
    totalRequirements: number;
    fulfilledRequirements: number;
    completionPercentage: number;
    isOverdue: boolean;
    isAtRisk: boolean;
  }[];
  overallCompletionPercentage: number;
}

export interface FulfillmentReviewItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: string;
  templateName: string;
  requirementId: string;
  requirementName: string;
  proofType: ProofType | null;
  attestationLevels: AttestationLevel[];
  submittedAt: Date;
  status: FulfillmentStatus;
  isPriority: boolean;
}

export interface FulfillmentReviewDetail extends ProofFulfillment {
  employeeName: string;
  employeeEmail: string;
  templateName: string;
  requirementName: string;
  requirementDescription: string;
  canReview: boolean;
  reviewHistory: {
    id: string;
    action: string;
    performedBy: string;
    performedByName: string;
    performedAt: Date;
    notes: string | null;
  }[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const requirementSelect = {
  id: true,
  templateId: true,
  name: true,
  description: true,
  attestationLevels: true,
  proofType: true,
  proofSubType: true,
  typeConfig: true,
  threshold: true,
  thresholdUnit: true,
  rollingWindowDays: true,
  universalCategory: true,
  qualificationType: true,
  medicalTestType: true,
  standardReqId: true,
  validityDays: true,
  renewalWarningDays: true,
  sortOrder: true,
  isRequired: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProofRequirementSelect;

const templateSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  status: true,
  version: true,
  previousVersion: true,
  createdBy: true,
  updatedBy: true,
  standardId: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  archivedAt: true,
  requirements: {
    select: requirementSelect,
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProofTemplateSelect;

const templateSummarySelect = {
  id: true,
  name: true,
  status: true,
  version: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProofTemplateSelect;

const employeeSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

const assignmentSelect = {
  id: true,
  templateId: true,
  templateVersion: true,
  employeeId: true,
  role: true,
  department: true,
  assignedBy: true,
  dueDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  employee: {
    select: employeeSummarySelect,
  },
  template: {
    select: templateSummarySelect,
  },
} satisfies Prisma.TemplateAssignmentSelect;

const fulfillmentSelect = {
  id: true,
  assignmentId: true,
  requirementId: true,
  employeeId: true,
  status: true,
  selfAttestedAt: true,
  selfAttestation: true,
  uploadedAt: true,
  documentId: true,
  thirdPartyVerifiedAt: true,
  thirdPartySource: true,
  thirdPartyRefId: true,
  thirdPartyData: true,
  validatedAt: true,
  validatedBy: true,
  validatorNotes: true,
  rejectedAt: true,
  rejectionReason: true,
  expiresAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
  requirement: {
    select: requirementSelect,
  },
} satisfies Prisma.ProofFulfillmentSelect;

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

function fromPrismaTemplateStatus(status: PrismaTemplateStatus): TemplateStatus {
  switch (status) {
    case PrismaTemplateStatus.DRAFT:
      return "draft";
    case PrismaTemplateStatus.PUBLISHED:
      return "published";
    case PrismaTemplateStatus.ARCHIVED:
      return "archived";
  }
}

function toPrismaAttestationLevel(level: AttestationLevel): PrismaAttestationLevel {
  switch (level) {
    case "self_attest":
      return PrismaAttestationLevel.SELF_ATTEST;
    case "upload":
      return PrismaAttestationLevel.UPLOAD;
    case "third_party":
      return PrismaAttestationLevel.THIRD_PARTY;
    case "validated":
      return PrismaAttestationLevel.VALIDATED;
  }
}

function fromPrismaAttestationLevel(level: PrismaAttestationLevel): AttestationLevel {
  switch (level) {
    case PrismaAttestationLevel.SELF_ATTEST:
      return "self_attest";
    case PrismaAttestationLevel.UPLOAD:
      return "upload";
    case PrismaAttestationLevel.THIRD_PARTY:
      return "third_party";
    case PrismaAttestationLevel.VALIDATED:
      return "validated";
  }
}

function fromPrismaFulfillmentStatus(status: PrismaFulfillmentStatus): FulfillmentStatus {
  switch (status) {
    case PrismaFulfillmentStatus.UNFULFILLED:
      return "unfulfilled";
    case PrismaFulfillmentStatus.PENDING_REVIEW:
      return "pending_review";
    case PrismaFulfillmentStatus.FULFILLED:
      return "fulfilled";
    case PrismaFulfillmentStatus.EXPIRED:
      return "expired";
    case PrismaFulfillmentStatus.REJECTED:
      return "rejected";
  }
}

function toPrismaProofType(type: ProofType): PrismaProofType {
  switch (type) {
    case "hours":
      return PrismaProofType.HOURS;
    case "certification":
      return PrismaProofType.CERTIFICATION;
    case "training":
      return PrismaProofType.TRAINING;
    case "clearance":
      return PrismaProofType.CLEARANCE;
    case "assessment":
      return PrismaProofType.ASSESSMENT;
    case "compliance":
      return PrismaProofType.COMPLIANCE;
  }
}

function fromPrismaProofType(type: PrismaProofType): ProofType {
  switch (type) {
    case PrismaProofType.HOURS:
      return "hours";
    case PrismaProofType.CERTIFICATION:
      return "certification";
    case PrismaProofType.TRAINING:
      return "training";
    case PrismaProofType.CLEARANCE:
      return "clearance";
    case PrismaProofType.ASSESSMENT:
      return "assessment";
    case PrismaProofType.COMPLIANCE:
      return "compliance";
  }
}

function normalizeAttestationLevels(levels: AttestationLevel[]) {
  return normalizeAttestationLevelsPolicy(levels);
}

function mapRequirement(record: Prisma.ProofRequirementGetPayload<{ select: typeof requirementSelect }>): ProofRequirement {
  return {
    id: record.id,
    templateId: record.templateId,
    name: record.name,
    description: record.description,
    attestationLevels: record.attestationLevels.map(fromPrismaAttestationLevel),
    proofType: record.proofType ? fromPrismaProofType(record.proofType) : null,
    proofSubType: record.proofSubType,
    typeConfig: record.typeConfig,
    threshold: record.threshold,
    thresholdUnit: record.thresholdUnit,
    rollingWindowDays: record.rollingWindowDays,
    universalCategory: record.universalCategory,
    qualificationType: record.qualificationType,
    medicalTestType: record.medicalTestType,
    standardReqId: record.standardReqId,
    validityDays: record.validityDays,
    renewalWarningDays: record.renewalWarningDays,
    sortOrder: record.sortOrder,
    isRequired: record.isRequired,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapTemplate(record: Prisma.ProofTemplateGetPayload<{ select: typeof templateSelect }>): ProofTemplate {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    category: record.category,
    status: fromPrismaTemplateStatus(record.status),
    version: record.version,
    previousVersion: record.previousVersion,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    standardId: record.standardId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    requirements: record.requirements.map(mapRequirement),
  };
}

function mapAssignmentWithEmployee(
  record: Prisma.TemplateAssignmentGetPayload<{ select: typeof assignmentSelect }>,
): TemplateAssignmentWithEmployee {
  return {
    id: record.id,
    templateId: record.templateId,
    templateVersion: record.templateVersion,
    employeeId: record.employeeId,
    role: record.role,
    department: record.department,
    assignedBy: record.assignedBy,
    dueDate: record.dueDate,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    employeeName: record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : null,
    employeeEmail: record.employee?.email ?? null,
  };
}

function mapAssignmentWithTemplate(
  record: Prisma.TemplateAssignmentGetPayload<{ select: typeof assignmentSelect }>,
): TemplateAssignmentWithTemplate {
  if (!record.template) {
    throw new ValidationError("Template data missing for assignment.");
  }

  return {
    id: record.id,
    templateId: record.templateId,
    templateVersion: record.templateVersion,
    employeeId: record.employeeId,
    role: record.role,
    department: record.department,
    assignedBy: record.assignedBy,
    dueDate: record.dueDate,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    templateName: record.template.name,
    templateStatus: fromPrismaTemplateStatus(record.template.status),
  };
}

function mapFulfillment(record: Prisma.ProofFulfillmentGetPayload<{ select: typeof fulfillmentSelect }>): ProofFulfillment {
  return {
    id: record.id,
    assignmentId: record.assignmentId,
    requirementId: record.requirementId,
    employeeId: record.employeeId,
    status: fromPrismaFulfillmentStatus(record.status),
    selfAttestedAt: record.selfAttestedAt,
    selfAttestation: record.selfAttestation,
    uploadedAt: record.uploadedAt,
    documentId: record.documentId,
    thirdPartyVerifiedAt: record.thirdPartyVerifiedAt,
    thirdPartySource: record.thirdPartySource,
    thirdPartyRefId: record.thirdPartyRefId,
    thirdPartyData: record.thirdPartyData,
    validatedAt: record.validatedAt,
    validatedBy: record.validatedBy,
    validatorNotes: record.validatorNotes,
    rejectedAt: record.rejectedAt,
    rejectionReason: record.rejectionReason,
    expiresAt: record.expiresAt,
    expiredAt: record.expiredAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    requirement: record.requirement ? mapRequirement(record.requirement) : undefined,
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

function parseTemplateStatusFilter(status?: string): PrismaTemplateStatus | undefined {
  if (!status) {
    return undefined;
  }

  switch (status) {
    case "draft":
      return PrismaTemplateStatus.DRAFT;
    case "published":
      return PrismaTemplateStatus.PUBLISHED;
    case "archived":
      return PrismaTemplateStatus.ARCHIVED;
    default:
      throw new ValidationError(`Unsupported template status '${status}'`);
  }
}

function buildTemplateVisibilityWhere(actor: Actor): Prisma.ProofTemplateWhereInput {
  if (actor.role === Roles.ADMIN || actor.role === Roles.COMPLIANCE_OFFICER) {
    return {};
  }

  return {
    OR: [
      { status: PrismaTemplateStatus.PUBLISHED },
      { createdBy: actor.id },
    ],
  };
}

function buildTemplateWhere(filters: TemplateListFilters, actor: Actor): Prisma.ProofTemplateWhereInput {
  const clauses: Prisma.ProofTemplateWhereInput[] = [];
  const visibility = buildTemplateVisibilityWhere(actor);
  if (Object.keys(visibility).length > 0) {
    clauses.push(visibility);
  }
  const status = parseTemplateStatusFilter(filters.status);
  if (status) {
    clauses.push({ status });
  }

  if (filters.category?.trim()) {
    clauses.push({ category: { contains: filters.category.trim(), mode: "insensitive" } });
  }

  if (filters.standardId) {
    clauses.push({ standardId: filters.standardId });
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    clauses.push({
      OR: [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (clauses.length === 0) {
    return {};
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

function ensureActorCanAccessEmployee(actor: Actor, employeeId: string) {
  if (actor.role === Roles.EMPLOYEE && actor.id !== employeeId) {
    throw new ForbiddenError();
  }
}

function ensureDraftEditable(template: Prisma.ProofTemplateGetPayload<{ select: { status: true; createdBy: true } }>, actor: Actor) {
  if (template.status !== PrismaTemplateStatus.DRAFT) {
    throw new ConflictError("Only draft templates can be modified.");
  }

  if (template.createdBy !== actor.id && actor.role !== Roles.ADMIN) {
    throw new ForbiddenError("Only the template creator can modify this draft.");
  }
}

function ensurePublished(template: Prisma.ProofTemplateGetPayload<{ select: { status: true } }>) {
  if (template.status !== PrismaTemplateStatus.PUBLISHED) {
    throw new ConflictError("Only published templates can be assigned.");
  }
}

function ensureRequirementLevel(requirement: Prisma.ProofRequirementGetPayload<{ select: { attestationLevels: true } }>, level: PrismaAttestationLevel) {
  if (!requirement.attestationLevels.includes(level)) {
    throw new ValidationError(`Requirement does not allow ${level.toLowerCase().replace("_", " ")} submissions.`);
  }
}

function computeFulfillmentStatus(
  requirement: Prisma.ProofRequirementGetPayload<{ select: { attestationLevels: true } }>,
  fulfillment: Pick<
    Prisma.ProofFulfillmentGetPayload<{ select: typeof fulfillmentSelect }>,
    | "selfAttestedAt"
    | "uploadedAt"
    | "documentId"
    | "thirdPartyVerifiedAt"
    | "validatedAt"
    | "rejectedAt"
    | "expiresAt"
  >,
  now: Date,
): PrismaFulfillmentStatus {
  if (fulfillment.rejectedAt) {
    return PrismaFulfillmentStatus.REJECTED;
  }

  if (fulfillment.expiresAt && fulfillment.expiresAt.getTime() <= now.getTime()) {
    return PrismaFulfillmentStatus.EXPIRED;
  }

  const satisfied = {
    [PrismaAttestationLevel.SELF_ATTEST]: Boolean(fulfillment.selfAttestedAt),
    [PrismaAttestationLevel.UPLOAD]: Boolean(fulfillment.uploadedAt || fulfillment.documentId),
    [PrismaAttestationLevel.THIRD_PARTY]: Boolean(fulfillment.thirdPartyVerifiedAt),
    [PrismaAttestationLevel.VALIDATED]: Boolean(fulfillment.validatedAt),
  };

  const requiredLevels = requirement.attestationLevels as PrismaAttestationLevel[];
  const hasValidated = requiredLevels.includes(PrismaAttestationLevel.VALIDATED);
  const nonValidationLevels = requiredLevels.filter(
    (level: PrismaAttestationLevel) => level !== PrismaAttestationLevel.VALIDATED,
  );
  const allSatisfied = requiredLevels.every((level: PrismaAttestationLevel) => satisfied[level]);

  if (allSatisfied) {
    return PrismaFulfillmentStatus.FULFILLED;
  }

  if (hasValidated && nonValidationLevels.every((level: PrismaAttestationLevel) => satisfied[level])) {
    return PrismaFulfillmentStatus.PENDING_REVIEW;
  }

  return PrismaFulfillmentStatus.UNFULFILLED;
}

function computeInitialFulfillmentStatus(requirement: Prisma.ProofRequirementGetPayload<{ select: { attestationLevels: true } }>) {
  const hasValidated = requirement.attestationLevels.includes(PrismaAttestationLevel.VALIDATED);
  return hasValidated && requirement.attestationLevels.length === 1
    ? PrismaFulfillmentStatus.PENDING_REVIEW
    : PrismaFulfillmentStatus.UNFULFILLED;
}

function computeExpirationDate(validityDays: number | null, completedAt: Date | null) {
  if (!validityDays || !completedAt) {
    return null;
  }

  const expiresAt = new Date(completedAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);
  return expiresAt;
}

async function ensureTemplateExists(id: string) {
  const template = await prisma.proofTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!template) {
    throw new NotFoundError("Proof template", id);
  }
}

async function ensureStandardExists(id: string) {
  const standard = await prisma.complianceStandard.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!standard) {
    throw new NotFoundError("Compliance standard", id);
  }
}

async function ensureStandardRequirementExists(id: string) {
  const requirement = await prisma.standardRequirement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!requirement) {
    throw new NotFoundError("Standard requirement", id);
  }
}

async function ensureEmployeeExists(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!employee) {
    throw new NotFoundError("Employee", id);
  }
}

async function ensureDocumentForEmployee(documentId: string, employeeId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, employeeId: true },
  });

  if (!document) {
    throw new NotFoundError("Document", documentId);
  }

  if (document.employeeId !== employeeId) {
    throw new ValidationError("Document does not belong to the assigned employee.");
  }
}

async function updateAssignmentCompletion(assignmentId: string) {
  const [fulfillments, assignment] = await Promise.all([
    prisma.proofFulfillment.findMany({
      where: { assignmentId },
      select: {
        status: true,
        requirement: {
          select: { isRequired: true },
        },
      },
    }),
    prisma.templateAssignment.findUnique({
      where: { id: assignmentId },
      select: { completedAt: true },
    }),
  ]);

  const requiredFulfillments = fulfillments.filter(
    (fulfillment: (typeof fulfillments)[number]) => fulfillment.requirement.isRequired,
  );
  const allComplete = requiredFulfillments.length > 0
    ? requiredFulfillments.every(
        (fulfillment: (typeof requiredFulfillments)[number]) => fulfillment.status === PrismaFulfillmentStatus.FULFILLED,
      )
    : true;

  await prisma.templateAssignment.update({
    where: { id: assignmentId },
    data: {
      completedAt: allComplete ? assignment?.completedAt ?? new Date() : null,
    },
  });
}

export const templatesService: TemplatesService = {
  async createTemplate(input, actor) {
    if (input.standardId) {
      await ensureStandardExists(input.standardId);
    }

    const requirementInputs = input.requirements ?? [];
    const normalizedRequirements = requirementInputs.map((requirement, index) => ({
      name: normalizeText(requirement.name),
      description: requirement.description?.trim() ?? "",
      attestationLevels: normalizeAttestationLevels(requirement.attestationLevels).map(toPrismaAttestationLevel),
      proofType: requirement.proofType ? toPrismaProofType(requirement.proofType) : undefined,
      proofSubType: requirement.proofSubType?.trim(),
      typeConfig: requirement.typeConfig as Prisma.InputJsonValue | undefined,
      threshold: requirement.threshold,
      thresholdUnit: requirement.thresholdUnit?.trim(),
      rollingWindowDays: requirement.rollingWindowDays,
      universalCategory: requirement.universalCategory?.trim(),
      qualificationType: requirement.qualificationType?.trim(),
      medicalTestType: requirement.medicalTestType?.trim(),
      standardReqId: requirement.standardReqId,
      validityDays: requirement.validityDays,
      renewalWarningDays: requirement.renewalWarningDays,
      sortOrder: index,
      isRequired: requirement.isRequired ?? true,
    }));

    for (const requirement of normalizedRequirements) {
      if (requirement.standardReqId) {
        await ensureStandardRequirementExists(requirement.standardReqId);
      }
    }

    const template = await prisma.proofTemplate.create({
      data: {
        name: normalizeText(input.name),
        description: input.description?.trim() ?? "",
        category: input.category?.trim(),
        status: PrismaTemplateStatus.DRAFT,
        version: 1,
        createdBy: actor.id,
        updatedBy: actor.id,
        standardId: input.standardId,
        requirements: normalizedRequirements.length > 0
          ? {
              create: normalizedRequirements,
            }
          : undefined,
      },
      select: templateSelect,
    });

    return mapTemplate(template);
  },

  async listTemplates(filters, actor) {
    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const where = buildTemplateWhere(filters, actor);

    const [templates, total] = await prisma.$transaction([
      prisma.proofTemplate.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: templateSelect,
      }),
      prisma.proofTemplate.count({ where }),
    ]);

    return {
      data: templates.map(mapTemplate),
      total,
      page,
      limit,
    };
  },

  async getTemplate(id, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: templateSelect,
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    if (template.status !== PrismaTemplateStatus.PUBLISHED && template.createdBy !== actor.id && actor.role !== Roles.ADMIN && actor.role !== Roles.COMPLIANCE_OFFICER) {
      throw new ForbiddenError();
    }

    return mapTemplate(template);
  },

  async updateTemplate(id, input, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: { status: true, createdBy: true },
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    ensureDraftEditable(template, actor);

    if (input.standardId !== undefined && input.standardId !== null) {
      await ensureStandardExists(input.standardId);
    }

    const updated = await prisma.proofTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: normalizeText(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category?.trim() ?? null } : {}),
        ...(input.standardId !== undefined ? { standardId: input.standardId } : {}),
        updatedBy: actor.id,
      },
      select: templateSelect,
    });

    return mapTemplate(updated);
  },

  async deleteTemplate(id, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: { status: true, createdBy: true },
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    ensureDraftEditable(template, actor);

    await prisma.proofTemplate.delete({ where: { id } });
  },

  async publishTemplate(id, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: { status: true, requirements: { select: { id: true } } },
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    if (template.status !== PrismaTemplateStatus.DRAFT) {
      throw new ConflictError("Only draft templates can be published.");
    }

    if (template.requirements.length === 0) {
      throw new ValidationError("Templates must include at least one requirement before publishing.");
    }

    const updated = await prisma.proofTemplate.update({
      where: { id },
      data: {
        status: PrismaTemplateStatus.PUBLISHED,
        publishedAt: new Date(),
        updatedBy: actor.id,
      },
      select: templateSelect,
    });

    return mapTemplate(updated);
  },

  async archiveTemplate(id, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    if (template.status !== PrismaTemplateStatus.PUBLISHED) {
      throw new ConflictError("Only published templates can be archived.");
    }

    const updated = await prisma.proofTemplate.update({
      where: { id },
      data: {
        status: PrismaTemplateStatus.ARCHIVED,
        archivedAt: new Date(),
        updatedBy: actor.id,
      },
      select: templateSelect,
    });

    return mapTemplate(updated);
  },

  async cloneTemplate(id, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        category: true,
        status: true,
        version: true,
        standardId: true,
        requirements: {
          select: requirementSelect,
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundError("Proof template", id);
    }

    if (template.status !== PrismaTemplateStatus.PUBLISHED) {
      throw new ConflictError("Only published templates can be cloned.");
    }

    const created = await prisma.proofTemplate.create({
      data: {
        name: template.name,
        description: template.description,
        category: template.category,
        status: PrismaTemplateStatus.DRAFT,
        version: template.version + 1,
        previousVersion: id,
        createdBy: actor.id,
        updatedBy: actor.id,
        standardId: template.standardId,
        requirements: {
          create: template.requirements.map((requirement: (typeof template.requirements)[number]) => ({
            name: requirement.name,
            description: requirement.description,
            attestationLevels: requirement.attestationLevels,
            proofType: requirement.proofType,
            proofSubType: requirement.proofSubType,
            typeConfig: requirement.typeConfig as Prisma.InputJsonValue | undefined,
            threshold: requirement.threshold,
            thresholdUnit: requirement.thresholdUnit,
            rollingWindowDays: requirement.rollingWindowDays,
            universalCategory: requirement.universalCategory,
            qualificationType: requirement.qualificationType,
            medicalTestType: requirement.medicalTestType,
            standardReqId: requirement.standardReqId,
            validityDays: requirement.validityDays,
            renewalWarningDays: requirement.renewalWarningDays,
            sortOrder: requirement.sortOrder,
            isRequired: requirement.isRequired,
          })),
        },
      },
      select: templateSelect,
    });

    return mapTemplate(created);
  },

  async addRequirement(templateId, input, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id: templateId },
      select: { status: true, createdBy: true },
    });

    if (!template) {
      throw new NotFoundError("Proof template", templateId);
    }

    ensureDraftEditable(template, actor);

    if (input.standardReqId) {
      await ensureStandardRequirementExists(input.standardReqId);
    }

    const lastRequirement = await prisma.proofRequirement.findFirst({
      where: { templateId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const requirement = await prisma.proofRequirement.create({
      data: {
        templateId,
        name: normalizeText(input.name),
        description: input.description?.trim() ?? "",
        attestationLevels: normalizeAttestationLevels(input.attestationLevels).map(toPrismaAttestationLevel),
        proofType: input.proofType ? toPrismaProofType(input.proofType) : undefined,
        proofSubType: input.proofSubType?.trim(),
        typeConfig: input.typeConfig as Prisma.InputJsonValue | undefined,
        threshold: input.threshold,
        thresholdUnit: input.thresholdUnit?.trim(),
        rollingWindowDays: input.rollingWindowDays,
        universalCategory: input.universalCategory?.trim(),
        qualificationType: input.qualificationType?.trim(),
        medicalTestType: input.medicalTestType?.trim(),
        standardReqId: input.standardReqId,
        validityDays: input.validityDays,
        renewalWarningDays: input.renewalWarningDays,
        sortOrder: (lastRequirement?.sortOrder ?? -1) + 1,
        isRequired: input.isRequired ?? true,
      },
      select: requirementSelect,
    });

    return mapRequirement(requirement);
  },

  async updateRequirement(templateId, requirementId, input, actor) {
    const requirement = await prisma.proofRequirement.findUnique({
      where: { id: requirementId },
      select: {
        id: true,
        templateId: true,
        template: { select: { status: true, createdBy: true } },
      },
    });

    if (!requirement || requirement.templateId !== templateId) {
      throw new NotFoundError("Proof requirement", requirementId);
    }

    ensureDraftEditable(requirement.template, actor);

    if (input.standardReqId) {
      await ensureStandardRequirementExists(input.standardReqId);
    }

    const updated = await prisma.proofRequirement.update({
      where: { id: requirementId },
      data: {
        ...(input.name !== undefined ? { name: normalizeText(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.attestationLevels !== undefined
          ? { attestationLevels: normalizeAttestationLevels(input.attestationLevels).map(toPrismaAttestationLevel) }
          : {}),
        ...(input.proofType !== undefined
          ? { proofType: input.proofType ? toPrismaProofType(input.proofType) : null }
          : {}),
        ...(input.proofSubType !== undefined ? { proofSubType: input.proofSubType?.trim() ?? null } : {}),
        ...(input.typeConfig !== undefined ? { typeConfig: input.typeConfig as Prisma.InputJsonValue } : {}),
        ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
        ...(input.thresholdUnit !== undefined ? { thresholdUnit: input.thresholdUnit?.trim() ?? null } : {}),
        ...(input.rollingWindowDays !== undefined ? { rollingWindowDays: input.rollingWindowDays } : {}),
        ...(input.universalCategory !== undefined ? { universalCategory: input.universalCategory?.trim() ?? null } : {}),
        ...(input.qualificationType !== undefined ? { qualificationType: input.qualificationType?.trim() ?? null } : {}),
        ...(input.medicalTestType !== undefined ? { medicalTestType: input.medicalTestType?.trim() ?? null } : {}),
        ...(input.standardReqId !== undefined ? { standardReqId: input.standardReqId } : {}),
        ...(input.validityDays !== undefined ? { validityDays: input.validityDays } : {}),
        ...(input.renewalWarningDays !== undefined ? { renewalWarningDays: input.renewalWarningDays } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
      },
      select: requirementSelect,
    });

    return mapRequirement(updated);
  },

  async removeRequirement(templateId, requirementId, actor) {
    const requirement = await prisma.proofRequirement.findUnique({
      where: { id: requirementId },
      select: {
        id: true,
        templateId: true,
        template: { select: { status: true, createdBy: true } },
      },
    });

    if (!requirement || requirement.templateId !== templateId) {
      throw new NotFoundError("Proof requirement", requirementId);
    }

    ensureDraftEditable(requirement.template, actor);

    await prisma.proofRequirement.delete({ where: { id: requirementId } });
  },

  async reorderRequirements(templateId, input, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id: templateId },
      select: { status: true, createdBy: true },
    });

    if (!template) {
      throw new NotFoundError("Proof template", templateId);
    }

    ensureDraftEditable(template, actor);

    const requirements = await prisma.proofRequirement.findMany({
      where: { templateId },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });

    const requirementIds = input.requirementIds;
    const requirementSet = new Set(requirements.map((req: (typeof requirements)[number]) => req.id));

    if (requirementIds.length !== requirements.length || requirementIds.some((id) => !requirementSet.has(id))) {
      throw new ValidationError("Requirement list must include every requirement in the template.");
    }

    await prisma.$transaction(
      requirementIds.map((id, index) =>
        prisma.proofRequirement.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    const updated = await prisma.proofRequirement.findMany({
      where: { templateId },
      select: requirementSelect,
      orderBy: { sortOrder: "asc" },
    });

    return updated.map(mapRequirement);
  },

  async assignTemplate(templateId, input, actor) {
    const template = await prisma.proofTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        status: true,
        version: true,
        requirements: {
          select: {
            id: true,
            attestationLevels: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundError("Proof template", templateId);
    }

    ensurePublished(template);

    let employees: Array<Prisma.EmployeeGetPayload<{ select: typeof employeeSummarySelect }>>;
    let assignmentRole: string | null = null;
    let assignmentDepartment: string | null = null;

    if ("employeeIds" in input) {
      const employeeIds = Array.from(new Set(input.employeeIds));
      employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds }, isActive: true },
        select: employeeSummarySelect,
      });

      if (employees.length !== employeeIds.length) {
        throw new ValidationError("One or more employee IDs are invalid or inactive.");
      }
    } else if ("role" in input) {
      assignmentRole = input.role.trim();
      const prismaRole = toPrismaRole(input.role);
      employees = await prisma.employee.findMany({
        where: { role: prismaRole, isActive: true },
        select: employeeSummarySelect,
      });
    } else {
      assignmentDepartment = input.department.trim();
      employees = await prisma.employee.findMany({
        where: { departmentId: assignmentDepartment, isActive: true },
        select: employeeSummarySelect,
      });
    }

    if (employees.length === 0) {
      throw new ValidationError("No active employees matched the assignment target.");
    }

    const existingAssignments = await prisma.templateAssignment.findMany({
      where: { templateId, employeeId: { in: employees.map((employee) => employee.id) } },
      select: { employeeId: true },
    });
    const existingEmployeeIds = new Set(
      existingAssignments.map((assignment: (typeof existingAssignments)[number]) => assignment.employeeId),
    );

    const assignments: TemplateAssignmentWithEmployee[] = [];
    for (const employee of employees) {
      if (existingEmployeeIds.has(employee.id)) {
        continue;
      }

      const assignment = await prisma.templateAssignment.create({
        data: {
          templateId,
          templateVersion: template.version,
          employeeId: employee.id,
          role: assignmentRole,
          department: assignmentDepartment,
          assignedBy: actor.id,
          dueDate: input.dueDate,
          fulfillments: {
            create: template.requirements.map((requirement: (typeof template.requirements)[number]) => ({
              requirementId: requirement.id,
              employeeId: employee.id,
              status: computeInitialFulfillmentStatus(requirement),
            })),
          },
        },
        select: assignmentSelect,
      });

      assignments.push(mapAssignmentWithEmployee(assignment));
    }

    return {
      assignments,
      created: assignments.length,
      skipped: employees.length - assignments.length,
    };
  },

  async listAssignmentsByTemplate(templateId, filters, actor) {
    await ensureTemplateExists(templateId);
    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;

    const [assignments, total] = await prisma.$transaction([
      prisma.templateAssignment.findMany({
        where: { templateId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: assignmentSelect,
      }),
      prisma.templateAssignment.count({ where: { templateId } }),
    ]);

    if (actor.role === Roles.EMPLOYEE) {
      throw new ForbiddenError();
    }

    return {
      data: assignments.map(mapAssignmentWithEmployee),
      total,
      page,
      limit,
    };
  },

  async listAssignmentsByEmployee(employeeId, filters, actor) {
    ensureActorCanAccessEmployee(actor, employeeId);
    await ensureEmployeeExists(employeeId);

    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;

    const [assignments, total] = await prisma.$transaction([
      prisma.templateAssignment.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: assignmentSelect,
      }),
      prisma.templateAssignment.count({ where: { employeeId } }),
    ]);

    return {
      data: assignments.map(mapAssignmentWithTemplate),
      total,
      page,
      limit,
    };
  },

  async deactivateAssignment(assignmentId, actor) {
    const assignment = await prisma.templateAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, employeeId: true },
    });

    if (!assignment) {
      throw new NotFoundError("Template assignment", assignmentId);
    }

    if (actor.role === Roles.EMPLOYEE) {
      throw new ForbiddenError();
    }

    const updated = await prisma.templateAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
      select: assignmentSelect,
    });

    return {
      id: updated.id,
      templateId: updated.templateId,
      templateVersion: updated.templateVersion,
      employeeId: updated.employeeId,
      role: updated.role,
      department: updated.department,
      assignedBy: updated.assignedBy,
      dueDate: updated.dueDate,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      completedAt: updated.completedAt,
    };
  },

  async listFulfillmentsByAssignment(assignmentId, actor) {
    const assignment = await prisma.templateAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, employeeId: true, isActive: true },
    });

    if (!assignment) {
      throw new NotFoundError("Template assignment", assignmentId);
    }

    if (!assignment.isActive) {
      throw new ConflictError("This assignment is no longer active.");
    }

    ensureActorCanAccessEmployee(actor, assignment.employeeId ?? "");

    const fulfillments = await prisma.proofFulfillment.findMany({
      where: { assignmentId },
      orderBy: { createdAt: "asc" },
      select: fulfillmentSelect,
    });

    return fulfillments.map(mapFulfillment);
  },

  async selfAttestFulfillment(fulfillmentId, input, actor) {
    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id: fulfillmentId },
      select: {
        ...fulfillmentSelect,
        assignment: { select: { employeeId: true, isActive: true } },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", fulfillmentId);
    }

    if (!fulfillment.assignment?.isActive) {
      throw new ConflictError("This assignment is no longer active.");
    }

    ensureActorCanAccessEmployee(actor, fulfillment.employeeId);
    ensureRequirementLevel(fulfillment.requirement!, PrismaAttestationLevel.SELF_ATTEST);

    const now = new Date();
    const nextFulfillment = {
      ...fulfillment,
      selfAttestedAt: now,
      selfAttestation: input.statement?.trim() ?? null,
      rejectedAt: null,
      rejectionReason: null,
      validatedAt: null,
      validatedBy: null,
      validatorNotes: null,
      expiresAt: null,
    };

    const status = computeFulfillmentStatus(fulfillment.requirement!, nextFulfillment, now);
    const completedAt = status === PrismaFulfillmentStatus.FULFILLED ? now : null;
    const expiresAt = status === PrismaFulfillmentStatus.FULFILLED
      ? computeExpirationDate(fulfillment.requirement!.validityDays, completedAt)
      : null;

    const updated = await prisma.proofFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        selfAttestedAt: now,
        selfAttestation: input.statement?.trim() ?? null,
        status,
        rejectedAt: null,
        rejectionReason: null,
        validatedAt: null,
        validatedBy: null,
        validatorNotes: null,
        expiresAt,
      },
      select: fulfillmentSelect,
    });

    await updateAssignmentCompletion(fulfillment.assignmentId);

    return mapFulfillment(updated);
  },

  async attachDocument(fulfillmentId, input, actor) {
    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id: fulfillmentId },
      select: {
        ...fulfillmentSelect,
        assignment: { select: { employeeId: true, isActive: true } },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", fulfillmentId);
    }

    if (!fulfillment.assignment?.isActive) {
      throw new ConflictError("This assignment is no longer active.");
    }

    ensureActorCanAccessEmployee(actor, fulfillment.employeeId);
    ensureRequirementLevel(fulfillment.requirement!, PrismaAttestationLevel.UPLOAD);
    await ensureDocumentForEmployee(input.documentId, fulfillment.employeeId);

    const now = new Date();
    const nextFulfillment = {
      ...fulfillment,
      uploadedAt: now,
      documentId: input.documentId,
      rejectedAt: null,
      rejectionReason: null,
      validatedAt: null,
      validatedBy: null,
      validatorNotes: null,
      expiresAt: null,
    };

    const status = computeFulfillmentStatus(fulfillment.requirement!, nextFulfillment, now);
    const completedAt = status === PrismaFulfillmentStatus.FULFILLED ? now : null;
    const expiresAt = status === PrismaFulfillmentStatus.FULFILLED
      ? computeExpirationDate(fulfillment.requirement!.validityDays, completedAt)
      : null;

    const updated = await prisma.proofFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        uploadedAt: now,
        documentId: input.documentId,
        status,
        rejectedAt: null,
        rejectionReason: null,
        validatedAt: null,
        validatedBy: null,
        validatorNotes: null,
        expiresAt,
      },
      select: fulfillmentSelect,
    });

    await updateAssignmentCompletion(fulfillment.assignmentId);

    return mapFulfillment(updated);
  },

  async validateFulfillment(fulfillmentId, input, actor) {
    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id: fulfillmentId },
      select: {
        ...fulfillmentSelect,
        assignment: { select: { employeeId: true, isActive: true } },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", fulfillmentId);
    }

    if (!fulfillment.assignment?.isActive) {
      throw new ConflictError("This assignment is no longer active.");
    }

    // Enforce separation of duties: validator cannot validate their own proof
    if (!canValidateOwnProof(fulfillment.employeeId, actor.id)) {
      throw new ForbiddenError("You cannot validate your own proof. Separation of duties is required.");
    }

    ensureRequirementLevel(fulfillment.requirement!, PrismaAttestationLevel.VALIDATED);

    const now = new Date();
    const nextFulfillment = {
      ...fulfillment,
      validatedAt: input.approved ? now : null,
      rejectedAt: input.approved ? null : now,
      expiresAt: null,
    };
    const status = computeFulfillmentStatus(fulfillment.requirement!, nextFulfillment, now);
    if (input.approved && status !== PrismaFulfillmentStatus.FULFILLED) {
      throw new ValidationError("All prerequisite attestation levels must be completed before validation.");
    }
    const completedAt = status === PrismaFulfillmentStatus.FULFILLED ? now : null;
    const expiresAt = status === PrismaFulfillmentStatus.FULFILLED
      ? computeExpirationDate(fulfillment.requirement!.validityDays, completedAt)
      : null;

    const updated = await prisma.proofFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        validatedAt: input.approved ? now : null,
        validatedBy: input.approved ? actor.id : null,
        validatorNotes: input.approved ? input.notes?.trim() ?? null : null,
        rejectedAt: input.approved ? null : now,
        rejectionReason: input.approved ? null : input.reason?.trim() ?? null,
        status,
        expiresAt,
      },
      select: fulfillmentSelect,
    });

    await updateAssignmentCompletion(fulfillment.assignmentId);

    return mapFulfillment(updated);
  },

  async thirdPartyVerify(fulfillmentId, input, _actor) {
    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id: fulfillmentId },
      select: {
        ...fulfillmentSelect,
        assignment: { select: { employeeId: true, isActive: true } },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", fulfillmentId);
    }

    if (!fulfillment.assignment?.isActive) {
      throw new ConflictError("This assignment is no longer active.");
    }

    ensureRequirementLevel(fulfillment.requirement!, PrismaAttestationLevel.THIRD_PARTY);

    const now = new Date();
    const nextFulfillment = {
      ...fulfillment,
      thirdPartyVerifiedAt: now,
      rejectedAt: null,
      rejectionReason: null,
      validatedAt: null,
      validatedBy: null,
      validatorNotes: null,
      expiresAt: null,
    };

    const status = computeFulfillmentStatus(fulfillment.requirement!, nextFulfillment, now);
    const completedAt = status === PrismaFulfillmentStatus.FULFILLED ? now : null;
    const expiresAt = status === PrismaFulfillmentStatus.FULFILLED
      ? computeExpirationDate(fulfillment.requirement!.validityDays, completedAt)
      : null;

    const updated = await prisma.proofFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        thirdPartyVerifiedAt: now,
        thirdPartySource: input.source.trim(),
        thirdPartyRefId: input.referenceId?.trim() ?? null,
        thirdPartyData: input.data === undefined ? undefined : (input.data as Prisma.InputJsonValue),
        status,
        rejectedAt: null,
        rejectionReason: null,
        validatedAt: null,
        validatedBy: null,
        validatorNotes: null,
        expiresAt,
      },
      select: fulfillmentSelect,
    });

    await updateAssignmentCompletion(fulfillment.assignmentId);

    return mapFulfillment(updated);
  },

  async listPendingReview(filters, actor) {
    if (actor.role === Roles.EMPLOYEE || actor.role === Roles.SUPERVISOR) {
      throw new ForbiddenError();
    }

    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;

    const [fulfillments, total] = await prisma.$transaction([
      prisma.proofFulfillment.findMany({
        where: { status: PrismaFulfillmentStatus.PENDING_REVIEW },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: fulfillmentSelect,
      }),
      prisma.proofFulfillment.count({ where: { status: PrismaFulfillmentStatus.PENDING_REVIEW } }),
    ]);

    return {
      data: fulfillments.map(mapFulfillment),
      total,
      page,
      limit,
    };
  },

  async countPendingReview(actor) {
    if (actor.role === Roles.EMPLOYEE || actor.role === Roles.SUPERVISOR) {
      throw new ForbiddenError();
    }

    const count = await prisma.proofFulfillment.count({
      where: { status: PrismaFulfillmentStatus.PENDING_REVIEW },
    });

    return { count };
  },

  async getTemplateAuditTrail(id) {
    await ensureTemplateExists(id);

    const auditTrail = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["templates", "template"] },
        recordId: id,
      },
      orderBy: { timestamp: "desc" },
    });

    return auditTrail.map(mapAuditLog);
  },

  async getFulfillmentAuditTrail(id) {
    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", id);
    }

    const auditTrail = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["fulfillments", "fulfillment"] },
        recordId: id,
      },
      orderBy: { timestamp: "desc" },
    });

    return auditTrail.map(mapAuditLog);
  },

  async listTeamTemplates(filters, actor) {
    if (actor.role === Roles.EMPLOYEE) {
      throw new ForbiddenError("Employees cannot view team templates.");
    }

    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;

    const assignmentsWithDetails = await prisma.templateAssignment.findMany({
      where: {
        isActive: true,
        employeeId: { not: null },
      },
      select: {
        id: true,
        templateId: true,
        employeeId: true,
        dueDate: true,
        completedAt: true,
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        fulfillments: {
          select: {
            id: true,
            status: true,
            requirementId: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    });

    const employeeMap = new Map<string, TeamTemplateProgress>();

    for (const assignment of assignmentsWithDetails) {
      if (!assignment.employee) continue;

      const employeeId = assignment.employeeId!;
      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          employeeId,
          employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
          employeeEmail: assignment.employee.email,
          assignments: [],
          overallCompletionPercentage: 0,
        });
      }

      const employeeData = employeeMap.get(employeeId)!;
      
      const totalRequirements = assignment.fulfillments.length;
      const fulfilledRequirements = assignment.fulfillments.filter(
        (f) => f.status === PrismaFulfillmentStatus.FULFILLED
      ).length;
      const completionPercentage = totalRequirements > 0 
        ? Math.round((fulfilledRequirements / totalRequirements) * 100) 
        : 0;

      const now = new Date();
      const isOverdue = assignment.dueDate !== null && !assignment.completedAt && assignment.dueDate < now;
      const isAtRisk = assignment.dueDate !== null 
        && !assignment.completedAt 
        && completionPercentage < 50 
        && assignment.dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

      employeeData.assignments.push({
        id: assignment.id,
        templateId: assignment.templateId,
        templateName: assignment.template.name,
        status: assignment.completedAt ? "completed" : isOverdue ? "overdue" : "in_progress",
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt,
        totalRequirements,
        fulfilledRequirements,
        completionPercentage,
        isOverdue,
        isAtRisk,
      });
    }

    const teamData = Array.from(employeeMap.values());

    teamData.forEach((employee) => {
      const totalAssignments = employee.assignments.length;
      if (totalAssignments > 0) {
        const sumCompletion = employee.assignments.reduce((sum, a) => sum + a.completionPercentage, 0);
        employee.overallCompletionPercentage = Math.round(sumCompletion / totalAssignments);
      }
    });

    const total = teamData.length;
    const paginatedData = teamData.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
    };
  },

  async listFulfillmentReviews(filters, actor) {
    if (actor.role === Roles.EMPLOYEE || actor.role === Roles.SUPERVISOR) {
      throw new ForbiddenError("Only managers and above can access the review queue.");
    }

    const page = filters.page ?? DEFAULT_PAGE;
    const limit = filters.limit ?? DEFAULT_LIMIT;

    const where: Prisma.ProofFulfillmentWhereInput = {
      status: filters.status 
        ? (filters.status.toUpperCase() as PrismaFulfillmentStatus)
        : PrismaFulfillmentStatus.PENDING_REVIEW,
    };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.proofType) {
      where.requirement = {
        proofType: filters.proofType.toLowerCase() as PrismaProofType,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.updatedAt = {};
      if (filters.startDate) {
        where.updatedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.updatedAt.lte = filters.endDate;
      }
    }

    const [fulfillments, total] = await prisma.$transaction([
      prisma.proofFulfillment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          employeeId: true,
          status: true,
          uploadedAt: true,
          selfAttestedAt: true,
          thirdPartyVerifiedAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignment: {
            select: {
              template: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          requirement: {
            select: {
              id: true,
              name: true,
              proofType: true,
              attestationLevels: true,
            },
          },
        },
      }),
      prisma.proofFulfillment.count({ where }),
    ]);

    const reviewItems: FulfillmentReviewItem[] = fulfillments.map((f) => {
      const submittedAt = f.uploadedAt || f.selfAttestedAt || f.thirdPartyVerifiedAt || f.updatedAt;
      const isPriority = f.requirement.proofType === PrismaProofType.CLEARANCE 
        || f.requirement.proofType === PrismaProofType.COMPLIANCE;

      return {
        id: f.id,
        employeeId: f.employeeId,
        employeeName: `${f.employee.firstName} ${f.employee.lastName}`,
        employeeEmail: f.employee.email,
        templateId: f.assignment.template.id,
        templateName: f.assignment.template.name,
        requirementId: f.requirement.id,
        requirementName: f.requirement.name,
        proofType: f.requirement.proofType ? fromPrismaProofType(f.requirement.proofType) : null,
        attestationLevels: f.requirement.attestationLevels.map(fromPrismaAttestationLevel),
        submittedAt,
        status: fromPrismaFulfillmentStatus(f.status),
        isPriority,
      };
    });

    return {
      data: reviewItems,
      total,
      page,
      limit,
    };
  },

  async getFulfillmentForReview(id, actor) {
    if (actor.role === Roles.EMPLOYEE || actor.role === Roles.SUPERVISOR) {
      throw new ForbiddenError("Only managers and above can review fulfillments.");
    }

    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id },
      select: {
        ...fulfillmentSelect,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignment: {
          select: {
            template: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", id);
    }

    const canReview = fulfillment.employeeId !== actor.id;

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["fulfillments", "fulfillment"] },
        recordId: id,
        action: { in: ["validate", "reject", "approve", "request_changes"] },
      },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        action: true,
        performedBy: true,
        timestamp: true,
        changeDetails: true,
      },
    });

    const reviewHistory = await Promise.all(
      auditLogs.map(async (log) => {
        const performer = await prisma.employee.findUnique({
          where: { id: log.performedBy },
          select: { firstName: true, lastName: true },
        });

        return {
          id: log.id,
          action: log.action,
          performedBy: log.performedBy,
          performedByName: performer ? `${performer.firstName} ${performer.lastName}` : "Unknown",
          performedAt: log.timestamp,
          notes: log.changeDetails ? String(log.changeDetails) : null,
        };
      })
    );

    const mapped = mapFulfillment(fulfillment);

    return {
      ...mapped,
      employeeName: `${fulfillment.employee.firstName} ${fulfillment.employee.lastName}`,
      employeeEmail: fulfillment.employee.email,
      templateName: fulfillment.assignment.template.name,
      requirementName: fulfillment.requirement!.name,
      requirementDescription: fulfillment.requirement!.description,
      canReview,
      reviewHistory,
    };
  },

  async submitReview(id, input, actor) {
    if (actor.role === Roles.EMPLOYEE || actor.role === Roles.SUPERVISOR) {
      throw new ForbiddenError("Only managers and above can submit reviews.");
    }

    const fulfillment = await prisma.proofFulfillment.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        status: true,
        assignmentId: true,
        requirement: {
          select: {
            id: true,
            validityDays: true,
          },
        },
      },
    });

    if (!fulfillment) {
      throw new NotFoundError("Proof fulfillment", id);
    }

    if (fulfillment.employeeId === actor.id) {
      throw new ForbiddenError("You cannot review your own fulfillment submission.");
    }

    if (fulfillment.status !== PrismaFulfillmentStatus.PENDING_REVIEW) {
      throw new ConflictError("Fulfillment is not pending review.");
    }

    const now = new Date();
    let newStatus: PrismaFulfillmentStatus;
    let updateData: Prisma.ProofFulfillmentUpdateInput;

    if (input.decision === "approve") {
      newStatus = PrismaFulfillmentStatus.FULFILLED;
      const expiresAt = fulfillment.requirement.validityDays
        ? computeExpirationDate(fulfillment.requirement.validityDays, now)
        : null;

      updateData = {
        status: newStatus,
        validatedAt: now,
        validatedBy: actor.id,
        validatorNotes: input.notes,
        rejectedAt: null,
        rejectionReason: null,
        expiresAt,
      };
    } else if (input.decision === "reject") {
      newStatus = PrismaFulfillmentStatus.REJECTED;
      updateData = {
        status: newStatus,
        rejectedAt: now,
        rejectionReason: input.reason!,
        validatedAt: null,
        validatedBy: null,
        validatorNotes: input.notes,
      };
    } else {
      newStatus = PrismaFulfillmentStatus.UNFULFILLED;
      updateData = {
        status: newStatus,
        validatorNotes: input.notes,
      };
    }

    const updated = await prisma.proofFulfillment.update({
      where: { id },
      data: updateData,
      select: fulfillmentSelect,
    });

    await updateAssignmentCompletion(fulfillment.assignmentId);

    return mapFulfillment(updated);
  },
};
