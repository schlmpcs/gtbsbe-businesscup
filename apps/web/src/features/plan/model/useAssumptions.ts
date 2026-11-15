// The assumptions panel: every PlanAssumptions field with its hint and source, per-group growth
// overrides (next to the default plan() uses), the withdrawal order and the savings split.
import {
  assumptionSource, cashYieldAnnual, inflationAnnualFallback, returnAnnualNominal, vehicleDepreciationAnnual,
} from '@lifeguessr/engine';
import { ASSET_GROUPS, type AccountGroup, type AreaData, type AssetGroup, type PlanAssumptions, type Rate, type Source } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { plan as copy } from '@/copy';
import { money, pct } from './planFormat';
import { calendarOf, usePlanInputs, yearAtAge, yearRangeOf } from './planInputs';
import { usePlanStore } from './planStore';
import { clampYear, movedEvent } from './usePlan';
import type { AssumptionFieldVM, AssumptionKey, AssumptionsVM, GrowthRowVM, PlanFieldValue } from './types';

export const RETIRE_AGE_RANGE = { min: 40, max: 80 } as const;
export const END_AGE_MAX = 110;

/**
 * The growth plan() uses for a group without an override (plan.ts groupGrowth): the engine's cash yield,
 * nominal return and car depreciation; real estate at the area's home appreciation, else inflation;
 * other assets at inflation.
 */
function growthDefaults(area: AreaData | undefined, inflation: Rate): Record<AssetGroup, { rate: Rate; source: Source }> {
  const assumed = (rate: Rate) => ({ rate, source: assumptionSource });
  return {
    cash: assumed(cashYieldAnnual.value),
    investments: assumed(returnAnnualNominal.value),
    retirement: assumed(returnAnnualNominal.value),
    realEstate: area?.homeAppreciationAnnual ? { rate: area.homeAppreciationAnnual.value, source: area.homeAppreciationAnnual.source } : assumed(inflation),
    vehicle: assumed(vehicleDepreciationAnnual.value),
    otherAsset: assumed(inflation),
  };
}

const num = (v: PlanFieldValue): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const SPLIT_TOLERANCE = 0.0001;

function fieldsOf(a: PlanAssumptions, area: AreaData | undefined): AssumptionFieldVM[] {
  const h = copy.assumptions.hints;
  const l = copy.assumptions.labels;
  const fields: AssumptionFieldVM[] = [
    { key: 'retireAge', kind: 'count', label: l.retireAge!, value: a.retireAge, display: String(a.retireAge), isEstimate: false, hint: h.retireAge, min: RETIRE_AGE_RANGE.min, max: RETIRE_AGE_RANGE.max },
    { key: 'endAge', kind: 'count', label: l.endAge!, value: a.endAge, display: String(a.endAge), isEstimate: false, hint: h.endAge, min: a.retireAge + 1, max: END_AGE_MAX },
    {
      key: 'inflation', kind: 'rate', label: l.inflation!, value: a.inflation, display: pct(a.inflation, 2),
      // Default is the area's CPI (BLS), else the engine's fallback; anything else is the person's own number.
      isEstimate: area ? a.inflation === area.cpiYoY.value && (area.cpiYoY.isEstimate ?? false) : a.inflation === inflationAnnualFallback.value,
      source: area?.cpiYoY.source ?? assumptionSource, hint: h.inflation, min: 0, max: 0.2,
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
  const inputs = usePlanInputs();
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
          const cal = calendarOf(inputs.profile);
          // The Retire event sits at the retirement age.
          edit(scenarioId, (s) => {
            const endAge = Math.max(s.assumptions.endAge, age + 1);
            return {
              ...s,
              assumptions: { ...s.assumptions, retireAge: age, endAge },
              events: s.events.map((e) => (e.type === 'retire' ? movedEvent(e, clampYear(yearAtAge(cal, age), yearRangeOf(cal, endAge))) : e)),
            };
          });
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
    [edit, patch, scenarioId, inputs.profile],
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
    const defaults = growthDefaults(inputs.area, a?.inflation ?? inflationAnnualFallback.value);
    const growth: GrowthRowVM[] = ASSET_GROUPS.map((group) => {
      const override = a?.growth[group] ?? null;
      const rate = override ?? defaults[group].rate;
      return {
        group, label: copy.groups[group], override, rate, rateLabel: pct(rate, 2), hint: copy.assumptions.growthHint(pct(defaults[group].rate, 2)),
        source: defaults[group].source,
      };
    });
    const errorMessage = error === 'savingsSplit' ? copy.assumptions.savingsSplitError : error === 'withdrawalOrder' ? copy.assumptions.withdrawalOrderError : null;
    return {
      fields: a ? fieldsOf(a, inputs.area) : [],
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
  }, [scenario, inputs.area, error, update, updateGrowth, setWithdrawalOrder, setSavingsSplit]);
}
