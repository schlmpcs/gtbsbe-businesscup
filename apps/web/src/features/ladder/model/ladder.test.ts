// @vitest-environment jsdom
import { cardToProfile, costOfLife } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureGameClient } from '@/features/game/model/client';
import { getArea } from '@lifeguessr/data/areas';
import { cardById, cardsSample } from '@/fixtures';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { thisMonth } from '@/lib/model/profile';
import { useAppStore, useGameStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { useBalanceSheet } from './useBalanceSheet';
import { useClosestLife } from './useClosestLife';
import { useGuessYourself } from './useGuessYourself';
import { useLadderProgress } from './useLadderProgress';
import { useQuickSliders } from './useQuickSliders';
import { useStatementUpload } from './useStatementUpload';

beforeEach(resetClientState);

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('useGuessYourself (S5)', () => {
  it('saves the slider value as the self guess and summarizes today’s game', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily('2026-11-14');
    useGameStore.getState().startDay('2026-11-14', cards);
    useGameStore.getState().setGuess(cards[0]!.id, 1000);
    useGameStore.getState().setReveal(cards[0]!.id, await client.guess(cards[0]!.id, 1000));

    const { result } = renderHook(() => useGuessYourself());
    await waitForReady(result);
    expect(result.current.savedGuess).toBeNull();
    expect(result.current.bridge).toEqual({ played: 1, guessedLow: 1, guessedHigh: 0 });
    act(() => result.current.setGuess(4567));
    expect(result.current.guess.value).toBe(4570);
    act(() => result.current.submit());
    expect(useAppStore.getState().selfGuess).toBe(4570);
    expect(result.current.savedGuess).toBe(4570);
  });

  it('compares the saved guess with the engine month of the current profile', async () => {
    const { result } = renderHook(() => useGuessYourself());
    await waitForReady(result);
    expect(result.current.comparison).toBeNull();
    act(() => result.current.setGuess(3000));
    act(() => result.current.submit());
    const month = thisMonth(useAppStore.getState().profile);
    const estimate = month.spending + month.debtPayments;
    expect(result.current.comparison).toEqual({
      guess: 3000,
      estimate,
      isEstimate: true, // the demo profile has estimated categories and an estimated card minimum
      basis: 'demo',
      difference: 3000 - estimate,
      differenceShare: (3000 - estimate) / estimate,
      direction: 3000 > estimate ? 'above' : 'below',
    });

    act(() => useAppStore.getState().setSelfGuess(estimate)); // the comparison follows the saved guess
    expect(result.current.comparison).toMatchObject({ difference: 0, differenceShare: 0, direction: 'match' });
  });
});

describe('useClosestLife (S6)', () => {
  it('offers sample lives when the game was not played, nearest to the self guess first', async () => {
    useAppStore.getState().setSelfGuess(4000);
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    const { candidates } = result.current;
    expect(candidates).toHaveLength(cardsSample.length);
    expect(candidates.every((c) => !c.fromToday && c.available)).toBe(true);
    const dist = (mid: number) => Math.abs(Math.log(mid / 4000));
    expect(dist(candidates[0]!.monthly.mid)).toBeLessThanOrEqual(dist(candidates[1]!.monthly.mid));
    expect(result.current.nearestCardId).toBe(candidates[0]!.cardId);
    const card = cardById(candidates[0]!.cardId);
    const cost = costOfLife(card, getArea(card.zip));
    expect(candidates[0]!.monthly).toEqual(cost.total);
    // Cost lines with sources, largest first, unique ids, summing to the mid.
    const { items } = candidates[0]!;
    expect(items).toHaveLength(cost.items.length);
    expect(items.every((i, n) => n === 0 || items[n - 1]!.amount >= i.amount)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.every((i) => i.source.name.length > 0)).toBe(true);
    expect(items.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(cost.total.mid, 6);
  });

  it('choose builds the profile with cardToProfile', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    const id = cardsSample[3]!.id;
    act(() => result.current.choose(id));
    const card = cardById(id);
    expect(useAppStore.getState().profile).toEqual(cardToProfile(card, getArea(card.zip)));
    expect(useAppStore.getState().profileOrigin).toBe('closestLife');
    expect(result.current.chosenCardId).toBe(id);
  });
});

