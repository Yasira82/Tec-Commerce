import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ────────────────────────────────────────────────
const mockCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
};

const makeFetchOk = (body: unknown) =>
  vi.fn().mockResolvedValue({
    ok:   true,
    json: () => Promise.resolve(body),
  } as unknown as Response);

const makeFetchNotOk = () =>
  vi.fn().mockResolvedValue({
    ok:   false,
    json: () => Promise.resolve({}),
  } as unknown as Response);

// ── tests ──────────────────────────────────────────────────
describe('createPaymentRecord', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns payment ID from nested data.payment.id on success', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ data: { payment: { id: 'pay-123' } } }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(1.5, 'prod-abc', 'Test payment');

    expect(result).toBe('pay-123');
  });

  it('returns payment ID from top-level id when data.payment is absent', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ id: 'pay-456' }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(2.0, 'prod-xyz', 'Another payment');

    expect(result).toBe('pay-456');
  });

  it('returns null when response is not ok', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
    fetchSpy.mockResolvedValue({
      ok:   false,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(1.0, 'prod-1', 'memo');

    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(1.0, 'prod-1', 'memo');

    expect(result).toBeNull();
  });

  it('returns null when no token cookie present', async () => {
    mockCookie('');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ data: { payment: { id: 'pay-no-token' } } }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(1.0, 'prod-1', 'memo');

    // Should still work (no auth header) but return the id
    expect(result).toBe('pay-no-token');
  });

  it('sends correct body with source: commerce', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ data: { payment: { id: 'pay-body-check' } } }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    await createPaymentRecord(3.14, 'prod-body', 'Body check memo');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/bff/payment/create');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      amount:     3.14,
      product_id: 'prod-body',
      memo:       'Body check memo',
      source:     'commerce',
    });
  });

  it('sends CSRF token in x-csrf-token header', async () => {
    mockCookie('tec_access_token=test-token; tec_csrf=my-csrf-token');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ data: { payment: { id: 'pay-csrf' } } }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    await createPaymentRecord(1.0, 'prod-csrf', 'CSRF check');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('my-csrf-token');
  });

  it('sends Authorization header when token is present', async () => {
    mockCookie('tec_access_token=bearer-token-xyz; tec_csrf=csrf-abc');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ id: 'pay-auth' }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    await createPaymentRecord(1.0, 'prod-auth', 'Auth header test');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer bearer-token-xyz');
  });

  it('does NOT send Authorization header when no token', async () => {
    mockCookie('tec_csrf=csrf-only');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ id: 'pay-no-auth' }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    await createPaymentRecord(1.0, 'prod-noauth', 'No auth header test');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('returns null when response body has no id fields', async () => {
    mockCookie('tec_access_token=tok; tec_csrf=csrf');
    fetchSpy.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ other: 'field' }),
    } as unknown as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const result = await createPaymentRecord(1.0, 'prod-1', 'no id');

    expect(result).toBeNull();
  });
});
