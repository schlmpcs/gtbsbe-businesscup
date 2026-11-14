// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { useToday } from '@/features/forecast/model/useToday';
import { resetClientState } from '@/test/clientState';
import { useAppStore } from '@/state';
import { keepTypedAmounts } from './useQuickAdd';
import { parseSpendLine } from './parseLine';
import { useSpend } from './useSpend';
import type { SpendParseFn } from './useQuickAdd';

// Nov 14, 2026 (local): 17 days left, today included. Demo profile: usual month $3,655, bills $2,345.
const NOW = new Date(2026, 10, 14, 12);
const unavailable: SpendParseFn = () => Promise.reject(new ApiError('off', 503));

beforeEach(resetClientState);

async function ready(parse: SpendParseFn = unavailable) {
  const hook = renderHook(() => useSpend({ now: NOW, parse }));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

function summary(r: { current: ReturnType<typeof useSpend> }) {
  const s = r.current.summary;
  if (s.status !== 'ready') throw new Error(`summary ${s.status}`);
  return s.data;
}

describe('useSpend', () => {
  it('a line the local parser reads is saved at once, without the AI, and moves the numbers', async () => {
    const parse = vi.fn(unavailable);
    const { result } = await ready(parse);
    expect(summary(result).spent).toBe(0);
    expect(summary(result).usual).toBeCloseTo(3_655, 9);
    expect(summary(result).safeToday).toBeCloseTo(1_310 / 17, 9);

    act(() => result.current.quickAdd.setText('coffee 5, taxi 18, groceries 64'));
    act(() => result.current.quickAdd.submit());
    expect(parse).not.toHaveBeenCalled();
    expect(result.current.quickAdd.text).toBe('');
    expect(result.current.quickAdd.lastAdded).toEqual({ count: 3 });
    expect(summary(result).spent).toBe(87);
    expect(summary(result).safeToday).toBeCloseTo((1_310 - 87) / 17, 9);
    // monthEnd: bills at usual, the rest at the pace so far (87 / 14 days × 30).
    expect(summary(result).projected).toBeCloseTo(2_345 + (87 / 14) * 30, 9);
    expect(result.current.days).toHaveLength(1);
    expect(result.current.days[0]).toMatchObject({ date: '2026-11-14', day: 14, total: 87 });
    expect(result.current.byCategory).toEqual([
      { category: 'groceries', amount: 64 },
      { category: 'other', amount: 18 },
      { category: 'eatingOut', amount: 5 },
    ]);

    act(() => result.current.quickAdd.undo());
    expect(summary(result).spent).toBe(0);
    expect(useAppStore.getState().dailyEntries).toEqual([]);
  });

  it('a preset chip logs its estimated price; remove takes an entry out', async () => {
    const { result } = await ready();
    act(() => result.current.quickAdd.addPreset('coffee'));
    expect(useAppStore.getState().dailyEntries).toMatchObject([{ category: 'eatingOut', amount: 5, label: 'Coffee', date: '2026-11-14' }]);
    expect(result.current.quickAdd.presets.every((p) => p.isEstimate)).toBe(true);
    const id = result.current.days[0]!.entries[0]!.id;
    act(() => result.current.remove(id));
    expect(result.current.days).toEqual([]);
  });

  it('an unreadable line goes to the AI, typed amounts win, and nothing is saved before confirm', async () => {
    const parse: SpendParseFn = vi.fn(async () => ({
      value: [{ category: 'other' as const, amount: 99, label: 'zorbo' }],
      inferred: [],
    }));
    const { result } = await ready(parse);
    act(() => result.current.quickAdd.setText('zorbo 7'));
    act(() => result.current.quickAdd.submit());
    await waitFor(() => expect(result.current.quickAdd.status).toBe('confirming'));
    expect(parse).toHaveBeenCalledWith('spend', 'zorbo 7', expect.anything());
    expect(result.current.quickAdd.draftSource).toBe('ai');
    expect(result.current.quickAdd.drafts).toMatchObject([{ category: 'other', amount: 7, label: 'zorbo' }]);
    expect(useAppStore.getState().dailyEntries).toEqual([]);
    act(() => result.current.quickAdd.setDraftCategory('d0', 'groceries'));
    act(() => result.current.quickAdd.confirm());
    expect(useAppStore.getState().dailyEntries).toMatchObject([{ category: 'groceries', amount: 7 }]);
  });

  it('with the AI off: parts with amounts are offered for a category pick; a part without an amount asks for one', async () => {
    const { result } = await ready();
    act(() => result.current.quickAdd.setText('zorbo 7, coffee 3'));
    act(() => result.current.quickAdd.submit());
    await waitFor(() => expect(result.current.quickAdd.status).toBe('confirming'));
    expect(result.current.quickAdd.draftSource).toBe('local');
    expect(result.current.quickAdd.drafts).toMatchObject([
      { amount: 7, label: 'zorbo', categoryGuessed: true },
      { amount: 3, label: 'coffee', category: 'eatingOut', categoryGuessed: false },
    ]);
    act(() => result.current.quickAdd.cancel());
    expect(result.current.quickAdd.status).toBe('idle');

    act(() => result.current.quickAdd.setText('coffee'));
    act(() => result.current.quickAdd.submit());
    await waitFor(() => expect(result.current.quickAdd.status).toBe('error'));
    expect(result.current.quickAdd.error).toEqual({ kind: 'noAmount', part: 'coffee' });
    expect(useAppStore.getState().dailyEntries).toEqual([]);
  });

  it('Home (useToday) shows the same month so far, and a logged purchase ends the first visit', async () => {
    useAppStore.getState().addDailyEntries([{ category: 'groceries', amount: 64 }], '2026-11-10');
    const { result } = renderHook(() => useToday({ now: NOW }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.firstVisit).toBe(false);
    const d = result.current.daily;
    expect(d?.status).toBe('ready');
    if (d?.status === 'ready') {
      expect(d.data.spent).toBe(64);
      expect(d.data.safeToday).toBeCloseTo((1_310 - 64) / 17, 9);
    }
  });
});

describe('keepTypedAmounts', () => {
  it('the amount the user typed replaces the AI one, part by part', () => {
    const local = parseSpendLine('zorbo 7, blip');
    expect(keepTypedAmounts([
      { category: 'other', amount: 70 },
      { category: 'other', amount: 4 },
    ], local)).toEqual([
      { category: 'other', amount: 7 },
      { category: 'other', amount: 4 },
    ]);
  });
});