describe('useQuickSliders (S7)', () => {
  it('sliders patch spending as measured values and the month updates from the engine', async () => {
    const { result } = renderHook(() => useQuickSliders());
    await waitForReady(result);
    const eat = result.current.sliders.find((s) => s.category === 'eatingOut')!;
    expect(eat).toMatchObject({ value: 340, isEstimate: true, min: 0, max: 1500 });
    const before = result.current.month.spending;
    const in10yBefore = result.current.in10y.mid;

    act(() => result.current.setSpending('eatingOut', 143));
    const after = result.current.sliders.find((s) => s.category === 'eatingOut')!;
    expect(after).toMatchObject({ value: 140, isEstimate: false });
    expect(result.current.month.spending).toBeCloseTo(before - 200, 6);
    expect(result.current.in10y.mid).toBeGreaterThan(in10yBefore);
    expect(result.current.monthlyCost).toBeCloseTo(result.current.month.spending + result.current.month.debtPayments, 6);
    expect(result.current.guessGap).toBe(result.current.selfGuess === null ? null : result.current.monthlyCost - result.current.selfGuess);

    act(() => result.current.setSavingsShare(0.123));
    expect(result.current.savings).toMatchObject({ value: 0.12, isEstimate: false });
  });

  it('free text: parse, show for confirmation, apply only on confirm', async () => {
    const parse = vi.fn(async () => ({ value: { spending: { rentUtilities: 1800 } }, inferred: [] })) as unknown as ParseFn;
    const { result } = renderHook(() => useQuickSliders({ parse }));
    await waitForReady(result);
    act(() => result.current.parse.setText('rent is 1800'));
    act(() => result.current.parse.submit());
    await waitFor(() => expect(result.current.parse.status).toBe('confirming'));
    expect(result.current.parse.parsed).toEqual({ spending: { rentUtilities: 1800 } });
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBe(1950); // not yet
    act(() => result.current.parse.confirm());
    expect(useAppStore.getState().profile.spending.rentUtilities).toEqual({ value: 1800, isEstimate: false });
    expect(result.current.parse.status).toBe('idle');
    expect(parse).toHaveBeenCalledWith('life', 'rent is 1800', expect.objectContaining({ debts: expect.any(Array) }));
  });

  it('parsed values become confirmation rows with today’s value and the inferred flag', async () => {
    const parse = vi.fn(async () => ({
      value: {
        spending: { eatingOut: 200, rentUtilities: 1800 },
        debts: [{ id: 'card-1', apr: 0.24 }, { id: 'gone-1', extraPayment: 50 }],
        retirementShare: 0.1,
      },
      inferred: ['spending.eatingOut', 'debts.0.apr'],
    })) as unknown as ParseFn;
    const { result } = renderHook(() => useQuickSliders({ parse }));
    await waitForReady(result);
    expect(result.current.parsedRows).toEqual([]);
    act(() => result.current.parse.setText('rent 1800, eat out a bit, card around 24%, save 10%'));
    act(() => result.current.parse.submit());
    await waitFor(() => expect(result.current.parse.status).toBe('confirming'));
    expect(result.current.parsedRows).toEqual([
      { path: 'spending.rentUtilities', target: { kind: 'spending', category: 'rentUtilities' }, value: 1800, unit: 'money', current: 1950, inferred: false },
      { path: 'spending.eatingOut', target: { kind: 'spending', category: 'eatingOut' }, value: 200, unit: 'money', current: 340, inferred: true },
      { path: 'debts.0.apr', target: { kind: 'debtApr', debtId: 'card-1', debtKind: 'card' }, value: 0.24, unit: 'rate', current: 0.2436, inferred: true },
      { path: 'debts.1.extraPayment', target: { kind: 'debtExtraPayment', debtId: 'gone-1', debtKind: null }, value: 50, unit: 'money', current: null, inferred: false },
      { path: 'retirementShare', target: { kind: 'retirementShare' }, value: 0.1, unit: 'rate', current: 0, inferred: false },
    ]);
    act(() => result.current.parse.cancel());
    expect(result.current.parsedRows).toEqual([]);
  });
});

