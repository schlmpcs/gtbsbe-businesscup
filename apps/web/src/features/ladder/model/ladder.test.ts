// @vitest-environment jsdom
import {
  cardToProfile, costOfLife, lifeCardFromFacts, OWN_LIFE_CARD_ID, statementFollowUps, statementTotals,
  type ClassifiedStatementItem,
} from '@lifeguessr/engine';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type StatementClass } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureGameClient } from '@/features/game/model/fixtureClient';
import { getArea } from '@lifeguessr/data/areas';
import { cloneProfileDemo } from '@/fixtures';
import { cardsSample } from '@/fixtures/cards';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { displayForecast } from '@/lib/model/profile';
import { useAppStore, useGameStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { detectedDebtPayments, useBalanceSheet } from './useBalanceSheet';
import { differentiatorsFor, useClosestLife } from './useClosestLife';
import { guessPayoff } from './useGuessPayoff';
import { useGuessYourself } from './useGuessYourself';
import { useLadderProgress } from './useLadderProgress';
import { useQuickSliders } from './useQuickSliders';
import type { StatementFileResult } from '@/features/upload/model/types';
import { readableLabel, statementSummary, useStatementUpload } from './useStatementUpload';

beforeEach(resetClientState);

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('useGuessYourself (S5)', () => {
  it('saves the slider value as the self guess and summarizes today’s game', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily('2026-11-14');
    useGameStore.getState().startDay('2026-11-14', cards);
    useGameStore.getState().setGuess(cards[0]!.id, 1000);
    useGameStore.getState().setReveal(cards[0]!.id, (await client.guess(cards[0]!.id, 1000)).reveal);

    const { result } = renderHook(() => useGuessYourself({ mode: 'slider' }));
    await waitForReady(result);
    expect(result.current.savedGuess).toBeNull();
    expect(result.current.bridge).toEqual({ played: 1, guessedLow: 1, guessedHigh: 0 });
    act(() => result.current.setGuess(4567));
    expect(result.current.guess.value).toBe(4570);
    act(() => result.current.submit());
    expect(useAppStore.getState().selfGuess).toBe(4570);
    expect(result.current.savedGuess).toBe(4570);
  });

  it('has no bridge line while /play is the duel (the default): a pick has no guessed amount', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily('2026-11-14');
    useGameStore.getState().startDay('2026-11-14', cards);
    useGameStore.getState().setGuess(cards[0]!.id, 1000);
    useGameStore.getState().setReveal(cards[0]!.id, (await client.guess(cards[0]!.id, 1000)).reveal);
    const { result } = renderHook(() => useGuessYourself());
    await waitForReady(result);
    expect(result.current.bridge).toBeNull();
  });

  it('asks only the guess: no estimate while the spending is a sample, the reveal once it is the user\'s own', async () => {
    const { result } = renderHook(() => useGuessYourself());
    await waitForReady(result);
    act(() => result.current.setGuess(3000));
    act(() => result.current.submit());
    // The demo profile has measured categories, but they are the sample family's: no reveal.
    expect(result.current.reveal).toBeNull();
    // After the save, the slider is the guess: one number, no "update" step.
    act(() => result.current.setGuess(3500));
    expect(useAppStore.getState().selfGuess).toBe(3500);
    expect(result.current.guess.value).toBe(3500);

    // A typed category makes the spending the user's own: the reveal appears.
    act(() => useAppStore.getState().setSpending('groceries', 500));
    const p = useAppStore.getState().profile;
    const spending = COST_CATEGORIES.filter((c) => c !== 'debtPayments').reduce((s, c) => s + p.spending[c].value, 0);
    const actual = spending + p.debts.reduce((s, d) => s + d.minPayment.value, 0);
    expect(result.current.reveal).toEqual({ guess: 3500, actual, difference: actual - 3500 });
  });
});

