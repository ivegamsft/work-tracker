import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyQualificationsPage from '../MyQualifications';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { Qualification } from '../../types/my-section';

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

const mockQualifications: Qualification[] = [
  {
    id: 'q1',
    name: 'OSHA 10-Hour Card',
    certificationName: 'OSHA 10-Hour Card',
    status: 'active',
    issuer: 'OSHA',
    issuingBody: 'OSHA',
    expiresAt: '2026-12-31T00:00:00.000Z',
    expirationDate: '2026-12-31T00:00:00.000Z',
    documentCount: 2,
    requirementsTotal: 1,
    requirementsMet: 1,
  },
  {
    id: 'q2',
    name: 'Forklift Certification',
    certificationName: 'Forklift Certification',
    status: 'expiring_soon',
    issuer: 'Safety First',
    expiresAt: '2026-04-15T00:00:00.000Z',
    documentCount: 1,
    requirementsTotal: 1,
    requirementsMet: 1,
  },
  {
    id: 'q3',
    name: 'Annual Refresher',
    status: 'expired',
    expiresAt: '2026-02-01T00:00:00.000Z',
    documentCount: 0,
    requirementsTotal: 1,
    requirementsMet: 0,
  },
];

const MockedMyQualificationsPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <MyQualificationsPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function renderMyQualifications(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedMyQualificationsPage />);
}

async function mockApi(options?: {
  qualifications?: Qualification[];
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const qualifications = options?.qualifications ?? mockQualifications;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
      });
    }

    if (path.includes('/qualifications')) {
      return options?.fail ? Promise.reject(new Error('Qualifications unavailable')) : Promise.resolve(qualifications);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('MyQualificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderMyQualifications();

    expect(await screen.findByRole('heading', { name: /my qualifications/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderMyQualifications();

    expect(screen.getByText(/loading qualifications.../i)).toBeInTheDocument();
  });

  it('displays qualifications list', async () => {
    await mockApi();
    renderMyQualifications();

    expect(await screen.findByText('OSHA 10-Hour Card')).toBeInTheDocument();
    expect(screen.getByText('Forklift Certification')).toBeInTheDocument();
    expect(screen.getByText('Annual Refresher')).toBeInTheDocument();
  });

  it('shows tab navigation', async () => {
    await mockApi();
    renderMyQualifications();

    expect(await screen.findByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expiring/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expired/i })).toBeInTheDocument();
  });

  it('shows empty state when no qualifications', async () => {
    await mockApi({ qualifications: [] });
    renderMyQualifications();

    expect(await screen.findByText(/no qualifications on record yet/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockApi({ fail: true });
    renderMyQualifications();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/qualifications unavailable/i)).toBeInTheDocument();
  });

  it('displays qualification status badges', async () => {
    await mockApi();
    renderMyQualifications();

    const activeCard = (await screen.findByText('OSHA 10-Hour Card')).closest('.proof-card');
    expect(activeCard).not.toBeNull();
    expect(within(activeCard as HTMLElement).getByText(/active/i)).toBeInTheDocument();
  });

  it('shows document count for qualifications', async () => {
    await mockApi();
    renderMyQualifications();

    expect(await screen.findByText(/2 document/i)).toBeInTheDocument();
    expect(screen.getByText(/1 document/i)).toBeInTheDocument();
  });
});
