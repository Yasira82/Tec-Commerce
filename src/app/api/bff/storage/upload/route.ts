import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const csrf       = req.headers.get('x-csrf-token')  ?? '';

  try {
    const formData = await req.formData();
    const res = await fetch(`${GATEWAY}/api/storage/upload`, {
      method:  'POST',
      headers: {
        Authorization:  authHeader,
        'x-csrf-token': csrf,
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
