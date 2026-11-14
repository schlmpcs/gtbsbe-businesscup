// @vitest-environment jsdom
import { compareFutures, inflationAnnualOf } from '@lifeguessr/engine';
import { findArea, getArea } from '@lifeguessr/data/areas';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo, whatIfPresets } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import { heroSlides, useTwoFuturesHero } from './useTwoFuturesHero';
import { useWhatIf, type ScenarioParseFn } from './useWhatIf';
import { presetSides } from './whatIfVm';

beforeEach(() => {
  resetClientState();
  resetProState();
});

const now = () => new Date('2026-11-14T12:00:00Z');
const opts = { areaOf: findArea, homeArea: getArea('75206'), rates: { inflationAnnual: inflationAnnualOf(getArea('75206')) } };

describe('useWhatIf', () => {
  it('starts on the car preset and shows the engine comparison on the sample profile', async () => {
    const { result } = renderHook(() => useWhatIf({ now }));
    await waitForReady(result);
    const vm = result.current;
    expect(vm.status).toBe('ready');
    expect(vm.presets.map((p) => p.id)).toEqual(whatIfPresets.map((p) => p.id));
    expect(vm.presets[0]!.selected).toBe(true);

    const sides = presetSides(whatIfPresets[0]!, cloneProfileDemo());
    const cmp = compareFutures(cloneProfileDemo(), sides.A.scenario, sides.B.scenario, opts);
    expect(vm.chart!.A.end).toEqual(cmp.A.end);
    expect(vm.chart!.B.end).toEqual(cmp.B.end);
    expect(vm.result).toMatchObject({ winner: 'B', endYear: 2036, decidedBy: { term: 'car', winner: 'B' } });
    expect(vm.result!.aheadBy).toBeCloseTo(cmp.diff, 6);
    expect(vm.A.facts).toContainEqual({ kind: 'loan', apr: 0.069, termMonths: 60, monthly: expect.any(Number) });
    expect(vm.A.art).toBe('car-premium');
    expect(vm.saveLocked).toBe(true);
  });

  it('a preset with a later change puts a marker on the chart (baby in 2 years)', async () => {
    const { result } = renderHook(() => useWhatIf({ now }));
    await waitForReady(result);
    act(() => result.current.selectPreset('baby'));
    expect(result.current.chart!.markers).toEqual([{ letter: 'B', month: 24 }]);
    expect(result.current.result!.winner).toBe('B');
    expect(result.current.result!.decidedBy?.term).toBe('childcare');
  });

  it('rent downtown or suburbs moves within the profile\'s own metro', async () => {
    const { result } = renderHook(() => useWhatIf({ now, initialPreset: 'rent' }));
    await waitForReady(result);
    expect(result.current.A.facts[0]).toMatchObject({ kind: 'place', zip: '75205', tier: 'expensive' });
    expect(result.current.B.facts[0]).toMatchObject({ kind: 'place', zip: '75024', tier: 'suburb' });
  });

  it('a typed what-if is confirmed, then put into B, and the chart updates', async () => {
    const parse: ScenarioParseFn = vi.fn(async () => ({
      value: { kind: 'kid' as const, age: 'infant' as const, inMonths: 12 }, inferred: [], parsedBy: 'rules' as const,
    }));
    const { result } = renderHook(() => useWhatIf({ now, parse }));
    await waitForReady(result);
    const before = result.current.chart!.B.end.mid;

    act(() => result.current.ask.setText('we have a baby next year'));
    act(() => result.current.ask.submit());
    await waitFor(() => expect(result.current.ask.status).toBe('confirming'));
    expect(parse).toHaveBeenCalledWith('we have a baby next year', expect.objectContaining({ homeZip: '75206' }));
    expect(result.current.ask.confirm).toMatchObject({ kind: 'kid', parsedBy: 'rules', place: null });
    expect(result.current.chart!.B.end.mid).toBe(before); // nothing applies before the user confirms

    act(() => result.current.ask.putIn('B'));
    expect(result.current.ask.status).toBe('idle');
    expect(result.current.B.title).toBe('The $22k car + Baby in 1 year');
    expect(result.current.presets.every((p) => !p.selected)).toBe(true);
    expect(result.current.chart!.B.end.mid).toBeLessThan(before);
    expect(result.current.chart!.markers).toEqual([{ letter: 'B', month: 12 }]);
  });

  it('a move to a city we mapped says which ZIP it used; parse errors become VM errors', async () => {
    const parse: ScenarioParseFn = vi.fn(async () => ({ value: { kind: 'move' as const, zip: '78704' }, inferred: ['zip'], parsedBy: 'ai' as const }));
    const { result } = renderHook(() => useWhatIf({ now, parse }));
    await waitForReady(result);
    act(() => result.current.ask.setText('I move to Austin'));
    act(() => result.current.ask.submit());
    await waitFor(() => expect(result.current.ask.status).toBe('confirming'));
    expect(result.current.ask.confirm!.place).toEqual({ metro: 'Austin, TX', zip: '78704', tier: 'mid' });
    act(() => result.current.ask.cancel());
    expect(result.current.ask.status).toBe('idle');
  });

  it('saving is Pro: locked by default, saved to the store once Pro', async () => {
    const { result } = renderHook(() => useWhatIf({ now }));
    await waitForReady(result);
    act(() => result.current.save());
    expect(useAppStore.getState().whatIfs).toEqual([]);

    resetProState(fakeProAdapter(statusInfo(PRO_DEMO)));
    const pro = renderHook(() => useWhatIf({ now }));
    await waitFor(() => expect(pro.result.current.saveLocked).toBe(false));
    act(() => pro.result.current.save());
    expect(useAppStore.getState().whatIfs).toHaveLength(1);
    expect(useAppStore.getState().whatIfs[0]).toMatchObject({ presetId: 'car', A: { label: 'A $35k car' } });
    expect(pro.result.current.saved).toBe(true);
    expect(pro.result.current.savedChoices).toHaveLength(1);
  });
});

describe('useTwoFuturesHero', () => {
  it('plays every preset on the sample profile, one every 4 seconds', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTwoFuturesHero());
      expect(result.current.count).toBe(whatIfPresets.length);
      expect(result.current.presetId).toBe('car');
      act(() => vi.advanceTimersByTime(4_000));
      expect(result.current.presetId).toBe('city');
      act(() => result.current.select(3));
      expect(result.current.presetId).toBe('card');
      act(() => vi.advanceTimersByTime(12_000));
      expect(result.current.presetId).toBe('card'); // the viewer picked one: no more cycling
    } finally {
      vi.useRealTimers();
    }
    const slides = heroSlides(2026);
    expect(slides.every((s) => s.chart.A.points.length === 121)).toBe(true);
  });
});
