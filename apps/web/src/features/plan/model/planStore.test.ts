// @vitest-environment jsdom
// The plan is saved in this browser: a reload (a fresh in-memory store loading what was saved) keeps the
// scenarios, events added from a tool, applied moves and the Chance settings; a plan the person never
// changed still follows the profile; unreadable, unknown-version or broken data is ignored; and the
// autosave indicator says 'saved' only when the write went through.
import type { Move, MonteCarloResult } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/state/store';
import {
  AUTOSAVE_MS, DEFAULT_CHANCE_SETTINGS, PLAN_STORE_KEY, PLAN_STORE_VERSION, initialPlanData, resetPlanStore, restorePlan, usePlanStore,
} from './planStore';
import type { PlanVM } from './types';
import { usePlan } from './usePlan';
import { useScenarios } from './useScenarios';
import { useToolPlanEvent, type ToolEventDraft } from './useToolPlanEvent';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  localStorage.clear();
  useAppStore.getState().reset();
  resetPlanStore();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const st = () => usePlanStore.getState();
const active = () => st().scenarios.find((s) => s.id === st().activeId)!;
const saved = () => JSON.parse(localStorage.getItem(PLAN_STORE_KEY) ?? 'null') as { version: number; state: Record<string, unknown> } | null;

/** A page reload: the in-memory store starts over on the defaults (not written) and loads what is saved. */
async function reload(): Promise<void> {
  cleanup();
  const raw = localStorage.getItem(PLAN_STORE_KEY);
  usePlanStore.setState(initialPlanData());
  if (raw === null) localStorage.removeItem(PLAN_STORE_KEY);
  else localStorage.setItem(PLAN_STORE_KEY, raw);
  await usePlanStore.persist.rehydrate();
}

const couch: ToolEventDraft = { type: 'expense', name: 'Couch', amount: 2400, cadence: 'once' };
const move: Move = { id: 'mv-cut-eatingOut', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 12_000, patch: { spending: { eatingOut: 200 } } } as Move;

function ready(vm: PlanVM) {
  if (vm.status !== 'ready') throw new Error(`plan not ready: ${vm.status}`);
  return vm;
}

