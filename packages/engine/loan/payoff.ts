import type {
  Debt,
  Money,
  PayoffComparison,
  PayoffMethod,
  PayoffPlan,
} from '@lifeguessr/types';
import { PAYOFF_MAX_EXTRA, PAYOFF_SOLVE_TOLERANCE } from '../assumptions';
import { assertNonNegative, assertTermMonths } from './amortize';
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
