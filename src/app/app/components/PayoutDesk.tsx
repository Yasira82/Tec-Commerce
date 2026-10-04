'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Payout } from '@/lib/bff/payouts';
import { PAYOUTS_CHANGED } from './PayoutsPanel';

// The admin's payout desk (F2, #78): who is owed, how much, and where to send it.
// Until TEC's own A2U wallet exists, a payout is sent by hand from a wallet and
// recorded here with its transaction hash; commerce-service records it only if the
// CHAIN confirms that hash paid this seller's address at least what is owed.
//
// Rendered only for an admin: the queue answers 403 to anyone else, and then this
// shows nothing at all — the server decides, never this component.

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

function Row({ p, onDone }: { p: Payout; onDone: () => void }) {
  const [hash, setHash]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const mark = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/bff/commerce/payouts/${p.id}/sent`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ tx_id: hash.trim() }),
      });
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) { setError(body.message || 'Not recorded.'); return; }
      window.dispatchEvent(new Event(PAYOUTS_CHANGED));
      onDone();
    } catch {
      setError('Could not reach the server. Nothing was recorded — try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!p.wallet_address) return;
    navigator.clipboard?.writeText(p.wallet_address).then(() => setCopied(true)).catch(() => undefined);
  };

  return (
    <div style={{ background: '#ffffff06', border: '1px solid #ffffff0a', borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13, color: '#e8e8f0', fontWeight: 700 }}>
          {p.pi_username ? `@${p.pi_username}` : `Seller ${short(p.seller_id)}`}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24' }}>{pi(p.amount)}</span>
      </div>
      <div style={{ fontSize: 11, color: '#6b6b7a', margin: '2px 0 8px' }}>
        {p.source === 'asset_listing' ? 'NFT sale' : 'Order'}{p.sold_at ? ` · ${new Date(p.sold_at).toLocaleDateString()}` : ''}
      </div>
      {p.wallet_address ? (
        <button onClick={copy} aria-label="Copy address"
          style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, background: '#0b0b12', border: '1px solid #ffffff1a', color: '#e8e8f0', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', cursor: 'pointer' }}>
          {p.wallet_address} {copied ? '· copied' : '· tap to copy'}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: '#EF4444' }}>No payout address yet — the seller has to add one before this can be sent.</div>
      )}
      {p.wallet_address && (
        <>
          <input value={hash} onChange={e => setHash(e.target.value)} placeholder="Transaction hash (64 characters)" aria-label="Transaction hash"
            autoCorrect="off" spellCheck={false}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0b0b12', border: '1px solid #ffffff1a', color: '#e8e8f0', fontFamily: 'monospace', fontSize: 11 }} />
          {error && <div role="alert" style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
          <button onClick={mark} disabled={busy || !hash.trim()}
            style={{ width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer', opacity: busy || !hash.trim() ? 0.6 : 1 }}>
            {busy ? 'Checking on the chain…' : 'Mark sent'}
          </button>
        </>
      )}
    </div>
  );
}

export function PayoutDesk() {
  const [rows, setRows]       = useState<Payout[] | null>(null);
  const [settling, setSettling] = useState(false);
  const [note, setNote]       = useState('');

  const load = useCallback(() => {
    fetch('/api/bff/commerce/payouts/queue?status=OWED', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { payouts?: Payout[] } | null) => setRows(d ? d.payouts ?? [] : null))
      .catch(() => setRows(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (rows === null) return null; // not an admin, or the desk is unreachable

  const settleMine = async () => {
    if (!window.confirm('Your own sales settle into your own wallet, so nothing is owed to you. Mark your own payouts as settled — now and from now on?')) return;
    setSettling(true); setNote('');
    try {
      const res = await fetch('/api/bff/commerce/payouts/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() }, body: '{}' });
      const body = await res.json().catch(() => ({})) as { settled?: number; message?: string };
      setNote(res.ok
        ? `Done — your own sales settle into your wallet from now on${body.settled ? ` (${body.settled} payout(s) marked settled)` : ''}.`
        : body.message || 'Not changed.');
      if (res.ok) window.dispatchEvent(new Event(PAYOUTS_CHANGED)); // "Your payouts" below updates now, not on reload
      load();
    } finally {
      setSettling(false);
    }
  };

  return (
    <section aria-label="Payouts to send" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        PAYOUTS TO SEND · ADMIN · {rows.length}
      </div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: '#6b6b7a', marginBottom: 8 }}>Nobody is owed anything right now.</div>}
      {rows.map(p => <Row key={p.id} p={p} onDone={load} />)}
      <button onClick={settleMine} disabled={settling}
        style={{ width: '100%', padding: '9px 0', borderRadius: 10, background: 'transparent', border: '1px solid #ffffff1a', color: '#c8c8d4', fontSize: 12, cursor: 'pointer' }}>
        My own sales settle into my wallet
      </button>
      {note && <div style={{ fontSize: 12, color: '#8b8b9a', marginTop: 6 }}>{note}</div>}
    </section>
  );
}
