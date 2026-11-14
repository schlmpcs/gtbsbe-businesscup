import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_LIVE_KEY, FAKE_TEST_KEY } from './testUtils';

// A fresh module per test: config warns once per process, and these tests count the warnings.
const load = () => import('./config');
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const name of ['STRIPE_SECRET_KEY', 'APP_URL', 'PRO_DEMO_CODE', 'PRO_DEMO_UNLOCK', 'PRO_DATA_DIR']) {
    vi.stubEnv(name, '');
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const request = (headers: Record<string, string> = {}, url = 'http://internal:3000/api/pro/checkout') =>
  new Request(url, { headers });

describe('stripeTestKey', () => {
  it.each([
    ['a secret test key', FAKE_TEST_KEY],
    ['a restricted test key', FAKE_TEST_KEY.replace(/^sk/, 'rk')],
  ])('accepts %s', async (_name, key) => {
    vi.stubEnv('STRIPE_SECRET_KEY', ` ${key} `);
    const { stripeTestKey } = await load();
    expect(stripeTestKey()).toBe(key);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['unset', ''],
    ['a live key', FAKE_LIVE_KEY],
    ['a live restricted key', FAKE_LIVE_KEY.replace(/^sk/, 'rk')],
    ['a publishable test key', FAKE_TEST_KEY.replace(/^sk/, 'pk')],
    ['garbage', 'not-a-key'],
    ['a test prefix with junk after it', `${FAKE_TEST_KEY} extra`],
  ])('refuses %s, warning once without ever printing the key', async (_name, key) => {
    vi.stubEnv('STRIPE_SECRET_KEY', key);
    const { stripeTestKey, checkoutConfigured } = await load();
    expect(stripeTestKey()).toBeNull();
    expect(stripeTestKey()).toBeNull();
    expect(checkoutConfigured()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    if (key) expect(logged).not.toContain(key);
    expect(logged).not.toContain('Fake000');
  });
});

describe('publicBaseUrl', () => {
  it('uses APP_URL, sub-path included, without a trailing slash', async () => {
    vi.stubEnv('APP_URL', 'https://apps.example.test/lifeguessr/');
    const { publicBaseUrl } = await load();
    expect(publicBaseUrl(request({ host: 'evil.example' }))).toBe('https://apps.example.test/lifeguessr');
  });

  it.each([
    ['not a URL', 'apps.example.test/lifeguessr'],
    ['not http(s)', 'ftp://apps.example.test'],
    ['carrying credentials', 'https://user:pw@apps.example.test'],
    ['carrying a query', 'https://apps.example.test/?x=1'],
  ])('turns checkout off when APP_URL is %s', async (_name, value) => {
    vi.stubEnv('APP_URL', value);
    vi.stubEnv('STRIPE_SECRET_KEY', FAKE_TEST_KEY);
    const { publicBaseUrl, checkoutConfigured } = await load();
    expect(publicBaseUrl(request())).toBeNull();
    expect(checkoutConfigured()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('derives the origin from the proxy headers when APP_URL is unset', async () => {
    const { publicBaseUrl, checkoutConfigured } = await load();
    expect(publicBaseUrl(request({ 'x-forwarded-proto': 'https, http', 'x-forwarded-host': 'host.example.test, inner' })))
      .toBe('https://host.example.test');
    expect(publicBaseUrl(request({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
    expect(publicBaseUrl(request({}, 'https://direct.example.test/api/pro/checkout'))).toBe('https://direct.example.test');
    vi.stubEnv('STRIPE_SECRET_KEY', FAKE_TEST_KEY);
    expect(checkoutConfigured()).toBe(true);
  });

  it.each([
    ['an odd protocol', { 'x-forwarded-proto': 'javascript', host: 'host.example.test' }],
    ['a host with a path', { 'x-forwarded-host': 'host.example.test/evil' }],
    ['a host with credentials', { 'x-forwarded-host': 'user@host.example.test' }],
  ])('refuses %s in the headers', async (_name, headers) => {
    const { publicBaseUrl } = await load();
    expect(publicBaseUrl(request(headers))).toBeNull();
  });
});

describe('demoUnlock', () => {
  it('is on by default with the default code', async () => {
    const { demoUnlock, DEFAULT_DEMO_CODE } = await load();
    expect(demoUnlock()).toEqual({ enabled: true, code: DEFAULT_DEMO_CODE });
  });

  it('uses PRO_DEMO_CODE, trimmed', async () => {
    vi.stubEnv('PRO_DEMO_CODE', '  STREAM-2026 ');
    const { demoUnlock } = await load();
    expect(demoUnlock()).toEqual({ enabled: true, code: 'STREAM-2026' });
  });

  it.each(['off', 'OFF', ' off '])('is off when PRO_DEMO_UNLOCK=%j', async (value) => {
    vi.stubEnv('PRO_DEMO_UNLOCK', value);
    const { demoUnlock } = await load();
    expect(demoUnlock()).toEqual({ enabled: false });
  });

  it('is off, with a warning, when the code could never be typed in', async () => {
    vi.stubEnv('PRO_DEMO_CODE', 'X'.repeat(65));
    const { demoUnlock } = await load();
    expect(demoUnlock()).toEqual({ enabled: false });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('proDataDir', () => {
  it('defaults to .data/pro under the working directory, and honours PRO_DATA_DIR', async () => {
    const { proDataDir } = await load();
    expect(proDataDir()).toBe(path.resolve(process.cwd(), '.data/pro'));
    vi.stubEnv('PRO_DATA_DIR', '/var/lib/lifeguessr');
    expect(proDataDir()).toBe('/var/lib/lifeguessr');
  });
});
