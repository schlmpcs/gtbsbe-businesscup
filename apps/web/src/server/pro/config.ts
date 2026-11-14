// Server-only: the environment of the Pro paywall demo (docs/ARCHITECTURE.md → Server routes).
// Read on every call rather than at import, so a changed env (or a test's vi.stubEnv) applies
// without a restart. Each misconfiguration is logged once per process, and never with its value.
import path from 'node:path';
import { ProDemoUnlockRequestSchema } from '@lifeguessr/types';

/**
 * Test-mode secret or restricted keys only. A live key (or anything else) switches checkout off
 * instead of risking a real charge: this is a demo, no real money may ever move.
 */
export const STRIPE_TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9_]+$/;

export const DEFAULT_DEMO_CODE = 'JURY-DEMO';
const DEFAULT_DATA_DIR = '.data/pro';

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[pro] ${message}`);
}

/** STRIPE_SECRET_KEY when it is a Stripe test-mode key, otherwise null (checkout unavailable). */
export function stripeTestKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    warnOnce('STRIPE_SECRET_KEY is not set: Stripe checkout is off, only the promo code unlocks Pro.');
    return null;
  }
  if (!STRIPE_TEST_KEY.test(key)) {
    warnOnce('STRIPE_SECRET_KEY is not a Stripe test-mode key (sk_test_/rk_test_): Stripe checkout is off.');
    return null;
  }
  return key;
}

/**
 * APP_URL: `{ base }` without a trailing slash, `{ base: null }` when unset (derive it from the
 * request), or null when set but not an absolute http(s) URL. A bad APP_URL turns checkout off
 * rather than silently redirecting payers to a guessed address.
 */
function configuredAppUrl(): { base: string | null } | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return { base: null };
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:') || url.search || url.hash || url.username) {
    warnOnce('APP_URL must be an absolute http(s) URL without query, fragment or credentials: Stripe checkout is off.');
    return null;
  }
  return { base: `${url.origin}${url.pathname}`.replace(/\/+$/, '') };
}

/** Whether a Checkout Session can be created at all (shown as `checkoutAvailable`). */
export function checkoutConfigured(): boolean {
  return stripeTestKey() !== null && configuredAppUrl() !== null;
}

const HOST = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/**
 * The public base URL that Stripe sends the payer back to: APP_URL, or else the origin the
 * request came in on (behind a proxy: x-forwarded-proto + x-forwarded-host). A sub-path deploy
 * must set APP_URL, since the request does not carry the prefix. Null when nothing usable.
 */
export function publicBaseUrl(req: Request): string | null {
  const configured = configuredAppUrl();
  if (!configured) return null;
  if (configured.base) return configured.base;

  const first = (name: string) => req.headers.get(name)?.split(',')[0]?.trim() || undefined;
  const fallback = new URL(req.url);
  const proto = first('x-forwarded-proto') ?? fallback.protocol.replace(/:$/, '');
  const host = first('x-forwarded-host') ?? first('host') ?? fallback.host;
  if ((proto !== 'http' && proto !== 'https') || !HOST.test(host)) return null;
  return `${proto}://${host}`;
}

export type DemoUnlockConfig = { enabled: false } | { enabled: true; code: string };

/**
 * The promo code that unlocks Pro without paying (shown on the Pro screen on purpose, so the
 * jury can pass the paywall). PRO_DEMO_UNLOCK=off disables it. A code the request schema could
 * never accept also disables it, so the screen never shows a code that cannot work.
 */
export function demoUnlock(): DemoUnlockConfig {
  if (process.env.PRO_DEMO_UNLOCK?.trim().toLowerCase() === 'off') return { enabled: false };
  const code = ProDemoUnlockRequestSchema.shape.code.safeParse(process.env.PRO_DEMO_CODE?.trim() || DEFAULT_DEMO_CODE);
  if (!code.success) {
    warnOnce('PRO_DEMO_CODE must be 1-64 characters: demo unlock is off.');
    return { enabled: false };
  }
  return { enabled: true, code: code.data };
}

/** Where the file entitlement store lives (PRO_DATA_DIR, relative to the server's cwd). */
export function proDataDir(): string {
  return path.resolve(process.cwd(), process.env.PRO_DATA_DIR?.trim() || DEFAULT_DATA_DIR);
}
