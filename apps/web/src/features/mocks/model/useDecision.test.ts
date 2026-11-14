// @vitest-environment jsdom
import {
  canAfford, debtLoadThresholds, forecast, inflationAnnualOf, loan, safetyCushionMonths,
} from '@lifeguessr/engine';
import type { LoanInput } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { areaByZip, carDecisionSample, cloneProfileDemo } from '@/fixtures';
import { useAppStore, useProStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import { DECISION_KINDS, formFromLoan, purchaseFromPath, useDecision } from './useDecision';

beforeEach(() => {
  resetClientState();
  resetProState();
});

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
const probe: LoanInput = { amount: 0, apr: 0, termMonths: 1 };

async function ready() {
  const hook = renderHook(() => useDecision());
  await waitForReady(hook.result);
  return hook;
}

describe('purchaseFromPath', () => {
  it('a loan path finances price − down payment + fees; a cash path uses only the price', () => {
    const form = formFromLoan(carDecisionSample.pathA);
    const loanPath = purchaseFromPath(form);
    expect(loanPath.invalid).toEqual([]);
    expect(loanPath.loanInput).toEqual(carDecisionSample.pathA);
    expect(loanPath.purchase).toMatchObject({ amount: 28000, recurring: false, payWith: { loan: carDecisionSample.pathA } });

    const cash = purchaseFromPath({ ...form, payWith: 'cash' });
    expect(cash).toMatchObject({ loanInput: null, invalid: [], purchase: { amount: 28000, payWith: 'cash' } });
  });

  it('names the invalid fields with the form’s names', () => {
    const form = formFromLoan(carDecisionSample.pathB);
    expect(purchaseFromPath({ ...form, price: null }).invalid).toContain('price');
    expect(purchaseFromPath({ ...form, apr: null }).invalid).toEqual(['apr']);
    expect(purchaseFromPath({ ...form, termMonths: 0 }).invalid).toEqual(['termMonths']);
    expect(purchaseFromPath({ ...form, downPayment: 20000 }).invalid).toEqual(['downPayment']);
    expect(purchaseFromPath({ ...form, payWith: 'cash', price: null }).invalid).toEqual(['price']);
    // A cash path ignores a bad loan field.
    expect(purchaseFromPath({ ...form, payWith: 'cash', apr: null }).invalid).toEqual([]);
  });
});

describe('useDecision (S13)', () => {
  it('starts from the sample paths, every number from the engine on the profile', async () => {
    const { result } = await ready();
    const vm = result.current;
    const p = cloneProfileDemo();
    expect(vm.kind).toBe('car');
    expect(vm.kinds).toEqual(DECISION_KINDS.map((id) => ({ id, available: id === 'car' })));
    expect(vm.rules).toEqual({ cushionMonths: safetyCushionMonths.value, debtLoadRed: debtLoadThresholds.value.red });

    const keepForecast = forecast(p, 10, { todaysDollars: true, rates });
    expect(vm.keep.status).toBe('ready');
    if (vm.keep.status !== 'ready') return;
    expect(vm.keep.data.in10y).toEqual(keepForecast.in10y);
    expect(vm.keep.data.debtLoad.value).toBe(loan(p, probe).debtLoadBefore);

    for (const [path, input] of [[vm.paths[0], carDecisionSample.pathA], [vm.paths[1], carDecisionSample.pathB]] as const) {
      expect(path.form).toEqual(formFromLoan(input));
      expect(path.invalidFields).toEqual([]);
      const r = path.result!;
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      const purchase = { label: 'Car', amount: input.amount, recurring: false as const, payWith: { loan: input } };
      const verdict = canAfford(p, purchase, { rates });
      const l = loan(p, input);
      const withCar = forecast(p, 10, { todaysDollars: true, rates, extra: [{ ...purchase, payOffFromSurplus: true }] });
      expect(r.data).toMatchObject({
        verdict: verdict.verdict,
        waitMonths: verdict.waitMonths ?? null,
        failsOn: verdict.failsOn ?? null,
        baselineFails: verdict.baselineFails,
        monthly: l.monthly,
        totalInterest: l.totalInterest,
        totalCost: l.totalCost,
        payoffMonth: l.payoffMonth,
      });
      expect(r.data.debtLoad.value).toBe(l.debtLoadAfter);
      expect(r.data.in10y).toEqual(withCar.in10y);
      expect(r.data.points).toHaveLength(121);
      expect(r.data.vsKeep10y).toBeCloseTo(withCar.in10y.mid - keepForecast.in10y.mid, 6);
      // Buying a car is spending, so it lowers net worth against keeping the current one.
      expect(r.data.vsKeep10y).toBeLessThan(0);
    }

    const [a, b] = vm.paths.map((x) => (x.result?.status === 'ready' ? x.result.data.in10y.mid : Number.NaN));
    expect(vm.comparison).toEqual({ leader: a! > b! ? 'A' : 'B', gap10y: Math.abs(a! - b!) });
    // The cheaper used car (B) leaves more net worth than the newer one (A).
    expect(vm.comparison?.leader).toBe('B');
  });

  it('paying cash: no payment or interest, the price is the cost, the debt load stays', async () => {
    const { result } = await ready();
    act(() => result.current.setPath('B', { payWith: 'cash' }));
    const r = result.current.paths[1].result!;
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    const p = cloneProfileDemo();
    expect(r.data).toMatchObject({ monthly: null, totalInterest: 0, totalCost: 15000, payoffMonth: null });
    expect(r.data.debtLoad.value).toBe(loan(p, probe).debtLoadBefore);
    const verdict = canAfford(p, { label: 'Car', amount: 15000, recurring: false, payWith: 'cash' }, { rates });
    expect(r.data.verdict).toBe(verdict.verdict);
  });

  it('an invalid path has no result and no comparison; reset brings the samples back', async () => {
    const { result } = await ready();
    act(() => result.current.setPath('A', { apr: null }));
    expect(result.current.paths[0]).toMatchObject({ invalidFields: ['apr'], result: null });
    expect(result.current.comparison).toBeNull();
    act(() => result.current.resetPaths());
    expect(result.current.paths[0].form).toEqual(formFromLoan(carDecisionSample.pathA));
    expect(result.current.comparison).not.toBeNull();
  });

  it('equal paths are a tie', async () => {
    const { result } = await ready();
    act(() => result.current.setPath('B', formFromLoan(carDecisionSample.pathA)));
    expect(result.current.comparison).toEqual({ leader: 'tie', gap10y: 0 });
  });

  it('follows the profile in the store', async () => {
    const { result } = await ready();
    const before = result.current.keep.status === 'ready' ? result.current.keep.data.in10y.mid : Number.NaN;
    act(() => useAppStore.getState().setField('takeHomePay', 6500));
    expect(result.current.keep.status === 'ready' && result.current.keep.data.in10y.mid).toBeGreaterThan(before);
  });

  it('shows the Pro preview note to free users only', async () => {
    const free = await ready();
    expect(free.result.current.pro).toEqual({ isPro: false, href: '/pro' });
    free.unmount();

    resetProState(fakeProAdapter(statusInfo(PRO_DEMO)));
    const { result } = await ready();
    await act(() => useProStore.getState().refresh());
    await waitFor(() => expect(result.current.pro.isPro).toBe(true));
  });
});
