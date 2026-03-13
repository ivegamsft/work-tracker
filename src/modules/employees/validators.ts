import { z } from "zod";

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["employee", "supervisor", "manager", "compliance_officer", "admin"]),
  departmentId: z.string().uuid(),
  hireDate: z.coerce.date(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["employee", "supervisor", "manager", "compliance_officer", "admin"]).optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const employeeQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
