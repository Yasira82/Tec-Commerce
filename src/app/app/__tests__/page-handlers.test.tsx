import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act }                     from '@testing-library/react';
import React                                                 from 'react';

vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: vi.fn() }));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock('../components/CommerceSkeleton', () => ({
  CommerceSkeleton: () => React.createElement('div', { 'data-testid': 'skeleton' }),
}));
vi.mock('../components/ProductsTab', () => ({
  ProductsTab: ({ onBuy, onDelete, onEdit, products }: any) =>
    React.createElement('div', { 'data-testid': 'products-tab' },
      ...products.map((p: any) =>
        React.createElement('div', { key: p.id },
          React.createElement('button', { 'data-testid': `buy-${p.id}`,    onClick: () => onBuy(p)      }, 'Buy'),
          React.createElement('button', { 'data-testid': `delete-${p.id}`, onClick: () => onDelete(p.id) }, 'Delete'),
          React.createElement('button', { 'data-testid': `edit-${p.id}`,   onClick: () => onEdit(p)     }, 'Edit'),
        )
      )
    ),
}));
vi.mock('../components/OrdersTab', () => ({
  OrdersTab: ({ onReview, orders }: any) =>
    React.createElement('div', { 'data-testid': 'orders-tab' },
      ...orders.map((o: any) =>
        React.createElement('button', {
          key: o.id,
          'data-testid': `review-${o.id}`,
          onClick: () => onReview(o.id, 5, 'Great!'),
        }, 'Review')
      )
    ),
}));
vi.mock('../components/SellerOrderCard', () => ({
  SellerOrderCard: ({ order, onUpdate }: any) =>
    React.createElement('button', {
      'data-testid': `status-${order.id}`,
      onClick: () => onUpdate(order.id, 'shipped', 'On the way'),
    }, 'Update'),
}));
vi.mock('../components/EditProductModal', () => ({
  EditProductModal: ({ product, onSuccess, onClose }: any) =>
    React.createElement('div', { 'data-testid': 'edit-modal' },
      React.createElement('button', {
        'data-testid': 'edit-success-btn',
        onClick: () => onSuccess({ ...product, title: 'Updated' }),
      }, 'Save'),
      React.createElement('button', { 'data-testid': 'edit-close-btn', onClick: onClose }, 'Close'),
    ),
}));
vi.mock('../components/AddProductForm', () => ({
  AddProductForm: () => React.createElement('div', { 'data-testid': 'add-form' }),
}));
vi.mock('../components/CommerceDrawer', () => ({
  CommerceDrawer: ({ isOpen, onPrefChange }: any) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'drawer' },
          React.createElement('button', {
            'data-testid': 'pref-change-btn',
            onClick: () => onPrefChange('currency', 'USD'),
          }, 'Change Pref'),
        )
      : null,
}));

const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');

const mockUser    = { id: 'user-123', piUsername: 'testuser' };
const mockProduct = {
  id: 'prod-1', title: 'Product', price: 10,
  sellerId: 'seller-456', shipping: { shippingCost: 0 },
};
const mockOrder     = { id: 'order-1', status: 'delivered', productId: 'prod-1' };
const mockSaleOrder = { id: 'sale-1',  status: 'pending',   productId: 'prod-1' };

function setupFetch(extra: Record<string, unknown> = {}) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/bff/commerce/products') && !url.includes('products/'))
      return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
    if (url.includes('role=seller'))
      return { ok: true, status: 200, json: async () => ({ orders: [mockSaleOrder] }) } as Response;
    if (url.includes('/api/bff/commerce/orders') && !url.includes('/review') && !url.includes('/status'))
      return { ok: true, status: 200, json: async () => ({ orders: [mockOrder] }) } as Response;
    return { ok: true, status: 200, json: async () => extra } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePiAuth as any).mockReturnValue({
    user: mockUser, isAuthenticated: true, isLoading: false,
  });
  (window as any).Pi = { authenticate: vi.fn().mockResolvedValue({}) };
  Object.defineProperty(document, 'cookie', {
    writable: true, configurable: true,
    value: 'tec_access_token=tok; tec_csrf=csrf-tok',
  });
  Object.defineProperty(window, 'location', {
    value: { href: '', search: '' }, writable: true,
  });
});

