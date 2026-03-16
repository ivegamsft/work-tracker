import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TemplateLibraryPage from '../TemplateLibraryPage';

vi.mock('../../api/client', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
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

const templates = [
  {
    id: 'tpl-1',
    name: 'Forklift Operator Onboarding',
    description: 'Requirements for forklift operators.',
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
  },
  {
    id: 'tpl-2',
    name: 'Annual Drug Testing',
    description: 'Drug clearance template for all staff.',
    category: 'Medical',
    status: 'draft',
    version: 1,
    previousVersion: null,
    createdBy: 'admin-1',
    updatedBy: null,
    standardId: null,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
    publishedAt: null,
    archivedAt: null,
    requirements: [
      {
        id: 'req-2',
        templateId: 'tpl-2',
        name: 'Drug Test Clearance',
        description: 'Record clearance.',
        attestationLevels: ['third_party'],
        proofType: 'clearance',
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
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      },
    ],
  },
];

function mockApi(options?: { failTemplates?: boolean; templatesResponse?: typeof templates }) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path.startsWith('/templates')) {
        if (options?.failTemplates) {
          return Promise.reject(new Error('Templates unavailable'));
        }

        return Promise.resolve(options?.templatesResponse ?? templates);
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/templates']}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('TemplateLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(supervisorUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders template cards with names, categories, and status badges', async () => {
    await mockApi();

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    expect(screen.getByText(/loading template library/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /template library/i })).toBeInTheDocument();
    expect(screen.getByText('Forklift Operator Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Annual Drug Testing')).toBeInTheDocument();
    expect(screen.getAllByText('Safety').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medical').length).toBeGreaterThan(0);
  });

  it('shows summary statistics for templates', async () => {
    await mockApi();

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    await screen.findByText('Forklift Operator Onboarding');
    const statValues = screen.getAllByText('2');
    expect(statValues.length).toBeGreaterThan(0);
  });

  it('filters templates by search query', async () => {
    await mockApi();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    await screen.findByText('Forklift Operator Onboarding');

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'Drug');

    expect(screen.getByText('Annual Drug Testing')).toBeInTheDocument();
    expect(screen.queryByText('Forklift Operator Onboarding')).not.toBeInTheDocument();
  });

  it('filters templates by proof type', async () => {
    await mockApi();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    await screen.findByText('Forklift Operator Onboarding');

    const proofTypeSelect = screen.getByRole('combobox', { name: /proof type/i });
    await user.selectOptions(proofTypeSelect, 'clearance');

    expect(screen.getByText('Annual Drug Testing')).toBeInTheDocument();
    expect(screen.queryByText('Forklift Operator Onboarding')).not.toBeInTheDocument();
  });

  it('shows empty state when no templates match filters', async () => {
    await mockApi();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    await screen.findByText('Forklift Operator Onboarding');

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'nonexistent template xyz');

    expect(screen.getByText(/no templates matched your current filters/i)).toBeInTheDocument();
  });

  it('shows error state when templates cannot be loaded', async () => {
    await mockApi({ failTemplates: true });

    render(
      <Wrapper>
        <TemplateLibraryPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/templates unavailable/i)).toBeInTheDocument();
    });
  });
});
