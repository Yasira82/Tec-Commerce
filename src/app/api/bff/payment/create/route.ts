import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { z } from 'zod';
import { networkMetadata } from '@/lib/pi-network';
import { placeHold, releaseHold } from '@/lib/order-hold';

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

  // Hold the unit BEFORE any π moves (lib/order-hold.ts): commerce takes the stock
  // atomically, so of two buyers for the last unit exactly one gets this far. The
  // payment carries the hold's order_id and the order turns PAID from the payment's
  // own event — it is no longer created after the money has moved.
  const commerceHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };
  const hold = await placeHold([{ productId: parsed.data.product_id, qty: 1 }], GW, commerceHeaders);
  if (hold.ok === false) {
    console.warn('[bff/payment/create] hold refused before payment:', hold.error, parsed.data.product_id);
    return NextResponse.json({ error: hold.error, message: hold.message }, { status: hold.status });
  }
  if (hold.ok === 'unsupported') console.warn('[bff/payment/create] commerce has no holds yet — paying without one');
  const orderId = hold.ok === true ? hold.orderId : undefined;
  const giveBack = (why: string) => { if (orderId) void releaseHold(orderId, GW, commerceHeaders, why); };

  // The buyer pays the page's price (+ shipping); the order is priced by commerce.
  // Paying less than the order's total could never be confirmed — money moved, no
  // order — so a price that changed since the page loaded stops HERE.
  if (hold.ok === true && Number.isFinite(hold.total) && parsed.data.amount + 1e-8 < hold.total) {
    giveBack('Price changed before payment');
    return NextResponse.json(
      { error: 'PRICE_CHANGED', message: 'The price has changed — please refresh and try again.' },
      { status: 409 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${GW}/api/payment/create`, {
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
          ...(orderId ? { order_id: orderId } : {}),
          ...networkMetadata(req.headers.get('host')),
        },
      }),
    });
  } catch {
    giveBack('Payment could not be created');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    giveBack('Payment could not be created');
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(
    orderId && data && typeof data === 'object' ? { ...data, order_id: orderId } : data,
    { status: res.status },
  );
}
