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
