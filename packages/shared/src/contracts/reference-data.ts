import { z } from "zod";

const labelStatusSchema = z.enum(["active", "deprecated"]);

const paginatedStandardsSchema = z.object({
  data: z.array(z.lazy(() => referenceDataStandardResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const paginatedLabelsSchema = z.object({
  data: z.array(z.lazy(() => referenceDataLabelResponseSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export enum ReferenceDataErrorCode {
  STANDARD_NOT_FOUND = "STANDARD_NOT_FOUND",
  STANDARD_CODE_CONFLICT = "STANDARD_CODE_CONFLICT",
  REQUIREMENT_NOT_FOUND = "REQUIREMENT_NOT_FOUND",
  LABEL_NOT_FOUND = "LABEL_NOT_FOUND",
  LABEL_CODE_CONFLICT = "LABEL_CODE_CONFLICT",
  LABEL_MAPPING_CONFLICT = "LABEL_MAPPING_CONFLICT",
}

export const referenceDataCreateStandardRequestSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  issuingBody: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
});

export const referenceDataUpdateStandardRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  version: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const referenceDataCreateStandardRequirementRequestSchema = z.object({
  standardId: z.string().uuid(),
  category: z.string().min(1).max(100),
  description: z.string().max(2000),
  minimumHours: z.number().positive().nullable().optional(),
  recertificationPeriodMonths: z.number().int().positive().nullable().optional(),
  requiredTests: z.array(z.string()).optional().default([]),
});

export const referenceDataUpdateStandardRequirementRequestSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  minimumHours: z.number().positive().nullable().optional(),
  recertificationPeriodMonths: z.number().int().positive().nullable().optional(),
  requiredTests: z.array(z.string()).optional(),
});

export const referenceDataStandardListQuerySchema = z.object({
  issuingBody: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const referenceDataCreateLabelRequestSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, "Code must be uppercase alphanumeric with underscores"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  effectiveDate: z.coerce.date(),
});

export const referenceDataUpdateLabelRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const referenceDataDeprecateLabelRequestSchema = z.object({
  retirementDate: z.coerce.date(),
  migrateTo: z.string().optional(),
});

export const referenceDataCreateLabelMappingRequestSchema = z.object({
  labelId: z.string().uuid(),
  hourCategory: z.string().min(1),
  effectiveDate: z.coerce.date(),
});

export const referenceDataResolveLabelQuerySchema = z.object({
  label: z.string().min(1),
  version: z.coerce.number().int().positive().optional(),
});

export const referenceDataStandardRequirementResponseSchema = z.object({
  id: z.string().uuid(),
  standardId: z.string().uuid(),
  category: z.string().min(1).max(100),
  description: z.string().max(2000),
  minimumHours: z.number().nullable(),
  recertificationPeriodMonths: z.number().int().nullable(),
  requiredTests: z.array(z.string()),
});

export const referenceDataStandardResponseSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string(),
  issuingBody: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
  requirements: z.array(referenceDataStandardRequirementResponseSchema),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const referenceDataLabelResponseSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string(),
  status: labelStatusSchema,
  effectiveDate: z.date(),
  retirementDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const referenceDataLabelMappingResponseSchema = z.object({
  id: z.string().uuid(),
  labelId: z.string().uuid(),
  hourCategory: z.string().min(1),
  version: z.number().int().positive(),
  effectiveDate: z.date(),
  createdAt: z.date(),
});

export const referenceDataTaxonomyVersionResponseSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  changeLog: z.string(),
  migrationRules: z.record(z.string(), z.string()),
  publishedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const referenceDataHourSourceMappingResponseSchema = z.object({
  id: z.string().uuid(),
  sourceSystemId: z.string().min(1),
  sourceFieldMapping: z.record(z.string(), z.string()),
  labelTransformRules: z.record(z.string(), z.string()),
  qualificationCategoryMapping: z.record(z.string(), z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const referenceDataStandardListResponseSchema = paginatedStandardsSchema;
export const referenceDataLabelListResponseSchema = paginatedLabelsSchema;

export const referenceDataLabelResolutionResponseSchema = z.object({
  label: referenceDataLabelResponseSchema,
  mapping: referenceDataLabelMappingResponseSchema.nullable(),
  taxonomyVersion: referenceDataTaxonomyVersionResponseSchema.nullable(),
});

export interface ReferenceDataCreateStandardRequest extends z.infer<typeof referenceDataCreateStandardRequestSchema> {}
export interface ReferenceDataUpdateStandardRequest extends z.infer<typeof referenceDataUpdateStandardRequestSchema> {}
export interface ReferenceDataCreateStandardRequirementRequest extends z.infer<typeof referenceDataCreateStandardRequirementRequestSchema> {}
export interface ReferenceDataUpdateStandardRequirementRequest extends z.infer<typeof referenceDataUpdateStandardRequirementRequestSchema> {}
export interface ReferenceDataStandardListQuery extends z.infer<typeof referenceDataStandardListQuerySchema> {}
export interface ReferenceDataCreateLabelRequest extends z.infer<typeof referenceDataCreateLabelRequestSchema> {}
export interface ReferenceDataUpdateLabelRequest extends z.infer<typeof referenceDataUpdateLabelRequestSchema> {}
export interface ReferenceDataDeprecateLabelRequest extends z.infer<typeof referenceDataDeprecateLabelRequestSchema> {}
export interface ReferenceDataCreateLabelMappingRequest extends z.infer<typeof referenceDataCreateLabelMappingRequestSchema> {}
export interface ReferenceDataResolveLabelQuery extends z.infer<typeof referenceDataResolveLabelQuerySchema> {}
export interface ReferenceDataStandardRequirementResponse extends z.infer<typeof referenceDataStandardRequirementResponseSchema> {}
export interface ReferenceDataStandardResponse extends z.infer<typeof referenceDataStandardResponseSchema> {}
export interface ReferenceDataLabelResponse extends z.infer<typeof referenceDataLabelResponseSchema> {}
export interface ReferenceDataLabelMappingResponse extends z.infer<typeof referenceDataLabelMappingResponseSchema> {}
export interface ReferenceDataTaxonomyVersionResponse extends z.infer<typeof referenceDataTaxonomyVersionResponseSchema> {}
export interface ReferenceDataHourSourceMappingResponse extends z.infer<typeof referenceDataHourSourceMappingResponseSchema> {}
export interface ReferenceDataStandardListResponse extends z.infer<typeof referenceDataStandardListResponseSchema> {}
export interface ReferenceDataLabelListResponse extends z.infer<typeof referenceDataLabelListResponseSchema> {}
export interface ReferenceDataLabelResolutionResponse extends z.infer<typeof referenceDataLabelResolutionResponseSchema> {}
