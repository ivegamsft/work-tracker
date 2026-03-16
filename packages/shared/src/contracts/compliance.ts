import { z } from "zod";

const roleSchema = z.enum(["employee", "supervisor", "manager", "compliance_officer", "admin"]);
const qualificationStatusSchema = z.enum([
  "active",
  "expiring_soon",
  "expired",
  "pending_review",
  "suspended",
]);
const medicalClearanceStatusSchema = z.enum(["cleared", "pending", "restricted", "expired"]);
const medicalResultSchema = z.enum(["pass", "fail"]);
const attestationLevelSchema = z.enum(["self_attest", "upload", "third_party", "validated"]);
const proofTypeSchema = z.enum(["hours", "certification", "training", "clearance", "assessment", "compliance"]);
const templateStatusSchema = z.enum(["draft", "published", "archived"]);
const fulfillmentStatusSchema = z.enum(["unfulfilled", "pending_review", "fulfilled", "expired", "rejected"]);
const proofJsonSchema = z.unknown();

const paginatedProofTemplateSchema = z.object({
  data: z.array(z.lazy(() => complianceProofTemplateResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedTemplateAssignmentWithEmployeeSchema = z.object({
  data: z.array(z.lazy(() => complianceTemplateAssignmentWithEmployeeResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedTemplateAssignmentWithTemplateSchema = z.object({
  data: z.array(z.lazy(() => complianceTemplateAssignmentWithTemplateResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedProofFulfillmentSchema = z.object({
  data: z.array(z.lazy(() => complianceProofFulfillmentResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedQualificationSchema = z.object({
  data: z.array(z.lazy(() => complianceQualificationResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedMedicalClearanceSchema = z.object({
  data: z.array(z.lazy(() => complianceMedicalClearanceResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export enum ComplianceErrorCode {
  QUALIFICATION_NOT_FOUND = "QUALIFICATION_NOT_FOUND",
  MEDICAL_CLEARANCE_NOT_FOUND = "MEDICAL_CLEARANCE_NOT_FOUND",
  TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND",
  REQUIREMENT_NOT_FOUND = "REQUIREMENT_NOT_FOUND",
  ASSIGNMENT_NOT_FOUND = "ASSIGNMENT_NOT_FOUND",
  FULFILLMENT_NOT_FOUND = "FULFILLMENT_NOT_FOUND",
  INVALID_TEMPLATE_STATE = "INVALID_TEMPLATE_STATE",
  INVALID_ATTESTATION_LEVEL = "INVALID_ATTESTATION_LEVEL",
}

export const complianceCreateQualificationRequestSchema = z.object({
  employeeId: z.string().uuid(),
  standardId: z.string().uuid(),
  certificationName: z.string().min(1).max(200),
  issuingBody: z.string().min(1).max(200),
  issueDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  documentIds: z.array(z.string().uuid()).optional().default([]),
});

export const complianceUpdateQualificationRequestSchema = z.object({
  certificationName: z.string().min(1).max(200).optional(),
  issuingBody: z.string().min(1).max(200).optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  status: qualificationStatusSchema.optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

export const complianceQualificationListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  standardId: z.string().uuid().optional(),
  status: qualificationStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const complianceCreateMedicalClearanceRequestSchema = z.object({
  employeeId: z.string().uuid(),
  clearanceType: z.string().min(1).max(100),
  status: medicalClearanceStatusSchema,
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  visualAcuityResult: medicalResultSchema.nullable().optional(),
  colorVisionResult: medicalResultSchema.nullable().optional(),
  issuedBy: z.string().min(1),
});

export const complianceUpdateMedicalClearanceRequestSchema = z.object({
  status: medicalClearanceStatusSchema.optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  visualAcuityResult: medicalResultSchema.nullable().optional(),
  colorVisionResult: medicalResultSchema.nullable().optional(),
});

export const complianceMedicalClearanceListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: medicalClearanceStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const complianceProofRequirementDraftSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  attestationLevels: z.array(attestationLevelSchema).min(1),
  proofType: proofTypeSchema.optional(),
  proofSubType: z.string().max(200).optional(),
  typeConfig: proofJsonSchema.optional(),
  threshold: z.coerce.number().positive().optional(),
  thresholdUnit: z.string().max(50).optional(),
  rollingWindowDays: z.coerce.number().int().positive().optional(),
  universalCategory: z.string().max(100).optional(),
  qualificationType: z.string().max(200).optional(),
  medicalTestType: z.string().max(200).optional(),
  standardReqId: z.string().uuid().optional(),
  validityDays: z.coerce.number().int().positive().optional(),
  renewalWarningDays: z.coerce.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
});

export const complianceCreateProofTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(200).optional(),
  standardId: z.string().uuid().optional(),
  requirements: z.array(complianceProofRequirementDraftSchema).optional(),
});

export const complianceUpdateProofTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(200).nullable().optional(),
  standardId: z.string().uuid().nullable().optional(),
});

export const complianceCreateProofRequirementRequestSchema = complianceProofRequirementDraftSchema;

export const complianceUpdateProofRequirementRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  attestationLevels: z.array(attestationLevelSchema).min(1).optional(),
  proofType: proofTypeSchema.optional(),
  proofSubType: z.string().max(200).optional(),
  typeConfig: proofJsonSchema.optional(),
  threshold: z.coerce.number().positive().optional(),
  thresholdUnit: z.string().max(50).optional(),
  rollingWindowDays: z.coerce.number().int().positive().optional(),
  universalCategory: z.string().max(100).optional(),
  qualificationType: z.string().max(200).optional(),
  medicalTestType: z.string().max(200).optional(),
  standardReqId: z.string().uuid().optional(),
  validityDays: z.coerce.number().int().positive().optional(),
  renewalWarningDays: z.coerce.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
});

export const complianceReorderProofRequirementsRequestSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1),
});

export const complianceTemplateListQuerySchema = z.object({
  status: templateStatusSchema.optional(),
  category: z.string().optional(),
  standardId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const complianceAssignmentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const complianceAssignTemplateRequestSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).optional(),
  role: roleSchema.optional(),
  department: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
}).superRefine((value, ctx) => {
  const selectedTargets = [
    value.employeeIds && value.employeeIds.length > 0,
    Boolean(value.role),
    Boolean(value.department),
  ].filter(Boolean).length;

  if (selectedTargets !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["employeeIds"],
      message: "Provide exactly one assignment target: employeeIds, role, or department.",
    });
  }
});

export const complianceSelfAttestFulfillmentRequestSchema = z.object({
  statement: z.string().max(2000).optional(),
});

export const complianceAttachFulfillmentDocumentRequestSchema = z.object({
  documentId: z.string().uuid(),
});

export const complianceValidateFulfillmentRequestSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (!value.approved && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Rejection reason is required when approval is false.",
    });
  }
});

export const complianceThirdPartyVerifyFulfillmentRequestSchema = z.object({
  source: z.string().min(1).max(200),
  referenceId: z.string().max(200).optional(),
  data: proofJsonSchema.optional(),
});

export const complianceQualificationResponseSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  standardId: z.string().uuid(),
  certificationName: z.string().min(1).max(200),
  issuingBody: z.string().min(1).max(200),
  issueDate: z.date(),
  expirationDate: z.date().nullable(),
  status: qualificationStatusSchema,
  documentIds: z.array(z.string().uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const complianceMedicalClearanceResponseSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  clearanceType: z.string().min(1).max(100),
  status: medicalClearanceStatusSchema,
  effectiveDate: z.date(),
  expirationDate: z.date().nullable(),
  visualAcuityResult: medicalResultSchema.nullable(),
  colorVisionResult: medicalResultSchema.nullable(),
  issuedBy: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const complianceProofRequirementResponseSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string(),
  attestationLevels: z.array(attestationLevelSchema),
  proofType: proofTypeSchema.nullable(),
  proofSubType: z.string().nullable(),
  typeConfig: proofJsonSchema.nullable(),
  threshold: z.number().nullable(),
  thresholdUnit: z.string().nullable(),
  rollingWindowDays: z.number().int().nullable(),
  universalCategory: z.string().nullable(),
  qualificationType: z.string().nullable(),
  medicalTestType: z.string().nullable(),
  standardReqId: z.string().uuid().nullable(),
  validityDays: z.number().int().nullable(),
  renewalWarningDays: z.number().int().nullable(),
  sortOrder: z.number().int().nonnegative(),
  isRequired: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const complianceProofTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string(),
  category: z.string().nullable(),
  status: templateStatusSchema,
  version: z.number().int().positive(),
  previousVersion: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable(),
  standardId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  requirements: z.array(complianceProofRequirementResponseSchema),
});

export const complianceTemplateAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  employeeId: z.string().uuid().nullable(),
  role: z.string().nullable(),
  department: z.string().nullable(),
  assignedBy: z.string().uuid(),
  dueDate: z.date().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export const complianceTemplateAssignmentWithEmployeeResponseSchema = complianceTemplateAssignmentResponseSchema.extend({
  employeeName: z.string().nullable(),
  employeeEmail: z.string().email().nullable(),
});

export const complianceTemplateAssignmentWithTemplateResponseSchema = complianceTemplateAssignmentResponseSchema.extend({
  templateName: z.string().min(1),
  templateStatus: templateStatusSchema,
});

export const complianceProofFulfillmentResponseSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  requirementId: z.string().uuid(),
  employeeId: z.string().uuid(),
  status: fulfillmentStatusSchema,
  selfAttestedAt: z.date().nullable(),
  selfAttestation: z.string().nullable(),
  uploadedAt: z.date().nullable(),
  documentId: z.string().uuid().nullable(),
  thirdPartyVerifiedAt: z.date().nullable(),
  thirdPartySource: z.string().nullable(),
  thirdPartyRefId: z.string().nullable(),
  thirdPartyData: proofJsonSchema.nullable(),
  validatedAt: z.date().nullable(),
  validatedBy: z.string().uuid().nullable(),
  validatorNotes: z.string().nullable(),
  rejectedAt: z.date().nullable(),
  rejectionReason: z.string().nullable(),
  expiresAt: z.date().nullable(),
  expiredAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  requirement: complianceProofRequirementResponseSchema.optional(),
});

export const complianceQualificationListResponseSchema = paginatedQualificationSchema;
export const complianceMedicalClearanceListResponseSchema = paginatedMedicalClearanceSchema;
export const complianceProofTemplateListResponseSchema = paginatedProofTemplateSchema;
export const complianceTemplateAssignmentListResponseSchema = paginatedTemplateAssignmentWithEmployeeSchema;
export const complianceEmployeeTemplateAssignmentListResponseSchema = paginatedTemplateAssignmentWithTemplateSchema;
export const compliancePendingReviewListResponseSchema = paginatedProofFulfillmentSchema;

export const complianceTemplateAssignmentsResponseSchema = z.object({
  assignments: z.array(complianceTemplateAssignmentWithEmployeeResponseSchema),
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const compliancePendingReviewCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export interface ComplianceCreateQualificationRequest extends z.infer<typeof complianceCreateQualificationRequestSchema> {}
export interface ComplianceUpdateQualificationRequest extends z.infer<typeof complianceUpdateQualificationRequestSchema> {}
export interface ComplianceQualificationListQuery extends z.infer<typeof complianceQualificationListQuerySchema> {}
export interface ComplianceCreateMedicalClearanceRequest extends z.infer<typeof complianceCreateMedicalClearanceRequestSchema> {}
export interface ComplianceUpdateMedicalClearanceRequest extends z.infer<typeof complianceUpdateMedicalClearanceRequestSchema> {}
export interface ComplianceMedicalClearanceListQuery extends z.infer<typeof complianceMedicalClearanceListQuerySchema> {}
export interface ComplianceProofRequirementDraft extends z.infer<typeof complianceProofRequirementDraftSchema> {}
export interface ComplianceCreateProofTemplateRequest extends z.infer<typeof complianceCreateProofTemplateRequestSchema> {}
export interface ComplianceUpdateProofTemplateRequest extends z.infer<typeof complianceUpdateProofTemplateRequestSchema> {}
export interface ComplianceCreateProofRequirementRequest extends z.infer<typeof complianceCreateProofRequirementRequestSchema> {}
export interface ComplianceUpdateProofRequirementRequest extends z.infer<typeof complianceUpdateProofRequirementRequestSchema> {}
export interface ComplianceReorderProofRequirementsRequest extends z.infer<typeof complianceReorderProofRequirementsRequestSchema> {}
export interface ComplianceTemplateListQuery extends z.infer<typeof complianceTemplateListQuerySchema> {}
export interface ComplianceAssignmentListQuery extends z.infer<typeof complianceAssignmentListQuerySchema> {}
export interface ComplianceAssignTemplateRequest extends z.infer<typeof complianceAssignTemplateRequestSchema> {}
export interface ComplianceSelfAttestFulfillmentRequest extends z.infer<typeof complianceSelfAttestFulfillmentRequestSchema> {}
export interface ComplianceAttachFulfillmentDocumentRequest extends z.infer<typeof complianceAttachFulfillmentDocumentRequestSchema> {}
export interface ComplianceValidateFulfillmentRequest extends z.infer<typeof complianceValidateFulfillmentRequestSchema> {}
export interface ComplianceThirdPartyVerifyFulfillmentRequest extends z.infer<typeof complianceThirdPartyVerifyFulfillmentRequestSchema> {}
export interface ComplianceQualificationResponse extends z.infer<typeof complianceQualificationResponseSchema> {}
export interface ComplianceMedicalClearanceResponse extends z.infer<typeof complianceMedicalClearanceResponseSchema> {}
export interface ComplianceProofRequirementResponse extends z.infer<typeof complianceProofRequirementResponseSchema> {}
export interface ComplianceProofTemplateResponse extends z.infer<typeof complianceProofTemplateResponseSchema> {}
export interface ComplianceTemplateAssignmentResponse extends z.infer<typeof complianceTemplateAssignmentResponseSchema> {}
export interface ComplianceTemplateAssignmentWithEmployeeResponse extends z.infer<typeof complianceTemplateAssignmentWithEmployeeResponseSchema> {}
export interface ComplianceTemplateAssignmentWithTemplateResponse extends z.infer<typeof complianceTemplateAssignmentWithTemplateResponseSchema> {}
export interface ComplianceProofFulfillmentResponse extends z.infer<typeof complianceProofFulfillmentResponseSchema> {}
export interface ComplianceQualificationListResponse extends z.infer<typeof complianceQualificationListResponseSchema> {}
export interface ComplianceMedicalClearanceListResponse extends z.infer<typeof complianceMedicalClearanceListResponseSchema> {}
export interface ComplianceProofTemplateListResponse extends z.infer<typeof complianceProofTemplateListResponseSchema> {}
export interface ComplianceTemplateAssignmentListResponse extends z.infer<typeof complianceTemplateAssignmentListResponseSchema> {}
export interface ComplianceEmployeeTemplateAssignmentListResponse extends z.infer<typeof complianceEmployeeTemplateAssignmentListResponseSchema> {}
export interface CompliancePendingReviewListResponse extends z.infer<typeof compliancePendingReviewListResponseSchema> {}
export interface ComplianceTemplateAssignmentsResponse extends z.infer<typeof complianceTemplateAssignmentsResponseSchema> {}
export interface CompliancePendingReviewCountResponse extends z.infer<typeof compliancePendingReviewCountResponseSchema> {}
