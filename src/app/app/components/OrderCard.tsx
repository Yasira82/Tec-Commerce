'use client';

import { useState } from 'react';
import { Order, STATUS_COLORS } from '../types';

interface Props {
  order:      Order;
  onReview?:  (orderId: string, rating: number, comment: string) => void;
}

export function OrderCard({ order, onReview }: Props) {
  const [showReview, setShowReview] = useState(false);
  const [rating,     setRating]     = useState(5);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusColor = STATUS_COLORS[order.status] ?? '#4a4a5a';
  const canReview   = order.status === 'delivered' && !order.review;

  const handleReview = async () => {
    if (!onReview || !comment.trim()) return;
    setSubmitting(true);
    await onReview(order.id, rating, comment);
    setSubmitting(false);
    setShowReview(false);
  };

  return (
    <div style={{ background: '#0d0d14', border: '1px solid #ffffff08',
      borderRadius: 18, padding: '16px', marginBottom: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#4a4a5a', fontFamily: 'monospace' }}>
          #{order.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: statusColor,
          background: `${statusColor}15`, border: `1px solid ${statusColor}30`,
          borderRadius: 20, padding: '3px 12px' }}>
          {order.status.toUpperCase()}
        </div>
      </div>

      {/* Product Info */}
      {order.product && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12,
          background: '#ffffff05', borderRadius: 12, padding: '10px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: '#ffffff08',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
            {order.product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.product.images[0]} alt={order.product.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            ) : '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {order.product.title}
            </div>
            <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 2 }}>
              {order.product.category} · {order.product.condition}
            </div>
          </div>
        </div>
      )}

      {/* Total + Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#4a4a5a' }}>
          {new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>
          {order.total}π
        </div>
      </div>

      {/* Existing Review */}
      {order.review && (
        <div style={{ background: '#ffffff05', borderRadius: 12, padding: '10px', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ fontSize: 12, color: i <= order.review!.rating ? '#f0c040' : '#ffffff20' }}>★</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#6b6b7a' }}>{order.review.comment}</div>
        </div>
      )}

      {/* Review Button */}
      {canReview && !showReview && (
        <button onClick={() => setShowReview(true)}
          style={{ width: '100%', padding: '10px', borderRadius: 12,
            background: '#f0c04010', border: '1px solid #f0c04030',
            color: '#f0c040', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          ⭐ Leave a Review
        </button>
      )}

      {/* Review Form */}
      {showReview && (
        <div style={{ background: '#ffffff05', borderRadius: 12, padding: '14px' }}>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginBottom: 10 }}>Rate this product:</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => setRating(i)}
                style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer',
                  color: i <= rating ? '#f0c040' : '#ffffff20' }}>
                ★
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Share your experience..."
            style={{ width: '100%', background: '#0a0a12', border: '1px solid #ffffff10',
              borderRadius: 10, padding: '10px', color: '#fff', fontSize: 12,
              resize: 'none', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
            rows={3} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReview} disabled={submitting || !comment.trim()}
              style={{ flex: 1, padding: '10px', borderRadius: 10,
                background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                border: 'none', color: '#0a0800', fontWeight: 700,
                fontSize: 12, cursor: 'pointer' }}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button onClick={() => setShowReview(false)}
              style={{ padding: '10px 16px', borderRadius: 10,
                background: '#ffffff08', border: '1px solid #ffffff10',
                color: '#6b6b7a', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
