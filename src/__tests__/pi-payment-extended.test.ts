/**
 * Extended tests for src/lib/pi-payment.ts — createU2APayment function
 * Targets lines 44-134 (window.Pi integration)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── cookie helper ──────────────────────────────────────────
const mockCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
};

describe('createU2APayment', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    mockCookie('tec_access_token=test-token; tec_csrf=csrf-123');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete (window as any).Pi;
  });

  it('returns error status when window.Pi is not available', async () => {
    delete (window as any).Pi;

    const { createU2APayment } = await import('@/lib/pi-payment');
    const result = await createU2APayment(1.0, 'Test memo', {}, 'internal-123');

    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Pi SDK not ready');
  });

  it('returns error when Pi.authenticate throws', async () => {
    (window as any).Pi = {
      authenticate:  vi.fn().mockRejectedValue(new Error('Auth failed')),
      createPayment: vi.fn(),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const result = await createU2APayment(1.0, 'Test memo', {}, 'internal-456');

    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Pi auth failed');
  });

  it('returns cancelled status when onCancel is called', async () => {
    const callbacks: Record<string, Function> = {};

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: vi.fn((_data: unknown, cbs: Record<string, Function>) => {
        Object.assign(callbacks, cbs);
      }),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const promise = createU2APayment(1.0, 'Test memo', {}, 'internal-cancel');

    // Trigger onCancel
    await Promise.resolve(); // let createPayment run
    callbacks['onCancel']?.('pi-payment-id');

    const result = await promise;
    expect(result.status).toBe('cancelled');
    expect(result.success).toBe(false);
  });

  it('returns error status when onError is called', async () => {
    const callbacks: Record<string, Function> = {};

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: vi.fn((_data: unknown, cbs: Record<string, Function>) => {
        Object.assign(callbacks, cbs);
      }),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const promise = createU2APayment(1.0, 'Test memo', {}, 'internal-error');

    await Promise.resolve();
    callbacks['onError']?.(new Error('Payment SDK error'));

    const result = await promise;
    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Payment SDK error');
  });

  it('returns completed status when full payment flow succeeds', async () => {
    const callbacks: Record<string, Function> = {};

    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)  // approve
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) } as unknown as Response); // complete

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: vi.fn((_data: unknown, cbs: Record<string, Function>) => {
        Object.assign(callbacks, cbs);
      }),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const promise = createU2APayment(2.5, 'Full flow memo', { orderId: 'ord-1' }, 'internal-full');

    await Promise.resolve();
    await callbacks['onReadyForServerApproval']?.('pi-pay-id');
    await callbacks['onReadyForServerCompletion']?.('pi-pay-id', 'txid-abc');

    const result = await promise;
    expect(result.status).toBe('completed');
    expect(result.success).toBe(true);
    expect(result.paymentId).toBe('internal-full');
    expect(result.txid).toBe('txid-abc');
  });

  it('returns error when approve endpoint fails', async () => {
    const callbacks: Record<string, Function> = {};

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Approve failed' } }),
    } as unknown as Response);

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: vi.fn((_data: unknown, cbs: Record<string, Function>) => {
        Object.assign(callbacks, cbs);
      }),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const promise = createU2APayment(1.0, 'Approve fail memo', {}, 'internal-appfail');

    await Promise.resolve();
    await callbacks['onReadyForServerApproval']?.('pi-pay-id');

    const result = await promise;
    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
  });

  it('returns error when complete endpoint fails', async () => {
    const callbacks: Record<string, Function> = {};

    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as unknown as Response) // approve ok
      .mockResolvedValueOnce({                                                                       // complete fails
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Complete failed' } }),
      } as unknown as Response);

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: vi.fn((_data: unknown, cbs: Record<string, Function>) => {
        Object.assign(callbacks, cbs);
      }),
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    const promise = createU2APayment(1.0, 'Complete fail', {}, 'internal-compfail');

    await Promise.resolve();
    await callbacks['onReadyForServerApproval']?.('pi-pay-id');
    await callbacks['onReadyForServerCompletion']?.('pi-pay-id', 'txid-fail');

    const result = await promise;
    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
  });

  it('passes correct payment data to Pi.createPayment', async () => {
    const createPaymentMock = vi.fn();

    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({ accessToken: 'pi-token' }),
      createPayment: createPaymentMock,
    };

    const { createU2APayment } = await import('@/lib/pi-payment');
    // Start the payment — it won't resolve since no callbacks are triggered
    const promise = createU2APayment(3.14, 'Verify memo', { key: 'val' }, 'internal-verify');

    await Promise.resolve();

    expect(createPaymentMock).toHaveBeenCalledTimes(1);
    const [paymentData] = createPaymentMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(paymentData.amount).toBe(3.14);
    expect(paymentData.memo).toBe('Verify memo');
    expect((paymentData.metadata as Record<string, unknown>)?.internalId).toBe('internal-verify');

    // Resolve the promise via cancel to avoid hanging
    const [, callbacks] = createPaymentMock.mock.calls[0] as [unknown, Record<string, Function>];
    callbacks['onCancel']?.('pi-pay-id');
    await promise;
  });
});
