'use client';

// The door of the app — a sign-in BUTTON before any screen (owner, 2026-10-06,
// Tec-Life #72, rolled out to the fleet). This app's variant: its session hook is
// local, its Hub hop is `ssoUrl()`, and it paints with TEC_COLORS (no token CSS).
//
// Not a page guard: a session-less visit used to be sent straight to the Hub's
// SSO — a sign-in nobody chose, and one Pi counts for the Hub, not for this app.
// The button runs the app's OWN sign-in (C-123 §10): Pi → /api/auth/pi-self-login
// → the 200 landing that sets the cookies, so Pi counts the visit HERE. When Pi
// cannot answer on this page (a Hub-owned session, no SDK, a refusal), the Hub
// signs them in instead and sends them back.
//
// A visit opened FROM the Hub arrives already signed in (§12) and never sees
// this. While the session is unknown it renders neither.

import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { ssoUrl } from '@/lib/sso';
import { selfSignIn } from '@/lib/pi/self-sign-in';

const STRINGS = {
  en: { title: 'Sign in to continue', body: 'This space is yours alone. Sign in with Pi to open it.', button: 'Sign in with Pi', busy: 'Signing you in…', viaHub: 'Sign in through the Hub instead' },
  ar: { title: 'سجّل دخولك للمتابعة', body: 'هذه المساحة ملكك وحدك. سجّل دخولك بـ Pi لتفتحها.', button: 'تسجيل الدخول بـ Pi', busy: 'جارٍ تسجيل دخولك…', viaHub: 'أو سجّل الدخول من خلال الـ Hub' },
} as const;

type Session = 'unknown' | 'yes' | 'no';

export function SignInGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = usePiAuth();
  const [session, setSession] = useState<Session>('unknown');
  const [state, setState]     = useState<'idle' | 'busy'>('idle');
  const [lang, setLang]       = useState<'en' | 'ar'>('en');

  useEffect(() => {
    setLang((document.documentElement.lang || '').toLowerCase().startsWith('ar') ? 'ar' : 'en');
    let live = true;
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => { if (live) setSession(r.ok ? 'yes' : 'no'); })
      .catch(() => { if (live) setSession('no'); });
    return () => { live = false; };
  }, []);

  if (session === 'yes' || isAuthenticated) return <>{children}</>;
  if (session === 'unknown' || isLoading) return <div aria-busy="true" style={{ minHeight: 240 }} />;

  const s = STRINGS[lang];
  const viaHub = () => { setState('busy'); window.location.href = ssoUrl(); };
  const signIn = async () => {
    setState('busy');
    const r = await selfSignIn(Date.now(), { force: true });   // force: the window guards loops, not people
    if (r === 'navigating') return;
    if (r === 'has-session') { window.location.reload(); return; }
    viaHub();                                                   // foreign-session · no-pi · refused
  };

  return (
    <main dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, display: 'grid', placeItems: 'center', padding: 22, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <section aria-label={s.title} style={{ width: '100%', maxWidth: 420, textAlign: 'center', background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.border}`, borderRadius: 16, padding: '28px 22px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px', background: `${TEC_COLORS.gold}22`, display: 'grid', placeItems: 'center', color: TEC_COLORS.gold, fontSize: 24, fontWeight: 900 }}>π</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>{s.title}</h1>
        <p style={{ fontSize: 14, color: TEC_COLORS.subtext, margin: '0 0 18px', lineHeight: 1.5 }}>{s.body}</p>
        <button onClick={() => { void signIn(); }} disabled={state !== 'idle'}
          style={{ width: '100%', padding: '13px 18px', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', color: TEC_COLORS.bg, background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, opacity: state !== 'idle' ? 0.6 : 1 }}>
          {state === 'idle' ? s.button : s.busy}
        </button>
        <button onClick={viaHub} disabled={state !== 'idle'}
          style={{ background: 'none', border: 'none', color: TEC_COLORS.subtext, fontSize: 13, marginTop: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          {s.viaHub}
        </button>
      </section>
    </main>
  );
}
