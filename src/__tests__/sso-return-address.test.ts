// The SSO return address, pinned in the two places that send a visitor away.
//
// The Testnet host failed totally and silently. Session cookies there are
// host-only (`vercel.app` is on the Public Suffix List), so a visitor NEVER
// arrives carrying a token — every single visit took the "no session" branch.
// That branch, on the landing page, was a BARE Hub URL with no `target=`: the
// Hub had nothing to sign a token back to, so the visitor signed in, landed on
// the Hub, and the app they had tapped was never reached again. On Mainnet the
// same line is invisible, because the shared `.tecosystem.app` cookie means the
// branch is almost never taken.
//
// Read as text rather than executed: these are `'use client'` page modules
// whose imports pull in the whole app shell, and the defect is a literal in one
// branch — exactly what a text assertion pins and a render test does not.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('every "no session" bounce carries a return address', () => {
  it('the landing page uses the shared helper, not a bare Hub URL', () => {
    const s = read('src/app/page.tsx');
    expect(s).toMatch(/window\.location\.href = ssoUrl\(\)/);
    // The exact literal that broke it. A Hub origin with no `target=` is a
    // one-way trip.
    expect(s).not.toMatch(/window\.location\.href = 'https:\/\/tec-app-frontend\.vercel\.app'/);
  });

  it('the app page uses the same helper — one definition, no drift', () => {
    const s = read('src/app/app/page.tsx');
    expect(s).toMatch(/from '@\/lib\/sso'/);
    // It must not re-declare its own copy; that is how the two drifted apart.
    expect(s).not.toMatch(/^const ssoUrl =/m);
  });

  it('the helper reads the LIVE origin, never a build-time constant', () => {
    const s = read('src/lib/sso.ts');
    expect(s).toMatch(/window\.location\.origin/);
    // NEXT_PUBLIC_* is inlined at build time and is the same string on both
    // hosts by construction — it can only ever name one of the two.
    expect(s).toMatch(/target=\$\{encodeURIComponent\(appOrigin\(\)\)\}/);
  });
});

describe('the allowlists name real hosts, and only real hosts', () => {
  const callback = () => read('src/app/api/auth/sso-callback/route.ts');
  const minter   = () => read('src/app/api/auth/sso/route.ts');

  it('accepts the app\'s actual Vercel project host', () => {
    expect(callback()).toContain("'https://commerce-app.vercel.app'");
    expect(minter()).toContain("'https://commerce-app.vercel.app'");
  });

  it('is never widened to a pattern', () => {
    // `/api/auth/sso` hands the target a signed token carrying the user's
    // access token. Anyone can deploy `*.vercel.app`, so a wildcard here would
    // hand sessions to a stranger. Explicit hosts, always.
    for (const s of [callback(), minter()]) {
      expect(s).not.toMatch(/\*\.vercel\.app/);
      expect(s).not.toMatch(/endsWith\(\s*['"]\.vercel\.app/);
    }
  });
});
