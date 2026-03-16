import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import {
  FEATURE_FLAG_DEFAULTS,
  FeatureFlagsProvider,
  useFeatureFlag,
  useFeatureFlags,
} from '../useFeatureFlags';

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

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('fetches feature flags after authentication and exposes them through context', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockResolvedValueOnce({
      'records.hours-ui': true,
      'compliance.templates': true,
      'reference.labels-admin': false,
      'web.team-subnav': true,
    });

    const { result } = renderHook(() => useFeatureFlags(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.flags['records.hours-ui']).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/v1/platform/feature-flags');
    expect(result.current.flags['compliance.templates']).toBe(true);
    expect(result.current.flags['reference.labels-admin']).toBe(false);
    expect(result.current.flags['web.team-subnav']).toBe(true);
  });

  it('returns default false values when the flag request fails', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('feature flags unavailable'));

    const { result } = renderHook(() => ({
      enabled: useFeatureFlag('compliance.templates'),
      flags: useFeatureFlags(),
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.flags.loading).toBe(false);
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.flags.flags).toMatchObject(FEATURE_FLAG_DEFAULTS);
  });
});
