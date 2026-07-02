import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
const mockJwtVerify = vi.mocked(jwtVerify);

// ✅ Helper — NextRequest mock صح
const makeRequest = (url: string) => ({
  nextUrl: new URL(url),
  url,
  cookies: { get: () => undefined, getAll: () => [] },
});

describe('SSO Callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SSO_SECRET = 'test-secret';
  });

  it('rejects missing token', async () => {
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const req = makeRequest('https://tec-assets.vercel.app/api/auth/sso-callback');
    const res = await GET(req as any);
    expect(res.status).toBe(307);
  });

  it('rejects invalid token', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid signature'));
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const req = makeRequest('https://tec-assets.vercel.app/api/auth/sso-callback?token=bad');
    const res = await GET(req as any);
    expect(res.status).toBe(307);
  });

  it('rejects replay — same jti twice', async () => {
    const payload = {
      sub:         'user-123',
      jti:         'unique-jti-replay',
      accessToken: 'tok_xxx',
      user:        { id: 'user-123', piUsername: 'yas55eR82' },
    };
    mockJwtVerify.mockResolvedValue({ payload } as any);

    vi.resetModules();
    const { GET } = await import('@/app/api/auth/sso-callback/route');

    const req1 = makeRequest('https://tec-assets.vercel.app/api/auth/sso-callback?token=valid');
    const res1 = await GET(req1 as any);
    // C-123 LAW 2: cookies ride a 200 HTML landing page, never a 3xx.
    expect(res1.status).toBe(200);

    const req2 = makeRequest('https://tec-assets.vercel.app/api/auth/sso-callback?token=valid');
    const res2 = await GET(req2 as any);
    expect(res2.status).toBe(401);
  });

  it('sets cookies on valid token', async () => {
    const payload = {
      sub:         'user-123',
      jti:         'unique-jti-cookies',
      accessToken: 'tok_valid',
      user:        { id: 'user-123', piUsername: 'yas55eR82' },
    };
    mockJwtVerify.mockResolvedValue({ payload } as any);

    vi.resetModules();
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const req = makeRequest('https://tec-assets.vercel.app/api/auth/sso-callback?token=valid');
    const res = await GET(req as any);

    // C-123: 200 HTML landing with verified entry — cookies on the 200, Partitioned.
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c: string) => c.includes('Partitioned'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('tec_access_token'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('tec_user'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('tec_csrf'))).toBe(true);
  });
});
