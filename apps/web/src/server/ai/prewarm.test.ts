import { moveCandidates } from '@lifeguessr/engine';
import type { ForecastBundle } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/features/forecast/model/forecastAnswer';
import { cloneProfileDemo } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import type * as Client from './client';
import { createForecastCache, forecastKey } from './forecastCache';
import { demoForecastRequest, prewarmDemoForecast } from './prewarm';
import { goodReply } from './testUtils';

const llm = vi.hoisted(() => ({ create: vi.fn(), hasKey: true }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof Client>()),
  getLlmClient: () => (llm.hasKey ? { messages: { create: llm.create } } : null),
}));

const info = vi.spyOn(console, 'info').mockImplementation(() => {});
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  llm.create.mockReset();
  llm.hasKey = true;
  info.mockClear();
  warn.mockClear();
  vi.stubEnv('ANTHROPIC_FORECAST_MODEL', 'claude-opus-5-5');
});
afterEach(() => vi.unstubAllEnvs());

describe('demoForecastRequest', () => {
  it('is the request a new visitor sends: the demo profile, its Next Moves candidates, the ZIP inflation', () => {
    const profile = cloneProfileDemo();
    const candidates = moveCandidates(profile, { rates: areaRates(profile), subscriptionsDetected: false });
    const client = buildRequest(profile, candidates, undefined); // what useForecastBundle sends
    const req = demoForecastRequest();
    expect(req.scenarios).toEqual(client.scenarios);
    expect(req.rates).toEqual(client.rates);
    expect(req.scenarios.length).toBeGreaterThan(0);
  });
});

describe('prewarmDemoForecast', () => {
  it('stores the AI answer for the demo request for as long as the process runs', async () => {
    let t = 0;
    const cache = createForecastCache({ ttlMs: 1_000, now: () => t });
    const req = demoForecastRequest();
    llm.create.mockResolvedValueOnce(goodReply(req));
    await prewarmDemoForecast(cache);
    expect(llm.create).toHaveBeenCalledTimes(1);
    expect(info.mock.calls.join(' ')).toMatch(/prewarm: demo profile answered by ai in \d+ ms/);

    t = 30 * 24 * 3_600_000; // a month later: still the warmed answer, no new call
    const compute = vi.fn(async (): Promise<ForecastBundle> => { throw new Error('should not compute'); });
    const hit = await cache.getOrCompute(forecastKey(req, 'claude-opus-5-5'), compute);
    expect(hit.source).toBe('ai');
    expect(compute).not.toHaveBeenCalled();
  });

  it('does nothing without an API key', async () => {
    llm.hasKey = false;
    const cache = createForecastCache();
    await prewarmDemoForecast(cache);
    expect(llm.create).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('stores nothing when the model fails, logs it, and never throws', async () => {
    const cache = createForecastCache();
    llm.create.mockRejectedValue(new Error('overloaded'));
    await expect(prewarmDemoForecast(cache)).resolves.toBeUndefined();
    expect(info.mock.calls.join(' ')).toMatch(/answered by rules/);
    const compute = vi.fn(async () => ({ source: 'rules' }) as ForecastBundle);
    await cache.getOrCompute(forecastKey(demoForecastRequest(), 'claude-opus-5-5'), compute);
    expect(compute).toHaveBeenCalledTimes(1); // nothing was stored
  });
});
