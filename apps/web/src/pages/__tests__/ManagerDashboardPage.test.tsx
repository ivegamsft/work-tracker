import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ManagerDashboardPage from '../ManagerDashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * DAY_IN_MS).toISOString();
}

const supervisorUser = {
  id: '3',
  email: 'supervisor@example.com',
  name: 'Supervisor User',
  role: 'supervisor',
};

const managerUser = {
  id: '4',
  email: 'manager@example.com',
  name: 'Manager User',
  role: 'manager',
};

const mockEmployees = [
  { id: 'e1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', role: 'employee', overallStatus: 'compliant' },
  { id: 'e2', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', role: 'employee', overallStatus: 'at_risk' },
  { id: 'e3', firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com', role: 'employee', overallStatus: 'non_compliant' },
  { id: 'e4', firstName: 'Diana', lastName: 'Prince', email: 'diana@example.com', role: 'employee', overallStatus: 'compliant' },
];

const mockAssignments = [
  { id: 'a1', templateId: 't1', templateVersion: 1, employeeId: 'e1', role: null, department: null, assignedBy: '3', dueDate: null, isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01', completedAt: '2026-01-10', templateName: 'Safety Training', templateStatus: 'published' },
  { id: 'a2', templateId: 't1', templateVersion: 1, employeeId: 'e2', role: null, department: null, assignedBy: '3', dueDate: null, isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01', completedAt: null, templateName: 'Safety Training', templateStatus: 'published' },
  { id: 'a3', templateId: 't2', templateVersion: 1, employeeId: 'e3', role: null, department: null, assignedBy: '3', dueDate: null, isActive: true, createdAt: '2026-01-05', updatedAt: '2026-01-05', completedAt: null, templateName: 'Fire Drill', templateStatus: 'published' },
];

const mockQualifications = [
  { id: 'q1', employeeId: 'e1', certificationName: 'Ramp Safety', status: 'active', expiresAt: isoDaysFromNow(15) },
  { id: 'q2', employeeId: 'e2', certificationName: 'Dangerous Goods', status: 'active', expiresAt: isoDaysFromNow(50) },
  { id: 'q3', employeeId: 'e3', certificationName: 'Annual Refresher', status: 'expired', expiresAt: isoDaysFromNow(-10) },
];

const mockMedical = [
  { id: 'm1', employeeId: 'e1', clearanceType: 'Annual Physical', status: 'cleared', validTo: isoDaysFromNow(25) },
  { id: 'm2', employeeId: 'e4', clearanceType: 'Vision Test', status: 'cleared', validTo: isoDaysFromNow(70) },
];

const Wrapper = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <ManagerDashboardPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function setUser(user = managerUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
}

async function mockAllApis(overrides?: {
  failEmployees?: boolean;
  failAssignments?: boolean;
  failQualifications?: boolean;
  failMedical?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({ 'compliance.templates': true, 'records.hours-ui': true });
    }
    if (path === '/employees') {
      return overrides?.failEmployees ? Promise.reject(new Error('fail')) : Promise.resolve(mockEmployees);
    }
    if (path === '/assignments/team') {
      return overrides?.failAssignments ? Promise.reject(new Error('fail')) : Promise.resolve(mockAssignments);
    }
    if (path === '/qualifications') {
      return overrides?.failQualifications ? Promise.reject(new Error('fail')) : Promise.resolve(mockQualifications);
    }
    if (path === '/medical') {
      return overrides?.failMedical ? Promise.reject(new Error('fail')) : Promise.resolve(mockMedical);
    }
    return Promise.reject(new Error(`Unexpected: ${path}`));
  });

  return mockGet;
}

describe('ManagerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the page title and breadcrumbs', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByRole('heading', { name: /manager dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Manager Analytics')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    setUser();
    render(<Wrapper />);

    expect(screen.getByText(/loading manager dashboard/i)).toBeInTheDocument();
  });

  it('displays team compliance stat cards', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByText('Team Members')).toBeInTheDocument();

    const teamSection = screen.getByRole('heading', { name: /team compliance/i }).closest('section')!;

    // 4 stat cards + 1 progress bar group = 5 groups
    expect(within(teamSection).getByRole('group', { name: 'Team Members' })).toBeInTheDocument();
    expect(within(teamSection).getByRole('group', { name: 'At Risk' })).toBeInTheDocument();

    // Check the stat values: 4 total, 2 compliant, 1 at risk, 1 non-compliant
    expect(within(teamSection).getByText('4')).toBeInTheDocument();
    expect(within(teamSection).getByText('50% of team')).toBeInTheDocument();
  });

  it('shows team compliance percentage', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByText(/50% of team/)).toBeInTheDocument();
  });

  it('shows template assignment stats', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByRole('heading', { name: /template assignments/i })).toBeInTheDocument();
    expect(screen.getByText('Total Assignments')).toBeInTheDocument();
    // 3 total, 1 completed
    const completedCard = screen.getByText('Completed').closest('[role="group"]');
    expect(within(completedCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('renders employee table with compliance badges', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    const tableSection = await screen.findByRole('heading', { name: /team members by status/i });
    const section = tableSection.closest('section')!;

    expect(within(section).getByRole('link', { name: 'Alice Smith' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Bob Jones' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Charlie Brown' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Diana Prince' })).toBeInTheDocument();

    const statusBadges = within(section).getAllByRole('status');
    expect(statusBadges.length).toBe(4);
  });

  it('shows expiring items from qualifications and medical', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByText('Ramp Safety')).toBeInTheDocument();
    expect(screen.getByText('Annual Physical')).toBeInTheDocument();
    expect(screen.getByText('Annual Refresher')).toBeInTheDocument();
  });

  it('renders quick action links', async () => {
    await mockAllApis();
    setUser();
    render(<Wrapper />);

    expect(await screen.findByRole('link', { name: /assign template/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review fulfillments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view team directory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /document review queue/i })).toBeInTheDocument();
  });

  it('shows error message when all APIs fail', async () => {
    await mockAllApis({
      failEmployees: true,
      failAssignments: true,
      failQualifications: true,
      failMedical: true,
    });
    setUser();
    render(<Wrapper />);

    expect(await screen.findByText(/dashboard data is temporarily unavailable/i)).toBeInTheDocument();
  });

  it('shows partial error message when some APIs fail', async () => {
    await mockAllApis({ failQualifications: true });
    setUser();
    render(<Wrapper />);

    expect(await screen.findByText(/some dashboard sections could not load/i)).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('works for supervisor role', async () => {
    await mockAllApis();
    setUser(supervisorUser);
    render(<Wrapper />);

    expect(await screen.findByRole('heading', { name: /manager dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('handles empty user session', async () => {
    await mockAllApis();
    render(<Wrapper />);

    expect(await screen.findByText(/couldn't find a signed-in user session/i)).toBeInTheDocument();
  });
});
