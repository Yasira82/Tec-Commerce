import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const Schema = z.object({
  amount:     z.number().positive(),
  product_id: z.string(),
  memo:       z.string().optional(),
  source:     z.string().default('commerce'),
});

export const POST = createHandler({
  requireAuth: true,
  schema:      Schema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY_URL}/api/payment/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':    ctx.requestId,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        userId:         ctx.userId,
        amount:         input.amount,
        currency:       'PI',
        payment_method: 'pi',
        metadata: {
          source:     'commerce',
          product_id: input.product_id,
          memo:       input.memo,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error?.message ?? 'Failed');
    return { payment: (data as any)?.data?.payment ?? data };
  },
});
