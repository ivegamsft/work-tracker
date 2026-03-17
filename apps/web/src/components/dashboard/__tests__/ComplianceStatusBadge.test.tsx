import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComplianceStatusBadge from '../ComplianceStatusBadge';

describe('ComplianceStatusBadge', () => {
  it('renders compliant badge with default label', () => {
    render(<ComplianceStatusBadge status="compliant" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Compliant');
    expect(badge.className).toContain('mgr-compliance-badge--compliant');
  });

  it('renders at_risk badge with default label', () => {
    render(<ComplianceStatusBadge status="at_risk" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('At Risk');
    expect(badge.className).toContain('mgr-compliance-badge--at-risk');
  });

  it('renders non_compliant badge with default label', () => {
    render(<ComplianceStatusBadge status="non_compliant" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Non-Compliant');
    expect(badge.className).toContain('mgr-compliance-badge--non-compliant');
  });

  it('uses custom label when provided', () => {
    render(<ComplianceStatusBadge status="compliant" label="All Clear" />);

    expect(screen.getByRole('status')).toHaveTextContent('All Clear');
  });
});