describe('useBalanceSheet (S8)', () => {
  it('typed fields are measured, skipped ones estimates; debts and debt load from the engine', async () => {
    const { result } = renderHook(() => useBalanceSheet());
    await waitForReady(result);
    expect(result.current.fields.age).toEqual({ value: 32, isEstimate: false });
    expect(result.current.netWorth).toBeCloseTo(3800 + 14500 - 6400 - 17800, 6);
    // (193.92 + 412) / 5200 ≈ 0.1165 → green
    expect(result.current.debtLoad.value).toBeCloseTo((193.92 + 412) / 5200, 2);
    expect(result.current.debtLoad.zone).toBe('green');

    act(() => result.current.setField('retirement', 20000));
    expect(result.current.fields.retirement).toEqual({ value: 20000, isEstimate: false });
    act(() => result.current.skipField('cash'));
    expect(result.current.fields.cash).toEqual({ value: 3800, isEstimate: true });

    let id = '';
    act(() => {
      id = result.current.addDebt({ kind: 'student', balance: 30000, apr: 0.05, minPayment: 900 });
    });
    expect(result.current.debts.find((d) => d.id === id)).toMatchObject({ kind: 'student', minPayment: 900, minPaymentIsEstimate: false });
    // (193.92 + 412 + 900) / 5200 ≈ 0.29 → yellow (0.20–0.36)
    expect(result.current.debtLoad.value).toBeCloseTo(1505.92 / 5200, 2);
    expect(result.current.debtLoad.zone).toBe('yellow');
  });

  it('clamps typed values to what the profile contract accepts', async () => {
    const { result } = renderHook(() => useBalanceSheet());
    await waitForReady(result);
    expect(result.current.fieldBounds.age).toEqual({ min: 16, max: 110, step: 1 });
    expect(result.current.debtBounds.apr).toMatchObject({ min: 0, max: 1 });
    expect(result.current.debtKinds).toContain('student');
    expect(result.current.debtLoadMax).toBeGreaterThan(result.current.debtLoad.thresholds.red);

    act(() => result.current.setField('age', 3)); // first digit of "34" while typing
    expect(result.current.fields.age).toEqual({ value: 16, isEstimate: false });
    act(() => result.current.setField('age', 34.6));
    expect(result.current.fields.age.value).toBe(35);
    act(() => result.current.setField('retirement', -50));
    expect(result.current.fields.retirement.value).toBe(0);
    act(() => result.current.setField('cash', -1200)); // an overdraft is allowed
    expect(result.current.fields.cash.value).toBe(-1200);
    act(() => result.current.setField('cash', Number.NaN));
    expect(result.current.fields.cash.value).toBe(-1200);

    let id = '';
    act(() => {
      id = result.current.addDebt({ kind: 'personal', balance: -10, apr: 22.8, minPayment: null });
    });
    expect(result.current.debts.find((d) => d.id === id)).toMatchObject({ balance: 0, apr: 1, minPaymentIsEstimate: true });
    act(() => result.current.updateDebt(id, { kind: 'personal', balance: 5000, apr: 0.12, minPayment: -5 }));
    expect(result.current.debts.find((d) => d.id === id)).toMatchObject({ balance: 5000, apr: 0.12, minPayment: 0, minPaymentIsEstimate: false });
    let bad = 'x';
    act(() => {
      bad = result.current.addDebt({ kind: 'card', balance: Number.NaN, apr: 0.2, minPayment: null });
    });
    expect(bad).toBe('');
    act(() => result.current.removeDebt(id));
    expect(result.current.debts.some((d) => d.id === id)).toBe(false);
  });
});

