import type {
  Debt,
  Money,
  PayoffComparison,
  PayoffMethod,
  PayoffPlan,
  Profile,
  Rate,
} from '@lifeguessr/types';
import {
  PAYOFF_MAX_EXTRA,
  PAYOFF_SOLVE_TOLERANCE,
  payCardExtraShareOfSurplus,
  payCardExtraStep,
} from '../assumptions';
import { type ForecastRates, simulate } from '../simulate';
import { assertNonNegative, assertTermMonths } from './amortize';
import { validateDebts } from './debts';
import { simulatePayoff } from './payoffSimulation';

type Simulation = ReturnType<typeof simulatePayoff>;
function savings(plan: Simulation, minimum: Simulation): PayoffPlan {
  return {
    ...plan,
    interestSavedVsMinimum: minimum.totalInterest - plan.totalInterest,
    monthsSavedVsMinimum:
      minimum.monthsToDebtFree === null || plan.monthsToDebtFree === null
        ? null
        : minimum.monthsToDebtFree - plan.monthsToDebtFree,
  };
}
/** Fixed-budget payoff with per-debt detail and a cent-rounded monthly balance timeline. */
export function payoffPlan(
  debts: Debt[],
  extra: Money,
  method: PayoffMethod,
): PayoffPlan {
  assertNonNegative('extra', extra);
  const minimum = simulatePayoff(debts, 0, 'minimum');
  return savings(
    method === 'minimum' ? minimum : simulatePayoff(debts, extra, method),
    minimum,
  );
}
/** Compare both priority orders against input-order minimum payments, including rollover. */
export function comparePayoff(debts: Debt[], extra: Money): PayoffComparison {
  const minimum = simulatePayoff(debts, 0, 'minimum');
  return {
    extra,
    minimum: savings(minimum, minimum),
    avalanche: savings(simulatePayoff(debts, extra, 'avalanche'), minimum),
    snowball: savings(simulatePayoff(debts, extra, 'snowball'), minimum),
  };
}
/** Smallest extra monthly budget within $1 that finishes by the target; bounded at PAYOFF_MAX_EXTRA. */
export function extraToFinishBy(
  debts: Debt[],
  months: number,
  method: 'avalanche' | 'snowball' = 'avalanche',
): { extra: Money; reachable: boolean } {
  assertTermMonths(months);
  if (method !== 'avalanche' && method !== 'snowball')
    throw new RangeError('Invalid payoff method');
  const finishes = (extra: number) => {
    const end = simulatePayoff(debts, extra, method).monthsToDebtFree;
    return end !== null && end <= months;
  };
  if (finishes(0)) return { extra: 0, reachable: true };
  if (!finishes(PAYOFF_MAX_EXTRA))
    return { extra: PAYOFF_MAX_EXTRA, reachable: false };
  let low = 0,
    high = PAYOFF_MAX_EXTRA;
  while (high - low > PAYOFF_SOLVE_TOLERANCE) {
    const mid = (low + high) / 2;
    if (finishes(mid)) high = mid;
    else low = mid;
  }
  return { extra: high, reachable: true };
}

/** What `suggestedPayoffExtra` starts the planner at, and the two numbers it was worked out from. */
export type PayoffExtraSuggestion = {
  /** The suggested extra per month on all the debts: a whole number of `step`s, 0 when there is no room for one. */
  extra: Money;
  /** This month's surplus with these debts: take-home pay − spending − every required payment (and own extras). Can be negative. */
  surplus: Money;
  /** The share of a positive surplus the suggestion puts toward the debts (payCardExtraShareOfSurplus). */
  share: Rate;
};

/**
 * Where the debt payoff planner's extra starts before the person picks one.
 *
 * Starting at $0 made avalanche, snowball and minimums only look identical (with no extra they all pay the same total
 * each month), so the comparison read as broken. Instead the planner starts at the same rule Next Moves uses for
 * "pay your card first": a share of what is left in the month, rounded down to a round amount. "What is left" is this
 * month's surplus as the forecast computes it, but with `debts` in place of the profile's own debts, because the planner
 * pays off a list that can include the selected loan offer: if the person takes that loan, its payment comes out of the
 * same month, so the suggestion must not spend money the new payment already took. A month with nothing left (or less
 * than one step's worth after the share) gets 0, never a negative or a made-up amount.
 *
 * `step` is the rounding: the planner passes its slider step so the suggestion sits on a notch; the default is
 * payCardExtraStep. `rates` are the forecast's rate overrides, as for rankMoves.
 */
export function suggestedPayoffExtra(
  p: Profile,
  debts: Debt[],
  opts: { step?: Money; rates?: Partial<ForecastRates> } = {},
): PayoffExtraSuggestion {
  validateDebts(debts);
  const step = opts.step ?? payCardExtraStep.value;
  if (!Number.isFinite(step) || step <= 0) throw new RangeError(`Invalid step: ${step}`);
  const share = payCardExtraShareOfSurplus.value;
  const surplus = simulate({ ...p, debts }, 1, { rates: opts.rates }).path[1]!.surplus;
  // `!(surplus > 0)` also catches a surplus that is not a number (a broken profile): no suggestion, not NaN dollars.
  if (!(surplus > 0)) return { extra: 0, surplus, share };
  return { extra: Math.floor((surplus * share) / step) * step, surplus, share };
}
