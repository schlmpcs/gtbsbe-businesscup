// @vitest-environment jsdom
// The overpaying check's view-model against fake engine, areas and events built on areaData.sample.json
// (testUtils.ts). Nothing here calls the real overpayingCheck; see the `todo`s at the end.
import type { ClientFunnelEvent, Profile } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { areaDataSample, cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { SAMPLE_METRO, UNCOVERED_ZIP, fakeDeps, onlyLines, sampleOverpayingResult, type FakeDeps } from './testUtils';
import type { OverpayingDeps, OverpayingOptions, OverpayingToolState, OverpayingVM } from './types';
import { CHECKED_EVENT_SETTLE_MS, useOverpaying } from './useOverpaying';

beforeEach(resetClientState);
afterEach(() => vi.useRealTimers());

const area75206 = areaDataSample.find((a) => a.zip === '75206')!;
const area75216 = areaDataSample.find((a) => a.zip === '75216')!;

async function setup(profile: Profile | null = null, opts: OverpayingOptions = {}, deps: OverpayingDeps = fakeDeps()) {
  const rendered = renderHook(() => useOverpaying(profile, { deps, ...opts }));
  await waitForReady(rendered.result);
  return { ...rendered, deps: deps as FakeDeps, vm: () => rendered.result.current as OverpayingVM };
}

describe('useOverpaying: the cold path', () => {
  it('starts with a household and nothing to compare, and asks for a ZIP', async () => {
    const { vm } = await setup();
    expect(vm().inputs).toEqual({
      zip: '', bedrooms: 2, adults: 1,
      kids: { infant: 0, toddler: 0, preschool: 0, schoolAge: 0 },
      amounts: { rent: null, carInsurance: null, groceries: null, childcare: null },
    });
    expect(vm().needs).toBe('zip');
    expect(vm().result).toBeNull();
    expect(vm().hidden).toBe(false);
    expect(vm().playHref).toBe('/play?stream=1');
    expect(vm().profileHref).toBe('/me/balance');
  });

  it('a covered ZIP and one amount give a result, recomputed on every change, with no network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { vm, deps } = await setup();
    act(() => vm().setZip('75206'));
    expect(vm().needs).toBe('amount');
    act(() => vm().setAmount('rent', 3000));
    expect(vm().needs).toBeNull();
    expect(vm().coverage).toEqual({ kind: 'exact', zip: '75206', metro: SAMPLE_METRO });
    const r = vm().result;
    expect(r?.status).toBe('ready');
    expect(deps.check).toHaveBeenCalledTimes(1);
    expect(deps.check.mock.calls[0]).toEqual([{ bedrooms: 2, adults: 1, kids: [], rent: 3000 }, area75206, undefined, { coverage: 'exact' }]);
    act(() => vm().setAmount('rent', 3100));
    expect(deps.check).toHaveBeenCalledTimes(2);
    expect(deps.check.mock.calls[1]![0]).toMatchObject({ rent: 3100 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('summarizes the engine result: lines, lines above, total gap per year, total 10-year effect (own profile)', async () => {
    const { vm } = await setup(cloneProfileDemo());
    act(() => {
      vm().setZip('75206');
      vm().setAmount('rent', 3000);
    });
    const r = vm().result;
    if (r?.status !== 'ready') throw new Error('expected a result');
    expect(r.data.rows.map((x) => [x.line, x.position])).toEqual([
      ['rent', 'above'], ['carInsurance', 'below'], ['groceries', 'inRange'], ['childcare', 'above'],
    ]);
    // Two above: 324 × 12 = 3 888 and 491.196 × 12 = 5 894.352 a year; 40 000 + 9 000 over 10 years.
    expect(r.data.summary.compared).toBe(4);
    expect(r.data.summary.above).toBe(2);
    expect(r.data.summary.gapPerYear).toBeCloseTo(9782.352, 6);
    expect(r.data.summary.effect10y).toBe(49_000);
  });

  it('without a profile there is no 10-year effect to show', async () => {
    const { vm } = await setup(null);
    act(() => {
      vm().setZip('75206');
      vm().setAmount('rent', 3000);
    });
    const r = vm().result;
    if (r?.status !== 'ready') throw new Error('expected a result');
    expect(r.data.effectAvailable).toBe(false);
    expect(r.data.summary.effect10y).toBeNull();
    expect(r.data.rows.every((x) => x.effect10y === null)).toBe(true);
  });

  it('only some amounts entered: the engine sees only those and the rest come back skipped', async () => {
    const deps = fakeDeps({ result: onlyLines(sampleOverpayingResult(), ['rent', 'groceries']) });
    const { vm } = await setup(null, {}, deps);
    act(() => {
      vm().setZip('75206');
      vm().setAmount('rent', 3000);
      vm().setAmount('groceries', 400);
    });
    expect(deps.check.mock.calls.at(-1)![0]).toEqual({ bedrooms: 2, adults: 1, kids: [], rent: 3000, groceries: 400 });
    const r = vm().result;
    if (r?.status !== 'ready') throw new Error('expected a result');
    expect(r.data.skipped).toEqual([
      { line: 'carInsurance', reason: 'notEntered' },
      { line: 'childcare', reason: 'notEntered' },
    ]);
  });

  it('a bad ZIP or an amount of 0 is flagged and nothing is checked', async () => {
    const { vm, deps } = await setup();
    act(() => {
      vm().setZip('SW1A 1AA');
      vm().setAmount('rent', 0);
    });
    expect(vm().invalidFields).toEqual(['zip', 'rent']);
    expect(vm().result).toBeNull();
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('keeps the household inside what the data takes', async () => {
    const { vm } = await setup();
    act(() => {
      vm().setBedrooms(6);
      vm().setAdults(0);
      vm().setKidCount('infant', 9);
    });
    expect(vm().inputs.bedrooms).toBe(4); // "4 or more": the data stops at 4
    expect(vm().inputs.adults).toBe(1);
    expect(vm().inputs.kids.infant).toBe(vm().limits.kidsPerBand);
    expect(vm().limits).toEqual({ kidsPerBand: 5, bedrooms: 4, adults: 4 });
  });
});

describe('useOverpaying: a profile', () => {
  it('fills the ZIP and the matching lines from profile.demo.json, and checks with that profile', async () => {
    const profile = cloneProfileDemo();
    const { vm, deps } = await setup(profile);
    // profile.demo.json: zip 75206, rentUtilities 1950, groceries 520 (estimate), childcare 0; car 310 is not insurance.
    expect(vm().inputs.zip).toBe('75206');
    expect(vm().inputs.amounts).toEqual({ rent: 1950, carInsurance: null, groceries: 520, childcare: null });
    expect(vm().prefill).toEqual({ zip: true, amounts: { rent: 'profile', carInsurance: null, groceries: 'profileEstimate', childcare: null } });
    expect(vm().result?.status).toBe('ready');
    expect(deps.check.mock.calls[0]).toEqual([{ bedrooms: 2, adults: 1, kids: [], rent: 1950, groceries: 520 }, area75206, profile, { coverage: 'exact' }]);
  });

  it('typing overrides a prefilled value and never touches the profile', async () => {
    const profile = cloneProfileDemo();
    const copy = structuredClone(profile);
    useAppStore.getState().setProfile(profile, 'user');
    const storeBefore = structuredClone(useAppStore.getState().profile);
    const { vm } = await setup(profile);
    act(() => vm().setAmount('rent', 2400));
    expect(vm().inputs.amounts.rent).toBe(2400);
    expect(vm().prefill.amounts.rent).toBeNull(); // typed now
    expect(vm().prefill.amounts.groceries).toBe('profileEstimate'); // still the profile's
    expect(profile).toEqual(copy);
    expect(useAppStore.getState().profile).toEqual(storeBefore);
  });

  it('a ZIP typed over the profile\'s wins, and the profile keeps its own', async () => {
    const profile = cloneProfileDemo();
    const { vm, deps } = await setup(profile);
    act(() => vm().setZip('75216'));
    expect(vm().coverage).toEqual({ kind: 'exact', zip: '75216', metro: SAMPLE_METRO });
    expect(vm().prefill.zip).toBe(false);
    expect(deps.check.mock.calls.at(-1)![1]).toBe(area75216);
    expect(profile.zip).toBe('75206');
  });
});

// The store round trip M2 gives: onStore writes the inputs, and the next render reads them back as `stored`.
function useRoundTrip(profile: Profile | null, deps: OverpayingDeps, saved?: OverpayingToolState) {
  const [stored, setStored] = useState<OverpayingToolState | undefined>(saved);
  return { vm: useOverpaying(profile, { deps, stored, onStore: setStored }), stored };
}

describe('useOverpaying: where a prefilled value came from, across the store round trip', () => {
  const FROM_PROFILE = { zip: true, amounts: { rent: 'profile', carInsurance: null, groceries: 'profileEstimate', childcare: null } };

  it('is still shown after the first edit has been saved and read back', async () => {
    const profile = cloneProfileDemo();
    const rendered = renderHook(() => useRoundTrip(profile, fakeDeps()));
    await waitFor(() => expect(rendered.result.current.vm.status).toBe('ready'));
    expect(rendered.result.current.vm.prefill).toEqual(FROM_PROFILE);
    expect(rendered.result.current.stored).toBeUndefined();

    act(() => rendered.result.current.vm.setAdults(2));
    expect(rendered.result.current.stored).toMatchObject({ adults: 2, zip: '75206', rent: 1950, groceries: 520 }); // really round-tripped
    expect(rendered.result.current.vm.inputs.amounts).toMatchObject({ rent: 1950, groceries: 520 }); // same values as before
    expect(rendered.result.current.vm.prefill).toEqual(FROM_PROFILE); // and still labelled as the profile's

    act(() => rendered.result.current.vm.setAmount('groceries', 640)); // typed over: no longer the profile's
    expect(rendered.result.current.vm.prefill.amounts).toEqual({ rent: 'profile', carInsurance: null, groceries: null, childcare: null });
  });

  it('is still shown after a reload, while the saved values are the profile\'s', async () => {
    const profile = cloneProfileDemo();
    const saved: OverpayingToolState = { zip: '75206', bedrooms: 2, adults: 2, kids: [], rent: 1950, groceries: 520 };
    const rendered = renderHook(() => useRoundTrip(profile, fakeDeps(), saved));
    await waitFor(() => expect(rendered.result.current.vm.status).toBe('ready'));
    expect(rendered.result.current.vm.prefill).toEqual(FROM_PROFILE);
  });

  it('is not claimed for saved values that are not the profile\'s', async () => {
    const saved: OverpayingToolState = { zip: '75216', bedrooms: 1, adults: 1, kids: [], rent: 1700 };
    const rendered = renderHook(() => useRoundTrip(cloneProfileDemo(), fakeDeps(), saved));
    await waitFor(() => expect(rendered.result.current.vm.status).toBe('ready'));
    expect(rendered.result.current.vm.prefill).toEqual({ zip: false, amounts: { rent: null, carInsurance: null, groceries: null, childcare: null } });
  });
});

describe('useOverpaying: a ZIP we do not cover', () => {
  it('shows the metro picker and no result until one is chosen; the result is then flagged approximate (metro)', async () => {
    const { vm, deps } = await setup();
    act(() => {
      vm().setZip(UNCOVERED_ZIP);
      vm().setAmount('rent', 2000);
    });
    expect(vm().coverage).toEqual({ kind: 'none', zip: UNCOVERED_ZIP });
    expect(vm().needs).toBe('metro');
    expect(vm().result).toBeNull();
    expect(vm().metroPicker?.options.map((o) => o.metro)).toEqual([SAMPLE_METRO, 'Boise, ID', 'Austin, TX']);
    expect(vm().coverageCounts).toEqual({ zips: 4, metros: 3 });
    expect(deps.check).not.toHaveBeenCalled();

    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO));
    expect(vm().metroPicker).toMatchObject({ metro: SAMPLE_METRO, tier: 'mid', tiers: ['cheap', 'mid', 'expensive', 'suburb'] });
    expect(vm().coverage).toEqual({ kind: 'metro', zip: UNCOVERED_ZIP, metro: SAMPLE_METRO, tier: 'mid' });
    expect(vm().result?.status).toBe('ready');
    expect(deps.check.mock.calls[0]![1]).toBe(area75206);
    expect(deps.check.mock.calls[0]![3]).toEqual({ coverage: 'metro' });

    act(() => vm().metroPicker!.setTier('cheap'));
    expect(deps.check.mock.calls.at(-1)![1]).toBe(area75216);
    expect(vm().coverage).toMatchObject({ kind: 'metro', tier: 'cheap' });
  });

  it('changing the metro keeps the area type when the new metro has it, else falls back to mid', async () => {
    const { vm } = await setup();
    act(() => vm().setZip(UNCOVERED_ZIP));
    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO));
    act(() => vm().metroPicker!.setTier('suburb'));
    act(() => vm().metroPicker!.setMetro('Austin, TX')); // has suburb: kept
    expect(vm().metroPicker).toMatchObject({ metro: 'Austin, TX', tier: 'suburb', tiers: ['cheap', 'mid', 'suburb'] });
    act(() => vm().metroPicker!.setMetro('Boise, ID')); // has only mid
    expect(vm().metroPicker).toMatchObject({ metro: 'Boise, ID', tier: 'mid' });
    act(() => vm().metroPicker!.setMetro(null));
    expect(vm().metroPicker).toMatchObject({ metro: null, tier: null, tiers: [] });
  });

  it('a metro chosen for one ZIP is forgotten when the ZIP changes to a different one', async () => {
    const onStore = vi.fn();
    const { vm, deps } = await setup(null, { onStore });
    act(() => {
      vm().setZip(UNCOVERED_ZIP);
      vm().setAmount('rent', 2000);
    });
    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO));
    expect(vm().coverage.kind).toBe('metro');
    expect(deps.check).toHaveBeenCalledTimes(1);

    act(() => vm().setZip('12345')); // another ZIP we do not have
    expect(vm().coverage).toEqual({ kind: 'none', zip: '12345' });
    expect(vm().needs).toBe('metro'); // asked again
    expect(vm().result).toBeNull();
    expect(vm().metroPicker).toMatchObject({ metro: null, tier: null, tiers: [] });
    expect(deps.check).toHaveBeenCalledTimes(1); // nothing was compared against Dallas for 12345
    expect(onStore.mock.calls.at(-1)![0]).not.toHaveProperty('metro');
    expect(onStore.mock.calls.at(-1)![0]).not.toHaveProperty('tier');
  });

  it('the same ZIP typed another way keeps the metro chosen for it', async () => {
    const { vm } = await setup();
    act(() => vm().setZip(UNCOVERED_ZIP));
    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO));
    act(() => vm().setZip(` ${UNCOVERED_ZIP}-0001 `)); // ZIP+4 and spaces: the same ZIP
    expect(vm().metroPicker).toMatchObject({ metro: SAMPLE_METRO, tier: 'mid' });
    expect(vm().coverage.kind).toBe('metro');
  });

  it('no picker for a covered ZIP, an empty one or a bad one', async () => {
    const { vm } = await setup();
    for (const zip of ['75206', '', 'abc']) {
      act(() => vm().setZip(zip));
      expect(vm().metroPicker, JSON.stringify(zip)).toBeNull();
    }
  });
});

