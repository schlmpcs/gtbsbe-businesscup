// The assumptions panel: every PlanAssumptions field with its hint and source, per-group growth
// overrides, the withdrawal order and the savings split. Fixture-backed (planStore.ts) until MP7b.
import { ASSET_GROUPS, type AccountGroup, type PlanAssumptions, type Rate } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { plan as copy } from '@/copy';
import { FIXTURE_AREA, yearAtAge } from './fixturePlan';
import { money, pct } from './planFormat';
import { usePlanStore } from './planStore';
import { clampYear, movedEvent } from './usePlan';
import type { AssumptionFieldVM, AssumptionKey, AssumptionsVM, GrowthRowVM, PlanFieldValue } from './types';

export const RETIRE_AGE_RANGE = { min: 40, max: 80 } as const;
export const END_AGE_MAX = 110;

/** Placeholder growth defaults per year until MP3's engine defaults land (real estate: the area's appreciation). */
const GROWTH_DEFAULTS: Record<(typeof ASSET_GROUPS)[number], Rate> = {
  cash: 0.01, investments: 0.06, retirement: 0.06, realEstate: FIXTURE_AREA.homeAppreciationAnnual?.value ?? 0.04, vehicle: -0.1, otherAsset: 0.02,
};

const num = (v: PlanFieldValue): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const SPLIT_TOLERANCE = 0.0001;

function fieldsOf(a: PlanAssumptions): AssumptionFieldVM[] {
  const h = copy.assumptions.hints;
  const l = copy.assumptions.labels;
  const fields: AssumptionFieldVM[] = [
    { key: 'retireAge', kind: 'count', label: l.retireAge!, value: a.retireAge, display: String(a.retireAge), isEstimate: false, hint: h.retireAge, min: RETIRE_AGE_RANGE.min, max: RETIRE_AGE_RANGE.max },
    { key: 'endAge', kind: 'count', label: l.endAge!, value: a.endAge, display: String(a.endAge), isEstimate: false, hint: h.endAge, min: a.retireAge + 1, max: END_AGE_MAX },
    {
      key: 'inflation', kind: 'rate', label: l.inflation!, value: a.inflation, display: pct(a.inflation, 2),
      // Default is the area's CPI; anything else is the person's own number.
      isEstimate: a.inflation === FIXTURE_AREA.cpiYoY.value && (FIXTURE_AREA.cpiYoY.isEstimate ?? false),
      source: FIXTURE_AREA.cpiYoY.source, hint: h.inflation, min: 0, max: 0.2,
    },
    {
      key: 'display', kind: 'choice', label: l.display!, value: a.display, display: copy.display[a.display], isEstimate: false,
      options: [{ value: 'today', label: copy.display.today }, { value: 'future', label: copy.display.future }],
    },
    {
      key: 'expensesMode', kind: 'choice', label: l.expensesMode!, value: a.expenses.mode, display: copy.assumptions.expensesMode[a.expenses.mode], isEstimate: false, hint: h.expensesMode,
      options: [{ value: 'budget', label: copy.assumptions.expensesMode.budget }, { value: 'manual', label: copy.assumptions.expensesMode.manual }],
    },
  ];
  if (a.expenses.mode === 'manual') {
    fields.push({ key: 'expensesMonthly', kind: 'money', label: l.expensesMonthly!, value: a.expenses.monthly, display: money(a.expenses.monthly), isEstimate: false, min: 0 });
  }
  return fields;
}

