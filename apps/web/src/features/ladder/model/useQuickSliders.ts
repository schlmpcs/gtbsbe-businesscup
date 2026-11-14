// S7 Quick sliders: rent, car, childcare, food, subscriptions, other and savings (~30 s), with the
// month and the 10-year number updating live. Free text can fill them via /api/ai/parse.
import { COST_CATEGORIES, type Money, type Profile, type ProfilePatch, type Rate } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { displayForecast, thisMonth } from '@/lib/model/profile';
import { linearSliderVM, snap } from '@/lib/model/slider';
import { useParseConfirm, type ParseFn } from '@/lib/model/useParseConfirm';
import { useAppReady, useAppStore } from '@/state';
import { SAVINGS_SHARE_MAX, SAVINGS_SHARE_STEP, SLIDER_HEADROOM, SPENDING_SLIDERS } from './constants';
import type { ParsedRowVM, QuickSlidersVM, SpendingSliderVM } from './types';

/**
 * A parsed ProfilePatch as confirmation rows, in the parser's path order: spending categories,
 * then debt APR / extra payment, then the retirement share. Each row carries today's value and
 * whether the parser inferred it (paths from POST /api/ai/parse `inferred`).
 */
export function parsedRowsOf(patch: ProfilePatch, inferred: readonly string[], profile: Profile): ParsedRowVM[] {
  const isInferred = new Set(inferred);
  const rows: ParsedRowVM[] = [];
  for (const category of COST_CATEGORIES) {
    const value = patch.spending?.[category];
    if (value === undefined) continue;
    const path = `spending.${category}`;
    rows.push({
      path, target: { kind: 'spending', category }, value, unit: 'money',
      current: profile.spending[category].value, inferred: isInferred.has(path),
    });
  }
  patch.debts?.forEach((d, i) => {
    const debt = profile.debts.find((x) => x.id === d.id) ?? null;
    const debtKind = debt?.kind ?? null;
    if (d.apr !== undefined) {
      const path = `debts.${i}.apr`;
      rows.push({
        path, target: { kind: 'debtApr', debtId: d.id, debtKind }, value: d.apr, unit: 'rate',
        current: debt?.apr ?? null, inferred: isInferred.has(path),
      });
    }
    if (d.extraPayment !== undefined) {
      const path = `debts.${i}.extraPayment`;
      rows.push({
        path, target: { kind: 'debtExtraPayment', debtId: d.id, debtKind }, value: d.extraPayment, unit: 'money',
        current: debt?.extraPayment ?? null, inferred: isInferred.has(path),
      });
    }
  });
  if (patch.retirementShare !== undefined) {
    rows.push({
      path: 'retirementShare', target: { kind: 'retirementShare' }, value: patch.retirementShare, unit: 'rate',
      current: profile.retirementShare.value, inferred: isInferred.has('retirementShare'),
    });
  }
  return rows;
}

export function useQuickSliders(opts: { parse?: ParseFn } = {}): QuickSlidersVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const selfGuess = useAppStore((s) => s.selfGuess);
  const setSpendingAction = useAppStore((s) => s.setSpending);
  const setField = useAppStore((s) => s.setField);
  const applyUserPatch = useAppStore((s) => s.applyUserPatch);

  const sliders: SpendingSliderVM[] = useMemo(
    () =>
      SPENDING_SLIDERS.map(({ category, max, step }) => {
        const { value, isEstimate } = profile.spending[category];
        const top = Math.max(max, Math.ceil((value * SLIDER_HEADROOM) / step) * step);
        return { ...linearSliderVM(value, 0, top, step), category, isEstimate };
      }),
    [profile.spending],
  );

  const setSpending = useCallback(
    (category: SpendingSliderVM['category'], value: Money) => {
      const slider = sliders.find((s) => s.category === category);
      setSpendingAction(category, slider ? snap(value, 0, slider.max, slider.step) : Math.max(0, value));
    },
    [sliders, setSpendingAction],
  );

  const setSavingsShare = useCallback(
    (share: Rate) => setField('retirementShare', snap(share, 0, SAVINGS_SHARE_MAX, SAVINGS_SHARE_STEP)),
    [setField],
  );

  const month = useMemo(() => thisMonth(profile), [profile]);
  const in10y = useMemo(() => displayForecast(profile).in10y, [profile]);

  const parse = useParseConfirm('life', (patch: ProfilePatch) => applyUserPatch(patch), {
    parse: opts.parse,
    debts: profile.debts,
  });
  const { parsed, inferred } = parse;
  const parsedRows = useMemo(() => (parsed ? parsedRowsOf(parsed, inferred, profile) : []), [parsed, inferred, profile]);

  return {
    status: ready ? 'ready' : 'loading',
    sliders,
    savings: {
      ...linearSliderVM(profile.retirementShare.value, 0, Math.max(SAVINGS_SHARE_MAX, profile.retirementShare.value), SAVINGS_SHARE_STEP),
      isEstimate: profile.retirementShare.isEstimate,
    },
    month: {
      takeHome: { ...profile.takeHomePay },
      spending: month.spending,
      debtPayments: month.debtPayments,
      surplus: month.surplus,
    },
    monthlyCost: month.spending + month.debtPayments,
    selfGuess,
    in10y,
    setSpending,
    setSavingsShare,
    parse,
    parsedRows,
  };
}
