import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import TemplateFulfillmentPage from '../TemplateFulfillmentPage';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const employeeUser = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const assignment = {
  id: 'assignment-1',
  templateId: 'tpl-1',
  templateVersion: 2,
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

const fulfillments = [
  {
    id: 'ful-1',
    assignmentId: 'assignment-1',
    requirementId: 'req-1',
    employeeId: 'employee-1',
    status: 'fulfilled',
    selfAttestedAt: null,
    uploadedAt: '2026-03-22T00:00:00.000Z',
    documentId: 'doc-1',
    attachedDocumentId: 'doc-1',
    thirdPartyVerifiedAt: null,
    validatedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    expiresAt: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
  },
  {
    id: 'ful-2',
    assignmentId: 'assignment-1',
    requirementId: 'req-2',
    employeeId: 'employee-1',
    status: 'unfulfilled',
    selfAttestedAt: null,
    uploadedAt: null,
    documentId: null,
    attachedDocumentId: null,
    thirdPartyVerifiedAt: null,
    validatedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    expiresAt: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  },
];

const documents = [
  {
    id: 'doc-1',
    employeeId: 'employee-1',
    name: 'osha-card.pdf',
    fileName: 'osha-card.pdf',
    status: 'approved',
    createdAt: '2026-03-22T00:00:00.000Z',
  },
];

function mockApi(options?: { failLoad?: boolean }) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path.startsWith('/employees/employee-1/assignments')) {
        if (options?.failLoad) {
          return Promise.reject(new Error('Assignments unavailable'));
        }
        return Promise.resolve({ data: [assignment], total: 1, page: 1, limit: 100 });
      }

      if (path === '/templates/tpl-1') {
        return Promise.resolve(template);
      }

      if (path === '/assignments/assignment-1/fulfillments') {
        return Promise.resolve(fulfillments);
      }

      if (path.startsWith('/documents/employee/employee-1')) {
        return Promise.resolve(documents);
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path.includes('/self-attest')) {
        return Promise.resolve({});
      }

      if (path.includes('/attach-document')) {
        return Promise.resolve({});
      }

      if (path === '/documents/upload') {
        return Promise.resolve({ id: 'doc-new', name: 'evidence.pdf', status: 'uploaded' });
      }

      return Promise.reject(new Error(`Unexpected POST path: ${path}`));
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/me/templates/assignment-1']}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderFulfillment() {
  localStorage.setItem('user', JSON.stringify(employeeUser));
  localStorage.setItem('token', 'fake-token');

  return render(
    <Wrapper>
      <Routes>
        <Route path="/me/templates/:assignmentId" element={<TemplateFulfillmentPage />} />
      </Routes>
    </Wrapper>,
  );
}

describe('TemplateFulfillmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders assignment overview with progress bar and requirement panels', async () => {
    await mockApi();
    renderFulfillment();

    expect(screen.getByText(/loading template fulfillment/i)).toBeInTheDocument();
    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/50% complete/i)).toBeInTheDocument();
    expect(screen.getByText('OSHA 10-Hour Card')).toBeInTheDocument();
    expect(screen.getByText('Equipment Familiarization')).toBeInTheDocument();
  });

  it('shows fulfilled and not started status badges for requirements', async () => {
    await mockApi();
    renderFulfillment();

    await screen.findByText('OSHA 10-Hour Card');
    expect(screen.getByText('Fulfilled')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('shows self-attestation form for requirements with self_attest level', async () => {
    await mockApi();
    renderFulfillment();

    await screen.findByText('Equipment Familiarization');
    expect(screen.getByPlaceholderText(/describe how you met this requirement/i)).toBeInTheDocument();
  });

  it('shows due date and assignment summary fields', async () => {
    await mockApi();
    renderFulfillment();

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/due date/i)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument(); // Completed count
  });

  it('shows evidence document linked to a fulfilled requirement', async () => {
    await mockApi();
    renderFulfillment();

    await screen.findByText('osha-card.pdf');
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('shows save and submit action buttons', async () => {
    await mockApi();
    renderFulfillment();

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /save progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit progress/i })).toBeInTheDocument();
  });

  it('shows error state when assignment cannot be loaded', async () => {
    await mockApi({ failLoad: true });
    renderFulfillment();

    await waitFor(() => {
      expect(screen.getByText(/assignments unavailable/i)).toBeInTheDocument();
    });
  });

  it('shows back-to-templates navigation link', async () => {
    await mockApi();
    renderFulfillment();

    const headings = await screen.findAllByRole('heading', { name: /forklift operator onboarding/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /back to templates/i })).toHaveAttribute('href', '/me/templates');
  });
});
