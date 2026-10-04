import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { PayoutsPanel } from '../components/PayoutsPanel';
import { PayoutDesk } from '../components/PayoutDesk';

// F2 (#78): the seller sees what they are owed — worded as owed until it is sent
// (E1) — and an admin works the queue. The server decides who is an admin.

const GOOD = 'GAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCF6M';
const res = (body: unknown, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body }) as unknown as Response;
const mine = (over: Record<string, unknown> = {}) => ({
  payouts: {
    wallet_address: null, direct: false, owed: '10', sent: '2.5',
    payouts: [
      { id: 'a', source: 'order', status: 'OWED', amount: '10', tx_id: null },
      { id: 'b', source: 'asset_listing', status: 'SENT', amount: '2.5', tx_id: 'f'.repeat(64) },
    ],
    ...over,
  },
});

describe('PayoutsPanel (seller)', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => vi.restoreAllMocks());

  it('shows what is owed and what was sent — an unsent payout never reads as paid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(mine())));
    render(<PayoutsPanel />);
    await waitFor(() => expect(screen.getAllByText('10π').length).toBe(2)); // the total and the row
    expect(screen.getAllByText('Owed · not sent yet').length).toBeGreaterThan(0);
    expect(screen.getByText('NFT sale')).toBeTruthy();
    expect(screen.queryByText(/^Paid$/)).toBeNull();
  });

  it('asks for an address when money is owed and there is none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(mine())));
    render(<PayoutsPanel />);
    await waitFor(() => expect(screen.getByText('Add your Pi wallet address to get paid')).toBeTruthy());
    expect(screen.getByText(/Never your passphrase or secret key/)).toBeTruthy();
  });

  it('saves the address with PUT, and shows the server\'s checksum message when it refuses', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(mine()))
      .mockResolvedValueOnce(res({ message: 'That address has a typo — it fails its own checksum.' }, false));
    vi.stubGlobal('fetch', f);
    render(<PayoutsPanel />);
    const input = await screen.findByLabelText('Pi wallet address');
    fireEvent.change(input, { target: { value: GOOD } });
    fireEvent.click(screen.getByText('Save address'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/typo/));
    expect(f.mock.calls[1][0]).toBe('/api/bff/commerce/payouts/address');
    expect((f.mock.calls[1][1] as RequestInit).method).toBe('PUT');
    expect(JSON.parse(String((f.mock.calls[1][1] as RequestInit).body))).toEqual({ wallet_address: GOOD });
  });

  it('an admin whose sales settle directly is told nothing is owed to them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(mine({ direct: true, payouts: [] }))));
    render(<PayoutsPanel />);
    await waitFor(() => expect(screen.getByText(/settle directly into your own wallet/)).toBeTruthy());
  });

  it('a failed read leaves the tab as it was', async () => {
    const f = vi.fn(async () => res(null, false, 500));
    vi.stubGlobal('fetch', f);
    const { container } = render(<PayoutsPanel />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('PayoutDesk (admin)', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => vi.restoreAllMocks());

  const row = { id: '11111111-2222-4333-8444-555555555555', source: 'order', seller_id: 's1', pi_username: 'sel', amount: '10', status: 'OWED', wallet_address: GOOD, sold_at: '2026-10-04T10:00:00Z', tx_id: null };

  it('shows nothing to a non-admin (the queue answers 403)', async () => {
    const f = vi.fn(async () => res({ message: 'Admin only' }, false, 403));
    vi.stubGlobal('fetch', f);
    const { container } = render(<PayoutDesk />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('lists who is owed, how much and where', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ payouts: [row] })));
    render(<PayoutDesk />);
    await waitFor(() => expect(screen.getByText('@sel')).toBeTruthy());
    expect(screen.getByText('10π')).toBeTruthy();
    expect(screen.getByLabelText('Copy address').textContent).toContain(GOOD);
  });

  it('Mark sent posts the hash; a chain refusal is shown word for word', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res({ payouts: [row] }))
      .mockResolvedValueOnce(res({ message: 'This transaction pays a different address. Nothing was recorded.' }, false));
    vi.stubGlobal('fetch', f);
    render(<PayoutDesk />);
    fireEvent.change(await screen.findByLabelText('Transaction hash'), { target: { value: 'a'.repeat(64) } });
    fireEvent.click(screen.getByText('Mark sent'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/different address/));
    expect(f.mock.calls[1][0]).toBe(`/api/bff/commerce/payouts/${row.id}/sent`);
  });

  it('a seller with no address cannot be marked sent — there is no field to do it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ payouts: [{ ...row, wallet_address: null }] })));
    render(<PayoutDesk />);
    await waitFor(() => expect(screen.getByText(/No payout address yet/)).toBeTruthy());
    expect(screen.queryByText('Mark sent')).toBeNull();
  });

  it('"my own sales settle" updates "Your payouts" at once, without a reload', async () => {
    const f = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/queue')) return res({ payouts: [] });
      if (u.endsWith('/direct')) return res({ settled: 0 });
      return res(mine({ direct: f.mock.calls.some((c) => String(c[0]).endsWith('/direct')), payouts: [] }));
    });
    vi.stubGlobal('fetch', f);
    vi.stubGlobal('confirm', () => true);
    render(<><PayoutDesk /><PayoutsPanel /></>);
    fireEvent.click(await screen.findByText('My own sales settle into my wallet'));
    await waitFor(() => expect(screen.getByText(/settle directly into your own wallet/)).toBeTruthy());
    expect(screen.getByText(/Done — your own sales settle into your wallet from now on/)).toBeTruthy();
  });
});
