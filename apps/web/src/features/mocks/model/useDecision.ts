// S13 Decision (the car): two ways to get a car (Path A vs Path B) against keeping the current one.
// Every number comes from the engine on the user's profile: canAfford (verdict), loan (payment,
// interest, debt load) and forecast (net worth, today's dollars, area inflation). The two paths
// start from the carDecisionSample fixture and the user edits them.
import {
  canAfford, debtLoadThresholds, forecast, hasEstimates, loan, safetyCushionMonths, type ScheduledPurchase,
} from '@lifeguessr/engine';
import { LoanInputSchema, PurchaseSchema, type LoanInput, type Money, type Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { mocks as copy } from '@/copy';
import { carDecisionSample } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import { areaRates, debtLoadGauge, displayForecast } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, usePro } from '@/state';
import type {
  CarPathForm, DecisionKind, DecisionPathId, DecisionPathResultVM, DecisionPathVM, DecisionVM, KeepCarVM,
} from './types';

/** F10's decisions in order; only the car is built. */
export const DECISION_KINDS: readonly DecisionKind[] = ['car', 'moving', 'kid', 'jobOffer', 'wedding'];

/** Two paths whose 10-year mids differ by less than this many dollars are a tie (they show as the same). */
export const DECISION_TIE: Money = 1;

/** Form fields for a loan offer (amount = the car's price). */
export function formFromLoan(l: LoanInput): CarPathForm {
  return {
    price: l.amount,
    payWith: 'loan',
    downPayment: l.downPayment ?? 0,
    apr: l.apr,
    termMonths: l.termMonths,
    fees: l.fees ?? 0,
  };
}

const samplePaths = (): Record<DecisionPathId, CarPathForm> => ({
  A: formFromLoan(carDecisionSample.pathA),
  B: formFromLoan(carDecisionSample.pathB),
});

/** LoanInput paths → the form's field names. */
const LOAN_FIELD: Record<string, string> = { amount: 'price', apr: 'apr', termMonths: 'termMonths', downPayment: 'downPayment', fees: 'fees' };

/**
 * The purchase a path describes (bought this month), or the invalid form fields. Paying cash uses only
 * the price; a loan finances price − down payment + fees.
 */
export function purchaseFromPath(form: CarPathForm): { purchase: ScheduledPurchase | null; loanInput: LoanInput | null; invalid: string[] } {
  const price = form.price ?? Number.NaN;
  if (form.payWith === 'cash') {
    const r = PurchaseSchema.safeParse({ label: copy.decision.purchaseLabel, amount: price, recurring: false, payWith: 'cash' });
    return r.success
      ? { purchase: r.data, loanInput: null, invalid: [] }
      : { purchase: null, loanInput: null, invalid: ['price'] };
  }
  const candidate: LoanInput = {
    amount: price,
    apr: form.apr ?? Number.NaN,
    termMonths: form.termMonths ?? Number.NaN,
    ...(form.downPayment ? { downPayment: form.downPayment } : {}),
    ...(form.fees ? { fees: form.fees } : {}),
  };
  const r = LoanInputSchema.safeParse(candidate);
  if (!r.success) {
    const invalid = [...new Set(r.error.issues.map((i) => LOAN_FIELD[String(i.path[0])] ?? String(i.path[0])))];
    return { purchase: null, loanInput: null, invalid };
  }
  return {
    purchase: { label: copy.decision.purchaseLabel, amount: price, recurring: false, payWith: { loan: r.data } },
    loanInput: r.data,
    invalid: [],
  };
}

/** One path through the engine. `keep10yMid` = keeping the current car's 10-year mid (today's dollars). */
export function evaluatePath(
  p: Profile,
  purchase: ScheduledPurchase,
  loanInput: LoanInput | null,
  keep10yMid: Money,
): DecisionPathResultVM {
  const rates = areaRates(p);
  const verdict = canAfford(p, purchase, { rates });
  // Same assumption as the verdict: whatever lands on a card is paid off from the monthly surplus.
  const withCar = forecast(p, 10, { todaysDollars: true, rates, extra: [{ ...purchase, payOffFromSurplus: true }] });
  const l = loanInput ? loan(p, loanInput) : null;
  const debtLoad = l ? l.debtLoadAfter : loan(p, { amount: 0, apr: 0, termMonths: 1 }).debtLoadBefore;
  return {
    verdict: verdict.verdict,
    waitMonths: verdict.waitMonths ?? null,
    failsOn: verdict.failsOn ?? null,
    baselineFails: verdict.baselineFails,
    monthly: l ? l.monthly : null,
    totalInterest: l ? l.totalInterest : 0,
    totalCost: l ? l.totalCost : purchase.amount,
    payoffMonth: l ? l.payoffMonth : null,
    debtLoad: debtLoadGauge(debtLoad),
    points: withCar.points,
    in10y: withCar.in10y,
    vsKeep10y: withCar.in10y.mid - keep10yMid,
  };
}

export function useDecision(): DecisionVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const isPro = usePro().isPro;
  const [forms, setForms] = useState<Record<DecisionPathId, CarPathForm>>(samplePaths);

  const keep: Loadable<KeepCarVM> = useMemo(
    () =>
      runEngine(() => {
        const f = displayForecast(profile);
        const before = loan(profile, { amount: 0, apr: 0, termMonths: 1 }).debtLoadBefore;
        return { points: f.points, in10y: f.in10y, debtLoad: debtLoadGauge(before) };
      }),
    [profile],
  );

  const pathVM = useCallback(
    (id: DecisionPathId): DecisionPathVM => {
      const form = forms[id];
      const { purchase, loanInput, invalid } = purchaseFromPath(form);
      if (!purchase) return { id, form, invalidFields: invalid, result: null };
      if (keep.status !== 'ready') return { id, form, invalidFields: [], result: keep };
      return { id, form, invalidFields: [], result: runEngine(() => evaluatePath(profile, purchase, loanInput, keep.data.in10y.mid)) };
    },
    [forms, keep, profile],
  );
  const a = useMemo(() => pathVM('A'), [pathVM]);
  const b = useMemo(() => pathVM('B'), [pathVM]);

  const comparison = useMemo((): DecisionVM['comparison'] => {
    if (a.result?.status !== 'ready' || b.result?.status !== 'ready') return null;
    const diff = a.result.data.in10y.mid - b.result.data.in10y.mid;
    if (Math.abs(diff) < DECISION_TIE) return { leader: 'tie', gap10y: Math.abs(diff) };
    return { leader: diff > 0 ? 'A' : 'B', gap10y: Math.abs(diff) };
  }, [a, b]);

  const setPath = useCallback((id: DecisionPathId, patch: Partial<CarPathForm>) => {
    setForms((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  }, []);
  const resetPaths = useCallback(() => setForms(samplePaths()), []);

  return {
    status: ready ? 'ready' : 'loading',
    kinds: DECISION_KINDS.map((id) => ({ id, available: id === 'car' })),
    kind: 'car',
    keep,
    paths: [a, b],
    setPath,
    resetPaths,
    comparison,
    forecastIsEstimate: hasEstimates(profile),
    debtLoadIsEstimate: profile.takeHomePay.isEstimate || profile.debts.some((d) => d.minPayment.isEstimate),
    rules: { cushionMonths: safetyCushionMonths.value, debtLoadRed: debtLoadThresholds.value.red },
    pro: { isPro, href: SCREEN_ROUTES.S15 },
  };
}
