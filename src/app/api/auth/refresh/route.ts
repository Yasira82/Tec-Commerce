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
    // A session is BOTH cookies, so a refresh renews both.
    //
    // This used to renew the token alone. `tec_user` kept the lifetime the
    // sign-in gave it, so a day later the name cookie expired while the token
    // was still being renewed — a half session: the page opened, and every
    // screen said "Not signed in" with no way to sign in again. The values are
    // re-issued exactly as they are, never invented: a cookie that has already
    // lapsed stays lapsed, and the page guard sends that visitor back through
    // SSO (P6).
    const sessionCookieOpts = {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      partitioned: true,
      maxAge:   60 * 60 * 24,
      path:     '/',
    } as const;
    res.cookies.set('tec_access_token', data.token, sessionCookieOpts);
    for (const name of ['tec_user', 'tec_csrf'] as const) {
      const value = req.cookies.get(name)?.value;
      if (value) res.cookies.set(name, value, sessionCookieOpts);
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
