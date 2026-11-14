// S10 "why" line under the headline (JF10): this month's take-home pay vs what goes out, and, when
// more goes out than comes in, the month cash runs out. Rules engine on the user's inputs (point
// values), never the AI forecast, so the line is labeled as computed from the inputs.
import { simulate, type ForecastRates } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import type { WhyLineVM } from './types';

/** How far ahead the run-out month is looked for. */
export const WHY_LINE_MONTHS = 120;

/** Cash below this counts as gone (absorbs floating-point dust; the engine floors cash at 0). */
const CASH_GONE = 0.5;

export function whyLine(p: Profile, rates: Partial<ForecastRates>): WhyLineVM {
  const path = simulate(p, WHY_LINE_MONTHS, { rates }).path;
  const m1 = path[1]!;
  const income = m1.income;
  // Everything this month's pay has to cover: spending, debt payments and any purchases from cash.
  const outflow = income - m1.surplus;
  const short = Math.max(0, outflow - income);
  let cashRunsOutInMonths: number | null = null;
  if (short > 0) {
    for (let m = 1; m <= WHY_LINE_MONTHS; m++) {
      if (path[m]!.cash < CASH_GONE || path[m]!.shortfallToCard > 0) {
        cashRunsOutInMonths = m;
        break;
      }
    }
  }
  return { income, outflow, short, cashRunsOutInMonths };
}
