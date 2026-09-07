/**
 * Where to send a visitor who has no session, and where the Hub sends them back.
 *
 * One build serves two Pi apps on two hosts: `commerce.tecosystem.app` (the
 * Mainnet app) and Commerce's `*.vercel.app` project host (the paired Testnet
 * one). The return address must therefore be read from the LIVE host, never
 * from a build-time constant — `NEXT_PUBLIC_*` is inlined at build time and is
 * the same string on both hosts by construction.
 *
 * The failure this prevents is silent and total on the Testnet host: session
 * cookies there are host-only (`vercel.app` is on the Public Suffix List, so no
 * cross-subdomain cookie is possible), so a visitor NEVER arrives with a token,
 * every visit bounces to the Hub, and a bounce with no `target=` gives the Hub
 * nothing to sign a token back to. The user signs in, lands on the Hub, and the
 * app they tapped is simply never reached again.
 */
const HUB_URL      = process.env.NEXT_PUBLIC_HUB_URL      ?? 'https://hub.tecosystem.app';
const COMMERCE_URL = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://commerce.tecosystem.app';

/** The origin actually being served — the configured one only during SSR. */
export const appOrigin = (): string =>
  typeof window === 'undefined' ? COMMERCE_URL : window.location.origin;

/** Hub SSO with this host as the return address. */
export const ssoUrl = (): string =>
  `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(appOrigin())}`;

export { HUB_URL, COMMERCE_URL };
