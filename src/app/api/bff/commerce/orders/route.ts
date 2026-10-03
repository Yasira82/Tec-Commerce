import { createHandler, GATEWAY_URL, gatewayGet, AppError } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const CreateOrderSchema = z.object({
  product_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
  txid:       z.string().optional(),
  // The hold this payment was made for (set by /api/bff/payment/create). With it the
  // order already exists: this call CONFIRMS it, it does not create a second one.
  order_id:   z.string().uuid().optional(),
}).refine((b) => !!b.order_id || !!b.product_id, { message: 'product_id or order_id required' });

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await gatewayGet(
      `${GATEWAY_URL}/api/v1/commerce/orders?buyer_id=${ctx.userId}`,
      {
        headers: {
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) return { orders: [] };
    const data = await res.json();
    return { orders: data?.data?.orders ?? [] };
  },
});

export const POST = createHandler({
  requireAuth: true,
  schema:      CreateOrderSchema,
  handler: async ({ input, ctx, req }) => {
    const headers = {
      'Content-Type':   'application/json',
      Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
      'x-request-id':   ctx.requestId,
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    };

    if (input.order_id) {
      if (!input.payment_id) throw new AppError('payment_id required', 400, 'VALIDATION_ERROR');
      // commerce asks payment-service first: completed · this buyer · this order ·
      // the full amount — nothing here is taken on the client's word. "Not confirmed
      // yet" (503) is not a failure: the payment's own event settles the order.
      const res = await fetch(
        `${GATEWAY_URL}/api/commerce/orders/${encodeURIComponent(input.order_id)}/confirm`,
        { method: 'POST', headers, body: JSON.stringify({ payment_id: input.payment_id }) },
      ).catch(() => null);
      if (!res || res.status === 503) return { order: null, pending: true, order_id: input.order_id };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[bff/commerce/orders] confirm failed after payment', input.order_id, res.status, JSON.stringify(data));
        throw new AppError((data as { message?: string }).message ?? 'Order not confirmed', res.status, 'CONFIRM_FAILED');
      }
      return { order: (data as { data?: { order?: unknown } }).data?.order ?? null };
    }

    // ✅ بعت product_id + buyer_id + payment_id في request واحد
    // Backend بيعمل order PAID مباشرة لو payment_id موجود
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        buyer_id:      ctx.userId,
        product_id:    input.product_id,
        payment_id:    input.payment_id    ?? undefined,
        pi_payment_id: input.txid         ?? undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? 'Failed to create order');
    }

    const data = await res.json();
    return { order: data?.data?.order };
  },
});
