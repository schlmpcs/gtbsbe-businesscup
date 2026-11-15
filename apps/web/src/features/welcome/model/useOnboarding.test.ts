// @vitest-environment jsdom
// /start onboarding: the reveal (pure) and the guess step. The connect flow runs end to end in
// e2e/onboarding.spec.ts (it reads the sample statement through the real pipeline).
import { useAppStore } from '@/state';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { StatementMonthVM } from '@/features/ladder/model/types';
import { analysisRows, BANKS, GUESS, revealOf, useOnboarding } from './useOnboarding';

afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});

const month = (over: Partial<Record<CostCategory, number>>, detectedPay: number | null = 4800): StatementMonthVM => {
  const totals = Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;
  return { month: '2026-10', totals, total: Object.values(totals).reduce((a, b) => a + b, 0), oneOffs: [], detectedPay, averaged: true };
};

describe('revealOf', () => {
  it('net worth, own and owe from the accounts; how far the guess was off', () => {
    const r = revealOf({ netWorth: -5_900, assets: 18_300, liabilities: 24_200 }, 40_000, null);
    expect(r).toMatchObject({
      netWorthLabel: '−$5,900', ownLabel: '$18,300', oweLabel: '$24,200',
      guessLabel: 'You guessed $40,000', offLabel: '$45,900 too high', offTone: 'bad',
      takeHomeLabel: null, spendingLabel: null, topCategories: [],
    });
    expect(revealOf({ netWorth: 10_000, assets: 10_000, liabilities: 0 }, 2_000, null).offLabel).toBe('$8,000 too low');
    expect(revealOf({ netWorth: 10_400, assets: 10_400, liabilities: 0 }, 10_000, null)).toMatchObject({ offLabel: 'Spot on', offTone: 'good' });
  });

  it('take-home pay, spending and the three biggest categories of the month, with their share', () => {
    const r = revealOf({ netWorth: 0, assets: 0, liabilities: 0 }, 0, month({ rentUtilities: 2000, groceries: 500, eatingOut: 300, subscriptions: 200 }));
    expect(r.takeHomeLabel).toBe('$4,800');
    expect(r.spendingLabel).toBe('$3,000');
    expect(r.topCategories.map((c) => c.amountLabel)).toEqual(['$2,000', '$500', '$300']);
    expect(r.topCategories[0]!.share).toBeCloseTo(2000 / 3000);
  });
});

describe('analysisRows', () => {
  it('paycheck first, then spending with money in it in the analysis order, then what is left', () => {
    const m = month({ groceries: 500, rentUtilities: 2000, other: 100, eatingOut: 300, subscriptions: 200 });
    const rows = analysisRows(m);
    expect(rows.map((r) => r.id)).toEqual(['pay', 'rentUtilities', 'subscriptions', 'eatingOut', 'groceries', 'other', 'left']);
    expect(rows[0]).toMatchObject({ icon: 'cash', value: 4800, valueLabel: '$4,800/mo', tone: 'good', share: 1, segment: null });
    expect(rows[1]).toMatchObject({ icon: 'home', value: 2000, valueLabel: '$2,000/mo', tone: 'plain', segment: { tone: 'primary' } });
    expect(rows[1]!.share).toBeCloseTo(2000 / 4800);
    expect(rows[1]!.segment!.share).toBeCloseTo(2000 / 3100);
    expect(rows.at(-1)).toMatchObject({ id: 'left', icon: 'piggy', value: 1700, tone: 'good', segment: null });
    expect(rows.at(-1)!.valueLabel).toMatch(/^\+\$1,700\/mo$/);
    expect(rows.at(-1)!.share).toBeCloseTo(1700 / 4800);
  });

  it('spending segments add up to the whole month', () => {
    const rows = analysisRows(month({ rentUtilities: 1800, debtPayments: 400, car: 350, childcare: 900, groceries: 600 }));
    const sum = rows.reduce((a, r) => a + (r.segment?.share ?? 0), 0);
    expect(sum).toBeCloseTo(1);
    expect(rows.filter((r) => r.segment).map((r) => r.segment!.tone)).toEqual(['primary', 1, 2, 3, 4]);
  });

  it('spending above take-home leaves a negative, bad "left" row', () => {
    const left = analysisRows(month({ rentUtilities: 4000, eatingOut: 1000 }, 4500)).at(-1)!;
    expect(left).toMatchObject({ id: 'left', value: -500, tone: 'bad' });
    expect(left.share).toBeCloseTo(500 / 4500);
  });

  it('no paycheck: no pay or left rows, bars are shares of spending', () => {
    for (const pay of [null, 0]) {
      const rows = analysisRows(month({ rentUtilities: 1500, groceries: 500 }, pay));
      expect(rows.map((r) => r.id)).toEqual(['rentUtilities', 'groceries']);
      expect(rows[0]!.share).toBeCloseTo(0.75);
    }
    expect(analysisRows(month({}, null))).toEqual([]);
  });
});

