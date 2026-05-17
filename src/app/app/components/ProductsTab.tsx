'use client';

import { useState, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import { Product, ProductCategory, CATEGORIES, CATEGORY_ICONS, COUNTRIES } from '../types';
import { ProductCard } from './ProductCard';

type SortKey  = 'newest' | 'price_asc' | 'price_desc' | 'rating';
type ViewMode = 'grid' | 'list';

interface Props {
  products:    Product[];
  userId:      string;
  dataLoading: boolean;
  onBuy:       (p: Product) => void;
  onDelete:    (id: string) => void;
  onEdit?:     (p: Product) => void;
  onAddFirst:  () => void;
}

const PAGE_SIZE = 10;
const GOLD      = '#d4af37';

// ── Skeleton ───────────────────────────────────────────────────
function GridSkeleton() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg,#ffffff05 25%,#ffffff0f 50%,#ffffff05 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 8,
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ background: '#0f0f1a', border: '1px solid #ffffff08', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ ...shimmer, height: 130, borderRadius: 0 }} />
          <div style={{ padding: '10px 12px' }}>
            <div style={{ ...shimmer, height: 14, width: '80%', marginBottom: 8 }} />
            <div style={{ ...shimmer, height: 20, width: '50%', marginBottom: 6 }} />
            <div style={{ ...shimmer, height: 10, width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Compact Grid Card ──────────────────────────────────────────
function GridCard({ product, isMine, onBuy, onDelete, onEdit }: {
  product:  Product;
  isMine:   boolean;
  onBuy:    (p: Product) => void;
  onDelete: (id: string) => void;
  onEdit?:  (p: Product) => void;
}) {
  const router  = useRouter();
  const inStock = product.stock > 0;
  const image   = product.images?.[0];

  return (
    <div onClick={() => !isMine && router.push(`/app/${product.id}`)}
      style={{ background: '#0f0f1a', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 16, overflow: 'hidden', cursor: isMine ? 'default' : 'pointer', position: 'relative' }}>

      {/* Image */}
      <div style={{ position: 'relative', height: 130, background: '#0a0a12' }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.3 }}>
            {CATEGORY_ICONS[product.category] ?? '🛒'}
          </div>
        )}
        <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: product.condition === 'new' ? '#10b981' : '#f59e0b', background: product.condition === 'new' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${product.condition === 'new' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 20, padding: '2px 6px', textTransform: 'uppercase' }}>
          {product.condition}
        </div>
        {!inStock && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: 1.5, textTransform: 'uppercase', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 10px', borderRadius: 20 }}>Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.title}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: GOLD, marginBottom: 4 }}>{product.price}π</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: '#4a4a5a' }}>📍 {product.shipping.city}</span>
          {product.rating > 0 && <span style={{ fontSize: 9, color: '#f0c040' }}>★ {product.rating.toFixed(1)}</span>}
        </div>

        {isMine && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {onEdit && (
              <button onClick={e => { e.stopPropagation(); onEdit(product); }}
                style={{ flex: 1, padding: '6px', borderRadius: 8, background: 'rgba(126,184,247,0.08)', border: '1px solid rgba(126,184,247,0.2)', color: '#7eb8f7', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                ✏️ Edit
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(product.id); }}
              style={{ flex: 1, padding: '6px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              🗑️
            </button>
          </div>
        )}

        {!isMine && inStock && (
          <button onClick={e => { e.stopPropagation(); onBuy(product); }}
            style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 10, background: `linear-gradient(135deg,${GOLD},#b8882a)`, border: 'none', color: '#0a0800', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            Buy · {product.price}π
          </button>
        )}
      </div>
    </div>
  );
}

// ── Filter Panel ───────────────────────────────────────────────
function FilterPanel({ show, minPrice, maxPrice, country, onMinPrice, onMaxPrice, onCountry, onReset, isDark }: {
  show:       boolean;
  minPrice:   string;
  maxPrice:   string;
  country:    string;
  onMinPrice: (v: string) => void;
  onMaxPrice: (v: string) => void;
  onCountry:  (v: string) => void;
  onReset:    () => void;
  isDark:     boolean;
}) {
  if (!show) return null;

  const inputStyle: React.CSSProperties = {
    flex: 1, background: isDark ? '#0d0d14' : '#e8e8f0',
    border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}`,
    borderRadius: 10, padding: '8px 10px',
    color: isDark ? '#fff' : '#111', fontSize: 12, outline: 'none',
  };

  return (
    <div style={{ background: isDark ? '#0d0d14' : '#e8e8f0', border: `1px solid ${isDark ? '#ffffff08' : '#ddd'}`, borderRadius: 14, padding: '14px', marginBottom: 10 }}>

      {/* Price Range */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
          💰 Price Range (π)
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" value={minPrice} onChange={e => onMinPrice(e.target.value)}
            placeholder="Min" style={inputStyle} />
          <span style={{ color: '#4a4a5a', fontSize: 12 }}>—</span>
          <input type="number" value={maxPrice} onChange={e => onMaxPrice(e.target.value)}
            placeholder="Max" style={inputStyle} />
        </div>

        {/* Quick price buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Under 10π',  min: '',   max: '10'  },
            { label: '10–50π',     min: '10', max: '50'  },
            { label: '50–100π',    min: '50', max: '100' },
            { label: 'Over 100π',  min: '100', max: ''   },
          ].map(r => (
            <button key={r.label}
              onClick={() => { onMinPrice(r.min); onMaxPrice(r.max); }}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer', background: minPrice === r.min && maxPrice === r.max ? `${GOLD}20` : isDark ? '#ffffff08' : '#d8d8e0', color: minPrice === r.min && maxPrice === r.max ? GOLD : '#4a4a5a', border: minPrice === r.min && maxPrice === r.max ? `1px solid ${GOLD}40` : '1px solid transparent', fontWeight: 600 }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Country */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
          📍 Ships From
        </div>
        <select value={country} onChange={e => onCountry(e.target.value)}
          style={{ ...inputStyle, flex: 'none', width: '100%', cursor: 'pointer' }}>
          <option value="">All Countries</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Reset */}
      <button onClick={onReset}
        style={{ width: '100%', padding: '8px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
        ✕ Reset Filters
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export function ProductsTab({ products, userId, dataLoading, onBuy, onDelete, onEdit, onAddFirst }: Props) {
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState<ProductCategory | 'All'>('All');
  const [showMine,    setShowMine]    = useState(false);
  const [sort,        setSort]        = useState<SortKey>('newest');
  const [view,        setView]        = useState<ViewMode>('grid');
  const [page,        setPage]        = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice,    setMinPrice]    = useState('');
  const [maxPrice,    setMaxPrice]    = useState('');
  const [country,     setCountry]     = useState('');

  const isDark = true; // Commerce is always dark by default

  const hasActiveFilters = !!(minPrice || maxPrice || country);

  const resetFilters = () => {
    setMinPrice(''); setMaxPrice(''); setCountry('');
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = [...products];

    if (category !== 'All') result = result.filter(p => p.category === category);
    if (showMine)           result = result.filter(p => p.sellerId === userId);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.shipping.city.toLowerCase().includes(q) ||
        p.shipping.country.toLowerCase().includes(q),
      );
    }
    if (minPrice)  result = result.filter(p => p.price >= parseFloat(minPrice));
    if (maxPrice)  result = result.filter(p => p.price <= parseFloat(maxPrice));
    if (country)   result = result.filter(p => p.shipping.country === country);

    switch (sort) {
      case 'price_asc':  result.sort((a, b) => a.price - b.price);  break;
      case 'price_desc': result.sort((a, b) => b.price - a.price);  break;
      case 'rating':     result.sort((a, b) => b.rating - a.rating); break;
      case 'newest':     result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return result;
  }, [products, category, showMine, search, sort, minPrice, maxPrice, country, userId]);

  useMemo(() => { setPage(1); }, [filtered.length]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (dataLoading) return <GridSkeleton />;

  return (
    <div>
      {/* ── Search ─────────────────────────────── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          style={{ width: '100%', background: '#0d0d14', border: '1px solid #ffffff10', borderRadius: 14, padding: '11px 80px 11px 36px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
          {/* Filter button */}
          <button onClick={() => setShowFilters(p => !p)}
            style={{ padding: '5px 10px', borderRadius: 10, background: (showFilters || hasActiveFilters) ? `${GOLD}20` : '#ffffff08', border: `1px solid ${(showFilters || hasActiveFilters) ? `${GOLD}40` : '#ffffff10'}`, color: (showFilters || hasActiveFilters) ? GOLD : '#4a4a5a', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚙️{hasActiveFilters && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>}
          </button>
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }}
              style={{ padding: '5px 8px', background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 14 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Filter Panel ───────────────────────── */}
      <FilterPanel
        show={showFilters}
        minPrice={minPrice} maxPrice={maxPrice} country={country}
        onMinPrice={v => { setMinPrice(v); setPage(1); }}
        onMaxPrice={v => { setMaxPrice(v); setPage(1); }}
        onCountry={v  => { setCountry(v);  setPage(1); }}
        onReset={resetFilters}
        isDark={isDark}
      />

      {/* ── Category Pills ─────────────────────── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
        <button onClick={() => { setCategory('All'); setPage(1); }}
          style={{ padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: category === 'All' ? '#d4af3712' : '#ffffff08', color: category === 'All' ? GOLD : '#4a4a5a', border: category === 'All' ? `1px solid ${GOLD}30` : '1px solid transparent', flexShrink: 0 }}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => { setCategory(cat); setPage(1); }}
            style={{ padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: category === cat ? '#d4af3712' : '#ffffff08', color: category === cat ? GOLD : '#4a4a5a', border: category === cat ? `1px solid ${GOLD}30` : '1px solid transparent', flexShrink: 0 }}>
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#4a4a5a', flex: 1 }}>
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          {hasActiveFilters && <span style={{ color: GOLD, marginLeft: 4 }}>· filtered</span>}
        </span>

        <button onClick={() => { setShowMine(p => !p); setPage(1); }}
          style={{ padding: '5px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10, fontWeight: 600, background: showMine ? '#d4af3712' : '#ffffff08', color: showMine ? GOLD : '#4a4a5a', border: showMine ? `1px solid ${GOLD}30` : '1px solid transparent', whiteSpace: 'nowrap' }}>
          {showMine ? '✅ Mine' : 'Mine'}
        </button>

        <select value={sort} onChange={e => { setSort(e.target.value as SortKey); setPage(1); }}
          style={{ padding: '5px 8px', background: '#0d0d14', border: '1px solid #ffffff10', borderRadius: 10, color: '#fff', fontSize: 10, cursor: 'pointer', outline: 'none' }}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="rating">Rating</option>
        </select>

        <div style={{ display: 'flex', background: '#0d0d14', border: '1px solid #ffffff10', borderRadius: 10, overflow: 'hidden' }}>
          {(['grid', 'list'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '5px 9px', background: view === v ? '#d4af3720' : 'transparent', border: 'none', color: view === v ? GOLD : '#4a4a5a', cursor: 'pointer', fontSize: 13 }}>
              {v === 'grid' ? '⊞' : '≡'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Products ───────────────────────────── */}
      {paginated.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {hasActiveFilters ? '🔍' : '🛒'}
          </div>
          <div style={{ color: '#4a4a5a', fontSize: 14, marginBottom: 16 }}>
            {search || hasActiveFilters ? 'No products match your filters' : 'No products yet'}
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters}
              style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
              ✕ Clear Filters
            </button>
          )}
          {!search && !hasActiveFilters && (
            <button onClick={onAddFirst}
              style={{ padding: '10px 24px', borderRadius: 12, background: `linear-gradient(135deg,${GOLD},#b8882a)`, border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
              Add First Product
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {paginated.map(p => (
            <GridCard key={p.id} product={p}
              isMine={p.sellerId === userId}
              onBuy={onBuy} onDelete={onDelete} onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        paginated.map(p => (
          <ProductCard key={p.id} product={p}
            isMine={p.sellerId === userId}
            onBuy={onBuy} onDelete={onDelete} onEdit={onEdit}
          />
        ))
      )}

      {/* ── Pagination ─────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingBottom: 8 }}>
          <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0); }}
            style={{ padding: '8px 16px', borderRadius: 10, background: page <= 1 ? '#ffffff05' : '#ffffff0a', border: '1px solid #ffffff10', color: page <= 1 ? '#2a2a3a' : '#fff', fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
            ←
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 :
                page <= 3 ? i + 1 :
                page >= totalPages - 2 ? totalPages - 4 + i :
                page - 2 + i;
              return (
                <button key={p} onClick={() => { setPage(p); window.scrollTo(0, 0); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: page === p ? `linear-gradient(135deg,${GOLD},#b8882a)` : '#ffffff08', border: 'none', color: page === p ? '#0a0800' : '#4a4a5a', fontSize: 12, fontWeight: page === p ? 700 : 400, cursor: 'pointer' }}>
                  {p}
                </button>
              );
            })}
          </div>
          <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
            style={{ padding: '8px 16px', borderRadius: 10, background: page >= totalPages ? '#ffffff05' : '#ffffff0a', border: '1px solid #ffffff10', color: page >= totalPages ? '#2a2a3a' : '#fff', fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
            →
          </button>
        </div>
      )}
    </div>
  );
            }
