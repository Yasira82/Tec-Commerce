import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, pi_payment_id } = body;

    console.log('[approve] body:', JSON.stringify(body));

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
    }

    const token  = req.cookies.get('tec_access_token')?.value;
    const userId = getUserIdFromCookie(req);

    console.log('[approve] token exists:', !!token);

    // ✅ Step 1: اعمل payment في الـ DB
    const createRes = await fetch(`${GATEWAY}/api/v1/payment/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${token ?? ''}`,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': `create-${paymentId}`, // ✅ ثابت لنفس الـ payment
      },
      body: JSON.stringify({
        userId,
        amount:         1,
        currency:       'PI',
        payment_method: 'pi',
        metadata:       { pi_payment_id: pi_payment_id ?? paymentId },
      }),
    });

    const createData = await createRes.json().catch(() => ({}));
    console.log('[approve] create response:', createRes.status, JSON.stringify(createData));

    // ✅ لو 429 — الـ payment اتعمل قبل كده، دور على الـ ID من الـ response
    if (createRes.status === 429) {
      console.log('[approve] rate limited — payment may already exist');
      return NextResponse.json(
        { error: 'Rate limited — try again in a moment' },
        { status: 429 },
      );
    }

    if (!createRes.ok) {
      return NextResponse.json(createData, { status: createRes.status });
    }

    const payment_id = createData?.data?.payment?.id
      ?? createData?.data?.id
      ?? createData?.payment?.id
      ?? createData?.id;

    console.log('[approve] payment_id:', payment_id);

    if (!payment_id) {
      return NextResponse.json({ error: 'Failed to get payment ID' }, { status: 500 });
    }

    // ✅ Step 2: approve بالـ UUID
    const approveRes = await fetch(`${GATEWAY}/api/v1/payment/approve`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${token ?? ''}`,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': `approve-${paymentId}`, // ✅ ثابت
      },
      body: JSON.stringify({
        payment_id,
        pi_payment_id: pi_payment_id ?? paymentId,
      }),
    });

    const approveData = await approveRes.json().catch(() => ({}));
    console.log('[approve] approve response:', approveRes.status, JSON.stringify(approveData));

    return NextResponse.json(
      { ...approveData, payment_id },
      { status: approveRes.status },
    );
  } catch (err) {
    console.error('[approve] error:', err);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}

function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw  = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? null;
  } catch { return null; }
}
