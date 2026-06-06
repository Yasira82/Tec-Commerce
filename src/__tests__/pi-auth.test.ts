import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── cookie helper ──────────────────────────────────────────
const mockCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
};

describe('isPiBrowser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when window.Pi is not defined', async () => {
    // Ensure window.Pi is absent
    const original = (window as any).Pi;
    delete (window as any).Pi;

    const { isPiBrowser } = await import('@/lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(false);

    // Restore
    (window as any).Pi = original;
  });

  it('returns false when window.Pi has no authenticate function', async () => {
    (window as any).Pi = { createPayment: vi.fn() };

    const { isPiBrowser } = await import('@/lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(false);

    delete (window as any).Pi;
  });

  it('returns true when window.Pi has authenticate function', async () => {
    (window as any).Pi = {
      authenticate:  vi.fn(),
      createPayment: vi.fn(),
    };

    const { isPiBrowser } = await import('@/lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(true);

    delete (window as any).Pi;
  });
});

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when cookie is missing', async () => {
    mockCookie('');
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBeNull();
  });

  it('returns null when other cookies exist but not tec_access_token', async () => {
    mockCookie('some_other=value; another=test');
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBeNull();
  });

  it('returns token value when cookie is present', async () => {
    mockCookie('tec_access_token=my-token-value');
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBe('my-token-value');
  });

  it('returns correct token when multiple cookies present', async () => {
    mockCookie('tec_csrf=csrf-abc; tec_access_token=tok-789; tec_user={}');
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBe('tok-789');
  });
});

describe('getRefreshToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('always returns null', async () => {
    const { getRefreshToken } = await import('@/lib-client/pi/pi-auth');
    expect(getRefreshToken()).toBeNull();
  });

  it('still returns null even with cookies set', async () => {
    mockCookie('tec_refresh_token=some-value');
    const { getRefreshToken } = await import('@/lib-client/pi/pi-auth');
    expect(getRefreshToken()).toBeNull();
  });
});

describe('getStoredUser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when no tec_user cookie', async () => {
    mockCookie('');
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });

  it('returns null when cookie is malformed JSON', async () => {
    mockCookie('tec_user=not-valid-json');
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });

  it('parses plain JSON user cookie', async () => {
    const user = { id: 'u1', piUsername: 'testuser', role: 'user' };
    mockCookie(`tec_user=${JSON.stringify(user)}`);
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    const result = getStoredUser() as typeof user;
    expect(result?.id).toBe('u1');
    expect(result?.piUsername).toBe('testuser');
  });

  it('parses URL-encoded JSON user cookie', async () => {
    const user = { id: 'u2', piUsername: 'encoded-user', role: 'admin' };
    mockCookie(`tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    const result = getStoredUser() as typeof user;
    expect(result?.piUsername).toBe('encoded-user');
    expect(result?.role).toBe('admin');
  });

  it('returns correct user when multiple cookies present', async () => {
    const user = { id: 'u3', piUsername: 'multi-cookie-user' };
    mockCookie(`tec_access_token=tok; tec_csrf=csrf; tec_user=${encodeURIComponent(JSON.stringify(user))}`);
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    const result = getStoredUser() as typeof user;
    expect(result?.id).toBe('u3');
  });
});