describe('useOnboarding', () => {
  const fillAbout = (r: { current: ReturnType<typeof useOnboarding> }) => {
    act(() => r.current.about.setField('age', '41'));
    act(() => r.current.about.setField('zip', '94110'));
    act(() => r.current.about.setField('takeHome', '$7,250'));
    act(() => r.current.about.submit());
  };

  it('warm-up → About you (the person’s own age, ZIP and pay enter the profile) → guess; back walks it in reverse', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current).toMatchObject({ step: 'play', stepIndex: 1, stepCount: 9, house: 'empty-plot', reveal: null, analysis: null });
    act(() => result.current.finishWarmup());
    expect(result.current).toMatchObject({ step: 'about', stepIndex: 2 });
    expect(result.current.about.age.value).toBe('');
    act(() => result.current.about.submit());
    expect(result.current.step).toBe('about');
    expect(result.current.about.age.invalid).toBe(true);
    fillAbout(result);
    expect(result.current).toMatchObject({ step: 'guess', stepIndex: 3 });
    const p = useAppStore.getState().profile;
    expect(p.age.value).toBe(41);
    expect(p.zip).toBe('94110');
    expect(p.takeHomePay).toEqual({ value: 7250, isEstimate: false });
    act(() => result.current.back());
    expect(result.current.step).toBe('about');
    act(() => result.current.back());
    expect(result.current.step).toBe('play');
  });

  it('the guess snaps to $1,000 and stays in range; locking it asks for balances, which replace the sample’s debts', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.finishWarmup());
    fillAbout(result);
    act(() => result.current.setGuess(12_345));
    expect(result.current.guess.value).toBe(12_000);
    act(() => result.current.setGuess(10_000_000));
    expect(result.current.guess.value).toBe(GUESS.max);
    act(() => result.current.lockGuess());
    expect(result.current).toMatchObject({ step: 'balances', house: 'house-blueprint' });
    act(() => result.current.balances.setField('cash', '12,000'));
    act(() => result.current.balances.setField('student', '30000'));
    act(() => result.current.balances.submit());
    expect(result.current).toMatchObject({ step: 'connect', stepIndex: 5 });
    const p = useAppStore.getState().profile;
    expect(p.cash.value).toBe(12_000);
    expect(p.retirement.value).toBe(0);
    expect(p.debts.map((d) => [d.kind, d.balance])).toEqual([['student', 30_000]]);
    expect(result.current.banks).toBe(BANKS);
    act(() => result.current.back());
    expect(result.current.step).toBe('balances');
  });

  it('an unknown bank does nothing', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.finishWarmup());
    fillAbout(result);
    act(() => result.current.lockGuess());
    act(() => result.current.balances.submit());
    act(() => result.current.connect('nope'));
    expect(result.current.step).toBe('connect');
  });
});
