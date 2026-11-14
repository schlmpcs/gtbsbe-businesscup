// "How we calculate" (S10): the engine assumptions behind the forecast and Next Moves, each with
// its Source or its assumption flag (packages/engine/assumptions.ts). The UI maps `id` to copy and
// formats `value` by its kind; every value here is read from the engine, none is typed in.
import {
  cancelSubscriptionsShare, cardAprDefault, cardMinPayment, cashYieldAnnual, cutCategoryShare, estimateSpread,
  incomeGrowthAnnual, inflationAnnualFallback, payCardExtraShareOfSurplus, payCardExtraStep, retirementShareDefault,
  returnAnnualNominal,
} from '@lifeguessr/engine';
import type { Profile, Source } from '@lifeguessr/types';
import { areaForZip } from '@/lib/areas';
import type { AssumptionVM, AssumptionValue, HowWeCalculateVM } from './types';

function entry(
  id: AssumptionVM['id'],
  value: AssumptionValue,
  a: { source?: Source; assumption?: boolean },
): AssumptionVM {
  return { id, value, source: a.source ?? null, isAssumption: a.assumption === true };
}

/**
 * The assumptions S10 lists, in reading order. Inflation is the profile's area CPI (sourced) when
 * we have data for its ZIP, otherwise the engine's fallback (an assumption).
 */
export function howWeCalculate(p: Pick<Profile, 'zip'>): HowWeCalculateVM {
  const area = areaForZip(p.zip);
  const inflation = area
    ? entry('inflation', { kind: 'ratePerYear', value: area.cpiYoY.value }, { source: area.cpiYoY.source, assumption: area.cpiYoY.isEstimate === true })
    : entry('inflation', { kind: 'ratePerYear', value: inflationAnnualFallback.value }, inflationAnnualFallback);

  return {
    forecast: [
      inflation,
      entry('incomeGrowth', { kind: 'sameAsInflation' }, incomeGrowthAnnual),
      entry('returnAnnualNominal', { kind: 'ratePerYear', value: returnAnnualNominal.value }, returnAnnualNominal),
      entry('cashYieldAnnual', { kind: 'ratePerYear', value: cashYieldAnnual.value }, cashYieldAnnual),
      entry('cardAprDefault', { kind: 'ratePerYear', value: cardAprDefault.value }, cardAprDefault),
      entry(
        'cardMinPayment',
        { kind: 'cardMinPayment', balanceShare: cardMinPayment.value.balanceShare, floor: cardMinPayment.value.floor },
        cardMinPayment,
      ),
      entry('retirementShareDefault', { kind: 'share', value: retirementShareDefault.value }, retirementShareDefault),
      entry('estimateSpread', { kind: 'spread', value: estimateSpread.value }, estimateSpread),
    ],
    moves: [
      entry('payCardExtraShareOfSurplus', { kind: 'share', value: payCardExtraShareOfSurplus.value }, payCardExtraShareOfSurplus),
      entry('payCardExtraStep', { kind: 'money', value: payCardExtraStep.value }, payCardExtraStep),
      entry('cutCategoryShare', { kind: 'share', value: cutCategoryShare.value }, cutCategoryShare),
      entry('cancelSubscriptionsShare', { kind: 'share', value: cancelSubscriptionsShare.value }, cancelSubscriptionsShare),
    ],
  };
}
