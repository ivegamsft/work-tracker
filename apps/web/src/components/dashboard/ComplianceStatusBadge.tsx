import type { ComplianceStatus } from '../../types/my-section';

export interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  label?: string;
}

const STATUS_CONFIG: Record<ComplianceStatus, { className: string; defaultLabel: string }> = {
  compliant: { className: 'mgr-compliance-badge mgr-compliance-badge--compliant', defaultLabel: 'Compliant' },
  at_risk: { className: 'mgr-compliance-badge mgr-compliance-badge--at-risk', defaultLabel: 'At Risk' },
  non_compliant: { className: 'mgr-compliance-badge mgr-compliance-badge--non-compliant', defaultLabel: 'Non-Compliant' },
};

export default function ComplianceStatusBadge({ status, label }: ComplianceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.non_compliant;

  return (
    <span className={config.className} role="status">
      {label ?? config.defaultLabel}
    </span>
  );
}
