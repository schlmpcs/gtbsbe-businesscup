// @vitest-environment jsdom
import { moveCandidates, rulesBundle, type MoveCandidate } from '@lifeguessr/engine';
import type * as Engine from '@lifeguessr/engine';
import type * as Areas from '@/lib/areas';
import type * as State from '@/state';
import type { ForecastBundle, Move, Profile } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { aiAnswer, mockForecastRoute, rulesAnswer } from '@/test/forecastApi';
import { resetClientState } from '@/test/clientState';
import {
  FORECAST_CLIENT_TIMEOUT_MS, FORECAST_DEBOUNCE_MS, resetForecastMemory, useForecastBundle,
} from './useForecastBundle';

// `useAppReady` is the real hydration flag in the screens' tests; here the test drives it, and
// the local rules engine can be made to fail.
const control = vi.hoisted(() => ({ ready: true, rulesFails: false }));
vi.mock('@/state', async (importOriginal) => ({
  ...(await importOriginal<typeof State>()),
  useAppReady: () => control.ready,
}));
vi.mock('@lifeguessr/engine', async (importOriginal) => {
  const engine = await importOriginal<typeof Engine>();
  return {
    ...engine,
    rulesBundle: (...args: Parameters<typeof engine.rulesBundle>) => {
      if (control.rulesFails) throw new RangeError('engine broke');
      return engine.rulesBundle(...args);
    },
  };
});

// The sample areas all have the fallback's 3% inflation; ZIP 99999 gets a rate of its own.
vi.mock('@/lib/areas', async (importOriginal) => {
  const areas = await importOriginal<typeof Areas>();
  return { ...areas, inflationForZip: (zip: string | null | undefined) => (zip === '99999' ? 0.045 : areas.inflationForZip(zip)) };
});

beforeEach(() => {
  resetClientState();
  control.ready = true;
  control.rulesFails = false;
});
afterEach(() => vi.useRealTimers());

type Inputs = { profile: Profile; candidates: MoveCandidate[]; preview?: Pick<Move, 'id' | 'patch'> };

const candidatesOf = (profile: Profile) => moveCandidates(profile, { rates: areaRates(profile) });
const inputs = (profile: Profile, preview?: Inputs['preview']): Inputs => ({ profile, candidates: candidatesOf(profile), preview });
const withEatingOut = (profile: Profile, value: number): Profile => ({
  ...profile,
  spending: { ...profile.spending, eatingOut: { value, isEstimate: false } },
});
const scenariosOf = (candidates: readonly MoveCandidate[]) => candidates.map(({ id, patch }) => ({ id, patch }));

/** The hook with its candidates built from the profile on every render (new arrays each time). */
function renderBundle(start: Inputs = inputs(cloneProfileDemo())) {
  return renderHook((p: Inputs) => useForecastBundle(p.profile, p.candidates, p.preview), { initialProps: start });
}

/** Fake timers (setTimeout only) that the test advances inside act. */
function useFakeClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  return async (ms = 0) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await vi.advanceTimersByTimeAsync(0);
    });
  };
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

function ready(result: { current: ReturnType<typeof useForecastBundle> }) {
  if (result.current.status !== 'ready') throw new Error(`forecast is ${result.current.status}`);
  return result.current;
}

