// @vitest-environment jsdom
// /start onboarding: the reveal (pure), the step order and the bank-first flow. Here the statement
// read (bankDemo/fillAll) and the sample download are faked so the order, the prefill from the
// statement's balance and the confirmed form can be checked; e2e/onboarding.spec.ts runs the same
// flow end to end through the real parser and categorizer.
import { useAppStore } from '@/state';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { welcome as copy } from '@/copy';
import { fillFromStatement } from '@/features/bankDemo/model/fillAll';
import type { StatementMonthVM } from '@/features/ladder/model/types';
import type { StatementFileResult } from '@/features/upload/model/types';
import { clearAccounts, initAccounts } from '@/lib/model/accounts';
import { analysisRows, BANKS, GUESS, revealOf, useOnboarding } from './useOnboarding';

vi.mock('@/features/bankDemo/model/fillAll', () => ({ fillFromStatement: vi.fn() }));
vi.mock('@/features/upload/model/sampleStatement', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/upload/model/sampleStatement')>()),
  fetchSampleStatement: async () => new File(['sample'], 'statement.sample.csv', { type: 'text/csv' }),
}));

/** What the faked read of a statement gives: one month of spending with a paycheck. */
const MONTH: CategoryTotals = {
  month: '2026-10',
  totals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, c === 'rentUtilities' ? 1800 : c === 'groceries' ? 400 : 0])) as CategoryTotals['totals'],
  oneOffs: [],
  detectedPay: 5200,
};
const READ = {
  months: [MONTH],
  summary: { transactions: 120, skippedPending: 0, skippedOther: 0, from: '2026-10-01', to: '2026-10-31', convention: 'signed', categorizedBy: 'rules' },
  classified: null,
  followUps: [],
  findings: { incomes: [], debts: [] },
} as unknown as StatementFileResult;
/** The statement's last Balance (null: the file has no Balance column). */
let statementBalance: number | null = 7339.8;

