import { z } from "zod";
import { Roles } from "../types";

const roleSchema = z.enum([
  Roles.EMPLOYEE,
  Roles.SUPERVISOR,
  Roles.MANAGER,
  Roles.COMPLIANCE_OFFICER,
  Roles.ADMIN,
]);

const qualificationStatusSchema = z.enum([
  "active",
  "expiring_soon",
  "expired",
  "pending_review",
  "suspended",
]);

const medicalClearanceStatusSchema = z.enum(["cleared", "pending", "restricted", "expired"]);
const readinessStatusSchema = z.enum(["compliant", "at_risk", "non_compliant"]);

const paginatedEmployeeDirectorySchema = z.object({
  data: z.array(z.lazy(() => workforceEmployeeRecordSchema)),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export enum WorkforceErrorCode {
  EMPLOYEE_NOT_FOUND = "EMPLOYEE_NOT_FOUND",
  EMPLOYEE_EMAIL_CONFLICT = "EMPLOYEE_EMAIL_CONFLICT",
  EMPLOYEE_NUMBER_CONFLICT = "EMPLOYEE_NUMBER_CONFLICT",
  TEAM_RELATIONSHIP_NOT_FOUND = "TEAM_RELATIONSHIP_NOT_FOUND",
}

export const workforceCreateEmployeeRequestSchema = z.object({
  employeeNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: roleSchema,
  departmentId: z.string().uuid(),
  hireDate: z.coerce.date(),
});

export const workforceUpdateEmployeeRequestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: roleSchema.optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const workforceEmployeeDirectoryQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const workforceTeamRelationshipQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const workforceEmployeeRecordSchema = z.object({
  id: z.string().uuid(),
  employeeNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: roleSchema,
  departmentId: z.string(),
  hireDate: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const workforceTeamRelationshipResponseSchema = z.object({
  employeeId: z.string().uuid(),
  managerId: z.string().uuid().nullable(),
  departmentId: z.string().nullable(),
  directReportIds: z.array(z.string().uuid()).default([]),
  peers: z.array(z.string().uuid()).default([]),
});

export const workforceQualificationReadinessItemSchema = z.object({
  qualificationId: z.string().uuid().nullable(),
  standardId: z.string().uuid(),
  standardCode: z.string().min(1),
  standardName: z.string().min(1),
  certificationName: z.string().nullable(),
  expirationDate: z.date().nullable(),
  status: z.union([qualificationStatusSchema, z.literal("missing")]),
  readinessStatus: readinessStatusSchema,
});

export const workforceMedicalReadinessItemSchema = z.object({
  clearanceId: z.string().uuid().nullable(),
  clearanceType: z.string().min(1),
  expirationDate: z.date().nullable(),
  status: z.union([medicalClearanceStatusSchema, z.literal("missing")]),
  readinessStatus: readinessStatusSchema,
});

export const workforceEmployeeReadinessResponseSchema = z.object({
  employeeId: z.string().uuid(),
  overallStatus: readinessStatusSchema,
  qualifications: z.array(workforceQualificationReadinessItemSchema),
  medicalClearances: z.array(workforceMedicalReadinessItemSchema),
});

export const workforceEmployeeDirectoryResponseSchema = paginatedEmployeeDirectorySchema;

export interface WorkforceCreateEmployeeRequest extends z.infer<typeof workforceCreateEmployeeRequestSchema> {}
export interface WorkforceUpdateEmployeeRequest extends z.infer<typeof workforceUpdateEmployeeRequestSchema> {}
export interface WorkforceEmployeeDirectoryQuery extends z.infer<typeof workforceEmployeeDirectoryQuerySchema> {}
export interface WorkforceTeamRelationshipQuery extends z.infer<typeof workforceTeamRelationshipQuerySchema> {}
export interface WorkforceEmployeeRecord extends z.infer<typeof workforceEmployeeRecordSchema> {}
export interface WorkforceTeamRelationshipResponse extends z.infer<typeof workforceTeamRelationshipResponseSchema> {}
export interface WorkforceQualificationReadinessItem extends z.infer<typeof workforceQualificationReadinessItemSchema> {}
export interface WorkforceMedicalReadinessItem extends z.infer<typeof workforceMedicalReadinessItemSchema> {}
export interface WorkforceEmployeeReadinessResponse extends z.infer<typeof workforceEmployeeReadinessResponseSchema> {}
export interface WorkforceEmployeeDirectoryResponse extends z.infer<typeof workforceEmployeeDirectoryResponseSchema> {}
