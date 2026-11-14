// The 10-year forecast of S1 and S10: one bundle for the profile and its candidate moves, from
// POST /api/ai/forecast, with the local rules engine as the fallback. Spec: docs/ENGINEERING.md →
// AI forecast.
//
// - Rules first: until a key has an answer of its own, the screen shows the rules bundle computed
//   here for that very key, labeled 'rules' and `isRefreshing` (the model takes ~15–20 s), then the
//   model's answer replaces it. So there is no skeleton, and a profile edit moves the numbers at once.
//   Only if the local engine fails is the previous key's answer shown meanwhile (`isStale`).
// - One request per distinct (profile facts, scenarios, rates), identified by a canonical key. A
//   profile change asks again after FORECAST_DEBOUNCE_MS. The first request goes at once.
// - Every answer carries the (profile, candidates) pair it was asked about (`ForecastAnswer`), so
//   a screen can rank with the bundle's own ids and patches and never with another request's.
// - Whatever goes wrong (offline, 4xx/5xx, a broken or incomplete body, no answer within
//   FORECAST_CLIENT_TIMEOUT_MS) gives the rules bundle computed here, labeled 'rules'. 'error' is
//   only for when that fails as well.
// - Every settled answer is remembered for the session (stale-while-revalidate). An 'ai' answer is
//   reused as it is. Any other (the route's own rules answer, or this file's fallback) is shown at
//   once, marked as refreshing (not stale: it answers this very key), and asked for again in the
//   background without the debounce, so an outage heals without a reload and a hung server does not
//   cost a skeleton on every visit.
import { rulesBundle, type MoveCandidate } from '@lifeguessr/engine';
import type { ForecastBundle, Move, Profile } from '@lifeguessr/types';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { fetchForecastBundle } from '@/lib/api/aiForecast';
import { toVMError } from '@/lib/model/errors';
import type { VMError } from '@/lib/model/types';
import { useAppReady } from '@/state';
import { getAnonId } from '@/state/anonId';
import { buildRequest, coversRequest } from './forecastAnswer';
import type { ForecastAnswer, ForecastState } from './types';

/** Wait this long after the last profile change before asking again (starting value). */
export const FORECAST_DEBOUNCE_MS = 600;
/** Give up on the server after this long and use the rules (the route's own deadline is 40 s: a retry included). */
export const FORECAST_CLIENT_TIMEOUT_MS = 50_000;
/** Answers kept for the session, oldest dropped first. */
const MEMORY_LIMIT = 20;

type Answered = { key: string; answer: ForecastAnswer };
type Failed = { key: string; error: VMError };
type Settled = Answered | Failed;

const isAi = (entry: Answered): boolean => entry.answer.bundle.source === 'ai';

// ----- what has been settled ------------------------------------------------------------------

/** Settled answers of this session by request key (insertion order = age), of every source. */
const memory = new Map<string, Answered>();
const listeners = new Set<() => void>();

