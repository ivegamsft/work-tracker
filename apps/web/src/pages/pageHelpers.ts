import { ApiError, api } from '../api/client';
import type { BreadcrumbItem, TabItem } from '../components/PageShell';
import type { EmployeeProfile, PaginatedResponse } from '../types/my-section';

export interface TeamMemberSummary {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  overallStatus?: string;
}

export function toArray<T>(response: T[] | PaginatedResponse<T>) {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeKey(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
}

export function toTitleCase(value?: string | null, fallback = 'Unknown') {
  const normalized = normalizeKey(value);

  if (!normalized) {
    return fallback;
  }

  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatDate(value?: string | Date | null, fallback = 'Unknown') {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

export function formatDateTime(value?: string | Date | null, fallback = 'Unknown') {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

export function getDaysUntil(value?: string | Date | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getStatusBadgeClass(status?: string | null) {
  switch (normalizeKey(status)) {
    case 'active':
    case 'approved':
    case 'uploaded':
    case 'cleared':
    case 'compliant':
      return 'my-badge my-badge--active';
    case 'pending':
    case 'pending_review':
    case 'review_required':
    case 'classified':
    case 'processing':
    case 'expiring_soon':
    case 'at_risk':
    case 'restricted':
    case 'in_progress':
      return 'my-badge my-badge--warning';
    default:
      return 'my-badge my-badge--expired';
  }
}

export function isUnavailableError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 501 || /not (yet )?implemented|not available|coming soon/i.test(error.message))
  );
}

export function buildTeamTabs(id: string, options: { showHours?: boolean } = {}): TabItem[] {
  const tabs: TabItem[] = [
    { label: 'Overview', to: `/team/${id}`, end: true },
    { label: 'Qualifications', to: `/team/${id}/qualifications` },
    { label: 'Medical', to: `/team/${id}/medical` },
    { label: 'Documents', to: `/team/${id}/documents` },
  ];

  if (options.showHours) {
    tabs.push({ label: 'Hours', to: `/team/${id}/hours` });
  }

  return tabs;
}

export function buildTeamBreadcrumbs(id: string, employeeLabel: string, currentPage: string): BreadcrumbItem[] {
  return [
    { label: 'Dashboard', to: '/' },
    { label: 'Team', to: '/team' },
    { label: employeeLabel, to: `/team/${id}` },
    { label: currentPage },
  ];
}

export function normalizeEmployee(employee: EmployeeProfile): TeamMemberSummary {
  const name = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || employee.name || employee.email;

  return {
    id: employee.id,
    name,
    email: employee.email,
    department: employee.department ?? employee.departmentId ?? 'Unassigned',
    role: employee.role,
    overallStatus: employee.overallStatus,
  };
}

export async function getTeamMember(id: string) {
  const employee = await api.get<EmployeeProfile>(`/employees/${id}`);
  return normalizeEmployee(employee);
}
