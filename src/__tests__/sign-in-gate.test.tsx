/**
 * The door of the app: a sign-in button before any screen (owner, 2026-10-06 —
 * "there should be a login button at the very start, before I enter any app").
 *
 * This app used to send a session-less visit straight to the Hub's SSO. Now the
 * button runs the app's own Pi sign-in (so Pi counts the visit here); when Pi
 * cannot answer, the Hub signs them in. A visit from the Hub never sees the gate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let auth = { isAuthenticated: false, isLoading: false, user: null };
const selfSignIn = vi.fn();
vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: () => auth }));
vi.mock('@/lib/sso', () => ({ ssoUrl: () => 'https://hub.test/api/auth/sso?target=app', HUB_URL: 'https://hub.test', appOrigin: () => 'https://app.test' }));
vi.mock('@/lib/pi/self-sign-in', () => ({ selfSignIn: (...a: unknown[]) => selfSignIn(...a) }));

import { SignInGate } from '@/components/pi/SignInGate';

const me = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status } as Response)));
const loc = { href: '', pathname: '/app', search: '', origin: 'https://app.test', reload: vi.fn(), replace: vi.fn() };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  auth = { isAuthenticated: false, isLoading: false, user: null }; selfSignIn.mockReset();
  loc.href = ''; loc.reload.mockReset(); loc.replace.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: loc });
});

describe('SignInGate', () => {
  it('a signed-in member sees the app, never the gate', async () => {
    me(200);
    render(<SignInGate><p>the app</p></SignInGate>);
    await waitFor(() => expect(screen.getByText('the app')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Sign in with Pi' })).toBeNull();
  });

  it('while the session is unknown it shows neither — no gate flashed at a member', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => { /* never answers */ })));
    render(<SignInGate><p>the app</p></SignInGate>);
    expect(screen.queryByText('the app')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in with Pi' })).toBeNull();
  });

  it('no session → the button, and nothing of the app — no silent hop to the Hub', async () => {
    me(401);
    render(<SignInGate><p>the app</p></SignInGate>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with Pi' })).toBeTruthy());
    expect(screen.queryByText('the app')).toBeNull();
    expect(loc.href).toBe('');
  });

  it("the button runs the app's OWN sign-in, forced past the attempt window", async () => {
    me(401); selfSignIn.mockResolvedValue('navigating');
    render(<SignInGate><p /></SignInGate>);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Pi' }));
    await waitFor(() => expect(selfSignIn).toHaveBeenCalled());
    expect(selfSignIn.mock.calls[0]?.[1]).toEqual({ force: true });
    expect(loc.href).toBe('');
  });

  it.each(['foreign-session', 'no-pi', 'refused'])('when Pi cannot answer here (%s) the Hub signs them in', async (outcome) => {
    me(401); selfSignIn.mockResolvedValue(outcome);
    render(<SignInGate><p /></SignInGate>);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Pi' }));
    await waitFor(() => expect(loc.href).toContain('/api/auth/sso?target='));
  });

  it('the secondary link goes through the Hub directly', async () => {
    me(401);
    render(<SignInGate><p /></SignInGate>);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in through the Hub instead' }));
    expect(loc.href).toContain('/api/auth/sso?target=');
    expect(selfSignIn).not.toHaveBeenCalled();
  });

  it('/app is behind the gate — the default export wraps the page in it', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/app/page.tsx'), 'utf8');
    expect(page).toMatch(/export default function \w+\(\) \{\s*return <SignInGate><\w+ \/><\/SignInGate>;/);
  });
});

describe('selfSignIn (this app: on top of visit-sign-in)', () => {
  const load = async (opts: { me: number; pi: string | null }) => {
    vi.doUnmock('@/lib/pi/self-sign-in');
    vi.doMock('@/lib/pi/visit-sign-in', () => ({ piVisitSignIn: async () => opts.pi !== null, piAccessToken: () => opts.pi }));
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      String(u).includes('/api/auth/me') ? ({ ok: false, status: opts.me } as Response)
      : ({ ok: true, json: async () => ({ ssoToken: 'one-time' }) } as Response)));
    return (await import('@/lib/pi/self-sign-in')).selfSignIn;
  };
  afterEach(() => { vi.doUnmock('@/lib/pi/visit-sign-in'); sessionStorage.clear(); });

  it('with no session, signs in and returns to exactly where the visitor was', async () => {
    const s = await load({ me: 401, pi: 'pi-at' });
    loc.search = '?q=1';
    expect(await s(1_000)).toBe('navigating');
    expect(loc.replace).toHaveBeenCalledWith('/api/auth/sso-callback?token=one-time&redirect=%2Fapp%3Fq%3D1');
    loc.search = '';
  });

  it('a tap is not "already tried" — the window guards loops, not people', async () => {
    const s = await load({ me: 401, pi: 'pi-at' });
    sessionStorage.setItem('__tec_self_signin', String(Date.now()));
    expect(await s(Date.now())).toBe('already-tried');
    expect(await s(Date.now(), { force: true })).toBe('navigating');
  });

  it('no Pi token → no-pi; a session already → has-session', async () => {
    expect(await (await load({ me: 401, pi: null }))(1)).toBe('no-pi');
    expect(await (await load({ me: 200, pi: 'pi-at' }))(1)).toBe('has-session');
  });
});
