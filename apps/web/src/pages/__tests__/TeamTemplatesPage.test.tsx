import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TeamTemplatesPage from '../TeamTemplatesPage';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

const supervisorUser = {
  id: 'supervisor-1',
  email: 'supervisor@example.com',
  name: 'Supervisor User',
  role: 'supervisor',
};

const teamTemplateData = {
  data: [
    {
      employeeId: 'emp-1',
      employeeName: 'Alice Johnson',
      employeeEmail: 'alice@example.com',
      assignments: [
        {
          id: 'assign-1',
          templateId: 'tpl-1',
          templateName: 'Forklift Operator Onboarding',
          status: 'in_progress',
          dueDate: '2026-04-15T00:00:00.000Z',
          completedAt: null,
          totalRequirements: 4,
          fulfilledRequirements: 2,
          completionPercentage: 50,
          isOverdue: false,
          isAtRisk: true,
        },
        {
          id: 'assign-2',
          templateId: 'tpl-2',
          templateName: 'Fire Safety Certification',
          status: 'completed',
          dueDate: '2026-03-01T00:00:00.000Z',
          completedAt: '2026-02-28T00:00:00.000Z',
          totalRequirements: 2,
          fulfilledRequirements: 2,
          completionPercentage: 100,
          isOverdue: false,
          isAtRisk: false,
        },
      ],
      overallCompletionPercentage: 75,
    },
    {
      employeeId: 'emp-2',
      employeeName: 'Bob Williams',
      employeeEmail: 'bob@example.com',
      assignments: [
        {
          id: 'assign-3',
          templateId: 'tpl-1',
          templateName: 'Forklift Operator Onboarding',
          status: 'in_progress',
          dueDate: '2026-02-01T00:00:00.000Z',
          completedAt: null,
          totalRequirements: 4,
          fulfilledRequirements: 1,
          completionPercentage: 25,
          isOverdue: true,
          isAtRisk: false,
        },
      ],
      overallCompletionPercentage: 25,
    },
  ],
  total: 2,
  page: 1,
  limit: 200,
};

function mockApi(options?: { failLoad?: boolean; forbidden?: boolean; emptyData?: boolean }) {
  return import('../../api/client').then(({ api, ApiError: MockApiError }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path.startsWith('/templates/team')) {
        if (options?.failLoad) {
          return Promise.reject(new Error('Server error'));
        }

        if (options?.forbidden) {
          return Promise.reject(new MockApiError('Forbidden', 403));
        }

        if (options?.emptyData) {
          return Promise.resolve({ data: [], total: 0, page: 1, limit: 200 });
        }

        return Promise.resolve(teamTemplateData);
      }

      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/team/templates']}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderTeamTemplates() {
  localStorage.setItem('user', JSON.stringify(supervisorUser));
  localStorage.setItem('token', 'fake-token');

  return render(
    <Wrapper>
      <Routes>
        <Route path="/team/templates" element={<TeamTemplatesPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('TeamTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders loading state then team data', async () => {
    await mockApi();
    renderTeamTemplates();

    expect(screen.getByText(/loading team templates/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /team templates/i })).toBeInTheDocument();
  });

  it('displays summary statistics', async () => {
    await mockApi();
    renderTeamTemplates();

    const summaryGrid = await screen.findByLabelText(/team template summary/i);
    expect(summaryGrid).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('displays employee names and template names in table', async () => {
    await mockApi();
    renderTeamTemplates();

    const table = await screen.findByRole('table', { name: /team template assignments/i });
    expect(table).toBeInTheDocument();
    expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Williams').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Forklift Operator Onboarding').length).toBeGreaterThan(0);
    // "Fire Safety Certification" appears in both table and filter dropdown
    expect(screen.getAllByText('Fire Safety Certification').length).toBeGreaterThanOrEqual(1);
  });

  it('shows status badges (completed, overdue, at risk)', async () => {
    await mockApi();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    // These labels appear both as summary stat labels and as table badges
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('At Risk').length).toBeGreaterThanOrEqual(1);
  });

  it('shows progress information per assignment', async () => {
    await mockApi();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    expect(screen.getByText('2/4')).toBeInTheDocument(); // Alice's forklift
    expect(screen.getByText('2/2')).toBeInTheDocument(); // Alice's fire safety
    expect(screen.getByText('1/4')).toBeInTheDocument(); // Bob's forklift
  });

  it('allows searching by employee name', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    const searchInput = screen.getByPlaceholderText(/search by employee or template/i);
    await user.type(searchInput, 'bob');

    await waitFor(() => {
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Bob Williams')).toBeInTheDocument();
  });

  it('allows filtering by status', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    const statusSelect = screen.getByLabelText(/status filter/i);
    await user.selectOptions(statusSelect, 'completed');

    await waitFor(() => {
      expect(screen.queryByText('Bob Williams')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Fire Safety Certification').length).toBeGreaterThanOrEqual(1);
  });

  it('allows filtering by template', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    const templateSelect = screen.getByLabelText(/template filter/i);
    await user.selectOptions(templateSelect, 'Fire Safety Certification');

    await waitFor(() => {
      expect(screen.queryByText('Bob Williams')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0);
  });

  it('shows empty state when no assignments match filters', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    const searchInput = screen.getByPlaceholderText(/search by employee or template/i);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/no assignments match/i)).toBeInTheDocument();
    });
  });

  it('shows error state when data fails to load', async () => {
    await mockApi({ failLoad: true });
    renderTeamTemplates();

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('shows permission error for forbidden access', async () => {
    await mockApi({ forbidden: true });
    renderTeamTemplates();

    await waitFor(() => {
      expect(screen.getByText(/limited to supervisors/i)).toBeInTheDocument();
    });
  });

  it('shows empty summary when no data', async () => {
    await mockApi({ emptyData: true });
    renderTeamTemplates();

    await waitFor(() => {
      expect(screen.getByText(/no assignments match/i)).toBeInTheDocument();
    });
  });

  it('renders breadcrumbs with navigation links', async () => {
    await mockApi();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^team$/i })).toBeInTheDocument();
  });

  it('has a link to Template Library', async () => {
    await mockApi();
    renderTeamTemplates();

    await screen.findByRole('table', { name: /team template assignments/i });
    expect(screen.getByRole('link', { name: /template library/i })).toBeInTheDocument();
  });
});
