// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProofList from '../../apps/web/src/components/ProofList';
import type { ProofListItem } from '../../apps/web/src/components/ProofCard';

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
}

function getRelativeExpiry(days: number) {
  if (days === 0) {
    return 'Expires today';
  }

  if (days > 0) {
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }

  const elapsed = Math.abs(days);
  return `Expired ${elapsed} day${elapsed === 1 ? '' : 's'} ago`;
}

afterEach(() => {
  cleanup();
});

const today = new Date();
const proofs: ProofListItem[] = [
  {
    id: 'proof-active',
    name: 'Annual Flight Certification',
    status: 'compliant',
    issuer: 'FAA',
    standardName: 'Flight Operations',
    expiresAt: addDays(today, 45),
    requirementsMet: 9,
    requirementsTotal: 10,
    documentCount: 2,
    hasEvidence: true,
  },
  {
    id: 'proof-expiring',
    name: 'Hazmat Handling License',
    status: 'expiring_soon',
    issuer: 'DOT',
    standardName: 'Hazmat Program',
    expiresAt: addDays(today, 7),
    requirementsMet: 3,
    requirementsTotal: 5,
    documentCount: 0,
    hasEvidence: false,
  },
  {
    id: 'proof-expired',
    name: 'Respirator Fit Test',
    status: 'expired',
    issuer: 'Safety Board',
    standardName: 'PPE Standard',
    expiresAt: addDays(today, -3),
    requirementsMet: 1,
    requirementsTotal: 4,
    documentCount: 0,
    hasEvidence: false,
  },
];

describe('Proof list E2E', () => {
  it('renders filter tabs and proof card details', () => {
    render(<ProofList proofs={proofs} title="Proof Vault" />);

    expect(screen.getByRole('heading', { name: 'Proof Vault' })).toBeInTheDocument();
    expect(screen.getByText('3 qualifications')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Expiring Soon' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Expired' })).toBeInTheDocument();

    const compliantCard = screen.getByText('Annual Flight Certification').closest('.proof-card');
    expect(compliantCard).not.toBeNull();

    const card = within(compliantCard as HTMLElement);
    expect(card.getByText('Flight Operations · Issued by FAA')).toBeInTheDocument();
    expect(card.getByText('9/10 requirements met')).toBeInTheDocument();
    expect(card.getByText(getRelativeExpiry(45))).toBeInTheDocument();
    expect(card.getByText('📎 2 files attached')).toBeInTheDocument();
  });

  it('filters proofs by active, expiring, and expired tabs', async () => {
    const user = userEvent.setup();
    render(<ProofList proofs={proofs} />);

    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(screen.getByText('Annual Flight Certification')).toBeInTheDocument();
    expect(screen.queryByText('Hazmat Handling License')).not.toBeInTheDocument();
    expect(screen.queryByText('Respirator Fit Test')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Expiring Soon' }));
    expect(screen.queryByText('Annual Flight Certification')).not.toBeInTheDocument();
    expect(screen.getByText('Hazmat Handling License')).toBeInTheDocument();
    expect(screen.queryByText('Respirator Fit Test')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Expired' }));
    expect(screen.queryByText('Annual Flight Certification')).not.toBeInTheDocument();
    expect(screen.queryByText('Hazmat Handling License')).not.toBeInTheDocument();
    expect(screen.getByText('Respirator Fit Test')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'All' }));
    expect(screen.getByText('Annual Flight Certification')).toBeInTheDocument();
    expect(screen.getByText('Hazmat Handling License')).toBeInTheDocument();
    expect(screen.getByText('Respirator Fit Test')).toBeInTheDocument();
  });

  it('applies success, warning, and danger color coding to proof cards', () => {
    render(<ProofList proofs={proofs} />);

    const compliantCard = screen.getByText('Annual Flight Certification').closest('.proof-card');
    const expiringCard = screen.getByText('Hazmat Handling License').closest('.proof-card');
    const expiredCard = screen.getByText('Respirator Fit Test').closest('.proof-card');

    expect(compliantCard).toHaveClass('proof-card--success');
    expect(within(compliantCard as HTMLElement).getByText('Compliant')).toBeInTheDocument();

    expect(expiringCard).toHaveClass('proof-card--warning');
    expect(within(expiringCard as HTMLElement).getByText('Expiring soon')).toBeInTheDocument();

    expect(expiredCard).toHaveClass('proof-card--danger');
    expect(within(expiredCard as HTMLElement).getByText('Expired')).toBeInTheDocument();
  });

  it('shows upload indicators and Add New visibility based on view context', () => {
    const { rerender } = render(
      <ProofList proofs={proofs} canCreate={true} isOwnProfile={true} onAddNew={() => undefined} />,
    );

    expect(screen.queryByRole('button', { name: /add new/i })).not.toBeInTheDocument();

    const expiringCard = screen.getByText('Hazmat Handling License').closest('.proof-card');
    expect(within(expiringCard as HTMLElement).getByRole('button', { name: 'Upload' })).toBeInTheDocument();

    rerender(
      <ProofList proofs={proofs} canCreate={true} isOwnProfile={false} onAddNew={() => undefined} />,
    );

    expect(screen.getByRole('button', { name: /add new/i })).toBeVisible();
  });

  it('shows evidence missing when uploads are disabled and renders the empty state', () => {
    const { rerender } = render(<ProofList proofs={proofs} showUploadAction={false} />);

    expect(screen.getAllByText('Evidence missing')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();

    rerender(<ProofList proofs={[]} emptyMessage="No proofs on file yet." />);

    expect(screen.getByText('No proofs on file yet.')).toBeInTheDocument();
    expect(screen.queryByText('Annual Flight Certification')).not.toBeInTheDocument();
  });
});
