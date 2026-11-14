// The 10-year forecast of S1 and S10: one bundle for the profile and its candidate moves, from
// POST /api/ai/forecast, with the local rules engine as the fallback. Spec: docs/ENGINEERING.md →
// AI forecast.
//
// - One request per distinct (profile facts, scenarios, rates), identified by a canonical key. A
//   profile change asks again after FORECAST_DEBOUNCE_MS, with the previous answer still on screen
//   (`isRefreshing`). The first request goes at once.
// - Every answer carries the (profile, candidates) pair it was asked about (`ForecastAnswer`), so
//   a screen can rank with the bundle's own ids and patches and never with another request's.
// - Whatever goes wrong (offline, 4xx/5xx, a broken or incomplete body, no answer within
//   FORECAST_CLIENT_TIMEOUT_MS) gives the rules bundle computed here, labeled 'rules'. 'error' is
//   only for when that fails as well.
// - Every settled answer is remembered for the session (stale-while-revalidate). An 'ai' answer is
//   reused as it is. Any other (the route's own rules answer, or this file's fallback) is shown at
//   once, marked as refreshing, and asked for again in the background without the debounce, so an
//   outage heals without a reload and a hung server does not cost a skeleton on every visit.
import { rulesBundle, type MoveCandidate } from '@lifeguessr/engine';
import type { ForecastBundle, Move, Profile } from '@lifeguessr/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchForecastBundle } from '@/lib/api/aiForecast';
import { toVMError } from '@/lib/model/errors';
import type { VMError } from '@/lib/model/types';
import { useAppReady } from '@/state';
import { getAnonId } from '@/state/anonId';
import { buildRequest, coversRequest } from './forecastAnswer';
import type { ForecastAnswer, ForecastState } from './types';

/** Wait this long after the last profile change before asking again (starting value). */
export const FORECAST_DEBOUNCE_MS = 600;
/** Give up on the server after this long (starting value; the route's own deadline is 20 s) and use the rules. */
export const FORECAST_CLIENT_TIMEOUT_MS = 25_000;
/** Answers kept for the session, oldest dropped first. */
const MEMORY_LIMIT = 20;

type Answered = { key: string; answer: ForecastAnswer };
type Failed = { key: string; error: VMError };
type Settled = Answered | Failed;

const isAi = (entry: Answered): boolean => entry.answer.bundle.source === 'ai';

// ----- what has been settled ------------------------------------------------------------------

/** Settled answers of this session by request key (insertion order = age), of every source. */
const memory = new Map<string, Answered>();

/** Forget every answer of the session (the next screen asks again, with nothing to show meanwhile). */
export function resetForecastMemory(): void {
  memory.clear();
}

function remember(entry: Answered): void {
  memory.delete(entry.key);
  memory.set(entry.key, entry);
  for (const oldest of memory.keys()) {
    if (memory.size <= MEMORY_LIMIT) break;
    memory.delete(oldest);
  }
}

/**
 * What the hook shows for the request `key` it is on.
 * - `result`: how that request settled; an 'ai' answer from the session counts as settled.
 * - `shown`: until then, the answer on screen: this key's remembered non-'ai' answer, else the one that
 *   came before it (it answers other inputs, so the screen marks it as refreshing).
 */
type View = { key: string; result: Settled | null; shown: Answered | null };

function openView(key: string, before: View | null): View {
  const cached = memory.get(key);
  if (cached !== undefined && isAi(cached)) return { key, result: cached, shown: null };
  // A failure leaves nothing to show: the answer before it is two requests old.
  const previous = before === null ? null : before.result === null ? before.shown : 'answer' in before.result ? before.result : null;
  return { key, result: null, shown: cached ?? previous };
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
  const [view, setView] = useState(() => openView(key, null));

  // A new request key opens a new view (adjusting state while rendering: React re-renders at once, so
  // the screen never shows the old key's view under the new key).
  let current = view;
  if (view.key !== key) {
    current = openView(key, view);
    setView(current);
  }

  // The effect below runs when the key changes, not on every render: it reads the rest from here.
  const latest = useRef({ profile, candidates, request, hasPrevious: false });
  useEffect(() => {
    latest.current = { profile, candidates, request, hasPrevious: current.shown !== null };
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
      setView((v) => (v.key === key ? { key, result, shown: null } : v));
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
  }, [ready, key]);

  return useMemo((): ForecastState => {
    if (!ready) return LOADING;
    const { result, shown } = current;
    if (result !== null) {
      return 'error' in result
        ? { status: 'error', error: result.error }
        : { status: 'ready', source: result.answer.bundle.source, answer: result.answer, isRefreshing: false };
    }
    if (shown !== null) {
      return { status: 'ready', source: shown.answer.bundle.source, answer: shown.answer, isRefreshing: true };
    }
    return LOADING;
  }, [ready, current]);
}
