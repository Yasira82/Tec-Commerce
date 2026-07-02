'use client';
// v1.2.1
import { useEffect, useState, useCallback, useRef } from 'react';
import { usePiAuth }                                from '@/lib-client/hooks/usePiAuth';
import { ErrorBoundary }                            from '@/components/ErrorBoundary';
import { CommerceSkeleton }                         from './components/CommerceSkeleton';
import { ProductsTab }                              from './components/ProductsTab';
import { OrdersTab }                                from './components/OrdersTab';
import { AddProductForm }                           from './components/AddProductForm';
import { EditProductModal }                         from './components/EditProductModal';
import { SellerOrderCard }                          from './components/SellerOrderCard';
import { CommerceDrawer }                           from './components/CommerceDrawer';
import { Product, Order, MainTab }                  from './types';
import { createPaymentRecord, createU2APayment }    from '@/lib/pi-payment';
// ADR-007/C-12 §3: flag-aware (sessionStorage OR referrer) — see hub-entry.ts
import { isHubNavigation }                          from '@/lib-client/pi/hub-entry';
import { PaymentModal, PayStatus }                  from '@yasser172/tec-ui/payment';
import { Icon, type IconName }                       from '@yasser172/tec-ui';

const HUB_URL      = process.env.NEXT_PUBLIC_HUB_URL      ?? 'https://hub.tecosystem.app';
const COMMERCE_URL = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://commerce.tecosystem.app';
const SSO_URL      = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(COMMERCE_URL)}`;

type Prefs = { theme: 'dark' | 'light'; currency: 'PI' | 'USD'; hideBalance: boolean; language: 'en' | 'ar'; };

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const getTokenFromCookie = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

const loadPrefs = (): Prefs => {
  try {
    const saved = localStorage.getItem('tec_commerce_prefs');
    return saved ? JSON.parse(saved) : { theme: 'dark', currency: 'PI', hideBalance: false, language: 'en' as const };
  } catch { return { theme: 'dark', currency: 'PI', hideBalance: false, language: 'en' as const }; }
};

function CommercePageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();

  const [products,     setProducts]     = useState<Product[]>([]);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [activeTab,    setActiveTab]    = useState<MainTab>('products');
  const [dataLoading,  setDataLoading]  = useState(true);
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [prefs,        setPrefs]        = useState<Prefs>({ theme: 'dark', currency: 'PI', hideBalance: false, language: 'en' });
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [piReady,    setPiReady]    = useState(false);
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const inFlight = useRef(false);

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!piReady || (window as any).__TEC_PI_FOREIGN_SESSION) return;
    window.Pi?.authenticate(['username'], () => {}).catch(() => {});
  }, [piReady]);

  const isDark = prefs.theme === 'dark';

  const handlePrefChange = useCallback((key: keyof Prefs, value: unknown) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem('tec_commerce_prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

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
      const res = await fetch('/api/bff/commerce/products', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        await refreshToken();
        const retry = await fetch('/api/bff/commerce/products', { credentials: 'include', cache: 'no-store' });
        if (retry.ok) { const data = await retry.json(); setProducts(data?.products ?? []); }
        return;
      }
      if (res.ok) { const data = await res.json(); setProducts(data?.products ?? []); }
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  }, [refreshToken]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/orders', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        await refreshToken();
        const retry = await fetch('/api/bff/commerce/orders', { credentials: 'include', cache: 'no-store' });
        if (retry.ok) { const data = await retry.json(); setOrders(data?.orders ?? []); }
        return;
      }
      if (res.ok) { const data = await res.json(); setOrders(data?.orders ?? []); }
    } catch { /* silent */ }
  }, [refreshToken]);

  const fetchSellerOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/bff/commerce/orders?role=seller', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setSellerOrders(d?.orders ?? []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const token = getTokenFromCookie();
    if (!token && !isAuthenticated) { window.location.href = SSO_URL; return; }

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
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ product_id: productId, payment_id: paymentId, txid }),
        }).then(() => fetchOrders()).catch((err) => {
          console.error('[commerce] order creation failed after Hub redirect:', err);
        });
      }
      window.history.replaceState({}, '', '/app');
    }
  }, [isLoading, isAuthenticated, showToast, fetchOrders]);

  // ADR-007 compliant handleBuy
  const handleBuy = useCallback(async (product: Product) => {
    if (inFlight.current) return;
    const amount = product.price + (product.shipping?.shippingCost ?? 0);

    // ADR-007: check Hub navigation FIRST — before any Pi SDK call
    if (isHubNavigation() || (window as any).__TEC_PI_FOREIGN_SESSION || !(window as any).Pi || !piReady) {
      const params = new URLSearchParams({
        pay:        '1',
        amount:     String(amount),
        memo:       `Buy ${product.title} — TEC Commerce`,
        product_id: product.id,
        source:     'commerce',
        return_url: `${COMMERCE_URL}/app`,
      });
      window.location.href = `${HUB_URL}/hub?${params}`;
      return;
    }

    // Mode 2: Direct payment (Commerce session)
    inFlight.current = true;
    setActiveProd(product);
    setPayStatus('creating');
    setPayMessage('');

    try {
      const memo       = `Buy ${product.title} — TEC Commerce`;
      const internalId = await createPaymentRecord(amount, product.id, memo);

      if (!internalId) {
        setPayStatus('error');
        setPayMessage('Failed to initialize payment.');
        inFlight.current = false;
        return;
      }

      setPayStatus('paying');

      const result = await createU2APayment(
        amount, memo,
        { source: 'commerce', product_id: product.id },
        internalId,
      );

      if (result.success) {
        fetch('/api/bff/commerce/orders', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ product_id: product.id, payment_id: internalId }),
        }).then(() => fetchOrders()).catch((err) => {
          console.error('[commerce] order creation failed:', err);
        });
        setPayStatus('success');
        showToast('Payment successful! 🎉');
      } else {
        setPayStatus(result.status === 'cancelled' ? 'cancelled' : 'error');
        setPayMessage(result.message ?? '');
      }
    } catch (err) {
      setPayStatus('error');
      setPayMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      inFlight.current = false;
    }
  }, [showToast, fetchOrders, piReady]);

  const closePayModal = () => {
    setPayStatus('idle');
    setActiveProd(null);
    setPayMessage('');
    inFlight.current = false;
  };

  const handleDelete = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/products/${productId}`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'x-csrf-token': getCsrfToken() },
      });
      if (res.ok) { showToast('Product deleted'); fetchProducts(); }
    } catch { showToast('Failed to delete', 'error'); }
  }, [fetchProducts, showToast]);

  const handleEdit        = useCallback((product: Product) => { setEditProduct(product); }, []);
  const handleEditSuccess = useCallback((updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    showToast('Product updated! ✅');
  }, [showToast]);

  const handleReview = useCallback(async (orderId: string, rating: number, comment: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/orders/${orderId}/review`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ rating, comment }),
      });
      if (res.ok) { showToast('Review submitted! ⭐'); fetchOrders(); }
    } catch { showToast('Failed to submit review', 'error'); }
  }, [fetchOrders, showToast]);

  const handleStatusUpdate = useCallback(async (orderId: string, status: string, note?: string) => {
    try {
      const res = await fetch(`/api/bff/commerce/orders/${orderId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ status, note }),
      });
      if (res.ok) { showToast('Order updated ✅'); fetchSellerOrders(); }
      else showToast('Failed to update', 'error');
    } catch { showToast('Failed to update', 'error'); }
  }, [fetchSellerOrders, showToast]);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchSellerOrders();
  }, [fetchProducts, fetchOrders, fetchSellerOrders]);

  const token = typeof window !== 'undefined' ? getTokenFromCookie() : null;
  if (isLoading || (!isAuthenticated && !token)) return <CommerceSkeleton />;

  const myProductsCount = products.filter(p => p.sellerId === user?.id).length;
  const pendingSales    = sellerOrders.filter(o => o.status === 'pending').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#050816' : '#f0f0f5',
      color:      isDark ? '#fff'    : '#111',
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

      <CommerceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        prefs={prefs}
        onPrefChange={handlePrefChange}
        username={user?.piUsername}
        hubUrl={HUB_URL}
        notifCount={0}
        onNotif={() => { setDrawerOpen(false); setActiveTab('orders'); }}
      />

      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={handleEditSuccess}
        />
      )}

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
          <span style={{ fontSize: 13, fontWeight: 600, color: toast.type === 'success' ? '#7ee7c0' : '#e74c3c' }}>
            {toast.msg}
          </span>
        </div>
      )}

      <header style={{
        padding: '14px 20px', borderBottom: `1px solid ${isDark ? '#ffffff08' : '#e0e0e8'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: isDark ? 'rgba(2,2,5,0.95)' : 'rgba(240,240,245,0.95)',
        backdropFilter: 'blur(20px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn" onClick={() => setDrawerOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? '#ffffff08' : '#e0e0e8', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}`, color: '#FBBF24', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ width: 16, height: 2, background: '#FBBF24', borderRadius: 1, display: 'block' }} />
            <span style={{ width: 16, height: 2, background: '#FBBF24', borderRadius: 1, display: 'block' }} />
            <span style={{ width: 10, height: 2, background: '#FBBF24', borderRadius: 1, display: 'block', alignSelf: 'flex-start', marginLeft: 3 }} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24', lineHeight: 1 }}>Commerce</div>
            <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 2 }}>TEC ECOSYSTEM</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!piReady && <span style={{ fontSize: 9, color: '#4a4a5a' }}>Pi connecting...</span>}
          {prefs.hideBalance && <span style={{ fontSize: 10, color: '#4a4a5a' }}>👁️ Hidden</span>}
          <div style={{ fontSize: 12, color: '#FBBF24' }}>
            {user?.piUsername ? `@${user.piUsername}` : ''}
          </div>
        </div>
      </header>

      <div style={{ padding: '16px 16px 0' }} className="fade-in">
        <div style={{ borderRadius: 24, padding: '20px 24px', background: 'linear-gradient(135deg,#1a1208 0%,#0f0f1a 60%,#0a0f1f 100%)', border: '1px solid #FBBF2425' }}>
          <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>COMMERCE OVERVIEW</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {([
              { label: 'Products', value: products.length.toString(),    icon: 'cart'    as const },
              { label: 'My Items', value: myProductsCount.toString(),     icon: 'box'     as const },
              { label: 'Orders',   value: orders.length.toString(),       icon: 'receipt' as const },
              { label: 'Sales',    value: sellerOrders.length.toString(), icon: 'chart'   as const },
            ]).map(s => (
              <div key={s.label} style={{ background: '#ffffff05', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'center' }}><Icon name={s.icon} size={18} color="#FBBF24" strokeWidth={1.9} /></div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#FBBF24' }}>
                  {prefs.hideBalance && s.label !== 'Products' && s.label !== 'My Items' ? '••' : s.value}
                </div>
                <div style={{ fontSize: 8, color: '#4a4a5a', letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(([
          { key: 'products', icon: 'cart',    label: 'Products' },
          { key: 'orders',   icon: 'receipt', label: 'Orders'   },
          { key: 'sales',    icon: 'chart',   label: pendingSales > 0 ? `Sales (${pendingSales})` : 'Sales' },
          { key: 'sell',     icon: 'plus',    label: 'Sell'     },
        ]) as { key: MainTab; icon: IconName; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: activeTab === tab.key ? '#FBBF2412' : isDark ? '#ffffff08' : '#e0e0e8', color: activeTab === tab.key ? '#FBBF24' : '#4a4a5a', border: activeTab === tab.key ? '1px solid #FBBF2430' : '1px solid transparent', transition: 'all 0.2s' }}>
            <Icon name={tab.icon} size={14} /> {tab.label}
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
            onEdit={handleEdit}
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
        {activeTab === 'sales' && (
          <div>
            {sellerOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon name="chart" size={40} color="#4a4a5a" strokeWidth={1.5} /></div>
                <div style={{ color: '#4a4a5a', fontSize: 14, marginBottom: 16 }}>No sales yet</div>
                <button onClick={() => setActiveTab('products')}
                  style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
                  View Products
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>
                  {sellerOrders.length} SALES · {pendingSales} PENDING
                </div>
                {sellerOrders.map(o => (
                  <SellerOrderCard key={o.id} order={o} onUpdate={handleStatusUpdate} />
                ))}
              </>
            )}
          </div>
        )}
        {activeTab === 'sell' && (
          <AddProductForm
            onSuccess={() => { fetchProducts(); setActiveTab('products'); showToast('Product published! 🚀'); }}
          />
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: isDark ? 'rgba(10,10,18,0.97)' : 'rgba(240,240,245,0.97)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${isDark ? '#ffffff08' : '#e0e0e8'}`, display: 'flex', padding: '10px 0 22px' }}>
        {(([
          { key: 'products', icon: 'cart',    label: 'Products' },
          { key: 'orders',   icon: 'receipt', label: 'Orders'   },
          { key: 'sales',    icon: 'chart',   label: 'Sales'    },
          { key: 'sell',     icon: 'plus',    label: 'Sell'     },
        ]) as { key: MainTab; icon: IconName; label: string }[]).map(item => (
          <button key={item.key} className="btn" onClick={() => setActiveTab(item.key)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
            <span style={{ transition: 'transform 0.2s', transform: activeTab === item.key ? 'scale(1.08)' : 'scale(1)' }}>
              <Icon name={item.icon} size={20} color={activeTab === item.key ? '#FBBF24' : '#4a4a5a'} strokeWidth={activeTab === item.key ? 2.2 : 1.9} />
            </span>
            <span style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: activeTab === item.key ? '#FBBF24' : '#4a4a5a', fontWeight: activeTab === item.key ? 700 : 400 }}>
              {item.label}
            </span>
            {item.key === 'sales' && pendingSales > 0 && (
              <span style={{ position: 'absolute', top: -2, right: '20%', width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingSales}
              </span>
            )}
            {activeTab === item.key && (
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', marginTop: -2 }} />
            )}
          </button>
        ))}
      </nav>

      {payStatus !== 'idle' && activeProd && (
        <PaymentModal
          status={payStatus}
          amount={activeProd.price + (activeProd.shipping?.shippingCost ?? 0)}
          label={activeProd.title}
          message={payMessage}
          onClose={closePayModal}
          onRetry={() => { closePayModal(); setTimeout(() => activeProd && handleBuy(activeProd), 100); }}
        />
      )}
    </div>
  );
}

export default function CommercePage() {
  // Fire-and-forget backend warmup (Railway cold starts — see /api/warmup).
  useEffect(() => { fetch('/api/warmup').catch(() => {}); }, []);

  return <ErrorBoundary><CommercePageInner /></ErrorBoundary>;
}
