export const Roles = {
  EMPLOYEE: "employee",
  SUPERVISOR: "supervisor",
  MANAGER: "manager",
  COMPLIANCE_OFFICER: "compliance_officer",
  ADMIN: "admin",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const RoleHierarchy: Record<Role, number> = {
  [Roles.EMPLOYEE]: 0,
  [Roles.SUPERVISOR]: 1,
  [Roles.MANAGER]: 2,
  [Roles.COMPLIANCE_OFFICER]: 3,
  [Roles.ADMIN]: 4,
};
