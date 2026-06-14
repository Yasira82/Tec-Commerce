import { PiAuthResult, TecAuthResponse, PiPaymentData, PiPaymentCallbacks } from '@/types/pi.types';
import sdk from '@/lib/sdk';

declare global {
  interface Window {
    Pi: {
      authenticate: (
        scopes: string[],
        onIncompletePayment: (payment: unknown) => void
      ) => Promise<PiAuthResult>;
      createPayment: (paymentData: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
      init: (config: { version: string; sandbox: boolean; appId?: string }) => void;
    };
    __PI_SANDBOX?:   boolean;
    __TEC_PI_READY?: boolean;
    __TEC_PI_ERROR?: boolean;
  }
}

const ERRORS = {
  NOT_PI_BROWSER:  'Please open the app inside Pi Browser to authenticate.',
  SDK_LOAD_FAILED: 'Pi SDK failed to load.',
  SDK_INIT_FAILED: 'Pi SDK initialization failed.',
  AUTH_TIMEOUT:    'Authentication timed out.',
  SAVE_FAILED:     'Failed to save authentication data.',
};

export const isPiBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.Pi !== 'undefined' && typeof window.Pi.authenticate === 'function';
};

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('tec_access_token='));
    if (!match) return null;
    return match.substring(match.indexOf('=') + 1);
  } catch { return null; }
};

export const getRefreshToken = (): string | null => null;

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('tec_user='));
    if (!match) return null;
    const value = match.substring(match.indexOf('=') + 1);
    // ✅ try decode أولاً — fallback لو مش encoded
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch {
      return JSON.parse(value);
    }
  } catch { return null; }
};

// ── Logout ────────────────────────────────────────────────
export const logout = async (): Promise<void> => {
  try {
    const cookieBase = 'path=/; secure; samesite=none; max-age=0';
    document.cookie = `tec_access_token=; ${cookieBase}`;
    document.cookie = `tec_user=; ${cookieBase}`;
    document.cookie = `tec_csrf=; ${cookieBase}`;
    // ✅ مش بنستدعي sdk هنا عشان مش Pi app
  } catch (err) {
    console.error('[Pi Auth] Logout error:', err);
  } finally {
    window.location.href = 'https://tec-app-frontend.vercel.app';
  }
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise(resolve => { refreshQueue.push(resolve); });
  }
  isRefreshing = true;
  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      await logout();
      refreshQueue.forEach(cb => cb(null));
      refreshQueue = [];
      return null;
    }
    const data = await res.json();
    refreshQueue.forEach(cb => cb(data.token ?? null));
    refreshQueue = [];
    return data.token ?? null;
  } catch (err) {
    console.error('[Pi Auth] Refresh failed:', err);
    await logout();
    refreshQueue.forEach(cb => cb(null));
    refreshQueue = [];
    return null;
  } finally {
    isRefreshing = false;
  }
};

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return res;
    return fetch(url, { ...options, credentials: 'include' });
  }
  return res;
};

export const resolvePendingPayment = async (
  piPaymentId: string
): Promise<{ action: string } | null> => {
  try {
    await sdk.payment.resolveIncomplete(piPaymentId);
    return { action: 'resolved' };
  } catch (err) {
    _captureError('resolvePendingPayment failed', { piPaymentId, error: String(err) });
    return null;
  }
};

const _captureError = (message: string, data: Record<string, unknown>): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureMessage(`[Pi Recovery] ${message}`, {
        level: 'error', extra: data,
        tags:  { component: 'pi-auth', type: 'incomplete-payment' },
      });
    }).catch(() => {});
  } catch {}
};

const _reportResolved = (piPaymentId: string, via: string, action?: unknown): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.addBreadcrumb({
        category: 'pi.payment',
        message:  `Payment resolved via ${via}`,
        level:    'info',
        data:     { piPaymentId, via, action },
      });
    }).catch(() => {});
  } catch {}
};

const _addBreadcrumb = (message: string, data: Record<string, unknown>): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.addBreadcrumb({
        category: 'pi.payment', message, level: 'warning', data,
      });
    }).catch(() => {});
  } catch {}
};

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('tec_csrf='))
    ?.split('=')?.[1] ?? '';
};

