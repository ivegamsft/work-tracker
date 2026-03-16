import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FeatureGate from '../FeatureGate';
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

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders children when the feature flag is enabled', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockResolvedValueOnce({
      'records.hours-ui': true,
      'compliance.templates': false,
      'reference.labels-admin': false,
      'web.team-subnav': false,
    });

    render(
      <Wrapper>
        <FeatureGate flag="records.hours-ui" fallback={<span>Coming soon</span>}>
          <span>Hours workspace</span>
        </FeatureGate>
      </Wrapper>,
    );

    expect(await screen.findByText(/hours workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('renders the fallback when the feature flag is disabled', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockResolvedValueOnce({
      'records.hours-ui': false,
      'compliance.templates': false,
      'reference.labels-admin': false,
      'web.team-subnav': false,
    });

    render(
      <Wrapper>
        <FeatureGate flag="records.hours-ui" fallback={<span>Coming soon</span>}>
          <span>Hours workspace</span>
        </FeatureGate>
      </Wrapper>,
    );

    expect(await screen.findByText(/coming soon/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/hours workspace/i)).not.toBeInTheDocument();
    });
  });
});
