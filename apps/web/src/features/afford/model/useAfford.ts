// S11 Can I Afford It?: purchase form → engine canAfford (verdict, wait, rule, with / without
// forecasts), free text via /api/ai/parse (confirmed first), and the wishlist.
import { canAfford, debtLoadThresholds, goalReachMonth, loanTermsTypical, safetyCushionMonths, workTime } from '@lifeguessr/engine';
import { LoanInputSchema, PurchaseSchema, type ForecastPoint, type Goal, type Profile, type Purchase } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { afford as affordCopy } from '@/copy';
import { useTrackOnce } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { useParseConfirm, type ParseFn } from '@/lib/model/useParseConfirm';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, useProfile, usePro } from '@/state';
import { loanKindOf, withTypicalLoan } from './loanDefaults';
import type {
  AffordFormVM, AffordGoalEffectVM, AffordHorizonVM, AffordResultVM, AffordRulesVM, AffordVM, AffordWorkTimeVM, LoanEstimateVM,
} from './types';

const HORIZONS = [1, 12, 60, 120] as const;

/** The rules canAfford checks, from the engine's assumptions (one source for the numbers in the copy). */
export const AFFORD_RULES: AffordRulesVM = {
  cushionMonths: safetyCushionMonths.value,
  debtLoadRed: debtLoadThresholds.value.red,
};

export const EMPTY_AFFORD_FORM: AffordFormVM = {
  label: '',
  amount: null,
  recurring: false,
  payWith: 'cash',
  // A loan starts on the typical terms for its kind (JF9), so a verdict shows before anything is typed.
  loan: { apr: null, termMonths: null, downPayment: 0, fees: 0, typical: { apr: true, termMonths: true } },
};

/** The Purchase a form describes (loan fields not typed yet on their typical values), or the invalid form paths. */
export function purchaseFromForm(entered: AffordFormVM): { purchase: Purchase | null; invalid: string[] } {
  const form = withTypicalLoan(entered);
  if (form.amount === null) return { purchase: null, invalid: [] };
  const payWith: Purchase['payWith'] =
    form.payWith === 'loan'
      ? {
          loan: {
            amount: form.amount,
            apr: form.loan.apr ?? Number.NaN,
            termMonths: form.loan.termMonths ?? Number.NaN,
            ...(form.loan.downPayment ? { downPayment: form.loan.downPayment } : {}),
            ...(form.loan.fees ? { fees: form.loan.fees } : {}),
          },
        }
      : form.payWith;
  const candidate = {
    label: form.label.trim() || affordCopy.defaultPurchaseLabel,
    amount: form.amount,
    recurring: form.recurring,
    payWith,
  };
  const parsed = PurchaseSchema.safeParse(candidate);
  if (parsed.success) return { purchase: parsed.data, invalid: [] };
  // payWith is a union, so its errors collapse to 'payWith': check the loan on its own for field paths.
  const loanIssues =
    typeof payWith === 'object' ? (LoanInputSchema.safeParse(payWith.loan).error?.issues ?? []).map((i) => ['loan', ...i.path.map(String)].join('.')) : [];
  const otherIssues = parsed.error.issues.map((i) => i.path.map(String).join('.')).filter((p) => !(loanIssues.length > 0 && p.startsWith('payWith')));
  return { purchase: null, invalid: [...new Set([...otherIssues, ...loanIssues])] };
}

/** Form fields for a Purchase (from the wishlist or the text parser). */
export function formFromPurchase(p: Purchase): AffordFormVM {
  if (typeof p.payWith === 'object') {
    const l = p.payWith.loan;
    return {
      label: p.label,
      amount: p.amount,
      recurring: p.recurring,
      payWith: 'loan',
      loan: { apr: l.apr, termMonths: l.termMonths, downPayment: l.downPayment ?? 0, fees: l.fees ?? 0 },
    };
  }
  return { ...EMPTY_AFFORD_FORM, label: p.label, amount: p.amount, recurring: p.recurring, payWith: p.payWith };
}

const at = (points: ForecastPoint[], month: number) => points[Math.min(month, points.length - 1)]!;

/**
 * When the plan reaches the goal with the purchase made now vs without (engine goalReachMonth, the
 * same payoff plan canAfford uses). `now` = today, for the calendar year.
 */
export function affordGoalEffect(
  profile: Profile,
  goal: Goal,
  purchase: Purchase,
  rates: ReturnType<typeof areaRates>,
  now: Date,
): AffordGoalEffectVM {
  const without = goalReachMonth(profile, goal, { rates });
  const withIt = goalReachMonth(profile, goal, { rates, extra: [{ ...purchase, startMonth: 0, payOffFromSurplus: true }] });
  return {
    target: goal.target,
    reachYear: withIt === null ? null : now.getFullYear() + Math.floor((now.getMonth() + withIt) / 12),
    delayMonths: withIt === null || without === null ? null : Math.max(0, withIt - without),
    onTime: withIt !== null && withIt <= goal.years * 12,
  };
}

