'use client';

import { useState, useRef } from 'react';
import { ProductCategory, ProductCondition, CATEGORIES, CATEGORY_ICONS, COUNTRIES } from '../types';

interface FormData {
  title:         string;
  description:   string;
  price:         string;
  stock:         string;
  category:      ProductCategory;
  condition:     ProductCondition;
  images:        string[];
  country:       string;
  city:          string;
  shipsTo:       string;
  shippingCost:  string;
  estimatedDays: string;
  whatsapp:      string;
  telegram:      string;
  email:         string;
  warranty:      string;
  returnPolicy:  string;
}

interface Props { onSuccess: () => void; }

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

const getToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? '';
};

const inputStyle = {
  width: '100%', background: '#ffffff08', border: '1px solid #ffffff10',
  borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 13,
  outline: 'none', marginBottom: 10, boxSizing: 'border-box' as const,
};
const labelStyle = {
  fontSize: 10, color: '#6b6b7a', letterSpacing: 1,
  textTransform: 'uppercase' as const, marginBottom: 4, display: 'block',
};

// ── Image Uploader ─────────────────────────────────────────────
function ImageUploader({ images, onChange }: {
  images: string[]; onChange: (imgs: string[]) => void;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (images.length + files.length > 5) { setErr('Max 5 images'); return; }

    setUploading(true); setErr(null);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'products');
        const res  = await fetch('/api/bff/storage/upload', {
          method: 'POST', credentials: 'include',
          headers: { Authorization: `Bearer ${getToken()}`, 'x-csrf-token': getCsrfToken() },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        if (data.url) uploaded.push(data.url);
      }
      onChange([...images, ...uploaded]);
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>Product Images (max 5)</label>

      {/* Previews */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {images.map((url, i) => (
            <div key={url} style={{ position: 'relative', width: 72, height: 72 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`img-${i}`}
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(251,191,36,0.2)' }} />
              <button onClick={() => remove(i)}
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < 5 && (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile}
            style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: '100%', padding: '12px', borderRadius: 12, background: '#ffffff06', border: '1px dashed rgba(251,191,36,0.25)', color: uploading ? '#4a4a5a' : '#FBBF24', fontSize: 12, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            {uploading ? (
              <><span style={{ fontSize: 16 }}>⏳</span> Uploading...</>
            ) : (
              <><span style={{ fontSize: 18 }}>📷</span> {images.length === 0 ? 'Add Photos' : 'Add More'} ({images.length}/5)</>
            )}
          </button>
        </>
      )}

      {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ {err}</div>}
    </div>
  );
}

// ── Main Form ──────────────────────────────────────────────────
export function AddProductForm({ onSuccess }: Props) {
  const [form, setForm] = useState<FormData>({
    title: '', description: '', price: '', stock: '',
    category: 'Other', condition: 'new',
    images: [],
    country: 'Egypt', city: '', shipsTo: '',
    shippingCost: '0', estimatedDays: '3-7 days',
    whatsapp: '', telegram: '', email: '',
    warranty: '', returnPolicy: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [step,    setStep]    = useState<1 | 2 | 3>(1);

  const update = (key: keyof FormData, value: string | string[]) =>
    setForm(p => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.stock || !form.city) {
      setError('Please fill all required fields');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/bff/commerce/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({
          title:       form.title,
          description: form.description,
          price:       parseFloat(form.price),
          stock:       parseInt(form.stock),
          category:    form.category,
          condition:   form.condition,
          images:      form.images,
          shipping: {
            country:       form.country,
            city:          form.city,
            shipsTo:       form.shipsTo ? form.shipsTo.split(',').map(s => s.trim()).filter(Boolean) : [form.country],
            shippingCost:  parseFloat(form.shippingCost) || 0,
            estimatedDays: form.estimatedDays,
          },
          contact: {
            whatsapp: form.whatsapp || undefined,
            telegram: form.telegram || undefined,
            email:    form.email    || undefined,
          },
          warranty:     form.warranty     || undefined,
          returnPolicy: form.returnPolicy || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add product');
      onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#0B1020', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 18, padding: 20 }}>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['1. Product', '2. Shipping', '3. Contact'] as const).map((s, i) => (
          <button key={s} onClick={() => setStep((i + 1) as 1 | 2 | 3)}
            style={{ flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: step === i + 1 ? '#FBBF2412' : '#ffffff08',
              color:      step === i + 1 ? '#FBBF24'   : '#4a4a5a',
              border:     step === i + 1 ? '1px solid #FBBF2430' : '1px solid transparent' }}>
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Step 1 ─────────────────────────────── */}
      {step === 1 && (
        <div>
          <ImageUploader images={form.images} onChange={imgs => update('images', imgs)} />

          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={e => update('title', e.target.value)}
            placeholder="Product title" style={inputStyle} />

          <label style={labelStyle}>Description</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)}
            placeholder="Describe your product..." rows={3}
            style={{ ...inputStyle, resize: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Price (π) *</label>
              <input type="number" min="0" step="0.01" value={form.price}
                onChange={e => update('price', e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Stock *</label>
              <input type="number" min="1" value={form.stock}
                onChange={e => update('stock', e.target.value)} placeholder="1" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => update('category', e.target.value as ProductCategory)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
          </select>

          <label style={labelStyle}>Condition</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['new', 'used', 'refurbished'] as ProductCondition[]).map(c => (
              <button key={c} onClick={() => update('condition', c)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                  background: form.condition === c ? '#FBBF2412' : '#ffffff08',
                  color:      form.condition === c ? '#FBBF24'   : '#4a4a5a',
                  border:     form.condition === c ? '1px solid #FBBF2430' : '1px solid transparent' }}>
                {c}
              </button>
            ))}
          </div>

          <label style={labelStyle}>Warranty</label>
          <input value={form.warranty} onChange={e => update('warranty', e.target.value)}
            placeholder="e.g. 1 year warranty" style={inputStyle} />

          <label style={labelStyle}>Return Policy</label>
          <input value={form.returnPolicy} onChange={e => update('returnPolicy', e.target.value)}
            placeholder="e.g. 30-day returns" style={inputStyle} />

          <button onClick={() => setStep(2)}
            style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            Next: Shipping →
          </button>
        </div>
      )}

      {/* ── Step 2 ─────────────────────────────── */}
      {step === 2 && (
        <div>
          <label style={labelStyle}>Your Country *</label>
          <select value={form.country} onChange={e => update('country', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={labelStyle}>Your City *</label>
          <input value={form.city} onChange={e => update('city', e.target.value)}
            placeholder="Cairo, Dubai, London..." style={inputStyle} />

          <label style={labelStyle}>Ships To (comma separated)</label>
          <input value={form.shipsTo} onChange={e => update('shipsTo', e.target.value)}
            placeholder="Egypt, UAE, Saudi Arabia..." style={inputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Shipping Cost (π)</label>
              <input type="number" min="0" step="0.01" value={form.shippingCost}
                onChange={e => update('shippingCost', e.target.value)} placeholder="0 = Free" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Estimated Days</label>
              <input value={form.estimatedDays} onChange={e => update('estimatedDays', e.target.value)}
                placeholder="3-7 days" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: '#ffffff08', border: 'none', color: '#4a4a5a', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={() => setStep(3)}
              style={{ flex: 2, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Next: Contact →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ─────────────────────────────── */}
      {step === 3 && (
        <div>
          <label style={labelStyle}>WhatsApp Number</label>
          <input value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)}
            placeholder="+201234567890" style={inputStyle} />

          <label style={labelStyle}>Telegram Username</label>
          <input value={form.telegram} onChange={e => update('telegram', e.target.value)}
            placeholder="@username" style={inputStyle} />

          <label style={labelStyle}>Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            placeholder="seller@email.com" style={inputStyle} />

          {/* Summary */}
          <div style={{ background: '#ffffff05', border: '1px solid #ffffff08', borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Product Summary</div>
            {form.images.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {form.images.slice(0, 3).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)' }} />
                ))}
                {form.images.length > 3 && <div style={{ width: 44, height: 44, borderRadius: 8, background: '#ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6b6b7a' }}>+{form.images.length - 3}</div>}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{form.title || 'No title'}</div>
            <div style={{ fontSize: 16, color: '#FBBF24', fontWeight: 900, marginTop: 4 }}>{form.price || '0'}π</div>
            <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 4 }}>{form.city}, {form.country} · {form.estimatedDays}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: '#ffffff08', border: 'none', color: '#4a4a5a', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={loading}
              style={{ flex: 2, padding: '14px', borderRadius: 14, background: loading ? '#ffffff10' : 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: loading ? '#4a4a5a' : '#0a0800', fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '⏳ Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
                    }
