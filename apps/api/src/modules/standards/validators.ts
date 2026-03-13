import { z } from "zod";

export const createStandardSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  issuingBody: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
});

export const updateStandardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  version: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const createRequirementSchema = z.object({
  standardId: z.string().uuid(),
  category: z.string().min(1).max(100),
  description: z.string().max(2000),
  minimumHours: z.number().positive().nullable().optional(),
  recertificationPeriodMonths: z.number().int().positive().nullable().optional(),
  requiredTests: z.array(z.string()).optional().default([]),
});

export const updateRequirementSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  minimumHours: z.number().positive().nullable().optional(),
  recertificationPeriodMonths: z.number().int().positive().nullable().optional(),
  requiredTests: z.array(z.string()).optional(),
});

export const standardQuerySchema = z.object({
  issuingBody: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateStandardInput = z.infer<typeof createStandardSchema>;
export type UpdateStandardInput = z.infer<typeof updateStandardSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
