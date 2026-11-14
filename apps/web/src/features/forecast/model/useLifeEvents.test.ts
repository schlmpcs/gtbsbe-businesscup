// @vitest-environment jsdom
import { getArea } from '@lifeguessr/data/areas';
import { MAX_LIFE_EVENTS, type ClientFunnelEvent, type EventsRequest, type LifeEvent } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lifeEvents as t } from '@/copy';
import { infantChildcareFor } from '@/lib/areas';
import { flushEvents, queuedEventsForTests, resetEventsForTests } from '@/lib/events';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import type { LifeEventDraft } from './types';
import { useLifeEvents } from './useLifeEvents';

let sent: EventsRequest[] = [];
beforeEach(() => {
  resetClientState();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15, 12)); // 15 Nov 2026, local time
  sent = [];
  resetEventsForTests(async (batch) => {
    sent.push(batch);
    return 'sent';
  });
});
afterEach(() => vi.useRealTimers());

async function tracked(): Promise<ClientFunnelEvent[]> {
  while (queuedEventsForTests().length > 0) await flushEvents();
  return sent.flatMap((b) => b.events).map(({ id: _id, ...e }) => e as ClientFunnelEvent);
}

async function ready() {
  const hook = renderHook(() => useLifeEvents());
  await waitForReady(hook.result);
  return hook;
}

const DALLAS_INFANT = getArea('75206').childcareMonthly!.infant; // the demo profile's ZIP

const draft = (over: Partial<LifeEventDraft> = {}): LifeEventDraft => ({
  kind: 'spending', month: '2027-06', amount: 500, category: 'other', direction: 'cost', ...over,
});

