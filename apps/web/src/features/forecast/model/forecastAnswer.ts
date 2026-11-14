// Pure helpers over a forecast answer (what POST /api/ai/forecast, or the local rules engine, said
// about one profile and its candidate moves). No React: the request hook, the move ranking and the
// two screens' view-models all read an answer through these, so they agree on what it means.
import { deflateForecast, forecastFacts, hasEstimates, type MoveCandidate } from '@lifeguessr/engine';
import type {
  Forecast, ForecastBundle, ForecastPoint, ForecastSource, Move, Profile, ProfilePatch, Rate,
} from '@lifeguessr/types';
import type { ScenarioPatch } from '@/lib/api/aiForecast';
import { inflationForZip } from '@/lib/areas';
import { canonicalJson } from '@/lib/canonicalJson';
import { toVMError } from '@/lib/model/errors';
import type { VMError } from '@/lib/model/types';
import type { BandKind, ForecastAnswer, ForecastState } from './types';

// ----- comparing ------------------------------------------------------------------------------

/** Two patches that change the same things the same way, whatever order their keys were written in. */
export function patchesEqual(a: ProfilePatch, b: ProfilePatch): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

// ----- the request ----------------------------------------------------------------------------

/** Scenario id of the committed move's preview when it is not one of the answered candidates. */
export function committedScenarioId(moveId: string): string {
  return `committed:${moveId}`;
}

export type ForecastRequest = {
  /** Identifies the request: what the model is shown (`forecastFacts`), the scenarios and the rates. */
  key: string;
  scenarios: ScenarioPatch[];
  rates: { inflationAnnual: Rate };
};

/** A patch that names a debt the profile does not have changes nothing, and the route rejects it. */
const namesOnlyDebtsOf = (profile: Profile, patch: ProfilePatch): boolean =>
  (patch.debts ?? []).every((d) => profile.debts.some((x) => x.id === d.id));

/**
 * What to ask for the profile and its candidate moves. The committed move (`preview`) gets a scenario
 * of its own (`committed:<id>`) only when it is not an answered candidate with its stored patch (the
 * profile changed since it was committed) and its patch names only debts the profile still has;
 * committing a ranked move asks nothing new.
 */
export function buildRequest(
  profile: Profile,
  candidates: readonly MoveCandidate[],
  preview: Pick<Move, 'id' | 'patch'> | undefined,
): ForecastRequest {
  const scenarios: ScenarioPatch[] = candidates.map(({ id, patch }) => ({ id, patch }));
  const answered = preview && candidates.some((c) => c.id === preview.id && patchesEqual(c.patch, preview.patch));
  if (preview && !answered && namesOnlyDebtsOf(profile, preview.patch)) {
    scenarios.push({ id: committedScenarioId(preview.id), patch: preview.patch });
  }
  const rates = { inflationAnnual: inflationForZip(profile.zip) };
  const sorted = [...scenarios].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { key: canonicalJson({ facts: forecastFacts(profile), scenarios: sorted, rates }), scenarios, rates };
}

/** The bundle answers the request: nominal dollars (it is deflated here) for the base and every scenario asked for. */
export function coversRequest(bundle: ForecastBundle, scenarios: readonly ScenarioPatch[]): boolean {
  return (
    !bundle.base.todaysDollars &&
    scenarios.every((s) => Object.hasOwn(bundle.scenarios, s.id) && !bundle.scenarios[s.id]!.todaysDollars)
  );
}

// ----- reading an answer ----------------------------------------------------------------------

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

/** What the range band is made of: the numbers we estimated (rules) or the model's own uncertainty (AI). */
export const bandKindOf = (source: ForecastSource | null): BandKind => (source === 'ai' ? 'model' : 'inputs');

/**
 * Whether the band has no width, so there is no range to show. For the rules forecast it follows the
 * inputs: zero when none of the answered profile's numbers is an estimate. For the AI forecast it follows
 * the answer: zero when the model gave (nearly) a single number. `in10y` is the point shown, in the
 * dollars shown.
 */
export function bandIsZero(source: ForecastSource, profile: Profile, in10y: ForecastPoint): boolean {
  return source === 'ai' ? in10y.high - in10y.low < 1 : !hasEstimates(profile);
}

/** Zero point shown until there is a forecast (the screens show a skeleton, not this). */
export const NO_IN10Y: ForecastPoint = { month: 120, low: 0, mid: 0, high: 0 };

/**
 * Moves can be committed or marked done only once the numbers on screen answer the current profile: not
 * while loading, nor while the answer on screen is the previous profile's (`isStale`). Asking again for the
 * current profile's own rules answer (`isRefreshing` without `isStale`) leaves them enabled: the answer shown
 * has the same ids and patches as the one on its way.
 */
export function forecastIsBusy(forecast: ForecastState): boolean {
  return forecast.status === 'loading' || (forecast.status === 'ready' && forecast.isStale);
}

/** The base forecast of a `ForecastState` as a screen shows it, and what goes with it. */
export type ShownForecast = {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  source: ForecastSource | null;
  /** The base forecast in the shown dollars; null until there is one. */
  base: Forecast | null;
  /** `base.in10y`, or a zero point until there is one. */
  in10y: ForecastPoint;
  /** Derived from the answered profile and bundle, never from the live profile (which may be ahead of them). */
  band: { kind: BandKind; isZero: boolean };
};

/**
 * Reads the base forecast of `forecast` in today's dollars or nominal. `error` comes from the request
 * state, or from the deflation itself failing; `band.isZero` is true when there is nothing to show.
 */
export function shownForecast(forecast: ForecastState, todaysDollars: boolean): ShownForecast {
  if (forecast.status !== 'ready') {
    const error = forecast.status === 'error' ? forecast.error : null;
    return {
      status: error ? 'error' : 'loading', error, source: null, base: null, in10y: NO_IN10Y,
      band: { kind: 'inputs', isZero: true },
    };
  }
  const { answer, source } = forecast;
  try {
    const base = answerDollars(answer, todaysDollars)(answer.bundle.base);
    return {
      status: 'ready', error: null, source, base, in10y: base.in10y,
      band: { kind: bandKindOf(source), isZero: bandIsZero(source, answer.profile, base.in10y) },
    };
  } catch (err) {
    return {
      status: 'error', error: toVMError(err), source, base: null, in10y: NO_IN10Y,
      band: { kind: bandKindOf(source), isZero: true },
    };
  }
}
