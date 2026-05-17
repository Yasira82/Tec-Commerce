import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent }             from '@testing-library/react';
import React                                      from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../components/ProductCard', () => ({
  ProductCard: ({ product, onBuy, onDelete }: any) =>
    React.createElement('div', { 'data-testid': `card-${product.id}` },
      React.createElement('span', null, product.title),
      React.createElement('span', null, `${product.price}π`),
      React.createElement('button', { onClick: () => onBuy(product),   'data-testid': `buy-${product.id}`    }, 'Buy'),
      React.createElement('button', { onClick: () => onDelete(product.id), 'data-testid': `del-${product.id}` }, 'Del'),
    ),
}));

import { ProductsTab } from '../components/ProductsTab';

const makeProduct = (overrides = {}) => ({
  id:          'prod-1',
  title:       'Test Product',
  description: 'A test product',
  price:       50,
  stock:       10,
  category:    'Electronics' as const,
  images:      [],
  sellerId:    'seller-1',
  shipping:    { country: 'Egypt', city: 'Cairo', shipsTo: [], shippingCost: 0, estimatedDays: '3-5 days' },
  contact:     {},
  rating:      4.5,
  reviewCount: 10,
  condition:   'new' as const,
  createdAt:   new Date().toISOString(),
  ...overrides,
});

const defaultProps = {
  userId:      'user-1',
  dataLoading: false,
  onBuy:       vi.fn(),
  onDelete:    vi.fn(),
  onEdit:      vi.fn(),
  onAddFirst:  vi.fn(),
};

