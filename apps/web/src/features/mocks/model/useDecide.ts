// S13 "Keep my car or switch?": the person's own car against one alternative (lease, a new car on a
// loan, or no car), both through the engine's carDecision on the planner's profile (the stored profile
// with the accounts folded in, as /plan uses it), 10 years, today's dollars, area inflation.
//
// The car fields start from the person's money: the auto loans (Accounts or the profile's debts), the
// car's value (a vehicle account) and the Car budget line. What the person has none of is a labelled
// example (isEstimate, "Example" tag) they can change. The alternatives start from sourced fixtures:
// the illustrative lease (leaseScenario.sample.json) and the sample car loan offer
// (loanOffers.sample.json); a field the person typed is theirs, no longer an estimate.
//
// "Add to my plan" lives in ./useCarPlanLink.ts.
import {
  amortizedPayment, carDecision, carLoanPaymentTooLow, hasEstimates, type CarAlternative, type CarDecision, type CarNow,
} from '@lifeguessr/engine';
import type { Account, Profile, Source } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { leaseScenarioFixture, loanOffersSample } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { NO_MOVES, profileFor, usePlanInputs } from '@/features/plan/model/planEngine';
import { useAppReady, useAppStore } from '@/state';
import type {
  AlternativeField, AlternativeKind, CarField, DecideFieldError, DecideFieldVM, DecideResultVM, DecideVM, FieldOrigin,
} from './types';
import { useCarPlanLink } from './useCarPlanLink';

export const HORIZON_YEARS = 10;

/** The labelled example car, for a person with no car in their money yet. Not a quote. */
export const CAR_EXAMPLE_SOURCE: Source = { name: 'Illustrative example car, not a quote', year: 2026 };
const EXAMPLE_LOAN = { balance: 12_000, apr: 0.08, termMonths: 36 };
export const CAR_EXAMPLE = {
  value: 15_000,
  loanBalance: EXAMPLE_LOAN.balance,
  loanPayment: amortizedPayment(EXAMPLE_LOAN.balance, EXAMPLE_LOAN.apr, EXAMPLE_LOAN.termMonths),
  loanApr: EXAMPLE_LOAN.apr,
  running: 300,
} as const satisfies CarNow;
/** Getting around without a car (transit pass, some rides and rentals), per month. An example, not data. */
export const NO_CAR_EXAMPLE = 200;

const SAMPLE_OFFER = loanOffersSample[1]!;

type FieldSpec<K extends string> = { key: K; unit: DecideFieldVM<K>['unit']; max: number };
const money = <K extends string>(key: K, max = 1_000_000): FieldSpec<K> => ({ key, unit: 'money', max });
const monthly = <K extends string>(key: K, max = 100_000): FieldSpec<K> => ({ key, unit: 'monthly', max });
const rate = <K extends string>(key: K): FieldSpec<K> => ({ key, unit: 'rate', max: 0.4 });
const months = <K extends string>(key: K, max: number): FieldSpec<K> => ({ key, unit: 'months', max });

const CAR_SPECS: FieldSpec<CarField>[] = [money('value'), money('loanBalance'), monthly('loanPayment'), rate('loanApr'), monthly('running')];
export const ALTERNATIVE_SPECS: Record<AlternativeKind, FieldSpec<AlternativeField>[]> = {
  lease: [monthly('monthly'), months('termMonths', 60), money('dueAtSigning', 100_000), monthly('running')],
  buy: [money('price'), money('downPayment'), rate('apr'), months('termMonths', 96), monthly('running')],
  noCar: [monthly('monthly')],
};

type Default = { value: number; origin: FieldOrigin; isEstimate: boolean };
export type CarDefaults = Record<CarField, Default>;

/**
 * The car fields from the person's money. Auto loans: Σ balances and payments, the APR weighted by
 * balance. Value: Σ vehicle accounts. Running: the Car budget line. With neither a loan nor a car
 * budget, the person has no car on file: every field is the example.
 */