describe('useClosestLife (S6): About you + the starting life from it', () => {
  it('no starting life until a ZIP we have data for; then it is built from the answers and preselected', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    expect(result.current.candidate).toBeNull();
    expect(result.current.about.zip).toBe(''); // the demo profile's ZIP is not shown as the user's
    act(() => result.current.setZip('75216'));
    act(() => result.current.setAdults(2));
    act(() => result.current.setHasCar(false));
    const c = result.current.candidate!;
    expect(c.isNearest).toBe(true);
    expect(c.metro).toBe('Dallas-Fort Worth, TX');
    const facts = { adults: 2 as const, kids: [], bedrooms: 1 as const, hasCar: false };
    const area = getArea('75216');
    expect(c.monthly).toEqual(costOfLife(lifeCardFromFacts(facts, area), area).total);
    expect(useAppStore.getState().profile.householdFacts).toEqual(facts);
    expect(useAppStore.getState().profile.zip).toBe('75216');
  });

  it('age and pay: empty with our typical value as the placeholder until the person gives theirs', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    // The demo profile's 32 / 5,200 are measured, but they are the sample family's: not shown as typed.
    const demo = useAppStore.getState().profile;
    expect(result.current.about.age).toMatchObject({ value: null, estimate: demo.age.value, isEstimate: true });
    expect(result.current.about.takeHomePay).toMatchObject({ value: null, estimate: demo.takeHomePay.value, isEstimate: true });
    // Typing the very value the sample had still counts as typed.
    act(() => result.current.setAge(demo.age.value));
    expect(result.current.about.age).toMatchObject({ value: demo.age.value, isEstimate: false });
    act(() => result.current.setZip('75216'));
    act(() => result.current.choose());
    expect(useAppStore.getState().profile.age).toEqual({ value: demo.age.value, isEstimate: false });
    // The built life's pay is our estimate: still a placeholder, the same as on S8.
    expect(result.current.about.takeHomePay).toMatchObject({ value: null, isEstimate: true });
    expect(useAppStore.getState().profile.takeHomePay.isEstimate).toBe(true);
  });

  it('a ZIP we do not cover uses a covered one with the same first three digits, and says so', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    act(() => result.current.setZip('75299'));
    expect(result.current.about.zipStatus).toBe('nearby');
    expect(result.current.about.areaZip?.slice(0, 3)).toBe('752');
    act(() => result.current.setZip('00501'));
    expect(result.current.about.zipStatus).toBe('none');
    expect(result.current.candidate).toBeNull();
  });

  it('choose builds the profile with cardToProfile and keeps the typed age and pay', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    act(() => result.current.setAge(29));
    act(() => result.current.setTakeHomePay(6000));
    act(() => result.current.setZip('75216'));
    act(() => result.current.choose());
    const area = getArea('75216');
    const built = cardToProfile(lifeCardFromFacts({ adults: 1, kids: [], bedrooms: 1, hasCar: true }, area), area);
    const p = useAppStore.getState().profile;
    expect(p.spending).toEqual(built.spending);
    expect(p.debts).toEqual([]);
    expect(p.age).toEqual({ value: 29, isEstimate: false });
    expect(p.takeHomePay).toEqual({ value: 6000, isEstimate: false });
    expect(useAppStore.getState().profileOrigin).toBe('closestLife');
    expect(result.current.chosenCardId).toBe(OWN_LIFE_CARD_ID);
    // The chosen life follows later answers.
    act(() => result.current.setBedrooms(2));
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBe(area.rentByBedrooms[2].value);
  });

  it('with a statement, the starting life is skipped and choose changes nothing', async () => {
    useAppStore.getState().applyStatementTotals([{ month: '2026-10', totals: totals({ groceries: 400 }), oneOffs: [] }]);
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    act(() => result.current.setZip('75216'));
    expect(result.current.spendingFromStatement).toBe(true);
    expect(result.current.candidate).toBeNull();
    const before = useAppStore.getState().profile.spending;
    act(() => result.current.choose());
    expect(useAppStore.getState().profile.spending).toEqual(before);
  });
});

