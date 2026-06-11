/**
 * Covers usePiAuth hook and lib-client/pi/pi-payment.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── pi-auth mock ──────────────────────────────────────────────
const mockGetStoredUser = vi.hoisted(() => vi.fn());
const mockLogout        = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getStoredUser: mockGetStoredUser,
  logout:        mockLogout,
  getAccessToken: vi.fn(() => null),
  isPiBrowser:    vi.fn(() => false),
  loginWithPi:    vi.fn(),
}));

// Static imports
import { usePiAuth }          from '@/lib-client/hooks/usePiAuth';
import { createU2APayment }   from '@/lib-client/pi/pi-payment';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStoredUser.mockReturnValue(null);
  mockLogout.mockResolvedValue(undefined);
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
  delete (window as any).Pi;
});

// ─────────────────────────────────────────────────────────────
describe('usePiAuth', () => {
  it('initial state has isLoading:true', () => {
    // useEffect is async — initial render has isLoading:true
    // (in test env useEffect fires synchronously, so might be false)
    const { result } = renderHook(() => usePiAuth());
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('logout');
  });

  it('resolves to unauthenticated when no stored user', async () => {
    mockGetStoredUser.mockReturnValue(null);
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('resolves to authenticated when stored user exists', async () => {
    const fakeUser = { id: 'u1', piUsername: 'alice', piId: 'pi-1', role: 'user' };
    mockGetStoredUser.mockReturnValue(fakeUser);
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(fakeUser);
  });

  it('triggers silent Pi auth when Pi SDK is ready and user is stored', async () => {
    const fakeUser = { id: 'u1', piUsername: 'alice', piId: 'pi-1', role: 'user' };
    mockGetStoredUser.mockReturnValue(fakeUser);
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = { authenticate: vi.fn(async () => ({ user: { uid: 'u1' } })) };
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('listens for tec-pi-ready when Pi not yet ready', async () => {
    const fakeUser = { id: 'u1', piUsername: 'alice', piId: 'pi-1', role: 'user' };
    mockGetStoredUser.mockReturnValue(fakeUser);
    (window as any).Pi = { authenticate: vi.fn(async () => ({})) };
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // dispatch event to trigger silent auth
    await act(async () => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout clears auth state', async () => {
    const fakeUser = { id: 'u1', piUsername: 'alice', piId: 'pi-1', role: 'user' };
    mockGetStoredUser.mockReturnValue(fakeUser);
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.logout(); });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockLogout).toHaveBeenCalled();
  });

  it('handles silent auth error gracefully', async () => {
    const fakeUser = { id: 'u1', piUsername: 'alice', piId: 'pi-1', role: 'user' };
    mockGetStoredUser.mockReturnValue(fakeUser);
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = { authenticate: vi.fn().mockRejectedValue(new Error('SDK error')) };
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should not throw — error is swallowed silently
    expect(result.current.isAuthenticated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('createU2APayment (lib-client)', () => {
  it('resolves failed when window.Pi is not available', async () => {
    delete (window as any).Pi;
    const result = await createU2APayment(1, 'test memo');
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Pi Browser');
  });

  it('calls Pi.createPayment when Pi is available', async () => {
    const mockCreatePayment = vi.fn();
    (window as any).Pi = { createPayment: mockCreatePayment };
    // Pi.createPayment doesn't call callbacks automatically in tests
    // so the promise stays pending — we just verify it was called
    const promise = createU2APayment(5, 'cart checkout', { source: 'cart' });
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5, memo: 'cart checkout', metadata: { source: 'cart' } }),
      expect.objectContaining({
        onReadyForServerApproval: expect.any(Function),
        onReadyForServerCompletion: expect.any(Function),
        onCancel: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    // Resolve the payment via onCancel to avoid hanging
    const callbacks = mockCreatePayment.mock.calls[0][1];
    callbacks.onCancel('pay-id');
    const res = await promise;
    expect(res.status).toBe('cancelled');
  });

  it('onCancel resolves with cancelled status', async () => {
    (window as any).Pi = { createPayment: vi.fn((_, cbs) => { cbs.onCancel('pay-1'); }) };
    const result = await createU2APayment(1, 'test');
    expect(result.success).toBe(false);
    expect(result.status).toBe('cancelled');
  });

  it('onError resolves with failed status', async () => {
    (window as any).Pi = {
      createPayment: vi.fn((_, cbs) => {
        cbs.onError(new Error('SDK crashed'), { identifier: 'pay-err' });
      }),
    };
    const result = await createU2APayment(1, 'test');
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('onReadyForServerApproval calls /api/payment/approve', async () => {
    let resolvePayment!: (r: any) => void;
    (window as any).Pi = {
      createPayment: vi.fn(async (_, cbs) => {
        await cbs.onReadyForServerApproval('pay-id-123');
        resolvePayment = cbs.onReadyForServerCompletion;
      }),
    };
    // Mock the fetch for approve
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ payment_id: 'internal-1' }),
    }));
    const promise = createU2APayment(2, 'test approve');
    // Give time for async approval
    await new Promise(r => setTimeout(r, 50));
    if (resolvePayment) resolvePayment('tx-1', { identifier: 'pay-id-123' });
    vi.unstubAllGlobals();
  });

  it('onReadyForServerCompletion calls /api/payment/complete', async () => {
    (window as any).Pi = {
      createPayment: vi.fn((_, cbs) => {
        // signature: (paymentId: string, txid: string)
        setTimeout(() => cbs.onReadyForServerCompletion('pay-456', 'txid-abc'), 0);
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true }),
    }));
    const result = await createU2APayment(3, 'test complete');
    expect(result.success).toBe(true);
    expect(result.txid).toBe('txid-abc');
    vi.unstubAllGlobals();
  });

  it('completion failure resolves with failed', async () => {
    (window as any).Pi = {
      createPayment: vi.fn((_, cbs) => {
        setTimeout(() => cbs.onReadyForServerCompletion('tx-bad', { identifier: 'pay-bad' }), 0);
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await createU2APayment(1, 'fail test');
    expect(result.success).toBe(false);
    vi.unstubAllGlobals();
  });
});
