import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';

export const DELETE = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const id = req.url.split('/').pop() ?? '';

    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/products/${id}`, {
      method:  'DELETE',
      headers: {
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
    });

    if (!res.ok) throw new Error('Failed to delete product');
    return { success: true };
  },
});