describe('mixed profile (typed pay + sample spending)', () => {
  it('warns only when the pay is typed and the spending is still the sample family\'s', async () => {
    const { mixedProfileWarning } = await import('./ownLife');
    const base = { profile: cloneProfileDemo(), selfGuess: 3870, closestCardId: null, statementMonths: [] };
    expect(mixedProfileWarning(base)).toBeNull(); // the demo pay is the sample's, not typed
    const typedPay = { ...base.profile, takeHomePay: { value: 6000, isEstimate: false } };
    expect(mixedProfileWarning({ ...base, profile: typedPay })).toEqual({ guess: 3870 });
    expect(mixedProfileWarning({ ...base, profile: typedPay, selfGuess: null })).toEqual({ guess: null });
    const typedRent = { ...typedPay, spending: { ...typedPay.spending, rentUtilities: { value: 1500, isEstimate: false } } };
    expect(mixedProfileWarning({ ...base, profile: typedRent })).toBeNull();
    expect(mixedProfileWarning({ ...base, profile: typedPay, closestCardId: OWN_LIFE_CARD_ID })).toBeNull();
  });

  it('one tap scales the sample spending so the month costs the guess, and the warning goes', async () => {
    const { mixedProfileWarning, spendingScaledToGuess } = await import('./ownLife');
    const e = (value: number) => ({ value, isEstimate: true });
    const profile = {
      ...cloneProfileDemo(),
      takeHomePay: { value: 6000, isEstimate: false },
      spending: {
        rentUtilities: e(2000), car: e(400), childcare: e(0), groceries: e(600), eatingOut: e(300),
        subscriptions: e(100), other: e(600), debtPayments: e(0),
      },
      debts: [{ id: 'card-1', kind: 'card' as const, balance: 3000, apr: 0.2, minPayment: { value: 200, isEstimate: false } }],
    };
    // spending 4000 + payments 200 = 4200; guess 3200 → spending 3000 = 0.75 × each category
    const scaled = spendingScaledToGuess(profile, 3200);
    expect(scaled.spending.rentUtilities).toEqual(e(1500));
    expect(scaled.spending.car).toEqual(e(300));
    expect(scaled.spending.groceries).toEqual(e(450));
    expect(scaled.spending.eatingOut).toEqual(e(225));
    expect(scaled.spending.subscriptions).toEqual(e(75));
    expect(scaled.spending.other).toEqual(e(450));
    expect(scaled.takeHomePay).toEqual(profile.takeHomePay);
    expect(mixedProfileWarning({ profile, selfGuess: 3200, closestCardId: 'sample-01', statementMonths: [] })).toEqual({ guess: 3200 });
    expect(mixedProfileWarning({ profile: scaled, selfGuess: 3200, closestCardId: 'sample-01', statementMonths: [] })).toBeNull();
  });
});

