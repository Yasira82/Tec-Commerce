import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SalesSummary } from '../components/SalesSummary';

// Merchant analytics inside Commerce (C-105 §11 P1-2): the seller's own numbers on
// the Sales tab. Money arrives as DECIMAL strings and is shown, never re-summed here.

const summary = {
  totalRevenue: '42.00000000', totalItemsSold: 5, orderCount: 4,
  topProducts: [
    { productId: 'p1', title: 'Charger 45W', revenue: '25.00000000', itemsSold: 1 },
    { productId: 'p2', title: 'Cap', revenue: '12.00000000', itemsSold: 1 },
  ],
  recentSales: [],
};

const answer = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe('SalesSummary', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => vi.restoreAllMocks());

  it('shows what the seller earned, sold, and their best sellers', async () => {
    vi.stubGlobal('fetch', answer({ summary }));
    render(<SalesSummary />);
    await waitFor(() => expect(screen.getByText('42π')).toBeTruthy());
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Charger 45W')).toBeTruthy();
    expect(screen.getByText('25π')).toBeTruthy();
  });

  it('shows nothing before the first sale', async () => {
    const f = answer({ summary: { ...summary, orderCount: 0, topProducts: [] } });
    vi.stubGlobal('fetch', f);
    const { container } = render(<SalesSummary />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('a failed read leaves the tab as it was — no error, no zeros', async () => {
    const f = answer(null, false);
    vi.stubGlobal('fetch', f);
    const { container } = render(<SalesSummary />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
