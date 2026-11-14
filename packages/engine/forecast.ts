// Y2 (Amir): net-worth forecast and profile patches. Spec: docs/ENGINEERING.md → Forecast.
// The month-by-month rules live in ./simulate.ts; this file runs the scenarios and builds the band.
import type { CostCategory, Forecast, ForecastPoint, Profile, ProfilePatch } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import {
  type ForecastRates,
  type ScheduledPurchase,
  forecastMonths,
  hasEstimates,
  resolveRates,
  simulate,
} from './simulate';

export type ForecastOptions = {
  /** Additional monthly saving in today's dollars; default zero. */
  extraMonthly?: number;
  /** Divide each point by (1 + inflation)^(month/12). Default false (nominal dollars). */
  todaysDollars?: boolean;
  /** Extra purchases (Can I Afford It?). Each starts at its `startMonth` (default 0 = this month). */
  extra?: readonly ScheduledPurchase[];
  /** Overrides for the default yearly rates, e.g. `{ inflationAnnual: inflationAnnualOf(area) }`. */
  rates?: Partial<ForecastRates>;
};

/**
 * Month-by-month net worth (cash + retirement − debts) with a range band from estimated inputs;
 * simulates max(120, years × 12) months, `points[m]` = end of month m (points[0] = today).
 * mid uses the point inputs; low/high shift every `isEstimate` input by ±estimateSpread against /
 * in the user's favor. The band is then widened to include mid, so low ≤ mid ≤ high at every point;
 * it is exactly zero when no input is an estimate.
 */
export function forecast(p: Profile, years = 10, opts: ForecastOptions = {}): Forecast {
  const months = forecastMonths(years);
  const rates = resolveRates(opts.rates);
  const run = (scenario: 'low' | 'mid' | 'high') =>
    simulate(p, months, { extra: opts.extra, extraMonthly: opts.extraMonthly, rates, scenario }).path.map((s) => s.netWorth);

  const mid = run('mid');
  const banded = hasEstimates(p);
  const low = banded ? run('low') : mid;
  const high = banded ? run('high') : mid;
  const todaysDollars = opts.todaysDollars ?? false;

  const points: ForecastPoint[] = mid.map((m, month) => {
    const deflator = todaysDollars ? (1 + rates.inflationAnnual) ** (month / 12) : 1;
    const l = low[month]!;
    const h = high[month]!;
    return {
      month,
      mid: m / deflator,
      low: Math.min(l, m, h) / deflator,
      high: Math.max(l, m, h) / deflator,
    };
  });
  return { points, in10y: points[120]!, todaysDollars };
}

/** A deep copy of a profile (plain data), so callers can't reach into the input through the result. */
export function cloneProfile(p: Profile): Profile {
  return {
    ...p,
    age: { ...p.age },
    takeHomePay: { ...p.takeHomePay },
    spending: Object.fromEntries(
      Object.entries(p.spending).map(([c, e]) => [c, { ...e }]),
    ) as Profile['spending'],
    cash: { ...p.cash },
    retirement: { ...p.retirement },
    retirementShare: { ...p.retirementShare },
    debts: p.debts.map((d) => ({ ...d, minPayment: { ...d.minPayment } })),
    doneMoveIds: [...p.doneMoveIds],
  };
}

/**
 * A new Profile with the patch applied (the input is not mutated). Spending categories and
 * retirementShare take the patched value and keep their `isEstimate` flag (a move changes the
 * amount, not how well we know it). Debt fields are merged by id; ids not in the profile are ignored.
 */
export function applyPatch(p: Profile, patch: ProfilePatch): Profile {
  const next = cloneProfile(p);
  for (const category of COST_CATEGORIES as readonly CostCategory[]) {
    const value = patch.spending?.[category];
    if (value === undefined) continue;
    next.spending[category] = { value, isEstimate: next.spending[category]?.isEstimate ?? false };
  }
  for (const change of patch.debts ?? []) {
    const i = next.debts.findIndex((d) => d.id === change.id);
    if (i < 0) continue;
    const d = next.debts[i]!;
    next.debts[i] = {
      ...d,
      ...(change.extraPayment !== undefined && { extraPayment: change.extraPayment }),
      ...(change.apr !== undefined && { apr: change.apr }),
    };
  }
  if (patch.retirementShare !== undefined) {
    next.retirementShare = { value: patch.retirementShare, isEstimate: next.retirementShare.isEstimate };
  }
  return next;
}
