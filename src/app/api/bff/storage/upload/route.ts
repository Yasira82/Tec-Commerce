import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL
  ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    const formData = await req.formData();

    const res = await fetch(`${GATEWAY}/api/storage/upload`, {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${token}`,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message ?? 'Upload failed' },
        { status: res.status },
      );
    }

    // ✅ normalize — أي response structure
    const url = data?.url
      ?? data?.data?.url
      ?? data?.fileUrl
      ?? data?.data?.fileUrl
      ?? null;

    return NextResponse.json({ url, raw: data });
  } catch (err) {
    console.error('Storage upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
