// @vitest-environment node
/**
 * F2 (#78): the seller sees what they are owed and sets where to be paid; an admin
 * works the payout queue. The BFF only carries the request — commerce-service
 * derives the seller from the token and decides who is an admin. Its refusals
 * (a typo'd address, a reused hash, "admin only") reach the screen as they are.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';

const PAYOUT = '11111111-2222-4333-8444-555555555555';
const HASH = 'a'.repeat(64);
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  process.env.API_GATEWAY_URL = 'https://gw';
  process.env.JWT_SECRET = 'test-secret-32chars-exactly-ok';
  vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: 'seller-1' } } as never);
});
afterEach(() => vi.unstubAllGlobals());

const req = (url: string, method = 'GET', body?: unknown, signedIn = true) => {
  const r = new NextRequest(`https://commerce.tecosystem.app${url}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (signedIn) r.cookies.set('tec_access_token', 'tok');
  return r;
};
const stub = (status: number, body: unknown) => {
  fetchMock = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => answer(status, body));
  vi.stubGlobal('fetch', fetchMock);
};
const sent = () => ({ url: String(fetchMock.mock.calls[0][0]), init: fetchMock.mock.calls[0][1] as RequestInit });

describe('GET /api/bff/commerce/payouts — the seller\'s own', () => {
  it('reads /payouts/mine with the session token, nothing from the URL', async () => {
    stub(200, { data: { owed: '10', sent: '0', wallet_address: null, direct: false, payouts: [] } });
    const { GET } = await import('@/app/api/bff/commerce/payouts/route');
    const body = await (await GET(req('/api/bff/commerce/payouts?seller=someone-else'))).json();
    expect(sent().url).toBe('https://gw/api/commerce/payouts/mine');
    expect((sent().init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(body.payouts.owed).toBe('10');
  });

  it('no session is a 401 before anything is asked', async () => {
    stub(200, {});
    const { GET } = await import('@/app/api/bff/commerce/payouts/route');
    expect((await GET(req('/api/bff/commerce/payouts', 'GET', undefined, false))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PUT /api/bff/commerce/payouts/address', () => {
  it('carries the address; the service\'s checksum message comes back as is', async () => {
    stub(400, { message: 'That address has a typo — it fails its own checksum.' });
    const { PUT } = await import('@/app/api/bff/commerce/payouts/address/route');
    const res = await PUT(req('/api/bff/commerce/payouts/address', 'PUT', { wallet_address: 'GABC' }));
    expect(sent().init.method).toBe('PUT');
    expect(JSON.parse(String(sent().init.body))).toEqual({ wallet_address: 'GABC' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/typo/);
  });

  it('refuses an empty or absurd value before the gateway', async () => {
    stub(200, {});
    const { PUT } = await import('@/app/api/bff/commerce/payouts/address/route');
    expect((await PUT(req('/api/bff/commerce/payouts/address', 'PUT', { wallet_address: '' }))).status).toBe(400);
    expect((await PUT(req('/api/bff/commerce/payouts/address', 'PUT', { wallet_address: 'G'.repeat(200) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the admin desk', () => {
  it('the queue passes the status; a non-admin\'s 403 comes back as 403', async () => {
    stub(403, { message: 'Admin only' });
    const { GET } = await import('@/app/api/bff/commerce/payouts/queue/route');
    const res = await GET(req('/api/bff/commerce/payouts/queue?status=SENT'));
    expect(sent().url).toBe('https://gw/api/commerce/payouts?status=SENT');
    expect(res.status).toBe(403);
  });

  it('an unknown status is not passed on', async () => {
    stub(200, { data: { payouts: [] } });
    const { GET } = await import('@/app/api/bff/commerce/payouts/queue/route');
    await GET(req('/api/bff/commerce/payouts/queue?status=whatever'));
    expect(sent().url).toBe('https://gw/api/commerce/payouts?status=OWED');
  });

  it('Mark sent carries the hash to /:id/sent, and refuses a non-hash before the gateway', async () => {
    stub(200, { data: { payout: { id: PAYOUT, status: 'SENT' } } });
    const { POST } = await import('@/app/api/bff/commerce/payouts/[id]/sent/route');
    const ok = await POST(req(`/api/bff/commerce/payouts/${PAYOUT}/sent`, 'POST', { tx_id: HASH }));
    expect(ok.status).toBe(200);
    expect(sent().url).toBe(`https://gw/api/commerce/payouts/${PAYOUT}/sent`);
    expect(JSON.parse(String(sent().init.body))).toEqual({ tx_id: HASH });

    stub(200, {});
    expect((await POST(req(`/api/bff/commerce/payouts/${PAYOUT}/sent`, 'POST', { tx_id: '1' }))).status).toBe(400);
    expect((await POST(req('/api/bff/commerce/payouts/not-a-uuid/sent', 'POST', { tx_id: HASH }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a chain refusal reaches the admin word for word', async () => {
    stub(400, { message: 'This transaction pays a different address. Nothing was recorded.' });
    const { POST } = await import('@/app/api/bff/commerce/payouts/[id]/sent/route');
    const res = await POST(req(`/api/bff/commerce/payouts/${PAYOUT}/sent`, 'POST', { tx_id: HASH }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/different address/);
  });

  it('"my sales settle directly" posts to /direct', async () => {
    stub(200, { data: { settled: 2 } });
    const { POST } = await import('@/app/api/bff/commerce/payouts/direct/route');
    const body = await (await POST(req('/api/bff/commerce/payouts/direct', 'POST', {}))).json();
    expect(sent().url).toBe('https://gw/api/commerce/payouts/direct');
    expect(body.settled).toBe(2);
  });
});
