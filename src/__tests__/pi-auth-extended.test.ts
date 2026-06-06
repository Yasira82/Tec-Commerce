/**
 * Extended tests for src/lib-client/pi/pi-auth.ts
 * Targets the uncovered lines: 156-263, 268-283
 * Functions: refreshAccessToken, fetchWithAuth, waitForPiSDK, resolvePendingPayment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── cookie helper ──────────────────────────────────────────
const mockCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
};

describe('waitForPiSDK', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset Pi and TEC flags
    delete (window as any).Pi;
    (window as any).__TEC_PI_READY = false;
    (window as any).__TEC_PI_ERROR = false;
  });

  afterEach(() => {
    delete (window as any).__TEC_PI_READY;
    delete (window as any).__TEC_PI_ERROR;
    delete (window as any).Pi;
  });

  it('resolves immediately when Pi is defined and __TEC_PI_READY is true', async () => {
    (window as any).Pi = { authenticate: vi.fn(), createPayment: vi.fn() };
    (window as any).__TEC_PI_READY = true;

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).resolves.toBeUndefined();
  });

  it('rejects immediately when __TEC_PI_ERROR is true', async () => {
    (window as any).__TEC_PI_ERROR = true;

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).rejects.toThrow('Pi SDK failed to load.');
  });

  it('resolves when tec-pi-ready event fires', async () => {
    delete (window as any).__TEC_PI_READY;
    delete (window as any).__TEC_PI_ERROR;
    delete (window as any).Pi;

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    const promise = waitForPiSDK(5000);

    // Fire the ready event
    window.dispatchEvent(new Event('tec-pi-ready'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects when tec-pi-error event fires', async () => {
    delete (window as any).__TEC_PI_READY;
    delete (window as any).__TEC_PI_ERROR;
    delete (window as any).Pi;

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    const promise = waitForPiSDK(5000);

    // Fire the error event
    window.dispatchEvent(new Event('tec-pi-error'));

    await expect(promise).rejects.toThrow('Pi SDK initialization failed.');
  });
});

describe('refreshAccessToken', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Mock window.location to prevent navigation
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { href: '' },
    });
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-token');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns new token when refresh succeeds', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'new-access-token' }),
    } as unknown as Response);

    const { refreshAccessToken } = await import('@/lib-client/pi/pi-auth');
    const result = await refreshAccessToken();

    expect(result).toBe('new-access-token');
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('returns null when refresh response has no token field', async () => {
    fetchSpy
      // refresh call returns ok with no token
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as unknown as Response);

    const { refreshAccessToken } = await import('@/lib-client/pi/pi-auth');
    const result = await refreshAccessToken();

    expect(result).toBeNull();
  });

  it('calls logout and returns null when refresh response is not ok', async () => {
    // Mock the refresh endpoint returning 401
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    const { refreshAccessToken } = await import('@/lib-client/pi/pi-auth');
    const result = await refreshAccessToken();

    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

    const { refreshAccessToken } = await import('@/lib-client/pi/pi-auth');
    const result = await refreshAccessToken();

    expect(result).toBeNull();
  });
});

describe('fetchWithAuth', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-token');
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns response directly when not 401', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    } as unknown as Response);

    const { fetchWithAuth } = await import('@/lib-client/pi/pi-auth');
    const res = await fetchWithAuth('/api/test');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries with new token when response is 401 and refresh succeeds', async () => {
    const mockRes401 = { ok: false, status: 401, json: () => Promise.resolve({}) } as unknown as Response;
    const mockResOk  = { ok: true,  status: 200, json: () => Promise.resolve({ data: 'ok' }) } as unknown as Response;

    fetchSpy
      .mockResolvedValueOnce(mockRes401)    // initial fetch → 401
      .mockResolvedValueOnce({              // refresh call → new token
        ok: true,
        json: () => Promise.resolve({ token: 'refreshed-token' }),
      } as unknown as Response)
      .mockResolvedValueOnce(mockResOk);    // retry → 200

    const { fetchWithAuth } = await import('@/lib-client/pi/pi-auth');
    const res = await fetchWithAuth('/api/protected');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('returns 401 response when refresh fails (no token)', async () => {
    const mockRes401 = { ok: false, status: 401, json: () => Promise.resolve({}) } as unknown as Response;

    fetchSpy
      .mockResolvedValueOnce(mockRes401)   // initial → 401
      .mockResolvedValueOnce({             // refresh → ok but no token
        ok: true,
        json: () => Promise.resolve({}),
      } as unknown as Response);

    const { fetchWithAuth } = await import('@/lib-client/pi/pi-auth');
    const res = await fetchWithAuth('/api/protected');

    expect(res.status).toBe(401);
  });

  it('passes custom headers to the request', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    const { fetchWithAuth } = await import('@/lib-client/pi/pi-auth');
    await fetchWithAuth('/api/test', {
      headers: { 'x-custom': 'custom-value' },
    });

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['x-custom']).toBe('custom-value');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('resolvePendingPayment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns { action: resolved } when sdk resolveIncomplete succeeds', async () => {
    const { resolvePendingPayment } = await import('@/lib-client/pi/pi-auth');
    const result = await resolvePendingPayment('pay-123');
    expect(result).toEqual({ action: 'resolved' });
  });
});
