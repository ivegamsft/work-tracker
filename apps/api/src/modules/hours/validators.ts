import { z } from "zod";

const hourSourceEnum = z.enum(["clock_in_out", "timesheet_import", "job_ticket_sync", "calendar_sync", "manual_entry"]);

export const clockInSchema = z.object({
  employeeId: z.string().uuid(),
  timestamp: z.coerce.date().optional(),
});

export const clockOutSchema = z.object({
  employeeId: z.string().uuid(),
  timestamp: z.coerce.date().optional(),
});

export const manualEntrySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.number().positive().max(24),
  qualificationCategory: z.string().min(1),
  description: z.string().min(1).max(500),
  labelId: z.string().uuid().optional(),
  attestation: z.string().min(1, "Employee attestation is required"),
});

export const payrollImportSchema = z.object({
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

export const schedulingImportSchema = z.object({
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

export const resolveConflictSchema = z.object({
  resolutionMethod: z.enum(["precedence", "override", "merge"]),
  attestation: z.string().min(1, "Attestation required for conflict resolution"),
  reason: z.string().min(1, "Business reason is required"),
});

export const editHourSchema = z.object({
  hours: z.number().positive().max(24).optional(),
  qualificationCategory: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(1, "Reason required for edit"),
});

export const deleteHourSchema = z.object({
  reason: z.string().min(1, "Reason required for deletion"),
});

export const hoursQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: hourSourceEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const progressQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  proofType: z.string().optional(),
});

export const teamProgressQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  proofType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type ManualEntryInput = z.infer<typeof manualEntrySchema>;
export type PayrollImportInput = z.infer<typeof payrollImportSchema>;
export type SchedulingImportInput = z.infer<typeof schedulingImportSchema>;
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>;
export type EditHourInput = z.infer<typeof editHourSchema>;
export type ProgressQueryInput = z.infer<typeof progressQuerySchema>;
export type TeamProgressQueryInput = z.infer<typeof teamProgressQuerySchema>;
