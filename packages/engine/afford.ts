// Y4 (Amir): Can I Afford It? Spec: docs/ENGINEERING.md → Can I Afford It?
//
// The purchase is simulated (./simulate.ts, point inputs) with and without it. Month m (its end
// state) passes when all three rules hold:
//   1. cushion:      cash ≥ safetyCushionMonths × that month's outflow, where outflow = spending +
//                    required debt payments (a loan or card the purchase adds included) + the
//                    purchase's own monthly cost when it recurs (a yearly one counts 1/12 a month);
//   2. debtLoad:     required debt payments / take-home pay ≤ debtLoadThresholds.red (0.36);
//   3. cardRevolves: the card balance the purchase adds is cleared within 12 months: a charge made
//                    in month c is paid off by the end of month c + 11.
//
// Rule 3 needs a payoff plan: the forecast's default pays a card only its minimum and sends the
// surplus to cash, so nearly every card purchase would "revolve". Here every purchase is simulated
// with `payOffFromSurplus`: what it puts on a card (its charge, or the part of a cash payment that
// cash could not cover) sits on its own card balance, and each month's whole positive surplus pays
// that balance down before anything goes to cash or retirement. The cushion is still checked on
// that path, so paying the card is never "free". Existing cash above the cushion is not used to pay
// the card: buying on a card and paying it from savings is the cash purchase, judged as such.
//
// Verdict (window: the purchase month and the 11 months after it):
//   fits   every month in the window passes with the purchase made now;
//   wait   one-time purchases only: the smallest k in 1..12 for which buying in k months fits;
//   no     otherwise.
// `failsOn` (set for "wait" and "no") is the first rule buying now breaks: earliest month, then
// cushion → debtLoad → cardRevolves.
//
// baselineFails and the verdict: `baselineFails` is true when the plan without the purchase breaks
// rule 1 or 2 in any of the next 12 months (rule 3 is about the purchase's own card balance, so it
// can't fail without one). The purchase is never blamed for the plan: a rule that fails in a month
// counts against the purchase only if it holds in that month without the purchase, or the purchase
// makes it worse there (less cash above the cushion, a higher debt load). So:
//   - baselineFails + "fits": the purchase doesn't touch what is already broken (say debt load is
//     red, and a cash purchase leaves the cushion intact); the UI shows the plan's problem next to
//     the verdict.
//   - baselineFails + "wait": the plan recovers (say cash is under the cushion now and refills), and
//     the purchase fits once it does.
//   - baselineFails + "no": the purchase breaks or deepens a rule; if `failsOn` is a rule the plan
//     already breaks, the UI says the purchase makes it worse, not that it caused it.
//
// with / without: 10-year forecasts (band included) without the purchase and with it made now,
// paid as the user chose (card and cash with the payoff plan above).
//
// cheapestWay: the payment method with the highest net worth at month 120 (mid), over cash, card
// (paid off from the surplus) and, only when the user gave loan terms, that loan. Without loan terms
// a loan is not compared: there is no sourced default for a personal loan's APR and term, and a
// made-up one would decide the answer. Ties go to cash, then card. Only ways that fit now (no rule
// broken by buying now, paid that way) compete: a way that fails is never the recommendation. When
// none fits, cheapestWay is the cheapest way overall and `cheapestWayFits` is false, so the UI says
// that no way to pay fits right now instead of recommending one.
import type { AffordResult, Money, Profile, Purchase, Rate } from '@lifeguessr/types';
import { debtLoadThresholds, safetyCushionMonths } from './assumptions';
import { forecast } from './forecast';
import {
  type ForecastRates,
  type ScheduledPurchase,
  type Simulation,
  type SimulationMonth,
  forecastMonths,
  resolveRates,
  simulate,
} from './simulate';

/** Months checked from the purchase month on (the purchase month included). */
export const AFFORD_CHECK_MONTHS = 12;
/** Longest delay "wait" searches (k = 1..AFFORD_MAX_WAIT_MONTHS). */
export const AFFORD_MAX_WAIT_MONTHS = 12;
/** Horizon of `with`, `without` and the cheapestWay comparison. */
const AFFORD_YEARS = 10;

export type AffordOptions = {
  /** Overrides for the default yearly rates; pass the same ones as the forecast screen. */
  rates?: Partial<ForecastRates>;
};

type Rule = NonNullable<AffordResult['failsOn']>;
type Way = AffordResult['cheapestWay'];

/** canAfford's result: the shared AffordResult plus whether `cheapestWay` fits now. */
export type AffordCheck = AffordResult & {
  /** False when no way to pay fits now; `cheapestWay` is then the cheapest way overall. */
  cheapestWayFits: boolean;
};
const RULES: readonly Rule[] = ['cushion', 'debtLoad', 'cardRevolves'];

/** Margins below −tolerance fail (absorbs floating-point dust). */
const TOLERANCE: Record<Rule, number> = { cushion: 1e-6, debtLoad: 1e-12, cardRevolves: 1e-6 };

/** How far each rule is from failing in one month: ≥ 0 passes. null = the rule doesn't apply. */
type Margins = Record<Rule, number | null>;

const fails = (r: Rule, margin: number | null): boolean => margin !== null && margin < -TOLERANCE[r];

/** The cash a purchase takes per occurrence (a loan's unfinanced part; the loan payment is a debt). */
function cashPerOccurrence(x: Purchase): Money {
  if (typeof x.payWith !== 'object') return x.amount;
  const l = x.payWith.loan;
  return Math.max(0, x.amount - Math.max(0, l.amount - (l.downPayment ?? 0)));
}

