import { createHandler } from '@/lib/bff/createHandler';
import { payoutsCall } from '@/lib/bff/payouts';

// POST /api/bff/commerce/payouts/direct — an admin's own sales settle into their own
// wallet, so nothing is owed to them. commerce-service applies it to the CALLER's
// payouts only (now and later); it can never touch another seller's.
export const POST = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => payoutsCall<{ settled: number }>(req, ctx, 'POST', '/direct'),
});
