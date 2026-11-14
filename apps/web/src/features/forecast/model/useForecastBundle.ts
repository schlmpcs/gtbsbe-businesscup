// The 10-year forecast of S1 and S10: one bundle for the profile and its candidate moves, from
// POST /api/ai/forecast, with the local rules engine as the fallback. Spec: docs/ENGINEERING.md →
// AI forecast.
//
// - One request per distinct (profile facts, scenarios, rates), identified by a canonical key. A
//   profile change asks again after FORECAST_DEBOUNCE_MS, with the previous answer still on screen
//   (`isRefreshing`). The first request and an answer seen before in this session go at once.
// - Every answer carries the (profile, candidates) pair it was asked about (`ForecastAnswer`), so
//   a screen can rank with the bundle's own ids and patches and never with another request's.
// - Whatever goes wrong (offline, 4xx/5xx, a broken or incomplete body, no answer within
//   FORECAST_CLIENT_TIMEOUT_MS) gives the rules bundle computed here, labeled 'rules'. 'error' is
//   only for when that fails as well.
import { deflateForecast, forecastFacts, rulesBundle, type MoveCandidate } from '@lifeguessr/engine';
import type { Forecast, ForecastBundle, Move, Profile, ProfilePatch, Rate } from '@lifeguessr/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchForecastBundle, type ScenarioPatch } from '@/lib/api/aiForecast';
import { inflationForZip } from '@/lib/areas';
import { toVMError } from '@/lib/model/errors';
import type { VMError } from '@/lib/model/types';
import { useAppReady } from '@/state';
import { getAnonId } from '@/state/anonId';
import type { ForecastAnswer, ForecastState } from './types';

/** Wait this long after the last profile change before asking again (starting value). */
export const FORECAST_DEBOUNCE_MS = 600;
/** Give up on the server after this long (starting value; the route's own deadline is 20 s) and use the rules. */
export const FORECAST_CLIENT_TIMEOUT_MS = 25_000;
/** Answers kept for the session, oldest dropped first. */
const MEMORY_LIMIT = 20;

/** Scenario id of the committed move's preview when it is not one of the answered candidates. */
export function committedScenarioId(moveId: string): string {
  return `committed:${moveId}`;
}

// ----- helpers shared with the screens' view-models -------------------------------------------

/** JSON with every object's keys sorted, so the text depends on the data and not on how it was built. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const members = Object.keys(object)
      .sort()
      .filter((k) => object[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(object[k])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Two patches that change the same things the same way, whatever order their keys were written in. */
export function patchesEqual(a: ProfilePatch, b: ProfilePatch): boolean {
  return canonical(a) === canonical(b);
}

/**
 * The same forecast in the dollars the screen shows: today's (deflated by the inflation the answer was
 * asked with) or nominal as the bundle has it. Throws RangeError for a forecast that is already in
 * today's dollars; `useForecastBundle` only accepts bundles that are not.
 */
export function answerDollars(answer: ForecastAnswer, todaysDollars: boolean): (f: Forecast) => Forecast {
  const inflationAnnual = inflationForZip(answer.profile.zip);
  return (f) => (todaysDollars ? deflateForecast(f, inflationAnnual) : f);
}

/**
 * The committed move's forecast (nominal) in an answer: its candidate's scenario when the answer holds
 * that candidate with the stored patch, else the `committed:<id>` scenario asked for it. Undefined when
 * the answer has neither (not asked, or not asked yet).
 */
export function committedScenario(answer: ForecastAnswer, move: Pick<Move, 'id' | 'patch'>): Forecast | undefined {
  const candidate = answer.candidates.find((c) => c.id === move.id && patchesEqual(c.patch, move.patch));
  return answer.bundle.scenarios[candidate ? move.id : committedScenarioId(move.id)];
}

// ----- the request ----------------------------------------------------------------------------

type ForecastRequest = {
  /** Identifies the request: what the model is shown (`forecastFacts`), the scenarios and the rates. */
  key: string;
  scenarios: ScenarioPatch[];
  rates: { inflationAnnual: Rate };
};

/** A patch that names a debt the profile does not have changes nothing, and the route rejects it. */
const namesOnlyDebtsOf = (profile: Profile, patch: ProfilePatch): boolean =>
  (patch.debts ?? []).every((d) => profile.debts.some((x) => x.id === d.id));

