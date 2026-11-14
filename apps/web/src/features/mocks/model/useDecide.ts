// S13 Decision, car example: keep the car you have, or trade it in and lease a new one.
// Both paths run the engine's forecast on the user's profile (the demo profile until they build
// their own), 10 years, today's dollars, area inflation; the months left on the current car loan
// come from the engine's simulate. The lease terms start from the illustrative fixture
// (leaseScenarioFixture: every value sourced and flagged isEstimate) and the user edits them; a
// field the user typed is theirs, so it is no longer an estimate.
import { forecast, forecastMonths, hasEstimates, simulate, type ScheduledPurchase } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { mocks as copy } from '@/copy';
import { leaseScenarioFixture, leaseScenarioSample, LeaseScenarioSchema, type LeaseScenario } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import { areaRates, displayForecast } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, usePro } from '@/state';
import type { DecideResultVM, DecideVM, DecisionKind, LeaseField, LeaseForm } from './types';

const HORIZON_YEARS = 10;
const LEASE_FIELDS: readonly LeaseField[] = ['monthly', 'termMonths', 'dueAtSigning', 'running'];
export const NEXT_DECISIONS: readonly DecisionKind[] = ['moving', 'kid', 'jobOffer', 'wedding'];

const sampleForm = (): LeaseForm => ({ ...leaseScenarioSample });

/** The lease a form describes, or its invalid fields. */
export function leaseFromForm(form: LeaseForm): { lease: LeaseScenario | null; invalid: LeaseField[] } {
  const r = LeaseScenarioSchema.safeParse({
    monthly: form.monthly ?? Number.NaN,
    termMonths: form.termMonths ?? Number.NaN,
    dueAtSigning: form.dueAtSigning ?? Number.NaN,
    running: form.running ?? Number.NaN,
  });
  if (r.success) return { lease: r.data, invalid: [] };
  const invalid = new Set(r.error.issues.map((i) => String(i.path[0])));
  return { lease: null, invalid: LEASE_FIELDS.filter((f) => invalid.has(f)) };
}

/**
 * The lease path: the car is traded in (assumed to clear its loan, so auto debts go), the lease's
 * running costs replace the car line, the lease is paid every month (leasing again at the end of
 * each term) and the amount due at signing at the start of every term within the horizon.
 */
export function leaseProfileAndPurchases(
  p: Profile,
  lease: LeaseScenario,
  leaseIsEstimate: boolean,
): { profile: Profile; extra: ScheduledPurchase[]; signings: number } {
  const months = forecastMonths(HORIZON_YEARS);
  const profile: Profile = {
    ...p,
    spending: { ...p.spending, car: { value: lease.running, isEstimate: leaseIsEstimate } },
    debts: p.debts.filter((d) => d.kind !== 'auto'),
  };
  const extra: ScheduledPurchase[] = [
    { label: copy.decide.purchaseLabels.lease, amount: lease.monthly, recurring: 'monthly', payWith: 'cash' },
  ];
  for (let start = 0; start < months; start += lease.termMonths) {
    extra.push({ label: copy.decide.purchaseLabels.signing, amount: lease.dueAtSigning, recurring: false, payWith: 'cash', startMonth: start });
  }
  return { profile, extra, signings: extra.length - 1 };
}

/** Both paths through the engine. */
export function evaluateDecision(p: Profile, lease: LeaseScenario, leaseIsEstimate: boolean): DecideResultVM {
  const rates = areaRates(p);
  const keep = displayForecast(p);
  const autos = p.debts.filter((d) => d.kind === 'auto' && d.balance > 0);
  const payoff = autos.length > 0 ? simulate(p, forecastMonths(HORIZON_YEARS), { rates }).payoffMonth : {};
  const payoffMonths = autos.map((d) => payoff[d.id] ?? null);
  const monthsLeft = payoffMonths.includes(null) ? null : Math.max(0, ...(payoffMonths as number[]));

  const l = leaseProfileAndPurchases(p, lease, leaseIsEstimate);
  const leased = forecast(l.profile, HORIZON_YEARS, { todaysDollars: true, rates, extra: l.extra });

  const keepAdvantage10y = keep.in10y.mid - leased.in10y.mid;
  return {
    keep: {
      loanLeft: autos.reduce((s, d) => s + d.balance, 0),
      monthsLeft,
      loanPayment: autos.reduce((s, d) => s + d.minPayment.value, 0),
      running: p.spending.car.value,
      runningIsEstimate: p.spending.car.isEstimate,
      in10y: keep.in10y,
    },
    lease: { in10y: leased.in10y, signings: l.signings },
    keepAdvantage10y,
    monthlySavingAfterPayoff: lease.monthly + lease.running - p.spending.car.value,
    better: keepAdvantage10y >= 0 ? 'keep' : 'lease',
    betterBy10y: Math.abs(keepAdvantage10y),
    isEstimate: hasEstimates(p) || leaseIsEstimate,
    forecastSource: 'rules',
  };
}

export function useDecide(opts: { now?: Date } = {}): DecideVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const isDemoProfile = useAppStore((s) => s.profileOrigin) === 'demo';
  const isPro = usePro().isPro;
  const [form, setForm] = useState<LeaseForm>(sampleForm);
  const [edited, setEdited] = useState<ReadonlySet<LeaseField>>(new Set());

  const { lease, invalid } = useMemo(() => leaseFromForm(form), [form]);
  const isEstimate = useMemo(
    () =>
      Object.fromEntries(
        LEASE_FIELDS.map((f) => [f, !edited.has(f) && leaseScenarioFixture[f].isEstimate === true]),
      ) as Record<LeaseField, boolean>,
    [edited],
  );
  const leaseIsEstimate = LEASE_FIELDS.some((f) => isEstimate[f]);

  const result: Loadable<DecideResultVM> | null = useMemo(
    () => (lease ? runEngine(() => evaluateDecision(profile, lease, leaseIsEstimate)) : null),
    [profile, lease, leaseIsEstimate],
  );

  const setLease = useCallback((patch: Partial<LeaseForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setEdited((e) => new Set([...e, ...(Object.keys(patch) as LeaseField[])]));
  }, []);
  const resetLease = useCallback(() => {
    setForm(sampleForm());
    setEdited(new Set());
  }, []);

  const year = (opts.now ?? new Date()).getFullYear();
  return {
    status: ready ? 'ready' : 'loading',
    isDemoProfile,
    horizonYear: year + HORIZON_YEARS,
    todaysDollars: true,
    lease: { form, isEstimate, invalidFields: invalid },
    setLease,
    resetLease,
    result,
    nextDecisions: [...NEXT_DECISIONS],
    pro: { isPro, href: SCREEN_ROUTES.S15 },
  };
}
