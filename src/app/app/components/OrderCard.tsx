'use client';

import { useState } from 'react';
import { Order }    from '../types';

interface Props {
  order:     Order;
  onReview?: (orderId: string, rating: number, comment: string) => void;
}

// ── Status config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', icon: '⏳', step: 0 },
  paid:       { label: 'Paid',       color: '#3b82f6', icon: '💳', step: 1 },
  processing: { label: 'Processing', color: '#8b5cf6', icon: '⚙️', step: 2 },
  shipped:    { label: 'Shipped',    color: '#06b6d4', icon: '🚚', step: 3 },
  delivered:  { label: 'Delivered',  color: '#10b981', icon: '✅', step: 4 },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', icon: '❌', step: -1 },
};

const TIMELINE_STEPS = [
  { key: 'pending',    label: 'Order Placed',  icon: '🛒' },
  { key: 'paid',       label: 'Payment',       icon: '💳' },
  { key: 'processing', label: 'Processing',    icon: '⚙️' },
  { key: 'shipped',    label: 'Shipped',       icon: '🚚' },
  { key: 'delivered',  label: 'Delivered',     icon: '✅' },
];

function formatDate(iso: string) {
  const d    = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hrs  <  1) return 'Just now';
  if (hrs  < 24) return `${hrs}h ago`;
  if (days <  7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Timeline ───────────────────────────────────────────────────
function OrderTimeline({ status }: { status: string }) {
  const lower       = status.toLowerCase();
  const isCancelled = lower === 'cancelled';
  const currentStep = STATUS_CONFIG[lower]?.step ?? 0;

  if (isCancelled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>❌</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Order Cancelled</div>
          <div style={{ fontSize: 10, color: '#6b6b7a' }}>This order has been cancelled</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done    = i <= currentStep;
          const current = i === currentStep;
          const color   = done ? STATUS_CONFIG[step.key]?.color ?? '#10b981' : '#2a2a3a';

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : 'none' }}>
              {/* Circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: current ? 32 : 24, height: current ? 32 : 24,
                  borderRadius: '50%', flexShrink: 0,
                  background: done ? `${color}20` : '#0f0f1a',
                  border: `2px solid ${done ? color : '#2a2a3a'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: current ? 14 : 10,
                  transition: 'all 0.3s ease',
                  boxShadow: current ? `0 0 12px ${color}40` : 'none',
                }}>
                  {done ? step.icon : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a2a3a', display: 'block' }} />}
                </div>
                <span style={{ fontSize: 8, color: done ? color : '#4a4a5a', fontWeight: done ? 700 : 400, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
                  {step.label}
                </span>
              </div>

              {/* Line */}
              {i < TIMELINE_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, marginBottom: 16, marginLeft: 2, marginRight: 2, background: i < currentStep ? '#10b98160' : '#1a1a2a', borderRadius: 1 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Review Form ────────────────────────────────────────────────
function ReviewForm({ onSubmit, onCancel }: {
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [rating,     setRating]     = useState(5);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    await onSubmit(rating, comment);
    setSubmitting(false);
  };

  return (
    <div style={{ background: '#ffffff05', border: '1px solid #ffffff08', borderRadius: 14, padding: '14px', marginTop: 10 }}>
      <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, marginBottom: 12 }}>Rate this product</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => setRating(i)}
            style={{ fontSize: 26, background: 'none', border: 'none', cursor: 'pointer', color: i <= rating ? '#f0c040' : '#ffffff20', transition: 'transform 0.1s', padding: 0 }}>
            ★
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)}
        placeholder="Share your experience with this product..."
        style={{ width: '100%', background: '#0a0a12', border: '1px solid #ffffff10', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, resize: 'none', outline: 'none', marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }}
        rows={3} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} disabled={submitting || !comment.trim()}
          style={{ flex: 1, padding: '11px', borderRadius: 10, background: !comment.trim() ? '#ffffff08' : 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: !comment.trim() ? '#4a4a5a' : '#0a0800', fontWeight: 700, fontSize: 12, cursor: !comment.trim() ? 'not-allowed' : 'pointer' }}>
          {submitting ? '⏳ Submitting...' : '⭐ Submit Review'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '11px 16px', borderRadius: 10, background: '#ffffff08', border: '1px solid #ffffff10', color: '#6b6b7a', fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export function OrderCard({ order, onReview }: Props) {
  const [expanded,   setExpanded]   = useState(false);
  const [showReview, setShowReview] = useState(false);

  const lower       = order.status.toLowerCase();
  const cfg         = STATUS_CONFIG[lower] ?? STATUS_CONFIG.pending;
  const canReview   = lower === 'delivered' && !order.review;

  const handleReview = async (rating: number, comment: string) => {
    if (!onReview) return;
    await onReview(order.id, rating, comment);
    setShowReview(false);
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg,#0f0f1a 0%,#0a0a12 100%)',
      border: `1px solid ${expanded ? `${cfg.color}30` : '#ffffff08'}`,
      borderRadius: 18, marginBottom: 12, overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>

      {/* ── Header (always visible) ─────────────── */}
      <button onClick={() => setExpanded(p => !p)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
            <div style={{ fontSize: 11, color: '#6b6b7a', fontFamily: 'monospace' }}>
              #{order.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, borderRadius: 20, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 16, color: '#4a4a5a', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
              ⌄
            </span>
          </div>
        </div>

        {/* Product preview */}
        {order.product && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ffffff08', overflow: 'hidden', flexShrink: 0 }}>
              {order.product.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {order.product.title}
              </div>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>{formatDate(order.createdAt)}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#d4af37', flexShrink: 0 }}>
              {order.total}π
            </div>
          </div>
        )}
      </button>

      {/* ── Expanded Content ────────────────────── */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>

          {/* Timeline */}
          <OrderTimeline status={order.status} />

          {/* Timeline events from backend */}
          {order.timeline && order.timeline.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...order.timeline].reverse().map((event: { status: string; note?: string; created_at?: string }, i: number) => {
                  const eCfg = STATUS_CONFIG[event.status.toLowerCase()] ?? STATUS_CONFIG.pending;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: eCfg.color, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: eCfg.color }}>{eCfg.label}</div>
                        {event.note && <div style={{ fontSize: 10, color: '#6b6b7a' }}>{event.note}</div>}
                        {event.created_at && <div style={{ fontSize: 9, color: '#4a4a5a', marginTop: 2 }}>{formatDate(event.created_at)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Review */}
          {order.review && (
            <div style={{ background: '#ffffff05', border: '1px solid rgba(240,192,64,0.15)', borderRadius: 12, padding: '12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Your Review</div>
              <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ fontSize: 14, color: i <= order.review!.rating ? '#f0c040' : '#ffffff15' }}>★</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#9a9aaa', lineHeight: 1.5 }}>{order.review.comment}</div>
            </div>
          )}

          {/* Review Button */}
          {canReview && !showReview && (
            <button onClick={() => setShowReview(true)}
              style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.2)', color: '#f0c040', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ⭐ Leave a Review
            </button>
          )}

          {showReview && (
            <ReviewForm onSubmit={handleReview} onCancel={() => setShowReview(false)} />
          )}
        </div>
      )}
    </div>
  );
                          }