/** A recurring purchase's monthly cost in month `month` (1-based), at its latest occurrence's price. */
function recurringMonthly(x: Purchase, start: number, month: number, inflation: Rate): Money {
  if (x.recurring === false) return 0;
  const t = month - 1;
  if (t < start) return 0;
  const period = x.recurring === 'monthly' ? 1 : 12;
  const last = start + period * Math.floor((t - start) / period);
  return (cashPerOccurrence(x) * (1 + inflation) ** ((last - start) / 12)) / period;
}

function marginsOf(s: SimulationMonth, recurring: Money, revolving: Money | null): Margins {
  const cushion = safetyCushionMonths.value * (s.spending + s.requiredDebtPayments + recurring);
  return {
    cushion: s.cash - cushion,
    debtLoad: debtLoadThresholds.value.red - s.debtLoad,
    cardRevolves: revolving === null ? null : -revolving,
  };
}

/**
 * The purchase's card balance that is past its deadline at the end of `month`: a charge made in
 * month c is due by the end of month c + 11, so only charges from months month − 10 .. month may
 * still be owed. Paid first in, first out; interest counts as overdue.
 */
function revolvingAt(sim: Simulation, id: string, month: number): Money {
  const balance = sim.path[month]!.debts[id] ?? 0;
  let recent = 0;
  for (let c = Math.max(1, month - AFFORD_CHECK_MONTHS + 2); c <= month; c++) {
    recent += sim.path[c]!.payoffCardCharges;
  }
  return Math.max(0, balance - recent);
}

const scheduled = (x: Purchase, startMonth: number): ScheduledPurchase => ({
  ...x, startMonth, payOffFromSurplus: true,
});

/**
 * Verdict (fits / wait / no) for a purchase over the 12 months from when it is made, with and
 * without it; see the header for the rules and how `baselineFails` interacts with the verdict.
 */
export function canAfford(p: Profile, x: Purchase, opts: AffordOptions = {}): AffordCheck {
  if (!Number.isFinite(x.amount) || x.amount <= 0) throw new RangeError(`Invalid purchase amount: ${x.amount}`);
  const rates = resolveRates(opts.rates);

  const base = simulate(p, AFFORD_MAX_WAIT_MONTHS + AFFORD_CHECK_MONTHS, { rates });
  const baseMargins = base.path.map((s) => marginsOf(s, 0, null));
  let baselineFails = false;
  for (let m = 1; m <= AFFORD_CHECK_MONTHS && !baselineFails; m++) {
    baselineFails = RULES.some((r) => fails(r, baseMargins[m]![r]));
  }

  /** The first rule purchase `y` made in month `start + 1` breaks within its window, or null. */
  const firstFailure = (start: number, y: Purchase = x): Rule | null => {
    const sim = simulate(p, start + AFFORD_CHECK_MONTHS, { rates, extra: [scheduled(y, start)] });
    const cardId = sim.payoffCardIds[0] ?? null;
    for (let m = start + 1; m <= start + AFFORD_CHECK_MONTHS; m++) {
      const revolving = cardId === null ? null : revolvingAt(sim, cardId, m);
      const withIt = marginsOf(sim.path[m]!, recurringMonthly(y, start, m, rates.inflationAnnual), revolving);
      const without = baseMargins[m]!;
      for (const r of RULES) {
        if (!fails(r, withIt[r])) continue;
        // Already broken without the purchase, and not made worse by it: not the purchase's fault.
        const excused = fails(r, without[r]) && withIt[r]! >= without[r]! - TOLERANCE[r];
        if (!excused) return r;
      }
    }
    return null;
  };

  const now = firstFailure(0);
  let waitMonths: number | undefined;
  if (now !== null && x.recurring === false) {
    for (let k = 1; k <= AFFORD_MAX_WAIT_MONTHS && waitMonths === undefined; k++) {
      if (firstFailure(k) === null) waitMonths = k;
    }
  }
  const verdict: AffordResult['verdict'] = now === null ? 'fits' : waitMonths !== undefined ? 'wait' : 'no';
  const cheapest = cheapestWay(p, x, rates, (y) => (y === x ? now === null : firstFailure(0, y) === null));

  return {
    verdict,
    ...(waitMonths !== undefined && { waitMonths }),
    ...(now !== null && { failsOn: now }),
    baselineFails,
    with: forecast(p, AFFORD_YEARS, { rates, extra: [scheduled(x, 0)] }),
    without: forecast(p, AFFORD_YEARS, { rates }),
    cheapestWay: cheapest.way,
    cheapestWayFits: cheapest.fits,
  };
}

/**
 * The payment method with the highest net worth after 10 years (mid) among those that fit now;
 * ties go to the earlier way. When none fits: the highest overall, with `fits: false`.
 */
function cheapestWay(p: Profile, x: Purchase, rates: ForecastRates, fitsNow: (y: Purchase) => boolean): { way: Way; fits: boolean } {
  const months = forecastMonths(AFFORD_YEARS);
  const ways: [Way, Purchase][] = [
    ['cash', x.payWith === 'cash' ? x : { ...x, payWith: 'cash' }],
    ['card', x.payWith === 'card' ? x : { ...x, payWith: 'card' }],
  ];
  if (typeof x.payWith === 'object') ways.push(['loan', x]);
  let best: { way: Way; netWorth: number } | null = null;
  let bestFitting: { way: Way; netWorth: number } | null = null;
  for (const [way, purchase] of ways) {
    const netWorth = simulate(p, months, { rates, extra: [scheduled(purchase, 0)] }).path[months]!.netWorth;
    if (best === null || netWorth > best.netWorth + TOLERANCE.cushion) best = { way, netWorth };
    if ((bestFitting === null || netWorth > bestFitting.netWorth + TOLERANCE.cushion) && fitsNow(purchase)) {
      bestFitting = { way, netWorth };
    }
  }
  return bestFitting !== null ? { way: bestFitting.way, fits: true } : { way: best!.way, fits: false };
}
