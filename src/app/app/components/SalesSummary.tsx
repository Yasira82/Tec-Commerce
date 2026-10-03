'use client';

import { useEffect, useState } from 'react';
import type { SalesSummary as Summary } from '@/app/api/bff/commerce/sales-summary/route';

// The seller's own numbers at the top of the Sales tab: what they earned, how many
// items and orders, and what sells. Counted by commerce-service from paid orders
// (PAID → DELIVERED) — a pending hold or a cancelled checkout is not a sale.
// Hidden while loading and when there is nothing to show; the order list below
// stays the tab's job.

const pi = (v: string | number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0π';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}π`;
};

export function SalesSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/bff/commerce/sales-summary', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { summary?: Summary | null } | null) => { if (live) setSummary(d?.summary ?? null); })
      .catch(() => { /* the order list below still works */ });
    return () => { live = false; };
  }, [refreshKey]);

  if (!summary || summary.orderCount === 0) return null;

  const tile = (label: string, value: string) => (
    <div key={label} style={{ background: '#ffffff06', border: '1px solid #ffffff0a', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#FBBF24' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#6b6b7a', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  return (
    <section aria-label="Your sales" style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {tile('Earned', pi(summary.totalRevenue))}
        {tile('Items sold', String(summary.totalItemsSold))}
        {tile('Orders', String(summary.orderCount))}
      </div>
      {summary.topProducts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            BEST SELLERS
          </div>
          {summary.topProducts.map((p, i) => (
            <div key={p.productId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #ffffff06' }}>
              <span style={{ width: 18, fontSize: 11, color: '#6b6b7a', fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
              <span style={{ fontSize: 11, color: '#6b6b7a' }}>×{p.itemsSold}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24', minWidth: 52, textAlign: 'right' }}>{pi(p.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
