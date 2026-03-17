import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Team Members" value={42} />);

    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard label="Compliant" value={30} subtitle="71% of team" />);

    expect(screen.getByText('71% of team')).toBeInTheDocument();
  });

  it('does not render subtitle when omitted', () => {
    const { container } = render(<StatCard label="Total" value={10} />);

    expect(container.querySelector('.mgr-stat-card__subtitle')).toBeNull();
  });

  it('applies healthy tone class', () => {
    render(<StatCard label="Compliant" value={10} tone="healthy" />);

    const card = screen.getByRole('group', { name: 'Compliant' });
    expect(card.className).toContain('mgr-stat-card--healthy');
  });

  it('applies warning tone class', () => {
    render(<StatCard label="At Risk" value={5} tone="warning" />);

    const card = screen.getByRole('group', { name: 'At Risk' });
    expect(card.className).toContain('mgr-stat-card--warning');
  });

  it('applies critical tone class', () => {
    render(<StatCard label="Non-Compliant" value={3} tone="critical" />);

    const card = screen.getByRole('group', { name: 'Non-Compliant' });
    expect(card.className).toContain('mgr-stat-card--critical');
  });

  it('defaults to neutral tone', () => {
    render(<StatCard label="Total" value={100} />);

    const card = screen.getByRole('group', { name: 'Total' });
    expect(card.className).toContain('mgr-stat-card--neutral');
  });

  it('accepts string values', () => {
    render(<StatCard label="Score" value="95%" />);

    expect(screen.getByText('95%')).toBeInTheDocument();
  });
});
