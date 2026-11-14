import { resolveRates, rulesBundle } from '@lifeguessr/engine';
import type { ForecastBundle } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { PROMPT_VERSION } from './forecast';
import { createForecastCache, forecastKey } from './forecastCache';
import type { ForecastRequest } from './schemas';
import { DEMO_SCENARIOS } from './testUtils';

// `PROMPT_VERSION` and `PROMPT_FINGERPRINT` are constants; this lets one test pretend one of them changed
// (the version was bumped, or the prompt or the output schema was edited without a bump).
const bump = vi.hoisted(() => ({ by: 0, edited: false }));
vi.mock('./forecast', async (importOriginal) => {
  const real = await importOriginal<{ PROMPT_VERSION: number; PROMPT_FINGERPRINT: string }>();
  return {
    ...real,
    get PROMPT_VERSION() {
      return real.PROMPT_VERSION + bump.by;
    },
    get PROMPT_FINGERPRINT() {
      return bump.edited ? `${real.PROMPT_FINGERPRINT}-edited` : real.PROMPT_FINGERPRINT;
    },
  };
});

const MODEL = 'claude-haiku-5-5';
const request = (over: Partial<ForecastRequest> = {}): ForecastRequest => ({
  profile: cloneProfileDemo(),
  scenarios: DEMO_SCENARIOS.map((s) => structuredClone(s)),
  ...over,
});

/** The same data with the keys of every object in the opposite order. */
function reversedKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reversedKeys) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reversedKeys(v)])) as T;
  }
  return value;
}

