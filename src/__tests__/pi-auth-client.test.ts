import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clearPi = () => {
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
};

beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(document, 'cookie', {
    value: '', writable: true, configurable: true,
  });
  clearPi();
});

afterEach(() => { clearPi(); });

// ── isPiBrowser ─────────────────────────────────────────────────

describe('isPiBrowser', () => {
  it('returns false when window.Pi is undefined', async () => {
    const { isPiBrowser } = await import('../lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(false);
  });

  it('returns false when window.Pi has no authenticate', async () => {
    (window as any).Pi = { init: vi.fn() };
    const { isPiBrowser } = await import('../lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(false);
  });

  it('returns true when window.Pi.authenticate exists', async () => {
    (window as any).Pi = { authenticate: vi.fn() };
    const { isPiBrowser } = await import('../lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(true);
  });
});

// ── getRefreshToken ─────────────────────────────────────────────

describe('getRefreshToken', () => {
  it('always returns null', async () => {
    const { getRefreshToken } = await import('../lib-client/pi/pi-auth');
    expect(getRefreshToken()).toBeNull();
  });
});

// ── getAccessToken ──────────────────────────────────────────────

describe('getAccessToken', () => {
  it('returns null when cookie not set', async () => {
    const { getAccessToken } = await import('../lib-client/pi/pi-auth');
    expect(getAccessToken()).toBeNull();
  });

  it('returns token value from cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=my-token-val; other=x',
      writable: true, configurable: true,
    });
    const { getAccessToken } = await import('../lib-client/pi/pi-auth');
    expect(getAccessToken()).toBe('my-token-val');
  });
});

// ── getStoredUser ───────────────────────────────────────────────

describe('getStoredUser', () => {
  it('returns null when cookie not set', async () => {
    const { getStoredUser } = await import('../lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });

  it('parses JSON user from cookie', async () => {
    const user = { id: 'u-1', piUsername: 'alice' };
    Object.defineProperty(document, 'cookie', {
      value: `tec_user=${encodeURIComponent(JSON.stringify(user))}`,
      writable: true, configurable: true,
    });
    const { getStoredUser } = await import('../lib-client/pi/pi-auth');
    const result = getStoredUser();
    expect(result?.id).toBe('u-1');
  });

  it('returns null when cookie value is malformed JSON', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_user=not-valid-json',
      writable: true, configurable: true,
    });
    const { getStoredUser } = await import('../lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });
});

// ── waitForPiSDK ────────────────────────────────────────────────

describe('waitForPiSDK', () => {
  it('rejects immediately when __TEC_PI_ERROR is set', async () => {
    (window as any).__TEC_PI_ERROR = true;
    const { waitForPiSDK } = await import('../lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).rejects.toThrow();
  });

  it('resolves immediately when Pi is ready', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = { authenticate: vi.fn() };
    const { waitForPiSDK } = await import('../lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).resolves.toBeUndefined();
  });

  it('resolves when tec-pi-ready event fires', async () => {
    const { waitForPiSDK } = await import('../lib-client/pi/pi-auth');
    const p = waitForPiSDK();
    window.dispatchEvent(new Event('tec-pi-ready'));
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects when tec-pi-error event fires', async () => {
    const { waitForPiSDK } = await import('../lib-client/pi/pi-auth');
    const p = waitForPiSDK();
    window.dispatchEvent(new Event('tec-pi-error'));
    await expect(p).rejects.toThrow();
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const { waitForPiSDK } = await import('../lib-client/pi/pi-auth');
    const p = waitForPiSDK(100);
    vi.advanceTimersByTime(200);
    await expect(p).rejects.toThrow();
    vi.useRealTimers();
  });
});

// ── logout ──────────────────────────────────────────────────────

describe('logout', () => {
  it('sets window.location.href to hub URL', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '' }, writable: true, configurable: true,
    });
    const { logout } = await import('../lib-client/pi/pi-auth');
    await logout();
    expect((window.location as any).href).toContain('tec-app-frontend');
  });
});
