'use client';

// Sign this app in with its OWN Pi handshake, when it has no TEC session
// (C-123 §10 — the standalone visit). The template apps carry this in
// lib/pi/self-sign-in.ts on top of `piSession`; this app's Pi handshake lives in
// lib/pi/visit-sign-in.ts instead, so the same flow is built on that:
//
//   Pi's token (visit-sign-in) → /api/auth/pi-self-login → a one-time token →
//   a TOP-LEVEL navigation to /api/auth/sso-callback, whose 200 landing sets the
//   cookies in THIS browser context (LAW 2) and comes back here.
//
// When it does nothing — each one on purpose:
//   · a Hub-owned Pi session (ADR-007): Pi never answers there;
//   · `/me` already says yes: nothing to fix;
//   · it already tried in this tab within the window below — unless `force`:
//     the window guards a LOOP, not a person pressing the sign-in button.

import { piVisitSignIn, piAccessToken } from './visit-sign-in';

const TRIED_KEY = '__tec_self_signin';
const RETRY_AFTER_MS = 10 * 60 * 1000;

const isForeignSession = (): boolean =>
  (window as unknown as { __TEC_PI_FOREIGN_SESSION?: boolean }).__TEC_PI_FOREIGN_SESSION === true;

const csrf = (): string =>
  decodeURIComponent(document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]*)/)?.[1] ?? '');

/** True when an attempt may start; records the attempt. False when it must not. */
function claimAttempt(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(TRIED_KEY) ?? 0);
    if (last && now - last < RETRY_AFTER_MS) return false;
    sessionStorage.setItem(TRIED_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export type SelfSignInOutcome =
  | 'foreign-session' | 'has-session' | 'already-tried' | 'no-pi'
  | 'refused' | 'navigating';

export async function selfSignIn(now: number = Date.now(), opts: { force?: boolean } = {}): Promise<SelfSignInOutcome> {
  if (typeof window === 'undefined' || isForeignSession()) return 'foreign-session';

  const me = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).catch(() => null);
  // Only a definite "no session" starts a sign-in. A network failure is not one.
  if (!me || me.ok || me.status !== 401) return 'has-session';

  if (!(await piVisitSignIn())) return 'no-pi';
  const accessToken = piAccessToken();
  if (!accessToken) return 'no-pi';

  if (!claimAttempt(now) && !opts.force) return 'already-tried';

  const res = await fetch('/api/auth/pi-self-login', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
    body:        JSON.stringify({ accessToken }),
  }).catch(() => null);
  const ssoToken = res?.ok
    ? ((await res.json().catch(() => null)) as { ssoToken?: unknown } | null)?.ssoToken
    : null;
  if (typeof ssoToken !== 'string' || !ssoToken) return 'refused';

  // Back to exactly where the visitor is — path and query. Same-origin by
  // construction; the callback re-checks it anyway.
  const here = window.location.pathname + window.location.search;
  window.location.replace(
    `/api/auth/sso-callback?token=${encodeURIComponent(ssoToken)}&redirect=${encodeURIComponent(here)}`,
  );
  return 'navigating';
}
