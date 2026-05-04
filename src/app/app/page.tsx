'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePiAuth }                        from '@/lib-client/hooks/usePiAuth';
import { ErrorBoundary }                    from '@/components/ErrorBoundary';

const HUB_URL    = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const SSO_URL    = `${HUB_URL}/api/auth/sso?target=` +
  encodeURIComponent('https://tec-commerce-app.vercel.app');

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find(r => r.startsWith('tec_csrf='));
  return match ? match.split('=')[1] : '';
};

const getTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='));
  return match ? match.split('=')[1] : null;
};

// ── Types ─────────────────────────────────────────────────
interface Product {
  id:          string;
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  category:    string;
  imageUrl?:   string;
  sellerId:    string;
}

interface Order {
  id:         string;
  product_id: string;
  buyer_id:   string;
  status:     string;
  total:      number;
  createdAt:  string;
}

type MainTab = 'products' | 'orders' | 'sell';

// ── Skeleton ──────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#020205', padding: '0 0 90px' }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}.sk{animation:shimmer 1.4s ease infinite;background:#0d0d14;border-radius:18px}`}</style>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 80, height: 24, borderRadius: 6, background: '#ffffff08' }} />
        <div style={{ width: 60, height: 32, borderRadius: 10, background: '#ffffff08' }} />
      </div>
      <div style={{ padding: '16px' }}>
        {[1,2,3].map(i => <div key={i} className="sk" style={{ height: 100, marginBottom: 12 }} />)}
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────
function ProductCard({ product, onBuy, isMine, onDelete }: {
  product:  Product;
  onBuy:    (p: Product) => void;
  isMine:   boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      background: '#0d0d14', border: '1px solid #d4af3720',
      borderRadius: 18, padding: '16px', marginBottom: 12,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 12,
        background: '#d4af3710', border: '1px solid #d4af3720',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, flexShrink: 0,
      }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        ) : '🛒'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.title}
        </div>
        <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.description}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#d4af37' }}>
            {product.price}π
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isMine ? (
              <button onClick={() => onDelete(product.id)}
                style={{ padding: '6px 12px', borderRadius: 10, background: '#e74c3c10',
                  border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            ) : (
              <button onClick={() => onBuy(product)}
                disabled={product.stock === 0}
                style={{ padding: '6px 16px', borderRadius: 10,
                  background: product.stock > 0 ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#ffffff10',
                  border: 'none', color: product.stock > 0 ? '#0a0800' : '#4a4a5a',
                  fontSize: 12, fontWeight: 700,
                  cursor: product.stock > 0 ? 'pointer' : 'not-allowed' }}>
                {product.stock > 0 ? 'Buy' : 'Out of Stock'}
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#4a4a5a', marginTop: 4 }}>
          Stock: {product.stock} · {product.category}
        </div>
      </div>
    </div>
  );
}

// ── Add Product Form ──────────────────────────────────────
function AddProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [form,    setForm]    = useState({ title: '', description: '', price: '', stock: '', category: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.stock) {
      setError('Title, price and stock are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bff/commerce/products', {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          title:       form.title,
          description: form.description,
          price:       parseFloat(form.price),
          stock:       parseInt(form.stock),
          category:    form.category || 'General',
        }),
      });
      if (!res.ok) throw new Error('Failed to add product');
      setForm({ title: '', description: '', price: '', stock: '', category: '' });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#d4af37', marginBottom: 16 }}>
        + Add New Product
      </div>
      {error && (
        <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12, padding: '8px 12px',
          background: '#e74c3c10', borderRadius: 8, border: '1px solid #e74c3c20' }}>
          {error}
        </div>
      )}
      {[
        { key: 'title',       placeholder: 'Product title',       type: 'text'   },
        { key: 'description', placeholder: 'Description',         type: 'text'   },
        { key: 'price',       placeholder: 'Price in Pi (e.g. 5)', type: 'number' },
        { key: 'stock',       placeholder: 'Stock quantity',       type: 'number' },
        { key: 'category',    placeholder: 'Category (optional)',  type: 'text'   },
      ].map(field => (
        <input key={field.key} type={field.type} placeholder={field.placeholder}
          value={form[field.key as keyof typeof form]}
          onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
          style={{
            width: '100%', background: '#ffffff08', border: '1px solid #ffffff10',
            borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 13,
            outline: 'none', marginBottom: 10, boxSizing: 'border-box',
          }} />
      ))}
      <button onClick={handleSubmit} disabled={loading}
        style={{ width: '100%', padding: '14px', borderRadius: 14,
          background: loading ? '#ffffff10' : 'linear-gradient(135deg,#d4af37,#b8882a)',
          border: 'none', color: loading ? '#4a4a5a' : '#0a0800',
          fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Adding...' : 'Add Product'}
      </button>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const statusColor = order.status === 'completed' ? '#7ee7c0'
                    : order.status === 'pending'   ? '#f0c040'
                    : '#e74c3c';
  return (
    <div style={{ background: '#0d0d14', border: '1px solid #ffffff08',
      borderRadius: 18, padding: '16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#4a4a5a', fontFamily: 'monospace' }}>
          #{order.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: statusColor,
          background: `${statusColor}15`, border: `1px solid ${statusColor}30`,
          borderRadius: 20, padding: '2px 10px' }}>
          {order.status.toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#fff' }}>Total</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#d4af37' }}>{order.total}π</div>
      </div>
      <div style={{ fontSize: 10, color: '#4a4a5a', marginTop: 6 }}>
        {new Date(order.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
function CommercePageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [activeTab,   setActiveTab]   = useState<MainTab>('products');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    const token = getTokenFromCookie();
    if (!token && !isAuthenticated) window.location.href = SSO_URL;
  }, [isLoading, isAuthenticated]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/products', {
        credentials: 'include', cache: 'no-store',
      });
      if (res.ok) { const data = await res.json(); setProducts(data?.products ?? []); }
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/orders', {
        credentials: 'include', cache: 'no-store',
      });
      if (res.ok) { const data = await res.json(); setOrders(data?.orders ?? []); }
    } catch { /* silent */ }
  }, []);

  const handleBuy = useCallback(async (product: Product) => {
    try {
      const res = await fetch('/api/bff/commerce/orders', {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (res.ok) { fetchOrders(); setActiveTab('orders'); }
    } catch { /* silent */ }
  }, [fetchOrders]);

  const handleDelete = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/products/${productId}`, {
        method:      'DELETE',
        credentials: 'include',
        headers:     { 'x-csrf-token': getCsrfToken() },
      });
      if (res.ok) fetchProducts();
    } catch { /* silent */ }
  }, [fetchProducts]);

  useEffect(() => { fetchProducts(); fetchOrders(); }, [fetchProducts, fetchOrders]);

  const token = typeof window !== 'undefined' ? getTokenFromCookie() : null;
  if (isLoading || (!isAuthenticated && !token)) return <Skeleton />;

  const myProducts    = products.filter(p => p.sellerId === user?.id);
  const otherProducts = products.filter(p => p.sellerId !== user?.id);

  return (
    <div style={{
      minHeight: '100vh', background: '#020205', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      paddingBottom: 90,
    }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        .fade-in { animation: slideUp 0.4s ease; }
        .btn:active { transform: scale(0.97); }
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        padding: '14px 20px', borderBottom: '1px solid #ffffff08',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn" onClick={() => window.location.href = HUB_URL}
            style={{ background: '#ffffff08', border: '1px solid #ffffff10',
              borderRadius: 12, padding: '6px 10px', color: '#d4af37',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 16 }}>🔷</span>
            <span style={{ fontSize: 8, color: '#4a4a5a', letterSpacing: 1 }}>HUB</span>
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#d4af37', lineHeight: 1 }}>Commerce</div>
            <div style={{ fontSize: 9, color: '#3a3a4a', letterSpacing: 2 }}>TEC ECOSYSTEM</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#d4af37' }}>
          {user?.piUsername ? `@${user.piUsername}` : ''}
        </div>
      </header>

      {/* ── Stats Card ── */}
      <div style={{ padding: '16px 16px 0' }} className="fade-in">
        <div style={{
          borderRadius: 24, padding: '20px 24px',
          background: 'linear-gradient(135deg,#1a1208 0%,#0f0f1a 60%,#0a0f1f 100%)',
          border: '1px solid #d4af3725',
        }}>
          <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 3,
            textTransform: 'uppercase', marginBottom: 12 }}>COMMERCE OVERVIEW</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Products',  value: products.length.toString() },
              { label: 'My Items',  value: myProducts.length.toString() },
              { label: 'Orders',    value: orders.length.toString() },
            ].map(s => (
              <div key={s.label} style={{ background: '#ffffff05', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#4a4a5a', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
        {([
          { key: 'products', label: '🛒 Products' },
          { key: 'orders',   label: '🧾 Orders'   },
          { key: 'sell',     label: '+ Sell'       },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              background: activeTab === tab.key ? '#d4af3712' : '#ffffff08',
              color:      activeTab === tab.key ? '#d4af37'   : '#4a4a5a',
              border:     activeTab === tab.key ? '1px solid #d4af3730' : '1px solid transparent',
              transition: 'all 0.2s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '12px 16px 0' }} className="fade-in">

        {/* Products Tab */}
        {activeTab === 'products' && (
          dataLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#4a4a5a' }}>Loading...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ color: '#4a4a5a', fontSize: 14 }}>No products yet</div>
              <button onClick={() => setActiveTab('sell')}
                style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                  border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
                Add First Product
              </button>
            </div>
          ) : (
            <>
              {myProducts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#d4af3760', letterSpacing: 2,
                    textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
                    MY PRODUCTS
                  </div>
                  {myProducts.map(p => (
                    <ProductCard key={p.id} product={p}
                      onBuy={handleBuy} isMine={true} onDelete={handleDelete} />
                  ))}
                </div>
              )}
              {otherProducts.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2,
                    textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
                    MARKETPLACE
                  </div>
                  {otherProducts.map(p => (
                    <ProductCard key={p.id} product={p}
                      onBuy={handleBuy} isMine={false} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </>
          )
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ color: '#4a4a5a', fontSize: 14 }}>No orders yet</div>
            </div>
          ) : (
            orders.map(o => <OrderCard key={o.id} order={o} />)
          )
        )}

        {/* Sell Tab */}
        {activeTab === 'sell' && (
          <AddProductForm onSuccess={() => { fetchProducts(); setActiveTab('products'); }} />
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid #ffffff08', display: 'flex', padding: '10px 0 22px',
      }}>
        {([
          { key: 'products', icon: '🛒', label: 'Products' },
          { key: 'orders',   icon: '🧾', label: 'Orders'   },
          { key: 'sell',     icon: '➕', label: 'Sell'     },
        ] as const).map(item => (
          <button key={item.key} className="btn" onClick={() => setActiveTab(item.key)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 20,
              filter: activeTab === item.key ? 'none' : 'grayscale(1) opacity(0.4)' }}>
              {item.icon}
            </span>
            <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
              color: activeTab === item.key ? '#d4af37' : '#4a4a5a',
              fontWeight: activeTab === item.key ? 700 : 400 }}>
              {item.label}
            </span>
            {activeTab === item.key && (
              <span style={{ width: 4, height: 4, borderRadius: '50%',
                background: '#d4af37', marginTop: -2 }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function CommercePage() {
  return <ErrorBoundary><CommercePageInner /></ErrorBoundary>;
            }
