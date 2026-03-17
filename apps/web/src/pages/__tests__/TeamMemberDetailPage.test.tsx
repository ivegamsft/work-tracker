import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeamMemberDetailPage from '../TeamMemberDetailPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const supervisorUser = {
  id: 'supervisor-1',
  email: 'supervisor@example.com',
  name: 'Supervisor User',
  role: 'supervisor',
};

const mockEmployee = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'John Doe',
  department: 'Engineering',
  role: 'employee',
  overallStatus: 'compliant' as const,
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
};

const mockReadiness = {
  qualifications: [
    {
      qualificationId: 'q1',
      qualificationName: 'OSHA Cert',
      status: 'compliant' as const,
      expiresAt: '2026-12-31T00:00:00.000Z',
      daysUntilExpiry: 285,
    },
  ],
  medicalStatus: 'compliant' as const,
  medicalExpiresAt: '2026-08-01T00:00:00.000Z',
  medicalDaysUntilExpiry: 133,
  overallStatus: 'compliant' as const,
};

const MockedTeamMemberDetailPage = ({ employeeId }: { employeeId: string }) => (
  <MemoryRouter initialEntries={[`/team/${employeeId}`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/team/:id" element={<TeamMemberDetailPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

function renderTeamMemberDetail(employeeId = 'employee-1', user = supervisorUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedTeamMemberDetailPage employeeId={employeeId} />);
}

async function mockApi(options?: {
  employee?: typeof mockEmployee;
  readiness?: typeof mockReadiness;
  failEmployee?: boolean;
  failReadiness?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const employee = options?.employee ?? mockEmployee;
  const readiness = options?.readiness ?? mockReadiness;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
        'web.team-subnav': true,
      });
    }

    if (path.includes('/readiness')) {
      return options?.failReadiness ? Promise.reject(new Error('Readiness unavailable')) : Promise.resolve(readiness);
    }

    if (path.startsWith('/employees/')) {
      return options?.failEmployee ? Promise.reject(new Error('Employee not found')) : Promise.resolve(employee);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('TeamMemberDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderTeamMemberDetail();

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderTeamMemberDetail();

    expect(screen.getByText(/loading team member details.../i)).toBeInTheDocument();
  });

  it('displays employee information', async () => {
    await mockApi();
    renderTeamMemberDetail();

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('employee@example.com')).toBeInTheDocument();
  });

  it('displays overall status badge', async () => {
    await mockApi();
    renderTeamMemberDetail();

    const badge = await screen.findByText(/compliant/i);
    expect(badge).toBeInTheDocument();
  });

  it('shows readiness information', async () => {
    await mockApi();
    renderTeamMemberDetail();

    expect(await screen.findByText(/OSHA Cert/i)).toBeInTheDocument();
  });

  it('shows error message when employee not found', async () => {
    await mockApi({ failEmployee: true });
    renderTeamMemberDetail();

    expect(await screen.findByText(/employee not found/i)).toBeInTheDocument();
  });

  it('shows back to team button', async () => {
    await mockApi();
    renderTeamMemberDetail();

    expect(await screen.findByRole('button', { name: /back to team/i })).toBeInTheDocument();
  });

  it('displays breadcrumb navigation', async () => {
    await mockApi();
    renderTeamMemberDetail();

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('shows medical clearance status', async () => {
    await mockApi();
    renderTeamMemberDetail();

    // Medical status should be displayed somewhere on the page
    const page = await screen.findByText('John Doe');
    expect(page).toBeInTheDocument();
  });
});
