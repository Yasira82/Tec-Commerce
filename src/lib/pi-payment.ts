import { rememberHubHold } from '@/lib-client/orders/hub-hold';

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

export interface PaymentResult {
  status:     'completed' | 'cancelled' | 'error';
  success:    boolean;
  paymentId?: string;
  txid?:      string;
  message?:   string;
}

/**
 * The order each payment record reserved (payment-id → order-id). The server holds
 * the unit BEFORE Pi opens (lib/order-hold.ts) and names the hold in its answer; the
 * buy screen then confirms THAT order after paying, or releases it when the payment
 * does not complete — instead of creating an order after the money has moved.
 */
const heldOrders = new Map<string, string>();
export const heldOrderFor = (paymentId: string): string | undefined => heldOrders.get(paymentId);

/**
 * Why the last `createPaymentRecord` returned null, when the server said why —
 * "out of stock", "no longer available", "price changed". Read once.
 */
let lastRefusal: string | null = null;
export const takePaymentRecordRefusal = (): string | null => {
  const r = lastRefusal; lastRefusal = null; return r;
};

/** The payment did not complete here (Cancel, error, timeout): put the held unit
 *  back on sale now. Conditional in commerce — a hold already PAID stays paid. */
export const releaseHeldOrder = async (paymentId: string): Promise<void> => {
  const orderId = heldOrders.get(paymentId);
  if (!orderId) return;
  heldOrders.delete(paymentId);
  try {
    await fetch(`/api/bff/commerce/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    });
  } catch { /* commerce releases an unpaid hold on its own after the TTL */ }
};

/**
 * After a completed Pi payment: settle the order it paid for — a CONFIRM of the held
 * order, or (older server, no hold) the order created as before. The payment's own
 * event settles a held order even if this call never arrives.
 */
export const recordPaidOrder = async (paymentId: string, productId: string, txid?: string): Promise<void> => {
  const order_id = heldOrders.get(paymentId);
  heldOrders.delete(paymentId);
  await fetch('/api/bff/commerce/orders', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    body: JSON.stringify(order_id
      ? { order_id, payment_id: paymentId }
      : { product_id: productId, payment_id: paymentId, ...(txid && { txid }) }),
  });
};

/**
 * Mode 1 (paying at the Hub): reserve first, so the Hub is never asked to take π for
 * a unit someone else already has. The order to carry to the Hub (null when the
 * server has no holds yet, or there is no session here — the Hub flow then runs as
 * before), or why it was refused.
 */
export const holdForHub = async (
  amount: number, productId: string,
): Promise<{ orderId: string | null } | { refusal: string }> => {
  try {
    const res = await fetch('/api/bff/commerce/orders/hold', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ amount, product_id: productId }),
    });
    const body = await res.json().catch(() => null) as { message?: unknown; data?: { order_id?: unknown } } | null;
    if (res.status === 409 || res.status === 503) {
      return { refusal: typeof body?.message === 'string' ? body.message : 'This product is not available right now.' };
    }
    const id = body?.data?.order_id;
    const orderId = res.ok && typeof id === 'string' ? id : null;
    if (orderId) rememberHubHold(orderId);
    return { orderId };
  } catch {
    return { orderId: null };
  }
};

export const createPaymentRecord = async (
  amount: number, productId: string, memo: string,
): Promise<string | null> => {
  lastRefusal = null;
  try {
    const token = getToken();
    const res   = await fetch('/api/bff/payment/create', {
      method:      'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrfToken(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ amount, product_id: productId, memo, source: 'commerce' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { message?: unknown } | null;
      if (res.status === 409 || res.status === 503) {
        lastRefusal = typeof body?.message === 'string' ? body.message : null;
      }
      return null;
    }
    const data = await res.json();
    const id: string | null = data?.data?.payment?.id ?? data?.id ?? null;
    if (id && typeof data?.order_id === 'string') heldOrders.set(id, data.order_id);
    return id;
  } catch { return null; }
};

export const createU2APayment = async (
  amount:     number,
  memo:       string,
  metadata:   Record<string, unknown>,
  internalId: string,
): Promise<PaymentResult> => {
  return new Promise(async (resolve) => {
    if (!window.Pi) {
      resolve({ status: 'error', success: false, message: 'Pi SDK not ready' });
      return;
    }

    let settled = false;
    const done = (result: PaymentResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    // ✅ Timeout 90s — يمنع الـ spinner يلف للأبد
    const timer = setTimeout(() => {
      done({ status: 'error', success: false, message: 'Payment timed out — please try again.' });
    }, 90_000);

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // ✅ لو authenticate فشل — وقف وظهّر السبب
try {
  await window.Pi.authenticate(
    ['username', 'payments'],
    async (incomplete: unknown) => {
      const pid = (incomplete as { identifier?: string } | null)?.identifier;
      if (!pid) return;
      try {
        await fetch('/api/bff/payment/resolve-incomplete', {
          method: 'POST', credentials: 'include',
          headers, body: JSON.stringify({ pi_payment_id: pid }),
        });
      } catch {}
    },
  );
} catch (authErr) {
  done({
    status:  'error',
    success: false,
    message: 'Pi auth failed: ' + (authErr instanceof Error ? authErr.message : String(authErr)),
  });
  return;
}

    // ✅ try-catch حوالين Pi.createPayment يكشف الـ error الصامت
    try {
      window.Pi.createPayment(
        { amount, memo, metadata: { ...metadata, internalId } },
        {
          onReadyForServerApproval: async (piPaymentId: string) => {
            try {
              const res = await fetch('/api/bff/payment/approve', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                done({ status: 'error', success: false, message: (err as any)?.error?.message ?? 'Approve failed' });
              }
              // ✅ لو approve نجح → نستنى onReadyForServerCompletion
            } catch (err) {
              done({ status: 'error', success: false, message: String(err) });
            }
          },
          onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
            try {
              const res  = await fetch('/api/bff/payment/complete', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, transaction_id: txid, pi_payment_id: piPaymentId }),
              });
              const data = await res.json().catch(() => ({}));
              done(res.ok
                ? { status: 'completed', success: true, paymentId: internalId, txid }
                : { status: 'error', success: false, message: (data as any)?.error?.message ?? 'Complete failed' });
            } catch (err) {
              done({ status: 'error', success: false, message: String(err) });
            }
          },
          onCancel: (_piPaymentId: string) => done({ status: 'cancelled', success: false }),
          onError:  (err: Error)           => done({ status: 'error', success: false, message: err.message }),
        },
      );
    } catch (err) {
      // ✅ Pi.createPayment رمى error صامت — هيظهر الرسالة الحقيقية
      done({
        status:  'error',
        success: false,
        message: err instanceof Error ? err.message : 'Pi payment error — please try again.',
      });
    }
  });
};
