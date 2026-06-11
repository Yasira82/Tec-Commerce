// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));

import { jwtVerify } from 'jose';
import { GET as listProducts, POST as createProduct } from '../app/api/bff/commerce/products/route';
import { GET as getProduct, PATCH as patchProduct, DELETE as deleteProduct } from '../app/api/bff/commerce/products/[id]/route';
import { POST as postReview } from '../app/api/bff/commerce/products/[id]/review/route';

const mockJwtVerify = vi.mocked(jwtVerify);

const makeReq = (opts: {
  url?:     string;
  cookies?: Record<string, string>;
  body?:    unknown;
  method?:  string;
  headers?: Record<string, string>;
} = {}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/commerce/products', {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
};

const authedCookies = { tec_access_token: 'jwt-token' };

const primeAuth = (sub = 'merchant-1') => {
  mockJwtVerify.mockResolvedValue({
    payload: { sub, kycVerified: true },
    protectedHeader: { alg: 'HS256' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
};

const mockFetchOnce = (status: number, json: unknown) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => json,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET      = 'test-secret-32chars-exactly-ok';
  process.env.INTERNAL_SECRET = 'internal-secret-test';
  global.fetch = vi.fn();
});

// ── Merchant auth guard (cookie-based identity) ─────────────────

describe('GET /api/bff/commerce/products — merchant auth guard', () => {
  it('returns 401 when tec_access_token cookie is missing (fail closed)', async () => {
    const res  = await listProducts(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
    // gateway must never be called without a session
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT verification fails (invalid merchant session)', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid signature'));
    const res = await listProducts(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT payload has no sub (no principal — wrong/empty role)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockJwtVerify.mockResolvedValue({ payload: {} } as any);
    const res = await listProducts(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(401);
  });

  it('valid merchant session reaches the gateway', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { products: [] } });
    const res = await listProducts(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ── GET products: pagination + gateway error + normalization ────

describe('GET /api/bff/commerce/products', () => {
  it('forwards pagination + category params to the gateway', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { products: [] } });
    await listProducts(makeReq({
      url:     'http://localhost/api/bff/commerce/products?limit=5&offset=10&category=Electronics',
      cookies: authedCookies,
    }));
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('limit=5');
    expect(String(url)).toContain('offset=10');
    expect(String(url)).toContain('category=Electronics');
    expect(init.headers['x-internal-key']).toBe('internal-secret-test');
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
  });

  it('uses default pagination (limit=20, offset=0) when not provided', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { products: [] } });
    await listProducts(makeReq({ cookies: authedCookies }));
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('limit=20');
    expect(String(url)).toContain('offset=0');
  });

  it('returns empty products on gateway error (no leak of upstream failure)', async () => {
    primeAuth();
    mockFetchOnce(503, { error: 'down' });
    const res  = await listProducts(makeReq({ cookies: authedCookies }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ products: [] });
  });

  it('normalizes products with full metadata', async () => {
    primeAuth();
    mockFetchOnce(200, {
      data: { products: [{
        id: 'p1', title: 'Phone', description: 'Nice', price: '12.5', stock: '3',
        category: 'Electronics', seller_id: 'm-9', created_at: '2026-01-01',
        metadata: {
          condition: 'used', images: ['a.jpg', 'b.jpg'], sellerName: 'Yas',
          shipping: { country: 'EG', city: 'Cairo', shipsTo: ['EG'], shippingCost: 1, estimatedDays: '3d' },
          contact:  { whatsapp: '+2010' },
          rating: '4.5', reviewCount: 2, warranty: '1y', returnPolicy: '7d',
        },
      }] },
    });
    const res  = await listProducts(makeReq({ cookies: authedCookies }));
    const body = await res.json();
    expect(body.products[0]).toMatchObject({
      id: 'p1', title: 'Phone', price: 12.5, stock: 3,
      condition: 'used', images: ['a.jpg', 'b.jpg'],
      sellerId: 'm-9', sellerName: 'Yas',
      rating: 4.5, reviewCount: 2, warranty: '1y', returnPolicy: '7d',
      createdAt: '2026-01-01',
    });
    expect(body.products[0].shipping.city).toBe('Cairo');
    expect(body.products[0].contact.whatsapp).toBe('+2010');
  });

  it('falls back to image_url and defaults when metadata is missing', async () => {
    primeAuth();
    mockFetchOnce(200, {
      data: { products: [{ id: 'p2', title: 'Bare', price: 'NaN-ish', image_url: 'x.jpg', seller_id: 'm-1' }] },
    });
    const res  = await listProducts(makeReq({ cookies: authedCookies }));
    const body = await res.json();
    const p = body.products[0];
    expect(p.images).toEqual(['x.jpg']);
    expect(p.price).toBe(0);
    expect(p.stock).toBe(0);
    expect(p.category).toBe('Other');
    expect(p.condition).toBe('new');
    expect(p.shipping.country).toBe('Unknown');
    expect(p.rating).toBe(0);
  });

  it('returns empty images array when no metadata images and no image_url', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { products: [{ id: 'p3', title: 'NoImg' }] } });
    const res  = await listProducts(makeReq({ cookies: authedCookies }));
    const body = await res.json();
    expect(body.products[0].images).toEqual([]);
  });

  it('returns empty list when gateway payload has no products array', async () => {
    primeAuth();
    mockFetchOnce(200, {});
    const res  = await listProducts(makeReq({ cookies: authedCookies }));
    expect((await res.json()).products).toEqual([]);
  });
});

