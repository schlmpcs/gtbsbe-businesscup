// @vitest-environment jsdom
// S13 view-model on the fixture stores (profile.demo.json, accounts.demo.json): the car comes from the
// person's accounts and budget, the numbers from the engine's carDecision and plan(). Nothing here is a
// copied constant: every expected number is computed by the engine in the test.
import { carDecision, hasEstimates } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo, leaseScenarioSample, loanOffersSample } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { NO_MOVES, planOf, profileFor, usePlanInputs } from '@/features/plan/model/planEngine';
import { usePlanStore } from '@/features/plan/model/planStore';
import { carPlanEvent } from './useCarPlanLink';
import { CAR_EXAMPLE, carDefaults, NO_CAR_EXAMPLE, useDecide } from './useDecide';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

const decide = () => renderHook(() => ({ vm: useDecide({ now: FIXTURE_NOW }), inputs: usePlanInputs() }));
const field = <K extends string>(list: { key: K; value: number | null }[], key: K) => list.find((f) => f.key === key)!;

describe('carDefaults', () => {
  it('a profile without a car or car budget gets the labelled example car', () => {
    const p: Profile = { ...cloneProfileDemo(), debts: [], spending: { ...cloneProfileDemo().spending, car: { value: 0, isEstimate: false } } };
    const d = carDefaults(p, []);
    expect(Object.values(d).every((x) => x.origin === 'example' && x.isEstimate)).toBe(true);
    expect(d.loanBalance.value).toBe(CAR_EXAMPLE.loanBalance);
  });

  it('a car budget without a loan is a car owned outright: no loan, running costs from the budget', () => {
    const p: Profile = { ...cloneProfileDemo(), debts: cloneProfileDemo().debts.filter((x) => x.kind !== 'auto') };
    const d = carDefaults(p, []);
    expect(d.loanBalance).toEqual({ value: 0, origin: 'accounts', isEstimate: false });
    expect(d.running).toMatchObject({ value: p.spending.car.value, origin: 'budget' });
    expect(d.value.origin).toBe('example'); // no vehicle account
  });
});

describe('useDecide', () => {
  it('starts from the person’s own car: loan from Accounts, value from the vehicle account, running from the budget', () => {
    const { result } = decide();
    const { vm, inputs } = result.current;
    expect(vm.status).toBe('ready');
    expect(vm.carFromProfile).toBe(true);
    const auto = profileFor(inputs, NO_MOVES).debts.find((x) => x.kind === 'auto')!;
    expect(field(vm.car, 'loanBalance')).toMatchObject({ value: auto.balance, origin: 'accounts' });
    expect(field(vm.car, 'loanPayment')).toMatchObject({ value: auto.minPayment.value, origin: 'accounts' });
    expect(field(vm.car, 'loanApr').value).toBeCloseTo(auto.apr, 9);
    const vehicle = inputs.accounts.find((a) => a.group === 'vehicle')!;
    expect(field(vm.car, 'value')).toMatchObject({ value: vehicle.balance.value, origin: 'accounts' });
    expect(field(vm.car, 'running')).toMatchObject({ value: inputs.profile.spending.car.value, origin: 'budget' });
    expect(vm.horizonYear).toBe(2036);
  });

  it('the answer is the engine’s carDecision on the planner profile', () => {
    const { result } = decide();
    const { vm, inputs } = result.current;
    const p = profileFor(inputs, NO_MOVES);
    const auto = p.debts.find((x) => x.kind === 'auto')!;
    const expected = carDecision(
      p,
      {
        value: inputs.accounts.find((a) => a.group === 'vehicle')!.balance.value,
        loanBalance: auto.balance,
        loanPayment: auto.minPayment.value,
        loanApr: auto.apr,
        running: p.spending.car.value,
      },
      { kind: 'lease', ...leaseScenarioSample },
      { years: 10, rates: areaRates(p) },
    );
    expect(vm.result?.status).toBe('ready');
    if (vm.result?.status !== 'ready') return;
    const r = vm.result.data;
    expect(r.keepNetWorth).toBeCloseTo(expected.keep.netWorth, 6);
    expect(r.alternativeNetWorth).toBeCloseTo(expected.alternative.netWorth, 6);
    expect(r.betterBy).toBeCloseTo(Math.abs(expected.difference), 6);
    expect(r.years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]);
    expect(r.isEstimate).toBe(true); // the lease terms are examples
    expect(hasEstimates(p) || r.isEstimate).toBe(true);
    expect(r.source).toBe('rules');
  });

  it('typing makes a field the person’s own; an empty field hides the answer; reset goes back', () => {
    const { result } = decide();
    const before = result.current.vm.result;
    act(() => result.current.vm.setAlternative('monthly', 250));
    expect(field(result.current.vm.alternative, 'monthly')).toMatchObject({ value: 250, origin: 'typed', isEstimate: false });
    expect(result.current.vm.result).not.toEqual(before);
    act(() => result.current.vm.setCar('running', null));
    expect(field(result.current.vm.car, 'running')).toMatchObject({ error: 'required' });
    expect(result.current.vm.result).toBeNull();
    act(() => result.current.vm.resetCar());
    act(() => result.current.vm.resetAlternative());
    expect(result.current.vm.result).toEqual(before);
  });

  it('checks fields: whole-month terms, APR, a down payment above the price, a payment below the interest', () => {
    const { result } = decide();
    act(() => result.current.vm.setAlternative('termMonths', 0));
    expect(field(result.current.vm.alternative, 'termMonths')).toMatchObject({ error: 'term' });
    act(() => result.current.vm.setAlternativeKind('buy'));
    expect(field(result.current.vm.alternative, 'price').value).toBe(loanOffersSample[1]!.amount);
    act(() => result.current.vm.setAlternative('downPayment', 999_999));
    expect(field(result.current.vm.alternative, 'downPayment')).toMatchObject({ error: 'downAbovePrice' });
    act(() => result.current.vm.resetAlternative());
    act(() => result.current.vm.setCar('loanPayment', 10));
    expect(field(result.current.vm.car, 'loanPayment')).toMatchObject({ error: 'paymentTooLow' });
    act(() => result.current.vm.setCar('loanApr', 0.5));
    expect(field(result.current.vm.car, 'loanApr')).toMatchObject({ error: 'apr' });
  });

  it('switches alternatives: each keeps its own typed values', () => {
    const { result } = decide();
    act(() => result.current.vm.setAlternativeKind('noCar'));
    expect(result.current.vm.alternative).toHaveLength(1);
    expect(field(result.current.vm.alternative, 'monthly').value).toBe(NO_CAR_EXAMPLE);
    act(() => result.current.vm.setAlternative('monthly', 90));
    act(() => result.current.vm.setAlternativeKind('lease'));
    expect(field(result.current.vm.alternative, 'monthly').value).toBe(leaseScenarioSample.monthly);
    act(() => result.current.vm.setAlternativeKind('noCar'));
    expect(field(result.current.vm.alternative, 'monthly').value).toBe(90);
  });
});

