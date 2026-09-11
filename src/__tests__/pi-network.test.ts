import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTestnetHost, networkMetadata } from '@/lib/pi-network';

/**
 * Which Pi network a request is on.
 *
 * A `.pi` domain requires a Pi app, and Pi issues every app TWICE — a Mainnet
 * one and a paired Testnet one, both registered against the SAME deployment on
 * different hosts. One build serves both, so `NEXT_PUBLIC_PI_SANDBOX` cannot
 * answer this: it is baked at build time and there is only one build.
 *
 * The consequence of getting it wrong in the permissive direction is a free
 * subscription: a payment made with Test-Pi that a consumer treats as real.
 */

describe('the host decides the network', () => {
  it('reads the paired Testnet app from a vercel.app host', () => {
    for (const h of [
      'tec-app.vercel.app',
      'tec-app-frontend.vercel.app',
      'TEC-APP.VERCEL.APP',
      'tec-app.vercel.app:443',
      ' tec-app.vercel.app ',
    ]) {
      expect(isTestnetHost(h)).toBe(true);
    }
  });

  it('reads a custom domain as Mainnet', () => {
    for (const h of [
      'app.tecosystem.app',
      'hub.tecosystem.app',
      'localhost:3000',
    ]) {
      expect(isTestnetHost(h)).toBe(false);
    }
  });

  it('is not fooled by a host that merely CONTAINS the string', () => {
    // The match is anchored to the end. Without that, anyone who could get a
    // request to this app under a hostname they control could ask for the test
    // network — and the whole point of deciding server-side is that they cannot.
    for (const h of [
      'vercel.app.attacker.com',
      'notvercel.app.example.com',
      'tec-app.vercel.app.evil.com',
    ]) {
      expect(isTestnetHost(h)).toBe(false);
    }
  });

  it('treats a missing host as Mainnet, never as testnet', () => {
    // Fail closed in the direction that costs nothing: an unknown host means a
    // real payment, which at worst fails. The other way round it succeeds with
    // Test-Pi and something real gets granted.
    expect(isTestnetHost(undefined)).toBe(false);
    expect(isTestnetHost(null)).toBe(false);
    expect(isTestnetHost('')).toBe(false);
  });
});

describe('what travels with the payment', () => {
  it('marks a testnet payment, and marks nothing on a real one', () => {
    // Present only when true: a `testnet: false` on every Mainnet payment would
    // put a field about the test network on 100% of real money, and the day it
    // is written wrong is the day it means the opposite of what it says.
    expect(networkMetadata('tec-app.vercel.app')).toEqual({ testnet: true });
    expect(networkMetadata('app.tecosystem.app')).toEqual({});
  });
});

describe('the client and the server read the same fact separately', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
  const route  = readFileSync(join(process.cwd(), 'src/app/api/bff/payment/create/route.ts'), 'utf8');

  it('Pi.init picks the network from the browser’s own hostname', () => {
    // Not from a build-time flag alone — one build serves both Pi apps.
    expect(layout).toContain('.test(location.hostname)');
    expect(layout).toContain('vercel');
  });

  it('the BFF derives it from its OWN Host header', () => {
    expect(route).toContain("networkMetadata(req.headers.get('host'))");
  });

  it('the Testnet host gets sandbox=FALSE — sandbox is not testnet', () => {
    // Measured, not assumed. With sandbox:true on `*.vercel.app` the Pi bridge
    // never answered its first message ("Messaging promise with id 1 timed out
    // after 120000ms"). Same host, same build, that flag false: the wallet
    // opened and the payment reached approve.
    //
    // Commerce writes its Pi bootstrap minified, so this asserts the SHAPE of the
    // decision rather than the template's exact spacing — a test that pins
    // whitespace fails on formatting and teaches people to delete it.
    expect(layout).toMatch(/__sandbox\s*=\s*__isTestnetHost\s*\?\s*\(?__q\s*===\s*'1'\)?\s*:/);
    expect(layout).toContain('window.Pi.init({version:\'2.0\',sandbox:__sandbox');
    // The opposite default must not creep back.
    expect(layout).not.toMatch(/__q\s*!==\s*'0'/);
  });

  it('the sandbox override is confined to the Testnet host', () => {
    expect(layout).toContain("get('pi_sandbox')");
    // The Mainnet arm of the ternary is the build flag, untouched by the URL.
    // Commerce names it `piSandbox`, computed once at module scope.
    expect(layout).toMatch(/:\s*\$\{piSandbox\}/);
    expect(layout).toContain("const piSandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'");
    // `__q` is read in exactly one place, so it cannot grow a second use on the
    // Mainnet side.
    expect((layout.match(/__q\s*===\s*'1'/g) ?? []).length).toBe(1);
  });

  it('the client cannot send metadata to this route AT ALL', () => {
    // The template apps strip a client-supplied `testnet` before the spread.
    // Commerce does not need to: its Zod schema accepts only amount/product_id/
    // memo, so there is no client metadata to strip — a stronger property than
    // stripping, and the one worth pinning here.
    //
    // Asserted on the SCHEMA, not on the absence of a line. "This file does not
    // contain X" passes for a file that also does not contain the feature.
    expect(route).toMatch(/const CreateSchema = z\.object\(\{[^}]*\}\)/s);
    expect(route).not.toMatch(/metadata:\s*z\./);
    // …and the network is still added server-side, from our own Host.
    expect(route).toContain("networkMetadata(req.headers.get('host'))");
  });
});


