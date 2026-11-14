// @vitest-environment jsdom
import { forecast, inflationAnnualOf, simulate } from '@lifeguessr/engine';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { areaByZip, cloneProfileDemo, leaseScenarioSample } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { evaluateDecision, leaseFromForm, leaseProfileAndPurchases, NEXT_DECISIONS, useDecide } from './useDecide';

beforeEach(() => {
  resetClientState();
  resetProState();
});

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };

async function ready() {
  const hook = renderHook(() => useDecide({ now: new Date(2026, 10, 14) }));
  await waitForReady(hook.result);
  return hook;
}

describe('lease helpers', () => {
  it('leaseFromForm validates with the fixture schema and names the bad fields', () => {
    expect(leaseFromForm({ ...leaseScenarioSample })).toEqual({ lease: { ...leaseScenarioSample }, invalid: [] });
    expect(leaseFromForm({ ...leaseScenarioSample, monthly: null, termMonths: 0 }).invalid).toEqual(['monthly', 'termMonths']);
    expect(leaseFromForm({ ...leaseScenarioSample, termMonths: 2.5 }).invalid).toEqual(['termMonths']);
  });

  it('the lease path drops the auto loan, takes the lease running costs and pays at signing every term', () => {
    const p = cloneProfileDemo();
    const l = leaseProfileAndPurchases(p, { monthly: 400, termMonths: 36, dueAtSigning: 2000, running: 250 }, true);
    expect(l.profile.debts.map((d) => d.kind)).toEqual(['card']);
    expect(l.profile.spending.car).toEqual({ value: 250, isEstimate: true });
    expect(l.extra[0]).toMatchObject({ amount: 400, recurring: 'monthly', payWith: 'cash' });
    expect(l.extra.slice(1).map((x) => x.startMonth)).toEqual([0, 36, 72, 108]);
    expect(l.signings).toBe(4);
    expect(p.debts).toHaveLength(2); // the input is not mutated
  });
});

describe('useDecide (S13)', () => {
  it('runs both paths through the engine on the profile, starting from the illustrative lease', async () => {
    const { result } = await ready();
    const vm = result.current;
    const p = cloneProfileDemo();
    expect(vm).toMatchObject({ isDemoProfile: true, horizonYear: 2036, todaysDollars: true, nextDecisions: NEXT_DECISIONS });
    expect(vm.lease.form).toEqual({ ...leaseScenarioSample });
    expect(Object.values(vm.lease.isEstimate)).toEqual([true, true, true, true]);
    expect(vm.result?.status).toBe('ready');
    if (vm.result?.status !== 'ready') return;
    const r = vm.result.data;

    const keep = forecast(p, 10, { todaysDollars: true, rates });
    const l = leaseProfileAndPurchases(p, leaseScenarioSample, true);
    const lease = forecast(l.profile, 10, { todaysDollars: true, rates, extra: l.extra });
    const auto = p.debts.find((d) => d.kind === 'auto')!;
    expect(r.keep).toEqual({
      loanLeft: auto.balance,
      monthsLeft: simulate(p, 120, { rates }).payoffMonth[auto.id],
      loanPayment: auto.minPayment.value,
      running: p.spending.car.value,
      runningIsEstimate: p.spending.car.isEstimate,
      in10y: keep.in10y,
    });
    expect(r.lease.in10y).toEqual(lease.in10y);
    expect(r.keepAdvantage10y).toBeCloseTo(keep.in10y.mid - lease.in10y.mid, 6);
    expect(r.betterBy10y).toBeCloseTo(Math.abs(r.keepAdvantage10y), 6);
    expect(r.better).toBe(r.keepAdvantage10y >= 0 ? 'keep' : 'lease');
    expect(r.monthlySavingAfterPayoff).toBe(leaseScenarioSample.monthly + leaseScenarioSample.running - p.spending.car.value);
    expect(r.isEstimate).toBe(true);
    expect(r).toEqual(evaluateDecision(p, leaseScenarioSample, true));
  });

  it('typed lease terms replace the estimate; a bad one hides the result until fixed or reset', async () => {
    const { result } = await ready();
    act(() => result.current.setLease({ monthly: 350 }));
    expect(result.current.lease.isEstimate.monthly).toBe(false);
    expect(result.current.lease.isEstimate.running).toBe(true);
    const r = result.current.result!;
    expect(r.status === 'ready' && r.data).toEqual(evaluateDecision(cloneProfileDemo(), { ...leaseScenarioSample, monthly: 350 }, true));

    act(() => result.current.setLease({ termMonths: null }));
    expect(result.current.lease.invalidFields).toEqual(['termMonths']);
    expect(result.current.result).toBeNull();
    act(() => result.current.resetLease());
    expect(result.current.lease.form).toEqual({ ...leaseScenarioSample });
    expect(result.current.result?.status).toBe('ready');
  });

  it('runs on the user’s own profile once they have one', async () => {
    const { result } = await ready();
    act(() => useAppStore.getState().setField('takeHomePay', 6500));
    expect(result.current.isDemoProfile).toBe(false);
    const p = useAppStore.getState().profile;
    const r = result.current.result!;
    expect(r.status === 'ready' && r.data).toEqual(evaluateDecision(p, leaseScenarioSample, true));
  });

  it('a profile without a car loan has nothing left to pay', async () => {
    const p = cloneProfileDemo();
    p.debts = p.debts.filter((d) => d.kind !== 'auto');
    const r = evaluateDecision(p, leaseScenarioSample, true);
    expect(r.keep).toMatchObject({ loanLeft: 0, monthsLeft: 0, loanPayment: 0 });
  });
});