export function carDefaults(p: Profile, accounts: readonly Account[]): CarDefaults {
  const autos = p.debts.filter((d) => d.kind === 'auto' && d.balance > 0);
  const vehicles = accounts.filter((a) => a.group === 'vehicle' && a.balance.value > 0);
  const hasCar = autos.length > 0 || p.spending.car.value > 0 || vehicles.length > 0;
  const example = (v: number): Default => ({ value: v, origin: 'example', isEstimate: true });
  if (!hasCar) {
    return {
      value: example(CAR_EXAMPLE.value),
      loanBalance: example(CAR_EXAMPLE.loanBalance),
      loanPayment: example(CAR_EXAMPLE.loanPayment),
      loanApr: example(CAR_EXAMPLE.loanApr),
      running: example(CAR_EXAMPLE.running),
    };
  }
  const balance = autos.reduce((s, d) => s + d.balance, 0);
  const payment = autos.reduce((s, d) => s + d.minPayment.value, 0);
  const apr = balance > 0 ? autos.reduce((s, d) => s + d.apr * d.balance, 0) / balance : 0;
  const paymentEstimate = autos.some((d) => d.minPayment.isEstimate);
  const loan = (v: number, isEstimate = false): Default => ({ value: v, origin: 'accounts', isEstimate });
  return {
    value: vehicles.length > 0
      ? { value: vehicles.reduce((s, a) => s + a.balance.value, 0), origin: 'accounts', isEstimate: vehicles.some((a) => a.balance.isEstimate) }
      : example(CAR_EXAMPLE.value),
    loanBalance: loan(balance),
    loanPayment: loan(payment, paymentEstimate),
    loanApr: loan(apr),
    running: p.spending.car.value > 0
      ? { value: p.spending.car.value, origin: 'budget', isEstimate: p.spending.car.isEstimate }
      : example(CAR_EXAMPLE.running),
  };
}

/** The alternatives' starting values: the sourced lease fixture, the sample loan offer, the example. */
export function alternativeDefaults(kind: AlternativeKind, running: number): Partial<Record<AlternativeField, Default>> {
  const ex = (v: number): Default => ({ value: v, origin: 'example', isEstimate: true });
  switch (kind) {
    case 'lease':
      return {
        monthly: ex(leaseScenarioFixture.monthly.value),
        termMonths: ex(leaseScenarioFixture.termMonths.value),
        dueAtSigning: ex(leaseScenarioFixture.dueAtSigning.value),
        running: ex(leaseScenarioFixture.running.value),
      };
    case 'buy':
      return {
        price: ex(SAMPLE_OFFER.amount),
        downPayment: ex(SAMPLE_OFFER.downPayment ?? 0),
        apr: ex(SAMPLE_OFFER.apr),
        termMonths: ex(SAMPLE_OFFER.termMonths),
        // A new car costs about what the current one does to run.
        running: { value: running, origin: 'example', isEstimate: true },
      };
    case 'noCar':
      return { monthly: ex(NO_CAR_EXAMPLE) };
  }
}

/** A field's error, before the cross-field checks. */
function fieldError(spec: FieldSpec<string>, v: number | null): DecideFieldError | null {
  if (v === null || !Number.isFinite(v)) return 'required';
  if (v < 0) return 'negative';
  if (spec.unit === 'months') return Number.isInteger(v) && v >= 1 && v <= spec.max ? null : 'term';
  if (spec.unit === 'rate') return v < spec.max ? null : 'apr';
  return v > spec.max ? 'tooLarge' : null;
}

type Overrides<K extends string> = Partial<Record<K, number | null>>;

function buildFields<K extends string>(specs: FieldSpec<K>[], defaults: Partial<Record<K, Default>>, typed: Overrides<K>): DecideFieldVM<K>[] {
  return specs.map((spec) => {
    const own = spec.key in typed;
    const d = defaults[spec.key]!;
    const value = own ? typed[spec.key]! : d.value;
    return {
      key: spec.key,
      value,
      unit: spec.unit,
      origin: own ? 'typed' : d.origin,
      isEstimate: own ? false : d.isEstimate,
      error: fieldError(spec, value),
      max: spec.max,
    };
  });
}

const valueOf = <K extends string>(fields: DecideFieldVM<K>[], key: K): number => fields.find((f) => f.key === key)!.value ?? 0;
const withError = <K extends string>(fields: DecideFieldVM<K>[], key: K, error: DecideFieldError): DecideFieldVM<K>[] =>
  fields.map((f) => (f.key === key && f.error === null ? { ...f, error } : f));

/** The car the fields describe, with the cross-field check (a payment that never pays the loan off). */
export function carOf(fields: DecideFieldVM<CarField>[]): { car: CarNow; fields: DecideFieldVM<CarField>[] } {
  const car: CarNow = {
    value: valueOf(fields, 'value'),
    loanBalance: valueOf(fields, 'loanBalance'),
    loanPayment: valueOf(fields, 'loanPayment'),
    loanApr: valueOf(fields, 'loanApr'),
    running: valueOf(fields, 'running'),
  };
  return { car, fields: carLoanPaymentTooLow(car) ? withError(fields, 'loanPayment', 'paymentTooLow') : fields };
}

