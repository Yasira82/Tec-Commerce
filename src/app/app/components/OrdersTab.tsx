'use client';

import { Order } from '../types';
import { OrderCard } from './OrderCard';

interface Props {
  orders:     Order[];
  onReview?:  (orderId: string, rating: number, comment: string) => void;
  onShop:     () => void;
}

export function OrdersTab({ orders, onReview, onShop }: Props) {
  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
        <div style={{ color: '#4a4a5a', fontSize: 14, marginBottom: 16 }}>No orders yet</div>
        <button onClick={onShop}
          style={{ padding: '10px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
            border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2,
        textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>
        {orders.length} ORDERS
      </div>
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onReview={onReview} />
      ))}
    </div>
  );
}
