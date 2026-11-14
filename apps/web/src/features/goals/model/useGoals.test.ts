// @vitest-environment jsdom
// Goals (Save up) on the fixtures; the engine's goalStatus / extraSavingToReach run on the demo profile.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { useGoalsStore } from './goalsStore';
import { useGoals } from './useGoals';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
  // Two goals a person might have typed (the store starts empty).
  useGoalsStore.setState({
    goals: [
      { id: 'goal-1', name: 'Emergency fund', target: 15_000, years: 3 },
      { id: 'goal-2', name: 'House deposit', target: 60_000, years: 10 },
    ],
    nextId: 3,
  });
});
afterEach(() => vi.useRealTimers());

describe('useGoals', () => {
  it('renders the demo goals with an engine status and a monthly saving', () => {
    const { result } = renderHook(() => useGoals());
    expect(result.current.ready).toBe(true);
    expect(result.current.goals.map((g) => g.name)).toEqual(['Emergency fund', 'House deposit']);
    for (const g of result.current.goals) {
      expect(g.saved).toBe(0);
      expect(['onTrack', 'atRisk']).toContain(g.status);
      expect(g.projection.status).toBe('ready');
      if (g.projection.status !== 'ready' || g.projection.data === null) throw new Error('no projection');
      expect(g.projection.data.monthlyToStayOnTrack).toBeGreaterThanOrEqual(0);
      // The status follows the verdict: on track only when the low end of the range reaches the target.
      expect(g.status === 'onTrack').toBe(g.projection.data.verdict === 'onTrack');
      expect(g.projection.data.gap).toBeCloseTo(g.target - g.projection.data.projected.mid, 6);
    }
  });

  it('adds a goal, refuses a bad one, and completes one when allocations reach the target', () => {
    const { result } = renderHook(() => useGoals());
    act(() => {
      expect(result.current.addGoal({ name: ' ', target: 1000, years: 1 })).toBeNull();
      expect(result.current.addGoal({ name: 'Trip', target: 0, years: 1 })).toBeNull();
      expect(result.current.addGoal({ name: 'Trip', target: 1000, years: 31 })).toBeNull();
    });
    expect(result.current.inputError).toBe(true);
    let id: string | null = null;
    act(() => {
      id = result.current.addGoal({ name: ' Trip ', target: 2000, years: 1 });
    });
    expect(id).toBe('goal-3');
    expect(result.current.inputError).toBe(false);
    const trip = () => result.current.goals.find((g) => g.id === id)!;
    expect(trip()).toMatchObject({ name: 'Trip', saved: 0 });
    expect(trip().status).not.toBe('completed');

    expect(result.current.allocate(id!, 'no-such-line')).toBe(false);
    // tx-005 is a 2400 pay line: counted toward a 2000 goal it completes it (|2400| >= 2000).
    act(() => void result.current.allocate(id!, 'tx-005'));
    expect(trip()).toMatchObject({ saved: 2400, status: 'completed', projection: { status: 'ready', data: null } });
    expect(trip().savedShare).toBeCloseTo(1.2, 10);
    expect(trip().transactions.map((t) => t.id)).toEqual(['tx-005']);

    act(() => result.current.remove(id!));
    expect(result.current.goals.map((g) => g.id)).toEqual(['goal-1', 'goal-2']);
    expect(useGoalLinks.getState().links['tx-005']).toBeUndefined();
  });
});