export function useAssumptions(): AssumptionsVM {
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const edit = usePlanStore((s) => s.edit);
  const [error, setError] = useState<AssumptionsVM['error']>(null);
  const scenarioId = scenario?.id;

  const patch = useCallback(
    (fn: (a: PlanAssumptions) => PlanAssumptions) => {
      if (scenarioId) edit(scenarioId, (s) => ({ ...s, assumptions: fn(s.assumptions) }));
    },
    [edit, scenarioId],
  );

  const update = useCallback(
    (key: AssumptionKey, value: PlanFieldValue) => {
      const n = num(value);
      switch (key) {
        case 'retireAge': {
          if (n === null) return;
          const age = Math.round(Math.min(RETIRE_AGE_RANGE.max, Math.max(RETIRE_AGE_RANGE.min, n)));
          if (!scenarioId) return;
          // The Retire event sits at the retirement age.
          edit(scenarioId, (s) => ({
            ...s,
            assumptions: { ...s.assumptions, retireAge: age, endAge: Math.max(s.assumptions.endAge, age + 1) },
            events: s.events.map((e) => (e.type === 'retire' ? movedEvent(e, clampYear(yearAtAge(age))) : e)),
          }));
          return;
        }
        case 'endAge':
          if (n !== null) patch((a) => ({ ...a, endAge: Math.round(Math.min(END_AGE_MAX, Math.max(a.retireAge + 1, n))) }));
          return;
        case 'inflation':
          if (n !== null) patch((a) => ({ ...a, inflation: Math.min(0.2, Math.max(0, n)) }));
          return;
        case 'display':
          if (value === 'today' || value === 'future') patch((a) => ({ ...a, display: value }));
          return;
        case 'expensesMode':
          if (value === 'budget') patch((a) => ({ ...a, expenses: { mode: 'budget' } }));
          else if (value === 'manual') patch((a) => ({ ...a, expenses: { mode: 'manual', monthly: a.expenses.mode === 'manual' ? a.expenses.monthly : 0 } }));
          return;
        case 'expensesMonthly':
          if (n !== null) patch((a) => ({ ...a, expenses: { mode: 'manual', monthly: Math.max(0, n) } }));
          return;
      }
    },
    [edit, patch, scenarioId],
  );

  const updateGrowth = useCallback(
    (group: AccountGroup, rate: Rate | null) => {
      patch((a) => {
        const { [group]: _dropped, ...rest } = a.growth;
        return { ...a, growth: rate === null || !Number.isFinite(rate) ? rest : { ...rest, [group]: rate } };
      });
    },
    [patch],
  );

  const setWithdrawalOrder = useCallback(
    (order: AccountGroup[]): boolean => {
      const current = scenario?.assumptions.withdrawalOrder ?? [];
      const ok = order.length === current.length && new Set(order).size === order.length && order.every((g) => current.includes(g));
      setError(ok ? null : 'withdrawalOrder');
      if (ok) patch((a) => ({ ...a, withdrawalOrder: [...order] }));
      return ok;
    },
    [scenario, patch],
  );

  const setSavingsSplit = useCallback(
    (split: { group: AccountGroup; share: Rate }[]): boolean => {
      const sum = split.reduce((s, x) => s + x.share, 0);
      const ok = split.length > 0 && split.every((x) => Number.isFinite(x.share) && x.share >= 0) && Math.abs(sum - 1) <= SPLIT_TOLERANCE;
      setError(ok ? null : 'savingsSplit');
      if (ok) patch((a) => ({ ...a, savingsSplit: split.map((x) => ({ ...x })) }));
      return ok;
    },
    [patch],
  );

  return useMemo((): AssumptionsVM => {
    const a = scenario?.assumptions;
    const growth: GrowthRowVM[] = ASSET_GROUPS.map((group) => {
      const override = a?.growth[group] ?? null;
      const rate = override ?? GROWTH_DEFAULTS[group];
      return {
        group, label: copy.groups[group], override, rate, rateLabel: pct(rate, 2), hint: copy.assumptions.growthHint(pct(GROWTH_DEFAULTS[group], 2)),
        ...(group === 'realEstate' && FIXTURE_AREA.homeAppreciationAnnual ? { source: FIXTURE_AREA.homeAppreciationAnnual.source } : {}),
      };
    });
    const errorMessage = error === 'savingsSplit' ? copy.assumptions.savingsSplitError : error === 'withdrawalOrder' ? copy.assumptions.withdrawalOrderError : null;
    return {
      fields: a ? fieldsOf(a) : [],
      growth,
      withdrawalOrder: (a?.withdrawalOrder ?? []).map((group) => ({ group, label: copy.groups[group] })),
      savingsSplit: (a?.savingsSplit ?? []).map((x) => ({ group: x.group, label: copy.groups[x.group], share: x.share, shareLabel: pct(x.share, 0) })),
      error,
      errorMessage,
      update,
      updateGrowth,
      setWithdrawalOrder,
      setSavingsSplit,
    };
  }, [scenario, error, update, updateGrowth, setWithdrawalOrder, setSavingsSplit]);
}
