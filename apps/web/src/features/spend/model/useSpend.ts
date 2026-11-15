// /spend: this month's daily log grouped by day, totals by category, the month so far and the
// quick-add. Sums come from the engine (dailyMonthToDate, dailyTotalsByDay); see ./summary.ts.
import { dailyMonthToDate, dailyTotalsByDay } from '@lifeguessr/engine';
import { SPEND_ITEM_CATEGORIES } from '@lifeguessr/types';
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { entriesInMonth, useAppReady, useAppStore } from '@/state';
import { spendSummary } from './summary';
import type { SpendChartDayVM, SpendDayVM, SpendSummaryVM, SpendVM } from './types';
import { useQuickAdd, type SpendParseFn } from './useQuickAdd';

export function useSpend(opts: { now?: Date; parse?: SpendParseFn } = {}): SpendVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const entries = useAppStore((s) => s.dailyEntries);
  const removeDailyEntries = useAppStore((s) => s.removeDailyEntries);
  const { now } = opts;
  const quickAdd = useQuickAdd({ ready, now, parse: opts.parse });

  const today = useMemo(() => localMonthDay(now), [now]);
  const summary = useMemo(
    () => (ready ? spendSummary(profile, statementMonths, entries, today) : ({ status: 'loading' } as const)),
    [ready, profile, statementMonths, entries, today],
  );

  const { days, byCategory } = useMemo(() => {
    const inMonth = entriesInMonth(entries, today.month);
    let dayTotals: { date: string; total: number }[] = [];
    let totals: Record<string, number> = {};
    try {
      dayTotals = dailyTotalsByDay(inMonth, today.month);
      totals = dailyMonthToDate(inMonth, today.month, today.day).totals;
    } catch {
      // Store entries are schema-checked; an engine error here would mean a broken month string.
    }
    const days: SpendDayVM[] = dayTotals.map(({ date, total }) => ({
      date,
      day: Number(date.slice(8)),
      total,
      entries: inMonth
        .filter((e) => e.date === date)
        .map((e) => ({ id: e.id, category: e.category, amount: e.amount, ...(e.label ? { label: e.label } : {}) })),
    }));
    const sum = SPEND_ITEM_CATEGORIES.reduce((s, c) => s + (totals[c] ?? 0), 0);
    const byCategory = SPEND_ITEM_CATEGORIES.map((category) => ({ category, amount: totals[category] ?? 0 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, share: sum > 0 ? c.amount / sum : 0 }));
    return { days, byCategory };
  }, [entries, today]);

  const { chart, chartMax } = useMemo(
    () => (summary.status === 'ready' ? spendChart(summary.data, days) : { chart: [], chartMax: 0 }),
    [summary, days],
  );

  return {
    status: ready ? 'ready' : 'loading',
    summary,
    days: ready ? days : [],
    chart: ready ? chart : [],
    chartMax: ready ? chartMax : 0,
    byCategory: ready ? byCategory : [],
    remove: (id) => removeDailyEntries([id]),
    quickAdd,
  };
}

/** Every day of the month as a bar (days without entries are 0), flagged against the usual pace. */
export function spendChart(
  summary: Pick<SpendSummaryVM, 'day' | 'daysInMonth' | 'pacePerDay'>,
  days: readonly Pick<SpendDayVM, 'day' | 'total'>[],
): { chart: SpendChartDayVM[]; chartMax: number } {
  const byDay = new Map(days.map((d) => [d.day, d.total]));
  const chart = Array.from({ length: summary.daysInMonth }, (_, i): SpendChartDayVM => {
    const day = i + 1;
    const total = day > summary.day ? 0 : (byDay.get(day) ?? 0);
    return { day, total, overPace: total > summary.pacePerDay, isToday: day === summary.day, isFuture: day > summary.day };
  });
  return { chart, chartMax: Math.max(summary.pacePerDay, ...chart.map((d) => d.total)) };
}
