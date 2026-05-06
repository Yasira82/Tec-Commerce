import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, pi_payment_id } = body;

    console.log('[approve] body received:', JSON.stringify(body));

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
    }

    const token = req.cookies.get('tec_access_token')?.value;
    console.log('[approve] token exists:', !!token);

    const requestBody = {
      payment_id:    paymentId,
      pi_payment_id: pi_payment_id ?? paymentId,
    };

    console.log('[approve] sending to gateway:', JSON.stringify(requestBody));

    const res = await fetch(`${GATEWAY}/api/v1/payment/approve`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${token ?? ''}`,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[approve] gateway response:', res.status, JSON.stringify(data));

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[approve] error:', err);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
