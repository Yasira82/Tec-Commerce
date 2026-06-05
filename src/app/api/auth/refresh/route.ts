import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('tec_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const GATEWAY = process.env.API_GATEWAY_URL!;

    const backendRes = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const res = NextResponse.json({ token: data.token });

    // ✅ تحديث الـ access token cookie
    res.cookies.set('tec_access_token', data.token, {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      maxAge:   60 * 60 * 24,
      path:     '/',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