// ── POST products ────────────────────────────────────────────────

const validProduct = {
  title: 'New Item',
  price: 9.99,
  stock: 5,
};

describe('POST /api/bff/commerce/products', () => {
  it('returns 401 without session cookie', async () => {
    const res = await createProduct(makeReq({ method: 'POST', body: validProduct }));
    expect(res.status).toBe(401);
  });

  it('rejects invalid payload with 400 VALIDATION_ERROR (negative price)', async () => {
    primeAuth();
    const res = await createProduct(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { ...validProduct, price: -1 },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_ERROR');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('SECURITY: strips client-sent merchantId/seller_id — never forwarded from body', async () => {
    primeAuth('merchant-1');
    mockFetchOnce(200, { data: { product: { id: 'p1', title: 'New Item' } } });
    const res = await createProduct(makeReq({
      method: 'POST', cookies: authedCookies,
      body: { ...validProduct, merchantId: 'attacker-1', seller_id: 'attacker-1', sellerId: 'attacker-1' },
    }));
    expect(res.status).toBe(200);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const forwarded = JSON.parse(init.body);
    expect(forwarded.merchantId).toBeUndefined();
    expect(forwarded.seller_id).toBeUndefined();
    expect(forwarded.sellerId).toBeUndefined();
    // identity travels only via the Authorization header (cookie token)
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
  });

  it('creates a product and returns the normalized result', async () => {
    primeAuth();
    mockFetchOnce(200, {
      data: { product: { id: 'p9', title: 'New Item', price: '9.99', stock: 5, seller_id: 'merchant-1' } },
    });
    const res  = await createProduct(makeReq({ method: 'POST', cookies: authedCookies, body: validProduct }));
    const body = await res.json();
    expect(body.product.id).toBe('p9');
    expect(body.product.price).toBe(9.99);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/commerce/products');
    expect(init.method).toBe('POST');
  });

  it('returns 500 when gateway rejects creation', async () => {
    primeAuth();
    mockFetchOnce(422, { message: 'bad product' });
    const res = await createProduct(makeReq({ method: 'POST', cookies: authedCookies, body: validProduct }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('INTERNAL_ERROR');
  });

  it('returns 500 with fallback message when gateway error body is not JSON', async () => {
    primeAuth();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => { throw new Error('not json'); },
    });
    const res = await createProduct(makeReq({ method: 'POST', cookies: authedCookies, body: validProduct }));
    expect(res.status).toBe(500);
  });
});

// ── /products/[id] GET / PATCH / DELETE ──────────────────────────

const idUrl = 'http://localhost/api/bff/commerce/products/prod-42';

describe('GET /api/bff/commerce/products/[id]', () => {
  it('401 without auth cookie', async () => {
    const res = await getProduct(makeReq({ url: idUrl }));
    expect(res.status).toBe(401);
  });

  it('fetches product by id extracted from URL', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { product: { id: 'prod-42', title: 'T', metadata: { images: ['i.jpg'] } } } });
    const res  = await getProduct(makeReq({ url: idUrl, cookies: authedCookies }));
    const body = await res.json();
    expect(body.product.id).toBe('prod-42');
    expect(body.product.images).toEqual(['i.jpg']);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/commerce/products/prod-42');
  });

  it('falls back to data.data when product key absent', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { id: 'prod-42', title: 'Flat' } });
    const res  = await getProduct(makeReq({ url: idUrl, cookies: authedCookies }));
    expect((await res.json()).product.title).toBe('Flat');
  });

  it('500 when product not found upstream', async () => {
    primeAuth();
    mockFetchOnce(404, {});
    const res = await getProduct(makeReq({ url: idUrl, cookies: authedCookies }));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/bff/commerce/products/[id]', () => {
  it('401 without auth cookie', async () => {
    const res = await patchProduct(makeReq({ url: idUrl, method: 'PATCH', body: { price: 2 } }));
    expect(res.status).toBe(401);
  });

  it('400 on invalid update payload (negative price)', async () => {
    primeAuth();
    const res = await patchProduct(makeReq({
      url: idUrl, method: 'PATCH', cookies: authedCookies, body: { price: -5 },
    }));
    expect(res.status).toBe(400);
  });

  it('updates product and forwards only schema fields', async () => {
    primeAuth();
    mockFetchOnce(200, { data: { product: { id: 'prod-42', title: 'Updated', price: '2' } } });
    const res = await patchProduct(makeReq({
      url: idUrl, method: 'PATCH', cookies: authedCookies,
      body: { title: 'Updated', price: 2, merchantId: 'spoof' },
    }));
    expect(res.status).toBe(200);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/prod-42');
    expect(init.method).toBe('PATCH');
    const forwarded = JSON.parse(init.body);
    expect(forwarded.title).toBe('Updated');
    expect(forwarded.merchantId).toBeUndefined();
    expect((await res.json()).product.title).toBe('Updated');
  });

  it('500 when gateway rejects update', async () => {
    primeAuth();
    mockFetchOnce(403, { message: 'not your product' });
    const res = await patchProduct(makeReq({
      url: idUrl, method: 'PATCH', cookies: authedCookies, body: { title: 'X' },
    }));
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/bff/commerce/products/[id]', () => {
  it('401 without auth cookie', async () => {
    const res = await deleteProduct(makeReq({ url: idUrl, method: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('deletes a product via the gateway', async () => {
    primeAuth();
    mockFetchOnce(200, {});
    const res = await deleteProduct(makeReq({ url: idUrl, method: 'DELETE', cookies: authedCookies }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/prod-42');
    expect(init.method).toBe('DELETE');
  });

  it('500 when gateway delete fails', async () => {
    primeAuth();
    mockFetchOnce(500, {});
    const res = await deleteProduct(makeReq({ url: idUrl, method: 'DELETE', cookies: authedCookies }));
    expect(res.status).toBe(500);
  });
});

// ── review POST ──────────────────────────────────────────────────

const reviewUrl = 'http://localhost/api/bff/commerce/orders/order-7/review';

describe('POST review route', () => {
  it('401 without auth cookie', async () => {
    const res = await postReview(makeReq({ url: reviewUrl, method: 'POST', body: { rating: 5, comment: 'ok' } }));
    expect(res.status).toBe(401);
  });

  it('400 when rating out of bounds', async () => {
    primeAuth();
    const res = await postReview(makeReq({
      url: reviewUrl, method: 'POST', cookies: authedCookies, body: { rating: 6, comment: 'too good' },
    }));
    expect(res.status).toBe(400);
  });

  it('400 when comment empty', async () => {
    primeAuth();
    const res = await postReview(makeReq({
      url: reviewUrl, method: 'POST', cookies: authedCookies, body: { rating: 4, comment: '' },
    }));
    expect(res.status).toBe(400);
  });

  it('submits review with buyer_id taken from the session, not the body', async () => {
    primeAuth('buyer-77');
    mockFetchOnce(200, { data: { review: { id: 'r1', rating: 5 } } });
    const res = await postReview(makeReq({
      url: reviewUrl, method: 'POST', cookies: authedCookies,
      body: { rating: 5, comment: 'great', buyer_id: 'attacker' },
    }));
    expect(res.status).toBe(200);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/commerce/orders/order-7/review');
    const forwarded = JSON.parse(init.body);
    expect(forwarded.buyer_id).toBe('buyer-77');
    expect((await res.json()).review.id).toBe('r1');
  });

  it('500 when gateway rejects the review', async () => {
    primeAuth();
    mockFetchOnce(409, { message: 'already reviewed' });
    const res = await postReview(makeReq({
      url: reviewUrl, method: 'POST', cookies: authedCookies, body: { rating: 3, comment: 'meh' },
    }));
    expect(res.status).toBe(500);
  });
});
