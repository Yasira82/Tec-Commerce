import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── tec-navigation ──────────────────────────────────────────────

describe('goToTEC', () => {
  const originalReplace = window.location.replace;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { replace: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { replace: originalReplace },
      writable: true,
      configurable: true,
    });
  });

  it('navigates to HUB URL', async () => {
    const { goToTEC, TEC_ROUTES } = await import('../lib/tec-navigation');
    goToTEC('HUB');
    expect(window.location.replace).toHaveBeenCalledWith(TEC_ROUTES.HUB);
  });

  it('navigates to SETTINGS URL', async () => {
    const { goToTEC, TEC_ROUTES } = await import('../lib/tec-navigation');
    goToTEC('SETTINGS');
    expect(window.location.replace).toHaveBeenCalledWith(TEC_ROUTES.SETTINGS);
  });

  it('navigates to DASHBOARD URL', async () => {
    const { goToTEC, TEC_ROUTES } = await import('../lib/tec-navigation');
    goToTEC('DASHBOARD');
    expect(window.location.replace).toHaveBeenCalledWith(TEC_ROUTES.DASHBOARD);
  });
});

// ── request-id ──────────────────────────────────────────────────

describe('request-id utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    Object.defineProperty(document, 'cookie', {
      value: '', configurable: true, writable: true,
    });
  });

  it('generateRequestId returns a UUID string', async () => {
    const { generateRequestId } = await import('../lib/request-id');
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('storeRequestId saves to sessionStorage', async () => {
    const { storeRequestId, getLastRequestId } = await import('../lib/request-id');
    storeRequestId('test-id-123');
    expect(getLastRequestId()).toBe('test-id-123');
  });

  it('getLastRequestId returns null when nothing stored', async () => {
    const { getLastRequestId } = await import('../lib/request-id');
    expect(getLastRequestId()).toBeNull();
  });

  it('buildHeaders includes Content-Type and X-Request-ID', async () => {
    const { buildHeaders } = await import('../lib/request-id');
    const headers = buildHeaders();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Request-ID']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('buildHeaders includes Authorization when token provided', async () => {
    const { buildHeaders } = await import('../lib/request-id');
    const headers = buildHeaders('my-token');
    expect(headers.Authorization).toBe('Bearer my-token');
  });

  it('buildHeaders omits Authorization when no token', async () => {
    const { buildHeaders } = await import('../lib/request-id');
    const headers = buildHeaders(null);
    expect(headers.Authorization).toBeUndefined();
  });

  it('buildHeaders includes CSRF token from cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_csrf=csrf-value-123', configurable: true, writable: true,
    });
    const { buildHeaders } = await import('../lib/request-id');
    const headers = buildHeaders();
    expect(headers['X-CSRF-Token']).toBe('csrf-value-123');
  });

  it('buildHeaders merges extra headers', async () => {
    const { buildHeaders } = await import('../lib/request-id');
    const headers = buildHeaders(null, { 'X-Custom': 'custom-val' });
    expect(headers['X-Custom']).toBe('custom-val');
  });
});

// ── health-check ────────────────────────────────────────────────

describe('checkBackendHealth', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns online=true on successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ online: true, status: 'ok' }),
    } as Response);
    const { checkBackendHealth } = await import('../lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(true);
    expect(result.status).toBe('ok');
  });

  it('returns online=false when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 503, json: async () => ({}),
    } as Response);
    const { checkBackendHealth } = await import('../lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(false);
    expect(result.error).toContain('503');
  });

  it('returns online=false on fetch exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { checkBackendHealth } = await import('../lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('uses status===ok as online fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ status: 'ok' }),
    } as Response);
    const { checkBackendHealth } = await import('../lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(true);
  });
});

// ── fetch-with-timeout ──────────────────────────────────────────

describe('fetchWithTimeout', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns response on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const { fetchWithTimeout } = await import('../lib/server/fetch-with-timeout');
    const res = await fetchWithTimeout('/api/test');
    expect(res.ok).toBe(true);
  });

  it('forwards init options to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const { fetchWithTimeout } = await import('../lib/server/fetch-with-timeout');
    await fetchWithTimeout('/api/test', { method: 'POST' });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const lastCall = fetchSpy.mock.calls.at(-1)!;
    const [, init] = lastCall;
    expect((init as RequestInit).method).toBe('POST');
  });
});
