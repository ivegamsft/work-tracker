export const roleHierarchy = {
  employee: 0,
  supervisor: 1,
  manager: 2,
  compliance_officer: 3,
  admin: 4,
} as const;

export type AppRole = keyof typeof roleHierarchy;

const roleAliases: Record<string, AppRole> = {
  administrator: 'admin',
  complianceofficer: 'compliance_officer',
};

export function normalizeRole(role?: string | null): AppRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized in roleHierarchy) {
    return normalized as AppRole;
  }

  const compact = normalized.replace(/_/g, '');
  return roleAliases[compact] ?? roleAliases[normalized] ?? null;
}

export function hasMinimumRole(role: string | null | undefined, minimumRole: AppRole) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return false;
  }

  return roleHierarchy[normalizedRole] >= roleHierarchy[minimumRole];
}
