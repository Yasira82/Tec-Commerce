// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));

import { jwtVerify } from 'jose';
import { GET as listOrders, POST as createOrder } from '../app/api/bff/commerce/orders/route';
import { PATCH as patchStatus } from '../app/api/bff/commerce/orders/[id]/status/route';

const mockJwtVerify = vi.mocked(jwtVerify);

const PRODUCT_UUID = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';

const makeReq = (opts: {
  url?:     string;
  cookies?: Record<string, string>;
  body?:    unknown;
  method?:  string;
} = {}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/commerce/orders', {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
};

const authedCookies = { tec_access_token: 'jwt-token' };

const primeAuth = (sub = 'buyer-1') => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockJwtVerify.mockResolvedValue({ payload: { sub, kycVerified: true } } as any);
};

const mockFetchOnce = (status: number, json: unknown) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300, status, json: async () => json,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET      = 'test-secret-32chars-exactly-ok';
  process.env.INTERNAL_SECRET = 'internal-secret-test';
  global.fetch = vi.fn();
});

// ── GET orders ───────────────────────────────────────────────────

describe('GET /api/bff/commerce/orders', () => {
  it('401 when session cookie missing — gateway never called', async () => {
    const res = await listOrders(makeReq());
    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('401 when JWT invalid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('expired'));
    const res = await listOrders(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(401);
  });

  it('scopes orders to the authenticated buyer (buyer_id from JWT)', async () => {
    primeAuth('buyer-42');
    mockFetchOnce(200, { data: { orders: [{ id: 'o1' }] } });
    const res = await listOrders(makeReq({
      // attacker tries to read another buyer's orders via query — must be ignored
      url:     'http://localhost/api/bff/commerce/orders?buyer_id=victim-9',
      cookies: authedCookies,
    }));
    expect(res.status).toBe(200);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('buyer_id=buyer-42');
    expect(String(url)).not.toContain('victim-9');
    expect((await res.json()).orders).toEqual([{ id: 'o1' }]);
  });

  it('returns empty orders on gateway error', async () => {
    primeAuth();
    mockFetchOnce(502, {});
    const res = await listOrders(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orders: [] });
  });

  it('returns empty orders when gateway payload malformed', async () => {
    primeAuth();
    mockFetchOnce(200, { weird: true });
    const res = await listOrders(makeReq({ cookies: authedCookies }));
    expect((await res.json()).orders).toEqual([]);
  });
});

// ── POST orders — order creation flow ────────────────────────────

describe('POST /api/bff/commerce/orders', () => {
  it('401 when unauthenticated', async () => {
    const res = await createOrder(makeReq({ method: 'POST', body: { product_id: PRODUCT_UUID } }));
    expect(res.status).toBe(401);
  });

  it('400 when product_id is not a UUID', async () => {
    primeAuth();
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies, body: { product_id: 'not-a-uuid' },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_ERROR');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('creates order: buyer_id from session, payment_id + txid forwarded', async () => {
    primeAuth('buyer-7');
    mockFetchOnce(200, { data: { order: { id: 'order-1', status: 'PAID' } } });
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { product_id: PRODUCT_UUID, payment_id: 'pay-123', txid: 'tx-abc' },
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).order.id).toBe('order-1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/commerce/orders');
    expect(init.method).toBe('POST');
    expect(init.headers['x-internal-key']).toBe('internal-secret-test');
    const forwarded = JSON.parse(init.body);
    expect(forwarded).toMatchObject({
      buyer_id:      'buyer-7',
      product_id:    PRODUCT_UUID,
      payment_id:    'pay-123',
      pi_payment_id: 'tx-abc',
    });
  });

  it('SECURITY: client-sent buyer_id / merchantId is ignored — identity from JWT only', async () => {
    primeAuth('buyer-7');
    mockFetchOnce(200, { data: { order: { id: 'order-2' } } });
    await createOrder(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { product_id: PRODUCT_UUID, buyer_id: 'attacker-1', merchantId: 'attacker-1' },
    }));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const forwarded = JSON.parse(init.body);
    expect(forwarded.buyer_id).toBe('buyer-7');
    expect(forwarded.merchantId).toBeUndefined();
  });

  it('order without payment_id forwards undefined payment fields', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { order: { id: 'order-3', status: 'PENDING' } } });
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies, body: { product_id: PRODUCT_UUID },
    }));
    expect(res.status).toBe(200);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const forwarded = JSON.parse(init.body);
    expect(forwarded.payment_id).toBeUndefined();
    expect(forwarded.pi_payment_id).toBeUndefined();
  });

  it('payment_id mismatch upstream → fails closed with 500 (no silent success)', async () => {
    primeAuth();
    mockFetchOnce(422, { message: 'payment_id mismatch' });
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { product_id: PRODUCT_UUID, payment_id: 'wrong-payment' },
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
  });

  it('duplicate order upstream (409) → fails closed with 500', async () => {
    primeAuth();
    mockFetchOnce(409, { message: 'Order already exists' });
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { product_id: PRODUCT_UUID, payment_id: 'pay-123' },
    }));
    expect(res.status).toBe(500);
  });

  it('handles non-JSON gateway error body', async () => {
    primeAuth();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => { throw new Error('nope'); },
    });
    const res = await createOrder(makeReq({
      method: 'POST', cookies: authedCookies, body: { product_id: PRODUCT_UUID },
    }));
    expect(res.status).toBe(500);
  });
});

// ── PATCH order status (seller action) ───────────────────────────

const statusUrl = 'http://localhost/api/bff/commerce/orders/order-55/status';

describe('PATCH /api/bff/commerce/orders/[id]/status', () => {
  it('401 when seller session missing', async () => {
    const res = await patchStatus(makeReq({ url: statusUrl, method: 'PATCH', body: { status: 'shipped' } }));
    expect(res.status).toBe(401);
  });

  it('400 on invalid status value', async () => {
    primeAuth('seller-1');
    const res = await patchStatus(makeReq({
      url: statusUrl, method: 'PATCH', cookies: authedCookies, body: { status: 'teleported' },
    }));
    expect(res.status).toBe(400);
  });

  it('SECURITY: seller_id comes from the session JWT, never the body', async () => {
    primeAuth('seller-9');
    mockFetchOnce(200, { data: { order: { id: 'order-55', status: 'SHIPPED' } } });
    const res = await patchStatus(makeReq({
      url: statusUrl, method: 'PATCH', cookies: authedCookies,
      body: { status: 'shipped', seller_id: 'attacker-2', note: 'on its way' },
    }));
    expect(res.status).toBe(200);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/commerce/orders/order-55/status');
    const forwarded = JSON.parse(init.body);
    expect(forwarded.seller_id).toBe('seller-9');
    expect(forwarded.status).toBe('SHIPPED'); // uppercased for backend
    expect(forwarded.note).toBe('on its way');
  });

  it('returns order from gateway data fallback', async () => {
    primeAuth('seller-9');
    mockFetchOnce(200, { data: { id: 'order-55', status: 'DELIVERED' } });
    const res  = await patchStatus(makeReq({
      url: statusUrl, method: 'PATCH', cookies: authedCookies, body: { status: 'delivered' },
    }));
    expect((await res.json()).order.status).toBe('DELIVERED');
  });

  it('terminal-state transition rejected upstream → 500 fail closed', async () => {
    primeAuth('seller-9');
    mockFetchOnce(409, { message: 'terminal state' });
    const res = await patchStatus(makeReq({
      url: statusUrl, method: 'PATCH', cookies: authedCookies, body: { status: 'cancelled' },
    }));
    expect(res.status).toBe(500);
  });
});
