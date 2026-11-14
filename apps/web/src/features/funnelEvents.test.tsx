// @vitest-environment jsdom
// The funnel events each view-model sends (T8). The game's are in game/model/usePlay.test.ts.
import { COST_CATEGORIES, type ClientFunnelEvent, type EventsRequest } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAfford } from '@/features/afford/model/useAfford';
import { useFuture } from '@/features/forecast/model/useFuture';
import { useBalanceSheet } from '@/features/ladder/model/useBalanceSheet';
import { useClosestLife } from '@/features/ladder/model/useClosestLife';
import { useGuessYourself } from '@/features/ladder/model/useGuessYourself';
import { useQuickSliders } from '@/features/ladder/model/useQuickSliders';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import { useLoanLab } from '@/features/loan/model/useLoanLab';
import { flushEvents, queuedEventsForTests, resetEventsForTests } from '@/lib/events';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { flush, resetClientState, waitForReady } from '@/test/clientState';

let sent: EventsRequest[] = [];
beforeEach(() => {
  resetClientState();
  sent = [];
  resetEventsForTests(async (batch) => {
    sent.push(batch);
    return 'sent';
  });
});

/** Everything tracked so far, without the per-event ids. */
async function tracked(): Promise<ClientFunnelEvent[]> {
  while (queuedEventsForTests().length > 0) await flushEvents();
  return sent.flatMap((b) => b.events).map(({ id: _id, ...e }) => e as ClientFunnelEvent);
}

describe('ladder view-models', () => {
  it('track each rung once, when the user acts on it (not when they only look)', async () => {
    const guess = renderHook(() => useGuessYourself());
    const closest = renderHook(() => useClosestLife());
    const sliders = renderHook(() => useQuickSliders());
    const balance = renderHook(() => useBalanceSheet());
    const upload = renderHook(() => useStatementUpload());
    for (const h of [guess, closest, sliders, balance, upload]) await waitForReady(h.result);
    expect(await tracked()).toEqual([]);

    act(() => guess.result.current.submit());
    act(() => guess.result.current.submit());
    act(() => closest.result.current.setZip('75216'));
    act(() => closest.result.current.choose());
    act(() => sliders.result.current.setSpending('eatingOut', 400));
    act(() => sliders.result.current.setSpending('groceries', 700));
    act(() => sliders.result.current.setSavingsShare(0.1));
    act(() => balance.result.current.setField('age', 34));
    act(() => balance.result.current.addDebt({ kind: 'student', balance: 20_000, apr: 0.05, minPayment: null }));
    const totals = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 100])) as Record<(typeof COST_CATEGORIES)[number], number>;
    act(() => upload.result.current.submitTotals([
      { month: '2026-09', totals, oneOffs: [] },
      { month: '2026-10', totals, oneOffs: [], detectedPay: 4_800 },
    ]));
    act(() => upload.result.current.apply());

    expect(await tracked()).toEqual([
      { name: 'own_guess_submitted' },
      { name: 'closest_life_chosen', props: { fromToday: false } },
      { name: 'sliders_adjusted' },
      { name: 'balance_sheet_edited' },
      { name: 'statement_applied', props: { months: 2 } },
    ]);
  });
});

describe('screens that count a view', () => {
  it('forecast, Loan Lab and Can I Afford It? each count once, Loan Lab with its offers', async () => {
    const future = renderHook(() => useFuture());
    await waitForReady(future.result);
    future.rerender();
    const lab = renderHook(() => useLoanLab());
    await waitForReady(lab.result);
    const afford = renderHook(() => useAfford());
    await waitForReady(afford.result);
    expect((await tracked()).map((e) => e.name)).toEqual(['forecast_viewed', 'loan_compared']);
    expect((await tracked()).find((e) => e.name === 'loan_compared')).toEqual({ name: 'loan_compared', props: { offers: 3 } });

    // Can I Afford It? counts once a purchase has a verdict.
    act(() => afford.result.current.setAmount(300));
    act(() => afford.result.current.setAmount(30_000));
    expect((await tracked()).filter((e) => e.name === 'afford_checked')).toEqual([{ name: 'afford_checked', props: { verdict: 'fits' } }]);
  });

  it('a committed move is tracked with its kind', async () => {
    const future = renderHook(() => useFuture());
    await waitForReady(future.result);
    const moves = future.result.current.moves;
    expect(moves.status).toBe('ready');
    const first = moves.status === 'ready' ? moves.data[0]! : null;
    act(() => future.result.current.commit(first!.id));
    expect(await tracked()).toContainEqual({ name: 'move_committed', props: { kind: first!.kind } });
  });
});

describe('the forecast horizon', () => {
  it('counts a change of the year shown, not a pick of the year already shown', async () => {
    const future = renderHook(() => useFuture());
    await waitForReady(future.result);
    act(() => future.result.current.setHorizonYears(10)); // already shown
    act(() => future.result.current.setHorizonYears(3));
    act(() => future.result.current.setHorizonYears(3));
    act(() => future.result.current.setHorizonYears(1));
    expect((await tracked()).filter((e) => e.name === 'forecast_horizon_changed')).toEqual([
      { name: 'forecast_horizon_changed', props: { years: 3 } },
      { name: 'forecast_horizon_changed', props: { years: 1 } },
    ]);
  });
});

describe('Try with sample data (/future?sample=1)', () => {
  it('loads the sample life as the profile, flags it, counts sample_loaded and drops the query', async () => {
    window.history.replaceState(null, '', '/future?sample=1');
    useAppStore.setState({ profile: { ...cloneProfileDemo(), doneMoveIds: ['x'] } });
    const future = renderHook(() => useFuture({ sample: true }));
    await waitForReady(future.result);
    await waitFor(() => expect(useAppStore.getState().isSample).toBe(true));
    expect(useAppStore.getState().profile).toEqual(cloneProfileDemo());
    expect(useAppStore.getState().profileOrigin).toBe('demo');
    expect(window.location.pathname + window.location.search).toBe('/future');
    future.rerender();
    expect((await tracked()).filter((e) => e.name === 'sample_loaded')).toEqual([{ name: 'sample_loaded' }]);
  });

  it('never replaces a profile the user built', async () => {
    useAppStore.getState().setSpending('groceries', 640);
    const mine = useAppStore.getState().profile;
    const future = renderHook(() => useFuture({ sample: true }));
    await waitForReady(future.result);
    await flush();
    expect(useAppStore.getState().isSample).toBe(false);
    expect(useAppStore.getState().profile).toBe(mine);
    expect((await tracked()).map((e) => e.name)).not.toContain('sample_loaded');
  });
});
