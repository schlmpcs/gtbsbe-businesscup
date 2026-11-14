// Test helpers for the /api/pro/* routes and server/pro modules. No network and no real keys:
// route tests replace the `stripe` module, and every store lives in its own temp directory.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, vi } from 'vitest';
import { proRateLimiter } from './http';

// Built at runtime so no key-shaped literal sits in the repo for secret scanners to flag.
export const FAKE_TEST_KEY = ['sk', 'test', 'Fake0000000000000000000000'].join('_');
export const FAKE_LIVE_KEY = ['sk', 'live', 'Fake0000000000000000000000'].join('_');

export const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
export const OTHER_ANON = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
export const SESSION_ID = 'cs_test_a1B2c3D4e5F6g7H8';

let ipCounter = 0;

/**
 * A request to a /api/pro/* route: POST with a JSON body when `body` is given, else GET. Each
 * call comes from a fresh IP unless one is given; `anonId: null` leaves the header out.
 */
export function proRequest(
  route: string,
  { body, anonId = ANON, headers = {} }: { body?: unknown; anonId?: string | null; headers?: Record<string, string> } = {},
): Request {
  ipCounter += 1;
  const all: Record<string, string> = { 'x-forwarded-for': `10.1.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`, ...headers };
  if (anonId !== null) all['x-anon-id'] = anonId;
  if (body === undefined) return new Request(`http://localhost${route}`, { headers: all });
  return new Request(`http://localhost${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...all },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** A Checkout Session as Stripe returns it once the test card has paid. */
export function paidSession(over: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    object: 'checkout.session',
    mode: 'subscription',
    livemode: false,
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: ANON,
    metadata: { plan: 'yearly' },
    url: null,
    ...over,
  };
}

/** What the SDK throws for an id it doesn't know (only the fields our code reads). */
export function stripeNotFound(): Error {
  return Object.assign(new Error('No such checkout.session'), {
    type: 'StripeInvalidRequestError',
    code: 'resource_missing',
    statusCode: 404,
  });
}

/** A fresh empty directory under the OS temp dir, and its cleanup. */
export async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lifeguessr-pro-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export const TEST_APP_URL = 'https://apps.example.test/lifeguessr';

/**
 * Per-test environment for the route tests: checkout and the default promo code on, an empty
 * store in a fresh temp dir, fresh rate limits, config warnings silenced. Returns the data dir.
 */
export function setupProTestEnv(): () => string {
  let dir = '';
  let cleanup = async () => {};
  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
    proRateLimiter.reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('STRIPE_SECRET_KEY', FAKE_TEST_KEY);
    vi.stubEnv('APP_URL', TEST_APP_URL);
    vi.stubEnv('PRO_DATA_DIR', dir);
    vi.stubEnv('PRO_DEMO_CODE', '');
    vi.stubEnv('PRO_DEMO_UNLOCK', '');
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await cleanup();
  });
  return () => dir;
}
