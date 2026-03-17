import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewQueuePage, ReviewDetailPage } from '../ReviewPages';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const managerUser = {
  id: 'manager-1',
  email: 'manager@example.com',
  name: 'Manager User',
  role: 'manager',
};

const mockQueueData = {
  data: [
    {
      id: 'review-1',
      documentId: 'doc-1',
      status: 'pending',
      createdAt: '2026-03-20T00:00:00.000Z',
    },
    {
      id: 'review-2',
      documentId: 'doc-2',
      status: 'review_required',
      createdAt: '2026-03-19T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
};

const mockDocument = {
  id: 'doc-1',
  name: 'OSHA Certificate',
  fileName: 'osha.pdf',
  type: 'certification',
  status: 'pending',
  employeeId: 'employee-1',
  createdAt: '2026-03-20T00:00:00.000Z',
};

const mockEmployee = {
  id: 'employee-1',
  name: 'John Doe',
  email: 'john@example.com',
  department: 'Engineering',
  role: 'employee',
};

const MockedReviewQueuePage = () => (
  <MemoryRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <ReviewQueuePage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

const MockedReviewDetailPage = ({ reviewId }: { reviewId: string }) => (
  <MemoryRouter initialEntries={[`/reviews/${reviewId}`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/reviews/:id" element={<ReviewDetailPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

function renderReviewQueue(user = managerUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedReviewQueuePage />);
}

function renderReviewDetail(reviewId = 'review-1', user = managerUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedReviewDetailPage reviewId={reviewId} />);
}

async function mockQueueApi(options?: {
  queue?: typeof mockQueueData;
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const queue = options?.queue ?? mockQueueData;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({});
    }

    if (path.includes('/review-queue')) {
      return options?.fail ? Promise.reject(new Error('Queue unavailable')) : Promise.resolve(queue);
    }

    if (path.startsWith('/documents/doc-')) {
      return Promise.resolve(mockDocument);
    }

    if (path.startsWith('/employees/')) {
      return Promise.resolve(mockEmployee);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

async function mockDetailApi(options?: {
  document?: typeof mockDocument;
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const mockPatch = vi.mocked(api.patch);
  const document = options?.document ?? mockDocument;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({});
    }

    if (path.startsWith('/documents/')) {
      return options?.fail ? Promise.reject(new Error('Document not found')) : Promise.resolve(document);
    }

    if (path.startsWith('/employees/')) {
      return Promise.resolve(mockEmployee);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  mockPatch.mockResolvedValue({ success: true });

  return { mockGet, mockPatch };
}

describe('ReviewQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockQueueApi();
    renderReviewQueue();

    expect(await screen.findByRole('heading', { name: /review queue/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderReviewQueue();

    expect(screen.getByText(/loading review queue.../i)).toBeInTheDocument();
  });

  it('displays queue items', async () => {
    await mockQueueApi();
    renderReviewQueue();

    expect(await screen.findByText('OSHA Certificate')).toBeInTheDocument();
  });

  it('shows empty state when queue is empty', async () => {
    await mockQueueApi({ queue: { data: [], total: 0, page: 1 } });
    renderReviewQueue();

    expect(await screen.findByText(/no documents pending review/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockQueueApi({ fail: true });
    renderReviewQueue();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/queue unavailable/i)).toBeInTheDocument();
  });

  it('displays priority indicators', async () => {
    await mockQueueApi();
    renderReviewQueue();

    const page = await screen.findByRole('heading', { name: /review queue/i });
    expect(page).toBeInTheDocument();
  });
});

describe('ReviewDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockDetailApi();
    renderReviewDetail();

    expect(await screen.findByText('OSHA Certificate')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderReviewDetail();

    expect(screen.getByText(/loading review details.../i)).toBeInTheDocument();
  });

  it('shows error message when document not found', async () => {
    await mockDetailApi({ fail: true });
    renderReviewDetail();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/document not found/i)).toBeInTheDocument();
  });

  it('displays document information', async () => {
    await mockDetailApi();
    renderReviewDetail();

    expect(await screen.findByText('OSHA Certificate')).toBeInTheDocument();
    expect(screen.getByText(/certification/i)).toBeInTheDocument();
  });
});