/** Screens read the memory through `useSyncExternalStore`, so an answer that lands from any request reaches them. */
function subscribeToMemory(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const notify = () => listeners.forEach((listener) => listener());

/** Forget every answer of the session (the next screen asks again, with nothing to show meanwhile). */
export function resetForecastMemory(): void {
  memory.clear();
  notify();
}

/** Remember a settled answer as the newest. The model's answer for a key is never replaced by a rules one. */
function remember(entry: Answered): void {
  const existing = memory.get(entry.key);
  if (existing !== undefined && isAi(existing) && !isAi(entry)) return;
  memory.delete(entry.key);
  memory.set(entry.key, entry);
  for (const oldest of memory.keys()) {
    if (memory.size <= MEMORY_LIMIT) break;
    memory.delete(oldest);
  }
  notify();
}

/**
 * What this hook knows about the request `key` it is on, besides the memory.
 * - `result`: how its own request settled (an answer, or an error when the local engine failed too).
 * - `before`: the answer that was on screen under the previous key. It answers other inputs, so it is
 *   shown (as stale) only while this key has no answer of its own.
 */
type View = { key: string; result: Settled | null; before: Answered | null };

/** The answer on screen under `previous`'s key: the model's if one has landed since, else its own result or remembered one. */
function shownUnder(previous: View | null): Answered | null {
  if (previous === null) return null;
  const remembered = memory.get(previous.key);
  if (remembered !== undefined && isAi(remembered)) return remembered;
  // A failure leaves nothing to show: the answer before it is two requests old.
  if (previous.result !== null) return 'answer' in previous.result ? previous.result : null;
  return remembered ?? previous.before;
}

const LOADING: ForecastState = { status: 'loading' };

/**
 * The forecast bundle for `profile` and `candidates` (the moves to measure), and for `preview`, the
 * committed move, when it is not one of the candidates with the same patch (sent as the scenario
 * `committed:<id>`). Nothing is requested before the app's saved state is loaded.
 */
export function useForecastBundle(
  profile: Profile,
  candidates: readonly MoveCandidate[],
  preview?: Pick<Move, 'id' | 'patch'>,
): ForecastState {
  const ready = useAppReady();
  const request = useMemo(() => buildRequest(profile, candidates, preview), [profile, candidates, preview]);
  const { key } = request;
  const [view, setView] = useState<View>({ key, result: null, before: null });
  // This key's remembered answer, whoever's request settled it and whenever it did.
  const remembered = useSyncExternalStore(subscribeToMemory, () => memory.get(key), () => undefined);

  // Whether the model's answer for this key is remembered. The request effect depends on it: when this
  // key's AI answer is lost while mounted (evicted, or forgotten by a reset) the effect asks again
  // instead of leaving the view on an answer nothing will refresh; when one lands, it stops asking.
  const hasRememberedAi = remembered !== undefined && isAi(remembered);

  // A new request key opens a new view (adjusting state while rendering: React re-renders at once, so
  // the screen never shows the old key's view under the new key).
  let current = view;
  if (view.key !== key) {
    current = { key, result: null, before: shownUnder(view) };
    setView(current);
  }

  // Rules first: what this key shows until it has an answer of its own (null if the local engine fails).
  const rulesFirst = useMemo((): Answered | null => {
    try {
      const bundle = rulesBundle(profile, request.scenarios, request.rates);
      return { key: request.key, answer: { bundle, profile, candidates: [...candidates] } };
    } catch {
      return null;
    }
  }, [profile, candidates, request]);

  // The effect below runs when the key or `hasRememberedAi` changes, not on every render: it reads the rest from here.
  const latest = useRef({ profile, candidates, request, hasPrevious: false });
  useEffect(() => {
    latest.current = { profile, candidates, request, hasPrevious: current.before !== null };
  });

  useEffect(() => {
    if (!ready) return;
    const cached = memory.get(key);
    if (cached !== undefined && isAi(cached)) return; // answered: nothing to ask
    const asked = latest.current;
    const controller = new AbortController();
    let finished = false; // answered, given up on, or no longer wanted: nothing more may reach the screen
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const settle = (next: () => Settled) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const result = next();
      setView((v) => (v.key === key ? { ...v, result } : v));
    };
    const fromServer = (bundle: ForecastBundle): Settled => {
      if (!coversRequest(bundle, asked.request.scenarios)) return fallback();
      const entry: Answered = { key, answer: { bundle, profile: asked.profile, candidates: [...asked.candidates] } };
      remember(entry);
      return entry;
    };
    // The request failed: keep the answer on screen when this key has one (asked again at the next visit),
    // else the rules bundle computed here. 'error' only when that fails too; it is not remembered.
    const fallback = (): Settled => {
      if (cached !== undefined) {
        remember(cached);
        return cached;
      }
      try {
        const bundle = rulesBundle(asked.profile, asked.request.scenarios, asked.request.rates);
        const entry: Answered = { key, answer: { bundle, profile: asked.profile, candidates: [...asked.candidates] } };
        remember(entry);
        return entry;
      } catch (err) {
        return { key, error: toVMError(err) };
      }
    };

    const run = () => {
      timeout = setTimeout(() => {
        settle(fallback);
        controller.abort();
      }, FORECAST_CLIENT_TIMEOUT_MS);
      fetchForecastBundle(asked.profile, asked.request.scenarios, {
        rates: asked.request.rates,
        anonId: getAnonId(),
        signal: controller.signal,
      }).then(
        (bundle) => settle(() => fromServer(bundle)),
        () => settle(fallback),
      );
    };
    // Typing in a field changes the key many times: wait for it to settle. An answer to revalidate is
    // already on screen for this key, so that goes at once.
    if (cached === undefined && asked.hasPrevious) debounce = setTimeout(run, FORECAST_DEBOUNCE_MS);
    else run();

    return () => {
      finished = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ready, key, hasRememberedAi]);

  return useMemo((): ForecastState => {
    if (!ready) return LOADING;
    // The model's answer for this key, once it is in the memory, wins over whatever this hook settled
    // with (a rules answer from a request that was already on its way when it landed).
    const result = remembered !== undefined && isAi(remembered) ? remembered : current.result;
    if (result !== null) {
      return 'error' in result
        ? { status: 'error', error: result.error }
        : { status: 'ready', source: result.answer.bundle.source, answer: result.answer, isRefreshing: false, isStale: false };
    }
    // Not settled yet: this key's remembered rules answer (current, being revalidated), else the rules
    // bundle computed here for this key (rules first), else, when the engine failed, the previous key's (stale).
    const shown = remembered ?? rulesFirst ?? current.before;
    if (shown !== null) {
      return {
        status: 'ready', source: shown.answer.bundle.source, answer: shown.answer, isRefreshing: true,
        isStale: shown.key !== key,
      };
    }
    return LOADING;
  }, [ready, key, remembered, current, rulesFirst]);
}
