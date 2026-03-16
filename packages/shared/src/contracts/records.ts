import { z } from "zod";

const documentStatusSchema = z.enum([
  "uploaded",
  "processing",
  "classified",
  "review_required",
  "approved",
  "rejected",
]);
const reviewStatusSchema = z.enum(["pending", "in_progress", "approved", "rejected"]);
const hourSourceSchema = z.enum([
  "clock_in_out",
  "timesheet_import",
  "job_ticket_sync",
  "calendar_sync",
  "manual_entry",
]);
const conflictTypeSchema = z.enum(["duplicate", "mismatch"]);
const conflictStatusSchema = z.enum(["pending", "resolved"]);
const resolutionMethodSchema = z.enum(["precedence", "override", "merge"]);
const processingStepSchema = z.enum([
  "ocr",
  "classification",
  "extraction",
  "expiration_detection",
  "standards_matching",
]);
const processingStatusSchema = z.enum(["pending", "in_progress", "completed", "failed"]);
const documentProcessorSchema = z.enum(["aws-textract", "google-vision", "azure-form-recognizer"]);
const extractionFieldSchema = z.enum(["certName", "issuer", "issueDate", "expirationDate", "issueNumber"]);
const auditActionSchema = z.enum(["inserted", "updated", "overridden", "deleted"]);
const recordsPaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export enum RecordsErrorCode {
  DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND",
  REVIEW_QUEUE_ITEM_NOT_FOUND = "REVIEW_QUEUE_ITEM_NOT_FOUND",
  EXTRACTION_RESULT_NOT_FOUND = "EXTRACTION_RESULT_NOT_FOUND",
  HOUR_RECORD_NOT_FOUND = "HOUR_RECORD_NOT_FOUND",
  HOUR_CONFLICT_NOT_FOUND = "HOUR_CONFLICT_NOT_FOUND",
  DUPLICATE_HOUR_RECORD = "DUPLICATE_HOUR_RECORD",
  MISSING_ATTESTATION = "MISSING_ATTESTATION",
}

export const recordsUploadDocumentRequestSchema = z.object({
  employeeId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const recordsReviewDocumentRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(1000).optional(),
  linkedQualificationId: z.string().uuid().optional(),
});

export const recordsCorrectExtractionRequestSchema = z.object({
  correctedValue: z.string().min(1),
});

export const recordsDocumentListQuerySchema = z.object({
  status: documentStatusSchema.optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const recordsClockInRequestSchema = z.object({
  employeeId: z.string().uuid(),
  timestamp: z.coerce.date().optional(),
});

export const recordsClockOutRequestSchema = z.object({
  employeeId: z.string().uuid(),
  timestamp: z.coerce.date().optional(),
});

export const recordsManualEntryRequestSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.number().positive().max(24),
  qualificationCategory: z.string().min(1),
  description: z.string().min(1).max(500),
  labelId: z.string().uuid().optional(),
  attestation: z.string().min(1, "Employee attestation is required"),
});

export const recordsPayrollImportRequestSchema = z.object({
  records: z.array(z.object({
    employeeId: z.string().uuid(),
    date: z.coerce.date(),
    hours: z.number().positive().max(24),
    qualificationCategory: z.string().min(1),
    description: z.string().optional(),
    labelId: z.string().optional(),
  })).min(1),
  sourceSystemId: z.string().min(1),
});

export const recordsSchedulingImportRequestSchema = z.object({
  records: z.array(z.object({
    employeeId: z.string().uuid(),
    date: z.coerce.date(),
    hours: z.number().positive().max(24),
    jobTicketId: z.string().min(1),
    qualificationCategory: z.string().min(1),
    description: z.string().optional(),
  })).min(1),
  sourceSystemId: z.string().min(1),
});

export const recordsResolveConflictRequestSchema = z.object({
  resolutionMethod: resolutionMethodSchema,
  attestation: z.string().min(1, "Attestation required for conflict resolution"),
  reason: z.string().min(1, "Business reason is required"),
});

export const recordsEditHourRequestSchema = z.object({
  hours: z.number().positive().max(24).optional(),
  qualificationCategory: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(1, "Reason required for edit"),
});

export const recordsDeleteHourRequestSchema = z.object({
  reason: z.string().min(1, "Reason required for deletion"),
});

export const recordsHoursQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: hourSourceSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const recordsConflictListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const recordsReviewQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const recordsDocumentResponseSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  status: documentStatusSchema,
  classifiedType: z.string().nullable(),
  extractedData: z.record(z.string(), z.unknown()).nullable(),
  detectedExpiration: z.date().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const recordsDocumentProcessingResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  processingStep: processingStepSchema,
  status: processingStatusSchema,
  processor: documentProcessorSchema,
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
});

export const recordsExtractionResultResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  field: extractionFieldSchema,
  extractedValue: z.string(),
  confidence: z.number(),
  suggestedValue: z.string().nullable(),
  correctedValue: z.string().nullable(),
  correctedBy: z.string().nullable(),
  correctedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const recordsReviewQueueItemResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  status: reviewStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  approvalNotes: z.string().nullable(),
  linkedQualificationId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const recordsHourRecordResponseSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  source: hourSourceSchema,
  date: z.date(),
  hours: z.number(),
  qualificationCategory: z.string().min(1),
  description: z.string(),
  verifiedBy: z.string().nullable(),
  verifiedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const recordsHourConflictResponseSchema = z.object({
  id: z.string().uuid(),
  recordIds: z.array(z.string().uuid()),
  conflictType: conflictTypeSchema,
  status: conflictStatusSchema,
  resolutionMethod: resolutionMethodSchema.nullable(),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.date().nullable(),
  attestation: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.date(),
});

