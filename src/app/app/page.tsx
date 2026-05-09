'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePiAuth }                        from '@/lib-client/hooks/usePiAuth';
import { ErrorBoundary }                    from '@/components/ErrorBoundary';
import { CommerceSkeleton }                 from './components/CommerceSkeleton';
import { ProductsTab }                      from './components/ProductsTab';
import { OrdersTab }                        from './components/OrdersTab';
import { AddProductForm }                   from './components/AddProductForm';
import { Product, Order, MainTab }          from './types';

const HUB_URL = 'https://hub.tecosystem.app';
const SSO_URL = `${HUB_URL}/api/auth/sso?target=` +
  encodeURIComponent('https://tec-commerce-app.vercel.app');

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ')
    .find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

const getTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='));
  return match ? match.split('=')[1] : null;
};

function CommercePageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [activeTab,   setActiveTab]   = useState<MainTab>('products');
  const [dataLoading, setDataLoading] = useState(true);
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ✅ Refresh token — Commerce عندها tec_refresh_token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'x-csrf-token': getCsrfToken() },
      });
      return res.ok;
    } catch { return false; }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/products', {
        credentials: 'include', cache: 'no-store',
      });
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (!refreshed) { window.location.href = SSO_URL; return; }
        const retry = await fetch('/api/bff/commerce/products', {
          credentials: 'include', cache: 'no-store',
        });
        if (retry.ok) { const data = await retry.json(); setProducts(data?.products ?? []); }
        return;
      }
      if (res.ok) { const data = await res.json(); setProducts(data?.products ?? []); }
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  }, [refreshToken]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/orders', {
        credentials: 'include', cache: 'no-store',
      });
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (!refreshed) { window.location.href = SSO_URL; return; }
        const retry = await fetch('/api/bff/commerce/orders', {
          credentials: 'include', cache: 'no-store',
        });
        if (retry.ok) { const data = await retry.json(); setOrders(data?.orders ?? []); }
        return;
      }
      if (res.ok) { const data = await res.json(); setOrders(data?.orders ?? []); }
    } catch { /* silent */ }
  }, [refreshToken]);

  useEffect(() => {
    if (isLoading) return;
    const token = getTokenFromCookie();
    if (!token && !isAuthenticated) {
      window.location.href = SSO_URL;
      return;
    }

    const params        = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');

    if (paymentStatus === 'success') {
      const productId = params.get('product_id') ?? '';
      const txid      = params.get('txid')       ?? '';
      const paymentId = params.get('payment_id') ?? '';

      showToast('Payment successful! 🎉');
      setActiveTab('orders');

      if (productId) {
        fetch('/api/bff/commerce/orders', {
          method:      'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken(),
          },
          body: JSON.stringify({ product_id: productId, payment_id: paymentId, txid }),
        }).then(() => fetchOrders()).catch(() => {});
      }

      window.history.replaceState({}, '', '/app');
    }
  }, [isLoading, isAuthenticated, showToast, fetchOrders]);

  const handleBuy = useCallback((product: Product) => {
    if (!window.Pi) { showToast('Open in Pi Browser to pay', 'error'); return; }

    const amount = product.price + (product.shipping.shippingCost ?? 0);

    const payParams = new URLSearchParams({
      amount:     String(amount),
      memo:       `Buy ${product.title} — TEC Commerce`,
      product_id: product.id,
      return_url: 'https://tec-commerce-app.vercel.app/app',
      source:     'commerce',
    });

    window.location.href = `${HUB_URL}/hub/pay?${payParams.toString()}`;
  }, [showToast]);

  const handleDelete = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/products/${productId}`, {
        method:      'DELETE',
        credentials: 'include',
        headers:     { 'x-csrf-token': getCsrfToken() },
      });
      if (res.ok) { showToast('Product deleted'); fetchProducts(); }
    } catch { showToast('Failed to delete', 'error'); }
  }, [fetchProducts, showToast]);

  const handleReview = useCallback(async (orderId: string, rating: number, comment: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/orders/${orderId}/review`, {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ rating, comment }),
      });
      if (res.ok) { showToast('Review submitted! ⭐'); fetchOrders(); }
    } catch { showToast('Failed to submit review', 'error'); }
  }, [fetchOrders, showToast]);

  // ✅ Refresh أول ثم fetch
  useEffect(() => {
    const init = async () => {
      const refreshed = await refreshToken();
      if (!refreshed) { window.location.href = SSO_URL; return; }
      fetchProducts();
      fetchOrders();
    };
    init();
  }, [fetchProducts, fetchOrders, refreshToken]);

  const token = typeof window !== 'undefined' ? getTokenFromCookie() : null;
  if (isLoading || (!isAuthenticated && !token)) return <CommerceSkeleton />;

  const myProductsCount = products.filter(p => p.sellerId === user?.id).length;

  return (
    <div style={{
      minHeight: '100vh', background: '#020205', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      paddingBottom: 90,
    }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes toastIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }
        .fade-in { animation: slideUp 0.4s ease; }
        .btn:active { transform: scale(0.97); }
        input,textarea,select { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: 16, right: 16, zIndex: 999,
          background: toast.type === 'success' ? '#051a0a' : '#1a0505',
          border: `1px solid ${toast.type === 'success' ? '#7ee7c040' : '#e74c3c40'}`,
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'toastIn 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 16 }}>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ fontSize: 13, fontWeight: 600,
            color: toast.type === 'success' ? '#7ee7c0' : '#e74c3c' }}>
            {toast.msg}
          </span>
        </div>
      )}

      <header style={{
        padding: '14px 20px', borderBottom: '1px solid #ffffff08',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn"
            onClick={() => {
              window.location.href = '/api/auth/sso?target=' +
                encodeURIComponent('https://hub.tecosystem.app');
            }}
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
              { label: 'Products', value: products.length.toString(), icon: '🛒' },
              { label: 'My Items', value: myProductsCount.toString(),  icon: '📦' },
              { label: 'Orders',   value: orders.length.toString(),    icon: '🧾' },
            ].map(s => (
              <div key={s.label} style={{ background: '#ffffff05', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

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

      <div style={{ padding: '12px 16px 0' }} className="fade-in">
        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            userId={user?.id ?? ''}
            dataLoading={dataLoading}
            onBuy={handleBuy}
            onDelete={handleDelete}
            onAddFirst={() => setActiveTab('sell')}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            onReview={handleReview}
            onShop={() => setActiveTab('products')}
          />
        )}
        {activeTab === 'sell' && (
          <AddProductForm
            onSuccess={() => { fetchProducts(); setActiveTab('products'); showToast('Product published! 🚀'); }}
          />
        )}
      </div>

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
              filter: activeTab === item.key ? 'none' : 'grayscale(1) opacity(0.4)',
              transition: 'filter 0.2s, transform 0.2s',
              transform: activeTab === item.key ? 'scale(1.15)' : 'scale(1)' }}>
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
