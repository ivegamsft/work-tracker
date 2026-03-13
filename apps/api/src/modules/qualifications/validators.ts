import { z } from "zod";

export const createQualificationSchema = z.object({
  employeeId: z.string().uuid(),
  standardId: z.string().uuid(),
  certificationName: z.string().min(1).max(200),
  issuingBody: z.string().min(1).max(200),
  issueDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  documentIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateQualificationSchema = z.object({
  certificationName: z.string().min(1).max(200).optional(),
  issuingBody: z.string().min(1).max(200).optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  status: z.enum(["active", "expiring_soon", "expired", "pending_review", "suspended"]).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

export const qualificationQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  standardId: z.string().uuid().optional(),
  status: z.enum(["active", "expiring_soon", "expired", "pending_review", "suspended"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateQualificationInput = z.infer<typeof createQualificationSchema>;
export type UpdateQualificationInput = z.infer<typeof updateQualificationSchema>;
