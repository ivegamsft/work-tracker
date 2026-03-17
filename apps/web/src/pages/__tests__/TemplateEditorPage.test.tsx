import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TemplateEditorPage from '../TemplateEditorPage';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
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

const managerUser = {
  id: 'manager-1',
  email: 'manager@example.com',
  name: 'Manager User',
  role: 'manager',
};

const draftTemplate: {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: number;
  previousVersion: string | null;
  createdBy: string;
  updatedBy: string | null;
  standardId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  requirements: {
    id: string;
    templateId: string;
    name: string;
    description: string;
    attestationLevels: string[];
    proofType: string;
    proofSubType: string | null;
    threshold: number | null;
    thresholdUnit: string | null;
    rollingWindowDays: number | null;
    universalCategory: string | null;
    qualificationType: string | null;
    medicalTestType: string | null;
    standardReqId: string | null;
    validityDays: number | null;
    renewalWarningDays: number | null;
    sortOrder: number;
    isRequired: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
} = {
  id: 'tpl-draft',
  name: 'Safety Induction',
  description: 'Onboarding safety procedures.',
  category: 'Safety',
  status: 'draft',
  version: 1,
  previousVersion: null,
  createdBy: 'admin-1',
  updatedBy: null,
  standardId: null,
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
  requirements: [
    {
      id: 'req-1',
      templateId: 'tpl-draft',
      name: 'Fire Safety Training',
      description: 'Complete fire safety course.',
      attestationLevels: ['upload', 'validated'],
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
      sortOrder: 0,
      isRequired: true,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
    },
  ],
};

const publishedTemplate = {
  ...draftTemplate,
  id: 'tpl-published',
  status: 'published',
  publishedAt: '2026-03-12T00:00:00.000Z' as string | null,
  requirements: draftTemplate.requirements.map((r) => ({
    ...r,
    templateId: 'tpl-published',
  })),
};

function mockApi(options?: { template?: typeof draftTemplate; failLoad?: boolean }) {
  return import('../../api/client').then(({ api }) => {
    const template = options?.template ?? draftTemplate;
    const templateId = template.id;

    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path === `/templates/${templateId}`) {
        if (options?.failLoad) {
          return Promise.reject(new Error('Failed to load template'));
        }
        return Promise.resolve(template);
      }

      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    vi.mocked(api.put).mockImplementation((path: string) => {
      if (path === `/templates/${templateId}`) {
        return Promise.resolve(template);
      }

      if (path.includes('/requirements/reorder')) {
        return Promise.resolve(template.requirements);
      }

      if (path.includes('/requirements/')) {
        return Promise.resolve(template.requirements[0]);
      }

      return Promise.reject(new Error(`Unexpected PUT: ${path}`));
    });

    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path.includes('/requirements')) {
        return Promise.resolve({ ...template.requirements[0], id: 'req-new' });
      }

      return Promise.reject(new Error(`Unexpected POST: ${path}`));
    });

    vi.mocked(api.del).mockImplementation(() => Promise.resolve(undefined as void));
  });
}

function Wrapper({
  children,
  initialPath = '/templates/tpl-draft/edit',
}: {
  children: ReactNode;
  initialPath?: string;
}) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderEditor(options?: { template?: typeof draftTemplate; initialPath?: string }) {
  const template = options?.template ?? draftTemplate;

  localStorage.setItem('user', JSON.stringify(managerUser));
  localStorage.setItem('token', 'fake-token');

  return render(
    <Wrapper initialPath={options?.initialPath ?? `/templates/${template.id}/edit`}>
      <Routes>
        <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('TemplateEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders loading state then template form', async () => {
    await mockApi();
    renderEditor();

    expect(screen.getByText(/loading template editor/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Safety Induction')).toBeInTheDocument();
  });

  it('displays template metadata fields', async () => {
    await mockApi();
    renderEditor();

    expect(await screen.findByDisplayValue('Safety Induction')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Safety')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Onboarding safety procedures.')).toBeInTheDocument();
  });

  it('shows requirements list with name and attestation levels', async () => {
    await mockApi();
    renderEditor();

    expect(await screen.findByDisplayValue('Fire Safety Training')).toBeInTheDocument();
    expect(screen.getByText('1 requirements')).toBeInTheDocument();
  });

  it('enables adding a new requirement', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue('Fire Safety Training');
    const addButton = screen.getByRole('button', { name: /add requirement/i });
    await user.click(addButton);

    expect(screen.getByText('2 requirements')).toBeInTheDocument();
  });

  it('shows read-only notice for published templates', async () => {
    await mockApi({ template: publishedTemplate });
    renderEditor({ template: publishedTemplate });

    await screen.findByDisplayValue('Safety Induction');
    expect(screen.getByText(/published and archived templates are read-only/i)).toBeInTheDocument();
  });

  it('shows error state when template fails to load', async () => {
    await mockApi({ failLoad: true });
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/failed to load template/i)).toBeInTheDocument();
    });
  });

  it('shows proof type dropdown with correct options', async () => {
    await mockApi();
    renderEditor();

    await screen.findByDisplayValue('Safety Induction');
    const proofTypeSelect = screen.getByRole('combobox', { name: /proof type/i });
    expect(proofTypeSelect).toBeInTheDocument();
    expect(proofTypeSelect).toHaveValue('training');
  });

  it('renders breadcrumbs with navigation links', async () => {
    await mockApi();
    renderEditor();

    await screen.findByDisplayValue('Safety Induction');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Template Library')).toBeInTheDocument();
  });

  it('has save and cancel buttons', async () => {
    await mockApi();
    renderEditor();

    await screen.findByDisplayValue('Safety Induction');
    expect(screen.getAllByRole('button', { name: /save template/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });
});
