import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor }    from '@testing-library/react';
import React                                      from 'react';
import { OrderCard }                              from '../components/OrderCard';
import { Order }                                  from '../types';

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id:         'order-001',
  product_id: 'prod-001',
  buyer_id:   'user-001',
  status:     'pending',
  total:      50,
  payment_id: 'pay-001',
  createdAt:  new Date().toISOString(),
  product: {
    id: 'prod-001', title: 'Test Product', description: '',
    price: 50, stock: 10, category: 'Electronics' as const,
    images: [], sellerId: 'seller-001',
    shipping: { country: 'Egypt', city: 'Cairo', shipsTo: [], shippingCost: 0, estimatedDays: '3d' },
    contact: {}, rating: 0, reviewCount: 0, condition: 'new' as const,
    createdAt: new Date().toISOString(),
  },
  ...overrides,
});

describe('OrderCard', () => {

  beforeEach(() => { vi.clearAllMocks(); });

  // ── Render ────────────────────────────────────────────────────

  it('يعرض order ID', () => {
    render(React.createElement(OrderCard, { order: makeOrder() }));
    expect(screen.getByText(/#ORDER-00/i)).toBeDefined();
  });

  it('يعرض status badge للـ pending', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'pending' }) }));
    expect(screen.getByText(/pending/i)).toBeDefined();
  });

  it('يعرض status badge للـ delivered', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'delivered' }) }));
    expect(screen.getByText(/delivered/i)).toBeDefined();
  });

  it('يعرض اسم المنتج', () => {
    render(React.createElement(OrderCard, { order: makeOrder() }));
    expect(screen.getByText('Test Product')).toBeDefined();
  });

  it('يعرض السعر', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ total: 75 }) }));
    expect(screen.getByText('75π')).toBeDefined();
  });

  // ── Expand ───────────────────────────────────────────────────

  it('بيفتح الـ expanded section لما تضغط', () => {
    render(React.createElement(OrderCard, { order: makeOrder() }));
    const header = screen.getByText('Test Product').closest('button');
    fireEvent.click(header!);
    // Timeline يظهر بعد expand
    expect(screen.getByText(/Order Placed/i)).toBeDefined();
  });

  it('بيعرض cancelled state في الـ timeline', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'cancelled' }) }));
    const header = screen.getByText('Test Product').closest('button');
    fireEvent.click(header!);
    expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
  });

  // ── Timeline Events ───────────────────────────────────────────

  it('يعرض timeline events من الـ backend', () => {
    const order = makeOrder({
      status:   'shipped',
      timeline: [
        { status: 'pending',   note: 'Order created',    created_at: new Date().toISOString() },
        { status: 'confirmed', note: 'Seller confirmed',  created_at: new Date().toISOString() },
        { status: 'shipped',   note: 'Tracking: EG12345', created_at: new Date().toISOString() },
      ],
    });
    render(React.createElement(OrderCard, { order }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    expect(screen.getByText('Tracking: EG12345')).toBeDefined();
  });

  // ── Review ───────────────────────────────────────────────────

  it('مش بيعرض review button لو status مش delivered', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'pending' }) }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    expect(screen.queryByText(/leave a review/i)).toBeNull();
  });

  it('بيعرض review button لو delivered وملكيش review', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'delivered' }) }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    expect(screen.getByText(/leave a review/i)).toBeDefined();
  });

  it('بيعرض review form لما تضغط على Leave a Review', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'delivered' }) }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    fireEvent.click(screen.getByText(/leave a review/i));
    expect(screen.getByText(/rate this product/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/share your experience/i)).toBeDefined();
  });

  it('Submit review يستدعي onReview بالـ rating والـ comment', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'delivered' }), onReview }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    fireEvent.click(screen.getByText(/leave a review/i));
    const textarea = screen.getByPlaceholderText(/share your experience/i);
    fireEvent.change(textarea, { target: { value: 'Great product!' } });
    fireEvent.click(screen.getByText(/submit review/i));
    await waitFor(() => { expect(onReview).toHaveBeenCalledWith('order-001', 5, 'Great product!'); });
  });

  it('Submit button disabled لو comment فارغ', () => {
    render(React.createElement(OrderCard, { order: makeOrder({ status: 'delivered' }) }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    fireEvent.click(screen.getByText(/leave a review/i));
    const submitBtn = screen.getByText(/submit review/i);
    expect(submitBtn.getAttribute('disabled')).toBeDefined();
  });

  it('بيعرض existing review', () => {
    const order = makeOrder({
      status: 'delivered',
      review: { id: 'r1', userId: 'u1', username: 'user', rating: 4, comment: 'Very good!', createdAt: new Date().toISOString() },
    });
    render(React.createElement(OrderCard, { order }));
    fireEvent.click(screen.getByText('Test Product').closest('button')!);
    expect(screen.getByText('Very good!')).toBeDefined();
  });

});
