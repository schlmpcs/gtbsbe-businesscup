// The spending card's two running totals. The per-day sums come from the engine's `dailyTotalsByDay`
// (the daily-log function), fed with the ledger's money-out lines as log entries; this file only adds
// them up day by day.
import { dailyTotalsByDay } from '@lifeguessr/engine';
import type { DailyEntry, LedgerTransaction, Money, YearMonth } from '@lifeguessr/types';
import { daysInMonth } from '@/features/bills/model/calendar';
import { isCostClass } from '@/features/transactions/model/rows';
import type { SpendingPointVM } from './types';

/** Money-out lines of spending categories as daily-log entries (refunds are money in: not entries). */
export function toDailyEntries(txs: readonly Pick<LedgerTransaction, 'id' | 'date' | 'cls' | 'amount'>[]): DailyEntry[] {
  return txs.flatMap((t): DailyEntry[] => (isCostClass(t.cls) && t.amount < 0 ? [{ id: t.id, date: t.date, category: t.cls, amount: -t.amount }] : []));
}

/** Running total at the end of each day of `month` (index 0 = day 1); days after `lastDay` are null. */
export function runningTotals(entries: readonly DailyEntry[], month: YearMonth, lastDay: number | null): (Money | null)[] {
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const byDate = new Map(dailyTotalsByDay(entries, month).map((d) => [d.date, d.total]));
  let sum = 0;
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    sum += byDate.get(`${month}-${String(day).padStart(2, '0')}`) ?? 0;
    return lastDay !== null && day > lastDay ? null : sum;
  });
}

export function spendingPoints(entries: readonly DailyEntry[], month: YearMonth, previous: YearMonth, today: number): SpendingPointVM[] {
  const now = runningTotals(entries, month, today);
  const before = runningTotals(entries, previous, null);
  return Array.from({ length: Math.max(now.length, before.length) }, (_, i) => ({ day: i + 1, thisMonth: now[i] ?? null, lastMonth: before[i] ?? null }));
}
