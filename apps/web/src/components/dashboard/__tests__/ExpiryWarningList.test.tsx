import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExpiryWarningList from '../ExpiryWarningList';
import type { ExpiryItem } from '../ExpiryWarningList';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * DAY_IN_MS).toISOString();
}

const testItems: ExpiryItem[] = [
  { id: 'q1', name: 'Ramp Safety', employeeName: 'Alice', type: 'qualification', expiresAt: isoDaysFromNow(10) },
  { id: 'q2', name: 'Dangerous Goods', employeeName: 'Bob', type: 'qualification', expiresAt: isoDaysFromNow(45) },
  { id: 'm1', name: 'Annual Physical', employeeName: 'Charlie', type: 'medical', expiresAt: isoDaysFromNow(80) },
  { id: 'q3', name: 'Fire Safety', type: 'qualification', expiresAt: isoDaysFromNow(-5) },
  { id: 'q4', name: 'Far Future Cert', type: 'qualification', expiresAt: isoDaysFromNow(120) },
];

function renderList(items = testItems) {
  return render(
    <BrowserRouter>
      <ExpiryWarningList items={items} />
    </BrowserRouter>,
  );
}

describe('ExpiryWarningList', () => {
  it('renders the title', () => {
    renderList();

    expect(screen.getByRole('heading', { name: /expiring items/i })).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(
      <BrowserRouter>
        <ExpiryWarningList items={testItems} title="Watch List" />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: /watch list/i })).toBeInTheDocument();
  });

  it('shows empty state when no items expire within 90 days', () => {
    renderList([{ id: 'x', name: 'Far out', type: 'qualification', expiresAt: isoDaysFromNow(200) }]);

    expect(screen.getByText(/no items expiring within 90 days/i)).toBeInTheDocument();
  });

  it('renders bucket summary counts', () => {
    renderList();

    expect(screen.getByText(/2 within 30d/)).toBeInTheDocument();
    expect(screen.getByText(/1 within 60d/)).toBeInTheDocument();
    expect(screen.getByText(/1 within 90d/)).toBeInTheDocument();
  });

  it('does not include items beyond 90 days', () => {
    renderList();

    expect(screen.queryByText('Far Future Cert')).not.toBeInTheDocument();
  });

  it('renders overdue items with Overdue label', () => {
    renderList();

    expect(screen.getByText('Fire Safety')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows employee name when available', () => {
    renderList();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows item type labels', () => {
    renderList();

    expect(screen.getAllByText('Qualification').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medical Clearance').length).toBeGreaterThan(0);
  });

  it('sorts items by urgency (earliest first)', () => {
    renderList();

    const lists = screen.getAllByRole('list');
    const allItems = lists.flatMap((list) => within(list).queryAllByRole('listitem'));
    const names = allItems.map((li) => li.textContent ?? '');

    // Fire Safety (overdue) should appear before Ramp Safety (10d)
    const fireSafetyIndex = names.findIndex((t) => t?.includes('Fire Safety'));
    const rampSafetyIndex = names.findIndex((t) => t?.includes('Ramp Safety'));
    expect(fireSafetyIndex).toBeLessThan(rampSafetyIndex);
  });
});
