import { rulesBundle } from '@lifeguessr/engine';
import { ForecastBundleSchema, type Forecast, type ProfilePatch, type YearAnchor } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import {
  aiRateLimiter, AI_RATE_LIMITS, checkAiRateLimit, checkForecastRateLimit, forecastRateLimiter,
  FORECAST_RATE_LIMITS,
} from '@/server/ai/http';
import { MAX_FORECAST_BODY_BYTES, MAX_FORECAST_MONEY } from '@/server/ai/schemas';
import { postRequest, reply } from '@/server/ai/testUtils';
import { POST } from './route';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const SCENARIOS: { id: string; patch: ProfilePatch }[] = [
  { id: 'pay-card', patch: { debts: [{ id: 'card-1', extraPayment: 300 }] } },
  { id: 'cut-eating', patch: { spending: { eatingOut: 200 } } },
];

const body = (over: Record<string, unknown> = {}) => ({ profile: cloneProfileDemo(), scenarios: SCENARIOS, ...over });
const post = (b: unknown, headers?: Record<string, string>) => POST(postRequest('/api/ai/forecast', b, headers));

const anchorsOf = (f: Forecast): YearAnchor[] =>
  Array.from({ length: 10 }, (_, i) => {
    const { low, mid, high } = f.points[(i + 1) * 12]!;
    return { year: i + 1, low, mid, high };
  });