export const recordsAuditLogEntryResponseSchema = z.object({
  id: z.string().uuid(),
  action: auditActionSchema,
  recordId: z.string().uuid(),
  entityType: z.string().min(1),
  changedFields: z.record(z.string(), z.unknown()).nullable(),
  actor: z.string().min(1),
  reason: z.string().nullable(),
  attestation: z.string().nullable(),
  timestamp: z.date(),
});

export const recordsDocumentListResponseSchema = recordsPaginationSchema.extend({
  data: z.array(recordsDocumentResponseSchema),
});

export const recordsReviewQueueListResponseSchema = recordsPaginationSchema.extend({
  data: z.array(recordsReviewQueueItemResponseSchema),
});

export const recordsHourRecordListResponseSchema = recordsPaginationSchema.extend({
  data: z.array(recordsHourRecordResponseSchema),
});

export const recordsHourConflictListResponseSchema = recordsPaginationSchema.extend({
  data: z.array(recordsHourConflictResponseSchema),
});

export const recordsExtractionResultsResponseSchema = z.object({
  data: z.array(recordsExtractionResultResponseSchema),
});

export const recordsAuditTrailResponseSchema = z.object({
  entries: z.array(recordsAuditLogEntryResponseSchema),
});

export const recordsBulkImportResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
});

export const recordsCalendarSyncResponseSchema = z.object({
  synced: z.number().int().nonnegative(),
});

export interface RecordsUploadDocumentRequest extends z.infer<typeof recordsUploadDocumentRequestSchema> {}
export interface RecordsReviewDocumentRequest extends z.infer<typeof recordsReviewDocumentRequestSchema> {}
export interface RecordsCorrectExtractionRequest extends z.infer<typeof recordsCorrectExtractionRequestSchema> {}
export interface RecordsDocumentListQuery extends z.infer<typeof recordsDocumentListQuerySchema> {}
export interface RecordsClockInRequest extends z.infer<typeof recordsClockInRequestSchema> {}
export interface RecordsClockOutRequest extends z.infer<typeof recordsClockOutRequestSchema> {}
export interface RecordsManualEntryRequest extends z.infer<typeof recordsManualEntryRequestSchema> {}
export interface RecordsPayrollImportRequest extends z.infer<typeof recordsPayrollImportRequestSchema> {}
export interface RecordsSchedulingImportRequest extends z.infer<typeof recordsSchedulingImportRequestSchema> {}
export interface RecordsResolveConflictRequest extends z.infer<typeof recordsResolveConflictRequestSchema> {}
export interface RecordsEditHourRequest extends z.infer<typeof recordsEditHourRequestSchema> {}
export interface RecordsDeleteHourRequest extends z.infer<typeof recordsDeleteHourRequestSchema> {}
export interface RecordsHoursQuery extends z.infer<typeof recordsHoursQuerySchema> {}
export interface RecordsConflictListQuery extends z.infer<typeof recordsConflictListQuerySchema> {}
export interface RecordsReviewQueueQuery extends z.infer<typeof recordsReviewQueueQuerySchema> {}
export interface RecordsDocumentResponse extends z.infer<typeof recordsDocumentResponseSchema> {}
export interface RecordsDocumentProcessingResponse extends z.infer<typeof recordsDocumentProcessingResponseSchema> {}
export interface RecordsExtractionResultResponse extends z.infer<typeof recordsExtractionResultResponseSchema> {}
export interface RecordsReviewQueueItemResponse extends z.infer<typeof recordsReviewQueueItemResponseSchema> {}
export interface RecordsHourRecordResponse extends z.infer<typeof recordsHourRecordResponseSchema> {}
export interface RecordsHourConflictResponse extends z.infer<typeof recordsHourConflictResponseSchema> {}
export interface RecordsAuditLogEntryResponse extends z.infer<typeof recordsAuditLogEntryResponseSchema> {}
export interface RecordsDocumentListResponse extends z.infer<typeof recordsDocumentListResponseSchema> {}
export interface RecordsReviewQueueListResponse extends z.infer<typeof recordsReviewQueueListResponseSchema> {}
export interface RecordsHourRecordListResponse extends z.infer<typeof recordsHourRecordListResponseSchema> {}
export interface RecordsHourConflictListResponse extends z.infer<typeof recordsHourConflictListResponseSchema> {}
export interface RecordsExtractionResultsResponse extends z.infer<typeof recordsExtractionResultsResponseSchema> {}
export interface RecordsAuditTrailResponse extends z.infer<typeof recordsAuditTrailResponseSchema> {}
export interface RecordsBulkImportResponse extends z.infer<typeof recordsBulkImportResponseSchema> {}
export interface RecordsCalendarSyncResponse extends z.infer<typeof recordsCalendarSyncResponseSchema> {}