describe('useStatementUpload (S9)', () => {
  const months: CategoryTotals[] = [
    { month: '2026-08', totals: totals({ groceries: 500, subscriptions: 30 }), oneOffs: [], detectedPay: 5400 },
    { month: '2026-09', totals: totals({ groceries: 600, subscriptions: 30 }), oneOffs: [{ label: 'SOFA', amount: 800 }] },
    { month: '2026-10', totals: totals({ groceries: 700, subscriptions: 30 }), oneOffs: [] },
  ];

  it('review then apply merges totals as measured values', async () => {
    const { result } = renderHook(() => useStatementUpload());
    await waitForReady(result);
    expect(result.current.status).toBe('idle');
    act(() => result.current.submitTotals([months[2]!, months[0]!, months[1]!]));
    expect(result.current.status).toBe('review');
    expect(result.current.pending.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.current.pending[0]!.total).toBe(530);
    expect(result.current.whatWeKeep).toMatchObject({ months: ['2026-08', '2026-09', '2026-10'], takeHomePay: true, savedProfileToServer: false });
    expect(result.current.readFile).toBeTypeOf('function'); // the T6/T7 CSV reader
    expect(useAppStore.getState().statementMonths).toEqual([]); // nothing until apply

    act(() => result.current.apply());
    expect(result.current.status).toBe('applied');
    expect(result.current.history).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.current.hasDriftHistory).toBe(true);
    const p = useAppStore.getState().profile;
    expect(p.spending.groceries).toEqual({ value: 600, isEstimate: false });
    expect(p.takeHomePay).toEqual({ value: 5400, isEstimate: false });
    expect(useAppStore.getState().subscriptionsDetected).toBe(true);
  });

  it('rejects malformed totals', async () => {
    const { result } = renderHook(() => useStatementUpload());
    await waitForReady(result);
    act(() => result.current.submitTotals([{ month: 'Oct', totals: {}, oneOffs: [] } as unknown as CategoryTotals]));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual({ kind: 'badInput' });
  });

  const summary = {
    transactions: 120, skippedPending: 2, skippedOther: 1, from: '2026-08-01', to: '2026-10-31',
    convention: 'outflowNegative' as const, categorizedBy: 'rules' as const,
  };
  const file = new File(['Date,Description,Amount'], 'statement.csv', { type: 'text/csv' });

  it('readFile: reading → review with what was read → apply clears it', async () => {
    let resolve!: (v: { months: CategoryTotals[]; summary: typeof summary }) => void;
    const readStatementFile = vi.fn(() => new Promise<{ months: CategoryTotals[]; summary: typeof summary }>((r) => { resolve = r; }));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile }));
    await waitForReady(result);
    act(() => result.current.readFile!(file));
    expect(result.current.status).toBe('reading');
    expect(readStatementFile).toHaveBeenCalledWith(file, expect.objectContaining({ anonId: expect.any(String), signal: expect.any(AbortSignal) }));
    await act(async () => resolve({ months: [months[1]!, months[0]!], summary }));
    expect(result.current.status).toBe('review');
    expect(result.current.pending.map((m) => m.month)).toEqual(['2026-08', '2026-09']);
    expect(result.current.lastRead).toEqual({
      transactions: 120, skippedPending: 2, skippedOther: 1, from: '2026-08-01', to: '2026-10-31', categorizedBy: 'rules',
    });
    act(() => result.current.apply());
    expect(result.current.status).toBe('applied');
    expect(result.current.lastRead).toBeNull();
    expect(useAppStore.getState().statementMonths.map((m) => m.month)).toEqual(['2026-08', '2026-09']);
  });

  it('readFile: a file that cannot be read becomes an "unreadable" error; a failed request a VMError', async () => {
    const { StatementFileError } = await import('@/features/upload/model/readStatementFile');
    const readStatementFile = vi.fn()
      .mockRejectedValueOnce(new StatementFileError('noColumns', 'x'))
      .mockRejectedValueOnce(new (await import('@/lib/api/http')).ApiError('POST → 429', 429));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile }));
    await waitForReady(result);
    await act(async () => result.current.readFile!(file));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ kind: 'unreadable', reason: 'noColumns' });
    act(() => result.current.discard());
    expect(result.current.status).toBe('idle');
    await act(async () => result.current.readFile!(file));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'rateLimited' }));
  });

  it('readFile: a newer file wins over one still being read', async () => {
    const resolvers: ((v: { months: CategoryTotals[]; summary: typeof summary }) => void)[] = [];
    const readStatementFile = vi.fn(() => new Promise<{ months: CategoryTotals[]; summary: typeof summary }>((r) => { resolvers.push(r); }));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile }));
    await waitForReady(result);
    act(() => result.current.readFile!(file));
    act(() => result.current.readFile!(file));
    await act(async () => resolvers[1]!({ months: [months[2]!], summary }));
    await act(async () => resolvers[0]!({ months: [months[0]!], summary }));
    expect(result.current.pending.map((m) => m.month)).toEqual(['2026-10']);
  });
});

