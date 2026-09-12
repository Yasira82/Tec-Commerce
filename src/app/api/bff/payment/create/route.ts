import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { z } from 'zod';
import { networkMetadata } from '@/lib/pi-network';

const GW = process.env.API_GATEWAY_URL ?? '';

const CreateSchema = z.object({
  amount:     z.coerce.number().positive(),
  product_id: z.string().min(1),
  memo:       z.string().optional(),
});

const getUserId = (req: NextRequest): string => {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    const u   = JSON.parse(decodeURIComponent(raw));
    return u?.id ?? u?.sub ?? '';
  } catch { return ''; }
};

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });

  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw    = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }

  const res = await fetch(`${GW}/api/payment/create`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': randomUUID(),
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    },
    body: JSON.stringify({
      userId,
      amount:         parsed.data.amount,
      currency:       'PI',
      payment_method: 'pi',
      // The network comes from THIS request's own Host: the Mainnet app and its
      // paired Testnet app are the same deployment on two hosts, so one build
      // cannot answer it. `testnet` selects which Pi API key payment-service
      // approves with, and a client that could set it could pay with Test-Pi
      // and have a consumer grant it something real — so it is derived here and
      // never read from the body (P6).
      //
      // This route's schema accepts no `metadata` at all, so unlike the
      // template apps there is nothing from the client to strip first.
      metadata: {
        source:     'commerce',
        product_id: parsed.data.product_id,
        memo:       parsed.data.memo ?? '',
        ...networkMetadata(req.headers.get('host')),
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
