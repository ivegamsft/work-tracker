import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyMedicalPage from '../MyMedical';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { MedicalClearance } from '../../types/my-section';

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

const mockMedicalClearances: MedicalClearance[] = [
  {
    id: 'm1',
    clearanceType: 'Physical Exam',
    status: 'cleared',
    expiresAt: '2026-12-31T00:00:00.000Z',
    expirationDate: '2026-12-31T00:00:00.000Z',
    documentCount: 1,
  },
  {
    id: 'm2',
    clearanceType: 'Drug Test',
    status: 'expiring_soon',
    expiresAt: '2026-04-15T00:00:00.000Z',
    documentCount: 2,
  },
];

const MockedMyMedicalPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <MyMedicalPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function renderMyMedical(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedMyMedicalPage />);
}

async function mockApi(options?: {
  clearances?: MedicalClearance[];
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const clearances = options?.clearances ?? mockMedicalClearances;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
      });
    }

    if (path.includes('/medical')) {
      return options?.fail ? Promise.reject(new Error('Medical data unavailable')) : Promise.resolve(clearances);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  return mockGet;
}

describe('MyMedicalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderMyMedical();

    expect(await screen.findByRole('heading', { name: /my medical/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderMyMedical();

    expect(screen.getByText(/loading medical clearances.../i)).toBeInTheDocument();
  });

  it('displays medical clearances list', async () => {
    await mockApi();
    renderMyMedical();

    expect(await screen.findByText('Physical Exam')).toBeInTheDocument();
    expect(screen.getByText('Drug Test')).toBeInTheDocument();
  });

  it('shows tab navigation', async () => {
    await mockApi();
    renderMyMedical();

    expect(await screen.findByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expiring/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expired/i })).toBeInTheDocument();
  });

  it('shows empty state when no clearances', async () => {
    await mockApi({ clearances: [] });
    renderMyMedical();

    expect(await screen.findByText(/no medical clearances on record yet/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockApi({ fail: true });
    renderMyMedical();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/medical data unavailable/i)).toBeInTheDocument();
  });

  it('displays clearance status badges', async () => {
    await mockApi();
    renderMyMedical();

    expect(await screen.findByText(/cleared/i)).toBeInTheDocument();
    expect(screen.getByText(/expiring_soon/i)).toBeInTheDocument();
  });
});
