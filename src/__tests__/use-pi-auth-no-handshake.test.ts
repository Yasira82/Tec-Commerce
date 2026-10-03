/**
 * The Pi handshake on a visit belongs to PiVisitSignIn (app/layout.tsx), once per
 * page load and never in a Hub-owned session. usePiAuth used to start a second one
 * at the same moment, straight on window.Pi; Pi Browser answers neither of two
 * concurrent authenticate calls. It must not come back (2026-10-03).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetStoredUser = vi.fn();
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getStoredUser: mockGetStoredUser,
  logout:        vi.fn().mockResolvedValue(undefined),
}));

describe('usePiAuth starts no Pi handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).__TEC_PI_READY;
    delete (window as any).Pi;
  });

  it('with Pi ready and a stored user', async () => {
    mockGetStoredUser.mockReturnValue({ id: 'u1', piUsername: 'a' });
    const authenticate = vi.fn().mockResolvedValue({});
    (window as any).Pi = { authenticate };
    (window as any).__TEC_PI_READY = true;

    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('when tec-pi-ready fires later', async () => {
    mockGetStoredUser.mockReturnValue({ id: 'u2', piUsername: 'b' });
    const authenticate = vi.fn().mockResolvedValue({});
    (window as any).Pi = { authenticate };

    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    const { result } = renderHook(() => usePiAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { window.dispatchEvent(new Event('tec-pi-ready')); });
    await new Promise((r) => setTimeout(r, 50));

    expect(authenticate).not.toHaveBeenCalled();
  });
});
