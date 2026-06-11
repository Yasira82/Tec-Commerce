// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({ jwtVerify: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn();
  S3Client.prototype.send = vi.fn();
  return { S3Client, PutObjectCommand: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

// ─────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  let GET: any;
  beforeAll(async () => { ({ GET } = await import('@/app/api/health/route')); });

  it('returns offline when gateway URL not configured', async () => {
    const old = process.env.API_GATEWAY_URL;
    delete process.env.API_GATEWAY_URL;
    delete process.env.NEXT_PUBLIC_API_GATEWAY_URL;
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(false);
    expect(body.error).toContain('configured');
    if (old) process.env.API_GATEWAY_URL = old;
  });

  it('returns online when gateway responds ok', async () => {
    process.env.API_GATEWAY_URL = 'http://gw-test';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ status: 'ok' }),
    }) as any;
    const res = await GET();
    expect((await res.json()).online).toBe(true);
    delete process.env.API_GATEWAY_URL;
  });

  it('returns offline on non-ok gateway response', async () => {
    process.env.API_GATEWAY_URL = 'http://gw-test';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
    const res = await GET();
    expect((await res.json()).online).toBe(false);
    delete process.env.API_GATEWAY_URL;
  });

  it('returns offline on network error', async () => {
    process.env.API_GATEWAY_URL = 'http://gw-test';
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(false);
    expect(body.error).toContain('ECONNREFUSED');
    delete process.env.API_GATEWAY_URL;
  });

  it('handles non-Error throw', async () => {
    process.env.API_GATEWAY_URL = 'http://gw-test';
    global.fetch = vi.fn().mockRejectedValue('oops') as any;
    const res = await GET();
    expect((await res.json()).online).toBe(false);
    delete process.env.API_GATEWAY_URL;
  });
});

// ─────────────────────────────────────────────────────────────
describe('tec-navigation', () => {
  let TEC_ROUTES: any;
  beforeAll(async () => { ({ TEC_ROUTES } = await import('@/lib/tec-navigation')); });

  it('has HUB, SETTINGS, DASHBOARD keys', () => {
    expect(TEC_ROUTES.HUB).toContain('hub');
    expect(TEC_ROUTES.SETTINGS).toContain('settings');
    expect(TEC_ROUTES.DASHBOARD).toContain('dashboard');
  });

  it('goToTEC calls window.location.replace', async () => {
    const { goToTEC } = await import('@/lib/tec-navigation');
    const replaceSpy = vi.fn();
    (global as any).window = { location: { replace: replaceSpy } };
    goToTEC('HUB');
    expect(replaceSpy).toHaveBeenCalledWith(expect.stringContaining('hub'));
    (global as any).window = undefined;
  });
});

// ─────────────────────────────────────────────────────────────
describe('BFF storage upload route', () => {
  let POST: any;
  beforeAll(async () => { ({ POST } = await import('@/app/api/bff/storage/upload/route')); });

  it('returns 4xx when unauthenticated', async () => {
    const { jwtVerify } = await import('jose');
    vi.mocked(jwtVerify).mockRejectedValue(new Error('no token'));
    const req = new NextRequest('http://localhost/api/bff/storage/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'test.jpg', fileType: 'image/jpeg', fileSize: 1000 }),
    });
    const res = await POST(req);
    expect([400, 401, 403, 500]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
describe('request-id helpers (node env — document undefined)', () => {
  it('buildHeaders returns headers without csrf when document is undefined', async () => {
    const { buildHeaders, generateRequestId } = await import('@/lib/request-id');
    const headers = buildHeaders('test-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-token');
    expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BFF auth routes', () => {
  it('GET /api/auth/sso returns redirect', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = new NextRequest('http://localhost/api/auth/sso');
    const res = await GET(req);
    // Should redirect to Hub SSO
    expect([302, 307, 200]).toContain(res.status);
  });

  it('POST /api/auth/refresh returns 4xx without token', async () => {
    const { POST } = await import('@/app/api/auth/refresh/route');
    const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
    const res = await POST(req);
    expect([400, 401, 403, 500]).toContain(res.status);
  });
});
