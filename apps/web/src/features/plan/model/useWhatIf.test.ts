// @vitest-environment jsdom
// "Write your what-if": the parse route's items become engine events in ONE edit of the active scenario,
// chips show the engine's amounts, undo removes exactly those events, and error codes map to copy.
// Move numbers are worked out by hand from packages/data/out/areas.json (default household: 1 adult,
// 1 bedroom, a car at 45 gal/month; groceries are the same national figure everywhere):
// Dallas mid 75206 → Denver mid 80205 = (1,910 − 2,070) + (164.64 − 171.76) + (3.642 − 3.408) × 45 = −156.59.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plan as copy } from '@/copy';
import { ApiError } from '@/lib/api/http';
import { useAppStore } from '@/state/store';
import { resetPlanStore, usePlanStore } from './planStore';
import { useWhatIf, whatIfErrorMessage } from './useWhatIf';

const ok = (items: unknown[]) =>
  new Response(JSON.stringify({ ok: true, kind: 'plan', value: { items }, needsConfirmation: true, inferred: [] }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });

const kid = { type: 'haveKid', year: 2029, label: 'A kid', metro: null, amount: null, cadence: null, endYear: null };
const denver = { type: 'move', year: null, label: 'Move to Denver', metro: 'Denver, CO', amount: null, cadence: null, endYear: null };
const boise = { ...denver, label: 'Move to Boise', metro: 'Boise, ID' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  useAppStore.getState().reset();
  resetPlanStore();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const activeEvents = () => {
  const { scenarios, activeId } = usePlanStore.getState();
  return scenarios.find((s) => s.id === activeId)!.events;
};

describe('useWhatIf', () => {
  it('adds every parsed event to the active scenario in one edit; undo removes them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([kid, denver, boise]));
    vi.stubGlobal('fetch', fetchMock);
    const before = activeEvents().length;
    const editSpy = vi.spyOn(usePlanStore.getState(), 'edit');
    const { result } = renderHook(() => useWhatIf());

    act(() => result.current.setText('a kid in 2029 and a move to Denver and Boise'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ kind: 'plan', text: 'a kid in 2029 and a move to Denver and Boise' });
    expect(editSpy).toHaveBeenCalledTimes(1);
    const events = activeEvents();
    expect(events).toHaveLength(before + 2); // Boise has no area data: skipped
    const [kidEvent, moveEvent] = events.slice(before);
    expect(kidEvent).toMatchObject({ type: 'haveKid', year: 2029, name: 'A kid' });
    expect(moveEvent).toMatchObject({ type: 'income', year: 2027, name: 'Move to Denver' });
    expect(moveEvent!.type === 'income' && moveEvent.monthly).toBeCloseTo(156.59, 6);

    expect(result.current.lastAdded.map((c) => [c.label, c.year, c.isEstimate])).toEqual([['A kid', 2029, true], ['Move to Denver', 2027, true]]);
    expect(result.current.lastAdded[1]!.amountText).toBe(copy.whatIf.moveLess('$157'));
    expect(result.current.error).toBe(copy.whatIf.errors.skipped);
    expect(result.current.text).toBe('');

    act(() => result.current.undo());
    expect(activeEvents()).toHaveLength(before);
    expect(result.current.lastAdded).toEqual([]);
  });

  it('a 503 shows the offline message and adds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: { code: 'unavailable' }, fallback: 'manualForm' }), { status: 503 })));
    const before = activeEvents().length;
    const { result } = renderHook(() => useWhatIf());
    act(() => result.current.setText('a kid'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(copy.whatIf.errors.unavailable);
    expect(activeEvents()).toHaveLength(before);
  });
});

describe('whatIfErrorMessage', () => {
  it('maps codes and statuses to copy', () => {
    const e = copy.whatIf.errors;
    expect(whatIfErrorMessage(new ApiError('x', 422, false, { error: { code: 'nothing_found' } }))).toBe(e.nothingFound);
    expect(whatIfErrorMessage(new ApiError('x', 429))).toBe(e.rateLimited);
    expect(whatIfErrorMessage(new ApiError('x', 502, false, { error: { code: 'upstream' } }))).toBe(e.generic);
    expect(whatIfErrorMessage(new Error('boom'))).toBe(e.generic);
  });
});
