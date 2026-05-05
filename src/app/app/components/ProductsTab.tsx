'use client';

import { useState, useMemo } from 'react';
import { Product, ProductCategory, CATEGORIES, CATEGORY_ICONS } from '../types';
import { ProductCard } from './ProductCard';

interface Props {
  products:    Product[];
  userId:      string;
  dataLoading: boolean;
  onBuy:       (p: Product) => void;
  onDelete:    (id: string) => void;
  onEdit?:     (p: Product) => void;
  onAddFirst:  () => void;
}

export function ProductsTab({ products, userId, dataLoading, onBuy, onDelete, onEdit, onAddFirst }: Props) {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState<ProductCategory | 'All'>('All');
  const [showMine, setShowMine] = useState(false);

  const filtered = useMemo(() => {
    let result = products;
    if (category !== 'All') result = result.filter(p => p.category === category);
    if (showMine)           result = result.filter(p => p.sellerId === userId);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.shipping.country.toLowerCase().includes(q),
      );
    }
    return result;
  }, [products, category, showMine, search, userId]);

  if (dataLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#4a4a5a' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #d4af3730',
          borderTop: '3px solid #d4af37', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Loading products...
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products, categories, countries..."
          style={{ width: '100%', background: '#0d0d14', border: '1px solid #ffffff10',
            borderRadius: 14, padding: '12px 12px 12px 36px', color: '#fff',
            fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 16 }}>
            ✕
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        <button onClick={() => setCategory('All')}
          style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            background: category === 'All' ? '#d4af3712' : '#ffffff08',
            color:      category === 'All' ? '#d4af37'   : '#4a4a5a',
            border:     category === 'All' ? '1px solid #d4af3730' : '1px solid transparent' }}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: category === cat ? '#d4af3712' : '#ffffff08',
              color:      category === cat ? '#d4af37'   : '#4a4a5a',
              border:     category === cat ? '1px solid #d4af3730' : '1px solid transparent' }}>
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* My Products Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#4a4a5a' }}>{filtered.length} products</span>
        <button onClick={() => setShowMine(p => !p)}
          style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: showMine ? '#d4af3712' : '#ffffff08',
            color:      showMine ? '#d4af37'   : '#4a4a5a',
            border:     showMine ? '1px solid #d4af3730' : '1px solid transparent' }}>
          {showMine ? '✅ My Products' : 'My Products'}
        </button>
      </div>

      {/* Products */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ color: '#4a4a5a', fontSize: 14, marginBottom: 16 }}>
            {search ? 'No products found' : 'No products yet'}
          </div>
          {!search && (
            <button onClick={onAddFirst}
              style={{ padding: '10px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
              Add First Product
            </button>
          )}
        </div>
      ) : (
        filtered.map(p => (
          <ProductCard key={p.id} product={p}
            onBuy={onBuy}
            isMine={p.sellerId === userId}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))
      )}
    </div>
  );
}
