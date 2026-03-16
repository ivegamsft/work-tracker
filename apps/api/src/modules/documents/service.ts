import { DocumentStatus as PrismaDocumentStatus, ReviewStatus as PrismaReviewStatus, type Prisma } from "@prisma/client";
import {
  NotFoundError,
  ValidationError,
  type Document,
  type ExtractionResult,
  type ReviewQueueItem,
  type AuditLog,
} from "@e-clat/shared";
import { prisma } from "../../config/database";
import { UploadDocumentInput, ReviewDocumentInput, CorrectExtractionInput } from "./validators";
import { randomUUID } from "crypto";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentsService {
  upload(input: UploadDocumentInput, fileBuffer: Buffer, uploadedBy: string): Promise<Document>;
  getDocument(id: string): Promise<Document>;
  listByEmployee(employeeId: string, page?: number, limit?: number): Promise<PaginatedResult<Document>>;
  getExtraction(documentId: string): Promise<ExtractionResult[]>;
  correctExtraction(documentId: string, fieldId: string, input: CorrectExtractionInput, correctedBy: string): Promise<ExtractionResult>;
  reviewDocument(id: string, input: ReviewDocumentInput, reviewedBy: string): Promise<ReviewQueueItem>;
  listReviewQueue(page?: number, limit?: number): Promise<PaginatedResult<ReviewQueueItem>>;
  getAuditTrail(documentId: string): Promise<AuditLog[]>;
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

const documentBaseSelect = {
  id: true,
  employeeId: true,
  fileName: true,
  mimeType: true,
  storageKey: true,
  status: true,
  classifiedType: true,
  detectedExpiration: true,
  uploadedBy: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const documentDetailSelect = {
  ...documentBaseSelect,
  employee: {
    select: employeePublicSelect,
  },
} satisfies Prisma.DocumentSelect;

const reviewQueueItemSelect = {
  id: true,
  documentId: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  approvalNotes: true,
  linkedQualificationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewQueueItemSelect;

type DocumentRecord = Prisma.DocumentGetPayload<{ select: typeof documentBaseSelect }>;
type ReviewQueueItemRecord = Prisma.ReviewQueueItemGetPayload<{ select: typeof reviewQueueItemSelect }>;

function fromPrismaDocumentStatus(status: PrismaDocumentStatus): Document["status"] {
  switch (status) {
    case PrismaDocumentStatus.UPLOADED:
      return "uploaded";
    case PrismaDocumentStatus.PROCESSING:
      return "processing";
    case PrismaDocumentStatus.CLASSIFIED:
      return "classified";
    case PrismaDocumentStatus.REVIEW_REQUIRED:
      return "review_required";
    case PrismaDocumentStatus.APPROVED:
      return "approved";
    case PrismaDocumentStatus.REJECTED:
      return "rejected";
  }
}

function fromPrismaReviewStatus(status: PrismaReviewStatus): ReviewQueueItem["status"] {
  switch (status) {
    case PrismaReviewStatus.PENDING:
      return "pending";
    case PrismaReviewStatus.IN_PROGRESS:
      return "in_progress";
    case PrismaReviewStatus.APPROVED:
      return "approved";
    case PrismaReviewStatus.REJECTED:
      return "rejected";
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

function mapDocument(record: DocumentRecord): Document {
  return {
    id: record.id,
    employeeId: record.employeeId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    storageKey: record.storageKey,
    status: fromPrismaDocumentStatus(record.status),
    classifiedType: record.classifiedType,
    extractedData: null,
    detectedExpiration: record.detectedExpiration,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapReviewQueueItem(record: ReviewQueueItemRecord): ReviewQueueItem {
  return {
    id: record.id,
    documentId: record.documentId,
    status: fromPrismaReviewStatus(record.status),
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
    approvalNotes: record.approvalNotes,
    linkedQualificationId: record.linkedQualificationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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

export const documentsService: DocumentsService = {
  async upload(input, fileBuffer, uploadedBy) {
    await ensureEmployeeExists(input.employeeId);

    const storageKey = randomUUID();

    const document = await prisma.document.create({
      data: {
        employeeId: input.employeeId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        storageKey,
        status: PrismaDocumentStatus.UPLOADED,
        uploadedBy,
        reviewQueueItems: {
          create: {
            status: PrismaReviewStatus.PENDING,
          },
        },
      },
      select: documentBaseSelect,
    });

    return mapDocument(document);
  },

  async getDocument(id) {
    const document = await prisma.document.findUnique({
      where: { id },
      select: documentDetailSelect,
    });

    if (!document) {
      throw new NotFoundError("Document", id);
    }

    return mapDocument(document);
  },

  async listByEmployee(employeeId, page = 1, limit = 50) {
    await ensureEmployeeExists(employeeId);

    const boundedLimit = Math.min(limit, 100);
    const skip = (page - 1) * boundedLimit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { employeeId },
        skip,
        take: boundedLimit,
        orderBy: { createdAt: "desc" },
        select: documentDetailSelect,
      }),
      prisma.document.count({ where: { employeeId } }),
    ]);

    return {
      data: documents.map(mapDocument),
      total,
      page,
      limit: boundedLimit,
    };
  },

  async getExtraction(documentId) {
    await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { id: true },
    }).catch(() => {
      throw new NotFoundError("Document", documentId);
    });

    return [];
  },

  async correctExtraction(_documentId, _fieldId, _input, _correctedBy) {
    throw new ValidationError("Extraction correction not available — OCR pipeline is not implemented.");
  },

  async reviewDocument(id, input, reviewedBy) {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!document) {
      throw new NotFoundError("Document", id);
    }

    const reviewQueueItem = await prisma.reviewQueueItem.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!reviewQueueItem) {
      throw new NotFoundError("ReviewQueueItem", `for document ${id}`);
    }

    const reviewStatus = input.action === "approve" ? PrismaReviewStatus.APPROVED : PrismaReviewStatus.REJECTED;
    const documentStatus = input.action === "approve" ? PrismaDocumentStatus.APPROVED : PrismaDocumentStatus.REJECTED;

    const [updatedReviewItem] = await prisma.$transaction([
      prisma.reviewQueueItem.update({
        where: { id: reviewQueueItem.id },
        data: {
          status: reviewStatus,
          reviewedBy,
          reviewedAt: new Date(),
          approvalNotes: input.notes ?? null,
          linkedQualificationId: input.linkedQualificationId ?? null,
        },
        select: reviewQueueItemSelect,
      }),
      prisma.document.update({
        where: { id },
        data: {
          status: documentStatus,
          reviewedBy,
          reviewedAt: new Date(),
        },
      }),
    ]);

    return mapReviewQueueItem(updatedReviewItem);
  },

  async listReviewQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.reviewQueueItem.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: reviewQueueItemSelect,
      }),
      prisma.reviewQueueItem.count(),
    ]);

    return {
      data: items.map(mapReviewQueueItem),
      total,
      page,
      limit,
    };
  },

  async getAuditTrail(documentId) {
    await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { id: true },
    }).catch(() => {
      throw new NotFoundError("Document", documentId);
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["document", "documents"] },
        recordId: documentId,
      },
      orderBy: { timestamp: "desc" },
    });

    return auditLogs.map(mapAuditLog);
  },
};
