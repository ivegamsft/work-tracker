import { z } from "zod";

export const createLabelSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, "Code must be uppercase alphanumeric with underscores"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  effectiveDate: z.coerce.date(),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const deprecateLabelSchema = z.object({
  retirementDate: z.coerce.date(),
  migrateTo: z.string().optional(),
});

export const createLabelMappingSchema = z.object({
  labelId: z.string().uuid(),
  hourCategory: z.string().min(1),
  effectiveDate: z.coerce.date(),
});

export const resolveLabelQuery = z.object({
  label: z.string().min(1),
  version: z.coerce.number().int().positive().optional(),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type DeprecateLabelInput = z.infer<typeof deprecateLabelSchema>;
export type CreateLabelMappingInput = z.infer<typeof createLabelMappingSchema>;
