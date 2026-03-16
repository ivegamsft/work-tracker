import { z } from "zod";
import { RoleHierarchy, Roles } from "../types";

const roleSchema = z.enum([
  Roles.EMPLOYEE,
  Roles.SUPERVISOR,
  Roles.MANAGER,
  Roles.COMPLIANCE_OFFICER,
  Roles.ADMIN,
]);

const tokenTypeSchema = z.enum(["access", "refresh"]);
const permissionSchema = z.enum([
  "employees.read",
  "employees.write",
  "qualifications.read",
  "qualifications.write",
  "documents.review",
  "hours.manage",
  "reference_data.manage",
  "notifications.manage",
  "feature_flags.resolve",
]);

export enum IdentityErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_ROLE = "INSUFFICIENT_ROLE",
}

export const identityRegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  employeeNumber: z.string().min(1).max(50),
});

export const identityLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const identityRefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const identityChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const identityRoleHierarchySchema = z.object({
  [Roles.EMPLOYEE]: z.literal(RoleHierarchy[Roles.EMPLOYEE]),
  [Roles.SUPERVISOR]: z.literal(RoleHierarchy[Roles.SUPERVISOR]),
  [Roles.MANAGER]: z.literal(RoleHierarchy[Roles.MANAGER]),
  [Roles.COMPLIANCE_OFFICER]: z.literal(RoleHierarchy[Roles.COMPLIANCE_OFFICER]),
  [Roles.ADMIN]: z.literal(RoleHierarchy[Roles.ADMIN]),
});

export const identityAuthSubjectResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
});

export const identityTokenClaimsResponseSchema = identityAuthSubjectResponseSchema.extend({
  tokenType: tokenTypeSchema,
  permissions: z.array(permissionSchema).default([]),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
});

export const identityAuthTokensResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().nonnegative(),
});

export const identityRegisterResponseSchema = z.object({
  id: z.string().uuid(),
});

export const identityRbacContextResponseSchema = z.object({
  user: identityAuthSubjectResponseSchema,
  hierarchyLevel: z.number().int().min(0),
  permissions: z.array(permissionSchema),
  roleHierarchy: identityRoleHierarchySchema,
  accessTokenExpiresIn: z.number().int().nonnegative().optional(),
});

export interface IdentityRegisterRequest extends z.infer<typeof identityRegisterRequestSchema> {}
export interface IdentityLoginRequest extends z.infer<typeof identityLoginRequestSchema> {}
export interface IdentityRefreshTokenRequest extends z.infer<typeof identityRefreshTokenRequestSchema> {}
export interface IdentityChangePasswordRequest extends z.infer<typeof identityChangePasswordRequestSchema> {}
export interface IdentityRoleHierarchy extends z.infer<typeof identityRoleHierarchySchema> {}
export interface IdentityAuthSubjectResponse extends z.infer<typeof identityAuthSubjectResponseSchema> {}
export interface IdentityTokenClaimsResponse extends z.infer<typeof identityTokenClaimsResponseSchema> {}
export interface IdentityAuthTokensResponse extends z.infer<typeof identityAuthTokensResponseSchema> {}
export interface IdentityRegisterResponse extends z.infer<typeof identityRegisterResponseSchema> {}
export interface IdentityRbacContextResponse extends z.infer<typeof identityRbacContextResponseSchema> {}
