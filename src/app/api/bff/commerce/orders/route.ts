import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const CreateOrderSchema = z.object({
  product_id: z.string().uuid(),
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
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/orders`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({
        product_id: input.product_id,
        buyer_id:   ctx.userId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Failed to create order');
    }

    const data = await res.json();
    return { order: data?.data?.order };
  },
});