describe('useForecastBundle: answers', () => {
  it('returns an AI bundle with source ai, and the (profile, candidates) pair it answered', async () => {
    const route = mockForecastRoute((body) => aiAnswer(body, { baseShift: 5_000 }));
    const start = inputs(cloneProfileDemo());
    const { result } = renderBundle(start);
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = ready(result);
    expect(state).toMatchObject({ source: 'ai', isRefreshing: false });
    expect(state.answer.bundle.source).toBe('ai');
    expect(state.answer.profile).toBe(start.profile);
    expect(state.answer.candidates).toEqual(start.candidates);
    expect(Object.keys(state.answer.bundle.scenarios).sort()).toEqual(start.candidates.map((c) => c.id).sort());
    expect(route.calls).toEqual([{ profile: start.profile, rates: areaRates(start.profile), scenarios: scenariosOf(start.candidates) }]);
  });

  it('uses the local rules bundle when the request fails', async () => {
    mockForecastRoute(() => {
      throw new Error('offline');
    });
    const start = inputs(cloneProfileDemo());
    const { result } = renderBundle(start);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = ready(result);
    expect(state.source).toBe('rules');
    expect(state.answer.bundle).toEqual(rulesBundle(start.profile, scenariosOf(start.candidates), areaRates(start.profile)));
  });

  it.each([
    ['a 429', () => Response.json({ ok: false, error: { code: 'rate_limited' } }, { status: 429 })],
    ['a 400', () => Response.json({ ok: false, error: { code: 'bad_request' } }, { status: 400 })],
    ['a 500', () => new Response('boom', { status: 500 })],
    ['a body that is not a bundle', () => Response.json({ source: 'ai', nope: true })],
    ['a body that is not JSON', () => new Response('<html>', { status: 200 })],
  ])('falls back to the local rules bundle on %s', async (_name, reply) => {
    mockForecastRoute(reply);
    const start = inputs(cloneProfileDemo());
    const { result } = renderBundle(start);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = ready(result);
    expect(state.source).toBe('rules');
    expect(state.answer.bundle).toEqual(rulesBundle(start.profile, scenariosOf(start.candidates), areaRates(start.profile)));
  });

  it('falls back when a valid bundle lacks a requested scenario id', async () => {
    mockForecastRoute((body) => {
      const bundle = aiAnswer(body);
      delete bundle.scenarios[Object.keys(bundle.scenarios)[0]!];
      return bundle;
    });
    const { result } = renderBundle();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ready(result).source).toBe('rules');
  });

  it('falls back when a bundle is not in nominal dollars (it would be deflated twice)', async () => {
    mockForecastRoute((body): ForecastBundle => {
      const bundle = aiAnswer(body);
      return { ...bundle, base: { ...bundle.base, todaysDollars: true } };
    });
    const { result } = renderBundle();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ready(result).source).toBe('rules');
  });

  it('is an error only when the local rules engine fails as well', async () => {
    control.rulesFails = true;
    mockForecastRoute(() => {
      throw new Error('offline');
    });
    const { result } = renderBundle();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toEqual({ status: 'error', error: { kind: 'unknown', message: 'engine broke' } });
  });

  it('answers with the local rules bundle when nothing arrives within the client timeout', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute(() => new Promise<never>(() => {}));
    const start = inputs(cloneProfileDemo());
    const { result } = renderBundle(start);
    await settle(FORECAST_CLIENT_TIMEOUT_MS - 1);
    expect(result.current).toEqual({ status: 'loading' });
    await settle(1);
    const state = ready(result);
    expect(state.source).toBe('rules');
    expect(state.answer.bundle).toEqual(rulesBundle(start.profile, scenariosOf(start.candidates), areaRates(start.profile)));
    expect(route.signals[0]!.aborted).toBe(true);
  });

  it('does not answer, nor fall back, for a request that was superseded', async () => {
    const held = [deferred<ForecastBundle>(), deferred<ForecastBundle>()];
    let n = 0;
    const route = mockForecastRoute(() => held[n++]!.promise);
    const { result, rerender } = renderBundle(inputs(withEatingOut(cloneProfileDemo(), 100)));
    const second = inputs(withEatingOut(cloneProfileDemo(), 200));
    rerender(second);
    expect(route.calls).toHaveLength(2);
    expect(route.signals[0]!.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toEqual({ status: 'loading' }); // the aborted request is not an answer, nor a failure
    held[1]!.resolve(aiAnswer(route.calls[1]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = ready(result);
    expect(state.source).toBe('ai');
    expect(state.answer.profile).toBe(second.profile);
  });

  it('aborts the request in flight when the screen goes away', async () => {
    const route = mockForecastRoute(() => new Promise<never>(() => {}));
    const { unmount } = renderBundle();
    expect(route.signals[0]!.aborted).toBe(false);
    unmount();
    expect(route.signals[0]!.aborted).toBe(true);
  });

  it('sends no request before the app is ready', async () => {
    control.ready = false;
    const route = mockForecastRoute();
    const start = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(start);
    await act(async () => {
      await Promise.resolve();
    });
    expect(route.calls).toHaveLength(0);
    expect(result.current).toEqual({ status: 'loading' });
    control.ready = true;
    rerender(start);
    expect(route.calls).toHaveLength(1);
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('useForecastBundle: when it asks', () => {
  it('sends the first request at once and a later change after the debounce', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    const { result, rerender } = renderBundle(inputs(cloneProfileDemo()));
    expect(route.calls).toHaveLength(1); // no timer involved
    await settle();
    expect(ready(result).isRefreshing).toBe(false);

    rerender(inputs(withEatingOut(cloneProfileDemo(), 100)));
    await settle(FORECAST_DEBOUNCE_MS - 1);
    expect(route.calls).toHaveLength(1);
    await settle(1);
    expect(route.calls).toHaveLength(2);
  });

  it('shows the previous answer as refreshing until the new one arrives', async () => {
    const settle = useFakeClock();
    mockForecastRoute();
    const first = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(first);
    await settle();
    const before = ready(result);

    const second = inputs(withEatingOut(cloneProfileDemo(), 100));
    rerender(second);
    expect(result.current).toMatchObject({ status: 'ready', isRefreshing: true, isStale: true }); // another profile's
    expect(ready(result).answer).toBe(before.answer);
    await settle(FORECAST_DEBOUNCE_MS);
    expect(ready(result).isRefreshing).toBe(false);
    expect(ready(result).answer.profile).toBe(second.profile);
  });

  it('keeps the newest answer when an older request resolves last, and sends only the newest of a burst', async () => {
    const settle = useFakeClock();
    const slow = deferred<ForecastBundle>();
    let n = 0;
    // Request 1 (the second profile of the first burst) is held; its answer arrives after the newest one's.
    const route = mockForecastRoute((body) => (n++ === 1 ? slow.promise : aiAnswer(body, { baseShift: n * 1_000 })), { ignoreAbort: true });
    const { result, rerender } = renderBundle(inputs(cloneProfileDemo()));
    await settle();

    rerender(inputs(withEatingOut(cloneProfileDemo(), 100)));
    await settle(100);
    const p2 = inputs(withEatingOut(cloneProfileDemo(), 200));
    rerender(p2);
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(2); // the p1 request was never sent
    expect((route.calls[1] as { profile: Profile }).profile.spending.eatingOut.value).toBe(200);

    rerender(inputs(withEatingOut(cloneProfileDemo(), 300)));
    await settle(100);
    const p4 = inputs(withEatingOut(cloneProfileDemo(), 400));
    rerender(p4);
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(3);
    expect((route.calls[2] as { profile: Profile }).profile.spending.eatingOut.value).toBe(400);
    const newest = ready(result);
    expect(newest).toMatchObject({ source: 'ai', isRefreshing: false });
    expect(newest.answer.profile).toBe(p4.profile);

    const late = aiAnswer(route.calls[1], { baseShift: 123_456 });
    slow.resolve(late); // the older request answers last
    await settle();
    const after = ready(result);
    expect(after.answer).toBe(newest.answer);
    expect(after.answer.bundle.base.in10y.mid).not.toBeCloseTo(late.base.in10y.mid, 0);
  });

  it('does not ask again for the same profile, re-rendered or remounted, once the model has answered', async () => {
    const route = mockForecastRoute((body) => aiAnswer(body));
    const { result, rerender, unmount } = renderBundle(inputs(cloneProfileDemo()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender(inputs(cloneProfileDemo())); // new objects and arrays, same numbers
    rerender(inputs(cloneProfileDemo()));
    expect(route.calls).toHaveLength(1);

    unmount();
    const again = renderBundle(inputs(cloneProfileDemo()));
    expect(again.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false }); // from session memory, at once
    expect(route.calls).toHaveLength(1);
  });

  it('answers an AI answer it has seen from memory at once, without the debounce or a request', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute((body) => aiAnswer(body));
    const { result, rerender } = renderBundle(inputs(cloneProfileDemo()));
    await settle();
    const answerA = ready(result).answer;
    rerender(inputs(withEatingOut(cloneProfileDemo(), 100)));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(2);

    rerender(inputs(cloneProfileDemo()));
    expect(result.current).toMatchObject({ status: 'ready', isRefreshing: false });
    expect(ready(result).answer).toBe(answerA);
    await settle(FORECAST_DEBOUNCE_MS * 2);
    expect(route.calls).toHaveLength(2);
  });

  it('forgets everything on resetForecastMemory', async () => {
    const route = mockForecastRoute((body) => aiAnswer(body));
    const first = renderBundle();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    resetForecastMemory();
    const again = renderBundle();
    expect(again.result.current).toEqual({ status: 'loading' });
    expect(route.calls).toHaveLength(2);
    await waitFor(() => expect(again.result.current.status).toBe('ready'));
  });

  it('asks again when the remembered AI answer of the key it is on is lost while mounted', async () => {
    const route = mockForecastRoute((body) => aiAnswer(body));
    const { result } = renderBundle();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(route.calls).toHaveLength(1);

    act(() => resetForecastMemory()); // eviction or reset under a mounted screen
    await waitFor(() => expect(route.calls).toHaveLength(2));
    expect(result.current.status).toBe('ready'); // no skeleton: what was settled stays on screen meanwhile
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false }));
    // and the new answer is remembered again: no third request
    await act(async () => {});
    expect(route.calls).toHaveLength(2);
  });

  it('keeps at most 20 answers, dropping the oldest first', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute((body) => aiAnswer(body));
    const profileAt = (i: number) => withEatingOut(cloneProfileDemo(), 100 + i);
    const { rerender } = renderBundle(inputs(profileAt(0)));
    await settle();
    for (let i = 1; i <= 20; i++) {
      rerender(inputs(profileAt(i)));
      await settle(FORECAST_DEBOUNCE_MS);
    }
    expect(route.calls).toHaveLength(21); // 21 answers asked for, 20 kept: profile 0 was dropped

    rerender(inputs(profileAt(20)));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(21); // the newest is still there
    rerender(inputs(profileAt(1)));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(21); // the oldest one kept
    rerender(inputs(profileAt(0)));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(22); // dropped: asked again
  });

  it('sends no request for a change only to committedMoveId, doneMoveIds or zip', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    // Two ZIPs the area data does not know share the fallback inflation, so the rates do not change either.
    const profile: Profile = { ...cloneProfileDemo(), zip: '00000' };
    const candidates = candidatesOf(profile);
    const { result, rerender } = renderBundle({ profile, candidates });
    await settle();
    const answer = ready(result).answer;

    for (const changed of [
      { ...profile, committedMoveId: candidates[0]!.id },
      { ...profile, doneMoveIds: ['payCardFirst:card-9'] },
      { ...profile, zip: '00001' },
    ]) {
      rerender({ profile: changed, candidates });
      await settle(FORECAST_DEBOUNCE_MS * 2);
      expect(result.current).toMatchObject({ status: 'ready', isRefreshing: false });
      expect(ready(result).answer).toBe(answer);
    }
    expect(route.calls).toHaveLength(1);
  });

  it('asks again when the inflation rate changes with the ZIP', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    const profile = cloneProfileDemo();
    const { rerender } = renderBundle(inputs(profile));
    await settle();
    expect((route.calls[0] as { rates: unknown }).rates).toEqual({ inflationAnnual: 0.03 });
    rerender(inputs({ ...profile, zip: '99999' }));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(2);
    expect((route.calls[1] as { rates: unknown }).rates).toEqual({ inflationAnnual: 0.045 });
  });
});

