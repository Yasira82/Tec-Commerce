// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  process.env.API_GATEWAY_URL = 'http://gw.test';
  process.env.INTERNAL_SECRET = 'internal-secret-test';
});

import { POST as approve }  from '../app/api/payment/approve/route';
import { POST as complete } from '../app/api/payment/complete/route';
import { POST as resolve }  from '../app/api/payment/resolve-incomplete/route';

const makeReq = (opts: {
  url?:     string;
  cookies?: Record<string, string>;
  body?:    unknown;
  rawBody?: string;
} = {}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/payment/x', {
    method: 'POST',
    headers,
    body:   opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
};

const userCookie = JSON.stringify({ id: 'user-1', username: 'yasser' });
const authedCookies = { tec_access_token: 'tok-1', tec_user: userCookie };

const mockFetchOnce = (status: number, json: unknown) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300, status, json: async () => json,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

// ── /api/payment/approve — C-76 backend-first two-step flow ─────

describe('POST /api/payment/approve', () => {
  it('400 when paymentId missing', async () => {
    const res = await approve(makeReq({ body: {}, cookies: authedCookies }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('paymentId required');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('500 when body is not JSON', async () => {
    const res = await approve(makeReq({ rawBody: 'not-json{{', cookies: authedCookies }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Approval failed');
  });

  it('429 passthrough when payment create is rate limited', async () => {
    mockFetchOnce(429, { error: 'rate limited' });
    const res = await approve(makeReq({ body: { paymentId: 'pi-1' }, cookies: authedCookies }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Rate limited/);
    expect(global.fetch).toHaveBeenCalledTimes(1); // approve never attempted
  });

  it('propagates create failure status (payment created BEFORE approve — C-76)', async () => {
    mockFetchOnce(422, { error: 'invalid amount' });
    const res = await approve(makeReq({ body: { paymentId: 'pi-1' }, cookies: authedCookies }));
    expect(res.status).toBe(422);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe('http://gw.test/api/v1/payment/create');
  });

  it('500 when create succeeds but no payment id can be extracted', async () => {
    mockFetchOnce(200, { data: {} });
    const res = await approve(makeReq({ body: { paymentId: 'pi-1' }, cookies: authedCookies }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Failed to get payment ID');
  });

  it('happy path: create then approve, returns merged payment_id', async () => {
    mockFetchOnce(200, { data: { payment: { id: 'db-pay-9' } } });
    mockFetchOnce(200, { success: true });
    const res = await approve(makeReq({
      body: { paymentId: 'pi-1', pi_payment_id: 'pi-1' }, cookies: authedCookies,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment_id).toBe('db-pay-9');
    expect(body.success).toBe(true);

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);

    // step 1 — create: identity from tec_user cookie, idempotent key stable per payment
    const createInit = calls[0][1];
    expect(createInit.headers['Idempotency-Key']).toBe('create-pi-1');
    expect(createInit.headers['x-internal-key']).toBe('internal-secret-test');
    const createBody = JSON.parse(createInit.body);
    expect(createBody.userId).toBe('user-1');
    expect(createBody.metadata.pi_payment_id).toBe('pi-1');

    // step 2 — approve with DB UUID
    expect(String(calls[1][0])).toBe('http://gw.test/api/v1/payment/approve');
    const approveBody = JSON.parse(calls[1][1].body);
    expect(approveBody.payment_id).toBe('db-pay-9');
    expect(calls[1][1].headers['Idempotency-Key']).toBe('approve-pi-1');
  });

  it('extracts payment id from alternative response shapes', async () => {
    mockFetchOnce(200, { id: 'flat-id' });
    mockFetchOnce(402, { error: 'declined' });
    const res = await approve(makeReq({ body: { paymentId: 'pi-2' }, cookies: authedCookies }));
    expect(res.status).toBe(402); // approve status passthrough
    expect((await res.json()).payment_id).toBe('flat-id');
  });

  it('userId is null when tec_user cookie missing or malformed', async () => {
    mockFetchOnce(200, { data: { payment: { id: 'p' } } });
    mockFetchOnce(200, {});
    await approve(makeReq({
      body: { paymentId: 'pi-3' },
      cookies: { tec_access_token: 'tok-1', tec_user: '{{broken' },
    }));
    const createBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(createBody.userId).toBeNull();
  });
});

// ── /api/payment/complete ────────────────────────────────────────

describe('POST /api/payment/complete', () => {
  it('400 when paymentId or txid missing', async () => {
    const r1 = await complete(makeReq({ body: { paymentId: 'p' }, cookies: authedCookies }));
    expect(r1.status).toBe(400);
    const r2 = await complete(makeReq({ body: { txid: 't' }, cookies: authedCookies }));
    expect(r2.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards completion to gateway and passes status through', async () => {
    mockFetchOnce(200, { success: true, status: 'completed' });
    const res = await complete(makeReq({
      body: { paymentId: 'db-pay-9', txid: 'tx-1' }, cookies: authedCookies,
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('completed');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe('http://gw.test/api/v1/payment/complete');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ payment_id: 'db-pay-9', transaction_id: 'tx-1' });
    expect(init.headers.Authorization).toBe('Bearer tok-1');
  });

  it('passes upstream failure status through (409 terminal state)', async () => {
    mockFetchOnce(409, { error: 'terminal state' });
    const res = await complete(makeReq({ body: { paymentId: 'p', txid: 't' }, cookies: authedCookies }));
    expect(res.status).toBe(409);
  });

  it('500 when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    const res = await complete(makeReq({ body: { paymentId: 'p', txid: 't' }, cookies: authedCookies }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Completion failed');
  });
});

// ── /api/payment/resolve-incomplete ──────────────────────────────

describe('POST /api/payment/resolve-incomplete', () => {
  it('401 without access token (P6 fail closed)', async () => {
    const res = await resolve(makeReq({ body: { pi_payment_id: 'pi-1' } }));
    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('400 when pi_payment_id missing', async () => {
    const res = await resolve(makeReq({ body: {}, cookies: authedCookies }));
    expect(res.status).toBe(400);
  });

  it('accepts pi_payment_id via query string', async () => {
    mockFetchOnce(200, { resolved: true });
    const res = await resolve(makeReq({
      url: 'http://localhost/api/payment/resolve-incomplete?pi_payment_id=pi-q',
      cookies: authedCookies,
    }));
    expect(res.status).toBe(200);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe('http://gw.test/api/payment/resolve-incomplete?pi_payment_id=pi-q');
  });

  it('accepts pi_payment_id via body and passes status through', async () => {
    mockFetchOnce(404, { error: 'unknown payment' });
    const res = await resolve(makeReq({ body: { pi_payment_id: 'pi-b' }, cookies: authedCookies }));
    expect(res.status).toBe(404);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ pi_payment_id: 'pi-b' });
    expect(init.headers['x-internal-key']).toBe('internal-secret-test');
  });
});