/** A good model answer: the rules forecast of every id, as anchors. */
function goodReply(scenarios = SCENARIOS) {
  const rules = rulesBundle(cloneProfileDemo(), scenarios);
  return reply(JSON.stringify({
    forecasts: [
      { id: 'base', anchors: anchorsOf(rules.base) },
      ...scenarios.map((s) => ({ id: s.id, anchors: anchorsOf(rules.scenarios[s.id]!) })),
    ],
  }));
}

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  forecastRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_MODEL', '');
  vi.stubEnv('ANTHROPIC_FORECAST_MODEL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/ai/forecast', () => {
  it('returns the AI bundle, uncached by the browser, from one model call', async () => {
    create.mockResolvedValueOnce(goodReply());
    const res = await post(body());

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.source).toBe('ai');
    expect(json.model).toBe('claude-haiku-5-5');
    expect(Object.keys(json.scenarios)).toEqual(['pay-card', 'cut-eating']);
    expect(json.base.points).toHaveLength(121);
    expect(json.base.todaysDollars).toBe(false);
    expect(ForecastBundleSchema.safeParse(json).success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const [params, opts] = create.mock.calls[0]!;
    expect(params).not.toHaveProperty('temperature');
    expect(opts.maxRetries).toBe(0);
  });

  it('uses ANTHROPIC_FORECAST_MODEL when set', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    vi.stubEnv('ANTHROPIC_FORECAST_MODEL', 'claude-opus-5');
    create.mockResolvedValueOnce(goodReply());
    const json = await (await post(body())).json();
    expect(json.model).toBe('claude-opus-5');
    expect(create.mock.calls[0]![0].model).toBe('claude-opus-5');
  });

  it('accepts a body without scenarios and forecasts only the base', async () => {
    create.mockResolvedValueOnce(goodReply([]));
    const res = await post({ profile: cloneProfileDemo() });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('ai');
    expect(json.scenarios).toEqual({});
  });

  it('returns the rules bundle, labeled, when there is no API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await post(body({ rates: { inflationAnnual: 0.04 } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.source).toBe('rules');
    expect(json).not.toHaveProperty('model');
    expect(json).toEqual(JSON.parse(JSON.stringify(rulesBundle(cloneProfileDemo(), SCENARIOS, { inflationAnnual: 0.04 }))));
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the rules bundle, with a 200, when the provider fails', async () => {
    create.mockRejectedValue(new Error('overloaded'));
    const res = await post(body());
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('rules');
  });

  const hugeMoney = MAX_FORECAST_MONEY * 2;
  const withProfile = (edit: (p: ReturnType<typeof cloneProfileDemo>) => void) => {
    const profile = cloneProfileDemo();
    edit(profile);
    return body({ profile });
  };
  it.each([
    ['a missing profile', { scenarios: [] }],
    ['a profile with negative pay', withProfile((p) => { p.takeHomePay.value = -1; })],
    ['a profile missing a spending category', withProfile((p) => { delete (p.spending as Record<string, unknown>).other; })],
    ['an inflation given as a percent', body({ rates: { inflationAnnual: 3 } })],
    ['an inflation of -100%', body({ rates: { inflationAnnual: -1 } })],
    ['a scenario with a percent APR', body({ scenarios: [{ id: 'x', patch: { debts: [{ id: 'card-1', apr: 24 }] } }] })],
    ['a scenario without an id', body({ scenarios: [{ patch: {} }] })],
    ['an empty scenario id', body({ scenarios: [{ id: '', patch: {} }] })],
    ['duplicate scenario ids', body({ scenarios: [SCENARIOS[0], { id: 'pay-card', patch: {} }] })],
    ['the reserved id "base"', body({ scenarios: [{ id: 'base', patch: {} }] })],
    ['more than 8 scenarios', body({ scenarios: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, patch: {} })) })],
    ['a profile money value over the limit', withProfile((p) => { p.cash.value = hugeMoney; })],
    ['a negative money value over the limit', withProfile((p) => { p.cash.value = -hugeMoney; })],
    ['a debt balance over the limit', withProfile((p) => { p.debts[0]!.balance = hugeMoney; })],
    ['pay over the limit', withProfile((p) => { p.takeHomePay.value = hugeMoney; })],
    ['a patch money value over the limit', body({ scenarios: [{ id: 'x', patch: { spending: { eatingOut: hugeMoney } } }] })],
    ['a number too large for JSON to hold', '{"profile":' + JSON.stringify(cloneProfileDemo()).replace('"value":3800', '"value":1e999') + '}'],
    ['a non-object body', [1, 2, 3]],
    ['malformed JSON', '{"profile": '],
  ])('rejects %s with 400', async (_name, b) => {
    const res = await post(b);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
    expect(create).not.toHaveBeenCalled();
  });

  it('names the offending field when money is over the limit', async () => {
    const profile = cloneProfileDemo();
    profile.cash.value = MAX_FORECAST_MONEY + 1;
    const json = await (await post(body({ profile }))).json();
    expect(json.error.issues.join(' ')).toContain('profile.cash.value');
  });

  it('accepts money exactly at the limit', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const profile = cloneProfileDemo();
    profile.cash.value = MAX_FORECAST_MONEY;
    expect((await post(body({ profile }))).status).toBe(200);
  });

  it('rejects a body over the size limit with 413', async () => {
    const res = await post(body({ padding: 'a'.repeat(MAX_FORECAST_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps a realistic request (the profile and 8 candidate moves) under the size limit', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      id: `payCardFirst:card-${i}`, patch: { debts: [{ id: `card-${i}`, extraPayment: 250, apr: 0.2436 }] },
    }));
    expect(JSON.stringify(body({ scenarios: candidates })).length).toBeLessThan(MAX_FORECAST_BODY_BYTES / 2);
  });

  it('rate-limits per anonId with 429 and Retry-After', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const headers = { 'x-anon-id': '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c' };
    for (let i = 0; i < FORECAST_RATE_LIMITS.perAnonId.limit; i++) {
      expect((await post(body({ scenarios: [] }), headers)).status).toBe(200);
    }
    const res = await post(body({ scenarios: [] }), headers);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await res.json()).error.code).toBe('rate_limited');
    expect(create).not.toHaveBeenCalled();
  });

  it('does not spend the parse and explain budget, and they do not spend this one', () => {
    const headers = { 'x-anon-id': '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c', 'x-forwarded-for': '203.0.113.9' };
    const forecastReq = () => postRequest('/api/ai/forecast', {}, headers);
    const parseReq = () => postRequest('/api/ai/parse', {}, headers);

    for (let i = 0; i < FORECAST_RATE_LIMITS.perAnonId.limit; i++) expect(checkForecastRateLimit(forecastReq())).toBeNull();
    expect(checkForecastRateLimit(forecastReq())?.status).toBe(429);
    expect(checkAiRateLimit(parseReq())).toBeNull(); // untouched

    forecastRateLimiter.reset();
    aiRateLimiter.reset();
    for (let i = 0; i < AI_RATE_LIMITS.perAnonId.limit; i++) expect(checkAiRateLimit(parseReq())).toBeNull();
    expect(checkAiRateLimit(parseReq())?.status).toBe(429);
    expect(checkForecastRateLimit(forecastReq())).toBeNull(); // untouched
  });

  it('rate-limits per IP even when the anonId changes, with a looser cap than per anonId', () => {
    expect(FORECAST_RATE_LIMITS.perIp.limit).toBeGreaterThanOrEqual(5 * FORECAST_RATE_LIMITS.perAnonId.limit);
    expect(FORECAST_RATE_LIMITS.perAnonId.limit).toBeGreaterThan(AI_RATE_LIMITS.perAnonId.limit);
    const ip = { 'x-forwarded-for': '203.0.113.7' };
    for (let i = 0; i < FORECAST_RATE_LIMITS.perIp.limit; i++) {
      const anon = { 'x-anon-id': `anon-${String(i).padStart(8, '0')}` };
      expect(checkForecastRateLimit(postRequest('/api/ai/forecast', {}, { ...ip, ...anon }))).toBeNull();
    }
    const res = checkForecastRateLimit(postRequest('/api/ai/forecast', {}, { ...ip, 'x-anon-id': 'anon-fresh-0001' }));
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('counts requests with no forwarded IP in one shared bucket (the Funnel case)', () => {
    const noIp = (anon: string) =>
      new Request('http://localhost/api/ai/forecast', { method: 'POST', headers: { 'x-anon-id': anon } });
    for (let i = 0; i < FORECAST_RATE_LIMITS.perIp.limit; i++) {
      expect(checkForecastRateLimit(noIp(`anon-${String(i).padStart(8, '0')}`))).toBeNull();
    }
    expect(checkForecastRateLimit(noIp('anon-fresh-0001'))?.status).toBe(429);
  });
});
