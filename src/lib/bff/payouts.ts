import type { NextRequest } from 'next/server';
import { AppError, GATEWAY_URL, gatewayGet, type BFFContext } from '@/lib/bff/createHandler';

// Seller payouts (F2, Tec-Commerce #78 · tec-core-backend #369). The BFF only
// CARRIES these: commerce-service derives the seller from the verified token and
// decides who is an admin. Its refusals — a typo'd address, a reused hash, a chain
// that does not confirm, "admin only" — reach the screen word for word, because
// each one tells a person exactly what to fix.

export interface Payout {
  id:             string;
  source:         'order' | 'asset_listing' | string;
  source_id:      string;
  seller_id:      string;
  amount:         string;
  currency:       string;
  status:         'OWED' | 'SENT' | 'DIRECT';
  tx_id:          string | null;
  wallet_address: string | null;
  sold_at:        string | null;
  sent_at:        string | null;
  pi_username?:   string | null;
}

export interface MyPayouts {
  wallet_address: string | null;
  direct:         boolean;
  owed:           string;
  sent:           string;
  payouts:        Payout[];
}

const headers = (req: NextRequest, ctx: BFFContext): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
  'x-request-id': ctx.requestId,
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

/** Call commerce-service's /payouts routes; a refusal becomes an AppError with its own message. */
export async function payoutsCall<T>(
  req: NextRequest, ctx: BFFContext, method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown,
): Promise<T> {
  if (!GATEWAY_URL) throw new AppError('Payouts are unavailable right now', 503, 'UNAVAILABLE');
  const url = `${GATEWAY_URL}/api/commerce/payouts${path}`;
  const res = method === 'GET'
    ? await gatewayGet(url, { headers: headers(req, ctx) })
    : await fetch(url, { method, headers: headers(req, ctx), body: JSON.stringify(body ?? {}), cache: 'no-store' });
  const json = await res.json().catch(() => ({})) as { data?: T; message?: string | string[] };
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join(' ') : json.message;
    throw new AppError(msg || 'The payout service refused this request', res.status, 'PAYOUT_REFUSED');
  }
  return json.data as T;
}
