// The assumptions panel: every PlanAssumptions field with its hint and source, per-group growth
// overrides, the withdrawal order and the savings split. The growth defaults are the engine's (the
// ones plan() uses when there is no override); sources come from the area data of the profile's ZIP.
//
// "Estimate with AI" (growthAi): the AI PROPOSES a yearly rate per group (/api/ai/growth, checked there
// and again here against aiGrowthEnvelope). A proposal sits next to the sourced default until the person
// applies it; an applied one is an ordinary override plus an AI note (label + reason) in
// `assumptions.growthNotes`. plan() and monteCarlo() do every projection with whichever rate is in use.
import {
  cashYieldAnnual, growthEstimateIssues, profileToAccounts, returnAnnualNominal, vehicleDepreciationAnnual,
} from '@lifeguessr/engine';
import {
  ASSET_GROUPS, type AccountGroup, type AiGrowthNote, type AreaData, type AssetGroup, type GrowthEstimate,
  type GrowthEstimateRequest, type PlanAssumptions, type Rate,
} from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plan as copy } from '@/copy';
import { estimateGrowth } from '@/lib/api/aiGrowth';
import { ApiError } from '@/lib/api/http';
import { getAnonId } from '@/state/anonId';
import { calendarOf, clampYearTo, usePlanInputs, yearAt, type PlanInputs } from './planEngine';
import { money, pct } from './planFormat';
import { usePlanStore } from './planStore';
import { movedEvent } from './usePlan';
import type { AssumptionFieldVM, AssumptionKey, AssumptionsVM, GrowthAiVM, GrowthRowVM, PlanFieldValue } from './types';

export const RETIRE_AGE_RANGE = { min: 40, max: 80 } as const;
export const END_AGE_MAX = 110;

/** plan()'s growth per group when nothing overrides it (packages/engine/plan.ts → groupGrowth). */
export function growthDefaults(area: AreaData | undefined, inflation: Rate): Record<(typeof ASSET_GROUPS)[number], Rate> {
  return {
    cash: cashYieldAnnual.value,
    investments: returnAnnualNominal.value,
    retirement: returnAnnualNominal.value,
    realEstate: area?.homeAppreciationAnnual?.value ?? inflation,
    vehicle: vehicleDepreciationAnnual.value,
    otherAsset: inflation,
  };
}

/** What "Estimate with AI" knows: the request's state and the suggestions that passed the envelope. */
type GrowthAiState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; suggestions: Partial<Record<AssetGroup, GrowthEstimate>>; rejected: AssetGroup[] }
  | { status: 'error'; error: keyof typeof copy.assumptions.growthAiError };

const isAssetGroup = (g: AccountGroup): g is AssetGroup => (ASSET_GROUPS as readonly string[]).includes(g);

/**
 * The plan request: the area (metro and state, no ZIP), totals by asset group (no names, no ids) and the
 * defaults plan() uses today. Without stored accounts plan() reads the profile's balances, so do we.
 */
export function growthAiRequest(inputs: PlanInputs, defaults: Record<AssetGroup, Rate>): GrowthEstimateRequest {
  const accounts = inputs.accounts.length > 0 ? inputs.accounts : profileToAccounts(inputs.profile);
  const groups = ASSET_GROUPS.flatMap((group) => {
    const held = accounts.filter((a) => a.group === group && !a.excluded);
    return held.length === 0 ? [] : [{ group, count: held.length, total: held.reduce((sum, a) => sum + a.balance.value, 0) }];
  });
  return {
    mode: 'plan',
    ...(inputs.area && { area: { metro: inputs.area.metro, state: inputs.area.state } }),
    groups,
    defaults,
  };
}

