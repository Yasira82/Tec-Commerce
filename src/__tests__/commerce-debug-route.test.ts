// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));

import { GET } from '@/app/api/debug/route';

const makeReq = (cookies: Record<string, string> = {}) => {
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
  return new NextRequest('http://localhost/api/debug', {
    headers: cookieStr ? { Cookie: cookieStr } : {},
  });
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/debug', () => {
  it('returns tokenExists:false and null userId with no cookies', async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.tokenExists).toBe(false);
    expect(body.userCookie).toBeNull();
    expect(body.userId).toBeNull();
  });

  it('returns tokenExists:true when tec_access_token present', async () => {
    const res = await GET(makeReq({ tec_access_token: 'tok123' }));
    const body = await res.json();
    expect(body.tokenExists).toBe(true);
  });

  it('parses tec_user cookie JSON', async () => {
    const res = await GET(makeReq({ tec_user: JSON.stringify({ id: 'u1', piUsername: 'alice' }) }));
    const body = await res.json();
    expect(body.userCookie).toEqual({ id: 'u1', piUsername: 'alice' });
  });

  it('extracts userId from JWT when JWT_SECRET set', async () => {
    const { jwtVerify } = await import('jose');
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: 'user-uuid' } } as any);
    process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!';
    const res = await GET(makeReq({ tec_access_token: 'validtoken' }));
    const body = await res.json();
    expect(body.userId).toBe('user-uuid');
    delete process.env.JWT_SECRET;
  });

  it('returns null userId when JWT verification fails', async () => {
    const { jwtVerify } = await import('jose');
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid signature'));
    process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!';
    const res = await GET(makeReq({ tec_access_token: 'badtoken' }));
    const body = await res.json();
    expect(body.userId).toBeNull();
    delete process.env.JWT_SECRET;
  });
});