export function useAfford(opts: { parse?: ParseFn } = {}): AffordVM {
  const ready = useAppReady();
  const profile = useProfile();
  const wishlist = useAppStore((s) => s.wishlist);
  const goal = useAppStore((s) => s.goal);
  const addPurchase = useAppStore((s) => s.addToWishlist);
  const removeFromWishlist = useAppStore((s) => s.removeFromWishlist);
  const wishlistLocked = !usePro().isPro;
  const [form, setForm] = useState<AffordFormVM>(EMPTY_AFFORD_FORM);

  const { purchase, invalid } = useMemo(() => purchaseFromForm(form), [form]);
  const shownForm = useMemo(() => withTypicalLoan(form), [form]);
  const loanEstimate: LoanEstimateVM | null = useMemo(() => {
    const typical = form.loan.typical;
    if (form.payWith !== 'loan' || !typical || (!typical.apr && !typical.termMonths)) return null;
    return { kind: loanKindOf(form.label), apr: typical.apr, termMonths: typical.termMonths, source: loanTermsTypical.source };
  }, [form]);

  const result: Loadable<AffordResultVM> | null = useMemo(() => {
    if (!purchase) return null;
    const rates = areaRates(profile);
    const r = runEngine(() => ({
      check: canAfford(profile, purchase, { rates }),
      goalEffect: goal ? affordGoalEffect(profile, goal, purchase, rates, new Date()) : null,
    }));
    if (r.status !== 'ready') return r;
    const { check: a, goalEffect } = r.data;
    const horizons: AffordHorizonVM[] = HORIZONS.map((month) => {
      const w = at(a.with.points, month);
      const wo = at(a.without.points, month);
      return { month, with: w, without: wo, deltaMid: w.mid - wo.mid };
    });
    // The price per occurrence in work time, from take-home pay (null without pay).
    const wt = workTime(purchase.amount, profile.takeHomePay);
    const work: AffordWorkTimeVM | null = wt
      ? { unit: wt.best.unit, amount: wt.best.amount, per: purchase.recurring, hoursPerWeek: wt.hoursPerWeek, isEstimate: wt.isEstimate }
      : null;
    return {
      status: 'ready',
      data: {
        verdict: a.verdict,
        waitMonths: a.waitMonths ?? null,
        failsOn: a.failsOn ?? null,
        baselineFails: a.baselineFails,
        cheapestWay: a.cheapestWay,
        cheapestWayFits: a.cheapestWayFits,
        goalEffect,
        todaysDollars: false,
        forecastSource: 'rules',
        withPoints: a.with.points,
        withoutPoints: a.without.points,
        horizons,
        workTime: work,
      },
    };
  }, [profile, purchase, goal]);

  // The first verdict this page load: someone priced a purchase.
  const verdict = result?.status === 'ready' ? result.data.verdict : null;
  useTrackOnce(verdict !== null, 'afford_checked', { name: 'afford_checked', props: { verdict: verdict ?? 'fits' } });

  const parse = useParseConfirm('purchase', (p: Purchase) => setForm(formFromPurchase(p)), { parse: opts.parse });

  const addToWishlist = useCallback(
    () => (purchase && !wishlistLocked ? addPurchase(purchase) : null),
    [purchase, wishlistLocked, addPurchase],
  );
  const loadFromWishlist = useCallback(
    (id: string) => {
      const item = useAppStore.getState().wishlist.find((w) => w.id === id);
      if (item) setForm(formFromPurchase(item.purchase));
    },
    [],
  );

  return {
    status: ready ? 'ready' : 'loading',
    rules: AFFORD_RULES,
    form: shownForm,
    loanEstimate,
    setLabel: useCallback((label: string) => setForm((f) => ({ ...f, label })), []),
    setAmount: useCallback((amount: number | null) => setForm((f) => ({ ...f, amount })), []),
    setRecurring: useCallback((recurring: Purchase['recurring']) => setForm((f) => ({ ...f, recurring })), []),
    setPayWith: useCallback((payWith: AffordFormVM['payWith']) => setForm((f) => ({ ...f, payWith })), []),
    // A typed APR or term replaces the typical value for good (cleared, it stays empty and is flagged).
    setLoan: useCallback(
      (loan: Partial<AffordFormVM['loan']>) =>
        setForm((f) => {
          const typical = f.loan.typical && {
            apr: f.loan.typical.apr && !('apr' in loan),
            termMonths: f.loan.typical.termMonths && !('termMonths' in loan),
          };
          return { ...f, loan: { ...f.loan, ...loan, ...(typical && { typical }) } };
        }),
      [],
    ),
    purchase,
    invalidFields: invalid,
    result,
    parse,
    wishlist,
    wishlistLocked,
    proHref: SCREEN_ROUTES.S15,
    addToWishlist,
    removeFromWishlist,
    loadFromWishlist,
  };
}