describe('plan persistence', () => {
  it('saves only the plan data, versioned (no Monte Carlo result, run status or open editor)', () => {
    act(() => st().edit('baseline', (s) => ({ ...s, name: 'My plan' })));
    act(() => st().setChance({ chanceStatus: 'done', chanceResult: { successRate: 0.9 } as MonteCarloResult }));
    const s = saved()!;
    expect(s.version).toBe(PLAN_STORE_VERSION);
    expect(Object.keys(s.state).sort()).toEqual(['activeId', 'chanceSettings', 'fixedSeed', 'movesApplied', 'scenarios', 'touched']);
    expect((s.state.scenarios as { name: string }[])[0]!.name).toBe('My plan');
  });

  it('round trip: scenarios, active id, applied moves, touched and Chance settings survive a reload', async () => {
    act(() => {
      st().select('with-kid');
      st().applyMove('with-kid', move);
      st().editEvent('baseline', 'ev-buy-home', (e) => ({ ...e, year: 2034 }));
      st().setChance({ chanceSettings: { ...DEFAULT_CHANCE_SETTINGS, paths: 2000, seed: 7 }, fixedSeed: 7 });
      st().setChance({ chanceStatus: 'done', chanceResult: { successRate: 0.9 } as MonteCarloResult });
    });
    const before = { scenarios: st().scenarios, activeId: st().activeId, movesApplied: st().movesApplied };

    await reload();
    expect(st().scenarios).toEqual(before.scenarios);
    expect(st().activeId).toBe('with-kid');
    expect(st().movesApplied).toEqual(before.movesApplied);
    expect(st().touched).toBe(true);
    expect(st().chanceSettings).toMatchObject({ paths: 2000, seed: 7 });
    expect(st().fixedSeed).toBe(7);
    // The result belonged to the page before: it is computed again.
    expect(st().chanceStatus).toBe('idle');
    expect(st().chanceResult).toBeNull();
    expect(st().saveState).toBe('saved');
  });

  it('an event added from a tool ("Add to my plan") is still on the plan after a reload', async () => {
    const tool = renderHook(() => useToolPlanEvent(couch));
    let id: string | null = null;
    act(() => void (id = tool.result.current.add()));
    expect(id).toMatch(/^ev-/);

    await reload();
    expect(active().events.find((e) => e.id === id)).toMatchObject({ ...couch, year: 2026, enabled: true });
    // The seed does not take it away: the plan was changed, so it no longer follows the profile.
    const { result } = renderHook(() => usePlan(st().activeId));
    renderHook(() => useScenarios());
    expect(ready(result.current).tables.events.some((e) => e.id === id && e.name === 'Couch')).toBe(true);
    expect(active().events.some((e) => e.id === id)).toBe(true);
  });

  it('an untouched saved plan still follows the profile: demo → the person’s own re-seeds after a reload', async () => {
    renderHook(() => useScenarios()); // seeds the demo pair; nothing changed by the person
    act(() => st().select('with-kid')); // picking a tab is not a change
    expect(st().touched).toBe(false);
    expect(saved()!.state.touched).toBe(false);

    await reload();
    expect(st().scenarios.map((s) => s.id)).toEqual(['baseline', 'with-kid']);
    act(() => useAppStore.getState().setSpending('eatingOut', 300)); // the profile is now the person's own
    const { result } = renderHook(() => useScenarios());
    expect(result.current.items.map((s) => s.name)).toEqual(['Baseline']);
    expect(st().scenarios[0]!.events.map((e) => e.type)).toEqual(['retire', 'socialSecurity']);
  });

  it('a touched saved plan is not re-seeded when the profile changes', async () => {
    act(() => st().edit('baseline', (s) => ({ ...s, name: 'Mine' })));
    await reload();
    act(() => useAppStore.getState().setSpending('eatingOut', 300));
    const { result } = renderHook(() => useScenarios());
    expect(result.current.items.map((s) => s.name)).toEqual(['Mine', 'Baseline + a kid']);
  });

  it('corrupted, unversioned or unknown-version data is ignored: the demo pair, and the store still loads', async () => {
    for (const raw of [
      '{not json',
      JSON.stringify({ scenarios: [] }),
      JSON.stringify({ version: PLAN_STORE_VERSION + 1, state: { ...saved()?.state, scenarios: [{ id: 'x', name: 'Future', assumptions: {}, events: [] }] } }),
      JSON.stringify({ version: PLAN_STORE_VERSION, state: { scenarios: [{ id: 'x', name: 'Broken', assumptions: { endAge: 'ninety' }, events: [] }] } }),
      JSON.stringify({ version: PLAN_STORE_VERSION, state: null }),
    ]) {
      localStorage.setItem(PLAN_STORE_KEY, raw);
      usePlanStore.setState(initialPlanData());
      await usePlanStore.persist.rehydrate();
      expect(usePlanStore.persist.hasHydrated(), raw).toBe(true);
      expect(st().scenarios.map((s) => s.id), raw).toEqual(['baseline', 'with-kid']);
      expect(st().activeId).toBe('baseline');
    }
  });

  it('restorePlan keeps what checks out: bad events, unknown moves and bad settings fall back', () => {
    const base = initialPlanData().scenarios[0]!;
    const r = restorePlan({
      scenarios: [{ ...base, events: [...base.events, { id: 'bad', type: 'windfall', year: 2030, enabled: true, amount: -5 }] }, { id: '', name: 'x' }],
      activeId: 'gone',
      movesApplied: { [base.id]: [move, { nope: true }], gone: [move] },
      touched: 'yes',
      chanceSettings: { paths: -1 },
      fixedSeed: 1.5,
    })!;
    expect(r.scenarios).toHaveLength(1);
    expect(r.scenarios[0]!.events.map((e) => e.id)).toEqual(base.events.map((e) => e.id));
    expect(r.activeId).toBe(base.id);
    expect(r.movesApplied).toEqual({ [base.id]: [move] });
    expect(r.touched).toBe(false);
    expect(r.chanceSettings).toEqual(DEFAULT_CHANCE_SETTINGS);
    expect(r.fixedSeed).toBe(42);
    expect(restorePlan(undefined)).toBeNull();
  });

  it('a fresh page: nothing is written before the load, and the first change loads the saved plan first', async () => {
    act(() => st().edit('baseline', (s) => ({ ...s, name: 'Saved name' })));
    vi.resetModules();
    const fresh = await import('./planStore');
    const store = fresh.usePlanStore;
    expect(store.persist.hasHydrated()).toBe(false);
    store.setState({ activeId: 'with-kid' }); // the defaults before the load are not written
    expect(saved()!.state.activeId).toBe('baseline');
    // A tool page changing the plan before anything loaded it: the saved plan is loaded, then changed.
    store.getState().applyMove('baseline', move);
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().scenarios[0]!.name).toBe('Saved name');
    expect(saved()!.state.movesApplied).toEqual({ baseline: [move] });
    expect((saved()!.state.scenarios as { name: string }[])[0]!.name).toBe('Saved name');
    fresh.resetPlanStore();
  });

  it('saveState: saving, then saved once written; error when the browser refuses the write', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).moveEvent('ev-buy-home', 2033));
    expect(ready(result.current).saveState).toBe('saving');
    act(() => void vi.advanceTimersByTime(AUTOSAVE_MS));
    expect(ready(result.current)).toMatchObject({ saveState: 'saved', saveLabel: 'Saved just now' });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    act(() => ready(result.current).moveEvent('ev-buy-home', 2034));
    expect(ready(result.current).saveState).toBe('saving');
    act(() => void vi.advanceTimersByTime(AUTOSAVE_MS));
    expect(ready(result.current).saveState).toBe('error');
    expect(ready(result.current).saveLabel).toMatch(/not saved/i);

    vi.restoreAllMocks();
    act(() => ready(result.current).moveEvent('ev-buy-home', 2035));
    act(() => void vi.advanceTimersByTime(AUTOSAVE_MS));
    expect(ready(result.current).saveState).toBe('saved');
    expect((saved()!.state.scenarios as { events: { id: string; year: number }[] }[])[0]!.events.find((e) => e.id === 'ev-buy-home')!.year).toBe(2035);
  });
});
