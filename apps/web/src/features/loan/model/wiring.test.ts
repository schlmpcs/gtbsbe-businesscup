// @vitest-environment jsdom
// Where the payoff planner meets the engine, the store and the page (wiring.ts).
import { comparePayoff, extraToFinishBy } from '@lifeguessr/engine';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/events';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { fakeEngine } from '@/test/payoff';
import { payoffPlannerOptions, usePayoffWiring } from './wiring';

beforeEach(() => {
  resetClientState();
  useAppStore.setState({ tools: {} });
  window.history.pushState({}, '', '/loan');
});
afterEach(() => window.history.pushState({}, '', '/'));

describe('usePayoffWiring', () => {
  it('binds the real payoff engine', () => {
    const { result } = renderHook(() => usePayoffWiring());
    expect(result.current).not.toBeNull();
    expect(result.current!.engine.comparePayoff).toBe(comparePayoff);
    expect(result.current!.engine.extraToFinishBy).toBe(extraToFinishBy);
  });

  it('sends events through the real sender and reads today from the clock', () => {
    const { result } = renderHook(() => usePayoffWiring());
    expect(result.current!.track).toBe(track);
    expect(result.current!.today().month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('has nothing stored until the person has used the planner', () => {
    const { result } = renderHook(() => usePayoffWiring());
    expect(result.current!.stored).toBeUndefined();
  });

  it('reads the saved picks from tools.payoff in the store', () => {
    useAppStore.setState({ tools: { payoff: { method: 'snowball', extra: 200, targetMonth: '2029-12' } } });
    const { result } = renderHook(() => usePayoffWiring());
    expect(result.current!.stored).toEqual({ method: 'snowball', extra: 200, targetMonth: '2029-12' });
  });

  it('writes the picks to tools.payoff in the store, and leaves the other tools alone', () => {
    useAppStore.setState({ tools: { overpaying: { bedrooms: 2, adults: 1, kids: [] } } });
    const { result } = renderHook(() => usePayoffWiring());
    act(() => result.current!.onStore!({ method: 'snowball', extra: 125, targetMonth: '2029-12' }));
    expect(useAppStore.getState().tools.payoff).toEqual({ method: 'snowball', extra: 125, targetMonth: '2029-12' });
    expect(useAppStore.getState().tools.overpaying).toEqual({ bedrooms: 2, adults: 1, kids: [] });
  });

  it('shows the picks it saved on the next read', () => {
    const { result } = renderHook(() => usePayoffWiring());
    act(() => result.current!.onStore!({ method: 'avalanche', extra: 40 }));
    expect(result.current!.stored).toEqual({ method: 'avalanche', extra: 40 });
  });

  it('is streamer mode for ?stream=1 only', () => {
    expect(renderHook(() => usePayoffWiring()).result.current!.streamer).toBe(false);
    window.history.pushState({}, '', '/loan?stream=1');
    expect(renderHook(() => usePayoffWiring()).result.current!.streamer).toBe(true);
  });

  it('gives the same options on every render when nothing changed', () => {
    const { result, rerender } = renderHook(() => usePayoffWiring());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('payoffPlannerOptions', () => {
  it('binds the real event sender and today as a YYYY-MM month, and passes the rest through', () => {
    const { engine } = fakeEngine();
    const onStore = vi.fn();
    const stored = { method: 'snowball' as const, extra: 50 };
    const options = payoffPlannerOptions({ engine, stored, onStore, streamer: true });
    expect(options.engine).toBe(engine);
    expect(options.track).toBe(track);
    expect(options.today().month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(options.stored).toBe(stored);
    expect(options.onStore).toBe(onStore);
    expect(options.streamer).toBe(true);
  });

  it("takes today from the clock of the person's own calendar month (local time)", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 14, 12)); // 14 November 2026, local noon
      const { engine } = fakeEngine();
      expect(payoffPlannerOptions({ engine }).today()).toEqual({ month: '2026-11' });
      vi.setSystemTime(new Date(2026, 11, 31, 23, 59)); // 31 December 2026, local 23:59
      expect(payoffPlannerOptions({ engine }).today().month).toBe('2026-12');
    } finally {
      vi.useRealTimers();
    }
  });
});
