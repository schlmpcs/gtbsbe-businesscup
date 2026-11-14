// Ladder progress for every rung (S5–S9): which rungs are done, and how far the user's real
// numbers have narrowed the 10-year range band. The band comes from the engine forecast: it is
// built from the estimated inputs only, so it shrinks as estimates become measured values.
import { COST_CATEGORIES, type Estimate, type Profile } from '@lifeguessr/types';
import { useMemo } from 'react';
import { displayForecast, estimatedFields } from '@/lib/model/profile';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, type AppData } from '@/state';
import { SPENDING_SLIDERS } from './constants';
import type { LadderProgressVM, LadderRungVM, LadderScreen } from './types';

const LADDER: readonly LadderScreen[] = ['S5', 'S6', 'S7', 'S8', 'S9'];
const SCALAR_INPUTS = ['age', 'takeHomePay', 'cash', 'retirement', 'retirementShare'] as const;
const BALANCE_INPUTS = ['age', 'takeHomePay', 'cash', 'retirement'] as const;

const measured = (e: Estimate<unknown>) => !e.isEstimate;

/** The same profile with every input marked as an estimate: the widest band for these values. */
export function allEstimated(p: Profile): Profile {
  const est = <T>(e: Estimate<T>): Estimate<T> => ({ value: e.value, isEstimate: true });
  return {
    ...p,
    age: est(p.age),
    takeHomePay: est(p.takeHomePay),
    cash: est(p.cash),
    retirement: est(p.retirement),
    retirementShare: est(p.retirementShare),
    spending: Object.fromEntries(COST_CATEGORIES.map((c) => [c, est(p.spending[c])])) as Profile['spending'],
    debts: p.debts.map((d) => ({ ...d, minPayment: est(d.minPayment) })),
  };
}

/** Inputs the forecast reads (the ones `estimatedFields` can list). */
export function forecastInputCount(p: Profile): number {
  return SCALAR_INPUTS.length + COST_CATEGORIES.filter((c) => c !== 'debtPayments').length + p.debts.length;
}

type ProgressData = Pick<AppData, 'profile' | 'profileOrigin' | 'selfGuess' | 'closestCardId' | 'statementMonths'>;

/** Which rungs are done (see LadderRungVM.done). The demo profile's values are a sample, not the user's. */
export function rungsDone(s: ProgressData): Record<LadderScreen, boolean> {
  const own = s.profileOrigin !== 'demo';
  const p = s.profile;
  return {
    S5: s.selfGuess !== null,
    S6: s.closestCardId !== null,
    S7: own && (SPENDING_SLIDERS.some(({ category }) => measured(p.spending[category])) || measured(p.retirementShare)),
    S8: own && (BALANCE_INPUTS.some((f) => measured(p[f])) || p.debts.some((d) => measured(d.minPayment))),
    S9: s.statementMonths.length > 0,
  };
}

export function buildLadderProgress(s: ProgressData): Omit<LadderProgressVM, 'status'> {
  const done = rungsDone(s);
  const rungs: LadderRungVM[] = LADDER.map((screen) => ({ screen, href: SCREEN_ROUTES[screen], done: done[screen] }));
  const { in10y } = displayForecast(s.profile);
  const bandWidth = in10y.high - in10y.low;
  const start = displayForecast(allEstimated(s.profile)).in10y;
  const bandWidthAllEstimated = start.high - start.low;
  const left = estimatedFields(s.profile).length;
  const bandNarrowed =
    bandWidthAllEstimated > 0 ? Math.min(1, Math.max(0, 1 - bandWidth / bandWidthAllEstimated)) : left === 0 ? 1 : 0;
  return {
    rungs,
    doneCount: rungs.filter((r) => r.done).length,
    in10y,
    bandWidth,
    bandWidthAllEstimated,
    bandNarrowed,
    estimates: { left, total: forecastInputCount(s.profile) },
    futureHref: SCREEN_ROUTES.S10,
  };
}

export function useLadderProgress(): LadderProgressVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const selfGuess = useAppStore((s) => s.selfGuess);
  const closestCardId = useAppStore((s) => s.closestCardId);
  const statementMonths = useAppStore((s) => s.statementMonths);

  const progress = useMemo(
    () => buildLadderProgress({ profile, profileOrigin, selfGuess, closestCardId, statementMonths }),
    [profile, profileOrigin, selfGuess, closestCardId, statementMonths],
  );

  return { status: ready ? 'ready' : 'loading', ...progress };
}