describe('useQuickSliders (S7)', () => {
  it('after a statement import, says which full months the measured values come from', async () => {
    const { result } = renderHook(() => useQuickSliders());
    await waitForReady(result);
    expect(result.current.statementMonths).toEqual([]);
    act(() => useAppStore.getState().applyStatementTotals([
      { month: '2026-09', totals: totals({ groceries: 500 }), oneOffs: [], firstDay: 1, lastDay: 30 },
      { month: '2026-10', totals: totals({ groceries: 600 }), oneOffs: [], firstDay: 1, lastDay: 31 },
      { month: '2026-11', totals: totals({ groceries: 90 }), oneOffs: [], firstDay: 1, lastDay: 6 },
    ]));
    expect(result.current.statementMonths).toEqual(['2026-09', '2026-10']);
    expect(result.current.sliders.find((s) => s.category === 'groceries')).toMatchObject({ value: 550, isEstimate: false });
  });

  it('dragging a slider to the end again and again never grows its range (no runaway)', async () => {
    const { result } = renderHook(() => useQuickSliders());
    await waitForReady(result);
    for (let i = 0; i < 6; i++) {
      const rent = result.current.sliders.find((s) => s.category === 'rentUtilities')!;
      act(() => result.current.setSpending('rentUtilities', rent.max));
    }
    const rent = result.current.sliders.find((s) => s.category === 'rentUtilities')!;
    expect(rent.value).toBe(6000);
    expect(rent.max).toBe(6000);
  });

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

  it('stays on the rules preview, and says so', async () => {
    const { result } = renderHook(() => useQuickSliders());
    await waitForReady(result);
    expect(result.current.in10ySource).toBe('rules');
    expect(result.current.in10y).toEqual(displayForecast(cloneProfileDemo()).in10y); // the engine's, with no request
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
  it('JF4 your home: own fills the home from the area and sets owner costs; mortgage nudge; back to rent', async () => {
    const { result } = renderHook(() => useBalanceSheet());
    await waitForReady(result);
    expect(result.current.home.tenure).toBe('rent');
    expect(result.current.home.summary).toBeNull();
    expect(result.current.home.tenures).toEqual(['rent', 'mortgage', 'outright']);

    act(() => result.current.home.setTenure('mortgage'));
    const s = result.current.home.summary!;
    expect(s.value).toMatchObject({ value: 615_400, isEstimate: true });
    expect(s.value.source?.name).toContain('B25077');
    expect(s.appreciation.source).not.toBeNull();
    expect(s.costs.lines.map((l) => l.key)).toEqual(['propertyTax', 'insurance', 'upkeep', 'hoa', 'utilities']);
    expect(s.costs.total).toBeCloseTo(2049.924, 2); // see profileOps.test (setHome)
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBeCloseTo(2049.924, 2);
    expect(result.current.home.needsMortgage).toBe(true);

    act(() => result.current.home.setHoaMonthly(150));
    expect(result.current.home.summary!.costs.total).toBeCloseTo(2199.924, 2);

    act(() => {
      result.current.addDebt({ kind: 'mortgage', balance: 300_000, apr: 0.065, minPayment: null });
    });
    expect(result.current.home.needsMortgage).toBe(false);
    expect(result.current.debts.find((d) => d.kind === 'mortgage')?.minPayment).toBeCloseTo(1896.2, 1);

    act(() => result.current.home.setTenure('rent'));
    expect(result.current.home.summary).toBeNull();
    expect(useAppStore.getState().profile.home).toBeUndefined();
    expect(useAppStore.getState().profile.spending.rentUtilities).toEqual({ value: 1950, isEstimate: false });
  });

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

  it('the review opens with the average month: over the full months, else all of them', () => {
    const m = (month: string, total: number, averaged: boolean) => ({ month, totals: totals({}), total, oneOffs: [], detectedPay: null, averaged });
    expect(statementSummary([])).toBeNull();
    expect(statementSummary([m('2026-08', 500, true), m('2026-09', 700, true), m('2026-10', 90, false)])).toEqual({ averageMonth: 600, fullMonths: 2 });
    expect(statementSummary([m('2026-10', 90, false)])).toEqual({ averageMonth: 90, fullMonths: 0 });
  });

  it('review exposes the summary; apply clears it', async () => {
    const { result } = renderHook(() => useStatementUpload());
    await waitForReady(result);
    expect(result.current.summary).toBeNull();
    act(() => result.current.submitTotals(months));
    expect(result.current.summary).toEqual({ averageMonth: 630, fullMonths: 3 });
    act(() => result.current.apply());
    expect(result.current.summary).toBeNull();
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
  type FileResult = StatementFileResult;
  /** What readStatementFile gives for months whose lines the server did not describe (no follow-ups). */
  const fileResult = (m: CategoryTotals[]): FileResult => ({ months: m, summary, classified: null, followUps: [] });

  describe('follow-up questions (JF6)', () => {
    // Two full months of a checking account: the rent and pay are clear, Target and an ATM are
    // 'other', and there are no groceries at all (bought with a card that isn't in this file).
    const line = (month: string, day: number, label: string, amount: number, cls: StatementClass): ClassifiedStatementItem =>
      ({ month, day, label, amount, cls, oneOffHint: false });
    const classified = ['2026-09', '2026-10'].flatMap((mo) => [
      line(mo, 1, 'OAKWOOD APTS', 1700, 'rentUtilities'),
      line(mo, 4, 'TARGET # DALLAS TX', 120, 'other'),
      line(mo, 12, 'ATM WITHDRAWAL #/# MAIN ST', 60, 'other'),
      line(mo, 28, 'ACME PAYROLL', -2400, 'pay'),
    ]);
    const readWith = (items: ClassifiedStatementItem[]) => vi.fn(async (): Promise<FileResult> => ({
      months: statementTotals(items), summary, classified: items, followUps: statementFollowUps(items),
    }));

    it('asks them, re-sums the months in code when one is answered, and applies a typed amount as measured', async () => {
      const { result } = renderHook(() => useStatementUpload({ readStatementFile: readWith(classified) }));
      await waitForReady(result);
      await act(async () => result.current.readFile!(file));
      await waitFor(() => expect(result.current.status).toBe('review'));
      expect(result.current.questions.map((q) => [q.id, q.kind, q.merchant, q.category, q.monthly])).toEqual([
        ['missing:groceries', 'missing', null, 'groceries', 0],
        ['cash:cash', 'cash', null, null, 60],
        ['merchant:TARGET DALLAS TX', 'merchant', 'TARGET DALLAS TX', null, 120],
      ]);
      expect(result.current.questions[2]!.options).not.toContain('debtPayments');
      expect(result.current.questions.every((q) => q.answer === null && q.question === null)).toBe(true);
      expect(result.current.pending[1]!.totals).toMatchObject({ groceries: 0, eatingOut: 0, other: 180 });
      expect(result.current.pending.map((m) => m.averaged)).toEqual([true, true]);

      act(() => result.current.answerCategory('merchant:TARGET DALLAS TX', 'groceries'));
      act(() => result.current.answerCategory('cash:cash', 'eatingOut'));
      act(() => result.current.answerAmount('missing:groceries', 450));
      expect(result.current.pending[1]!.totals).toMatchObject({ groceries: 120, eatingOut: 60, other: 0 });
      expect(result.current.pending[1]!.total).toBe(1880);
      expect(result.current.questions.map((q) => q.answer)).toEqual([
        { kind: 'amount', monthly: 450 }, { kind: 'category', category: 'eatingOut' }, { kind: 'category', category: 'groceries' },
      ]);

      act(() => result.current.apply());
      const { profile, statementMonths } = useAppStore.getState();
      // Target and the cash count where the user said; the groceries paid elsewhere are what they typed.
      expect(profile.spending.eatingOut).toEqual({ value: 60, isEstimate: false });
      expect(profile.spending.groceries).toEqual({ value: 450, isEstimate: false });
      expect(profile.spending.other).toEqual({ value: 0, isEstimate: false });
      // The saved months are what the statement shows (with the re-sorting), not the typed amount.
      expect(statementMonths.map((m) => m.totals.groceries)).toEqual([120, 120]);
      expect(result.current.questions).toEqual([]);
    });

    it('skipping keeps the months as sorted and a missing category as it was; answers to unknown ids or wrong kinds are ignored', async () => {
      const before = useAppStore.getState().profile.spending.groceries;
      const { result } = renderHook(() => useStatementUpload({ readStatementFile: readWith(classified) }));
      await waitForReady(result);
      await act(async () => result.current.readFile!(file));
      await waitFor(() => expect(result.current.status).toBe('review'));
      const original = result.current.pending;
      act(() => {
        result.current.skipQuestion('missing:groceries');
        result.current.skipQuestion('merchant:TARGET DALLAS TX');
        result.current.answerCategory('missing:groceries', 'groceries'); // a missing category takes an amount
        result.current.answerAmount('cash:cash', 300);                  // cash takes a category
        result.current.answerCategory('merchant:NOPE', 'groceries');
        result.current.answerCategory('cash:cash', 'debtPayments');     // never assigned
      });
      expect(result.current.pending).toEqual(original);
      expect(result.current.questions.map((q) => q.answer)).toEqual([{ kind: 'skipped' }, null, { kind: 'skipped' }]);
      act(() => result.current.apply());
      expect(useAppStore.getState().profile.spending.groceries).toEqual(before); // never seen: not $0
    });

    it('a new file or discard forgets the questions and the answers', async () => {
      const { result } = renderHook(() => useStatementUpload({ readStatementFile: readWith(classified) }));
      await waitForReady(result);
      await act(async () => result.current.readFile!(file));
      await waitFor(() => expect(result.current.status).toBe('review'));
      act(() => result.current.answerCategory('cash:cash', 'eatingOut'));
      await act(async () => result.current.readFile!(file));
      await waitFor(() => expect(result.current.status).toBe('review'));
      expect(result.current.questions.every((q) => q.answer === null)).toBe(true);
      act(() => result.current.discard());
      expect(result.current.questions).toEqual([]);
    });
  });

  it('readableLabel: masks out, a person as "someone"', () => {
    expect(readableLabel('Zelle to [name]')).toBe('Zelle to someone');
    expect(readableLabel('TARGET # DALLAS TX')).toBe('TARGET DALLAS TX');
    expect(readableLabel('AMAZON MKTPL*[ref] Amzn.com/bill WA')).toBe('AMAZON MKTPL Amzn.com/bill WA');
    expect(readableLabel('ATM WITHDRAWAL #/# GREENVILLE AVE')).toBe('ATM WITHDRAWAL GREENVILLE AVE');
    expect(readableLabel('#')).toBe('#');
  });

  it('readFile: reading → review with what was read → apply clears it', async () => {
    let resolve!: (v: FileResult) => void;
    const readStatementFile = vi.fn(() => new Promise<FileResult>((r) => { resolve = r; }));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile }));
    await waitForReady(result);
    act(() => result.current.readFile!(file));
    expect(result.current.status).toBe('reading');
    expect(readStatementFile).toHaveBeenCalledWith(file, expect.objectContaining({ anonId: expect.any(String), signal: expect.any(AbortSignal) }));
    await act(async () => resolve(fileResult([months[1]!, months[0]!])));
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

  it('trySample: the sample statement goes through the same reader as a picked file, then review', async () => {
    const sample = new File(['Date,Description,Amount'], 'statement.sample.csv', { type: 'text/csv' });
    const fetchSampleStatement = vi.fn(async () => sample);
    const readStatementFile = vi.fn(async () => fileResult([months[0]!]));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile, fetchSampleStatement }));
    await waitForReady(result);
    act(() => result.current.trySample());
    expect(result.current.status).toBe('reading');
    await waitFor(() => expect(result.current.status).toBe('review'));
    expect(readStatementFile).toHaveBeenCalledWith(sample, expect.objectContaining({ anonId: expect.any(String), signal: expect.any(AbortSignal) }));
    expect(result.current.pending.map((m) => m.month)).toEqual(['2026-08']);
  });

  it('trySample: a failed download is an error like any request', async () => {
    const { ApiError } = await import('@/lib/api/http');
    const fetchSampleStatement = vi.fn(async () => { throw new ApiError('GET → 0', 0); });
    const readStatementFile = vi.fn();
    const { result } = renderHook(() => useStatementUpload({ readStatementFile, fetchSampleStatement }));
    await waitForReady(result);
    act(() => result.current.trySample());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ kind: 'network', status: undefined });
    expect(readStatementFile).not.toHaveBeenCalled();
  });

  it('readFile: a newer file wins over one still being read', async () => {
    const resolvers: ((v: FileResult) => void)[] = [];
    const readStatementFile = vi.fn(() => new Promise<FileResult>((r) => { resolvers.push(r); }));
    const { result } = renderHook(() => useStatementUpload({ readStatementFile }));
    await waitForReady(result);
    act(() => result.current.readFile!(file));
    act(() => result.current.readFile!(file));
    await act(async () => resolvers[1]!(fileResult([months[2]!])));
    await act(async () => resolvers[0]!(fileResult([months[0]!])));
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
      ['S9', '/me/upload', false], // your spending: imported from a statement (or set by hand on S7)
      ['S8', '/me/balance', false], // the demo profile has measured fields, but they are a sample
    ]);
    expect(result.current.futureHref).toBe('/start?ch=4');
    expect(result.current.byHandHref).toBe('/me/sliders');
    expect(result.current.in10ySource).toBe('rules'); // the ladder's number is the engine's preview, never the model's

    act(() => useAppStore.getState().setSelfGuess(4000));
    const { result: closest } = renderHook(() => useClosestLife());
    await waitForReady(closest);
    act(() => closest.current.setZip('75216'));
    act(() => closest.current.choose());
    expect(result.current.doneCount).toBe(2);
    // A life card is all estimates: the band is as wide as it gets, nothing narrowed yet.
    const start = result.current;
    expect(start.estimates.left).toBe(start.estimates.total);
    expect(start.bandWidth).toBeCloseTo(start.bandWidthAllEstimated, 6);
    expect(start.bandNarrowed).toBe(0);
    expect(start.in10y.low).toBeLessThanOrEqual(start.in10y.mid);
    expect(start.in10y.mid).toBeLessThanOrEqual(start.in10y.high);

    act(() => useAppStore.getState().setSpending('rentUtilities', 1600));
    // Spending set by hand (S7) completes the spending step, as a statement would.
    expect(result.current.rungs.find((r) => r.screen === 'S9')!.done).toBe(true);
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(false);
    // Age and pay are asked on S6: typing them does not do S8 (savings and debts).
    act(() => useAppStore.getState().setField('takeHomePay', 6000));
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(false);
    expect(result.current.estimates.left).toBe(start.estimates.total - 2);
    act(() => useAppStore.getState().skipField('takeHomePay'));
    act(() => useAppStore.getState().setField('cash', 2500));
    expect(result.current.rungs.find((r) => r.screen === 'S8')!.done).toBe(true);
    act(() => useAppStore.getState().skipField('cash'));
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
    act(() => useAppStore.getState().setField('retirement', 20000));

    act(() =>
      useAppStore.getState().applyStatementTotals([
        { month: '2026-10', totals: totals({ groceries: 600, eatingOut: 150 }), oneOffs: [] },
      ]),
    );
    expect(result.current.rungs.every((r) => r.done)).toBe(true);
    expect(result.current.doneCount).toBe(4);
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

