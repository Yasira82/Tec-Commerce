import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const UpdateStatusSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'delivered', 'cancelled']),
  note:   z.string().optional(),
});

export const PATCH = createHandler({
  requireAuth: true,
  schema:      UpdateStatusSchema,
  handler: async ({ input, ctx, req }) => {
    const id  = req.url.split('/orders/')[1]?.split('/status')[0] ?? '';
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({
        seller_id: ctx.userId,
        status:    input.status.toUpperCase(),
        note:      input.note,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? 'Failed to update status');
    }
    const data = await res.json();
    return { order: data?.data?.order ?? data?.data };
  },
});
