import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TemplateAssignPage from '../TemplateAssignPage';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
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

const publishedTemplate = {
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
      attestationLevels: ['upload'],
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
  ],
};

const employeesList = {
  data: [
    {
      id: 'emp-1',
      employeeNumber: 'E001',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      role: 'employee',
      departmentId: 'Operations',
      isActive: true,
    },
    {
      id: 'emp-2',
      employeeNumber: 'E002',
      firstName: 'Bob',
      lastName: 'Williams',
      email: 'bob@example.com',
      role: 'employee',
      departmentId: 'Warehouse',
      isActive: true,
    },
    {
      id: 'emp-3',
      employeeNumber: 'E003',
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      role: 'employee',
      departmentId: 'HR',
      isActive: false,
    },
  ],
  total: 3,
  page: 1,
  limit: 50,
};

function mockApi(options?: { failLoad?: boolean; failAssign?: boolean }) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path === '/templates/tpl-1') {
        if (options?.failLoad) {
          return Promise.reject(new Error('Template not found'));
        }
        return Promise.resolve(publishedTemplate);
      }

      if (path === '/employees') {
        return Promise.resolve(employeesList);
      }

      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path === '/templates/tpl-1/assign') {
        if (options?.failAssign) {
          return Promise.reject(new Error('Assignment failed'));
        }
        return Promise.resolve({ assignments: [], created: 2, skipped: 0 });
      }

      return Promise.reject(new Error(`Unexpected POST: ${path}`));
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/templates/tpl-1/assign']}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderAssign() {
  localStorage.setItem('user', JSON.stringify(supervisorUser));
  localStorage.setItem('token', 'fake-token');

  return render(
    <Wrapper>
      <Routes>
        <Route path="/templates/:id/assign" element={<TemplateAssignPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('TemplateAssignPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders loading state then assignment form', async () => {
    await mockApi();
    renderAssign();

    expect(screen.getByText(/loading template assignment/i)).toBeInTheDocument();
    expect(await screen.findByText(/choose employees/i)).toBeInTheDocument();
  });

  it('displays employee list with names and status badges', async () => {
    await mockApi();
    renderAssign();

    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Williams')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
  });

  it('shows assignment summary panel with template info', async () => {
    await mockApi();
    renderAssign();

    expect(await screen.findByText(/assignment summary/i)).toBeInTheDocument();
    // Template name appears in breadcrumb + sidebar
    expect(screen.getAllByText('Forklift Operator Onboarding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('No deadline')).toBeInTheDocument();
  });

  it('allows searching employees by name', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderAssign();

    await screen.findByText('Alice Johnson');
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'alice');

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Williams')).not.toBeInTheDocument();
  });

  it('selects employees with checkboxes', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderAssign();

    await screen.findByText('Alice Johnson');
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it('shows "Select filtered active" and "Clear selection" buttons', async () => {
    await mockApi();
    renderAssign();

    await screen.findByText('Alice Johnson');
    expect(screen.getByRole('button', { name: /select filtered active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
  });

  it('shows due date picker', async () => {
    await mockApi();
    renderAssign();

    await screen.findByText('Alice Johnson');
    const dateInput = screen.getByLabelText(/^due date$/i);
    expect(dateInput).toBeInTheDocument();
  });

  it('shows error state when loading fails', async () => {
    await mockApi({ failLoad: true });
    renderAssign();

    await waitFor(() => {
      expect(screen.getByText(/template not found/i)).toBeInTheDocument();
    });
  });

  it('renders breadcrumbs with navigation links', async () => {
    await mockApi();
    renderAssign();

    await screen.findByText(/choose employees/i);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Template Library')).toBeInTheDocument();
  });

  it('has confirm assignment button', async () => {
    await mockApi();
    renderAssign();

    await screen.findByText('Alice Johnson');
    expect(screen.getByRole('button', { name: /confirm assignment/i })).toBeInTheDocument();
  });
});
