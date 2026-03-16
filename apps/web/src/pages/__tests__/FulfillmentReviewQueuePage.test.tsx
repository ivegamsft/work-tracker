import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import FulfillmentReviewQueuePage from '../FulfillmentReviewQueuePage';

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

const reviewItems = [
  {
    id: 'ful-1',
    employeeId: 'emp-1',
    employeeName: 'Alice Johnson',
    employeeEmail: 'alice@example.com',
    templateId: 'tpl-1',
    templateName: 'Forklift Operator Onboarding',
    requirementId: 'req-1',
    requirementName: 'OSHA 10-Hour Card',
    proofType: 'certification',
    attestationLevels: ['upload'],
    submittedAt: '2026-03-18T12:00:00.000Z',
    status: 'pending_review',
    isPriority: false,
  },
  {
    id: 'ful-2',
    employeeId: 'emp-2',
    employeeName: 'Bob Smith',
    employeeEmail: 'bob@example.com',
    templateId: 'tpl-2',
    templateName: 'Annual Drug Testing',
    requirementId: 'req-2',
    requirementName: 'Drug Test Clearance',
    proofType: 'clearance',
    attestationLevels: ['third_party'],
    submittedAt: '2026-03-19T10:00:00.000Z',
    status: 'pending_review',
    isPriority: true,
  },
];

function mockApi(options?: { shouldFail?: boolean; items?: typeof reviewItems }) {
  return import('../../api/client').then(({ api }) => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/v1/platform/feature-flags') {
        return Promise.resolve({ 'compliance.templates': true });
      }

      if (path.startsWith('/fulfillments/reviews')) {
        if (options?.shouldFail) {
          return Promise.reject(new Error('Server error'));
        }

        return Promise.resolve({
          data: options?.items ?? reviewItems,
          total: (options?.items ?? reviewItems).length,
          page: 1,
          limit: 50,
        });
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/reviews/templates']}>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('FulfillmentReviewQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(managerUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders review items with employee names, templates, and status', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    expect(screen.getByText(/loading fulfillment review queue/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /fulfillment review queue/i })).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Forklift Operator Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Annual Drug Testing')).toBeInTheDocument();
  });

  it('shows summary statistics', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');
    expect(screen.getByText('Pending reviews')).toBeInTheDocument();
    expect(screen.getByText('Priority items')).toBeInTheDocument();
  });

  it('filters items by search query', async () => {
    await mockApi();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    await screen.findByText('Alice Johnson');

    const searchInput = screen.getByPlaceholderText(/search by employee/i);
    await user.type(searchInput, 'Bob');

    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  it('shows empty state when no items match', async () => {
    await mockApi({ items: [] });

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no fulfillments are waiting for review/i)).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    await mockApi({ shouldFail: true });

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('displays priority badge for priority items', async () => {
    await mockApi();

    render(
      <Wrapper>
        <FulfillmentReviewQueuePage />
      </Wrapper>,
    );

    await screen.findByText('Bob Smith');
    const priorityBadges = screen.getAllByText('Priority');
    expect(priorityBadges.length).toBeGreaterThan(0);
  });
});
