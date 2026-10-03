import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { placeHold, releaseHold } from '@/lib/order-hold';

// POST /api/bff/commerce/orders/hold — reserve the unit before the buyer is sent to
// the Hub to pay (Mode 1). The Hub only carries `order_id` into the payment's
// metadata; the payment's event turns this hold into a PAID order. Same rule as
// payment/create: the hold takes the unit, and a changed price stops here.

const GW = process.env.API_GATEWAY_URL ?? '';

const HoldSchema = z.object({
  product_id: z.string().uuid(),
  amount:     z.coerce.number().positive(),
});

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = HoldSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };
  const hold = await placeHold([{ productId: parsed.data.product_id, qty: 1 }], GW, headers);
  if (hold.ok === false) return NextResponse.json({ error: hold.error, message: hold.message }, { status: hold.status });
  if (hold.ok === 'unsupported') return NextResponse.json({ success: true, data: { order_id: null } });
  if (Number.isFinite(hold.total) && parsed.data.amount + 1e-8 < hold.total) {
    void releaseHold(hold.orderId, GW, headers, 'Price changed before payment');
    return NextResponse.json(
      { error: 'PRICE_CHANGED', message: 'The price has changed — please refresh and try again.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true, data: { order_id: hold.orderId } }, { status: 201 });
}
