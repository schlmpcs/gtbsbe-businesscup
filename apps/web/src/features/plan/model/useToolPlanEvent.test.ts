// @vitest-environment jsdom
// "Add to my plan" for the What if? tools: the preview is the engine's previewEvent on the active scenario,
// adding puts the event on that scenario once, and the numbers do not double after adding.
import { findArea } from '@lifeguessr/data/areas';
import { previewEvent } from '@lifeguessr/engine';
import type { PlanEvent } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stampProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { resetPlanStore, usePlanStore } from './planStore';
import { useToolPlanEvent, type ToolEventDraft } from './useToolPlanEvent';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  useAppStore.getState().reset();
  resetPlanStore();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const couch: ToolEventDraft = { type: 'expense', name: 'Couch', amount: 2400, cadence: 'once' };
const active = () => usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!;

describe('useToolPlanEvent', () => {
  it('previews the draft on the active scenario with the engine, this plan year', () => {
    const { result } = renderHook(() => useToolPlanEvent(couch));
    const p = result.current.preview;
    expect(p?.status).toBe('ready');
    if (p?.status !== 'ready') return;
    const profile = stampProfile(useAppStore.getState().profile, '2026-11');
    const event = { ...couch, id: 'tool-preview', year: 2026, enabled: true } as PlanEvent;
    const expected = previewEvent(profile, [], active(), event, findArea(profile.zip) ?? undefined);
    expect(p.data.withEvent).toEqual(expected.withEvent);
    expect(p.data.without).toEqual(expected.without);
    expect(p.data.deltaAtRetirement).toBeCloseTo(expected.withEvent.netWorthAtRetirement - expected.without.netWorthAtRetirement, 6);
    expect(p.data.deltaAtRetirement).toBeLessThan(0);
    expect(result.current.scenarioName).toBe(active().name);
    expect(result.current.added).toBe(false);
  });

  it('adds once to the active scenario; the preview then stays measured without that copy', () => {
    const { result } = renderHook(() => useToolPlanEvent(couch));
    const before = active().events.length;
    const firstDelta = result.current.preview?.status === 'ready' ? result.current.preview.data.deltaAtRetirement : NaN;
    let id: string | null = null;
    act(() => {
      id = result.current.add();
    });
    expect(id).toMatch(/^ev-/);
    expect(active().events).toHaveLength(before + 1);
    expect(active().events.at(-1)).toMatchObject({ ...couch, id, year: 2026, enabled: true });
    expect(result.current.added).toBe(true);
    const after = result.current.preview?.status === 'ready' ? result.current.preview.data.deltaAtRetirement : NaN;
    expect(after).toBeCloseTo(firstDelta, 6);
    act(() => {
      expect(result.current.add()).toBeNull();
    });
    expect(active().events).toHaveLength(before + 1);
  });

  it('nothing to preview or add without a draft', () => {
    const { result } = renderHook(() => useToolPlanEvent(null));
    expect(result.current.preview).toBeNull();
    expect(result.current.add()).toBeNull();
  });
});
