// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
const mockJwtVerify = vi.mocked(jwtVerify);

const makeReq = (opts: {
  cookies?:  Record<string, string>;
  body?:     unknown;
  method?:   string;
  headers?:  Record<string, string>;
}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest('http://localhost/api/test', {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-32chars-exactly-ok';
});

// ── Error classes ────────────────────────────────────────────────

describe('AppError', () => {
  it('constructs with message, status, code', async () => {
    const { AppError } = await import('../lib/bff/createHandler');
    const err = new AppError('bad input', 400, 'BAD_REQUEST');
    expect(err.message).toBe('bad input');
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.name).toBe('AppError');
    expect(err instanceof Error).toBe(true);
  });

  it('uses defaults when only message provided', async () => {
    const { AppError } = await import('../lib/bff/createHandler');
    const err = new AppError('fail');
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('UnauthorizedError', () => {
  it('constructs with 401 UNAUTHORIZED', async () => {
    const { UnauthorizedError } = await import('../lib/bff/createHandler');
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });
});

describe('ForbiddenError', () => {
  it('constructs with 403 FORBIDDEN', async () => {
    const { ForbiddenError } = await import('../lib/bff/createHandler');
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('accepts custom message', async () => {
    const { ForbiddenError } = await import('../lib/bff/createHandler');
    const err = new ForbiddenError('KYC_REQUIRED');
    expect(err.message).toBe('KYC_REQUIRED');
  });
});

// ── createHandler ────────────────────────────────────────────────

describe('createHandler', () => {
  it('returns 401 when no token cookie present', async () => {
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({ handler: async () => ({ ok: true }) });
    const res = await handle(makeReq({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when JWT_SECRET missing', async () => {
    delete process.env.JWT_SECRET;
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({ handler: async () => ({}) });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'token' } }));
    expect(res.status).toBe(500);
  });

  it('returns 401 when jwtVerify throws non-AppError', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid sig'));
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({ handler: async () => ({}) });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'bad-token' } }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT payload has no sub', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: undefined } } as never);
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({ handler: async () => ({}) });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(401);
  });

  it('calls handler and returns 200 on valid auth', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', kycVerified: true },
    } as never);
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({
      handler: async ({ ctx }) => ({ userId: ctx.userId }),
    });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'valid-tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-1');
  });

  it('returns 403 when KYC required but not verified', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', kycVerified: false },
    } as never);
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({
      requireKYC: true,
      handler:    async () => ({}),
    });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(403);
  });

  it('skips auth when requireAuth=false', async () => {
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({
      requireAuth: false,
      handler:     async ({ ctx }) => ({ userId: ctx.userId }),
    });
    const res = await handle(makeReq({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('anonymous');
  });

  it('returns 400 on Zod validation error', async () => {
    const { createHandler } = await import('../lib/bff/createHandler');
    const { z } = await import('zod');
    const handle = createHandler({
      requireAuth: false,
      schema:      z.object({ name: z.string() }),
      handler:     async () => ({}),
    });
    const res = await handle(makeReq({ body: { name: 123 }, method: 'POST' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 500 on unexpected handler error', async () => {
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({
      requireAuth: false,
      handler:     async () => { throw new Error('boom'); },
    });
    const res = await handle(makeReq({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
  });

  it('passes schema-validated input to handler', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1' },
    } as never);
    const { createHandler } = await import('../lib/bff/createHandler');
    const { z } = await import('zod');
    let captured: unknown;
    const handle = createHandler({
      schema:  z.object({ qty: z.number() }),
      handler: async ({ input }) => { captured = input; return {}; },
    });
    const res = await handle(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { qty: 5 },
    }));
    expect(res.status).toBe(200);
    expect((captured as { qty: number }).qty).toBe(5);
  });

  it('sets X-Request-Id header on successful response', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1' },
    } as never);
    const { createHandler } = await import('../lib/bff/createHandler');
    const handle = createHandler({ handler: async () => ({}) });
    const res = await handle(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });
});
