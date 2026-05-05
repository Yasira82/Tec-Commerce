'use client';

import { useState } from 'react';
import { Product, CATEGORY_ICONS, STATUS_COLORS } from '../types';

interface Props {
  product:  Product;
  onBuy:    (p: Product) => void;
  isMine:   boolean;
  onDelete: (id: string) => void;
  onEdit?:  (p: Product) => void;
}

const StarRating = ({ rating, count }: { rating: number; count: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ fontSize: 10, color: i <= Math.round(rating) ? '#f0c040' : '#ffffff20' }}>★</span>
    ))}
    <span style={{ fontSize: 10, color: '#4a4a5a' }}>({count})</span>
  </div>
);

export function ProductCard({ product, onBuy, isMine, onDelete, onEdit }: Props) {
  const [imgIdx,    setImgIdx]    = useState(0);
  const [showInfo,  setShowInfo]  = useState(false);

  const images = product.images?.length > 0 ? product.images : [];

  return (
    <div style={{
      background: '#0d0d14', border: '1px solid #d4af3720',
      borderRadius: 20, overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Image */}
      {images.length > 0 && (
        <div style={{ position: 'relative', height: 180, background: '#ffffff05' }}>
          <img src={images[imgIdx]} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', gap: 4 }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  style={{ width: i === imgIdx ? 16 : 6, height: 6, borderRadius: 3,
                    background: i === imgIdx ? '#d4af37' : '#ffffff40',
                    border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
              ))}
            </div>
          )}
          {/* Condition badge */}
          <div style={{ position: 'absolute', top: 8, left: 8,
            background: product.condition === 'new' ? '#7ee7c020' : '#f0c04020',
            border: `1px solid ${product.condition === 'new' ? '#7ee7c040' : '#f0c04040'}`,
            borderRadius: 20, padding: '2px 8px',
            fontSize: 9, fontWeight: 700,
            color: product.condition === 'new' ? '#7ee7c0' : '#f0c040',
            letterSpacing: 1, textTransform: 'uppercase' }}>
            {product.condition}
          </div>
          {/* Category badge */}
          <div style={{ position: 'absolute', top: 8, right: 8,
            background: '#00000060', borderRadius: 20, padding: '2px 8px',
            fontSize: 11 }}>
            {CATEGORY_ICONS[product.category]} {product.category}
          </div>
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        {/* Title + Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              {product.title}
            </div>
            <StarRating rating={product.rating} count={product.reviewCount} />
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#d4af37' }}>
              {product.price}π
            </div>
            {product.shipping.shippingCost > 0 && (
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>
                +{product.shipping.shippingCost}π shipping
              </div>
            )}
            {product.shipping.shippingCost === 0 && (
              <div style={{ fontSize: 10, color: '#7ee7c0' }}>Free shipping</div>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 12, color: '#6b6b7a', marginBottom: 10, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.description}
        </div>

        {/* Shipping + Stock */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4,
            background: '#ffffff06', borderRadius: 8, padding: '4px 8px' }}>
            <span style={{ fontSize: 10 }}>📍</span>
            <span style={{ fontSize: 10, color: '#6b6b7a' }}>{product.shipping.city}, {product.shipping.country}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4,
            background: '#ffffff06', borderRadius: 8, padding: '4px 8px' }}>
            <span style={{ fontSize: 10 }}>🚚</span>
            <span style={{ fontSize: 10, color: '#6b6b7a' }}>{product.shipping.estimatedDays}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4,
            background: product.stock > 0 ? '#7ee7c008' : '#e74c3c08',
            borderRadius: 8, padding: '4px 8px',
            border: `1px solid ${product.stock > 0 ? '#7ee7c020' : '#e74c3c20'}` }}>
            <span style={{ fontSize: 10, color: product.stock > 0 ? '#7ee7c0' : '#e74c3c' }}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>
        </div>

        {/* Warranty + Return */}
        {(product.warranty || product.returnPolicy) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {product.warranty && (
              <div style={{ fontSize: 10, color: '#7eb8f7', display: 'flex', gap: 4, alignItems: 'center' }}>
                <span>🛡️</span> {product.warranty}
              </div>
            )}
            {product.returnPolicy && (
              <div style={{ fontSize: 10, color: '#b39ddb', display: 'flex', gap: 4, alignItems: 'center' }}>
                <span>↩️</span> {product.returnPolicy}
              </div>
            )}
          </div>
        )}

        {/* Seller Info Toggle */}
        <button onClick={() => setShowInfo(p => !p)}
          style={{ width: '100%', background: '#ffffff05', border: '1px solid #ffffff08',
            borderRadius: 10, padding: '8px', color: '#6b6b7a', fontSize: 11,
            cursor: 'pointer', marginBottom: 10, textAlign: 'left' }}>
          {showInfo ? '▲' : '▼'} Seller info & contact
        </button>

        {showInfo && (
          <div style={{ background: '#ffffff05', borderRadius: 12, padding: '12px', marginBottom: 10 }}>
            {product.sellerName && (
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginBottom: 8 }}>
                👤 {product.sellerName}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {product.contact.whatsapp && (
                <a href={`https://wa.me/${product.contact.whatsapp}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: '#25d36620', border: '1px solid #25d36640',
                    borderRadius: 8, color: '#25d366', fontSize: 11, fontWeight: 600,
                    textDecoration: 'none' }}>
                  💬 WhatsApp
                </a>
              )}
              {product.contact.telegram && (
                <a href={`https://t.me/${product.contact.telegram}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: '#0088cc20', border: '1px solid #0088cc40',
                    borderRadius: 8, color: '#0088cc', fontSize: 11, fontWeight: 600,
                    textDecoration: 'none' }}>
                  ✈️ Telegram
                </a>
              )}
              {product.contact.email && (
                <a href={`mailto:${product.contact.email}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: '#ffffff08', border: '1px solid #ffffff15',
                    borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600,
                    textDecoration: 'none' }}>
                  📧 Email
                </a>
              )}
            </div>
            {product.shipping.shipsTo.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 10, color: '#4a4a5a' }}>
                Ships to: {product.shipping.shipsTo.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isMine ? (
            <>
              {onEdit && (
                <button onClick={() => onEdit(product)}
                  style={{ flex: 1, padding: '10px', borderRadius: 12,
                    background: '#7eb8f710', border: '1px solid #7eb8f730',
                    color: '#7eb8f7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
              )}
              <button onClick={() => onDelete(product.id)}
                style={{ flex: 1, padding: '10px', borderRadius: 12,
                  background: '#e74c3c10', border: '1px solid #e74c3c30',
                  color: '#e74c3c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑️ Delete
              </button>
            </>
          ) : (
            <button onClick={() => onBuy(product)} disabled={product.stock === 0}
              style={{ flex: 1, padding: '12px', borderRadius: 12,
                background: product.stock > 0
                  ? 'linear-gradient(135deg,#d4af37,#b8882a)'
                  : '#ffffff10',
                border: 'none',
                color: product.stock > 0 ? '#0a0800' : '#4a4a5a',
                fontSize: 14, fontWeight: 800,
                cursor: product.stock > 0 ? 'pointer' : 'not-allowed' }}>
              {product.stock > 0 ? `Buy for ${product.price}π` : 'Out of Stock'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