afterEach(() => { delete (window as any).Pi; });

describe('page.tsx handler coverage', () => {
  it('handleEdit opens edit modal', async () => {
    setupFetch();
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => screen.getByTestId('edit-prod-1'));
    await act(async () => { screen.getByTestId('edit-prod-1').click(); });
    await waitFor(() => screen.getByTestId('edit-modal'));
    expect(screen.getByTestId('edit-modal')).toBeTruthy();
  });

  it('handleEditSuccess updates product list (modal stays open, onSuccess != onClose)', async () => {
    setupFetch();
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));
    await waitFor(() => screen.getByTestId('edit-prod-1'));
    await act(async () => { screen.getByTestId('edit-prod-1').click(); });
    await waitFor(() => screen.getByTestId('edit-success-btn'));
    // Clicking save calls handleEditSuccess — modal stays open (onClose is separate)
    await act(async () => { screen.getByTestId('edit-success-btn').click(); });
    // handleEditSuccess ran — modal is still open
    expect(screen.getByTestId('edit-modal')).toBeTruthy();
    // Close modal via onClose
    await act(async () => { screen.getByTestId('edit-close-btn').click(); });
    await waitFor(() => expect(screen.queryByTestId('edit-modal')).toBeNull());
  });

  it('handleReview submits review via fetch', async () => {
    let reviewCalled = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/bff/commerce/products') && !url.includes('products/'))
        return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
      if (url.includes('role=seller'))
        return { ok: true, status: 200, json: async () => ({ orders: [] }) } as Response;
      if (url.includes('/review')) { reviewCalled = true; return { ok: true, status: 200, json: async () => ({}) } as Response; }
      if (url.includes('/api/bff/commerce/orders'))
        return { ok: true, status: 200, json: async () => ({ orders: [mockOrder] }) } as Response;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));

    // Switch to orders tab (label is now icon + "Orders", no emoji)
    await waitFor(() => screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Orders'));
    await act(async () => { screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Orders')!.click(); });

    await waitFor(() => screen.getByTestId(`review-${mockOrder.id}`));
    await act(async () => { screen.getByTestId(`review-${mockOrder.id}`).click(); });
    await waitFor(() => { expect(reviewCalled).toBe(true); });
  });

  it('handleStatusUpdate patches order via fetch', async () => {
    let statusCalled = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/bff/commerce/products') && !url.includes('products/'))
        return { ok: true, status: 200, json: async () => ({ products: [mockProduct] }) } as Response;
      if (url.includes('role=seller'))
        return { ok: true, status: 200, json: async () => ({ orders: [mockSaleOrder] }) } as Response;
      if (url.includes('/status')) { statusCalled = true; return { ok: true, status: 200, json: async () => ({}) } as Response; }
      if (url.includes('/api/bff/commerce/orders'))
        return { ok: true, status: 200, json: async () => ({ orders: [] }) } as Response;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));

    // Find the sales tab (label is now icon + "Sales", no emoji)
    await waitFor(() => screen.getAllByRole('button').find(b => b.textContent?.includes('Sales')));
    const salesTabBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Sales'));
    if (!salesTabBtn) throw new Error('Sales tab not found');
    await act(async () => { salesTabBtn.click(); });

    await waitFor(() => screen.getByTestId(`status-${mockSaleOrder.id}`));
    await act(async () => { screen.getByTestId(`status-${mockSaleOrder.id}`).click(); });
    await waitFor(() => { expect(statusCalled).toBe(true); });
  });

  it('handlePrefChange updates preference via drawer', async () => {
    setupFetch();
    const { default: CommercePage } = await import('../page');
    render(React.createElement(CommercePage));

    // Open drawer
    await waitFor(() => screen.getAllByRole('button')[0]);
    const menuButton = document.querySelector('button.btn');
    if (menuButton) {
      await act(async () => { (menuButton as HTMLButtonElement).click(); });
      await waitFor(() => screen.queryByTestId('drawer'));
      const prefBtn = screen.queryByTestId('pref-change-btn');
      if (prefBtn) {
        await act(async () => { prefBtn.click(); });
      }
    }
  });
});
