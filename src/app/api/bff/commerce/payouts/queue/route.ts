import { createHandler } from '@/lib/bff/createHandler';
import { payoutsCall, type Payout } from '@/lib/bff/payouts';

// GET /api/bff/commerce/payouts/queue?status=OWED — the admin's payout queue.
// Admin is decided by commerce-service from the token (role: 'admin'); anyone else
// gets its 403, which the screen reads as "this section is not for you".
const STATUSES = ['OWED', 'SENT', 'DIRECT'];

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const asked  = (req.nextUrl.searchParams.get('status') ?? '').toUpperCase();
    const status = STATUSES.includes(asked) ? asked : 'OWED';
    const data = await payoutsCall<{ payouts: Payout[] }>(req, ctx, 'GET', `?status=${status}`);
    return { payouts: data?.payouts ?? [] };
  },
});
