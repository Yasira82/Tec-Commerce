import { createHandler, GATEWAY_URL, gatewayGet } from '@/lib/bff/createHandler';

// GET /api/bff/commerce/sales-summary — the signed-in seller's OWN sales: revenue,
// items sold, orders, best sellers, recent sales (C-105 §11 P1-2 — merchant
// analytics inside Commerce). commerce-service aggregates them from its own orders
// — the seller is the verified token's identity there, never a param (P6). Money
// stays a DECIMAL string end to end. A read failure is an empty summary, not a 500:
// the Sales tab's order list must keep working without it.

export interface SalesSummary {
  totalRevenue:   string;
  totalItemsSold: number;
  orderCount:     number;
  topProducts:    { productId: string; title: string; revenue: string; itemsSold: number }[];
  recentSales:    { orderId: string; productId: string; title: string; quantity: number; amount: string; soldAt: string }[];
}

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }): Promise<{ summary: SalesSummary | null }> => {
    const res = await gatewayGet(`${GATEWAY_URL}/api/commerce/orders/seller/sales-summary`, {
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id': ctx.requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
    });
    if (!res.ok) {
      console.warn('[bff/sales-summary] gateway', res.status);
      return { summary: null };
    }
    const body = await res.json().catch(() => null) as { data?: SalesSummary } | null;
    return { summary: body?.data ?? null };
  },
});
