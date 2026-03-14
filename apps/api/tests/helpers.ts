import type { Express } from "express";
import { Roles, type Role } from "@e-clat/shared";
import { createApp, type CreateAppOptions } from "../src/index";
import { signAccessToken } from "../src/modules/auth/tokens";

export function createTestApp(options: CreateAppOptions = {}): Express {
  return createApp(options);
}

export function generateTestToken(role: Role = Roles.EMPLOYEE) {
  return signAccessToken({
    id: `test-${role}-id`,
    email: `${role}@test.local`,
    role,
  });
}
