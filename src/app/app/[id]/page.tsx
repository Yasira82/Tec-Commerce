'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter }             from 'next/navigation';
import { Product, CATEGORY_ICONS, ProductCategory } from '../types';

const HUB_URL      = process.env.NEXT_PUBLIC_HUB_URL      ?? 'https://hub.tecosystem.app';
const COMMERCE_URL = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://commerce.tecosystem.app';

const getToken = () =>
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? '';

// ── Star Rating ────────────────────────────────────────────────
function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ fontSize: 14, color: i <= Math.round(rating) ? '#f0c040' : '#ffffff15' }}>★</span>
        ))}
      </div>
      <span style={{ fontSize: 12, color: '#6b6b7a' }}>{rating.toFixed(1)} ({count} reviews)</span>
    </div>
  );
}

// ── Gallery ────────────────────────────────────────────────────
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) return (
    <div style={{ height: 280, background: 'linear-gradient(135deg,#0f0f1a,#1a1208)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{ fontSize: 56, opacity: 0.3 }}>🛒</span>
      <span style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 1 }}>No image</span>
    </div>
  );
  return (
    <div style={{ position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[idx]} alt={title} style={{ width: '100%', height: 300, objectFit: 'cover', display: 'block' }} />
      {images.length > 1 && (
        <>
          <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#FBBF24' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
            ))}
          </div>
          {idx > 0 && (
            <button onClick={() => setIdx(p => p - 1)}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ‹
            </button>
          )}
          {idx < images.length - 1 && (
            <button onClick={() => setIdx(p => p + 1)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ›
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', background: '#0B1020' }}>
            {images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" onClick={() => setIdx(i)}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `2px solid ${i === idx ? '#FBBF24' : 'transparent'}`, cursor: 'pointer', transition: 'border-color 0.2s' }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Info Row ───────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #ffffff08' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#6b6b7a', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

// ── Pi Browser Safe Contact ────────────────────────────────────
function ContactItem({ icon, value }: { icon: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleTap = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button onClick={handleTap}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: copied ? 'rgba(16,185,129,0.08)' : '#ffffff06', border: `1px solid ${copied ? 'rgba(16,185,129,0.25)' : '#ffffff10'}`, borderRadius: 12, color: copied ? '#10b981' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copied ? 'Copied to clipboard!' : value}
      </span>
      <span style={{ fontSize: 10, color: copied ? '#10b981' : '#4a4a5a', flexShrink: 0 }}>
        {copied ? '✓' : 'Copy'}
      </span>
    </button>
  );
}

// ── Skeleton ───────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ height: 280, background: '#0f0f1a', marginBottom: 16 }} />
      {[['60%', 24], ['40%', 18], ['100%', 14], ['80%', 14]].map(([w, h], i) => (
        <div key={i} style={{ width: w, height: Number(h), borderRadius: 8, background: 'linear-gradient(90deg,#ffffff06,#ffffff10,#ffffff06)', marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [product,  setProduct]  = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [buying,   setBuying]   = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/bff/commerce/products/${id}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();
      setProduct(data.product ?? null);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleBuy = () => {
    if (!product || !window.Pi) return;
    setBuying(true);
    const params = new URLSearchParams({
      pay:        '1',
      amount:     String(product.price),
      memo:       `Commerce: ${product.title}`,
      product_id: product.id,
      return_url: `${COMMERCE_URL}/app`,
      source:     'commerce',
    });
    window.location.href = `${HUB_URL}/hub?${params}`;
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080f', color: '#fff' }}><Skeleton /></div>
  );

  if (error || !product) return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <span style={{ fontSize: 48 }}>😕</span>
      <div style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>Product not found</div>
      <button onClick={() => router.back()}
        style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
        ← Go Back
      </button>
    </div>
  );

  const inStock   = product.stock > 0;
  const freeShip  = (product.shipping as { shippingCost: number }).shippingCost === 0;
  const shipping  = product.shipping as { country: string; city: string; shipsTo: string[]; shippingCost: number; estimatedDays: string };
  const contact   = product.contact  as { whatsapp?: string; telegram?: string; email?: string };
  const condColor = product.condition === 'new' ? '#10b981' : '#f59e0b';

  return (
    <div style={{ minHeight: '100vh', background: '#08080f', color: '#fff', paddingBottom: 100 }}>

      {/* ── Topbar ─────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,15,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: '#ffffff0a', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{product.title}</span>
        <button onClick={handleShare}
          style={{ width: 36, height: 36, borderRadius: '50%', background: '#ffffff0a', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↗</button>
      </div>

      {/* ── Gallery ────────────────────────────── */}
      <Gallery images={product.images} title={product.title} />

      <div style={{ padding: '20px 16px' }}>

        {/* ── Header ─────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: condColor, background: `${condColor}20`, border: `1px solid ${condColor}40`, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>
              {product.condition}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#6b6b7a', background: '#ffffff08', border: '1px solid #ffffff10', padding: '3px 10px', borderRadius: 20 }}>
              {CATEGORY_ICONS[product.category as ProductCategory]} {product.category}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.3, margin: '0 0 10px' }}>{product.title}</h1>
          <Stars rating={product.rating} count={product.reviewCount} />
        </div>

        {/* ── Price ──────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'linear-gradient(135deg,#1a1208,#0f0f1a)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Price</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#FBBF24', lineHeight: 1 }}>{product.price}π</div>
            <div style={{ fontSize: 11, color: freeShip ? '#10b981' : '#6b6b7a', marginTop: 4 }}>
              {freeShip ? '✓ Free shipping' : `+${shipping.shippingCost}π shipping`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Stock</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: inStock ? '#10b981' : '#ef4444' }}>{inStock ? product.stock : 'Out'}</div>
            <div style={{ fontSize: 10, color: inStock ? '#10b981' : '#ef4444' }}>{inStock ? 'available' : 'of stock'}</div>
          </div>
        </div>

        {/* ── Description ────────────────────────── */}
        {product.description && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Description</div>
            <div style={{ fontSize: 14, color: '#9a9aaa', lineHeight: 1.7 }}>{product.description}</div>
          </div>
        )}

        {/* ── Shipping ───────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Shipping</div>
          <div style={{ background: '#ffffff04', border: '1px solid #ffffff08', borderRadius: 14, overflow: 'hidden', padding: '0 14px' }}>
            <InfoRow icon="📍" label="Ships from"    value={`${shipping.city}, ${shipping.country}`} />
            <InfoRow icon="🚚" label="Estimated"     value={shipping.estimatedDays} />
            <InfoRow icon="💰" label="Shipping cost" value={freeShip ? 'Free' : `${shipping.shippingCost}π`} color={freeShip ? '#10b981' : undefined} />
            {shipping.shipsTo.length > 0 && (
              <InfoRow icon="🌍" label="Ships to" value={shipping.shipsTo.slice(0, 3).join(', ') + (shipping.shipsTo.length > 3 ? '…' : '')} />
            )}
          </div>
        </div>

        {/* ── Guarantees ─────────────────────────── */}
        {(product.warranty || product.returnPolicy) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {product.warranty && (
              <div style={{ flex: 1, padding: '12px', background: 'rgba(126,184,247,0.06)', border: '1px solid rgba(126,184,247,0.15)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>🛡️</div>
                <div style={{ fontSize: 10, color: '#7eb8f7', fontWeight: 600 }}>{product.warranty}</div>
              </div>
            )}
            {product.returnPolicy && (
              <div style={{ flex: 1, padding: '12px', background: 'rgba(179,157,219,0.06)', border: '1px solid rgba(179,157,219,0.15)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>↩️</div>
                <div style={{ fontSize: 10, color: '#b39ddb', fontWeight: 600 }}>{product.returnPolicy}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Seller Info ─────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowInfo(p => !p)}
            style={{ width: '100%', background: '#ffffff05', border: '1px solid #ffffff0a', borderRadius: 14, padding: '14px 16px', color: '#fff', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>👤 {product.sellerName ?? 'Seller Information'}</span>
            <span style={{ fontSize: 10, color: '#6b6b7a' }}>{showInfo ? '▲' : '▼'}</span>
          </button>

          {showInfo && (
            <div style={{ background: '#ffffff04', border: '1px solid #ffffff08', borderRadius: '0 0 14px 14px', padding: 16, marginTop: -1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ✅ Pi Browser safe — Copy بدل navigate */}
              {contact.whatsapp && (
                <ContactItem icon="💬" value={contact.whatsapp} />
              )}
              {contact.telegram && (
                <ContactItem icon="✈️" value={`@${contact.telegram}`} />
              )}
              {contact.email && (
                <ContactItem icon="📧" value={contact.email} />
              )}
              {!contact.whatsapp && !contact.telegram && !contact.email && (
                <div style={{ fontSize: 12, color: '#4a4a5a', textAlign: 'center' }}>No contact info provided</div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Sticky Buy Button ──────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'rgba(8,8,15,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid #ffffff08' }}>
        <button onClick={handleBuy} disabled={!inStock || buying}
          style={{ width: '100%', padding: '16px', borderRadius: 16, background: inStock ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#ffffff0a', border: 'none', color: inStock ? '#0a0800' : '#4a4a5a', fontSize: 16, fontWeight: 800, cursor: inStock ? 'pointer' : 'not-allowed', letterSpacing: 0.3 }}>
          {buying ? '⏳ Redirecting...' : inStock ? `Buy Now · ${product.price}π` : 'Out of Stock'}
        </button>
      </div>

    </div>
  );
                                         }
