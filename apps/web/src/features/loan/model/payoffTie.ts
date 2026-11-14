// Why the payoff methods come out the same, when they do (issue #144).
//
// Three identical columns read as a broken comparison unless the screen says why. They can be identical for honest
// reasons, and each reason has its own one-line explanation in the copy (loan.planner.tie):
//   noExtra    no extra at all: every method pays the same total each month, so all three plans end the same way
//   tooSmall   an extra so small that all three still end in the same month with about the same interest
//   oneDebt    a single debt: there is nothing to put in order, so avalanche and snowball are the same plan
//   sameOrder  ordering the debts by rate and by balance gives the same list (the demo profile: the card has both
//              the highest rate and the smallest balance, then the car loan, then the new loan)
//   sameResult the two orders differ, yet at this extra they end in the same month with about the same interest
// The first two are about all three plans, the rest only about avalanche against snowball (minimums only differs).
// Nothing here makes a number: it compares the engine's plans, which are what the columns show.
import type { Money, PayoffComparison, PayoffPlan } from '@lifeguessr/types';
import type { PayoffTie } from './types';

/**
 * Two plans "tie" when they are debt-free in the same month and their interest is within `sameBelow` dollars (the
 * planner's rounding of "the same" interest). A plan that never pays off ties with nothing: the never notice covers it,
 * and its interest is 100 years of a simulation, not a total to compare.
 */
function ties(a: PayoffPlan, b: PayoffPlan, sameBelow: Money): boolean {
  return (
    a.monthsToDebtFree !== null &&
    a.monthsToDebtFree === b.monthsToDebtFree &&
    Math.abs(a.totalInterest - b.totalInterest) < sameBelow
  );
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** The reason avalanche, snowball (and maybe minimums only) come out the same; null when they differ. */
export function payoffTie(c: PayoffComparison, sameBelow: Money): PayoffTie | null {
  const { avalanche, snowball, minimum } = c;
  if (!ties(avalanche, snowball, sameBelow)) return null;
  if (ties(avalanche, minimum, sameBelow)) return c.extra > 0 ? 'tooSmall' : 'noExtra';
  // `order` lists only the debts that still have a balance, so one entry means one debt to pay.
  if (avalanche.order.length <= 1) return 'oneDebt';
  return sameList(avalanche.order, snowball.order) ? 'sameOrder' : 'sameResult';
}
