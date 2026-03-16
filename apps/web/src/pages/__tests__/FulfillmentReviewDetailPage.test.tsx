import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import FulfillmentReviewDetailPage from '../FulfillmentReviewDetailPage';

vi.mock('../../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

const managerUser = {
  id: 'manager-1',
  email: 'manager@example.com',
  name: 'Manager User',
  role: 'manager',
};

const reviewDetail = {
  id: 'ful-1',
  assignmentId: 'assign-1',
  requirementId: 'req-1',
  employeeId: 'emp-1',
  status: 'pending_review',
  selfAttestedAt: '2026-03-18T12:00:00.000Z',
  selfAttestation: 'I completed the OSHA 10-hour course on March 15.',
  uploadedAt: '2026-03-18T13:00:00.000Z',
  documentId: 'doc-1',
  attachedDocumentId: null,
  thirdPartyVerifiedAt: null,
  validatedAt: null,
  validatorNotes: null,
  rejectedAt: null,
  rejectionReason: null,
  expiresAt: '2027-03-18T00:00:00.000Z',
  createdAt: '2026-03-17T00:00:00.000Z',
  updatedAt: '2026-03-18T13:00:00.000Z',
  employeeName: 'Alice Johnson',
  employeeEmail: 'alice@example.com',
  templateName: 'Forklift Operator Onboarding',
  requirementName: 'OSHA 10-Hour Card',
  requirementDescription: 'Upload your OSHA safety card as proof of completion.',
  canReview: true,
  reviewHistory: [
    {
      id: 'log-1',
      action: 'request_changes',
      performedBy: 'manager-2',
      performedByName: 'Carol Davis',
      performedAt: '2026-03-17T15:00:00.000Z',
      notes: 'Please upload a clearer scan of the card.',
    },
  ],
  requirement: {
    id: 'req-1',
    name: 'OSHA 10-Hour Card',
    description: 'Upload your OSHA safety card.',
    attestationLevels: ['upload', 'self_attest'],
    proofType: 'certification',
  },
};

function mockApi(options?: {
  shouldFail?: boolean;
  notFound?: boolean;
  detail?: typeof reviewDetail;
  postFail?: boolean;
}) {
  return import('../../api/client').then(({ api, ApiError }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path.includes('/review')) {
        if (options?.shouldFail) {
          return Promise.reject(new Error('Server error'));
        }
        if (options?.notFound) {
          return Promise.reject(new (ApiError as any)('Not found', 404));
        }

        return Promise.resolve(options?.detail ?? reviewDetail);
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    vi.mocked(api.post).mockImplementation((_path: string) => {
      if (options?.postFail) {
        return Promise.reject(new Error('Review submission failed'));
      }

      return Promise.resolve({ ...reviewDetail, status: 'fulfilled' });
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/reviews/templates/ful-1']}>
      <AuthProvider>
        <FeatureFlagsProvider>
          <Routes>
            <Route path="/reviews/templates/:fulfillmentId" element={children} />
          </Routes>
        </FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('FulfillmentReviewDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(managerUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders fulfillment details with employee and template info', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    expect(screen.getByText(/loading review detail/i)).toBeInTheDocument();
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Forklift Operator Onboarding')).toBeInTheDocument();
    expect(screen.getAllByText('OSHA 10-Hour Card').length).toBeGreaterThan(0);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows submitted evidence sections', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByText('Self-attestation statement')).toBeInTheDocument();
    expect(screen.getByText(/I completed the OSHA 10-hour course/)).toBeInTheDocument();
    expect(screen.getByText('Uploaded document')).toBeInTheDocument();
  });

  it('shows review history entries', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByText(/Carol Davis/)).toBeInTheDocument();
    expect(screen.getByText(/Please upload a clearer scan/)).toBeInTheDocument();
  });

  it('shows approve, reject, and request changes buttons when review is allowed', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request changes/i })).toBeInTheDocument();
  });

  it('disables review actions when canReview is false', async () => {
    await mockApi({ detail: { ...reviewDetail, canReview: false } });

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByText(/cannot review your own fulfillment/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('requires notes before submitting a review', async () => {
    await mockApi();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');

    const approveBtn = screen.getByRole('button', { name: /approve/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/review notes are required/i)).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    await mockApi({ shouldFail: true });

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('shows not found error for missing fulfillment', async () => {
    await mockApi({ notFound: true });

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/fulfillment not found/i)).toBeInTheDocument();
    });
  });

  it('has a back to queue link', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewDetailPage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByRole('link', { name: /back to queue/i })).toHaveAttribute(
      'href',
      '/reviews/templates',
    );
  });
});
