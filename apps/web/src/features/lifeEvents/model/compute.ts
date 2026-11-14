// Pure parts of the life events view-model: starting values for a new event and the engine call
// turned into view data. No React here, so it is tested directly.
import { LIFE_EVENTS_YEARS, inflationAnnualOf, lifeEvents } from '@lifeguessr/engine';
import type { AreaData, LifeEvent, LifeEventKind, LifeEventsResult, Profile } from '@lifeguessr/types';
import type { LifeEventVM, LifeEventsVM, MetroOption } from './types';

export const LIFE_EVENT_KINDS: LifeEventKind[] = ['baby', 'move', 'car', 'raise', 'purchase'];

/**
 * Starting values of a new event: typical examples the person changes to theirs. Until they do, the
 * event is labeled an estimate. The car is a mid-priced car on a 5-year loan; the purchase a wedding-
 * sized one-off.
 */
export const EVENT_DEFAULTS = {
  baby: { startYear: 2 },
  move: { startYear: 1, bedrooms: 2 as const },
  car: { startYear: 3, price: 30_000, downPayment: 3_000, apr: 0.07, termMonths: 60 },
  raise: { startYear: 1, change: { by: 'rate' as const, rate: 0.1 } },
  purchase: { startYear: 2, amount: 15_000 },
};

/** A new event of `kind` with the starting values. A move goes to the first metro that is not home. */
export function newEvent(kind: LifeEventKind, id: string, metros: readonly MetroOption[], homeMetro: string): LifeEvent {
  switch (kind) {
    case 'baby':
      return { id, kind, ...EVENT_DEFAULTS.baby };
    case 'move': {
      const to = metros.find((m) => m.metro !== homeMetro) ?? metros[0];
      return { id, kind, ...EVENT_DEFAULTS.move, toZip: to?.zip ?? '' };
    }
    case 'car':
      return { id, kind, ...EVENT_DEFAULTS.car };
    case 'raise':
      return { id, kind, startYear: EVENT_DEFAULTS.raise.startYear, change: { ...EVENT_DEFAULTS.raise.change } };
    case 'purchase':
      return { id, kind, ...EVENT_DEFAULTS.purchase };
  }
}

export type ComputeInput = {
  profile: Profile;
  events: readonly LifeEvent[];
  /** Ids of events the person has edited (their values are no longer the starting examples). */
  edited: ReadonlySet<string>;
  home: AreaData;
  areas: readonly AreaData[];
  currentYear: number;
};

/** Runs the engine; null when it rejects the events (an invalid number entered). */
function run(input: ComputeInput): LifeEventsResult | null {
  try {
    return lifeEvents(input.profile, input.events, {
      home: input.home,
      areas: input.areas,
      rates: { inflationAnnual: inflationAnnualOf(input.home) },
      todaysDollars: true,
    });
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
}

/** The view data: the two net-worth lines, the delta and each event's lines (effects: < 0 costs you). */
export function computeLifeEvents(input: ComputeInput): { events: LifeEventVM[]; result: LifeEventsVM['result'] } {
  const r = run(input);
  const events = input.events.map((e, i): LifeEventVM => {
    const fx = r?.events[i];
    const defaults = !input.edited.has(e.id) && e.kind !== 'baby' && e.kind !== 'move';
    return {
      id: e.id,
      kind: e.kind,
      input: e,
      startYear: e.startYear,
      calendarYear: input.currentYear + e.startYear,
      monthlyEffect: fx ? -fx.monthly : 0,
      oneOffEffect: fx ? -fx.oneOff : 0,
      effect10yAlone: fx?.effect10yAlone ?? 0,
      lines: (fx?.lines ?? []).map((l) => ({ item: l.item, effect: -l.monthly, source: l.source, isEstimate: l.isEstimate })),
      isEstimate: defaults || (fx?.isEstimate ?? false),
      beyondHorizon: e.startYear >= LIFE_EVENTS_YEARS,
      missingChildcare: fx?.missingChildcare ?? false,
      ...(fx?.toMetro !== undefined && { toMetro: fx.toMetro }),
    };
  });
  const result = r && {
    without: r.base.points,
    with: r.with.points,
    in10y: { without: r.base.in10y.mid, with: r.with.in10y.mid },
    delta: r.delta,
  };
  return { events, result };
}
