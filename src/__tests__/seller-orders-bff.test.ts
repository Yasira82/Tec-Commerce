// @vitest-environment node
/**
 * Commerce's Sales tab: it listed the seller's own PURCHASES (`?role=seller` was
 * ignored), and "Mark Shipped" called a route that did not exist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';

const ORDER = '11111111-2222-4333-8444-555555555555';
let fetchMock: ReturnType<typeof vi.fn>;
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;

beforeEach(() => {
  vi.resetModules();
  process.env.API_GATEWAY_URL = 'https://gw';
  process.env.JWT_SECRET = 'test-secret-32chars-exactly-ok';
  vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: 'seller-1' } } as never);
});
afterEach(() => vi.unstubAllGlobals());

const req = (url: string, method = 'GET', body?: unknown) => {
  const r = new NextRequest(`https://commerce.tecosystem.app${url}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  r.cookies.set('tec_access_token', 'tok');
  return r;
};

describe('GET /api/bff/commerce/orders?role=seller', () => {
  it('reads the SELLER list — not the buyer\'s — and shapes it for the card', async () => {
    fetchMock = vi.fn(async (_u: RequestInfo | URL) => answer(200, { data: { orders: [{
      id: ORDER, status: 'PAID', buyer_id: 'b', payment_id: 'pay', created_at: '2026-10-03T10:00:00Z',
      sole_seller: true, seller_total: '10.00000000',
      items: [{ product_id: 'p1', title: 'Cable', image_url: 'x.png', metadata: { contact: { whatsapp: '+20' } } }],
      timeline: [{ status: 'PAID', note: 'paid', created_at: '2026-10-03T10:00:00Z' }],
    }] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    const body = await (await GET(req('/api/bff/commerce/orders?role=seller'))).json();
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://gw/api/commerce/orders/seller');
    expect(body.orders[0]).toMatchObject({
      id: ORDER, status: 'paid', total: 10, soleSeller: true, product_id: 'p1',
      product: { title: 'Cable', images: ['x.png'], contact: { whatsapp: '+20' } },
      timeline: [{ status: 'paid' }],
    });
  });

  it('PROCESSING reads as paid — still to ship', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, { data: { orders: [{ id: ORDER, status: 'PROCESSING', buyer_id: 'b', created_at: 'x', items: [] }] } })));
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    expect((await (await GET(req('/api/bff/commerce/orders?role=seller'))).json()).orders[0].status).toBe('paid');
  });
});

describe('PATCH /api/bff/commerce/orders/:id/status', () => {
  it('carries shipped (+ tracking note) to the route that exists', async () => {
    fetchMock = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => answer(200, { data: { order: { id: ORDER, status: 'SHIPPED' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const { PATCH } = await import('@/app/api/bff/commerce/orders/[id]/status/route');
    const res = await PATCH(req(`/api/bff/commerce/orders/${ORDER}/status`, 'PATCH', { status: 'shipped', note: 'Aramex 9' }));
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://gw/api/commerce/orders/${ORDER}/status`);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ status: 'SHIPPED', note: 'Aramex 9' });
  });

  it('a seller cannot cancel or confirm from here', async () => {
    fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { PATCH } = await import('@/app/api/bff/commerce/orders/[id]/status/route');
    for (const status of ['cancelled', 'confirmed']) {
      expect((await PATCH(req(`/api/bff/commerce/orders/${ORDER}/status`, 'PATCH', { status }))).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes commerce\'s refusal and its reason through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(403, { message: 'This order has items from other sellers' })));
    const { PATCH } = await import('@/app/api/bff/commerce/orders/[id]/status/route');
    const res = await PATCH(req(`/api/bff/commerce/orders/${ORDER}/status`, 'PATCH', { status: 'shipped' }));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/other sellers/);
  });
});
