import { z } from "zod";

export const uploadDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const reviewDocumentSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(1000).optional(),
  linkedQualificationId: z.string().uuid().optional(),
});

export const correctExtractionSchema = z.object({
  correctedValue: z.string().min(1),
});

export const documentQuerySchema = z.object({
  status: z.enum(["uploaded", "processing", "classified", "review_required", "approved", "rejected"]).optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
export type CorrectExtractionInput = z.infer<typeof correctExtractionSchema>;
