import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── cookie helper ──────────────────────────────────────────
const mockCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
};

describe('sdk object', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('clearAuthToken is a function that does not throw', async () => {
    const { sdk } = await import('@/lib/sdk');
    expect(typeof sdk.clearAuthToken).toBe('function');
    expect(() => sdk.clearAuthToken()).not.toThrow();
  });

  it('sdk.payment.resolveIncomplete returns { status: "skipped" } for any id', async () => {
    const { sdk } = await import('@/lib/sdk');
    const result = await sdk.payment.resolveIncomplete('any-payment-id');
    expect(result).toEqual({ status: 'skipped' });
  });

  it('sdk.payment.resolveIncomplete returns skipped for empty string id', async () => {
    const { sdk } = await import('@/lib/sdk');
    const result = await sdk.payment.resolveIncomplete('');
    expect(result).toEqual({ status: 'skipped' });
  });

  it('sdk is the default export', async () => {
    const mod = await import('@/lib/sdk');
    expect(mod.default).toBeDefined();
    expect(mod.default.clearAuthToken).toBeDefined();
    expect(mod.default.payment).toBeDefined();
  });
});

describe('getToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when no access token cookie', async () => {
    mockCookie('');
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBeNull();
  });

  it('returns null when other cookies present but not tec_access_token', async () => {
    mockCookie('tec_csrf=abc; tec_user={}');
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBeNull();
  });

  it('returns token value when tec_access_token cookie is present', async () => {
    mockCookie('tec_access_token=sdk-token-123');
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBe('sdk-token-123');
  });

  it('returns correct token among multiple cookies', async () => {
    mockCookie('tec_csrf=csrf-val; tec_access_token=sdk-tok-abc; tec_user={}');
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBe('sdk-tok-abc');
  });
});

describe('getUserId', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when no user cookie', async () => {
    mockCookie('');
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBeNull();
  });

  it('returns null when user cookie is malformed', async () => {
    mockCookie('tec_user=not-valid-json');
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBeNull();
  });

  it('returns id from user cookie with id field', async () => {
    const user = { id: 'user-id-abc', piUsername: 'testuser' };
    mockCookie(`tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBe('user-id-abc');
  });

  it('returns uid when id is absent but uid is present', async () => {
    const user = { uid: 'uid-xyz', piUsername: 'testuser' };
    mockCookie(`tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBe('uid-xyz');
  });

  it('prefers id over uid when both are present', async () => {
    const user = { id: 'id-first', uid: 'uid-second', piUsername: 'testuser' };
    mockCookie(`tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBe('id-first');
  });

  it('returns null when user has neither id nor uid', async () => {
    const user = { piUsername: 'testuser', role: 'user' };
    mockCookie(`tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBeNull();
  });
});
