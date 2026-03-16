import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TemplateDetailPage from '../TemplateDetailPage';

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

const employeeUser = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const template = {
  id: 'tpl-1',
  name: 'Forklift Operator Onboarding',
  description: 'Full onboarding template for forklift operators.',
  category: 'Safety',
  status: 'published',
  version: 2,
  previousVersion: null,
  createdBy: 'admin-1',
  updatedBy: null,
  standardId: null,
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
  publishedAt: '2026-03-12T00:00:00.000Z',
  archivedAt: null,
  requirements: [
    {
      id: 'req-1',
      templateId: 'tpl-1',
      name: 'OSHA 10-Hour Card',
      description: 'Upload your OSHA card.',
      attestationLevels: ['upload', 'validated'],
      proofType: 'certification',
      proofSubType: null,
      threshold: null,
      thresholdUnit: null,
      rollingWindowDays: null,
      universalCategory: null,
      qualificationType: null,
      medicalTestType: null,
      standardReqId: null,
      validityDays: 365,
      renewalWarningDays: 30,
      sortOrder: 0,
      isRequired: true,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
    },
    {
      id: 'req-2',
      templateId: 'tpl-1',
      name: 'Equipment Familiarization',
      description: 'Complete the walkthrough.',
      attestationLevels: ['self_attest'],
      proofType: 'training',
      proofSubType: null,
      threshold: null,
      thresholdUnit: null,
      rollingWindowDays: null,
      universalCategory: null,
      qualificationType: null,
      medicalTestType: null,
      standardReqId: null,
      validityDays: null,
      renewalWarningDays: null,
      sortOrder: 1,
      isRequired: true,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
    },
  ],
};

const assignmentHistory = [
  {
    id: 'assign-1',
    templateId: 'tpl-1',
    templateVersion: 2,
    employeeId: 'emp-1',
    employeeName: 'Jane Smith',
    employeeEmail: 'jane@example.com',
    role: 'employee',
    department: 'Operations',
    assignedBy: 'supervisor-1',
    dueDate: '2026-04-15T00:00:00.000Z',
    isActive: true,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    completedAt: null,
  },
  {
    id: 'assign-2',
    templateId: 'tpl-1',
    templateVersion: 1,
    employeeId: 'emp-2',
    employeeName: 'John Doe',
    employeeEmail: 'john@example.com',
    role: 'employee',
    department: 'Warehouse',
    assignedBy: 'supervisor-1',
    dueDate: null,
    isActive: false,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
    completedAt: '2026-03-14T00:00:00.000Z',
  },
];

function mockApi(options?: {
  user?: typeof supervisorUser;
  failTemplate?: boolean;
  failAssignments?: boolean;
  assignmentsResponse?: typeof assignmentHistory;
}) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path === '/templates/tpl-1') {
        if (options?.failTemplate) {
          return Promise.reject(new Error('Template not found'));
        }
        return Promise.resolve(template);
      }

      if (path.startsWith('/templates/tpl-1/assignments')) {
        if (options?.failAssignments) {
          return Promise.reject(new Error('Assignments unavailable'));
        }
        return Promise.resolve(options?.assignmentsResponse ?? assignmentHistory);
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path === '/templates/tpl-1/assign') {
        return Promise.resolve({ assignments: [], created: 1, skipped: 0 });
      }

      return Promise.reject(new Error(`Unexpected POST path: ${path}`));
    });
  });
}

function Wrapper({ children, initialPath = '/templates/tpl-1' }: { children: ReactNode; initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderDetail(options?: { user?: typeof supervisorUser; initialPath?: string }) {
  localStorage.setItem('user', JSON.stringify(options?.user ?? supervisorUser));
  localStorage.setItem('token', 'fake-token');

  return render(
    <Wrapper initialPath={options?.initialPath}>
      <Routes>
        <Route path="/templates/:id" element={<TemplateDetailPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('TemplateDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders template overview with name, description, and requirements', async () => {
    await mockApi();
    renderDetail();

    expect(screen.getByText(/loading template detail/i)).toBeInTheDocument();
    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/full onboarding template for forklift operators/i)).toBeInTheDocument();
    expect(screen.getByText('OSHA 10-Hour Card')).toBeInTheDocument();
    expect(screen.getByText('Equipment Familiarization')).toBeInTheDocument();
  });

  it('shows requirement attestation badges and metadata', async () => {
    await mockApi();
    renderDetail();

    await screen.findByText('OSHA 10-Hour Card');
    expect(screen.getByText('2 attestation steps')).toBeInTheDocument();
    expect(screen.getByText('1 attestation steps')).toBeInTheDocument();
    expect(screen.getByText('365 days')).toBeInTheDocument();
  });

  it('shows assignment history for supervisors', async () => {
    await mockApi();
    renderDetail();

    expect(await screen.findByRole('heading', { name: /assignment history/i })).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/2 assignments/i)).toBeInTheDocument();
  });

  it('hides assignment history for employees', async () => {
    await mockApi({ user: employeeUser });
    renderDetail({ user: employeeUser });

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /assignment history/i })).not.toBeInTheDocument();
  });

  it('shows assign and edit actions for supervisors and managers', async () => {
    await mockApi();
    renderDetail();

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /open assign flow/i })).toBeInTheDocument();
  });

  it('allows self-assignment for supervisors', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderDetail();

    const assignButton = await screen.findByRole('button', { name: /assign to me/i });
    await user.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText(/template assigned to you successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error state when template cannot be loaded', async () => {
    await mockApi({ failTemplate: true });
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/template not found/i)).toBeInTheDocument();
    });
  });

  it('gracefully handles assignment history fetch failure', async () => {
    await mockApi({ failAssignments: true });
    renderDetail();

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    // Assignment history section still renders with empty state
    expect(await screen.findByRole('heading', { name: /assignment history/i })).toBeInTheDocument();
    expect(screen.getByText(/no employees have been assigned/i)).toBeInTheDocument();
  });
});
