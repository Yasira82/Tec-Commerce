// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// GET /api/bff/commerce/sales-summary — the seller's own sales, from commerce-service.
// The seller is the token's identity THERE (P6): this route sends no seller id at all.

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';
const mockJwtVerify = vi.mocked(jwtVerify);

const req = (withToken = true) => {
  const r = new NextRequest('https://commerce.tecosystem.app/api/bff/commerce/sales-summary');
  if (withToken) r.cookies.set('tec_access_token', 'tok');
  return r;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-32chars-exactly-ok';
  process.env.API_GATEWAY_URL = 'https://gw';
  mockJwtVerify.mockResolvedValue({ payload: { sub: 'seller-1' } } as never);
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/bff/commerce/sales-summary', () => {
  it('asks commerce for the caller\'s own summary, naming no seller', async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) =>
      ({ ok: true, status: 200, json: async () => ({ success: true, data: { totalRevenue: '12', orderCount: 1 } }) }) as Response);
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/commerce/sales-summary/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toBe('https://gw/api/commerce/orders/seller/sales-summary');
    expect(url).not.toContain('seller-1');
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(await res.json()).toMatchObject({ summary: { totalRevenue: '12' } });
  });

  it('a gateway failure is an empty summary, not a 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response));
    const { GET } = await import('@/app/api/bff/commerce/sales-summary/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: null });
  });

  it('no session → 401, and commerce is never asked (P6)', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/commerce/sales-summary/route');
    const res = await GET(req(false));
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
});