describe('useOverpaying: the last inputs', () => {
  it('start from the saved ones, which win over the profile', async () => {
    const stored: OverpayingToolState = { zip: '75216', bedrooms: 1, adults: 2, kids: ['infant'], rent: 1700 };
    const { vm, deps } = await setup(cloneProfileDemo(), { stored });
    expect(vm().inputs).toEqual({
      zip: '75216', bedrooms: 1, adults: 2,
      kids: { infant: 1, toddler: 0, preschool: 0, schoolAge: 0 },
      amounts: { rent: 1700, carInsurance: null, groceries: null, childcare: null },
    });
    expect(deps.check.mock.calls[0]![0]).toEqual({ bedrooms: 1, adults: 2, kids: ['infant'], rent: 1700 });
  });

  it('are handed to onStore after each change the person makes, and not before', async () => {
    const onStore = vi.fn();
    const { vm } = await setup(null, { onStore });
    expect(onStore).not.toHaveBeenCalled();
    act(() => vm().setZip(' 75206-1234 '));
    act(() => vm().setAmount('rent', 3000));
    act(() => vm().setKidCount('toddler', 2));
    expect(onStore.mock.calls.at(-1)![0]).toEqual({ zip: '75206', bedrooms: 2, adults: 1, kids: ['toddler', 'toddler'], rent: 3000 });
  });

  it('a profile\'s prefilled values are kept with them once the person edits anything', async () => {
    const onStore = vi.fn();
    const { vm } = await setup(cloneProfileDemo(), { onStore });
    expect(onStore).not.toHaveBeenCalled(); // prefill alone is not "typed"
    act(() => vm().setAdults(2));
    expect(onStore.mock.calls.at(-1)![0]).toEqual({ zip: '75206', bedrooms: 2, adults: 2, kids: [], rent: 1950, groceries: 520 });
  });

  it('keeps the metro and area type chosen', async () => {
    const onStore = vi.fn();
    const { vm } = await setup(null, { onStore });
    act(() => vm().setZip(UNCOVERED_ZIP));
    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO));
    act(() => vm().metroPicker!.setTier('expensive'));
    expect(onStore.mock.calls.at(-1)![0]).toEqual({ zip: UNCOVERED_ZIP, metro: SAMPLE_METRO, tier: 'expensive', bedrooms: 2, adults: 1, kids: [] });
  });

  it('a storage that throws never breaks the screen', async () => {
    const onStore = vi.fn(() => {
      throw new Error('quota');
    });
    const { vm } = await setup(null, { onStore });
    act(() => vm().setZip('75206'));
    expect(vm().inputs.zip).toBe('75206');
  });
});

