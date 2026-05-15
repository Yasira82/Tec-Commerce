import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const CreateOrderSchema = z.object({
  product_id: z.string().uuid(),
  payment_id: z.string().optional(),
  txid:       z.string().optional(),
});

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await fetch(
      `${GATEWAY_URL}/api/v1/commerce/orders?buyer_id=${ctx.userId}`,
      {
        headers: {
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
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
      'x-internal-key': process.env.INTERNAL_SECRET ?? '',
    };

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
