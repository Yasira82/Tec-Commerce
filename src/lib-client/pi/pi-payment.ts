import { PiPaymentData, PiPaymentCallbacks } from '@/types/pi.types';

export interface PaymentResult {
  success:    boolean;
  status:     'completed' | 'cancelled' | 'failed';
  txid?:      string;
  paymentId?: string;
  message?:   string;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ')
    .find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

export const createU2APayment = (
  amount:   number,
  memo:     string,
  metadata: Record<string, unknown> = {},
): Promise<PaymentResult> => {
  return new Promise((resolve) => {
    if (!window.Pi) {
      resolve({ success: false, status: 'failed', message: 'Open in Pi Browser' });
      return;
    }

    const paymentData: PiPaymentData = { amount, memo, metadata };

    const callbacks: PiPaymentCallbacks = {
      onReadyForServerApproval: async (paymentId: string) => {
        try {
          await fetch('/api/payment/approve', {
            method:      'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': getCsrfToken(),
            },
            body: JSON.stringify({ paymentId }),
          });
        } catch {
          resolve({ success: false, status: 'failed', message: 'Approval failed' });
        }
      },

      onReadyForServerCompletion: async (paymentId: string, txid: string) => {
        try {
          const res = await fetch('/api/payment/complete', {
            method:      'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': getCsrfToken(),
            },
            body: JSON.stringify({ paymentId, txid }),
          });
          if (res.ok) {
            resolve({ success: true, status: 'completed', txid, paymentId });
          } else {
            resolve({ success: false, status: 'failed', message: 'Completion failed' });
          }
        } catch {
          resolve({ success: false, status: 'failed', message: 'Network error' });
        }
      },

      onCancel: (_paymentId: string) => {
        resolve({ success: false, status: 'cancelled' });
      },

      onError: (error: unknown) => {
        const msg = error instanceof Error ? error.message : 'Payment error';
        resolve({ success: false, status: 'failed', message: msg });
      },
    };

    window.Pi.createPayment(paymentData, callbacks);
  });
};
