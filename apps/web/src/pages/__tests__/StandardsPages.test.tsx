import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StandardsLibraryPage, StandardDetailPage } from '../StandardsPages';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

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

const mockStandards = [
  {
    id: 'std-1',
    name: 'OSHA 10-Hour General Industry',
    issuingBody: 'OSHA',
    status: 'active',
    version: '2024.1',
    effectiveDate: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'std-2',
    name: 'Forklift Certification',
    issuingBody: 'ANSI',
    status: 'active',
    version: '2023.2',
    effectiveDate: '2023-06-01T00:00:00.000Z',
  },
];

const mockStandardDetail = {
  id: 'std-1',
  name: 'OSHA 10-Hour General Industry',
  issuingBody: 'OSHA',
  status: 'active',
  version: '2024.1',
  description: 'Comprehensive workplace safety training',
  effectiveDate: '2024-01-01T00:00:00.000Z',
  requirements: [
    {
      id: 'req-1',
      name: 'Complete 10-hour course',
      minimumHours: 10,
      requiredTests: ['Written Exam', 'Practical Assessment'],
    },
  ],
};

const MockedStandardsLibraryPage = () => (
  <MemoryRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <StandardsLibraryPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

const MockedStandardDetailPage = ({ standardId }: { standardId: string }) => (
  <MemoryRouter initialEntries={[`/standards/${standardId}`]}>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
          <Route path="/standards/:id" element={<StandardDetailPage />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  </MemoryRouter>
);

function renderStandardsLibrary(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedStandardsLibraryPage />);
}

function renderStandardDetail(standardId = 'std-1', user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedStandardDetailPage standardId={standardId} />);
}

async function mockLibraryApi(options?: {
  standards?: typeof mockStandards;
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const standards = options?.standards ?? mockStandards;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({});
    }

    if (path.includes('/standards')) {
      return options?.fail ? Promise.reject(new Error('Standards unavailable')) : Promise.resolve(standards);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

async function mockDetailApi(options?: {
  standard?: typeof mockStandardDetail;
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const standard = options?.standard ?? mockStandardDetail;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({});
    }

    if (path.startsWith('/standards/')) {
      return options?.fail ? Promise.reject(new Error('Standard not found')) : Promise.resolve(standard);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('StandardsLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockLibraryApi();
    renderStandardsLibrary();

    expect(await screen.findByRole('heading', { name: /standards library/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderStandardsLibrary();

    expect(screen.getByText(/loading standards.../i)).toBeInTheDocument();
  });

  it('displays standards list', async () => {
    await mockLibraryApi();
    renderStandardsLibrary();

    expect(await screen.findByText('OSHA 10-Hour General Industry')).toBeInTheDocument();
    expect(screen.getByText('Forklift Certification')).toBeInTheDocument();
  });

  it('shows search input', async () => {
    await mockLibraryApi();
    renderStandardsLibrary();

    expect(await screen.findByPlaceholderText(/search standards/i)).toBeInTheDocument();
  });

  it('shows status filter', async () => {
    await mockLibraryApi();
    renderStandardsLibrary();

    expect(await screen.findByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /active/i })).toBeInTheDocument();
  });

  it('shows empty state when no standards', async () => {
    await mockLibraryApi({ standards: [] });
    renderStandardsLibrary();

    expect(await screen.findByText(/no standards found/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockLibraryApi({ fail: true });
    renderStandardsLibrary();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/standards unavailable/i)).toBeInTheDocument();
  });
});

describe('StandardDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockDetailApi();
    renderStandardDetail();

    expect(await screen.findByText('OSHA 10-Hour General Industry')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderStandardDetail();

    expect(screen.getByText(/loading standard details.../i)).toBeInTheDocument();
  });

  it('shows error message when standard not found', async () => {
    await mockDetailApi({ fail: true });
    renderStandardDetail();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/standard not found/i)).toBeInTheDocument();
  });

  it('displays standard information', async () => {
    await mockDetailApi();
    renderStandardDetail();

    expect(await screen.findByText('OSHA 10-Hour General Industry')).toBeInTheDocument();
    expect(screen.getByText(/OSHA/i)).toBeInTheDocument();
    expect(screen.getByText(/comprehensive workplace safety training/i)).toBeInTheDocument();
  });

  it('displays requirements', async () => {
    await mockDetailApi();
    renderStandardDetail();

    expect(await screen.findByText(/complete 10-hour course/i)).toBeInTheDocument();
  });
});
