// S7 Quick sliders: rent, car, childcare, food, subscriptions, other and savings (~30 s), with the
// month and the 10-year number updating live. Free text can fill them via /api/ai/parse.
import type { Money, ProfilePatch, Rate } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { displayForecast, thisMonth } from '@/lib/model/profile';
import { linearSliderVM, snap } from '@/lib/model/slider';
import { useParseConfirm, type ParseFn } from '@/lib/model/useParseConfirm';
import { useAppReady, useAppStore } from '@/state';
import { SAVINGS_SHARE_MAX, SAVINGS_SHARE_STEP, SLIDER_HEADROOM, SPENDING_SLIDERS } from './constants';
import type { QuickSlidersVM, SpendingSliderVM } from './types';

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
  };
}
