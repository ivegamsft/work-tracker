import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export const FEATURE_FLAG_DEFAULTS = {
  'records.hours-ui': false,
  'compliance.templates': false,
  'reference.labels-admin': false,
  'web.team-subnav': false,
} as const;

export type KnownFeatureFlag = keyof typeof FEATURE_FLAG_DEFAULTS;
export type FeatureFlags = Record<string, boolean>;

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  loading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

function normalizeEntries(entries: Record<string, unknown>): FeatureFlags {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, Boolean(value)]));
}

export function normalizeFeatureFlags(response: unknown): FeatureFlags {
  const defaults: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS };

  if (!response || typeof response !== 'object') {
    return defaults;
  }

  if ('flags' in response && response.flags && typeof response.flags === 'object' && !Array.isArray(response.flags)) {
    return {
      ...defaults,
      ...normalizeEntries(response.flags as Record<string, unknown>),
    };
  }

  if ('data' in response && Array.isArray(response.data)) {
    return {
      ...defaults,
      ...Object.fromEntries(
        response.data
          .filter(
            (entry): entry is { key: string; enabled: boolean } =>
              Boolean(entry) && typeof entry === 'object' && 'key' in entry && 'enabled' in entry,
          )
          .map((entry) => [entry.key, Boolean(entry.enabled)]),
      ),
    };
  }

  return {
    ...defaults,
    ...normalizeEntries(response as Record<string, unknown>),
  };
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>({ ...FEATURE_FLAG_DEFAULTS });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return () => {
        ignore = true;
      };
    }

    if (!isAuthenticated || !user) {
      setFlags({ ...FEATURE_FLAG_DEFAULTS });
      setLoading(false);
      return () => {
        ignore = true;
      };
    }

    async function fetchFeatureFlags() {
      setLoading(true);

      try {
        const response = await api.get<unknown>('/v1/platform/feature-flags');

        if (!ignore) {
          setFlags(normalizeFeatureFlags(response));
        }
      } catch {
        if (!ignore) {
          setFlags({ ...FEATURE_FLAG_DEFAULTS });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchFeatureFlags();

    return () => {
      ignore = true;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  const value = useMemo(
    () => ({
      flags,
      loading,
    }),
    [flags, loading],
  );

  return createElement(FeatureFlagsContext.Provider, { value }, children);
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }

  return context;
}

export function useFeatureFlag(key: string) {
  const { flags } = useFeatureFlags();
  return Boolean(flags[key]);
}
