'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MyPayouts, Payout } from '@/lib/bff/payouts';

// What the seller is owed for their sales, and where they get paid (F2, #78).
//
// A buyer's π lands in the app's wallet; what the seller is owed is recorded the
// moment the sale is paid, and sent to the address below. Until it is sent it says
// so — "owed, not sent yet" — and never "paid" (E1: an unconfirmed thing is never
// worded as done). The address is checked by its own checksum on the server: one
// wrong character would send the Pi to a stranger.

const pi = (v: string | number) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('en-US', { maximumFractionDigits: 8 })}π` : '—';
};
// The double-submit token (middleware.ts): Pi Browser may send no Origin, and then
// this header is what lets a legitimate same-origin write through.
const csrf = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s);
const what = (p: Payout) => (p.source === 'asset_listing' ? 'NFT sale' : 'Order');

/** The admin desk changes what this panel shows (Direct, Mark sent) — it says so with this event. */
export const PAYOUTS_CHANGED = 'tec-payouts-changed';

const STATUS: Record<Payout['status'], { label: string; color: string }> = {
  OWED:   { label: 'Owed · not sent yet', color: '#FBBF24' },
  SENT:   { label: 'Sent',                color: '#22C55E' },
  DIRECT: { label: 'Settled to your wallet', color: '#8b8b9a' },
};

export function PayoutsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData]       = useState<MyPayouts | null>(null);
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(() => {
    fetch('/api/bff/commerce/payouts', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { payouts?: MyPayouts } | null) => setData(d?.payouts ?? null))
      .catch(() => { /* the rest of the Sales tab still works */ });
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    window.addEventListener(PAYOUTS_CHANGED, load);
    return () => window.removeEventListener(PAYOUTS_CHANGED, load);
  }, [load]);

  if (!data) return null;

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/bff/commerce/payouts/address', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ wallet_address: address.trim() }),
      });
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) { setError(body.message || 'That address could not be saved.'); return; }
      setEditing(false); setAddress(''); load();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const needsAddress = !data.wallet_address && !data.direct;
  const owedNow = Number(data.owed) > 0;
  const card = { background: '#ffffff06', border: '1px solid #ffffff0a', borderRadius: 12, padding: 12, marginBottom: 12 } as const;

  return (
    <section aria-label="Your payouts" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        YOUR PAYOUTS
      </div>

      {data.direct ? (
        <div style={{ ...card, fontSize: 12, color: '#8b8b9a' }}>Your sales settle directly into your own wallet — nothing is owed to you.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FBBF24' }}>{pi(data.owed)}</div>
            <div style={{ fontSize: 9, color: '#6b6b7a', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>Owed · not sent yet</div>
          </div>
          <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#22C55E' }}>{pi(data.sent)}</div>
            <div style={{ fontSize: 9, color: '#6b6b7a', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>Sent to you</div>
          </div>
        </div>
      )}

      {!data.direct && (
        <div style={card}>
          {data.wallet_address && !editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#6b6b7a' }}>Paid to</div>
                <div style={{ fontSize: 13, color: '#e8e8f0', fontFamily: 'monospace' }}>{short(data.wallet_address)}</div>
              </div>
              <button onClick={() => { setEditing(true); setError(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #ffffff1a', color: '#c8c8d4', fontSize: 12, cursor: 'pointer' }}>
                Change
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: '#e8e8f0', fontWeight: 700, marginBottom: 4 }}>
                {needsAddress && owedNow ? 'Add your Pi wallet address to get paid' : 'Your Pi wallet address'}
              </div>
              <div style={{ fontSize: 11, color: '#6b6b7a', marginBottom: 8 }}>
                The public address that starts with G — copy it from your wallet. Never your passphrase or secret key.
              </div>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="G…" aria-label="Pi wallet address"
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0b0b12', border: '1px solid #ffffff1a', color: '#e8e8f0', fontFamily: 'monospace', fontSize: 12 }} />
              {error && <div role="alert" style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={save} disabled={saving || !address.trim()}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer', opacity: saving || !address.trim() ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save address'}
                </button>
                {data.wallet_address && (
                  <button onClick={() => { setEditing(false); setAddress(''); setError(''); }}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', border: '1px solid #ffffff1a', color: '#c8c8d4', cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {data.payouts.slice(0, 10).map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #ffffff06' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#e8e8f0' }}>{what(p)}</div>
            <div style={{ fontSize: 11, color: STATUS[p.status]?.color ?? '#8b8b9a' }}>
              {STATUS[p.status]?.label ?? p.status}{p.status === 'SENT' && p.tx_id ? ` · tx ${short(p.tx_id)}` : ''}
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0' }}>{pi(p.amount)}</span>
        </div>
      ))}
    </section>
  );
}
