// Y15: the checks around the AI forecast. Spec: docs/ENGINEERING.md → AI forecast.
//
// The model answers with ten yearly anchors (low / mid / high net worth at the end of years 1..10,
// nominal dollars). The engine never calls a model: it only
// - checks the anchors' structure (`anchorIssues`) and turns them into a Forecast (`anchorsToForecast`),
// - converts a nominal Forecast to today's dollars (`deflateForecast`),
// - decides whether the answer is plausible by comparing it with the rules forecast
//   (`forecastSanityIssues` for the base, `scenarioEffectIssues` for each scenario's effect at a
//   horizon of 1, 3, 5 or 10 years; `pointAt` reads the year-end point it compares).
// Every check returns human-readable issues ([] = passes); they go back to the model for one retry,
// and a bundle that still fails is replaced by the rules bundle. The envelope is `aiForecastSanity`.
import type { Forecast, ForecastPoint, Money, Rate, YearAnchor } from '@lifeguessr/types';
import { type AiForecastSanity, aiForecastSanity } from './assumptions';
import { MIN_EFFECT_10Y } from './moves';

const YEARS = 10;
const MONTHS_PER_YEAR = 12;
const MONTHS = YEARS * MONTHS_PER_YEAR;
/** The horizon the envelope values in `aiForecastSanity` are stated for; the floors scale by `years / ENVELOPE_REFERENCE_YEARS`. */
const ENVELOPE_REFERENCE_YEARS = 10;

