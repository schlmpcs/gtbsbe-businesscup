// @vitest-environment jsdom
// Where the payoff planner meets the engine, the store and the page (wiring.ts).
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/events';
import { resetClientState } from '@/test/clientState';
import { fakeEngine } from './payoffTestUtils';
import { payoffPlannerOptions, usePayoffWiring } from './wiring';

beforeEach(() => {
  resetClientState();
  window.history.pushState({}, '', '/loan');
});

describe('usePayoffWiring', () => {
  it('is null while the payoff engine is not bound, so Loan Lab stays as it is', () => {
    const { result } = renderHook(() => usePayoffWiring());
    expect(result.current).toBeNull();
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

  it('takes today from the clock of the person\'s own calendar month (local time)', () => {
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