function growthAiError(err: unknown): keyof typeof copy.assumptions.growthAiError {
  if (err instanceof ApiError && (err.code === 'unavailable' || err.status === 503)) return 'unavailable';
  if (err instanceof ApiError && (err.code === 'rate_limited' || err.status === 429)) return 'rateLimited';
  return 'failed';
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
      // The area's CPI is the reference; it is an estimate only when the pipeline marked it so.
      isEstimate: area !== undefined && a.inflation === area.cpiYoY.value && (area.cpiYoY.isEstimate ?? false),
      ...(area && { source: area.cpiYoY.source }), hint: h.inflation, min: 0, max: 0.2,
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
  const inputs = usePlanInputs();
  const endAge = scenario?.assumptions.endAge ?? 0;
  const cal = useMemo(() => calendarOf(inputs.profile, endAge), [inputs.profile, endAge]);

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
            events: s.events.map((e) => (e.type === 'retire' ? movedEvent(e, clampYearTo(calendarOf(inputs.profile, Math.max(s.assumptions.endAge, age + 1)), yearAt(cal, age))) : e)),
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
    [edit, patch, scenarioId, inputs.profile, cal],
  );

  /** Sets (or clears) a group's override. `note` marks it as an applied AI estimate; without one any old note is dropped. */
  const setGrowth = useCallback(
    (group: AccountGroup, rate: Rate | null, note?: AiGrowthNote) => {
      patch((a) => {
        const { [group]: _dropped, ...rest } = a.growth;
        const growth: PlanAssumptions['growth'] = rate === null || !Number.isFinite(rate) ? rest : { ...rest, [group]: rate };
        const { growthNotes, ...base } = a;
        const { [group as AssetGroup]: _oldNote, ...otherNotes }: NonNullable<PlanAssumptions['growthNotes']> = growthNotes ?? {};
        const notes = note && isAssetGroup(group) && growth[group] !== undefined ? { ...otherNotes, [group]: note } : otherNotes;
        return { ...base, growth, ...(Object.keys(notes).length > 0 && { growthNotes: notes }) };
      });
    },
    [patch],
  );
  const updateGrowth = useCallback((group: AccountGroup, rate: Rate | null) => setGrowth(group, rate), [setGrowth]);

  // ----- "Estimate with AI" ----------------------------------------------------------------------
  const [ai, setAi] = useState<GrowthAiState>({ status: 'idle' });
  const aiAbort = useRef<AbortController | null>(null);
  useEffect(() => () => aiAbort.current?.abort(), []);
  const inflation = scenario?.assumptions.inflation ?? 0;

  const askAi = useCallback(() => {
    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    setAi({ status: 'loading' });
    const req = growthAiRequest(inputs, growthDefaults(inputs.area, inflation));
    estimateGrowth(req, { anonId: getAnonId(), signal: controller.signal }).then(
      (res) => {
        if (controller.signal.aborted) return;
        // Checked again here: only a rate inside its group's envelope may ever be offered.
        const suggestions: Partial<Record<AssetGroup, GrowthEstimate>> = {};
        const rejected = [...res.rejected];
        for (const e of res.estimates) {
          if (growthEstimateIssues(e.group, e.rate).length === 0) suggestions[e.group] = e;
          else rejected.push(e.group);
        }
        setAi(Object.keys(suggestions).length > 0 ? { status: 'ready', suggestions, rejected } : { status: 'error', error: 'failed' });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setAi({ status: 'error', error: growthAiError(err) });
      },
    );
  }, [inputs, inflation]);

  const applyGrowthSuggestion = useCallback(
    (group: AccountGroup) => {
      if (ai.status !== 'ready' || !isAssetGroup(group)) return;
      const s = ai.suggestions[group];
      if (s) setGrowth(group, s.rate, { source: 'ai', reason: s.reason });
    },
    [ai, setGrowth],
  );
  const applyAllSuggestions = useCallback(() => {
    if (ai.status !== 'ready') return;
    for (const s of Object.values(ai.suggestions)) if (s) setGrowth(s.group, s.rate, { source: 'ai', reason: s.reason });
  }, [ai, setGrowth]);

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
    const area = inputs.area;
    const defaults = growthDefaults(area, a?.inflation ?? 0);
    const suggestions = ai.status === 'ready' ? ai.suggestions : {};
    const growth: GrowthRowVM[] = ASSET_GROUPS.map((group) => {
      const override = a?.growth[group] ?? null;
      const rate = override ?? defaults[group];
      const note = override !== null ? a?.growthNotes?.[group] : undefined;
      const s = suggestions[group];
      return {
        group, label: copy.groups[group], override, rate, rateLabel: pct(rate, 2), hint: copy.assumptions.growthHint(pct(defaults[group], 2)),
        ...(group === 'realEstate' && area?.homeAppreciationAnnual ? { source: area.homeAppreciationAnnual.source } : {}),
        ...(s && { suggestion: { rate: s.rate, rateLabel: pct(s.rate, 2), reason: s.reason, applied: note !== undefined && override === s.rate } }),
        ...(note && { aiNote: { reason: note.reason } }),
      };
    });
    const growthAi: GrowthAiVM = {
      status: ai.status,
      message:
        ai.status === 'error' ? copy.assumptions.growthAiError[ai.error]
        : ai.status === 'ready' && ai.rejected.length > 0 ? copy.assumptions.growthAiRejected(ai.rejected.map((g) => copy.groups[g]).join(', '))
        : null,
      canApplyAll: growth.some((g) => g.suggestion !== undefined && !g.suggestion.applied),
      ask: askAi,
      applyAll: applyAllSuggestions,
    };
    const errorMessage = error === 'savingsSplit' ? copy.assumptions.savingsSplitError : error === 'withdrawalOrder' ? copy.assumptions.withdrawalOrderError : null;
    return {
      fields: a ? fieldsOf(a, area) : [],
      growth,
      withdrawalOrder: (a?.withdrawalOrder ?? []).map((group) => ({ group, label: copy.groups[group] })),
      savingsSplit: (a?.savingsSplit ?? []).map((x) => ({ group: x.group, label: copy.groups[x.group], share: x.share, shareLabel: pct(x.share, 0) })),
      error,
      errorMessage,
      update,
      updateGrowth,
      growthAi,
      applyGrowthSuggestion,
      setWithdrawalOrder,
      setSavingsSplit,
    };
  }, [scenario, inputs.area, error, update, updateGrowth, ai, askAi, applyAllSuggestions, applyGrowthSuggestion, setWithdrawalOrder, setSavingsSplit]);
}
