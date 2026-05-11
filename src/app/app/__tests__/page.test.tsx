import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act }                     from '@testing-library/react';
import React                                                 from 'react';

vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: vi.fn() }));
vi.mock('@/components/ErrorBoundary',   () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock('../components/CommerceSkeleton', () => ({
  CommerceSkeleton: () => React.createElement('div', { 'data-testid': 'skeleton' }),
}));
vi.mock('../components/ProductsTab', () => ({
  ProductsTab: ({ onBuy, onDelete, products }: any) =>
    React.createElement('div', { 'data-testid': 'products-tab' },
      ...products.map((p: any) =>
        React.createElement('div', { key: p.id },
          React.createElement('button', { 'data-testid': `buy-${p.id}`,    onClick: () => onBuy(p)      }, 'Buy'),
          React.createElement('button', { 'data-testid': `delete-${p.id}`, onClick: () => onDelete(p.id) }, 'Delete'),
        )
      )
    ),
}));
vi.mock('../components/OrdersTab',      () => ({
  OrdersTab: () => React.createElement('div', { 'data-testid': 'orders-tab' }),
}));
vi.mock('../components/AddProductForm', () => ({
  AddProductForm: () => React.createElement('div', { 'data-testid': 'add-form' }),
}));

const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');

const mockUser    = { id: 'user-123', piUsername: 'yas55eR82' };
const mockProduct = {
  id: 'prod-1', title: 'Test Ball', price: 10,
  sellerId: 'seller-456', shipping: { shippingCost: 0 },
};

function mockFetch(responses: Record<string, { ok: boolean; status?: number; data?: unknown }>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, _opts?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const res = responses[url] ?? { ok: true, status: 200, data: {} };
    return {
      ok:     res.ok,
      status: res.status ?? (res.ok ? 200 : 400),
      json:   async () => res.data ?? {},
    } as Response;
  }) as unknown as typeof fetch;
}

describe('Commerce Page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (usePiAuth as any).mockReturnValue({
      user: mockUser, isAuthenticated: true, isLoading: false,
    });
    (window as any).Pi = {};
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'tec_access_token=fake-token;tec_csrf=csrf-token-123',
    });
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '', assign: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => { delete (window as any).Pi; });

  // ── TIER 1: Auth ──────────────────────────────────────────────────────

  it('يعمل redirect لـ SSO لو مفيش token ومش authenticated', async () => {
    (usePiAuth as any).mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
    });
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
    mockFetch({});
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => { expect(window.location.href).toContain('sso'); });
  });

  it('بيعرض skeleton لو isLoading', async () => {
    (usePiAuth as any).mockReturnValue({
      user: null, isAuthenticated: false, isLoading: true,
    });
    mockFetch({});
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    expect(screen.getByTestId('skeleton')).toBeDefined();
  });

  // ── TIER 1: Payment Success ───────────────────────────────────────────

  it('لما payment_status=success → يعمل POST order', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   '',
        search: '?payment_status=success&product_id=prod-1&txid=tx-abc&payment_id=pay-xyz',
        assign: vi.fn(),
      },
      writable: true,
    });
    const historyReplace = vi.spyOn(window.history, 'replaceState');
    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const orderPost = calls.find((c: any[]) =>
        c[0] === '/api/bff/commerce/orders' && c[1]?.method === 'POST'
      );
      expect(orderPost).toBeDefined();
    });
    expect(historyReplace).toHaveBeenCalledWith({}, '', '/app');
  });

  it('POST order يبعت txid + payment_id + product_id صح', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   '',
        search: '?payment_status=success&product_id=prod-1&txid=TX123&payment_id=PAY456',
        assign: vi.fn(),
      },
      writable: true,
    });
    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const orderPost = calls.find((c: any[]) =>
        c[0] === '/api/bff/commerce/orders' && c[1]?.method === 'POST'
      );
      expect(orderPost).toBeDefined();
      const body = JSON.parse(orderPost[1].body);
      expect(body.txid).toBe('TX123');
      expect(body.payment_id).toBe('PAY456');
      expect(body.product_id).toBe('prod-1');
    });
  });

  // ── TIER 1: CSRF ──────────────────────────────────────────────────────

  it('POST order يحمل x-csrf-token', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true, value: 'tec_access_token=tok;tec_csrf=MY-CSRF-TOKEN',
    });
    Object.defineProperty(window, 'location', {
      value: {
        href:   '',
        search: '?payment_status=success&product_id=prod-1&txid=tx&payment_id=pay',
        assign: vi.fn(),
      },
      writable: true,
    });
    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const orderPost = calls.find((c: any[]) =>
        c[0] === '/api/bff/commerce/orders' && c[1]?.method === 'POST'
      );
      expect(orderPost).toBeDefined();
      expect(orderPost[1].headers['x-csrf-token']).toBe('MY-CSRF-TOKEN');
    });
  });

  it('DELETE product يحمل x-csrf-token', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true, value: 'tec_access_token=tok;tec_csrf=CSRF-DELETE',
    });
    let deleteCalled = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL, opts?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/products/prod-1') && opts?.method === 'DELETE') {
        deleteCalled = true;
        expect((opts.headers as Record<string, string>)['x-csrf-token']).toBe('CSRF-DELETE');
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }
      if (url === '/api/bff/commerce/products')
        return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
      if (url === '/api/bff/commerce/orders')
        return { ok: true, status: 200, json: async () => ({ orders: [] }) } as Response;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => screen.getByTestId('products-tab'));
    await act(async () => { screen.getByTestId('delete-prod-1').click(); });
    await waitFor(() => { expect(deleteCalled).toBe(true); });
  });

  // ── TIER 1: handleBuy ─────────────────────────────────────────────────

  it('handleBuy يبعت params صح لـ Hub', async () => {
    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => screen.getByTestId('products-tab'));
    await act(async () => { screen.getByTestId('buy-prod-1').click(); });
    expect(window.location.href).toContain('hub.tecosystem.app/hub');
    expect(window.location.href).toContain('pay=1');
    expect(window.location.href).toContain('amount=10');
    expect(window.location.href).toContain('prod-1');
    expect(window.location.href).toContain('commerce.tecosystem.app');
  });

  it('handleBuy يوقف لو Pi مش موجود', async () => {
    delete (window as any).Pi;
    mockFetch({
      '/api/bff/commerce/products': { ok: true, data: { products: [mockProduct] } },
      '/api/bff/commerce/orders':   { ok: true, data: { orders: [] } },
    });
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => screen.getByTestId('products-tab'));
    await act(async () => { screen.getByTestId('buy-prod-1').click(); });
    expect(window.location.href).toBe('');
  });

  // ── TIER 2: 401 Retry ─────────────────────────────────────────────────

  it('fetchProducts يعمل retry بعد 401', async () => {
    let productsCalled = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, opts?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/bff/commerce/products') {
        productsCalled++;
        if (productsCalled === 1)
          return { ok: false, status: 401, json: async () => ({}) } as Response;
        return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
      }
      if (url === '/api/auth/refresh')
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => { expect(productsCalled).toBe(2); });
    const calls = (global.fetch as any).mock.calls;
    const refreshCall = calls.find((c: any[]) => c[0] === '/api/auth/refresh');
    expect(refreshCall).toBeDefined();
    expect(refreshCall[1].method).toBe('POST');
  });

  it('بعد 401 و refresh فاشل → مش بيعمل redirect', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/bff/commerce/products' || url === '/api/auth/refresh')
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => { expect(window.location.href).toBe(''); });
  });
});
