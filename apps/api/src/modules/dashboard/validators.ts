import { z } from "zod";

export const complianceSummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
});

export const teamSummaryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ComplianceSummaryQuery = z.infer<typeof complianceSummaryQuerySchema>;
export type TeamSummaryQuery = z.infer<typeof teamSummaryQuerySchema>;