let _pendingPaymentId: string | null = null;

interface IncompletePayment { identifier?: string; }

const handleIncompletePayment = (payment: unknown): void => {
  const p = payment as IncompletePayment;
  if (!p?.identifier) return;
  _pendingPaymentId = p.identifier;
  _addBreadcrumb('Incomplete payment detected', { piPaymentId: p.identifier });
};

const resolveIncompleteAfterLogin = async (piPaymentId: string): Promise<void> => {
  const csrfToken = getCsrfToken();
  try {
    const res = await fetch('/api/bff/payment/resolve-incomplete', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { _reportResolved(piPaymentId, 'backend', data?.action); return; }
    _captureError('resolve-incomplete backend failed', { piPaymentId, status: res.status, data });
  } catch (err) {
    _captureError('resolve-incomplete network error', { piPaymentId, error: String(err) });
  }
  try {
    const result = await sdk.payment.resolveIncomplete(piPaymentId);
    _reportResolved(piPaymentId, 'sdk', result?.status); return;
  } catch (sdkErr) {
    _captureError('SDK resolve failed', { piPaymentId, error: String(sdkErr) });
  }
  try {
    const res = await fetch('/api/payment/cancel', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    if (res.ok) { _reportResolved(piPaymentId, 'cancel'); }
    else { _captureError('All recovery failed', { piPaymentId, cancelStatus: res.status }); }
  } catch (err) {
    _captureError('Cancel network error', { piPaymentId, error: String(err) });
  }
};

export const waitForPiSDK = (timeout = 15000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.__TEC_PI_ERROR) {
      reject(new Error(ERRORS.SDK_LOAD_FAILED)); return;
    }
    if (typeof window !== 'undefined' && typeof window.Pi !== 'undefined' && window.__TEC_PI_READY) {
      resolve(); return;
    }
    const timer = setTimeout(() => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
      reject(new Error(ERRORS.SDK_LOAD_FAILED));
    }, timeout);
    const onReady = () => { clearTimeout(timer); window.removeEventListener('tec-pi-error', onError); resolve(); };
    const onError = () => { clearTimeout(timer); window.removeEventListener('tec-pi-ready', onReady); reject(new Error(ERRORS.SDK_INIT_FAILED)); };
    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });
  });
};

const getAuthTimeout = (): number => {
  const t = parseInt(process.env.NEXT_PUBLIC_PI_AUTH_TIMEOUT ?? '45000', 10);
  return !isNaN(t) && t > 0 ? t : 45000;
};

const authenticateWithTimeout = async (timeout?: number): Promise<PiAuthResult> => {
  await waitForPiSDK();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(isPiBrowser() ? ERRORS.AUTH_TIMEOUT : ERRORS.NOT_PI_BROWSER));
    }, timeout ?? getAuthTimeout());
    window.Pi.authenticate(['username', 'payments'], handleIncompletePayment)
      .then(r => { clearTimeout(timer); resolve(r); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
};

export const loginWithPi = async (): Promise<TecAuthResponse> => {
  if (!isPiBrowser()) throw new Error(ERRORS.NOT_PI_BROWSER);
  _pendingPaymentId = null;
  const piAuth = await authenticateWithTimeout();
  const res = await fetch('/api/auth/pi-login', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: piAuth.accessToken }),
  });
  if (!res.ok) throw new Error(ERRORS.SAVE_FAILED);
  const data = await res.json();
  if (_pendingPaymentId) {
    void resolveIncompleteAfterLogin(_pendingPaymentId);
    _pendingPaymentId = null;
  }
  _registerFCMToken(piAuth.accessToken).catch(() => {});
  return {
    success:   data.success,
    isNewUser: data.isNewUser,
    user: {
      id:               data.user.id,
      piId:             data.user.piId,
      piUsername:       data.user.piUsername,
      role:             data.user.role,
      subscriptionPlan: data.user.subscriptionPlan,
      createdAt:        data.user.createdAt,
    },
    tokens: { accessToken: '', refreshToken: '' },
  };
};

const _registerFCMToken = async (_accessToken: string): Promise<void> => {
  // FCM optional
};