// ── Hub-entry detection: BOTH hosts ─────────────────────────────────────────
// ADR-007 exists because a visitor who arrived from the Hub is inside a Pi
// session the HUB owns: this app must not Pi.init() (it poisons that session)
// and must not Pi.authenticate() (it never answers). The detection named only
// `hub.tecosystem.app`, so a hop from the TESTNET Hub read as standalone —
// there is no error to catch, and the only thing the user sees is the app's
// own payment timeout with the Pi wallet never having opened.
describe('isHubReferrer', () => {
  it('recognises the Mainnet Hub — unchanged', async () => {
    const { isHubReferrer } = await import('@/lib/pi-network');
    expect(isHubReferrer('https://hub.tecosystem.app/hub')).toBe(true);
    expect(isHubReferrer('https://hub.tecosystem.app/')).toBe(true);
  });

  it('recognises the TESTNET Hub — the case that was blind', async () => {
    const { isHubReferrer } = await import('@/lib/pi-network');
    expect(isHubReferrer('https://tec-app-frontend.vercel.app/hub')).toBe(true);
    expect(isHubReferrer('https://TEC-APP-FRONTEND.vercel.app/hub')).toBe(true);
  });

  it('is not fooled by a host that merely CONTAINS a Hub name', async () => {
    // The old check was `referrer.includes('hub.tecosystem.app')`, and that
    // direction fails OPEN: a hostile referrer could force Mode 1 and choose
    // the Hub URL the buyer is sent to.
    const { isHubReferrer } = await import('@/lib/pi-network');
    for (const r of [
      'https://hub.tecosystem.app.attacker.com/x',
      'https://evil.com/?r=hub.tecosystem.app',
      'https://tec-app-frontend.vercel.app.evil.com/',
    ]) {
      expect(isHubReferrer(r)).toBe(false);
    }
  });

  it('treats no referrer / junk as standalone, not as a Hub hop', async () => {
    // Mode 2 is the safe reading: a wrong Mode 1 sends the buyer away from an
    // app that could have paid.
    const { isHubReferrer } = await import('@/lib/pi-network');
    for (const r of ['', null, undefined, 'not a url']) {
      expect(isHubReferrer(r as string | null | undefined)).toBe(false);
    }
  });

  it('covers exactly the origin Mode 1 pays through', async () => {
    // hubPaymentOrigin sends a Testnet buyer to the Testnet Hub. If that host
    // were not also a recognised hub REFERRER, the return hop would look
    // standalone and the next buy would hang the same way.
    const { isHubReferrer, hubPaymentOrigin, HUB_HOSTS } = await import('@/lib/pi-network');
    const testnetHubOrigin = hubPaymentOrigin('https://hub.tecosystem.app', 'tec-app.vercel.app');
    expect(isHubReferrer(`${testnetHubOrigin}/hub?pay=1`)).toBe(true);
    expect(HUB_HOSTS).toContain(new URL(testnetHubOrigin).hostname);
  });
});
