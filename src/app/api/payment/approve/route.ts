import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, pi_payment_id } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
    }

    const token = req.cookies.get('tec_access_token')?.value;

    const res = await fetch(`${GATEWAY}/api/v1/payment/approve`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${token ?? ''}`,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': randomUUID(), // ✅
      },
      body: JSON.stringify({
        payment_id:    paymentId,
        pi_payment_id: pi_payment_id ?? paymentId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
