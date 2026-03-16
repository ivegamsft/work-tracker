import type { ReactNode } from 'react';
import { useFeatureFlag, useFeatureFlags } from '../hooks/useFeatureFlags';

interface FeatureGateProps {
  flag: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export default function FeatureGate({ flag, fallback = null, children }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);
  const { loading } = useFeatureFlags();

  if (loading) {
    return null;
  }

  return enabled ? <>{children}</> : <>{fallback}</>;
}