/** `$12,345`, `-$1,200`; non-finite numbers as they are. For messages only. */
function usd(x: Money): string {
  if (!Number.isFinite(x)) return String(x);
  const rounded = Math.round(x);
  return `${rounded < 0 ? '-' : ''}$${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Structural problems in the anchors; [] = valid. Valid means exactly ten anchors with years 1..10 in
 * order, finite numbers, and low ≤ mid ≤ high. Years are named by position, so a repeated or skipped
 * year does not make the other messages ambiguous. Reports every problem, not only the first.
 */
export function anchorIssues(anchors: readonly YearAnchor[]): string[] {
  const issues: string[] = [];
  if (anchors.length !== YEARS) {
    issues.push(`expected ${YEARS} anchors, one for each of years 1 to ${YEARS}, got ${anchors.length}`);
  }
  anchors.forEach((a, i) => {
    const position = i + 1;
    if (a.year !== position) {
      issues.push(`anchor ${position} has year ${String(a.year)}: the years must be 1, 2, ..., ${YEARS} in order`);
    }
    const values = { low: a.low, mid: a.mid, high: a.high };
    const broken = Object.entries(values).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
    if (broken.length > 0) {
      issues.push(`year ${position}: ${broken.join(', ')} must be finite numbers`);
      return;
    }
    if (a.low > a.mid) issues.push(`year ${position}: low (${usd(a.low)}) is above mid (${usd(a.mid)})`);
    if (a.mid > a.high) issues.push(`year ${position}: mid (${usd(a.mid)}) is above high (${usd(a.high)})`);
  });
  return issues;
}

const lerp = (from: Money, to: Money, t: number): Money => from + (to - from) * t;

/**
 * A nominal Forecast from valid anchors: month 0 is today's net worth exactly (no band), month 12·k
 * is anchor k exactly, and the months in between are linear per year. 121 points, `in10y` = month 120.
 * Throws RangeError for invalid anchors (check with `anchorIssues` first) or a non-finite balance.
 */
export function anchorsToForecast(anchors: readonly YearAnchor[], todayNetWorth: Money): Forecast {
  const issues = anchorIssues(anchors);
  if (issues.length > 0) throw new RangeError(`invalid anchors: ${issues.join('; ')}`);
  if (!Number.isFinite(todayNetWorth)) throw new RangeError(`todayNetWorth must be a finite number, got ${todayNetWorth}`);

  const knots = [{ low: todayNetWorth, mid: todayNetWorth, high: todayNetWorth }, ...anchors];
  const points: ForecastPoint[] = [];
  for (let month = 0; month <= MONTHS; month++) {
    const from = knots[Math.floor(month / MONTHS_PER_YEAR)]!;
    const into = month % MONTHS_PER_YEAR;
    if (into === 0) {
      points.push({ month, mid: from.mid, low: from.low, high: from.high });
      continue;
    }
    const to = knots[Math.floor(month / MONTHS_PER_YEAR) + 1]!;
    const t = into / MONTHS_PER_YEAR;
    const mid = lerp(from.mid, to.mid, t);
    // Rounding could put an interpolated edge a hair on the wrong side of mid when they nearly touch.
    points.push({
      month,
      mid,
      low: Math.min(lerp(from.low, to.low, t), mid),
      high: Math.max(lerp(from.high, to.high, t), mid),
    });
  }
  return { points, in10y: points[MONTHS]!, todaysDollars: false };
}

/**
 * The forecast in today's dollars: each point divided by (1 + inflation)^(month/12), as `forecast()`
 * does with `todaysDollars: true`. Throws RangeError when `f` is already deflated (a double deflation
 * would be silently wrong) or the inflation rate cannot deflate (not finite, or ≤ −100% a year).
 */
export function deflateForecast(f: Forecast, inflationAnnual: Rate): Forecast {
  if (f.todaysDollars) throw new RangeError("forecast is already in today's dollars");
  if (!Number.isFinite(inflationAnnual) || inflationAnnual <= -1) {
    throw new RangeError(`inflationAnnual must be a finite decimal above -1, got ${inflationAnnual}`);
  }
  const deflate = (p: ForecastPoint): ForecastPoint => {
    const deflator = (1 + inflationAnnual) ** (p.month / MONTHS_PER_YEAR);
    return { month: p.month, mid: p.mid / deflator, low: p.low / deflator, high: p.high / deflator };
  };
  const points = f.points.map(deflate);
  // in10y is the month-120 point, the same object as in forecast() and anchorsToForecast().
  return { points, in10y: points[MONTHS] ?? deflate(f.in10y), todaysDollars: true };
}

/**
 * The year-end point of a forecast: month 12 × `years` (3 → `points[36]`). Throws RangeError when `years`
 * is not a positive integer or the forecast does not reach that far, so callers never read `undefined`.
 */
export function pointAt(f: Forecast, years: number): ForecastPoint {
  if (!Number.isInteger(years) || years < 1) throw new RangeError(`years must be a positive integer, got ${years}`);
  const point = f.points[years * MONTHS_PER_YEAR];
  if (!point) throw new RangeError(`the forecast has no point for year ${years} (month ${years * MONTHS_PER_YEAR})`);
  return point;
}

/**
 * Whether an AI forecast is plausible next to the rules forecast of the same inputs (both in the same dollars, nominal in practice);
 * [] = plausible. Compares the year-end points (month 12·k, k = 1..10). With
 * tol(k) = max(relative × |rules mid|, floorMonths × k / 10 × takeHomePay), the AI mid must lie in
 * [rules low − tol, rules high + tol] and its band may be at most max(bandMaxRatio × rules band, tol)
 * wide. The tolerance has a floor in months of pay so a net worth near zero, a negative one, or a
 * zero-width rules band (no estimated input) still leaves room for a sensible answer; the floor grows
 * with the year (1.2 months of pay at year 1, 12 at year 10) because the uncertainty does. Catches
 * wrong-unit and runaway answers; it does not grade accuracy.
 *
 * Non-finite values in the candidate are issues (the model got them wrong). Anything the caller
 * controls is a programmer error and throws RangeError, because a NaN tolerance would make every
 * comparison false and pass every candidate: a non-finite `takeHomePay` or reference value, a
 * reference with a missing point, or forecasts in different units (`todaysDollars` differs).
 */
export function forecastSanityIssues(
  candidate: Forecast,
  reference: Forecast,
  takeHomePay: Money,
  envelope: AiForecastSanity = aiForecastSanity.value,
): string[] {
  if (candidate.todaysDollars !== reference.todaysDollars) {
    throw new RangeError("the candidate and the reference forecast must be in the same dollars (todaysDollars differs)");
  }
  if (!Number.isFinite(takeHomePay)) throw new RangeError(`takeHomePay must be a finite number, got ${takeHomePay}`);
  const issues: string[] = [];
  for (let year = 1; year <= YEARS; year++) {
    const month = year * MONTHS_PER_YEAR;
    const ref = reference.points[month];
    if (!ref) throw new RangeError(`the reference forecast has no point for month ${month}`);
    if (![ref.low, ref.mid, ref.high].every(Number.isFinite)) {
      throw new RangeError(`the reference forecast has a non-finite value at month ${month}`);
    }
    const cand = candidate.points[month];
    if (!cand) {
      issues.push(`year ${year}: the forecast has no point for month ${month}`);
      continue;
    }
    if (![cand.low, cand.mid, cand.high].every(Number.isFinite)) {
      issues.push(`year ${year}: low, mid and high must be finite numbers`);
      continue;
    }

    const floorMonths = (envelope.floorMonths * year) / ENVELOPE_REFERENCE_YEARS;
    const tol = Math.max(envelope.relative * Math.abs(ref.mid), floorMonths * takeHomePay);
    const lower = ref.low - tol;
    const upper = ref.high + tol;
    if (cand.mid < lower) {
      issues.push(`year ${year}: mid ${usd(cand.mid)} is below the plausible lower bound ${usd(lower)}`);
    } else if (cand.mid > upper) {
      issues.push(`year ${year}: mid ${usd(cand.mid)} is above the plausible upper bound ${usd(upper)}`);
    }

    const width = cand.high - cand.low;
    const maxWidth = Math.max(envelope.bandMaxRatio * (ref.high - ref.low), tol);
    if (width > maxWidth) {
      issues.push(`year ${year}: the band from ${usd(cand.low)} to ${usd(cand.high)} is ${usd(width)} wide, above the plausible maximum ${usd(maxWidth)}`);
    }
  }
  return issues;
}

/**
 * Whether an AI scenario's effect at `years` (`scenario.mid − base.mid` at month 12 × years; 10 by
 * default) is plausible next to the rules effect; [] = plausible. The yearly envelope is too loose to
 * see a scenario equal to the base, a flipped sign or a 5× effect, so each scenario is checked on its
 * own effect: accepted when within `effectFloor × years / 10` dollars of the rules effect ($100 at
 * 1 year, $1,000 at 10), otherwise rejected when the rules effect is under $1 (it should be about
 * nothing), the signs differ (a zero effect included), or ai / rules falls outside
 * [effectRatioMin, effectRatioMax]. Every message starts with `${years}-year effect`. A non-finite
 * candidate effect, or a candidate forecast that stops short of `years`, is an issue; a non-finite
 * reference effect, a reference that stops short, `years` not a positive integer, or the four
 * forecasts not sharing one `todaysDollars`, is a programmer error and throws RangeError.
 */
export function scenarioEffectIssues(
  candidate: { base: Forecast; scenario: Forecast },
  reference: { base: Forecast; scenario: Forecast },
  envelope: AiForecastSanity = aiForecastSanity.value,
  years: number = YEARS,
): string[] {
  const unit = reference.base.todaysDollars;
  if (![reference.scenario, candidate.base, candidate.scenario].every((f) => f.todaysDollars === unit)) {
    throw new RangeError('the four forecasts must be in the same dollars (todaysDollars differs)');
  }
  const label = `${years}-year effect`;
  const rules = pointAt(reference.scenario, years).mid - pointAt(reference.base, years).mid;
  if (!Number.isFinite(rules)) throw new RangeError(`the reference forecasts have a non-finite ${years}-year value`);
  const month = years * MONTHS_PER_YEAR;
  const candidateBase = candidate.base.points[month];
  const candidateScenario = candidate.scenario.points[month];
  if (!candidateBase || !candidateScenario) return [`${label} cannot be read: the forecast has no point for month ${month}`];
  const ai = candidateScenario.mid - candidateBase.mid;
  if (!Number.isFinite(ai)) return [`${label} is not a finite number`];
  const floor = (envelope.effectFloor * years) / ENVELOPE_REFERENCE_YEARS;
  if (Math.abs(ai - rules) <= floor) return [];

  // Everything accepted as one interval: the floor around the rules effect joined with the ratio range.
  const ratioA = rules * envelope.effectRatioMin;
  const ratioB = rules * envelope.effectRatioMax;
  const range = `${usd(Math.min(ratioA, ratioB, rules - floor))} to ${usd(Math.max(ratioA, ratioB, rules + floor))}`;

  if (Math.abs(rules) < MIN_EFFECT_10Y) {
    return [`${label} ${usd(ai)}: this move changes net worth by almost nothing, so the scenario should end within ${usd(floor)} of the base (${range})`];
  }
  if (Math.sign(ai) !== Math.sign(rules)) {
    const direction = rules > 0 ? 'raise' : 'lower';
    return [ai === 0
      ? `${label} is $0 (the scenario ends where the base ends), but this move should ${direction} net worth: expected ${range}`
      : `${label} ${usd(ai)} has the wrong sign: this move should ${direction} net worth, expected ${range}`];
  }
  const ratio = ai / rules;
  if (!(ratio >= envelope.effectRatioMin && ratio <= envelope.effectRatioMax)) {
    return [`${label} ${usd(ai)} is ${ratio.toFixed(1)} times the plausible size: expected ${range}`];
  }
  return [];
}
