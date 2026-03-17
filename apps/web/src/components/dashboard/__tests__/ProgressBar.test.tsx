import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders label and percentage', () => {
    render(<ProgressBar label="Team Compliance" current={30} total={40} />);

    expect(screen.getByText('Team Compliance')).toBeInTheDocument();
    expect(screen.getByText(/30\/40.*75%/)).toBeInTheDocument();
  });

  it('renders with unit label', () => {
    render(<ProgressBar label="Assignments" current={5} total={10} unit="tasks" />);

    expect(screen.getByText(/5\/10 tasks.*50%/)).toBeInTheDocument();
  });

  it('shows 0% when total is 0', () => {
    render(<ProgressBar label="Empty" current={0} total={0} />);

    expect(screen.getByText(/0\/0.*0%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('caps percentage at 100', () => {
    render(<ProgressBar label="Over" current={15} total={10} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('sets correct aria attributes on progressbar', () => {
    render(<ProgressBar label="Progress" current={7} total={10} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '70');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders the fill bar with correct width', () => {
    const { container } = render(<ProgressBar label="Fill" current={3} total={4} />);

    const fill = container.querySelector('.mgr-progress__fill');
    expect(fill).not.toBeNull();
    expect((fill as HTMLElement).style.width).toBe('75%');
  });
});
