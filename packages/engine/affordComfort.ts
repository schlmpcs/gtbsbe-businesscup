// Can I Afford It?, the comfort tier on top of canAfford (afford.ts): "Yes, comfortably", "Yes, but
// stretched" or "Not yet", and the two numbers that decide it, read off the same month-by-month
// simulation canAfford checks (the purchase made now, card balances paid from the surplus).
//
//   cushion months  = month-end cash / that month's outflow (spending + required debt payments + the
//                     purchase's own monthly cost when it recurs; a yearly one counts 1/12 a month).
//                     The lowest value over the 12 checked months.
//   debt load       = required debt payments / take-home pay; the highest value over those months.
//
// Tier:
//   notYet       canAfford's verdict is not "fits" (it says "wait" or "no").
//   stretched    it fits, but the purchase leaves less than `comfortableCushionMonths` of cushion in
//                some month, or pushes the debt load above the yellow threshold (0.20). A plan that is
//                already above it without the purchase is stretched only if the purchase raises it.
//   comfortable  otherwise.
import type { AffordResult, Money, Profile, Purchase, Rate } from '@lifeguessr/types';
import { debtLoadThresholds, type Assumption } from './assumptions';
import { AFFORD_CHECK_MONTHS } from './afford';
import { type ForecastRates, type SimulationMonth, simulate } from './simulate';

/** "Comfortably" needs at least this many months of costs in cash after buying (low end of the usual 3–6 months). */
export const comfortableCushionMonths = {
  value: 3,
  assumption: true,
  note: 'Low end of the common 3–6 months emergency-fund guidance; shown as guidance.',
} satisfies Assumption<number>;

export type AffordTier = 'comfortable' | 'stretched' | 'notYet';

export type AffordComfort = {
  tier: AffordTier;
  /** What makes a fitting purchase "stretched"; null otherwise. */
  stretchedBy: 'cushion' | 'debtLoad' | null;
  /** Lowest months of cushion over the checked year, without / with the purchase (Infinity = no outflow). */
  cushionMonthsBefore: number;
  cushionMonthsAfter: number;
  /** Highest debt load over the checked year, without / with the purchase (Infinity = payments, no pay). */
  debtLoadBefore: Rate;
  debtLoadAfter: Rate;
};

const EPS = 1e-9;

/** The cash one occurrence takes (a loan's unfinanced part; the loan payment is a debt payment). */
function cashPerOccurrence(x: Purchase): Money {
  if (typeof x.payWith !== 'object') return x.amount;
  const l = x.payWith.loan;
  return Math.max(0, x.amount - Math.max(0, l.amount - (l.downPayment ?? 0)));
}

function monthsOfCushion(s: SimulationMonth, recurring: Money): number {
  const outflow = s.spending + s.requiredDebtPayments + recurring;
  if (outflow <= 0) return s.cash >= 0 ? Number.POSITIVE_INFINITY : 0;
  return Math.max(0, s.cash) / outflow;
}

/**
 * The comfort tier of a purchase made now, given canAfford's verdict for it. Pass the same `rates`
 * canAfford got so both read the same simulation.
 */
export function affordComfort(
  p: Profile,
  x: Purchase,
  verdict: AffordResult['verdict'],
  opts: { rates?: Partial<ForecastRates> } = {},
): AffordComfort {
  if (!Number.isFinite(x.amount) || x.amount <= 0) throw new RangeError(`Invalid purchase amount: ${x.amount}`);
  const months = AFFORD_CHECK_MONTHS;
  const base = simulate(p, months, { rates: opts.rates });
  const withIt = simulate(p, months, { rates: opts.rates, extra: [{ ...x, startMonth: 0, payOffFromSurplus: true }] });
  const recurring = x.recurring === false ? 0 : cashPerOccurrence(x) / (x.recurring === 'monthly' ? 1 : 12);

  let cushionBefore = Number.POSITIVE_INFINITY;
  let cushionAfter = Number.POSITIVE_INFINITY;
  let loadBefore = 0;
  let loadAfter = 0;
  for (let m = 1; m <= months; m++) {
    cushionBefore = Math.min(cushionBefore, monthsOfCushion(base.path[m]!, 0));
    cushionAfter = Math.min(cushionAfter, monthsOfCushion(withIt.path[m]!, recurring));
    loadBefore = Math.max(loadBefore, base.path[m]!.debtLoad);
    loadAfter = Math.max(loadAfter, withIt.path[m]!.debtLoad);
  }

  let stretchedBy: AffordComfort['stretchedBy'] = null;
  if (verdict === 'fits') {
    if (cushionAfter < comfortableCushionMonths.value - EPS) stretchedBy = 'cushion';
    else if (loadAfter > debtLoadThresholds.value.yellow + EPS && loadAfter > loadBefore + EPS) stretchedBy = 'debtLoad';
  }
  return {
    tier: verdict !== 'fits' ? 'notYet' : stretchedBy ? 'stretched' : 'comfortable',
    stretchedBy,
    cushionMonthsBefore: cushionBefore,
    cushionMonthsAfter: cushionAfter,
    debtLoadBefore: loadBefore,
    debtLoadAfter: loadAfter,
  };
}
