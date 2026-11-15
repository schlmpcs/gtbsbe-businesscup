// The month so far from the daily log, for /spend and Home. Every number comes from the engine:
// dailyMonthToDate builds monthEnd's `current` (spent so far by category, day = today), monthEnd
// projects the month end, safeToSpendToday spreads what is left of the usual month over the days left.
// The "everyday" budget and its pace (for the ring and the by-day chart) are the usual month without
// the bill categories (usualMonthSpend + monthEndBillCategories), spread evenly over the month.
import { dailyMonthToDate, monthEnd, monthEndBillCategories, safeToSpendToday, usualMonthSpend } from '@lifeguessr/engine';
import { daysInMonth } from '@/features/bills/model/calendar';
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
    const usual = usualMonthSpend(profile, history, month);
    const usualBills = monthEndBillCategories.value.reduce((sum, c) => sum + usual.byCategory[c], 0);
    const everyday = Math.max(0, usual.total - usualBills);
    const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
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
      everydayBudget: everyday,
      leftShare: everyday > 0 ? Math.min(1, Math.max(0, safe.remaining) / everyday) : 0,
      pacePerDay: everyday / days,
      daysInMonth: days,
      entryCount: entries.filter((e) => e.date.startsWith(`${month}-`)).length,
    };
  });
}
