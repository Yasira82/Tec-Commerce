import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { payoutsCall } from '@/lib/bff/payouts';

// PUT /api/bff/commerce/payouts/address — where the seller wants to be paid.
// commerce-service checks the Stellar checksum (one wrong character = a stranger's
// wallet, for good) and refuses a SECRET key loudly; this only bounds the input.
const Schema = z.object({ wallet_address: z.string().trim().min(1).max(80) });

export const PUT = createHandler({
  requireAuth: true,
  schema:      Schema,
  handler: async ({ input, ctx, req }) => ({
    account: await payoutsCall<{ wallet_address: string }>(req, ctx, 'PUT', '/address', { wallet_address: input.wallet_address }),
  }),
});
