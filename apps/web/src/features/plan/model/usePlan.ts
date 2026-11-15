// /plan page: the KPI cards, the net worth chart with event markers, the three tables, the display unit
// and the autosave indicator. Every number is the engine's plan() of the active scenario on the person's
// profile, accounts and area (planEngine.ts); this hook only picks values out and formats them.
import type { PlanEvent } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { accountLabel, ageAt, calendarOf, clampYearTo, EVENT_ICONS, NO_MOVES, planOf, usePlanInputs, yearAt } from './planEngine';
import { eventSummary, iconOf, kpiVMs, money } from './planFormat';
import { usePlanStore } from './planStore';
import type {
  PlanAccountsTableVM, PlanCashFlowTableVM, PlanChartVM, PlanDisplay, PlanEventRowVM, PlanVM,
} from './types';

/** `e` moved to `year`; an end year that would come before the start moves with it. */
export function movedEvent(e: PlanEvent, year: number): PlanEvent {
  const moved = { ...e, year } as PlanEvent;
  if ('endYear' in moved && moved.endYear !== undefined && moved.endYear <= year) {
    (moved as { endYear: number }).endYear = e.type === 'careerBreak' ? year + 1 : year;
  }
  return moved;
}

export function usePlan(scenarioId: string): PlanVM {
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === scenarioId));
  const saveState = usePlanStore((s) => s.saveState);
  const moves = usePlanStore((s) => s.movesApplied[scenarioId] ?? NO_MOVES);
  const edit = usePlanStore((s) => s.edit);
  const inputs = usePlanInputs();
  const endAge = scenario?.assumptions.endAge ?? 0;
  const cal = useMemo(() => calendarOf(inputs.profile, endAge), [inputs.profile, endAge]);

  const setDisplay = useCallback(
    (display: PlanDisplay) => edit(scenarioId, (s) => ({ ...s, assumptions: { ...s.assumptions, display } })),
    [edit, scenarioId],
  );
  const moveEvent = useCallback(
    (id: string, year: number) => {
      const y = clampYearTo(cal, year);
      edit(scenarioId, (s) => ({
        ...s,
        assumptions: s.events.some((e) => e.id === id && e.type === 'retire')
          ? { ...s.assumptions, retireAge: ageAt(cal, y) }
          : s.assumptions,
        events: s.events.map((e) => (e.id === id ? movedEvent(e, y) : e)),
      }));
    },
    [edit, scenarioId, cal],
  );

  return useMemo((): PlanVM => {
    if (!scenario) return { status: 'notFound', disclaimer: copy.disclaimer };
    const result = planOf(inputs, scenario, moves);
    const { years } = result;
    const retireYear = yearAt(cal, result.kpis.retireAge);
    const ageAtYear = (year: number) => ageAt(cal, year);

    const chart: PlanChartVM = {
      points: years.map((y) => ({ year: y.year, age: y.age, netWorth: y.netWorth, netWorthLabel: money(y.netWorth), belowZero: y.netWorth < 0 })),
      markers: scenario.events.map((e) => ({
        id: e.id, year: e.year, age: ageAtYear(e.year), icon: EVENT_ICONS[e.type], label: copy.events[e.type].title, enabled: e.enabled,
      })),
      xTicks: years.filter((y, i) => i === 0 || y.age % 5 === 0).map((y) => ({ year: y.year, age: y.age, label: String(y.year) })),
      yDomain: [Math.min(...years.map((y) => y.netWorth)), Math.max(...years.map((y) => y.netWorth))],
      retireYear,
      yearRange: { min: cal.firstYear, max: cal.lastYear },
    };

    const columnIds: string[] = [];
    for (const y of years) for (const a of y.accounts) if (!columnIds.includes(a.accountId)) columnIds.push(a.accountId);
    const columns: PlanAccountsTableVM['columns'] = columnIds.map((accountId) => {
      const { name, group } = accountLabel(accountId, inputs, scenario);
      return { accountId, name, group, groupLabel: copy.groups[group] };
    });
    const accounts: PlanAccountsTableVM = {
      columns,
      rows: years.map((y) => ({
        year: y.year,
        age: y.age,
        isRetirementYear: y.year === retireYear,
        netWorthLabel: money(y.netWorth),
        cells: Object.fromEntries(
          y.accounts.map((a) => [a.accountId, {
            start: money(a.start), growth: money(a.growth), deposits: money(a.deposits), withdrawals: money(a.withdrawals), end: money(a.end),
          }]),
        ),
      })),
    };

    const line = (l: { key: string; amount: number }) => ({ key: l.key, label: copy.tables.cashFlow.lines[l.key] ?? l.key, amountLabel: money(l.amount) });
    const cashFlow: PlanCashFlowTableVM = {
      rows: years.map((y) => {
        const income = y.cashFlow.income.reduce((s, l) => s + l.amount, 0);
        const expenses = y.cashFlow.expenses.reduce((s, l) => s + l.amount, 0);
        return {
          year: y.year,
          age: y.age,
          incomeLabel: money(income),
          expensesLabel: money(expenses),
          withdrawalsLabel: money(y.cashFlow.withdrawals),
          netLabel: money(y.cashFlow.net),
          netTone: y.cashFlow.net >= 0 ? 'good' : 'bad',
          incomeLines: y.cashFlow.income.map(line),
          expenseLines: y.cashFlow.expenses.map(line),
        };
      }),
    };

    const events: PlanEventRowVM[] = [...scenario.events]
      .sort((a, b) => a.year - b.year)
      .map((e) => ({
        id: e.id, type: e.type, icon: iconOf(e), title: copy.events[e.type].title, ...(e.name ? { name: e.name } : {}),
        year: e.year, age: ageAtYear(e.year), summary: eventSummary(e), enabled: e.enabled,
      }));

    const display = scenario.assumptions.display;
    return {
      status: 'ready',
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      kpis: kpiVMs(result.kpis, scenario.assumptions.endAge),
      chart,
      tables: { accounts, cashFlow, events },
      display: {
        value: display,
        label: copy.display[display],
        options: [{ value: 'today', label: copy.display.today }, { value: 'future', label: copy.display.future }],
      },
      saveState,
      saveLabel: copy.saveState[saveState],
      disclaimer: copy.disclaimer,
      setDisplay,
      moveEvent,
    };
  }, [scenario, moves, inputs, cal, saveState, setDisplay, moveEvent]);
}
