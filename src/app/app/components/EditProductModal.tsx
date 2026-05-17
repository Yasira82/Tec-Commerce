'use client';

import { useState, useRef } from 'react';
import { Product }          from '../types';

interface Props {
  product:   Product;
  onClose:   () => void;
  onSuccess: (updated: Product) => void;
}

const getCsrf  = () => document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
const getToken = () => document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? '';

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#ffffff08', border: '1px solid #ffffff10',
  borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 13,
  outline: 'none', marginBottom: 10, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: '#6b6b7a', letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 4, display: 'block',
};

export function EditProductModal({ product, onClose, onSuccess }: Props) {
  const shipping = product.shipping as {
    country?: string; city?: string; shipsTo?: string[];
    shippingCost?: number; estimatedDays?: string;
  };
  const contact = product.contact as {
    whatsapp?: string; telegram?: string; email?: string;
  };

  const [title,        setTitle]        = useState(product.title);
  const [description,  setDescription]  = useState(product.description ?? '');
  const [price,        setPrice]        = useState(String(product.price));
  const [stock,        setStock]        = useState(String(product.stock));
  const [images,       setImages]       = useState<string[]>(product.images ?? []);
  const [warranty,     setWarranty]     = useState(product.warranty ?? '');
  const [returnPolicy, setReturnPolicy] = useState(product.returnPolicy ?? '');
  const [whatsapp,     setWhatsapp]     = useState(contact.whatsapp ?? '');
  const [telegram,     setTelegram]     = useState(contact.telegram  ?? '');
  const [email,        setEmail]        = useState(contact.email     ?? '');
  const [city,         setCity]         = useState(shipping.city     ?? '');
  const [country,      setCountry]      = useState(shipping.country  ?? '');
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || images.length + files.length > 5) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file); fd.append('folder', 'products');
        const res  = await fetch('/api/bff/storage/upload', {
          method: 'POST', credentials: 'include',
          headers: { Authorization: `Bearer ${getToken()}`, 'x-csrf-token': getCsrf() },
          body: fd,
        });
        const data = await res.json();
        const url  = data.url ?? data.data?.url;
        if (url) uploaded.push(url);
      }
      setImages(p => [...p, ...uploaded]);
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSave = async () => {
    if (!title || !price || !stock) { setError('Title, price and stock are required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/bff/commerce/products/${product.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
        body: JSON.stringify({
          title, description,
          price:  parseFloat(price),
          stock:  parseInt(stock),
          images,
          warranty:     warranty     || undefined,
          returnPolicy: returnPolicy || undefined,
          contact: {
            whatsapp: whatsapp || undefined,
            telegram: telegram || undefined,
            email:    email    || undefined,
          },
          shipping: {
            ...shipping,
            city:    city    || shipping.city,
            country: country || shipping.country,
          },
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Update failed'); }
      const data = await res.json();
      onSuccess(data.product);
      onClose();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(2,2,5,0.88)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d0d14', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '20px 20px 16px 16px', padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>✏️ Edit Product</div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffffff0a', border: 'none', color: '#6b6b7a', fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Images ─────────────────────────────── */}
        <label style={labelStyle}>Images ({images.length}/5)</label>
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {images.map((url, i) => (
              <div key={`${url}-${i}`} style={{ position: 'relative', width: 64, height: 64 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(212,175,55,0.2)' }} />
                <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {images.length < 5 && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#ffffff06', border: '1px dashed rgba(212,175,55,0.2)', color: uploading ? '#4a4a5a' : '#d4af37', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>
              {uploading ? '⏳ Uploading...' : '📷 Add Photos'}
            </button>
          </>
        )}

        {/* ── Product Info ────────────────────────── */}
        <label style={labelStyle}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Price (π) *</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Stock *</label>
            <input type="number" value={stock} onChange={e => setStock(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Warranty</label>
        <input value={warranty} onChange={e => setWarranty(e.target.value)}
          placeholder="e.g. 1 year" style={inputStyle} />

        <label style={labelStyle}>Return Policy</label>
        <input value={returnPolicy} onChange={e => setReturnPolicy(e.target.value)}
          placeholder="e.g. 30-day returns" style={inputStyle} />

        {/* ── Address ─────────────────────────────── */}
        <div style={{ height: 1, background: '#ffffff08', margin: '12px 0' }} />
        <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
          📍 Address
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)}
              placeholder="Cairo, Dubai..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input value={country} onChange={e => setCountry(e.target.value)}
              placeholder="Egypt, UAE..." style={inputStyle} />
          </div>
        </div>

        {/* ── Contact ─────────────────────────────── */}
        <div style={{ height: 1, background: '#ffffff08', margin: '12px 0' }} />
        <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
          📞 Contact
        </div>

        <label style={labelStyle}>WhatsApp / Phone</label>
        <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
          placeholder="+201234567890" style={inputStyle} />

        <label style={labelStyle}>Telegram</label>
        <input value={telegram} onChange={e => setTelegram(e.target.value)}
          placeholder="@username" style={inputStyle} />

        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="seller@email.com" style={inputStyle} />

        {/* ── Actions ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'transparent', border: '1px solid #ffffff15', color: '#6b6b7a', fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '13px', borderRadius: 14, background: saving ? '#ffffff10' : 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: saving ? '#4a4a5a' : '#0a0800', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
        }
