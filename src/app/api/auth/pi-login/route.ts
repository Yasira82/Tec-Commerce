import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.API_GATEWAY_URL!;

const fetchWithTimeout = async (url: string, options: RequestInit, ms: number): Promise<Response> => {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }

    let backendRes: Response;
    try {
      backendRes = await fetchWithTimeout(
        `${GATEWAY}/api/v1/auth/pi-login`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accessToken }),
        },
        25000,
      );
    } catch {
      return NextResponse.json(
        { error: 'Auth service timeout — please try again' },
        { status: 504 },
      );
    }

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    if (!data.tokens?.accessToken || !data.tokens?.refreshToken) {
      return NextResponse.json({ error: 'Invalid backend response' }, { status: 502 });
    }

    const res = NextResponse.json({
      success:   data.success,
      isNewUser: data.isNewUser,
      user:      data.user,
    });

    const maxAge     = 60 * 60 * 24;
    const refreshAge = 60 * 60 * 24 * 7;

    res.cookies.set('tec_access_token', data.tokens.accessToken, {
      httpOnly: false, secure: true, sameSite: 'none', partitioned: true, maxAge, path: '/',
    });

    res.cookies.set('tec_refresh_token', data.tokens.refreshToken, {
      httpOnly: true, secure: true, sameSite: 'none', partitioned: true, maxAge: refreshAge, path: '/',
    });

    res.cookies.set('tec_user', JSON.stringify(data.user), {
      httpOnly: false, secure: true, sameSite: 'none', partitioned: true, maxAge, path: '/',
    });

    res.cookies.set('tec_csrf', randomUUID(), {
      httpOnly: false, secure: true, sameSite: 'none', partitioned: true, maxAge, path: '/',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
