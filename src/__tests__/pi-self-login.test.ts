/**
 * POST /api/auth/pi-self-login — the app signs itself in (C-123 §10), ported from
 * the template's pi-login. Pi's token → the gateway → a ONE-TIME token addressed to
 * this origin, which /api/auth/sso-callback already accepts (issuer `tec.pi`).
 * It sets no cookies itself: an XHR cookie is the one LAW 1 says gets dropped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = 'test-sso-secret-at-least-32-characters-long';

describe('POST /api/auth/pi-self-login', () => {
  beforeEach(() => { vi.resetModules(); process.env.API_GATEWAY_URL = 'https://gw.internal'; process.env.SSO_SECRET = SECRET; });
  afterEach(() => { vi.unstubAllGlobals(); });
  const post = async (body: unknown) => {
    const { POST } = await import('../app/api/auth/pi-self-login/route');
    return POST(new NextRequest('https://app.tecosystem.app/api/auth/pi-self-login', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    }));
  };

  it("exchanges Pi's token for a one-time token addressed to THIS origin", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tokens: { accessToken: 'tec-at', refreshToken: 'tec-rt' }, user: { id: 'u1', piUsername: 'pioneer' },
    }), { status: 200 })));
    const res = await post({ accessToken: 'pi-token' });
    expect(res.status).toBe(200);
    const { ssoToken } = await res.json();
    const { payload } = await jwtVerify(ssoToken, new TextEncoder().encode(SECRET), { issuer: 'tec.pi', audience: 'https://app.tecosystem.app' });
    expect(payload.accessToken).toBe('tec-at');
    expect((payload.user as { piUsername: string }).piUsername).toBe('pioneer');
    expect(payload.jti).toBeTruthy();
  });

  it('sets NO cookies itself', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tokens: { accessToken: 'a', refreshToken: 'r' }, user: { id: 'u' } }), { status: 200 })));
    expect((await post({ accessToken: 'pi-token' })).headers.get('set-cookie')).toBeNull();
  });

  it('fails closed: refused by auth, or no user in the answer, is not a session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect((await post({ accessToken: 'pi-token' })).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tokens: { accessToken: 'a' } }), { status: 200 })));
    expect((await post({ accessToken: 'pi-token' })).status).toBe(502);
  });

  it('refuses a request with no Pi token, and says so when unconfigured', async () => {
    expect((await post({})).status).toBe(400);
    delete process.env.SSO_SECRET;
    expect((await post({ accessToken: 'pi-token' })).status).toBe(503);
  });
});
