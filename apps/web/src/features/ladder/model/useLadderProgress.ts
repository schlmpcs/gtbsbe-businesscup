// Ladder progress for every rung (S5–S9): which rungs are done, and how far the user's real
// numbers have narrowed the 10-year range band. The band comes from the engine forecast: it is
// built from the estimated inputs only, so it shrinks as estimates become measured values.
import { cardToProfile } from '@lifeguessr/engine';
import { COST_CATEGORIES, type Debt, type Estimate, type LifeCard, type Profile } from '@lifeguessr/types';
import { useMemo } from 'react';
import { profileDemo } from '@/fixtures';
import { cardsSample } from '@/fixtures/cards';
import { areaForZip } from '@/lib/areas';
import { displayForecast, estimatedFields } from '@/lib/model/profile';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, useProfile, useGameStore, type AppData } from '@/state';
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

type ProgressData = Pick<AppData, 'profile' | 'profileOrigin' | 'selfGuess' | 'closestCardId' | 'statementMonths'> & {
  /**
   * The debts the profile started with: the picked life card's (cardToProfile) or the demo
   * profile's. null when the picked card can't be rebuilt (no area data): debts then don't count.
   */
  startDebts: readonly Debt[] | null;
};

/** The debts the profile started from (see ProgressData.startDebts). */
export function startingDebts(closestCardId: string | null, cards: readonly LifeCard[]): readonly Debt[] | null {
  if (closestCardId === null) return profileDemo.debts;
  const card = cards.find((c) => c.id === closestCardId);
  const area = card ? areaForZip(card.zip) : null;
  return card && area ? cardToProfile(card, area).debts : null;
}

const sameDebt = (a: Debt, b: Debt) =>
  a.kind === b.kind && a.balance === b.balance && a.apr === b.apr && a.minPayment.value === b.minPayment.value;

/** The user added, removed or edited a debt since the starting profile. */
export function debtsChanged(start: readonly Debt[] | null, debts: readonly Debt[]): boolean {
  if (start === null) return false;
  if (start.length !== debts.length) return true;
  return debts.some((d) => {
    const s = start.find((x) => x.id === d.id);
    return !s || !sameDebt(s, d);
  });
}

/** Which rungs are done (see LadderRungVM.done). The demo profile's values are a sample, not the user's. */
export function rungsDone(s: ProgressData): Record<LadderScreen, boolean> {
  const own = s.profileOrigin !== 'demo';
  const p = s.profile;
  return {
    S5: s.selfGuess !== null,
    S6: s.closestCardId !== null,
    S7: own && (SPENDING_SLIDERS.some(({ category }) => measured(p.spending[category])) || measured(p.retirementShare)),
    S8:
      own &&
      (BALANCE_INPUTS.some((f) => measured(p[f])) ||
        p.debts.some((d) => measured(d.minPayment)) ||
        debtsChanged(s.startDebts, p.debts)),
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
    in10ySource: 'rules',
    bandWidth,
    bandWidthAllEstimated,
    bandNarrowed,
    estimates: { left, total: forecastInputCount(s.profile) },
    futureHref: SCREEN_ROUTES.S10,
  };
}

export function useLadderProgress(): LadderProgressVM {
  const ready = useAppReady();
  const profile = useProfile();
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const selfGuess = useAppStore((s) => s.selfGuess);
  const closestCardId = useAppStore((s) => s.closestCardId);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const reveals = useGameStore((s) => s.reveals);

  // The picked card is one of today's revealed homes or a sample life (as on S6).
  const startDebts = useMemo(
    () => startingDebts(closestCardId, [...Object.values(reveals).map((r) => r.card), ...cardsSample]),
    [closestCardId, reveals],
  );

  const progress = useMemo(
    () => buildLadderProgress({ profile, profileOrigin, selfGuess, closestCardId, statementMonths, startDebts }),
    [profile, profileOrigin, selfGuess, closestCardId, statementMonths, startDebts],
  );

  return { status: ready ? 'ready' : 'loading', ...progress };
}