describe('guessPayoff (the S5 guess on later steps)', () => {
  it('null without a guess or against a sample family; an estimate against the built household; measured once own', () => {
    const demo = cloneProfileDemo();
    expect(guessPayoff(null, demo, [], OWN_LIFE_CARD_ID)).toBeNull();
    expect(guessPayoff(3000, demo, [], null)).toBeNull(); // the demo family's month is not the person's
    const area = getArea('75216');
    const built = cardToProfile(lifeCardFromFacts({ adults: 1, kids: [], bedrooms: 1, hasCar: true }, area), area);
    const cost = COST_CATEGORIES.filter((c) => c !== 'debtPayments').reduce((t, c) => t + built.spending[c].value, 0);
    expect(guessPayoff(3000, built, [], OWN_LIFE_CARD_ID)).toEqual({ guess: 3000, actual: cost, difference: cost - 3000, isEstimate: true });
    const month: CategoryTotals = { month: '2026-10', totals: totals({ groceries: 400 }), oneOffs: [] };
    expect(guessPayoff(3000, built, [month], OWN_LIFE_CARD_ID)?.isEstimate).toBe(false);
  });
});

describe('JF13 / JF17 helpers', () => {
  const item = (category: CostCategory, amount: number) => ({
    id: category, category, amount, source: { name: 'test', year: 2026 }, isEstimate: true,
  });
  it('differentiatorsFor: car vs no car, childcare, and the area tier among same-size cards', () => {
    const chips = differentiatorsFor([
      { available: true, bedrooms: 1, carPrice: null, items: [item('rentUtilities', 1000)] },
      { available: true, bedrooms: 1, carPrice: 62000, items: [item('rentUtilities', 2000), item('car', 1300)] },
      { available: true, bedrooms: 2, carPrice: 18000, items: [item('rentUtilities', 1500), item('car', 600), item('childcare', 1100)] },
      { available: false, bedrooms: 1, carPrice: null, items: [] },
    ]);
    expect(chips[0]).toEqual([{ kind: 'noCar' }, { kind: 'cheaperArea', amount: 1000 }]);
    expect(chips[1]).toEqual([{ kind: 'car', amount: 1300 }, { kind: 'pricierArea', amount: 2000 }]);
    expect(chips[2]).toEqual([{ kind: 'childcare', amount: 1100 }]);
    expect(chips[3]).toEqual([]);
  });
  it('detectedDebtPayments: mean over the statement months that have debt payments', () => {
    expect(detectedDebtPayments([])).toBeNull();
    expect(detectedDebtPayments([{ totals: { groceries: 300 } }])).toBeNull();
    expect(detectedDebtPayments([{ totals: { debtPayments: 400 } }, { totals: { debtPayments: 200 } }, { totals: {} }])).toEqual({
      monthlyPayment: 300,
      months: 2,
    });
  });
});
