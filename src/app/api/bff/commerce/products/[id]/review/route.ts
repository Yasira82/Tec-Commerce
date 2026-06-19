import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const ReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().min(1).max(500),
});

export const POST = createHandler({
  requireAuth: true,
  schema:      ReviewSchema,
  handler: async ({ input, ctx, req }) => {
    // استخرج الـ orderId من الـ URL
    const segments = new URL(req.url).pathname.split('/');
    const orderId  = segments[segments.indexOf('orders') + 1] ?? '';

    if (!orderId) throw new Error('Order ID is required');

    const res = await fetch(
      `${GATEWAY_URL}/api/v1/commerce/orders/${encodeURIComponent(orderId)}/review`,
      {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        },
        body: JSON.stringify({
          rating:    input.rating,
          comment:   input.comment,
          buyer_id:  ctx.userId,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Failed to submit review');
    }

    const data = await res.json();
    return { review: data?.data?.review };
  },
});