describe('ProductsTab', () => {

  beforeEach(() => { vi.clearAllMocks(); });

  // ── Render ────────────────────────────────────────────────────

  it('يعرض skeleton لو dataLoading', () => {
    render(React.createElement(ProductsTab, { ...defaultProps, products: [], dataLoading: true }));
    // Skeleton مش products
    expect(screen.queryByTestId('card-prod-1')).toBeNull();
  });

  it('يعرض empty state لو مفيش products', () => {
    render(React.createElement(ProductsTab, { ...defaultProps, products: [] }));
    expect(screen.getByText(/no products/i)).toBeDefined();
  });

  it('يعرض زر Add First Product في الـ empty state', () => {
    const onAddFirst = vi.fn();
    render(React.createElement(ProductsTab, { ...defaultProps, products: [], onAddFirst }));
    const btn = screen.getByText(/add first product/i);
    fireEvent.click(btn);
    expect(onAddFirst).toHaveBeenCalledOnce();
  });

  it('يعرض المنتجات', () => {
    const products = [makeProduct({ id: 'p1', title: 'Laptop' }), makeProduct({ id: 'p2', title: 'Phone' })];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.getByTestId('card-p2')).toBeDefined();
  });

  it('يعرض عدد المنتجات الصح', () => {
    const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    expect(screen.getByText(/2 products/i)).toBeDefined();
  });

  // ── Search ───────────────────────────────────────────────────

  it('بيفلتر بالـ search', () => {
    const products = [
      makeProduct({ id: 'p1', title: 'Laptop Pro' }),
      makeProduct({ id: 'p2', title: 'Phone X' }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'laptop' } });
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.queryByTestId('card-p2')).toBeNull();
  });

  it('بيعرض no products found لو الـ search مالقاش حاجة', () => {
    const products = [makeProduct({ id: 'p1', title: 'Laptop' })];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'xyz-not-found' } });
    expect(screen.getByText(/no products/i)).toBeDefined();
  });

  // ── Category Filter ───────────────────────────────────────────

  it('بيفلتر بالـ category', () => {
    const products = [
      makeProduct({ id: 'p1', category: 'Electronics' as const }),
      makeProduct({ id: 'p2', category: 'Fashion'     as const }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const fashionBtn = screen.getByText(/Fashion/);
    fireEvent.click(fashionBtn);
    expect(screen.queryByTestId('card-p1')).toBeNull();
    expect(screen.getByTestId('card-p2')).toBeDefined();
  });

  it('All category يرجع كل المنتجات', () => {
    const products = [
      makeProduct({ id: 'p1', category: 'Electronics' as const }),
      makeProduct({ id: 'p2', category: 'Fashion'     as const }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    fireEvent.click(screen.getByText(/Fashion/));
    fireEvent.click(screen.getAllByText('All')[0]);
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.getByTestId('card-p2')).toBeDefined();
  });

  // ── Price Filter ──────────────────────────────────────────────

  it('بيفلتر بـ min price', () => {
    const products = [
      makeProduct({ id: 'p1', price: 10 }),
      makeProduct({ id: 'p2', price: 100 }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    // افتح الـ filter panel
    const filterBtn = screen.getByText('⚙️', { exact: false });
    fireEvent.click(filterBtn);
    const [minInput] = screen.getAllByPlaceholderText('Min');
    fireEvent.change(minInput, { target: { value: '50' } });
    expect(screen.queryByTestId('card-p1')).toBeNull();
    expect(screen.getByTestId('card-p2')).toBeDefined();
  });

  it('بيفلتر بـ max price', () => {
    const products = [
      makeProduct({ id: 'p1', price: 10 }),
      makeProduct({ id: 'p2', price: 100 }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const filterBtn = screen.getByText('⚙️', { exact: false });
    fireEvent.click(filterBtn);
    const [, maxInput] = screen.getAllByPlaceholderText('Max');
    fireEvent.change(maxInput, { target: { value: '50' } });
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.queryByTestId('card-p2')).toBeNull();
  });

  // ── Country Filter ────────────────────────────────────────────

  it('بيفلتر بالـ country', () => {
    const products = [
      makeProduct({ id: 'p1', shipping: { country: 'Egypt',  city: 'Cairo',  shipsTo: [], shippingCost: 0, estimatedDays: '3d' } }),
      makeProduct({ id: 'p2', shipping: { country: 'UAE',    city: 'Dubai',  shipsTo: [], shippingCost: 0, estimatedDays: '5d' } }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const filterBtn = screen.getByText('⚙️', { exact: false });
    fireEvent.click(filterBtn);
    const select = screen.getByDisplayValue('All Countries');
    fireEvent.change(select, { target: { value: 'Egypt' } });
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.queryByTestId('card-p2')).toBeNull();
  });

  // ── Sort ─────────────────────────────────────────────────────

  it('بيرتب بـ price ascending', () => {
    const products = [
      makeProduct({ id: 'p1', price: 100, title: 'Expensive', createdAt: '2024-01-01' }),
      makeProduct({ id: 'p2', price: 10,  title: 'Cheap',     createdAt: '2024-01-02' }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const select = screen.getByDisplayValue('Newest');
    fireEvent.change(select, { target: { value: 'price_asc' } });
    const cards = screen.getAllByText(/π/);
    // السعر الأول المعروض يكون الأصغر
    expect(cards[0].textContent).toContain('10');
  });

  // ── My Products ───────────────────────────────────────────────

  it('Mine filter يعرض منتجات اليوزر بس', () => {
    const products = [
      makeProduct({ id: 'p1', sellerId: 'user-1' }),
      makeProduct({ id: 'p2', sellerId: 'other-user' }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products, userId: 'user-1' }));
    fireEvent.click(screen.getByText('Mine'));
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.queryByTestId('card-p2')).toBeNull();
  });

  // ── Reset Filters ─────────────────────────────────────────────

  it('Reset Filters يرجع كل المنتجات', () => {
    const products = [
      makeProduct({ id: 'p1', price: 10 }),
      makeProduct({ id: 'p2', price: 200 }),
    ];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    const filterBtn = screen.getByText('⚙️', { exact: false });
    fireEvent.click(filterBtn);
    const [minInput] = screen.getAllByPlaceholderText('Min');
    fireEvent.change(minInput, { target: { value: '100' } });
    expect(screen.queryByTestId('card-p1')).toBeNull();
    fireEvent.click(screen.getByText(/reset filters/i));
    expect(screen.getByTestId('card-p1')).toBeDefined();
    expect(screen.getByTestId('card-p2')).toBeDefined();
  });

  // ── Pagination ────────────────────────────────────────────────

  it('يعرض Pagination لو المنتجات أكتر من PAGE_SIZE', () => {
    const products = Array.from({ length: 12 }, (_, i) =>
      makeProduct({ id: `p${i}`, title: `Product ${i}` })
    );
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    expect(screen.getByText('→')).toBeDefined();
  });

  it('مش بيعرض Pagination لو المنتجات أقل من PAGE_SIZE', () => {
    const products = [makeProduct({ id: 'p1' })];
    render(React.createElement(ProductsTab, { ...defaultProps, products }));
    expect(screen.queryByText('→')).toBeNull();
  });

});
