import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { MyNotification, Readiness } from '../../types/my-section';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const employeeUser = {
  id: '2',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

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

const complianceOfficerUser = {
  id: '5',
  email: 'compliance@example.com',
  name: 'Compliance User',
  role: 'compliance_officer',
};

const MockedDashboardPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <DashboardPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * DAY_IN_MS).toISOString();
}

const mockReadiness: Readiness = {
  employeeId: '2',
  qualifications: [
    {
      qualificationId: 'q1',
      qualificationName: 'Ramp safety',
      status: 'active',
      readinessStatus: 'compliant',
      expirationDate: isoDaysFromNow(90),
    },
    {
      qualificationId: 'q2',
      qualificationName: 'Dangerous goods',
      status: 'expiring_soon',
      readinessStatus: 'at_risk',
      expirationDate: isoDaysFromNow(10),
    },
    {
      qualificationId: 'q3',
      qualificationName: 'Annual refresher',
      status: 'expired',
      readinessStatus: 'non_compliant',
      expirationDate: isoDaysFromNow(-5),
    },
  ],
  medicalClearances: [
    {
      clearanceType: 'Medical',
      status: 'cleared',
      readinessStatus: 'compliant',
      expirationDate: isoDaysFromNow(20),
    },
  ],
  overallStatus: 'at_risk',
};

const mockNotifications: MyNotification[] = [
  {
    id: 'n6',
    message: 'Legacy entry archived from your workspace.',
    type: 'archive_notice',
    createdAt: isoDaysFromNow(-6),
    read: true,
  },
  {
    id: 'n4',
    message: 'A qualification expires in 10 days.',
    type: 'expiring_soon',
    createdAt: isoDaysFromNow(-2),
    read: false,
    actionUrl: '/me/qualifications',
  },
  {
    id: 'n1',
    message: 'Document review queue was updated.',
    type: 'review_update',
    createdAt: isoDaysFromNow(0),
    read: false,
    actionUrl: '/reviews',
  },
  {
    id: 'n3',
    message: 'A readiness conflict needs resolution.',
    type: 'conflict_alert',
    createdAt: isoDaysFromNow(-1),
    read: false,
    actionUrl: '/me/notifications',
  },
  {
    id: 'n2',
    message: 'Your latest document upload was approved.',
    type: 'document_approved',
    createdAt: isoDaysFromNow(-1.5),
    read: true,
  },
  {
    id: 'n5',
    message: 'Template guidance was refreshed for your team.',
    type: 'template_update',
    createdAt: isoDaysFromNow(-4),
    read: true,
    actionUrl: '/standards',
  },
];

function renderDashboard(user = employeeUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');

  render(<MockedDashboardPage />);
}

async function mockDashboardApi(options?: {
  readiness?: Readiness;
  notifications?: MyNotification[];
  failReadiness?: boolean;
  failNotifications?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const readiness = options?.readiness ?? mockReadiness;
  const notifications = options?.notifications ?? mockNotifications;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
        'reference.labels-admin': false,
        'web.team-subnav': true,
      });
    }

    if (path.endsWith('/readiness')) {
      return options?.failReadiness ? Promise.reject(new Error('Readiness unavailable')) : Promise.resolve(readiness);
    }

    if (path === '/notifications') {
      return options?.failNotifications ? Promise.reject(new Error('Notifications unavailable')) : Promise.resolve(notifications);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the workspace header and dashboard shell', async () => {
    await mockDashboardApi();
    renderDashboard(managerUser);

    expect(await screen.findByRole('heading', { name: /welcome back, manager user/i })).toBeInTheDocument();
    expect(screen.getAllByText(/manager workspace/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /everything you need to move work forward/i })).toBeInTheDocument();
  });

  it.each([
    {
      user: employeeUser,
      expected: ['Clock In', 'Upload Document', 'View My Qualifications', 'My Templates'],
      unexpected: ['View Team', 'Review Documents', 'Compliance Overview'],
    },
    {
      user: supervisorUser,
      expected: ['View Team', 'Add Qualification', 'Team Templates'],
      unexpected: ['Clock In', 'Review Documents', 'Compliance Overview'],
    },
    {
      user: managerUser,
      expected: ['Review Documents', 'Resolve Conflicts', 'Manager Dashboard'],
      unexpected: ['Clock In', 'View Team', 'Compliance Overview'],
    },
    {
      user: complianceOfficerUser,
      expected: ['Compliance Overview', 'Export Report', 'Audit Log'],
      unexpected: ['Clock In', 'View Team', 'Review Documents'],
    },
  ])('shows role-adaptive quick actions for $user.role', async ({ user, expected, unexpected }) => {
    await mockDashboardApi();
    renderDashboard(user);

    expect(await screen.findByRole('heading', { name: /quick actions/i })).toBeInTheDocument();

    expected.forEach((label) => {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });

    unexpected.forEach((label) => {
      expect(screen.queryByRole('link', { name: new RegExp(label, 'i') })).not.toBeInTheDocument();
    });
  });

  it('renders readiness summary metrics', async () => {
    await mockDashboardApi();
    renderDashboard(employeeUser);

    const readinessHeading = await screen.findByRole('heading', { name: /readiness summary/i });
    const readinessPanel = readinessHeading.closest('section');

    expect(readinessPanel).not.toBeNull();
    expect(within(readinessPanel as HTMLElement).getByText('63%')).toBeInTheDocument();
    expect(within(readinessPanel as HTMLElement).getByText(/overall readiness/i)).toBeInTheDocument();
    expect(within(readinessPanel as HTMLElement).getByText(/overdue items/i)).toBeInTheDocument();
    expect(within(readinessPanel as HTMLElement).getByText(/upcoming expirations/i)).toBeInTheDocument();
    expect(within(readinessPanel as HTMLElement).getByText(/^1$/)).toBeInTheDocument();
    expect(within(readinessPanel as HTMLElement).getByText(/^2$/)).toBeInTheDocument();
  });

  it('shows the five most recent activity items', async () => {
    await mockDashboardApi();
    renderDashboard(employeeUser);

    const activityHeading = await screen.findByRole('heading', { name: /recent activity/i });
    const activityPanel = activityHeading.closest('section');
    const activityList = within(activityPanel as HTMLElement).getByRole('list');

    expect(within(activityList).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/document review queue was updated/i)).toBeInTheDocument();
    expect(screen.getByText(/a readiness conflict needs resolution/i)).toBeInTheDocument();
    expect(screen.queryByText(/legacy entry archived from your workspace/i)).not.toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockImplementation(() => new Promise(() => {}));
    renderDashboard();

    expect(screen.getByText(/loading dashboard.../i)).toBeInTheDocument();
  });

  it('falls back gracefully when dashboard data cannot be loaded', async () => {
    await mockDashboardApi({ failReadiness: true, failNotifications: true });
    renderDashboard(employeeUser);

    expect(await screen.findByText(/dashboard insights are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /clock in/i })).toBeInTheDocument();
    expect(screen.getByText(/readiness details are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/recent activity is temporarily unavailable/i)).toBeInTheDocument();
  });
});