beforeEach(() => {
  statementBalance = 7339.8;
  vi.mocked(fillFromStatement).mockReset();
  vi.mocked(fillFromStatement).mockImplementation(async () => ({
    read: READ, imported: { added: 0, duplicates: 0, summary: READ.summary, followUps: [] }, balance: statementBalance,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.getState().reset();
  clearAccounts();
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
  type R = { current: ReturnType<typeof useOnboarding> };
  const fillAbout = (r: R) => {
    act(() => r.current.about.setField('age', '41'));
    act(() => r.current.about.setField('zip', '94110'));
    act(() => r.current.about.setField('takeHome', '$7,250'));
    act(() => r.current.about.submit());
  };
  const toConnect = (r: R) => {
    act(() => r.current.finishWarmup());
    fillAbout(r);
    act(() => r.current.lockGuess());
  };
  /** Move the clock in small acts, so effects (which schedule the next timers) run in between. */
  const advance = async (ms: number) => {
    for (let t = 0; t < ms; t += 250) await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  };
  /** Let the connection, the read and the analysis run to the end. */
  const runAll = () => advance(30_000);

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

  it('the guess snaps to $1,000 and stays in range; locking it opens the bank connection first; back returns to the guess', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.finishWarmup());
    fillAbout(result);
    act(() => result.current.setGuess(12_345));
    expect(result.current.guess.value).toBe(12_000);
    act(() => result.current.setGuess(10_000_000));
    expect(result.current.guess.value).toBe(GUESS.max);
    act(() => result.current.lockGuess());
    expect(result.current).toMatchObject({ step: 'connect', stepIndex: 4, house: 'house-blueprint' });
    expect(result.current.banks).toBe(BANKS);
    act(() => result.current.back());
    expect(result.current.step).toBe('guess');
  });

  it('a bank: connecting → analyzing → found, Checking & savings prefilled from the statement’s balance, the rest empty', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    act(() => result.current.connect('chase'));
    expect(result.current).toMatchObject({ step: 'connecting', stepIndex: 4, connecting: { bankName: 'Chase', source: 'bank' } });
    await advance(5_000);
    expect(result.current).toMatchObject({ step: 'analyzing', stepIndex: 5 });
    await runAll();
    expect(result.current).toMatchObject({ step: 'found', stepIndex: 6, house: 'house-build', reveal: null });
    // The statement keeps the typed pay and writes no balance: the form is where balances are confirmed.
    expect(vi.mocked(fillFromStatement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fillFromStatement).mock.calls[0]![1]).toBe('Chase');
    expect(vi.mocked(fillFromStatement).mock.calls[0]![3]).toEqual({ keepTyped: { takeHomePay: 7250 } });
    const b = result.current.balances;
    expect(b.own.map((f) => [f.id, f.value])).toEqual([['cash', '7,340'], ['retirement', '']]);
    expect(b.own[0]!.tag).toBe(copy.balances.from.bank('Chase'));
    expect(b.own[1]!.tag).toBeUndefined();
    expect(b.owe.map((f) => f.value)).toEqual(['', '', '', '']);
    expect(b.note).toBe(copy.balances.elsewhere.bank('Chase'));
    expect(b.canSubmit).toBe(true);
  });

  it('the confirmed form is what the reveal uses, and the statement does not overwrite it afterwards', async () => {
    vi.useFakeTimers();
    initAccounts();
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    act(() => result.current.connect('chase'));
    await runAll();
    expect(result.current.step).toBe('found');
    act(() => result.current.balances.setField('cash', '5,000'));
    act(() => result.current.balances.setField('student', '30000'));
    act(() => result.current.balances.submit());
    expect(result.current).toMatchObject({ step: 'reveal', stepIndex: 7 });
    await runAll();
    expect(result.current.step).toBe('reveal');
    expect(vi.mocked(fillFromStatement)).toHaveBeenCalledTimes(1);
    const p = useAppStore.getState().profile;
    expect(p.cash.value).toBe(5_000);
    expect(p.retirement.value).toBe(0);
    expect(p.debts.map((d) => [d.kind, d.balance])).toEqual([['student', 30_000]]);
    expect(p.takeHomePay.value).toBe(7_250);
    expect(result.current.reveal).toMatchObject({ netWorthLabel: '−$25,000', ownLabel: '$5,000', oweLabel: '$30,000' });
  });

  it('a statement without a Balance column leaves Checking & savings empty, untagged', async () => {
    vi.useFakeTimers();
    statementBalance = null;
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    act(() => result.current.connect('wells'));
    await runAll();
    expect(result.current.step).toBe('found');
    expect(result.current.balances.own[0]).toMatchObject({ id: 'cash', value: '' });
    expect(result.current.balances.own[0]!.tag).toBeUndefined();
    expect(result.current.balances.note).toBe(copy.balances.elsewhere.bank('Wells Fargo'));
  });

  it('back follows the new order: analyzing → connect, found → connect, reveal → found (the form kept)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    act(() => result.current.connect('chase'));
    await advance(5_000);
    expect(result.current.step).toBe('analyzing');
    act(() => result.current.back());
    expect(result.current.step).toBe('connect');
    await runAll();
    expect(result.current.step).toBe('connect'); // the analysis timers were cleared
    act(() => result.current.connect('chase'));
    await runAll();
    expect(result.current.step).toBe('found');
    act(() => result.current.balances.setField('retirement', '30,000'));
    act(() => result.current.balances.submit());
    expect(result.current.step).toBe('reveal');
    act(() => result.current.back());
    expect(result.current.step).toBe('found');
    expect(result.current.balances.own.map((f) => f.value)).toEqual(['7,340', '30,000']);
    act(() => result.current.back());
    expect(result.current.step).toBe('connect');
  });

  it('an uploaded statement takes the same path: reading → analyzing → found, prefilled from the file’s balance', async () => {
    vi.useFakeTimers();
    statementBalance = 1536.76;
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    const file = new File(['Date,Description,Amount,Balance'], 'my-bank.csv', { type: 'text/csv' });
    act(() => result.current.upload(file));
    expect(result.current).toMatchObject({ step: 'connecting', stepIndex: 4, connecting: { source: 'file' } });
    await runAll();
    expect(result.current.step).toBe('found');
    expect(vi.mocked(fillFromStatement).mock.calls[0]![0]).toBe(file);
    expect(vi.mocked(fillFromStatement).mock.calls[0]![3]).toEqual({ keepTyped: { takeHomePay: 7250 } });
    expect(result.current.balances.own[0]).toMatchObject({ value: '1,537', tag: copy.balances.from.file });
    expect(result.current.balances.note).toBe(copy.balances.elsewhere.file);
  });

  it('an unknown bank does nothing', () => {
    const { result } = renderHook(() => useOnboarding());
    toConnect(result);
    act(() => result.current.connect('nope'));
    expect(result.current.step).toBe('connect');
    expect(vi.mocked(fillFromStatement)).not.toHaveBeenCalled();
  });
});
