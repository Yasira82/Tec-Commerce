import { createHandler } from '@/lib/bff/createHandler';
import { payoutsCall, type MyPayouts } from '@/lib/bff/payouts';

// GET /api/bff/commerce/payouts — what the signed-in seller is owed, what was sent,
// and where they get paid. The seller is the token's identity (P6) — nothing here
// reads a seller from the URL or the body.
export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => ({ payouts: await payoutsCall<MyPayouts>(req, ctx, 'GET', '/mine') }),
});
