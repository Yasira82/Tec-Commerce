'use client';

import { useState } from 'react';
import { Product, CATEGORY_ICONS } from '../types';

interface Props {
  product:  Product;
  onBuy:    (p: Product) => void;
  isMine:   boolean;
  onDelete: (id: string) => void;
  onEdit?:  (p: Product) => void;
}

const GOLD   = '#d4af37';
const GOLD_D = '#b8882a';

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 10, color: i <= Math.round(rating) ? '#f0c040' : '#ffffff15' }}>★</span>
      ))}
      <span style={{ fontSize: 10, color: '#4a4a5a' }}>({count})</span>
    </div>
  );
}

function ImagePlaceholder({ category }: { category: string }) {
  return (
    <div style={{ height: 180, background: 'linear-gradient(135deg,#0f0f1a,#1a1208)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{ fontSize: 40, filter: 'grayscale(0.3)' }}>{CATEGORY_ICONS[category] ?? '🛒'}</span>
      <span style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 1 }}>No image</span>
    </div>
  );
}

export function ProductCard({ product, onBuy, isMine, onDelete, onEdit }: Props) {
  const [imgIdx,   setImgIdx]   = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const images    = product.images?.length > 0 ? product.images : [];
  const inStock   = product.stock > 0;
  const freeShip  = product.shipping.shippingCost === 0;
  const condColor = product.condition === 'new' ? '#10b981' : '#f59e0b';

  return (
    <div style={{
      background: 'linear-gradient(180deg,#0f0f1a 0%,#0a0a12 100%)',
      border: `1px solid rgba(212,175,55,0.12)`,
      borderRadius: 20, overflow: 'hidden', marginBottom: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      transition: 'border-color 0.2s ease',
    }}>

      {/* ── Image ────────────────────────────────── */}
      {images.length > 0 ? (
        <div style={{ position: 'relative', height: 180 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[imgIdx]} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

          {/* Dots */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  style={{ width: i === imgIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? GOLD : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
              ))}
            </div>
          )}

          {/* Condition badge */}
          <div style={{ position: 'absolute', top: 10, left: 10, background: `${condColor}20`, border: `1px solid ${condColor}40`, borderRadius: 20, padding: '3px 10px', fontSize: 9, fontWeight: 700, color: condColor, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {product.condition}
          </div>

          {/* Category badge */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 10px', fontSize: 11 }}>
            {CATEGORY_ICONS[product.category]} <span style={{ fontSize: 9, color: '#6b6b7a', letterSpacing: 1 }}>{product.category}</span>
          </div>

          {/* Out of stock overlay */}
          {!inStock && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: 2, textTransform: 'uppercase', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 16px', borderRadius: 20 }}>Out of Stock</span>
            </div>
          )}
        </div>
      ) : (
        <ImagePlaceholder category={product.category} />
      )}

      <div style={{ padding: '14px 16px' }}>

        {/* ── Title + Price ─────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 5 }}>
              {product.title}
            </div>
            <StarRating rating={product.rating} count={product.reviewCount} />
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: GOLD, lineHeight: 1 }}>
              {product.price}π
            </div>
            <div style={{ fontSize: 10, marginTop: 3, color: freeShip ? '#10b981' : '#6b6b7a' }}>
              {freeShip ? '✓ Free shipping' : `+${product.shipping.shippingCost}π shipping`}
            </div>
          </div>
        </div>

        {/* ── Description ───────────────────────── */}
        {product.description && (
          <div style={{ fontSize: 12, color: '#5a5a6a', marginBottom: 12, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.description}
          </div>
        )}

        {/* ── Tags ──────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b6b7a', background: '#ffffff06', border: '1px solid #ffffff08', borderRadius: 8, padding: '3px 8px' }}>
            📍 {product.shipping.city}, {product.shipping.country}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b6b7a', background: '#ffffff06', border: '1px solid #ffffff08', borderRadius: 8, padding: '3px 8px' }}>
            🚚 {product.shipping.estimatedDays}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, background: inStock ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${inStock ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, padding: '3px 8px', color: inStock ? '#10b981' : '#ef4444' }}>
            {inStock ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>

        {/* ── Warranty + Return ─────────────────── */}
        {(product.warranty || product.returnPolicy) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {product.warranty && (
              <span style={{ fontSize: 10, color: '#7eb8f7', display: 'flex', gap: 4, alignItems: 'center' }}>
                🛡️ {product.warranty}
              </span>
            )}
            {product.returnPolicy && (
              <span style={{ fontSize: 10, color: '#b39ddb', display: 'flex', gap: 4, alignItems: 'center' }}>
                ↩️ {product.returnPolicy}
              </span>
            )}
          </div>
        )}

        {/* ── Seller Info Toggle ────────────────── */}
        <button onClick={() => setShowInfo(p => !p)}
          style={{ width: '100%', background: '#ffffff05', border: '1px solid #ffffff0a', borderRadius: 10, padding: '9px 12px', color: '#4a4a5a', fontSize: 11, cursor: 'pointer', marginBottom: 10, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>👤 {product.sellerName ?? 'Seller info'}</span>
          <span style={{ fontSize: 9 }}>{showInfo ? '▲' : '▼'}</span>
        </button>

        {showInfo && (
          <div style={{ background: '#ffffff04', border: '1px solid #ffffff08', borderRadius: 12, padding: '12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: product.shipping.shipsTo.length > 0 ? 10 : 0 }}>
              {product.contact.whatsapp && (
                <a href={`https://wa.me/${product.contact.whatsapp}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, color: '#25d366', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                  💬 WhatsApp
                </a>
              )}
              {product.contact.telegram && (
                <a href={`https://t.me/${product.contact.telegram}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(0,136,204,0.1)', border: '1px solid rgba(0,136,204,0.25)', borderRadius: 8, color: '#0088cc', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                  ✈️ Telegram
                </a>
              )}
              {product.contact.email && (
                <a href={`mailto:${product.contact.email}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#ffffff08', border: '1px solid #ffffff15', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                  📧 Email
                </a>
              )}
            </div>
            {product.shipping.shipsTo.length > 0 && (
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>
                Ships to: {product.shipping.shipsTo.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* ── Actions ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isMine ? (
            <>
              {onEdit && (
                <button data-testid={`edit-${product.id}`} onClick={() => onEdit(product)}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'rgba(126,184,247,0.08)', border: '1px solid rgba(126,184,247,0.2)', color: '#7eb8f7', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
              )}
              <button data-testid={`delete-${product.id}`} onClick={() => onDelete(product.id)}
                style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🗑️ Delete
              </button>
            </>
          ) : (
            <button data-testid={`buy-${product.id}`} onClick={() => onBuy(product)} disabled={!inStock}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: inStock ? `linear-gradient(135deg,${GOLD},${GOLD_D})` : '#ffffff0a', border: 'none', color: inStock ? '#0a0800' : '#4a4a5a', fontSize: 14, fontWeight: 800, cursor: inStock ? 'pointer' : 'not-allowed', letterSpacing: 0.3 }}>
              {inStock ? `Buy · ${product.price}π` : 'Out of Stock'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
