// "Your number" (S1 sample card, S10 hero): net worth today, the rules forecast for 10 years from now
// in today's dollars, and a goal's verdict and gap. Every number comes from @lifeguessr/engine (the
// rules forecast, never the AI one), so the card can say "computed by the rules engine".
import { goalStatus, hasEstimates, rankMoves } from '@lifeguessr/engine';
import { COST_CATEGORIES, type Goal, type Profile } from '@lifeguessr/types';
import { areaRates, displayForecast, netWorthToday, thisMonth } from '@/lib/model/profile';
import type { SampleLifeVM, YourNumberGoalVM, YourNumberVM } from './types';

/** The sample life's goal on S1 and on S10 while the sample is on and no goal is set: $200k in 10 years. */
export const SAMPLE_GOAL: Goal = { target: 200_000, years: 10 };

/** How many moves the S1 sample card lists. */
export const SAMPLE_MOVES_SHOWN = 2;

/** The calendar year `years` from `now` (2026 + 10 = 2036). */
export function yearIn(years: number, now: Date = new Date()): number {
  return now.getFullYear() + years;
}

/** A goal's verdict and gap (engine goalStatus, rules forecast in today's dollars, area inflation). */
export function goalSummary(p: Profile, goal: Goal, now?: Date): YourNumberGoalVM {
  const s = goalStatus(p, goal, { rates: areaRates(p) });
  return {
    target: goal.target,
    years: goal.years,
    year: yearIn(goal.years, now),
    verdict: s.verdict,
    gap: s.gap,
    progress: s.progress,
    projected: { ...s.projected },
  };
}

/** Net worth today and in 10 years (rules forecast, today's dollars), and the goal when there is one. */
export function yourNumber(p: Profile, goal: Goal | null, now?: Date): YourNumberVM {
  const f = displayForecast(p, true);
  return {
    year: yearIn(10, now),
    today: netWorthToday(p),
    todayIsEstimate: p.cash.isEstimate || p.retirement.isEstimate,
    in10y: { ...f.in10y },
    isEstimate: hasEstimates(p),
    goal: goal ? goalSummary(p, goal, now) : null,
  };
}

/**
 * The S1 sample-life card: the demo profile's month (this month's spending + debt payments, the same
 * number S7 shows), its number today and in 10 years, a $200k goal, and its top moves (engine rankMoves).
 */
export function sampleLife(p: Profile, now?: Date): SampleLifeVM {
  const month = thisMonth(p);
  const monthIsEstimate =
    COST_CATEGORIES.some((c) => c !== 'debtPayments' && p.spending[c].isEstimate) || p.debts.some((d) => d.minPayment.isEstimate);
  const moves = rankMoves(p, { rates: areaRates(p) })
    .slice(0, SAMPLE_MOVES_SHOWN)
    .map((m) => ({ id: m.id, kind: m.kind, category: m.category, effect10y: m.effect10y }));
  return {
    ...yourNumber(p, SAMPLE_GOAL, now),
    age: p.age.value,
    month: { value: month.spending + month.debtPayments, isEstimate: monthIsEstimate },
    takeHome: { ...p.takeHomePay },
    moves,
  };
}
