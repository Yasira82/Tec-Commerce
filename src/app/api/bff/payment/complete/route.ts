import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const Schema = z.object({
  payment_id:     z.string().uuid(),
  transaction_id: z.string(),
  pi_payment_id:  z.string().optional(),
});

export const POST = createHandler({
  requireAuth: true,
  schema:      Schema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY_URL}/api/payment/complete`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':    ctx.requestId,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error?.message ?? 'Complete failed');
    return data;
  },
});
