import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor }    from '@testing-library/react';
import React                                      from 'react';
import { SellerOrderCard }                        from '../components/SellerOrderCard';
import { Order }                                  from '../types';

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id:         'order-001',
  product_id: 'prod-001',
  buyer_id:   'buyer-001',
  status:     'paid',
  total:      100,
  payment_id: 'pay-001',
  createdAt:  new Date().toISOString(),
  product: {
    id: 'prod-001', title: 'My Product', description: '',
    price: 100, stock: 5, category: 'Electronics' as const,
    images: [], sellerId: 'seller-001',
    shipping: { country: 'Egypt', city: 'Cairo', shipsTo: [], shippingCost: 0, estimatedDays: '3d' },
    contact: { whatsapp: '+201234567890', telegram: 'buyer' }, // ✅ بدون @
    rating: 0, reviewCount: 0, condition: 'new' as const,
    createdAt: new Date().toISOString(),
  },
  ...overrides,
});

describe('SellerOrderCard', () => {

  beforeEach(() => { vi.clearAllMocks(); });

  it('يعرض order ID', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate: vi.fn() }));
    expect(screen.getByText(/#ORDER-00/i)).toBeDefined();
  });

  it('يعرض status paid — the order to ship', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate: vi.fn() }));
    expect(screen.getByText(/to ship/i)).toBeDefined();
  });

  it('يعرض "Action needed" للـ paid orders', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate: vi.fn() }));
    expect(screen.getByText(/action needed/i)).toBeDefined();
  });

  it('مش بيعرض "Action needed" للـ delivered orders', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder({ status: 'delivered' }), onUpdate: vi.fn() }));
    expect(screen.queryByText(/action needed/i)).toBeNull();
  });

  it('a paid order is shipped — and there is NO seller cancel (a refund is payment-service\'s)', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate: vi.fn() }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.getByText(/mark shipped/i)).toBeDefined();
    expect(screen.queryByText(/cancel order/i)).toBeNull();
    expect(screen.queryByText(/confirm order/i)).toBeNull();
  });

  it('بيعرض Delivered button للـ shipped orders', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder({ status: 'shipped' }), onUpdate: vi.fn() }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.getByText(/mark delivered/i)).toBeDefined();
  });

  it('مش بيعرض action buttons للـ delivered orders', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder({ status: 'delivered' }), onUpdate: vi.fn() }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.queryByText(/mark /i)).toBeNull();
  });

  it('a cart shared with another seller: no actions, and it says why', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder({ soleSeller: false }), onUpdate: vi.fn() }));
    expect(screen.queryByText(/action needed/i)).toBeNull();
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.queryByText(/mark shipped/i)).toBeNull();
    expect(screen.getByText(/another seller/i)).toBeDefined();
  });

  it('Mark Shipped يعرض note modal للـ tracking، ثم يستدعي onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    fireEvent.click(screen.getByText(/mark shipped/i));
    fireEvent.change(screen.getByPlaceholderText(/tracking/i), { target: { value: 'Aramex 9' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => { expect(onUpdate).toHaveBeenCalledWith('order-001', 'shipped', 'Aramex 9'); });
  });

  it('بيعرض buyer contact info', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder(), onUpdate: vi.fn() }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.getByText('+201234567890')).toBeDefined();
    expect(screen.getByText('@buyer')).toBeDefined(); // ✅ ContactItem يضيف @ تلقائياً
  });

  it('يعرض payment ID', () => {
    render(React.createElement(SellerOrderCard, { order: makeOrder({ payment_id: 'pay-abc123' }), onUpdate: vi.fn() }));
    fireEvent.click(screen.getByText('My Product').closest('button')!);
    expect(screen.getByText(/pay-abc/i)).toBeDefined();
  });

});
