import { z } from "zod";

const attestationLevelSchema = z.enum(["self_attest", "upload", "third_party", "validated"]);
const proofTypeSchema = z.enum(["hours", "certification", "training", "clearance", "assessment", "compliance"]);

const baseRequirementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  attestationLevels: z.array(attestationLevelSchema).min(1),
  proofType: proofTypeSchema.optional(),
  proofSubType: z.string().max(200).optional(),
  typeConfig: z.unknown().optional(),
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

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(200).optional(),
  standardId: z.string().uuid().optional(),
  requirements: z.array(baseRequirementSchema).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(200).nullable().optional(),
  standardId: z.string().uuid().nullable().optional(),
});

export const createRequirementSchema = baseRequirementSchema;

export const updateRequirementSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  attestationLevels: z.array(attestationLevelSchema).min(1).optional(),
  proofType: proofTypeSchema.optional(),
  proofSubType: z.string().max(200).optional(),
  typeConfig: z.unknown().optional(),
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

export const reorderRequirementsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1),
});

const assignByEmployeesSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1),
  dueDate: z.coerce.date().optional(),
});

const assignByRoleSchema = z.object({
  role: z.string().min(1),
  dueDate: z.coerce.date().optional(),
});

const assignByDepartmentSchema = z.object({
  department: z.string().min(1),
  dueDate: z.coerce.date().optional(),
});

export const assignTemplateSchema = z.union([assignByEmployeesSchema, assignByRoleSchema, assignByDepartmentSchema]);

export const selfAttestSchema = z.object({
  statement: z.string().max(2000).optional(),
});

export const attachDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

export const validateFulfillmentSchema = z.object({
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

export const thirdPartyVerifySchema = z.object({
  source: z.string().min(1).max(200),
  referenceId: z.string().max(200).optional(),
  data: z.unknown().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
export type ReorderRequirementsInput = z.infer<typeof reorderRequirementsSchema>;
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>;
export type SelfAttestInput = z.infer<typeof selfAttestSchema>;
export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;
export type ValidateFulfillmentInput = z.infer<typeof validateFulfillmentSchema>;
export type ThirdPartyVerifyInput = z.infer<typeof thirdPartyVerifySchema>;
