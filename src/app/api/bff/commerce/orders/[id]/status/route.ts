import { createHandler, GATEWAY_URL, AppError } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

// PATCH /api/bff/commerce/orders/:id/status — the seller ships, then delivers.
// commerce-service holds the rule (PAID → SHIPPED → DELIVERED, sole seller only,
// conditional on the status seen); this route only carries the request. It used to
// call a route that did not exist, so "Mark Shipped" never moved any order.
// No seller cancel: cancelling a PAID order is a refund — payment-service's.

const UpdateStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
  note:   z.string().max(500).optional(),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH = createHandler({
  requireAuth: true,
  schema:      UpdateStatusSchema,
  handler: async ({ input, ctx, req }) => {
    const id = req.nextUrl.pathname.split('/orders/')[1]?.split('/status')[0] ?? '';
    if (!UUID.test(id)) throw new AppError('Invalid order id', 400, 'VALIDATION_ERROR');
    const res = await fetch(`${GATEWAY_URL}/api/commerce/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({ status: input.status.toUpperCase(), note: input.note }),
    });
    const data = await res.json().catch(() => ({})) as { message?: string; data?: { order?: unknown } };
    if (!res.ok) throw new AppError(data.message ?? 'Failed to update status', res.status, 'STATUS_UPDATE_FAILED');
    return { order: data.data?.order ?? null };
  },
});
