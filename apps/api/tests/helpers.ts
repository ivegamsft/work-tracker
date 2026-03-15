import type { Express } from "express";
import { v5 as uuidv5 } from "uuid";
import { Roles, type Role } from "@e-clat/shared";
import { createApp, type CreateAppOptions } from "../src/index";
import { signAccessToken } from "../src/modules/auth/tokens";

const MOCK_USER_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export const seededTestUsers = {
  employee: {
    id: uuidv5("employee@example.com", MOCK_USER_NAMESPACE),
    email: "employee@example.com",
    role: Roles.EMPLOYEE,
  },
  supervisor: {
    id: uuidv5("supervisor@example.com", MOCK_USER_NAMESPACE),
    email: "supervisor@example.com",
    role: Roles.SUPERVISOR,
  },
  manager: {
    id: uuidv5("manager@example.com", MOCK_USER_NAMESPACE),
    email: "manager@example.com",
    role: Roles.MANAGER,
  },
  complianceOfficer: {
    id: uuidv5("compliance@example.com", MOCK_USER_NAMESPACE),
    email: "compliance@example.com",
    role: Roles.COMPLIANCE_OFFICER,
  },
  admin: {
    id: uuidv5("admin@example.com", MOCK_USER_NAMESPACE),
    email: "admin@example.com",
    role: Roles.ADMIN,
  },
} as const;

export function createTestApp(options: CreateAppOptions = {}): Express {
  return createApp(options);
}

export function getSeededTestUser(role: Role = Roles.EMPLOYEE) {
  const user = Object.values(seededTestUsers).find((candidate) => candidate.role === role);

  if (!user) {
    throw new Error(`No seeded test user configured for role '${role}'`);
  }

  return user;
}

export function generateTestToken(role: Role = Roles.EMPLOYEE) {
  return signAccessToken(getSeededTestUser(role));
}
