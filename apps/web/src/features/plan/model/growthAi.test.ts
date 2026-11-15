// @vitest-environment jsdom
// "Estimate with AI" on the plan's growth defaults (useAssumptions → growthAi). The API client is mocked:
// no model is called. The AI only proposes rates; a suggestion sits next to the sourced default until the
// person applies it, and an applied one is labeled with its reason.
import { findArea } from '@lifeguessr/data/areas';
import type { GrowthEstimateRequest, GrowthEstimateResponse } from '@lifeguessr/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { useAppStore } from '@/state/store';
import { resetPlanStore, usePlanStore } from './planStore';
import { useAssumptions } from './useAssumptions';

const { estimateGrowth } = vi.hoisted(() => ({ estimateGrowth: vi.fn() }));
vi.mock('@/lib/api/aiGrowth', () => ({ estimateGrowth }));

const area = () => findArea('75206')!;
const ANSWER: GrowthEstimateResponse = {
  ok: true, source: 'ai', rejected: ['otherAsset'],
  estimates: [
    { group: 'cash', rate: 0.04, reason: 'High-yield savings pay about 4% a year today.' },
    { group: 'investments', rate: 0.07, reason: 'A diversified mix has averaged about 7% a year.' },
    { group: 'retirement', rate: 0.065, reason: 'A typical retirement mix averages about 6.5% a year.' },
    { group: 'realEstate', rate: 0.045, reason: 'Dallas homes have risen about 4.5% a year over the long run.' },
    { group: 'vehicle', rate: -0.14, reason: 'Cars lose about 14% of their value a year.' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  useAppStore.getState().reset();
  resetPlanStore();
  estimateGrowth.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const row = (vm: ReturnType<typeof useAssumptions>, group: string) => vm.growth.find((g) => g.group === group)!;
const scenarioAssumptions = () => {
  const s = usePlanStore.getState();
  return s.scenarios.find((x) => x.id === s.activeId)!.assumptions;
};

describe('useAssumptions growthAi', () => {
  it('starts idle with no suggestions', () => {
    const { result } = renderHook(() => useAssumptions());
    expect(result.current.growthAi).toMatchObject({ status: 'idle', message: null, canApplyAll: false });
    expect(result.current.growth.every((g) => g.suggestion === undefined && g.aiNote === undefined)).toBe(true);
  });

  it('idle → loading → ready: suggestions sit next to the defaults, nothing is applied', async () => {
    let resolve!: (v: GrowthEstimateResponse) => void;
    estimateGrowth.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useAssumptions());
    act(() => result.current.growthAi.ask());
    expect(result.current.growthAi.status).toBe('loading');

    await act(async () => resolve(ANSWER));
    expect(result.current.growthAi.status).toBe('ready');
    expect(result.current.growthAi.canApplyAll).toBe(true);
    const realEstate = row(result.current, 'realEstate');
    // The sourced default stays what is used, with its FHFA source, until the person applies.
    expect(realEstate.override).toBeNull();
    expect(realEstate.rate).toBe(area().homeAppreciationAnnual!.value);
    expect(realEstate.source).toEqual(area().homeAppreciationAnnual!.source);
    expect(realEstate.suggestion).toEqual({
      rate: 0.045, rateLabel: '4.5%', reason: 'Dallas homes have risen about 4.5% a year over the long run.', applied: false,
    });
    // A group whose proposal failed the checks has no suggestion and is named in the message.
    expect(row(result.current, 'otherAsset').suggestion).toBeUndefined();
    expect(result.current.growthAi.message).toMatch(/Other assets/);
    expect(scenarioAssumptions().growth).toEqual({});
  });

  it('sends the area, totals by group (no names, no ids) and the current defaults', async () => {
    estimateGrowth.mockResolvedValueOnce(ANSWER);
    const { result } = renderHook(() => useAssumptions());
    await act(async () => result.current.growthAi.ask());
    const req = estimateGrowth.mock.calls[0]![0] as Extract<GrowthEstimateRequest, { mode: 'plan' }>;
    expect(req.mode).toBe('plan');
    expect(req.area).toEqual({ metro: area().metro, state: area().state });
    expect(req.defaults.realEstate).toBe(area().homeAppreciationAnnual!.value);
    expect(req.defaults.investments).toBe(0.06);
    for (const g of req.groups) expect(Object.keys(g).sort()).toEqual(['count', 'group', 'total']);
    expect(JSON.stringify(req)).not.toMatch(/"name"|"id"/);
  });

  it('Apply sets the override with an AI note; a typed rate or "Use default" drops the note', async () => {
    estimateGrowth.mockResolvedValueOnce(ANSWER);
    const { result } = renderHook(() => useAssumptions());
    await act(async () => result.current.growthAi.ask());
    act(() => result.current.applyGrowthSuggestion('realEstate'));

    expect(scenarioAssumptions().growth.realEstate).toBe(0.045);
    expect(scenarioAssumptions().growthNotes?.realEstate).toEqual({ source: 'ai', reason: 'Dallas homes have risen about 4.5% a year over the long run.' });
    const applied = row(result.current, 'realEstate');
    expect(applied).toMatchObject({ override: 0.045, rate: 0.045, aiNote: { reason: 'Dallas homes have risen about 4.5% a year over the long run.' } });
    expect(applied.suggestion!.applied).toBe(true);
    // The default and its source stay visible next to the AI value.
    expect(applied.hint).toMatch(/4\.87%/);
    expect(applied.source).toEqual(area().homeAppreciationAnnual!.source);

    act(() => result.current.updateGrowth('realEstate', 0.05));
    expect(row(result.current, 'realEstate').aiNote).toBeUndefined();
    expect(scenarioAssumptions().growthNotes?.realEstate).toBeUndefined();

    act(() => result.current.applyGrowthSuggestion('vehicle'));
    act(() => result.current.updateGrowth('vehicle', null));
    expect(scenarioAssumptions().growth.vehicle).toBeUndefined();
    expect(scenarioAssumptions().growthNotes?.vehicle).toBeUndefined();
  });

  it('Apply all applies every suggestion that passed', async () => {
    estimateGrowth.mockResolvedValueOnce(ANSWER);
    const { result } = renderHook(() => useAssumptions());
    await act(async () => result.current.growthAi.ask());
    act(() => result.current.growthAi.applyAll());
    expect(scenarioAssumptions().growth).toEqual({ cash: 0.04, investments: 0.07, retirement: 0.065, realEstate: 0.045, vehicle: -0.14 });
    expect(Object.keys(scenarioAssumptions().growthNotes ?? {}).sort()).toEqual(['cash', 'investments', 'realEstate', 'retirement', 'vehicle']);
    expect(result.current.growthAi.canApplyAll).toBe(false);
  });

  it('a suggestion outside the envelope is never shown, even if the server sent it', async () => {
    estimateGrowth.mockResolvedValueOnce({ ...ANSWER, rejected: [], estimates: [{ group: 'vehicle', rate: 0.4, reason: 'Cars gain 40% a year.' }] });
    const { result } = renderHook(() => useAssumptions());
    await act(async () => result.current.growthAi.ask());
    expect(row(result.current, 'vehicle').suggestion).toBeUndefined();
    act(() => result.current.applyGrowthSuggestion('vehicle'));
    expect(scenarioAssumptions().growth.vehicle).toBeUndefined();
  });

  it.each([
    ['no API key', new ApiError('x', 503, false, { ok: false, error: { code: 'unavailable' } }), /isn’t available/],
    ['too many requests', new ApiError('x', 429, false, { ok: false, error: { code: 'rate_limited' } }), /Too many/],
    ['answers that failed the checks', new ApiError('x', 422, false, { ok: false, error: { code: 'invalid_output' } }), /sensible/],
    ['a network error', new ApiError('x', 0), /sensible/],
  ])('loading → error on %s: a friendly message, the defaults stay', async (_name, error, message) => {
    estimateGrowth.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useAssumptions());
    await act(async () => result.current.growthAi.ask());
    await waitFor(() => expect(result.current.growthAi.status).toBe('error'));
    expect(result.current.growthAi.message).toMatch(message);
    expect(result.current.growthAi.message).toMatch(/default/);
    expect(result.current.growth.every((g) => g.suggestion === undefined && g.override === null)).toBe(true);
  });
});
