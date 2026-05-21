import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const Schema = z.object({
  pi_payment_id: z.string(),
});

export const POST = createHandler({
  requireAuth: true,
  schema:      Schema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(
      `${GATEWAY_URL}/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(input.pi_payment_id)}`,
      {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({ pi_payment_id: input.pi_payment_id }),
      },
    );

    const data = await res.json().catch(() => ({}));
    return data;
  },
});
