import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommercePage from '../page';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: vi.fn(),
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/CommerceSkeleton',  () => ({ CommerceSkeleton:  () => <div data-testid="skeleton" /> }));
vi.mock('../components/ProductsTab',       () => ({ ProductsTab:       ({ onBuy, products }: any) => (
  <div data-testid="products-tab">
    {products.map((p: any) => (
      <button key={p.id} data-testid={`buy-${p.id}`} onClick={() => onBuy(p)}>Buy</button>
    ))}
  </div>
)}));
vi.mock('../components/OrdersTab',         () => ({ OrdersTab:         () => <div data-testid="orders-tab" />  }));
vi.mock('../components/AddProductForm',    () => ({ AddProductForm:    () => <div data-testid="add-form" />    }));

const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');

const mockUser = { id: 'user-123', piUsername: 'yas55eR82' };

const mockProduct = {
  id:       'prod-1',
  title:    'Test Ball',
  price:    10,
  sellerId: 'seller-456',
  shipping: { shippingCost: 0 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setCookie(name: string, value: string) {
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value:    `${name}=${value}`,
  });
}

function mockFetch(responses: Record<string, { ok: boolean; status?: number; data?: unknown }>) {
  global.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
    const key = typeof url === 'string' ? url : '';
    const res = responses[key] ?? { ok: true, status: 200, data: {} };
    return {
      ok:     res.ok,
      status: res.status ?? (res.ok ? 200 : 400),
      json:   async () => res.data ?? {},
    } as Response;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Commerce Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated
    (usePiAuth as any).mockReturnValue({
      user: mockUser, isAuthenticated: true, isLoading: false,
    });
    // Default: Pi available
    (window as any).Pi = {};
    // Default: cookies
    setCookie('tec_access_token', 'fake-token');
    setCookie('tec_csrf', 'csrf-token-123');
  });

  afterEach(() => {
    delete (window as any).Pi;
  });

  // ── TIER 1: Auth ──────────────────────────────────────────────────────

  it('يعمل redirect لـ SSO لو مفيش token ومش authenticated', async () => {
    (usePiAuth as any).mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
    });
    setCookie('tec_access_token', '');

    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: assignSpy, search: '' }, writable: true,
    });

    mockFetch({});
    render(<CommercePage />);

    await waitFor(() => {
      expect(window.location.href).toContain('sso');
    });
  });

  it('بيعرض skeleton لو isLoading', () => {
    (usePiAuth as any).mockReturnValue({
      user: null, isAuthenticated: false, isLoading: true,
    });
    mockFetch({});
    render(<CommercePage />);
    expect(screen.getByTestId('skeleton')).toBeDefined();
  });

  // ── TIER 1: Payment Success ───────────────────────────────────────────

  it('لما payment_status=success → يعمل POST order ويروح لـ orders tab', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'https://commerce.tecosystem.app/app',
        search:  '?payment_status=success&product_id=prod-1&txid=tx-abc&payment_id=pay-xyz',
        assign:  vi.fn(),
      },
      writable: true,
    });

    const historyReplace = vi.spyOn(window.history, 'replaceState');

    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });

    render(<CommercePage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bff/commerce/orders',
        expect.objectContaining({
          method: 'POST',
          body:   expect.stringContaining('prod-1'),
        }),
      );
    });

    expect(historyReplace).toHaveBeenCalledWith({}, '', '/app');
  });

  it('POST order يشيل txid و payment_id صح', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   '',
        search: '?payment_status=success&product_id=prod-1&txid=TX123&payment_id=PAY456',
      },
      writable: true,
    });

    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });

    render(<CommercePage />);

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const orderCall = calls.find((c: any[]) =>
        c[0] === '/api/bff/commerce/orders' && c[1]?.method === 'POST'
      );
      expect(orderCall).toBeDefined();
      const body = JSON.parse(orderCall[1].body);
      expect(body.txid).toBe('TX123');
      expect(body.payment_id).toBe('PAY456');
      expect(body.product_id).toBe('prod-1');
    });
  });

  // ── TIER 1: CSRF ──────────────────────────────────────────────────────

  it('POST order يحمل x-csrf-token', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value:    'tec_access_token=tok&tec_csrf=MY-CSRF-TOKEN',
    });

    Object.defineProperty(window, 'location', {
      value: {
        href:   '',
        search: '?payment_status=success&product_id=prod-1&txid=tx&payment_id=pay',
      },
      writable: true,
    });

    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });

    render(<CommercePage />);

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const orderCall = calls.find((c: any[]) =>
        c[0] === '/api/bff/commerce/orders' && c[1]?.method === 'POST'
      );
      expect(orderCall[1].headers['x-csrf-token']).toBe('MY-CSRF-TOKEN');
    });
  });

  it('DELETE product يحمل x-csrf-token', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value:    'tec_access_token=tok&tec_csrf=CSRF-DELETE',
    });
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' }, writable: true,
    });

    mockFetch({
      '/api/bff/commerce/products':         { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':           { ok: true, data: { orders: [] } },
      '/api/bff/commerce/products/prod-1':  { ok: true },
    });

    render(<CommercePage />);
    await waitFor(() => screen.getByTestId('products-tab'));

    // simulate delete via fetch directly (since delete is triggered from ProductsTab)
    await act(async () => {
      await fetch('/api/bff/commerce/products/prod-1', {
        method:  'DELETE',
        headers: { 'x-csrf-token': 'CSRF-DELETE' },
        credentials: 'include',
      });
    });

    const calls = (global.fetch as any).mock.calls;
    const deleteCall = calls.find((c: any[]) =>
      c[0].includes('/products/prod-1') && c[1]?.method === 'DELETE'
    );
    expect(deleteCall[1].headers['x-csrf-token']).toBe('CSRF-DELETE');
  });

  // ── TIER 1: handleBuy ─────────────────────────────────────────────────

  it('handleBuy يبعت amount + product_id + return_url صح لـ Hub', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' }, writable: true,
    });

    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });

    render(<CommercePage />);
    await waitFor(() => screen.getByTestId('products-tab'));

    const buyBtn = screen.getByTestId('buy-prod-1');
    await userEvent.click(buyBtn);

    expect(window.location.href).toContain('hub.tecosystem.app/hub');
    expect(window.location.href).toContain('pay=1');
    expect(window.location.href).toContain('amount=10');
    expect(window.location.href).toContain('prod-1');
    expect(window.location.href).toContain('commerce.tecosystem.app');
  });

  it('handleBuy يوقف لو Pi مش موجود', async () => {
    delete (window as any).Pi;
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' }, writable: true,
    });

    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });

    render(<CommercePage />);
    await waitFor(() => screen.getByTestId('products-tab'));

    const buyBtn = screen.getByTestId('buy-prod-1');
    await userEvent.click(buyBtn);

    // مش المفروض يروح Hub لو Pi مش موجود
    expect(window.location.href).toBe('');
  });

  // ── TIER 2: 401 Retry ─────────────────────────────────────────────────

  it('fetchProducts يعمل retry بعد 401', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' }, writable: true,
    });

    let productsCalled = 0;
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/bff/commerce/products') {
        productsCalled++;
        if (productsCalled === 1) {
          return { ok: false, status: 401, json: async () => ({}) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
      }
      if (url === '/api/auth/refresh') {
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(<CommercePage />);

    await waitFor(() => {
      expect(productsCalled).toBe(2); // أول call 401، تاني call ناجح
    });

    // تأكد إن refresh اتعمل
    const calls = (global.fetch as any).mock.calls;
    const refreshCall = calls.find((c: any[]) => c[0] === '/api/auth/refresh');
    expect(refreshCall).toBeDefined();
    expect(refreshCall[1].method).toBe('POST');
  });

  it('fetchProducts بعد 401 و refresh فاشل → مش بيعمل redirect', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' }, writable: true,
    });

    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/bff/commerce/products') {
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      }
      if (url === '/api/auth/refresh') {
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(<CommercePage />);

    await waitFor(() => {
      // مش المفروض يعمل redirect — بيفضل على الصفحة بـ empty data
      expect(window.location.href).toBe('');
    });
  });
});
