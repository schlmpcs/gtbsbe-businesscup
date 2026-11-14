import { rulesBundle } from '@lifeguessr/engine';
import type { ProfilePatch } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { fetchForecastBundle } from './aiForecast';
import { ANON_ID_HEADER, ApiError } from './http';

afterEach(() => vi.unstubAllGlobals());

const profile = cloneProfileDemo();
const scenarios: { id: string; patch: ProfilePatch }[] = [
  { id: 'cutCategory:eatingOut', patch: { spending: { eatingOut: 100 } } },
];
const rates = { inflationAnnual: 0.03 };

function stubFetch(reply: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchForecastBundle', () => {
  it('posts { profile, rates, scenarios } with the anonymous id header and returns the validated bundle', async () => {
    const bundle = rulesBundle(profile, scenarios, rates);
    const fetchMock = stubFetch(() => Response.json(bundle));
    const res = await fetchForecastBundle(profile, scenarios, { rates, anonId: 'anon-1' });
    expect(res).toEqual(bundle);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/ai/forecast');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ profile, rates, scenarios });
    expect(new Headers(init.headers).get(ANON_ID_HEADER)).toBe('anon-1');
  });

  it('leaves rates out when none are given', async () => {
    const fetchMock = stubFetch(() => Response.json(rulesBundle(profile, [])));
    await fetchForecastBundle(profile, []);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ profile, scenarios: [] });
  });

  it('rejects with an invalid ApiError on a body that fails ForecastBundleSchema', async () => {
    stubFetch(() => Response.json({ source: 'ai', base: { points: [], in10y: null, todaysDollars: false }, scenarios: {} }));
    const err = await fetchForecastBundle(profile, scenarios).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ invalid: true, status: 200 });
  });

  it('rejects with an ApiError carrying the status on a 429', async () => {
    stubFetch(() => Response.json({ ok: false, error: { code: 'rate_limited' } }, { status: 429 }));
    await expect(fetchForecastBundle(profile, scenarios)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('rethrows an AbortError unchanged', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    stubFetch(() => Promise.reject(abort));
    await expect(fetchForecastBundle(profile, scenarios, { signal: new AbortController().signal })).rejects.toBe(abort);
  });

  it('passes the abort signal to fetch', async () => {
    const fetchMock = stubFetch(() => Response.json(rulesBundle(profile, [])));
    const controller = new AbortController();
    await fetchForecastBundle(profile, [], { signal: controller.signal });
    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
  });
});