function buildRequest(
  profile: Profile,
  candidates: readonly MoveCandidate[],
  preview: Pick<Move, 'id' | 'patch'> | undefined,
): ForecastRequest {
  const scenarios: ScenarioPatch[] = candidates.map(({ id, patch }) => ({ id, patch }));
  // The committed move needs a scenario of its own only when it is not an answered candidate with its
  // stored patch (the profile changed since it was committed); committing a ranked move asks nothing new.
  const answered = preview && candidates.some((c) => c.id === preview.id && patchesEqual(c.patch, preview.patch));
  if (preview && !answered && namesOnlyDebtsOf(profile, preview.patch)) {
    scenarios.push({ id: committedScenarioId(preview.id), patch: preview.patch });
  }
  const rates = { inflationAnnual: inflationForZip(profile.zip) };
  const sorted = [...scenarios].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { key: canonical({ facts: forecastFacts(profile), scenarios: sorted, rates }), scenarios, rates };
}

/** The bundle answers the request: nominal dollars (it is deflated here) for the base and every scenario asked for. */
function coversRequest(bundle: ForecastBundle, scenarios: readonly ScenarioPatch[]): boolean {
  return (
    !bundle.base.todaysDollars &&
    scenarios.every((s) => Object.hasOwn(bundle.scenarios, s.id) && !bundle.scenarios[s.id]!.todaysDollars)
  );
}

// ----- what has been settled ------------------------------------------------------------------

type Answered = { key: string; answer: ForecastAnswer };
type Failed = { key: string; error: VMError };
type Settled = Answered | Failed;

/**
 * Answers from the server of this session, by request key (insertion order = age). The route's rules
 * answer is kept like an AI one: it already waited out the model (up to its 20 s deadline), and asking
 * again on every screen would wait that long again. What is not kept is this file's own fallback after
 * a failed request, so the next screen tries the server again.
 */
const memory = new Map<string, Answered>();

/** Forget every answer of the session (the next screen asks again). */
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
  const [settled, setSettled] = useState<Settled | null>(null);

  // An answer of this session is shown at once (and becomes the "previous answer" of the next change).
  const remembered = ready ? memory.get(key) : undefined;
  if (remembered !== undefined && settled !== remembered) setSettled(remembered);

  // The effect below runs when the key changes, not on every render: it reads the rest from here.
  const latest = useRef({ profile, candidates, request, hasAnswer: false });
  useEffect(() => {
    latest.current = { profile, candidates, request, hasAnswer: settled !== null && 'answer' in settled };
  });

  useEffect(() => {
    if (!ready || memory.has(key)) return;
    const asked = latest.current;
    const controller = new AbortController();
    let finished = false; // answered, given up on, or no longer wanted: nothing more may reach the screen
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const settle = (next: () => Settled) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      setSettled(next());
    };
    const fromServer = (bundle: ForecastBundle): Settled => {
      if (!coversRequest(bundle, asked.request.scenarios)) return fromRules();
      const entry: Answered = { key, answer: { bundle, profile: asked.profile, candidates: [...asked.candidates] } };
      remember(entry);
      return entry;
    };
    const fromRules = (): Settled => {
      try {
        const bundle = rulesBundle(asked.profile, asked.request.scenarios, asked.request.rates);
        return { key, answer: { bundle, profile: asked.profile, candidates: [...asked.candidates] } };
      } catch (err) {
        return { key, error: toVMError(err) };
      }
    };

    const run = () => {
      timeout = setTimeout(() => {
        settle(fromRules);
        controller.abort();
      }, FORECAST_CLIENT_TIMEOUT_MS);
      fetchForecastBundle(asked.profile, asked.request.scenarios, {
        rates: asked.request.rates,
        anonId: getAnonId(),
        signal: controller.signal,
      }).then(
        (bundle) => settle(() => fromServer(bundle)),
        () => settle(fromRules),
      );
    };
    if (asked.hasAnswer) debounce = setTimeout(run, FORECAST_DEBOUNCE_MS);
    else run();

    return () => {
      finished = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ready, key]);

  const shown = remembered ?? settled;
  return useMemo((): ForecastState => {
    if (!ready || shown === null) return LOADING;
    if ('error' in shown) return shown.key === key ? { status: 'error', error: shown.error } : LOADING;
    return { status: 'ready', source: shown.answer.bundle.source, answer: shown.answer, isRefreshing: shown.key !== key };
  }, [ready, shown, key]);
}
