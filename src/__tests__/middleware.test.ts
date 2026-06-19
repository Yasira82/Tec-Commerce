// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

const makeReq = (opts: {
  path:     string;
  method?:  string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const hdrs: Record<string, string> = { ...(opts.headers ?? {}) };
  if (cookieStr) hdrs['Cookie'] = cookieStr;
  return new NextRequest(`http://localhost${opts.path}`, {
    method:  opts.method ?? 'GET',
    headers: hdrs,
  });
};

// ── protected routes ─────────────────────────────────────────────

describe('middleware — protected routes', () => {
  it('redirects /app when no token', () => {
    const res = middleware(makeReq({ path: '/app/home' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('redirect=%2Fapp%2Fhome');
  });

  it('redirects /dashboard when token is empty string', () => {
    const res = middleware(makeReq({
      path:    '/dashboard/stats',
      cookies: { tec_access_token: '' },
    }));
    expect(res.status).toBe(307);
  });

  it('passes through /app when valid token present', () => {
    const res = middleware(makeReq({
      path:    '/app/home',
      cookies: { tec_access_token: 'valid-tok' },
    }));
    expect(res.status).toBe(200);
  });

  it('passes through /settings with token', () => {
    const res = middleware(makeReq({
      path:    '/settings/account',
      cookies: { tec_access_token: 'tok' },
    }));
    expect(res.status).toBe(200);
  });
});

// ── CSRF protection ──────────────────────────────────────────────

describe('middleware — CSRF', () => {
  it('skips CSRF for GET requests', () => {
    const res = middleware(makeReq({ path: '/api/bff/commerce/products', method: 'GET' }));
    expect(res.status).toBe(200);
  });

  it('returns 403 when CSRF tokens missing on protected POST', () => {
    const res = middleware(makeReq({ path: '/api/bff/commerce/orders', method: 'POST' }));
    expect(res.status).toBe(403);
    // Can't call .json() on middleware response — just check status
  });

  it('passes when CSRF cookie matches header on protected POST', () => {
    const res = middleware(makeReq({
      path:    '/api/bff/commerce/orders',
      method:  'POST',
      cookies: { tec_csrf: 'csrf-tok' },
      headers: { 'x-csrf-token': 'csrf-tok' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 403 when CSRF cookie/header mismatch', () => {
    const res = middleware(makeReq({
      path:    '/api/bff/commerce/orders',
      method:  'POST',
      cookies: { tec_csrf: 'real-tok' },
      headers: { 'x-csrf-token': 'wrong-tok' },
    }));
    expect(res.status).toBe(403);
  });

  it('enforces CSRF on /api/bff/payment/ routes', () => {
    const res = middleware(makeReq({
      path:   '/api/bff/payment/approve',
      method: 'POST',
    }));
    expect(res.status).toBe(403);
  });

  it('passes /api/bff/payment/ routes when CSRF token matches', () => {
    const res = middleware(makeReq({
      path:    '/api/bff/payment/approve',
      method:  'POST',
      cookies: { tec_csrf: 'csrf-tok' },
      headers: { 'x-csrf-token': 'csrf-tok' },
    }));
    expect(res.status).toBe(200);
  });

  it('passes non-CSRF-protected API routes', () => {
    const res = middleware(makeReq({ path: '/api/bff/products', method: 'POST' }));
    expect(res.status).toBe(200);
  });
});