export function alternativeOf(kind: AlternativeKind, fields: DecideFieldVM<AlternativeField>[]): { alt: CarAlternative; fields: DecideFieldVM<AlternativeField>[] } {
  const v = (k: AlternativeField) => valueOf(fields, k);
  switch (kind) {
    case 'lease':
      return { alt: { kind, monthly: v('monthly'), termMonths: v('termMonths'), dueAtSigning: v('dueAtSigning'), running: v('running') }, fields };
    case 'buy': {
      const alt: CarAlternative = { kind, price: v('price'), downPayment: v('downPayment'), apr: v('apr'), termMonths: v('termMonths'), running: v('running') };
      return { alt, fields: alt.downPayment > alt.price ? withError(fields, 'downPayment', 'downAbovePrice') : fields };
    }
    case 'noCar':
      return { alt: { kind, monthly: v('monthly') }, fields };
  }
}

/** The engine's answer as the screen's view-model; calendar years from `startYear`. */
export function toResultVM(d: CarDecision, startYear: number, isEstimate: boolean): DecideResultVM {
  return {
    better: d.better,
    betterBy: Math.abs(d.difference),
    isClose: d.isClose,
    keepNetWorth: d.keep.netWorth,
    alternativeNetWorth: d.alternative.netWorth,
    years: d.years.map((y) => ({ year: startYear + y.year, keep: y.keep, alternative: y.alternative })),
    keepCost: d.keep.costNow,
    keepCostAfterPayoff: d.keep.costAfterPayoff,
    keepPayoffMonths: d.keep.payoffMonth,
    alternativeCost: d.alternative.costNow,
    alternativeUpfront: d.alternative.upfront,
    signings: d.alternative.signings,
    tradeInEquity: d.tradeInEquity,
    isEstimate,
    source: 'rules',
  };
}

export function useDecide(opts: { now?: Date } = {}): DecideVM {
  const ready = useAppReady();
  const isDemoProfile = useAppStore((s) => s.profileOrigin) === 'demo';
  const inputs = usePlanInputs();
  const profile = useMemo(() => profileFor(inputs, NO_MOVES), [inputs]);
  const defaults = useMemo(() => carDefaults(profile, inputs.accounts), [profile, inputs.accounts]);

  const [carTyped, setCarTyped] = useState<Overrides<CarField>>({});
  const [kind, setKind] = useState<AlternativeKind>('lease');
  const [altTyped, setAltTyped] = useState<Record<AlternativeKind, Overrides<AlternativeField>>>({ lease: {}, buy: {}, noCar: {} });

  const checkedCar = useMemo(() => carOf(buildFields(CAR_SPECS, defaults, carTyped)), [defaults, carTyped]);
  const running = checkedCar.car.running;
  const checkedAlt = useMemo(
    () => alternativeOf(kind, buildFields(ALTERNATIVE_SPECS[kind], alternativeDefaults(kind, running), altTyped[kind])),
    [kind, running, altTyped],
  );

  const startYear = (opts.now ?? new Date()).getFullYear();
  const invalid = [...checkedCar.fields, ...checkedAlt.fields].some((f) => f.error !== null);
  const anyEstimate = [...checkedCar.fields, ...checkedAlt.fields].some((f) => f.isEstimate);

  const result: Loadable<DecideResultVM> | null = useMemo(
    () =>
      invalid
        ? null
        : runEngine(() =>
            toResultVM(
              carDecision(profile, checkedCar.car, checkedAlt.alt, { years: HORIZON_YEARS, rates: areaRates(profile) }),
              startYear,
              anyEstimate || hasEstimates(profile),
            ),
          ),
    [invalid, profile, checkedCar.car, checkedAlt.alt, startYear, anyEstimate],
  );

  const plan = useCarPlanLink({
    result: result?.status === 'ready' ? result.data : null,
    alternative: invalid ? null : checkedAlt.alt,
  });

  const setCar = useCallback((key: CarField, value: number | null) => setCarTyped((t) => ({ ...t, [key]: value })), []);
  const resetCar = useCallback(() => setCarTyped({}), []);
  const setAlternative = useCallback(
    (key: AlternativeField, value: number | null) => setAltTyped((t) => ({ ...t, [kind]: { ...t[kind], [key]: value } })),
    [kind],
  );
  const resetAlternative = useCallback(() => setAltTyped((t) => ({ ...t, [kind]: {} })), [kind]);

  return {
    status: ready ? 'ready' : 'loading',
    startYear,
    horizonYear: startYear + HORIZON_YEARS,
    isDemoProfile,
    carFromProfile: defaults.loanBalance.origin !== 'example',
    car: checkedCar.fields,
    setCar,
    resetCar,
    alternativeKind: kind,
    setAlternativeKind: setKind,
    alternative: checkedAlt.fields,
    setAlternative,
    resetAlternative,
    result,
    plan,
  };
}