describe('useLadderProgress', () => {
  it('marks rungs done as the user climbs and the band narrows as estimates become real', async () => {
    const { result } = renderHook(() => useLadderProgress());
    await waitForReady(result);
    expect(result.current.rungs.map((r) => [r.screen, r.href, r.done])).toEqual([
      ['S5', '/me/guess', false],
      ['S6', '/me/closest', false],
      ['S7', '/me/sliders', false],
      ['S8', '/me/balance', false], // the demo profile has measured fields, but they are a sample
      ['S9', '/me/upload', false],
    ]);
    expect(result.current.futureHref).toBe('/future');

    act(() => useAppStore.getState().setSelfGuess(4000));
    const { result: closest } = renderHook(() => useClosestLife());
    await waitForReady(closest);
    act(() => closest.current.choose(closest.current.nearestCardId!));
    expect(result.current.doneCount).toBe(2);
    // A life card is all estimates: the band is as wide as it gets, nothing narrowed yet.
    const start = result.current;
    expect(start.estimates.left).toBe(start.estimates.total);
    expect(start.bandWidth).toBeCloseTo(start.bandWidthAllEstimated, 6);
    expect(start.bandNarrowed).toBe(0);
    expect(start.in10y.low).toBeLessThanOrEqual(start.in10y.mid);
    expect(start.in10y.mid).toBeLessThanOrEqual(start.in10y.high);

    act(() => useAppStore.getState().setSpending('rentUtilities', 1600));
    expect(result.current.rungs.find((r) => r.screen === 'S7')!.done).toBe(true);
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(false);
    act(() => useAppStore.getState().setField('takeHomePay', 6000));
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(true);
    expect(result.current.estimates.left).toBe(start.estimates.total - 2);
    act(() => useAppStore.getState().skipField('takeHomePay'));
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(false);
    // Adding a debt counts, even with its minimum payment left to us (an estimate).
    let id = '';
    act(() => {
      id = useAppStore.getState().addDebt({ kind: 'student', balance: 20000, apr: 0.05, minPayment: null });
    });
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(true);
    // One more input (its minimum is estimated) and one fewer estimate (rent): back to `total` left.
    expect(result.current.estimates).toEqual({ left: start.estimates.total, total: start.estimates.total + 1 });
    act(() => useAppStore.getState().removeDebt(id));
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(false);
    act(() => useAppStore.getState().setField('takeHomePay', 6000));
    expect(result.current.bandWidth).toBeLessThan(result.current.bandWidthAllEstimated);
    expect(result.current.bandNarrowed).toBeGreaterThan(0);

    act(() =>
      useAppStore.getState().applyStatementTotals([
        { month: '2026-10', totals: totals({ groceries: 600, eatingOut: 150 }), oneOffs: [] },
      ]),
    );
    expect(result.current.rungs.every((r) => r.done)).toBe(true);
    expect(result.current.doneCount).toBe(5);
  });

  it('a fully measured profile has no band left', async () => {
    const { result } = renderHook(() => useLadderProgress());
    await waitForReady(result);
    act(() => {
      const s = useAppStore.getState();
      for (const f of ['age', 'takeHomePay', 'cash', 'retirement', 'retirementShare'] as const) s.setField(f, s.profile[f].value);
      for (const c of COST_CATEGORIES) s.setSpending(c, s.profile.spending[c].value);
      for (const d of useAppStore.getState().profile.debts) {
        s.updateDebt(d.id, { kind: d.kind, balance: d.balance, apr: d.apr, minPayment: d.minPayment.value });
      }
    });
    expect(result.current.estimates.left).toBe(0);
    expect(result.current.bandWidth).toBeCloseTo(0, 6);
    expect(result.current.bandNarrowed).toBe(1);
  });
});

describe('debtsChanged / startingDebts', () => {
  it('compares the debts with the starting profile', async () => {
    const { debtsChanged, startingDebts } = await import('./useLadderProgress');
    const demo = startingDebts(null, cardsSample)!;
    expect(demo.map((d) => d.id)).toEqual(['card-1', 'auto-1']);
    expect(debtsChanged(demo, demo)).toBe(false);
    expect(debtsChanged(demo, demo.slice(1))).toBe(true);
    expect(debtsChanged(demo, demo.map((d) => (d.id === 'card-1' ? { ...d, apr: 0.2 } : d)))).toBe(true);
    expect(debtsChanged(null, [])).toBe(false);
    expect(startingDebts('no-such-card', cardsSample)).toBeNull();
    const withCar = cardsSample.find((c) => c.car)!;
    expect(startingDebts(withCar.id, cardsSample)).toEqual(cardToProfile(withCar, getArea(withCar.zip)).debts);
  });
});
