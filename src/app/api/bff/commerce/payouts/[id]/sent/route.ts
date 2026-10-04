import { z } from 'zod';
import { AppError, createHandler } from '@/lib/bff/createHandler';
import { payoutsCall, type Payout } from '@/lib/bff/payouts';

// POST /api/bff/commerce/payouts/:id/sent — an admin records a payout sent by hand.
// commerce-service checks the hash ON THE CHAIN (via payment-service): it must pay
// this seller's address at least what is owed, and pay only this payout. Here only
// the shape is checked, so a slip of the thumb never leaves the phone.
const Schema = z.object({ tx_id: z.string().trim().regex(/^[0-9a-fA-F]{64}$/, 'Paste the 64-character transaction hash') });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = createHandler({
  requireAuth: true,
  schema:      Schema,
  handler: async ({ input, ctx, req }) => {
    const id = req.nextUrl.pathname.split('/payouts/')[1]?.split('/sent')[0] ?? '';
    if (!UUID.test(id)) throw new AppError('Invalid payout id', 400, 'VALIDATION_ERROR');
    const data = await payoutsCall<{ payout: Payout }>(req, ctx, 'POST', `/${id}/sent`, { tx_id: input.tx_id });
    return { payout: data?.payout ?? null };
  },
});