describe('useLifeEvents (S10 "Coming up")', () => {
  it('starts empty, with shortcuts prefilled from today’s numbers and months from next month to 30 years ahead', async () => {
    const { result } = await ready();
    const vm = result.current;
    expect(vm.events).toEqual([]);
    expect(vm.canAdd).toBe(true);
    expect(vm.maxEvents).toBe(MAX_LIFE_EVENTS);
    expect(vm.monthRange).toEqual({ min: '2026-12', max: '2056-11' });
    const byPreset = Object.fromEntries(vm.shortcuts.map((s) => [s.preset, s]));
    expect(vm.shortcuts.map((s) => s.preset)).toEqual(['raise', 'kid', 'move', 'bigPurchase']);
    expect(byPreset.raise!.draft).toEqual({ kind: 'pay', preset: 'raise', month: '2027-11', amount: 5_200, category: 'other', direction: 'cost' });
    expect(byPreset.kid!.draft).toMatchObject({ kind: 'spending', preset: 'kid', category: 'childcare', amount: DALLAS_INFANT });
    expect(byPreset.kid!.childcare).toEqual({
      basis: 'area', infantMonthly: DALLAS_INFANT, source: getArea('75206').childcareMonthly!.source,
    });
    expect(byPreset.move!.draft).toMatchObject({ kind: 'spending', preset: 'move', category: 'rentUtilities', amount: 1_950 });
    expect(byPreset.bigPurchase!.draft).toMatchObject({ kind: 'oneOff', preset: 'bigPurchase', direction: 'cost', amount: null });
    expect(vm.custom).toEqual({ kind: 'spending', month: '2027-11', amount: null, category: 'other', direction: 'cost' });
  });

  it('kid: the median of our 60 areas without a ZIP we cover, labelled so; a second kid adds to the first', async () => {
    useAppStore.setState((s) => ({ profile: { ...s.profile, zip: '99999' } }));
    const { result } = await ready();
    const median = infantChildcareFor(null);
    let kid = result.current.shortcuts.find((s) => s.preset === 'kid')!;
    expect(kid.childcare).toEqual({ basis: 'median', infantMonthly: median.monthly, source: median.source, areaCount: 60 });
    expect(kid.draft.amount).toBe(median.monthly);

    act(() => void result.current.add({ ...kid.draft, month: '2028-01' }));
    kid = result.current.shortcuts.find((s) => s.preset === 'kid')!;
    expect(kid.draft.amount).toBeCloseTo(2 * median.monthly, 6);

    // With childcare today, the first kid adds to it too.
    act(() => {
      useAppStore.getState().setSpending('childcare', 400);
      useAppStore.getState().removeLifeEvent(result.current.events[0]!.id);
    });
    kid = result.current.shortcuts.find((s) => s.preset === 'kid')!;
    expect(kid.draft.amount).toBeCloseTo(400 + median.monthly, 6);
  });

  it('adds a kid from the shortcut: a childcare estimate on the profile, listed and labelled, counted once', async () => {
    const { result } = await ready();
    const kid = result.current.shortcuts.find((s) => s.preset === 'kid')!;
    let errors: unknown;
    act(() => void (errors = result.current.add({ ...kid.draft, month: '2028-03' })));
    expect(errors).toBeNull();

    const [stored] = useAppStore.getState().profile.events!;
    expect(stored).toMatchObject({
      kind: 'spending', month: '2028-03', preset: 'kid', category: 'childcare', monthly: { value: DALLAS_INFANT, isEstimate: true },
    });
    expect(stored!.id).toMatch(/^[A-Za-z0-9:_.-]{1,64}$/);
    expect(result.current.events).toEqual([
      {
        id: stored!.id, kind: 'spending', preset: 'kid', label: t.label({ kind: 'spending', preset: 'kid' }), month: '2028-03',
        amount: DALLAS_INFANT, isEstimate: true, category: 'childcare', draft: { ...kid.draft, month: '2028-03' },
      },
    ]);
    expect(await tracked()).toEqual([{ name: 'life_event_added', props: { kind: 'spending', preset: 'kid' } }]);
  });

  it('lists events by month (same month: in the order added), each with its label', async () => {
    const { result } = await ready();
    act(() => {
      result.current.add(draft({ kind: 'oneOff', month: '2028-01', amount: 20_000, direction: 'income' }));
      result.current.add(draft({ kind: 'pay', preset: 'raise', month: '2027-03', amount: 6_000 }));
      result.current.add(draft({ month: '2028-01', category: 'car', amount: 0 }));
    });
    expect(result.current.events.map((e) => [e.month, e.label, e.amount, e.isEstimate])).toEqual([
      ['2027-03', t.label({ kind: 'pay', preset: 'raise' }), 6_000, false],
      ['2028-01', t.label({ kind: 'oneOff', direction: 'income' }), 20_000, false],
      ['2028-01', t.label({ kind: 'spending', category: 'car' }), 0, false],
    ]);
    expect(await tracked()).toEqual([
      { name: 'life_event_added', props: { kind: 'oneOff' } },
      { name: 'life_event_added', props: { kind: 'pay', preset: 'raise' } },
      { name: 'life_event_added', props: { kind: 'spending' } },
    ]);
  });

  it('validates the month (next month to 30 years ahead) and the amount ($0 allowed for pay and spending, not a one-off)', async () => {
    const { result } = await ready();
    const { validate, amountMax } = result.current;
    expect(validate(draft())).toBeNull();
    expect(validate(draft({ month: '' }))).toEqual({ month: 'missing' });
    expect(validate(draft({ month: '2026-11' }))).toEqual({ month: 'past' }); // this month has started
    expect(validate(draft({ month: '2025-01' }))).toEqual({ month: 'past' });
    expect(validate(draft({ month: '2026-12' }))).toBeNull();
    expect(validate(draft({ month: '2056-11' }))).toBeNull();
    expect(validate(draft({ month: '2056-12' }))).toEqual({ month: 'tooFar' });
    expect(validate(draft({ month: 'soon' }))).toEqual({ month: 'missing' });

    expect(validate(draft({ amount: null }))).toEqual({ amount: 'missing' });
    expect(validate(draft({ amount: 0 }))).toBeNull();
    expect(validate(draft({ kind: 'pay', amount: 0 }))).toBeNull();
    expect(validate(draft({ amount: -1 }))).toEqual({ amount: 'negative' });
    expect(validate(draft({ kind: 'oneOff', amount: 0 }))).toEqual({ amount: 'zero' });
    expect(validate(draft({ kind: 'oneOff', amount: -5 }))).toEqual({ amount: 'negative' });
    expect(validate(draft({ amount: Number.NaN }))).toEqual({ amount: 'missing' });
    for (const kind of ['pay', 'spending', 'oneOff'] as const) {
      expect(validate(draft({ kind, amount: amountMax[kind] }))).toBeNull();
      expect(validate(draft({ kind, amount: amountMax[kind] + 1 }))).toEqual({ amount: 'tooLarge' });
    }
    expect(validate(draft({ month: '', amount: null }))).toEqual({ month: 'missing', amount: 'missing' });

    let errors: unknown;
    act(() => void (errors = result.current.add(draft({ month: '2026-11' }))));
    expect(errors).toEqual({ month: 'past' });
    expect(useAppStore.getState().profile.events).toBeUndefined();
    expect(await tracked()).toEqual([]);
  });

  it('edits and removes an event; a preset that no longer fits the kind or category is dropped', async () => {
    const { result } = await ready();
    act(() => void result.current.add(draft({ preset: 'move', category: 'rentUtilities', amount: 1_700 })));
    const id = result.current.events[0]!.id;

    act(() => void result.current.update(id, { ...result.current.events[0]!.draft, amount: 1_600, month: '2027-09' }));
    expect(result.current.events[0]).toMatchObject({ id, preset: 'move', amount: 1_600, month: '2027-09' });

    act(() => void result.current.update(id, { ...result.current.events[0]!.draft, kind: 'oneOff', amount: 3_000 }));
    expect(result.current.events[0]).toMatchObject({ id, kind: 'oneOff', direction: 'cost', amount: 3_000 });
    expect(result.current.events[0]!.preset).toBeUndefined();

    let errors: unknown;
    act(() => void (errors = result.current.update(id, { ...result.current.events[0]!.draft, amount: 0 })));
    expect(errors).toEqual({ amount: 'zero' });
    expect(result.current.events[0]!.amount).toBe(3_000);

    act(() => result.current.remove(id));
    expect(result.current.events).toEqual([]);
  });

  it(`can hold ${MAX_LIFE_EVENTS} events: then the shortcuts are off and adding does nothing`, async () => {
    const { result } = await ready();
    act(() => {
      for (let i = 0; i < MAX_LIFE_EVENTS; i++) result.current.add(draft({ amount: 100 + i }));
    });
    expect(result.current.events).toHaveLength(MAX_LIFE_EVENTS);
    expect(result.current.canAdd).toBe(false);
    act(() => void result.current.add(draft()));
    expect(result.current.events).toHaveLength(MAX_LIFE_EVENTS);
  });

  it('shows the events that started once: taken from the store, then gone after dismiss', async () => {
    const raise: LifeEvent = { id: 'ev-raise', kind: 'pay', month: '2026-11', preset: 'raise', takeHomePay: { value: 6_000, isEstimate: false } };
    useAppStore.setState((s) => ({ profile: { ...s.profile, events: [raise] } }));
    const { result, unmount } = await ready(); // folding runs once the saved state is loaded
    expect(useAppStore.getState().profile.takeHomePay.value).toBe(6_000);
    expect(result.current.foldedNotes).toEqual([
      { kind: 'pay', month: '2026-11', preset: 'raise', text: t.folded({ kind: 'pay', preset: 'raise' }, 'November 2026') },
    ]);
    expect(useAppStore.getState().foldedNotes).toEqual([]); // shown once: not again on the next visit
    act(() => result.current.dismissFolded());
    expect(result.current.foldedNotes).toEqual([]);
    unmount();
    const again = await ready();
    expect(again.result.current.foldedNotes).toEqual([]);
  });
});