describe('useOverpaying: events', () => {
  const fired = (deps: FakeDeps): ClientFunnelEvent[] => deps.track.mock.calls.map((c) => c[0]);
  const checked = (deps: FakeDeps) => fired(deps).filter((e) => e.name === 'overpaying_checked');

  it('says the tool was opened, once, when it is on screen', async () => {
    const { deps } = await setup();
    expect(deps.trackTool).toHaveBeenCalledTimes(1);
    expect(deps.trackTool).toHaveBeenCalledWith('overpaying'); // lib/events trackTool: once per page session, key 'tool:overpaying'
  });

  it('sends overpaying_checked with counts only, once the inputs have settled', async () => {
    const { vm, deps } = await setup();
    vi.useFakeTimers();
    act(() => {
      vm().setZip('75206');
      vm().setAmount('rent', 3000);
    });
    expect(checked(deps)).toEqual([]);
    act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS - 1));
    expect(checked(deps)).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    // The fake engine compared 4 lines, 2 of them above the range.
    expect(checked(deps)).toEqual([{ name: 'overpaying_checked', props: { lines: 4, above: 2 } }]);
    const event = checked(deps)[0]!;
    expect(Object.keys((event as { props: object }).props).sort()).toEqual(['above', 'lines']);
    const everything = JSON.stringify(deps.track.mock.calls);
    for (const secret of ['3000', '75206', SAMPLE_METRO]) expect(everything).not.toContain(secret); // no amount, ZIP or place
  });

  it('does not send one per keystroke: typing through a number counts the last set', async () => {
    const { vm, deps } = await setup();
    vi.useFakeTimers();
    act(() => vm().setZip('75206'));
    for (const rent of [3, 30, 300, 3000]) {
      act(() => vm().setAmount('rent', rent));
      act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS / 2));
    }
    expect(checked(deps)).toEqual([]);
    act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS));
    expect(checked(deps)).toHaveLength(1);
  });

  it('counts a set of inputs once however often it comes back; a new set counts again', async () => {
    const { vm, deps } = await setup();
    vi.useFakeTimers();
    const settle = () => act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS));
    act(() => {
      vm().setZip('75206');
      vm().setAmount('rent', 3000);
    });
    settle();
    act(() => vm().setAmount('rent', 3100));
    settle();
    expect(checked(deps)).toHaveLength(2);
    act(() => vm().setAmount('rent', 3000)); // back to the first set
    settle();
    expect(checked(deps)).toHaveLength(2);
    act(() => vm().setZip(' 75206-0001 ')); // same ZIP typed differently
    settle();
    expect(checked(deps)).toHaveLength(2);
    act(() => vm().setZip('75216')); // another area
    settle();
    expect(checked(deps)).toHaveLength(3);
  });

  it('sends nothing for a result that compared no line, or for an error', async () => {
    const empty = { ...sampleOverpayingResult(), lines: [], skipped: [{ line: 'childcare' as const, reason: 'noData' as const }] };
    const { vm, deps } = await setup(null, {}, fakeDeps({ result: empty }));
    vi.useFakeTimers();
    act(() => {
      vm().setZip('75206');
      vm().setAmount('childcare', 900);
    });
    act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS * 2));
    expect(checked(deps)).toEqual([]);
  });
});

describe('useOverpaying: streamer mode', () => {
  it('hides the tool: nothing computed, nothing sent', async () => {
    const { vm, deps } = await setup(cloneProfileDemo(), { streamer: true });
    vi.useFakeTimers();
    expect(vm().hidden).toBe(true);
    expect(vm().result).toBeNull();
    act(() => vm().setAmount('rent', 3000));
    act(() => vi.advanceTimersByTime(CHECKED_EVENT_SETTLE_MS * 2));
    expect(deps.check).not.toHaveBeenCalled();
    expect(deps.track).not.toHaveBeenCalled();
    expect(deps.trackTool).not.toHaveBeenCalled();
  });
});

// The issue's tests that need the real `overpayingCheck` (#86) in this branch. They run the view-model
// against areaData.sample.json and compare with the hand-worked engine numbers.
describe.todo('with the real overpayingCheck (#86 on main, not in this branch until M1 is reconciled)');
