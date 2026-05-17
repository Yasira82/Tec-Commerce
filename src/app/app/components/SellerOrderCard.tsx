'use client';

import { useState }                  from 'react';
import { Order, OrderTimelineEvent } from '../types';

interface Props {
  order:     Order;
  onUpdate:  (orderId: string, status: string, note?: string) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#f59e0b', icon: '⏳' },
  confirmed: { label: 'Confirmed', color: '#3b82f6', icon: '✓'  },
  shipped:   { label: 'Shipped',   color: '#06b6d4', icon: '🚚' },
  delivered: { label: 'Delivered', color: '#10b981', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#ef4444', icon: '❌' },
  refunded:  { label: 'Refunded',  color: '#f97316', icon: '↩️' },
};

const NEXT_STATUS: Record<string, { status: string; label: string; icon: string }[]> = {
  pending:   [
    { status: 'confirmed', label: 'Confirm Order', icon: '✓'  },
    { status: 'cancelled', label: 'Cancel Order',  icon: '❌' },
  ],
  confirmed: [
    { status: 'shipped',   label: 'Mark Shipped',  icon: '🚚' },
    { status: 'cancelled', label: 'Cancel Order',  icon: '❌' },
  ],
  shipped: [
    { status: 'delivered', label: 'Mark Delivered', icon: '✅' },
  ],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ContactItem({ icon, value }: { icon: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(value).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  });
  return (
    <button onClick={copy}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: copied ? 'rgba(16,185,129,0.08)' : '#ffffff06', border: `1px solid ${copied ? 'rgba(16,185,129,0.25)' : '#ffffff10'}`, borderRadius: 10, color: copied ? '#10b981' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <span>{icon}</span>
      <span style={{ flex: 1 }}>{copied ? 'Copied!' : value}</span>
      <span style={{ fontSize: 9, color: '#4a4a5a' }}>{copied ? '✓' : 'Copy'}</span>
    </button>
  );
}

export function SellerOrderCard({ order, onUpdate }: Props) {
  const [expanded,  setExpanded]  = useState(false);
  const [updating,  setUpdating]  = useState<string | null>(null);
  const [note,      setNote]      = useState('');
  const [showNote,  setShowNote]  = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const lower   = order.status.toLowerCase();
  const cfg     = STATUS_CONFIG[lower] ?? STATUS_CONFIG.pending;
  const actions = NEXT_STATUS[lower] ?? [];
  const contact = order.product?.contact as { whatsapp?: string; telegram?: string; email?: string } | undefined;

  const handleUpdate = async (status: string) => {
    if (status === 'cancelled' || status === 'shipped') {
      setPendingStatus(status);
      setShowNote(true);
      return;
    }
    setUpdating(status);
    await onUpdate(order.id, status);
    setUpdating(null);
  };

  const confirmUpdate = async () => {
    if (!pendingStatus) return;
    setUpdating(pendingStatus);
    await onUpdate(order.id, pendingStatus, note || undefined);
    setUpdating(null);
    setShowNote(false);
    setPendingStatus(null);
    setNote('');
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg,#0f0f1a,#0a0a12)',
      border: `1px solid ${expanded ? `${cfg.color}30` : '#ffffff08'}`,
      borderRadius: 18, marginBottom: 12, overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────── */}
      <button onClick={() => setExpanded(p => !p)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
            <span style={{ fontSize: 11, color: '#6b6b7a', fontFamily: 'monospace' }}>
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, borderRadius: 20, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
              {cfg.label}
            </span>
            {actions.length > 0 && (
              <span style={{ fontSize: 9, color: '#d4af37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 20, padding: '3px 8px', fontWeight: 700 }}>
                Action needed
              </span>
            )}
            <span style={{ fontSize: 16, color: '#4a4a5a', display: 'inline-block', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>⌄</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {order.product?.title ?? 'Product'}
            </div>
            <div style={{ fontSize: 10, color: '#4a4a5a', marginTop: 2 }}>{formatDate(order.createdAt)}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#d4af37' }}>{order.total}π</div>
        </div>
      </button>

      {/* ── Expanded ───────────────────────────── */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>

          {/* Buyer Contact */}
          {contact && (contact.whatsapp || contact.telegram || contact.email) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Buyer Contact</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {contact.whatsapp && <ContactItem icon="💬" value={contact.whatsapp} />}
                {contact.telegram && <ContactItem icon="✈️" value={`@${contact.telegram}`} />}
                {contact.email    && <ContactItem icon="📧" value={contact.email} />}
              </div>
            </div>
          )}

          {/* Order Info */}
          <div style={{ background: '#ffffff04', border: '1px solid #ffffff08', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#6b6b7a' }}>Payment ID</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9a9aaa' }}>
                {order.payment_id ? order.payment_id.slice(0, 16) + '…' : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#6b6b7a' }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37' }}>{order.total}π</span>
            </div>
          </div>

          {/* Timeline */}
          {order.timeline && order.timeline.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...(order.timeline as OrderTimelineEvent[])].reverse().map((e, i) => {
                  const eCfg = STATUS_CONFIG[e.status.toLowerCase()] ?? STATUS_CONFIG.pending;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: eCfg.color, flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: eCfg.color }}>{eCfg.label}</div>
                        {e.note && <div style={{ fontSize: 10, color: '#6b6b7a' }}>{e.note}</div>}
                        {e.created_at && <div style={{ fontSize: 9, color: '#4a4a5a', marginTop: 1 }}>{formatDate(e.created_at)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note modal */}
          {showNote && (
            <div style={{ background: '#ffffff05', border: '1px solid #ffffff10', borderRadius: 12, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, marginBottom: 8 }}>
                {pendingStatus === 'cancelled' ? '❌ Cancel Order' : '🚚 Shipping Note'} (optional)
              </div>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder={pendingStatus === 'cancelled' ? 'Reason for cancellation...' : 'Tracking number or courier name...'}
                style={{ width: '100%', background: '#0a0a12', border: '1px solid #ffffff10', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowNote(false); setPendingStatus(null); setNote(''); }}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'transparent', border: '1px solid #ffffff15', color: '#6b6b7a', fontSize: 12, cursor: 'pointer' }}>
                  Back
                </button>
                <button onClick={confirmUpdate} disabled={!!updating}
                  style={{ flex: 2, padding: '9px', borderRadius: 10, background: pendingStatus === 'cancelled' ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#d4af37,#b8882a)', border: `1px solid ${pendingStatus === 'cancelled' ? 'rgba(239,68,68,0.3)' : 'transparent'}`, color: pendingStatus === 'cancelled' ? '#ef4444' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {updating ? '⏳ Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!showNote && actions.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {actions.map(action => (
                <button key={action.status} onClick={() => handleUpdate(action.status)}
                  disabled={!!updating}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 12, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    background: action.status === 'cancelled'
                      ? 'rgba(239,68,68,0.08)'
                      : 'linear-gradient(135deg,#d4af37,#b8882a)',
                    border: action.status === 'cancelled'
                      ? '1px solid rgba(239,68,68,0.2)'
                      : 'none',
                    color: action.status === 'cancelled' ? '#ef4444' : '#0a0800',
                    opacity: updating ? 0.6 : 1,
                  }}>
                  {updating === action.status ? '⏳' : action.icon} {action.label}
                </button>
              ))}
            </div>
          )}

          {actions.length === 0 && lower !== 'cancelled' && lower !== 'refunded' && (
            <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: '#10b981' }}>
              ✅ Order completed
            </div>
          )}
        </div>
      )}
    </div>
  );
          }
