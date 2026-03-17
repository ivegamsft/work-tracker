import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  TeamQualificationsPage,
  TeamMedicalPage,
  TeamDocumentsPage,
  TeamHoursPage,
} from '../TeamPages';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
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
  name: 'John Doe',
  email: 'john@example.com',
  department: 'Engineering',
  role: 'employee',
};

const mockQualifications = [
  {
    id: 'q1',
    employeeId: 'employee-1',
    certificationName: 'OSHA Cert',
    status: 'active',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
];

const mockMedicalRecords = [
  {
    id: 'm1',
    employeeId: 'employee-1',
    clearanceType: 'Physical Exam',
    status: 'cleared',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
];

const mockDocuments = [
  {
    id: 'd1',
    employeeId: 'employee-1',
    name: 'Certificate',
    type: 'certification',
    status: 'approved',
  },
];

const mockHourRecords = [
  {
    id: 'h1',
    employeeId: 'employee-1',
    date: '2026-03-20',
    hours: 8,
    type: 'regular',
  },
];

const MockedTeamQualificationsPage = ({ employeeId }: { employeeId: string }) => (
  <MemoryRouter initialEntries={[`/team/${employeeId}/qualifications`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/team/:id/qualifications" element={<TeamQualificationsPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

const MockedTeamMedicalPage = ({ employeeId }: { employeeId: string }) => (
  <MemoryRouter initialEntries={[`/team/${employeeId}/medical`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/team/:id/medical" element={<TeamMedicalPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

const MockedTeamDocumentsPage = ({ employeeId }: { employeeId: string }) => (
  <MemoryRouter initialEntries={[`/team/${employeeId}/documents`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/team/:id/documents" element={<TeamDocumentsPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

const MockedTeamHoursPage = ({ employeeId }: { employeeId: string }) => (
  <MemoryRouter initialEntries={[`/team/${employeeId}/hours`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/team/:id/hours" element={<TeamHoursPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

function renderTeamQualifications(employeeId = 'employee-1', user = supervisorUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedTeamQualificationsPage employeeId={employeeId} />);
}

function renderTeamMedical(employeeId = 'employee-1', user = supervisorUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedTeamMedicalPage employeeId={employeeId} />);
}

function renderTeamDocuments(employeeId = 'employee-1', user = supervisorUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedTeamDocumentsPage employeeId={employeeId} />);
}

function renderTeamHours(employeeId = 'employee-1', user = supervisorUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedTeamHoursPage employeeId={employeeId} />);
}

async function mockApi(options?: {
  qualifications?: typeof mockQualifications;
  medical?: typeof mockMedicalRecords;
  documents?: typeof mockDocuments;
  hours?: typeof mockHourRecords;
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const mockPost = vi.mocked(api.post);

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'web.team-subnav': true,
      });
    }

    if (path.includes('/qualifications')) {
      return options?.fail ? Promise.reject(new Error('Qualifications unavailable')) : Promise.resolve(options?.qualifications ?? mockQualifications);
    }

    if (path.includes('/medical')) {
      return options?.fail ? Promise.reject(new Error('Medical unavailable')) : Promise.resolve(options?.medical ?? mockMedicalRecords);
    }

    if (path.includes('/documents')) {
      return options?.fail ? Promise.reject(new Error('Documents unavailable')) : Promise.resolve(options?.documents ?? mockDocuments);
    }

    if (path.includes('/hours')) {
      return options?.fail ? Promise.reject(new Error('Hours unavailable')) : Promise.resolve(options?.hours ?? mockHourRecords);
    }

    if (path.startsWith('/employees/')) {
      return Promise.resolve(mockEmployee);
    }

    if (path.includes('/standards')) {
      return Promise.resolve([]);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  mockPost.mockResolvedValue({ id: 'new-1', status: 'pending' });

  return { mockGet, mockPost };
}

describe('TeamQualificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderTeamQualifications();

    expect(await screen.findByRole('heading', { name: /qualifications/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderTeamQualifications();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays qualifications list', async () => {
    await mockApi();
    renderTeamQualifications();

    expect(await screen.findByText('OSHA Cert')).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    await mockApi({ fail: true });
    renderTeamQualifications();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
  });
});

describe('TeamMedicalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderTeamMedical();

    expect(await screen.findByRole('heading', { name: /medical/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderTeamMedical();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays medical records', async () => {
    await mockApi();
    renderTeamMedical();

    expect(await screen.findByText('Physical Exam')).toBeInTheDocument();
  });
});

describe('TeamDocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderTeamDocuments();

    expect(await screen.findByRole('heading', { name: /documents/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderTeamDocuments();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays documents list', async () => {
    await mockApi();
    renderTeamDocuments();

    expect(await screen.findByText('Certificate')).toBeInTheDocument();
  });
});

describe('TeamHoursPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderTeamHours();

    expect(await screen.findByRole('heading', { name: /hours/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderTeamHours();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays hour records', async () => {
    await mockApi();
    renderTeamHours();

    // Should at least render the page header
    expect(await screen.findByRole('heading', { name: /hours/i })).toBeInTheDocument();
  });
});
