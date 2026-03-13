import { z } from "zod";

export const createMedicalClearanceSchema = z.object({
  employeeId: z.string().uuid(),
  clearanceType: z.string().min(1).max(100),
  status: z.enum(["cleared", "pending", "restricted", "expired"]),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  visualAcuityResult: z.enum(["pass", "fail"]).nullable().optional(),
  colorVisionResult: z.enum(["pass", "fail"]).nullable().optional(),
  issuedBy: z.string().min(1),
});

export const updateMedicalClearanceSchema = z.object({
  status: z.enum(["cleared", "pending", "restricted", "expired"]).optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  visualAcuityResult: z.enum(["pass", "fail"]).nullable().optional(),
  colorVisionResult: z.enum(["pass", "fail"]).nullable().optional(),
});

export const medicalQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(["cleared", "pending", "restricted", "expired"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateMedicalClearanceInput = z.infer<typeof createMedicalClearanceSchema>;
export type UpdateMedicalClearanceInput = z.infer<typeof updateMedicalClearanceSchema>;