describe('forecastKey', () => {
  it('is a sha256 hex digest', () => {
    expect(forecastKey(request(), MODEL)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the same for the same request, even with every object key in another order', () => {
    const a = request();
    const b = reversedKeys(request());
    expect(Object.keys(b.profile)).not.toEqual(Object.keys(a.profile)); // the helper really reordered
    expect(forecastKey(b, MODEL)).toBe(forecastKey(a, MODEL));
  });

  it('is the same when the scenarios are listed in another order (the bundle is keyed by id)', () => {
    const a = request();
    const b = request({ scenarios: [...request().scenarios].reverse() });
    expect(b.scenarios.map((s) => s.id)).not.toEqual(a.scenarios.map((s) => s.id));
    expect(forecastKey(b, MODEL)).toBe(forecastKey(a, MODEL));
  });

  it('keeps the order of arrays that are not scenarios (a profile list is not a set)', () => {
    const a = request();
    const b = request();
    b.profile.debts.reverse();
    expect(b.profile.debts.map((d) => d.id)).not.toEqual(a.profile.debts.map((d) => d.id));
    expect(forecastKey(b, MODEL)).not.toBe(forecastKey(a, MODEL));
  });

  it('is the same with `rates` absent and `rates: undefined`', () => {
    const absent = request();
    expect('rates' in absent).toBe(false);
    expect(forecastKey({ ...absent, rates: undefined }, MODEL)).toBe(forecastKey(absent, MODEL));
  });

  it('is the same with `rates` absent and with the default inflation spelled out (the prompt is the same)', () => {
    const defaults = resolveRates();
    expect(forecastKey(request({ rates: { inflationAnnual: defaults.inflationAnnual } }), MODEL))
      .toBe(forecastKey(request(), MODEL));
  });

  it('changes with the rates the model is shown', () => {
    const base = forecastKey(request(), MODEL);
    const rated = forecastKey(request({ rates: { inflationAnnual: 0.04 } }), MODEL);
    expect(rated).not.toBe(base);
    expect(forecastKey(request({ rates: { inflationAnnual: 0.05 } }), MODEL)).not.toBe(rated);
    expect(forecastKey(request({ rates: { inflationAnnual: resolveRates().inflationAnnual + 0.01 } }), MODEL)).not.toBe(base);
  });

  it('changes with one spending value', () => {
    const edited = request();
    edited.profile.spending.eatingOut.value += 1;
    expect(forecastKey(edited, MODEL)).not.toBe(forecastKey(request(), MODEL));
  });

  it('changes with a scenario patch and with the set of scenarios', () => {
    const base = forecastKey(request(), MODEL);
    const patched = request();
    patched.scenarios[0]!.patch = { debts: [{ id: 'card-1', extraPayment: 301 }] };
    expect(forecastKey(patched, MODEL)).not.toBe(base);
    expect(forecastKey(request({ scenarios: request().scenarios.slice(1) }), MODEL)).not.toBe(base);
    expect(forecastKey(request({ scenarios: [] }), MODEL)).not.toBe(base);
  });

  it('changes with the model id', () => {
    expect(forecastKey(request(), 'claude-opus-5')).not.toBe(forecastKey(request(), MODEL));
  });

  it('changes with PROMPT_VERSION', () => {
    const before = forecastKey(request(), MODEL);
    bump.by = 1;
    try {
      expect(PROMPT_VERSION).toBeGreaterThan(1); // the mock took effect
      expect(forecastKey(request(), MODEL)).not.toBe(before);
    } finally {
      bump.by = 0;
    }
    expect(forecastKey(request(), MODEL)).toBe(before);
  });

  it('changes with the prompt fingerprint, so an edit to the prompt or the schema without a version bump cannot serve old answers', () => {
    const before = forecastKey(request(), MODEL);
    bump.edited = true;
    try {
      expect(forecastKey(request(), MODEL)).not.toBe(before);
    } finally {
      bump.edited = false;
    }
    expect(forecastKey(request(), MODEL)).toBe(before);
  });

  it.each([
    ['committedMoveId', (p: ForecastRequest['profile']) => { p.committedMoveId = 'payCardFirst:card-1'; }],
    ['doneMoveIds', (p: ForecastRequest['profile']) => { p.doneMoveIds = ['cancelSubscriptions', 'cutCategory:eatingOut']; }],
    ['zip', (p: ForecastRequest['profile']) => { p.zip = p.zip === '10001' ? '94105' : '10001'; }],
  ])('ignores %s, which the model never sees', (_name, edit) => {
    const edited = request();
    edit(edited.profile);
    expect(JSON.stringify(edited.profile)).not.toBe(JSON.stringify(request().profile)); // the edit took
    expect(forecastKey(edited, MODEL)).toBe(forecastKey(request(), MODEL));
  });
});

// ----- the cache ---------------------------------------------------------------------------------

const rules: ForecastBundle = rulesBundle(cloneProfileDemo(), []);
const aiBundle = (model = 'm'): ForecastBundle => ({ ...rules, source: 'ai', model });
const rulesAnswer = (): ForecastBundle => ({ ...rules });
/** A bundle with a scenario, so there are nested objects and arrays to try to change. */
const richAiBundle = (): ForecastBundle => ({ ...rulesBundle(cloneProfileDemo(), DEMO_SCENARIOS), source: 'ai', model: 'm' });

/** A promise settled by hand, to control when a `compute` finishes. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('createForecastCache', () => {
  it('runs compute once for two concurrent calls with the same key, and gives both the answer', async () => {
    const cache = createForecastCache();
    const d = deferred<ForecastBundle>();
    const compute = vi.fn(() => d.promise);

    const first = cache.getOrCompute('k', compute);
    const second = cache.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    d.resolve(aiBundle());

    expect(await first).toEqual(aiBundle());
    expect(await second).toEqual(aiBundle());
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('does not share work between different keys', async () => {
    const cache = createForecastCache();
    const compute = vi.fn(async () => aiBundle());
    await Promise.all([cache.getOrCompute('a', compute), cache.getOrCompute('b', compute)]);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('returns an AI answer from cache without computing again', async () => {
    const cache = createForecastCache();
    const compute = vi.fn(async () => aiBundle());
    await cache.getOrCompute('k', compute);
    expect(await cache.getOrCompute('k', compute)).toEqual(aiBundle());
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('shares a rules answer with the calls that were waiting for it, but does not store it', async () => {
    const cache = createForecastCache();
    const d = deferred<ForecastBundle>();
    const compute = vi.fn(() => d.promise);
    const waiting = [cache.getOrCompute('k', compute), cache.getOrCompute('k', compute)];
    d.resolve(rulesAnswer());
    expect((await Promise.all(waiting)).map((b) => b.source)).toEqual(['rules', 'rules']);
    expect(compute).toHaveBeenCalledTimes(1);

    const next = vi.fn(async () => aiBundle());
    expect((await cache.getOrCompute('k', next)).source).toBe('ai'); // computed again, not served the fallback
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('computes again after a rules answer, every time', async () => {
    const cache = createForecastCache();
    const compute = vi.fn(async () => rulesAnswer());
    await cache.getOrCompute('k', compute);
    await cache.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  describe('shared bundles', () => {
    // These files are ES modules, so a write to a frozen object throws a TypeError.
    const changes = (bundle: ForecastBundle): (() => void)[] => [
      () => { bundle.model = 'other'; },
      () => { bundle.source = 'rules'; },
      () => { bundle.scenarios['extra'] = bundle.base; },
      () => { bundle.base.in10y.mid = 1; },
      () => { bundle.base.points[0]!.mid = 1; },
      () => { bundle.base.points.push(bundle.base.points[0]!); },
      () => { bundle.base.points.length = 0; },
      () => { bundle.scenarios['pay-card']!.points[5]!.low = 1; },
      () => { delete bundle.scenarios['cut-eating']; },
    ];

    it('hands out a deeply frozen bundle on a hit, and a failed change leaves the cache as it was', async () => {
      const cache = createForecastCache();
      await cache.getOrCompute('k', async () => richAiBundle());
      const hit = await cache.getOrCompute('k', async () => aiBundle('never'));
      for (const change of changes(hit)) expect(change).toThrow(TypeError);

      const again = await cache.getOrCompute('k', async () => aiBundle('never'));
      expect(again).toEqual(richAiBundle());
      expect(again.model).toBe('m');
    });

    it('hands the computing caller and every waiter the same frozen bundle', async () => {
      const cache = createForecastCache();
      const d = deferred<ForecastBundle>();
      const calls = [cache.getOrCompute('k', () => d.promise), cache.getOrCompute('k', () => d.promise)];
      d.resolve(richAiBundle());
      for (const bundle of await Promise.all(calls)) {
        for (const change of changes(bundle)) expect(change).toThrow(TypeError);
      }
    });

    it('freezes a rules answer too: waiters share it by reference even though it is not stored', async () => {
      const cache = createForecastCache();
      const d = deferred<ForecastBundle>();
      const calls = [cache.getOrCompute('k', () => d.promise), cache.getOrCompute('k', () => d.promise)];
      d.resolve({ ...rulesBundle(cloneProfileDemo(), DEMO_SCENARIOS) });
      for (const bundle of await Promise.all(calls)) {
        expect(bundle.source).toBe('rules');
        for (const change of changes(bundle)) expect(change).toThrow(TypeError);
      }
    });
  });

  describe('time to live', () => {
    it('serves an AI answer until ttlMs has passed, then computes again', async () => {
      let t = 1_000;
      const cache = createForecastCache({ ttlMs: 60_000, now: () => t });
      const compute = vi.fn(async () => aiBundle(`v${compute.mock.calls.length}`));

      expect((await cache.getOrCompute('k', compute)).model).toBe('v1');
      t += 59_999;
      expect((await cache.getOrCompute('k', compute)).model).toBe('v1');
      expect(compute).toHaveBeenCalledTimes(1);

      t += 1; // exactly ttlMs after it was stored
      expect((await cache.getOrCompute('k', compute)).model).toBe('v2');
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('counts the time to live from when the answer was stored, and a hit does not extend it', async () => {
      let t = 0;
      const cache = createForecastCache({ ttlMs: 100, now: () => t });
      const compute = vi.fn(async () => aiBundle());
      await cache.getOrCompute('k', compute);
      t = 60;
      await cache.getOrCompute('k', compute); // a hit at 60
      t = 120;
      await cache.getOrCompute('k', compute); // 120 > 100 after the store, though only 60 after the hit
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('starts the time to live when compute finishes, not when it started', async () => {
      let t = 0;
      const cache = createForecastCache({ ttlMs: 100, now: () => t });
      const d = deferred<ForecastBundle>();
      const slow = cache.getOrCompute('k', () => d.promise);
      t = 90; // the model took 90
      d.resolve(aiBundle());
      await slow;
      t = 150; // 60 after the store
      const compute = vi.fn(async () => aiBundle());
      await cache.getOrCompute('k', compute);
      expect(compute).not.toHaveBeenCalled();
    });

    it('defaults to one hour', async () => {
      let t = 0;
      const cache = createForecastCache({ now: () => t });
      const compute = vi.fn(async () => aiBundle());
      await cache.getOrCompute('k', compute);
      t = 3_599_999;
      await cache.getOrCompute('k', compute);
      expect(compute).toHaveBeenCalledTimes(1);
      t = 3_600_000;
      await cache.getOrCompute('k', compute);
      expect(compute).toHaveBeenCalledTimes(2);
    });
  });

  describe('size limit', () => {
    const fill = async (cache: ReturnType<typeof createForecastCache>, keys: string[], compute = vi.fn(async () => aiBundle())) => {
      for (const k of keys) await cache.getOrCompute(k, compute);
      return compute;
    };

    it('evicts the least recently stored entry beyond max', async () => {
      const cache = createForecastCache({ max: 2 });
      const compute = await fill(cache, ['a', 'b', 'c']);
      expect(compute).toHaveBeenCalledTimes(3);

      await cache.getOrCompute('c', compute);
      await cache.getOrCompute('b', compute);
      expect(compute).toHaveBeenCalledTimes(3); // b and c are still there
      await cache.getOrCompute('a', compute);
      expect(compute).toHaveBeenCalledTimes(4); // a was evicted
    });

    it('treats a hit as a use: the entry that was read survives, the idle one goes', async () => {
      const cache = createForecastCache({ max: 2 });
      const compute = await fill(cache, ['a', 'b']);
      await cache.getOrCompute('a', compute); // a is now the most recently used
      await cache.getOrCompute('c', compute); // evicts b, not a
      expect(compute).toHaveBeenCalledTimes(3);

      await cache.getOrCompute('a', compute);
      expect(compute).toHaveBeenCalledTimes(3); // a survived
      await cache.getOrCompute('b', compute);
      expect(compute).toHaveBeenCalledTimes(4); // b was evicted
    });

    it('never holds more than max entries', async () => {
      const cache = createForecastCache({ max: 3 });
      const compute = await fill(cache, ['a', 'b', 'c', 'd', 'e']);
      for (const k of ['c', 'd', 'e']) await cache.getOrCompute(k, compute);
      expect(compute).toHaveBeenCalledTimes(5);
      for (const k of ['a', 'b']) await cache.getOrCompute(k, compute);
      expect(compute).toHaveBeenCalledTimes(7);
    });

    it('defaults to 500 entries', async () => {
      const cache = createForecastCache();
      const compute = vi.fn(async () => aiBundle());
      for (let i = 0; i < 500; i++) await cache.getOrCompute(`k${i}`, compute);
      await cache.getOrCompute('k0', compute);
      expect(compute).toHaveBeenCalledTimes(500); // 500 fit
      await cache.getOrCompute('k500', compute); // the 501st evicts the least recently used: k1 (k0 was just read)
      await cache.getOrCompute('k1', compute);
      expect(compute).toHaveBeenCalledTimes(502);
    });
  });

  describe('failures', () => {
    it('gives a rejection to every waiter, caches nothing, and lets the next call try again', async () => {
      const cache = createForecastCache();
      const d = deferred<ForecastBundle>();
      const compute = vi.fn(() => d.promise);
      const waiters = [cache.getOrCompute('k', compute), cache.getOrCompute('k', compute), cache.getOrCompute('k', compute)];
      const settled = Promise.allSettled(waiters);
      d.reject(new Error('boom'));

      const results = await settled;
      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected']);
      expect(results.every((r) => r.status === 'rejected' && (r.reason as Error).message === 'boom')).toBe(true);
      expect(compute).toHaveBeenCalledTimes(1);

      const retry = vi.fn(async () => aiBundle());
      expect((await cache.getOrCompute('k', retry)).source).toBe('ai');
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('turns a compute that throws before returning a promise into a rejection and forgets it', async () => {
      const cache = createForecastCache();
      const bad = vi.fn((): Promise<ForecastBundle> => { throw new Error('sync boom'); });
      await expect(cache.getOrCompute('k', bad)).rejects.toThrow('sync boom');
      const good = vi.fn(async () => aiBundle());
      expect((await cache.getOrCompute('k', good)).source).toBe('ai');
      expect(good).toHaveBeenCalledTimes(1);
    });

    it('keeps serving a stored answer when a later call for another key fails', async () => {
      const cache = createForecastCache();
      await cache.getOrCompute('a', async () => aiBundle());
      await expect(cache.getOrCompute('b', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
      const compute = vi.fn(async () => aiBundle());
      await cache.getOrCompute('a', compute);
      expect(compute).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('forgets stored answers', async () => {
      const cache = createForecastCache();
      const compute = vi.fn(async () => aiBundle());
      await cache.getOrCompute('k', compute);
      cache.clear();
      await cache.getOrCompute('k', compute);
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('forgets work in flight: a computation that started before clear is not stored, and is not joined', async () => {
      const cache = createForecastCache();
      const old = deferred<ForecastBundle>();
      const before = cache.getOrCompute('k', () => old.promise);
      cache.clear();

      const fresh = vi.fn(async () => aiBundle('fresh'));
      expect((await cache.getOrCompute('k', fresh)).model).toBe('fresh'); // new call, not joined to the old one
      old.resolve(aiBundle('old'));
      expect((await before).model).toBe('old'); // its own caller still gets the answer

      const compute = vi.fn(async () => aiBundle());
      expect((await cache.getOrCompute('k', compute)).model).toBe('fresh'); // the old answer did not overwrite the new
      expect(compute).not.toHaveBeenCalled();
    });

    it('does not let a settled old computation remove a newer one from the in-flight list', async () => {
      const cache = createForecastCache();
      const old = deferred<ForecastBundle>();
      const next = deferred<ForecastBundle>();
      const oldCall = cache.getOrCompute('k', () => old.promise);
      cache.clear();
      const newCall = cache.getOrCompute('k', () => next.promise);

      old.resolve(rulesAnswer()); // not stored, and must not drop the newer in-flight entry
      await oldCall;
      const joined = vi.fn(async () => aiBundle('third'));
      const thirdCall = cache.getOrCompute('k', joined); // joins `newCall`
      expect(joined).not.toHaveBeenCalled();
      next.resolve(aiBundle('new'));
      expect((await thirdCall).model).toBe('new');
      expect((await newCall).model).toBe('new');
    });
  });
});
