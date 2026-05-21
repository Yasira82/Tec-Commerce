const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

export interface PaymentResult {
  status:    'completed' | 'cancelled' | 'error';
  success:   boolean;
  paymentId?: string;
  txid?:     string;
  message?:  string;
}

export const createPaymentRecord = async (
  amount: number, productId: string, memo: string,
): Promise<string | null> => {
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
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.payment?.id ?? data?.id ?? null;
  } catch { return null; }
};

export const createU2APayment = async (
  amount: number,
  memo: string,
  metadata: Record<string, unknown>,
  internalId: string,
): Promise<PaymentResult> => {
  return new Promise(async (resolve) => {
    if (!window.Pi) { resolve({ status: 'error', success: false, message: 'Pi SDK not ready' }); return; }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // ✅ await Pi.authenticate قبل createPayment
    try {
      await window.Pi.authenticate(
        ['username', 'payments'],
        async (incomplete: unknown) => {
          const p   = incomplete as { identifier?: string } | null;
          const pid = p?.identifier;
          if (!pid) return;
          try {
            await fetch('/api/bff/payment/resolve-incomplete', {
              method: 'POST', credentials: 'include',
              headers, body: JSON.stringify({ pi_payment_id: pid }),
            });
          } catch {}
        },
      );
    } catch {
      // authenticate failed → لا نوقف العملية
    }

    // ✅ createPayment بعد ما authenticate خلص
    window.Pi.createPayment(
      { amount, memo, metadata: { ...metadata, internalId } },
      {
        onReadyForServerApproval: async (piPaymentId: string) => {
          try {
            const res = await fetch('/api/bff/payment/approve', {
              method: 'POST', credentials: 'include',
              headers,
              body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
            });
            if (!res.ok) { resolve({ status: 'error', success: false, message: 'Approve failed' }); }
          } catch (err) {
            resolve({ status: 'error', success: false, message: String(err) });
          }
        },
        onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
          try {
            const res = await fetch('/api/bff/payment/complete', {
              method: 'POST', credentials: 'include',
              headers,
              body: JSON.stringify({ payment_id: internalId, transaction_id: txid, pi_payment_id: piPaymentId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              resolve({ status: 'completed', success: true, paymentId: internalId, txid });
            } else {
              resolve({ status: 'error', success: false, message: (data as any)?.error?.message ?? 'Complete failed' });
            }
          } catch (err) {
            resolve({ status: 'error', success: false, message: String(err) });
          }
        },
        onCancel:  (_piPaymentId: string) => resolve({ status: 'cancelled', success: false }),
        onError:   (err: Error)           => resolve({ status: 'error',     success: false, message: err.message }),
      },
    );
  });
};
