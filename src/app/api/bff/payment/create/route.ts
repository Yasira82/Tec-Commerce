import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GW = process.env.API_GATEWAY_URL ?? '';

const CreateSchema = z.object({
  amount:     z.number().positive(),
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
      'Idempotency-Key': crypto.randomUUID(),
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    },
    body: JSON.stringify({
      userId,
      amount:         parsed.data.amount,
      currency:       'PI',
      payment_method: 'pi',
      metadata: {
        source:     'commerce',
        product_id: parsed.data.product_id,
        memo:       parsed.data.memo ?? '',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
