import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import MyTemplatesPage, { MyTemplateFulfillmentPage } from '../MyTemplatesPage';
import type { ProofFulfillmentRecord, TemplateAssignmentRecord } from '../../types/my-section';

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

const assignments: TemplateAssignmentRecord[] = [
  {
    id: 'assignment-1',
    templateId: 'template-1',
    templateVersion: 1,
    employeeId: 'employee-1',
    role: null,
    department: null,
    assignedBy: 'manager-1',
    dueDate: '2026-04-15T00:00:00.000Z',
    isActive: true,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    completedAt: null,
    templateName: 'Forklift Operator Onboarding',
    templateStatus: 'published',
  },
];

const fulfillments: ProofFulfillmentRecord[] = [
  {
    id: 'fulfillment-1',
    assignmentId: 'assignment-1',
    requirementId: 'req-1',
    employeeId: 'employee-1',
    status: 'fulfilled',
    requirement: { id: 'req-1', name: 'OSHA 10-Hour Card', description: 'Upload your OSHA card.' },
  },
  {
    id: 'fulfillment-2',
    assignmentId: 'assignment-1',
    requirementId: 'req-2',
    employeeId: 'employee-1',
    status: 'fulfilled',
    requirement: { id: 'req-2', name: 'Drug Test Clearance', description: 'Record the current clearance.' },
  },
  {
    id: 'fulfillment-3',
    assignmentId: 'assignment-1',
    requirementId: 'req-3',
    employeeId: 'employee-1',
    status: 'pending_review',
    requirement: { id: 'req-3', name: 'Forklift Certification', description: 'Awaiting manager validation.' },
  },
  {
    id: 'fulfillment-4',
    assignmentId: 'assignment-1',
    requirementId: 'req-4',
    employeeId: 'employee-1',
    status: 'unfulfilled',
    requirement: { id: 'req-4', name: 'Equipment Familiarization', description: 'Complete the walkthrough.' },
  },
];

function mockApi(options?: {
  assignmentsResponse?: TemplateAssignmentRecord[];
  fulfillmentsResponse?: ProofFulfillmentRecord[];
  failAssignments?: boolean;
}) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({
          'records.hours-ui': true,
          'compliance.templates': true,
          'reference.labels-admin': false,
          'web.team-subnav': true,
        });
      }

      if (path.startsWith('/employees/employee-1/assignments')) {
        return options?.failAssignments
          ? Promise.reject(new Error('Assignments unavailable'))
          : Promise.resolve({
              data: options?.assignmentsResponse ?? assignments,
              total: options?.assignmentsResponse?.length ?? assignments.length,
              page: 1,
              limit: 100,
            });
      }

      if (path === '/assignments/assignment-1/fulfillments') {
        return Promise.resolve(options?.fulfillmentsResponse ?? fulfillments);
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
  });
}

function Wrapper({ children, initialPath = '/me/templates' }: { children: ReactNode; initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderTemplates(initialPath = '/me/templates') {
  return render(
    <Wrapper initialPath={initialPath}>
      <Routes>
        <Route path="/me/templates" element={<MyTemplatesPage />} />
        <Route path="/me/templates/:assignmentId" element={<MyTemplateFulfillmentPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('MyTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders assigned templates with progress and navigates to the fulfillment detail', async () => {
    await mockApi();
    const user = userEvent.setup();

    renderTemplates();

    expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /my templates/i })).toBeInTheDocument();
    expect(screen.getByText(/forklift operator onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/50% complete/i)).toBeInTheDocument();
    expect(screen.getByText(/4 requirements/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /forklift operator onboarding/i }));

    expect(await screen.findByRole('heading', { name: /requirement status/i })).toBeInTheDocument();
    expect(screen.getByText(/osha 10-hour card/i)).toBeInTheDocument();
  });

  it('shows an empty state when no templates are assigned', async () => {
    await mockApi({ assignmentsResponse: [] });

    renderTemplates();

    expect(await screen.findByText(/no templates are currently assigned to you/i)).toBeInTheDocument();
  });

  it('shows an error state when assignments cannot be loaded', async () => {
    await mockApi({ failAssignments: true });

    renderTemplates();

    await waitFor(() => {
      expect(screen.getByText(/assignments unavailable/i)).toBeInTheDocument();
    });
  });
});
