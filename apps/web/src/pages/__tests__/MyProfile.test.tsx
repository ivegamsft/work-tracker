import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyProfilePage from '../MyProfile';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { EmployeeProfile, Readiness } from '../../types/my-section';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockUser = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const mockEmployee: EmployeeProfile = {
  id: 'employee-1',
  email: 'employee@example.com',
  firstName: 'Employee',
  lastName: 'User',
  name: 'Employee User',
  department: 'Engineering',
  departmentId: 'dept-1',
  role: 'employee',
  position: 'Software Engineer',
  hireDate: '2024-01-15T00:00:00.000Z',
};

const mockReadiness: Readiness = {
  employeeId: 'employee-1',
  qualifications: [
    {
      qualificationId: 'q1',
      qualificationName: 'Certification A',
      status: 'active',
      readinessStatus: 'compliant',
      expirationDate: '2026-12-31T00:00:00.000Z',
    },
    {
      qualificationId: 'q2',
      qualificationName: 'Certification B',
      status: 'expiring_soon',
      readinessStatus: 'at_risk',
      expirationDate: '2026-04-15T00:00:00.000Z',
    },
  ],
  medicalClearances: [
    {
      clearanceType: 'Medical',
      status: 'cleared',
      readinessStatus: 'compliant',
      expirationDate: '2026-08-01T00:00:00.000Z',
    },
  ],
  overallStatus: 'at_risk',
};

const MockedMyProfilePage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <MyProfilePage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function renderMyProfile(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedMyProfilePage />);
}

async function mockApi(options?: {
  employee?: EmployeeProfile;
  readiness?: Readiness;
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
      });
    }

    if (path.startsWith('/employees/') && path.endsWith('/readiness')) {
      return options?.failReadiness ? Promise.reject(new Error('Readiness unavailable')) : Promise.resolve(readiness);
    }

    if (path.startsWith('/employees/')) {
      return options?.failEmployee ? Promise.reject(new Error('Employee unavailable')) : Promise.resolve(employee);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('MyProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderMyProfile();

    expect(await screen.findByRole('heading', { name: /my profile/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderMyProfile();

    expect(screen.getByText(/loading profile.../i)).toBeInTheDocument();
  });

  it('displays profile details correctly', async () => {
    await mockApi();
    renderMyProfile();

    expect(await screen.findByRole('heading', { name: /profile details/i })).toBeInTheDocument();
    expect(screen.getByText('Employee User')).toBeInTheDocument();
    expect(screen.getByText('employee@example.com')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('employee')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('displays readiness summary', async () => {
    await mockApi();
    renderMyProfile();

    expect(await screen.findByRole('heading', { name: /readiness summary/i })).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Qualifications tracked
  });

  it('shows overall readiness status badge', async () => {
    await mockApi();
    renderMyProfile();

    const badge = await screen.findByText(/Readiness: At Risk/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('my-badge--warning');
  });

  it('renders quick links section', async () => {
    await mockApi();
    renderMyProfile();

    expect(await screen.findByRole('heading', { name: /quick links/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open qualifications/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open medical/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open documents/i })).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockApi({ failEmployee: true });
    renderMyProfile();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/employee unavailable/i)).toBeInTheDocument();
  });

  it('shows empty state when no profile data', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({});
      }
      return Promise.resolve(null);
    });

    renderMyProfile();

    expect(await screen.findByText(/we couldn't find a profile for your account yet/i)).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', async () => {
    const employeeWithMissingFields: EmployeeProfile = {
      id: 'employee-1',
      email: 'employee@example.com',
      firstName: 'Employee',
      lastName: 'User',
      role: 'employee',
    };

    await mockApi({ employee: employeeWithMissingFields });
    renderMyProfile();

    expect(await screen.findByText(/not provided/i)).toBeInTheDocument();
  });
});