describe('Add to my plan', () => {
  it('a lease becomes a monthly Expense on the active scenario; its effect is plan() with − without', () => {
    const { result } = decide();
    act(() => result.current.vm.plan.setPath('alternative'));
    const { vm, inputs } = result.current;
    expect(vm.plan.event?.kind).toBe('leaseExpense');
    if (vm.result?.status !== 'ready') throw new Error('no result');
    const cost = vm.result.data.alternativeCost;
    expect(vm.plan.event?.amount).toBeCloseTo(cost.payment + cost.signing, 9);

    const { scenarios, activeId } = usePlanStore.getState();
    const active = scenarios.find((s) => s.id === activeId)!;
    const draft = carPlanEvent('alternative', { kind: 'lease', ...leaseScenarioSample }, vm.result.data, 2026)!;
    const withEvent = planOf(inputs, { ...active, events: [...active.events, { ...draft, id: 'x' }] });
    const without = planOf(inputs, active);
    expect(vm.plan.impact?.status).toBe('ready');
    if (vm.plan.impact?.status === 'ready') {
      expect(vm.plan.impact.data.atRetirement).toBeCloseTo(withEvent.kpis.netWorthAtRetirement - without.kpis.netWorthAtRetirement, 6);
      expect(vm.plan.impact.data.atRetirement).toBeLessThan(0);
    }

    act(() => result.current.vm.plan.add());
    expect(result.current.vm.plan.added).toBe(true);
    const after = usePlanStore.getState().scenarios.find((s) => s.id === activeId)!;
    const added = after.events.find((e) => e.type === 'expense' && e.cadence === 'monthly')!;
    expect(added).toMatchObject({ type: 'expense', cadence: 'monthly', year: 2026, endYear: 2036, enabled: true });
    expect(after.events).toHaveLength(active.events.length + 1);
    // Measured without counting the added event twice.
    if (result.current.vm.plan.impact?.status === 'ready' && vm.plan.impact?.status === 'ready') {
      expect(result.current.vm.plan.impact.data.atRetirement).toBeCloseTo(vm.plan.impact.data.atRetirement, 6);
    }
  });

  it('a new car is a financed one-off Expense; keeping and going car-free add no event', () => {
    const { result } = decide();
    act(() => result.current.vm.setAlternativeKind('buy'));
    act(() => result.current.vm.plan.setPath('alternative'));
    expect(result.current.vm.plan.event?.kind).toBe('financedExpense');
    expect(result.current.vm.plan.event?.amount).toBe(loanOffersSample[1]!.amount);
    act(() => result.current.vm.plan.setPath('keep'));
    expect(result.current.vm.plan).toMatchObject({ event: null, noEventReason: 'keep', impact: null });
    act(() => result.current.vm.setAlternativeKind('noCar'));
    act(() => result.current.vm.plan.setPath('alternative'));
    expect(result.current.vm.plan).toMatchObject({ event: null, noEventReason: 'noCar' });
  });
});
