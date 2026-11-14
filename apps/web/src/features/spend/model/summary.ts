// The month so far from the daily log, for /spend and Home. Every number comes from the engine:
// dailyMonthToDate builds monthEnd's `current` (spent so far by category, day = today), monthEnd
// projects the month end, safeToSpendToday spreads what is left of the usual month over the days left.
import { dailyMonthToDate, monthEnd, safeToSpendToday } from '@lifeguessr/engine';
import type { CategoryTotals, DailyEntry, Profile } from '@lifeguessr/types';
import { runEngine } from '@/lib/model/errors';
import type { Loadable, SpendSummaryVM } from './types';

/** `month`/`day` = today on the local calendar. History = statement months before this one. */
export function spendSummary(
  profile: Profile,
  statementMonths: readonly CategoryTotals[],
  entries: readonly DailyEntry[],
  today: { month: string; day: number },
): Loadable<SpendSummaryVM> {
  const { month, day } = today;
  return runEngine(() => {
    const history = statementMonths.filter((m) => m.month < month);
    const current = dailyMonthToDate(entries, month, day);
    const end = monthEnd(profile, history, current);
    const safe = safeToSpendToday(profile, history, current);
    return {
      month,
      day,
      spent: safe.spent,
      usual: safe.planned,
      usualFromHistory: safe.usualFromHistory,
      projected: end.projectedSpend,
      safeToday: safe.perDay,
      daysLeft: safe.daysLeft,
      billsDue: safe.billsDue,
      remaining: safe.remaining,
      entryCount: entries.filter((e) => e.date.startsWith(`${month}-`)).length,
    };
  });
}
