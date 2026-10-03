// @vitest-environment node
/**
 * The last unit in Commerce (3 Oct 2026). Orders were created AFTER Pi had moved
 * the money, so two buyers could both pay for the last unit. Now payment/create
 * HOLDS it first (commerce takes the stock atomically), the payment carries the
 * hold's order_id, and the order is confirmed — never created a second time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';

const HOLD = '11111111-2222-4333-8444-555555555555';
const PRODUCT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;

let routes: Record<string, Response | (() => never)>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  process.env.API_GATEWAY_URL = 'https://gw';
  process.env.JWT_SECRET = 'test-secret-32chars-exactly-ok';
  vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: 'buyer-1' } } as never);
  routes = {};
  fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
    const hit = Object.keys(routes).find((k) => String(url).includes(k));
    if (!hit) return answer(500, {});
    const r = routes[hit];
    if (typeof r === 'function') r();
    return r as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const calls = (part: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(part));
const req = (url: string, method: string, body?: unknown) => {
  const r = new NextRequest(`https://commerce.tecosystem.app${url}`, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  r.cookies.set('tec_access_token', 'tok');
  r.cookies.set('tec_user', encodeURIComponent(JSON.stringify({ id: 'buyer-1' })));
  return r;
};
const held = (total = '12.00000000') => answer(201, { data: { order: { id: HOLD, total, status: 'PENDING' } } });

describe('payment/create — the unit is held before any π moves', () => {
  it('holds, names the hold in the payment, and answers its order_id', async () => {
    routes['/orders/hold'] = held();
    routes['/api/payment/create'] = answer(201, { data: { payment: { id: 'pay-1' } } });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 12, product_id: PRODUCT }));
    expect(res.status).toBe(201);
    expect(JSON.parse(String(calls('/orders/hold')[0][1]?.body))).toEqual({ items: [{ product_id: PRODUCT, quantity: 1 }] });
    expect(JSON.parse(String(calls('/api/payment/create')[0][1]?.body)).metadata.order_id).toBe(HOLD);
    expect(await res.json()).toMatchObject({ order_id: HOLD });
  });

  it('the second buyer of the last unit is refused BEFORE paying', async () => {
    routes['/orders/hold'] = answer(400, { message: 'Insufficient stock for: Cap' });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 12, product_id: PRODUCT }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'OUT_OF_STOCK', message: 'Cap is out of stock.' });
    expect(calls('/api/payment/create')).toHaveLength(0);
  });

  it('a price that rose since the page loaded stops here, and the unit goes back', async () => {
    routes['/orders/hold'] = held('15.00000000');
    routes[`/orders/${HOLD}/cancel`] = answer(200, {});
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 12, product_id: PRODUCT }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'PRICE_CHANGED' });
    expect(calls('/api/payment/create')).toHaveLength(0);
    expect(calls('/cancel')).toHaveLength(1);
  });

  it('shipping on top of the price is fine — paying MORE than the order is not a change', async () => {
    routes['/orders/hold'] = held('12.00000000');
    routes['/api/payment/create'] = answer(201, { data: { payment: { id: 'pay-1' } } });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 14.5, product_id: PRODUCT }));
    expect(res.status).toBe(201);
  });

  it('gives the unit back when the payment record cannot be created', async () => {
    routes['/orders/hold'] = held();
    routes[`/orders/${HOLD}/cancel`] = answer(200, {});
    routes['/api/payment/create'] = answer(500, { error: 'boom' });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 12, product_id: PRODUCT }));
    expect(res.status).toBe(500);
    expect(calls('/cancel')).toHaveLength(1);
  });

  it('a backend without holds yet (deploy order) pays as before', async () => {
    routes['/orders/hold'] = answer(404, { message: 'Cannot POST /commerce/orders/hold' });
    routes['/api/payment/create'] = answer(201, { data: { payment: { id: 'pay-1' } } });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req('/api/bff/payment/create', 'POST', { amount: 12, product_id: PRODUCT }));
    expect(res.status).toBe(201);
    expect(JSON.parse(String(calls('/api/payment/create')[0][1]?.body)).metadata.order_id).toBeUndefined();
  });
});

describe('POST /api/bff/commerce/orders with order_id — confirm, never a second order', () => {
  it('confirms the hold with the payment id', async () => {
    routes[`/orders/${HOLD}/confirm`] = answer(200, { data: { order: { id: HOLD, status: 'PAID' } } });
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(req('/api/bff/commerce/orders', 'POST', { order_id: HOLD, payment_id: 'pay-1' }));
    expect(res.status).toBe(200);
    expect(JSON.parse(String(calls('/confirm')[0][1]?.body))).toEqual({ payment_id: 'pay-1' });
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/v1/commerce/orders'))).toHaveLength(0);
  });

  it('"not confirmed yet" is pending, not an error', async () => {
    routes[`/orders/${HOLD}/confirm`] = answer(503, {});
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(req('/api/bff/commerce/orders', 'POST', { order_id: HOLD, payment_id: 'pay-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pending: true, order_id: HOLD });
  });
});

describe('Mode 1 and cancel', () => {
  it('holds before the Hub and refuses a sold-out unit there', async () => {
    routes['/orders/hold'] = answer(400, { message: 'Insufficient stock for: Cap' });
    const { POST } = await import('@/app/api/bff/commerce/orders/hold/route');
    const res = await POST(req('/api/bff/commerce/orders/hold', 'POST', { product_id: PRODUCT, amount: 12 }));
    expect(res.status).toBe(409);
  });

  it('answers the order_id the Hub will carry', async () => {
    routes['/orders/hold'] = held();
    const { POST } = await import('@/app/api/bff/commerce/orders/hold/route');
    const res = await POST(req('/api/bff/commerce/orders/hold', 'POST', { product_id: PRODUCT, amount: 12 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ data: { order_id: HOLD } });
  });

  it('cancel releases the hold; a non-order id is refused without a call', async () => {
    routes[`/orders/${HOLD}/cancel`] = answer(200, {});
    const { PATCH } = await import('@/app/api/bff/commerce/orders/[id]/cancel/route');
    expect((await PATCH(req(`/api/bff/commerce/orders/${HOLD}/cancel`, 'PATCH'), { params: Promise.resolve({ id: HOLD }) })).status).toBe(200);
    const before = fetchMock.mock.calls.length;
    expect((await PATCH(req('/x', 'PATCH'), { params: Promise.resolve({ id: '../payment' }) })).status).toBe(400);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
