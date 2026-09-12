// `crypto` as a bare global is a Node-VERSION dependency, and it was silent.
//
// The Hub's handoff into this app returned a blank 500 — the platform's page,
// not any JSON this app writes — at `/api/auth/sso-callback`, while the very
// same app logged in fine when opened directly. The Hub's own logs showed 307:
// it had done its job. Every functional line of that route is identical to the
// 21 apps where it works.
//
// The difference was inside THIS app, between its two login paths:
//
//     /api/auth/pi-login      import { randomUUID } from 'crypto'   works
//     /api/auth/sso-callback  crypto.randomUUID()   (bare global)   500
//
// `globalThis.crypto` only exists from Node 19. On an older runtime the bare
// form throws ReferenceError, there is no try/catch around it, and what
// reaches the browser is a blank page with no reason on it. CI never saw it —
// CI runs a current Node, so the bug lives only on the deployed runtime.
//
// Two runtimes, opposite rules, and that is the whole trap:
//
//   Node route handlers  ->  import from 'crypto'  (works on every version)
//   Edge middleware      ->  the GLOBAL Web Crypto ('crypto' is not importable)
//
// So this is not "replace the global everywhere". Doing that to middleware
// breaks it the other way. The boundary is the rule, and it is what this file
// pins.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

const BARE_CRYPTO = /(?<!\w)crypto\.(randomUUID|subtle|getRandomValues)\b/;
const IMPORTS_CRYPTO = /from ['"](?:node:)?crypto['"]/;

describe('Node route handlers import crypto — they do not rely on the global', () => {
  const routes = walk(join(process.cwd(), 'src/app/api'));

  it('finds the API routes at all (a silent empty list would pass vacuously)', () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each(routes.map(f => [f.replace(process.cwd() + '/', ''), f]))(
    '%s', (_label, file) => {
      const src = readFileSync(file, 'utf8');
      if (!BARE_CRYPTO.test(src)) return;          // uses none — nothing to prove
      expect(IMPORTS_CRYPTO.test(src)).toBe(true);
    },
  );

  it('the SSO callback specifically — the route that actually broke', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/sso-callback/route.ts'), 'utf8');
    expect(IMPORTS_CRYPTO.test(src)).toBe(true);
    expect(BARE_CRYPTO.test(src)).toBe(false);
  });

  it('matches how pi-login already did it — the two login paths now agree', () => {
    // pi-login was right all along. That it and sso-callback disagreed is
    // exactly why one worked and the other did not.
    const login = readFileSync(join(process.cwd(), 'src/app/api/auth/pi-login/route.ts'), 'utf8');
    expect(IMPORTS_CRYPTO.test(login)).toBe(true);
  });
});

describe('middleware keeps the GLOBAL — the opposite rule', () => {
  const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');

  it('does not import node crypto', () => {
    // Middleware runs on the Edge runtime, where `crypto` is the standard Web
    // Crypto global and `node:crypto` is not available. "Fixing" this the same
    // way as the routes breaks every request instead of one.
    expect(IMPORTS_CRYPTO.test(src)).toBe(false);
  });

  it('still uses the global it is entitled to', () => {
    expect(BARE_CRYPTO.test(src)).toBe(true);
  });
});
