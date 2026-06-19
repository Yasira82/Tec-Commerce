import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(
        `${GATEWAY_URL}/api/wallets?userId=${encodeURIComponent(ctx.userId)}`,
        {
          headers: {
            'Authorization':  `Bearer ${token}`,
            'x-request-id':   ctx.requestId,
            ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
          },
          cache:  'no-store',
          signal: controller.signal,
        },
      );
    } catch {
      return { balance: 0, currency: 'PI', address: null, walletId: null };
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return { balance: 0, currency: 'PI', address: null, walletId: null };

    const data = await res.json().catch(() => ({}));

    interface Wallet {
      id:             string;
      balance:        number;
      currency:       string;
      is_primary:     boolean;
      wallet_address: string | null;
      updated_at:     string;
    }

    const wallets: Wallet[] = data?.wallets ?? data?.data?.wallets ?? [];
    const piWallets = wallets.filter(w => w.currency === 'PI');
    const primary   = piWallets
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .find(w => w.is_primary) ?? piWallets[0] ?? wallets[0];

    return {
      balance:  primary ? Number(primary.balance) : 0,
      currency: primary?.currency       ?? 'PI',
      address:  primary?.wallet_address ?? null,
      walletId: primary?.id             ?? null,
    };
  },
});