describe('useForecastBundle: remembered answers that are not the model’s (stale while revalidate)', () => {
  const rulesOf = (p: Inputs) => rulesBundle(p.profile, scenariosOf(p.candidates), areaRates(p.profile));

  it('shows a remembered local fallback at once, and sends one request that replaces it', async () => {
    let fail = true;
    const route = mockForecastRoute((body) => {
      if (fail) throw new Error('offline');
      return aiAnswer(body);
    });
    const start = inputs(cloneProfileDemo());
    const first = renderBundle(start);
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    expect(ready(first.result)).toMatchObject({ source: 'rules', isRefreshing: false });
    first.unmount();
    expect(route.calls).toHaveLength(1);

    fail = false;
    const again = renderBundle(inputs(cloneProfileDemo()));
    // No skeleton, and not stale: it answers this very profile, it is only asked for again.
    expect(again.result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true, isStale: false });
    expect(ready(again.result).answer.bundle).toEqual(rulesOf(start));
    expect(route.calls).toHaveLength(2); // in the background, at once
    await waitFor(() => expect(ready(again.result)).toMatchObject({ source: 'ai', isRefreshing: false }));
    expect(route.calls).toHaveLength(2);
  });

  it('shows a remembered server rules answer at once and replaces it with a later AI answer', async () => {
    let model = false;
    const route = mockForecastRoute((body) => (model ? aiAnswer(body) : rulesAnswer(body))); // the route's own fallback
    const first = renderBundle();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    expect(ready(first.result).source).toBe('rules');
    const rulesAnswerShown = ready(first.result).answer;
    first.unmount();

    model = true; // the outage is over
    const again = renderBundle();
    expect(again.result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true, isStale: false });
    expect(ready(again.result).answer).toBe(rulesAnswerShown);
    expect(route.calls).toHaveLength(2);
    await waitFor(() => expect(ready(again.result)).toMatchObject({ source: 'ai', isRefreshing: false }));

    // From now on it is the model's answer: a third screen sends nothing.
    again.unmount();
    const third = renderBundle();
    expect(third.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    expect(route.calls).toHaveLength(2);
  });

  it('sends no request for a remembered AI answer', async () => {
    const route = mockForecastRoute((body) => aiAnswer(body));
    const first = renderBundle();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    const again = renderBundle();
    expect(again.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    await act(async () => {
      await Promise.resolve();
    });
    expect(route.calls).toHaveLength(1);
  });

  it('keeps the shown answer when the revalidation fails, and asks again at the next visit', async () => {
    let fail = false;
    const route = mockForecastRoute((body) => {
      if (fail) return new Response('{}', { status: 503 });
      return rulesAnswer(body);
    });
    const first = renderBundle();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const kept = ready(first.result).answer;
    first.unmount();

    fail = true;
    const again = renderBundle();
    expect(ready(again.result)).toMatchObject({ source: 'rules', isRefreshing: true });
    await waitFor(() => expect(ready(again.result).isRefreshing).toBe(false));
    expect(ready(again.result).answer).toBe(kept); // not replaced, not an error
    again.unmount();

    const third = renderBundle();
    expect(ready(third.result)).toMatchObject({ source: 'rules', isRefreshing: true });
    expect(route.calls).toHaveLength(3);
    await waitFor(() => expect(ready(third.result).isRefreshing).toBe(false));
  });

  it('keeps the shown answer when the revalidation times out', async () => {
    const settle = useFakeClock();
    let hang = false;
    const route = mockForecastRoute((body) => (hang ? new Promise<never>(() => {}) : rulesAnswer(body)));
    const first = renderBundle();
    await settle();
    const kept = ready(first.result).answer;
    first.unmount();

    hang = true;
    const again = renderBundle();
    expect(ready(again.result)).toMatchObject({ isRefreshing: true });
    await settle(FORECAST_CLIENT_TIMEOUT_MS - 1);
    expect(ready(again.result).isRefreshing).toBe(true);
    await settle(1);
    expect(ready(again.result)).toMatchObject({ source: 'rules', isRefreshing: false });
    expect(ready(again.result).answer).toBe(kept);
    expect(route.signals[1]!.aborted).toBe(true);
  });

  it('revalidates a key it comes back to without the debounce, while showing its remembered answer', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute(); // the route's rules answer
    const a = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(a);
    await settle();
    const answerA = ready(result).answer;
    rerender(inputs(withEatingOut(cloneProfileDemo(), 100)));
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(2);

    rerender(inputs(cloneProfileDemo()));
    expect(ready(result)).toMatchObject({ isRefreshing: true, isStale: false });
    expect(ready(result).answer).toBe(answerA);
    expect(route.calls).toHaveLength(3); // no timer advanced
    await settle();
    expect(ready(result).isRefreshing).toBe(false);
  });

  it('takes an AI answer that lands after the view was opened, instead of waiting for it forever', async () => {
    // The memory fills after the render that opened this view: another screen's request settled while this
    // one sat unready (the app was loading). The hook must take the answer, not wait for its own request.
    control.ready = false;
    const route = mockForecastRoute((body) => aiAnswer(body));
    const start = inputs(cloneProfileDemo());
    const waiting = renderBundle(start); // nothing remembered yet, nothing asked while not ready
    expect(waiting.result.current).toEqual({ status: 'loading' });
    control.ready = true;
    const other = renderBundle(inputs(cloneProfileDemo()));
    await waitFor(() => expect(other.result.current.status).toBe('ready'));
    expect(route.calls).toHaveLength(1);

    // It hears of the answer without a render of its own caller...
    expect(waiting.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false, isStale: false });
    expect(waiting.result.current).toMatchObject({ answer: ready(other.result).answer });
    waiting.rerender(start); // ...and a render of it later does not ask either
    expect(waiting.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    expect(route.calls).toHaveLength(1);
  });

  it('takes an AI answer that lands while a remembered rules answer is waiting to be revalidated', async () => {
    let model = false;
    const route = mockForecastRoute((body) => (model ? aiAnswer(body) : rulesAnswer(body)));
    const first = renderBundle();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    model = true;
    control.ready = false;
    const start = inputs(cloneProfileDemo());
    const waiting = renderBundle(start); // shows the remembered rules answer (not ready: the hook says loading)
    control.ready = true;
    const other = renderBundle(inputs(cloneProfileDemo())); // revalidates it, and the model answers
    await waitFor(() => expect(ready(other.result)).toMatchObject({ source: 'ai', isRefreshing: false }));
    expect(route.calls).toHaveLength(2);

    expect(waiting.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    waiting.rerender(start);
    expect(waiting.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    expect(route.calls).toHaveLength(2);
  });

  it('keeps the model’s answer when another screen’s request lands first and this one’s slower request answers with rules', async () => {
    let n = 0;
    let slow!: (b: ForecastBundle) => void;
    const route = mockForecastRoute((body) =>
      n++ === 0 ? new Promise<ForecastBundle>((resolve) => (slow = resolve)) : aiAnswer(body),
    );
    const first = renderBundle(); // its request is slow
    const other = renderBundle(inputs(cloneProfileDemo())); // the same screen elsewhere: the model answers at once
    await waitFor(() => expect(ready(other.result)).toMatchObject({ source: 'ai', isRefreshing: false }));
    expect(route.calls).toHaveLength(2);
    expect(first.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false }); // heard of it

    act(() => slow(rulesAnswer(route.calls[0]))); // the slow one finally answers, with the route's rules answer
    await act(async () => {
      await Promise.resolve();
    });
    expect(first.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    first.unmount();
    other.unmount();

    const third = renderBundle(); // the memory still has the model's answer: nothing is asked
    expect(third.result.current).toMatchObject({ status: 'ready', source: 'ai', isRefreshing: false });
    expect(route.calls).toHaveLength(2);
  });

  it('does not flash the old key’s answer when the new key has none and the old one was an error', async () => {
    control.rulesFails = true;
    mockForecastRoute(() => new Response('{}', { status: 503 }));
    const { result, rerender } = renderBundle(inputs(cloneProfileDemo()));
    await waitFor(() => expect(result.current.status).toBe('error'));
    control.rulesFails = false;
    rerender(inputs(withEatingOut(cloneProfileDemo(), 100)));
    expect(result.current).toEqual({ status: 'loading' }); // nothing to show: the error was not an answer
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('useForecastBundle: the committed move', () => {
  const idsOf = (body: unknown) => (body as { scenarios: { id: string }[] }).scenarios.map((s) => s.id);

  it('sends no committed scenario for a ranked move whose patch is the candidate’s', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    const start = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(start);
    await settle();
    const c = start.candidates[0]!;
    // The same patch, written in another key order, still counts as equal.
    rerender({ ...start, preview: { id: c.id, patch: JSON.parse(JSON.stringify(c.patch)) as Move['patch'] } });
    await settle(FORECAST_DEBOUNCE_MS * 2);
    expect(route.calls).toHaveLength(1);
    expect(result.current).toMatchObject({ status: 'ready', isRefreshing: false });
    expect(idsOf(route.calls[0]).some((id) => id.startsWith('committed:'))).toBe(false);
  });

  it('sends exactly one request with committed:<id> when the stored patch differs from the candidate’s', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    const start = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(start);
    await settle();
    const stale = { id: 'cutCategory:other', patch: { spending: { other: 1 } } };
    expect(start.candidates.find((c) => c.id === stale.id)?.patch).toBeDefined();
    expect(start.candidates.find((c) => c.id === stale.id)?.patch).not.toEqual(stale.patch);

    rerender({ ...start, preview: stale });
    expect(result.current).toMatchObject({ status: 'ready', isRefreshing: true });
    await settle(FORECAST_DEBOUNCE_MS);
    expect(route.calls).toHaveLength(2);
    expect(idsOf(route.calls[1])).toEqual([...start.candidates.map((c) => c.id), `committed:${stale.id}`]);
    expect((route.calls[1] as { scenarios: { id: string; patch: unknown }[] }).scenarios.at(-1)!.patch).toEqual(stale.patch);
    const state = ready(result);
    expect(state.isRefreshing).toBe(false);
    expect(state.answer.bundle.scenarios[`committed:${stale.id}`]).toBeDefined();
  });

  it('asks for the committed move on the first request too', async () => {
    const route = mockForecastRoute();
    const start = inputs(cloneProfileDemo());
    const stale = { id: 'payCardFirst:card-1', patch: { debts: [{ id: 'card-1', extraPayment: 5 }] } };
    renderBundle({ ...start, preview: stale });
    expect(idsOf(route.calls[0])).toContain('committed:payCardFirst:card-1');
  });

  it('does not ask for a committed move whose patch names a debt the profile no longer has', async () => {
    const settle = useFakeClock();
    const route = mockForecastRoute();
    const start = inputs(cloneProfileDemo());
    const { result, rerender } = renderBundle(start);
    await settle();
    rerender({ ...start, preview: { id: 'payCardFirst:gone-1', patch: { debts: [{ id: 'gone-1', extraPayment: 50 }] } } });
    await settle(FORECAST_DEBOUNCE_MS * 2);
    expect(route.calls).toHaveLength(1);
    expect(result.current).toMatchObject({ status: 'ready', isRefreshing: false });
  });
});
