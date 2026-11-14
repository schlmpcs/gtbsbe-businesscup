// View-model contract of the life events timeline (/tools/life-events). The ui/ files import only
// these types: every number here was computed by the engine (lifeEvents()); the UI formats it.
import type { ForecastPoint, LifeEvent, LifeEventKind, LifeEventLineItem, Money, Source } from '@lifeguessr/types';

export type { LifeEvent, LifeEventKind, LifeEventLineItem, Money, Source };

/** One line of an event's monthly change. `effect` < 0 = it costs you (money out, or less pay). */
export type LifeEventLineVM = { item: LifeEventLineItem; effect: Money; source: Source; isEstimate: boolean };

export type LifeEventVM = {
  id: string;
  kind: LifeEventKind;
  /** The event as entered (its kind's own fields, for the edit form). */
  input: LifeEvent;
  startYear: number;
  /** The calendar year it starts (this year + startYear). */
  calendarYear: number;
  /** Monthly effect on you when it starts (today's dollars): < 0 costs you, > 0 saves or earns. */
  monthlyEffect: Money;
  /** Paid once when it starts, as an effect (≤ 0). */
  oneOffEffect: Money;
  /** The event alone: net worth in 10 years with it minus without (today's dollars). */
  effect10yAlone: Money;
  lines: LifeEventLineVM[];
  /** Rests on an estimate: an estimated input, an assumption, or a starting value not changed yet. */
  isEstimate: boolean;
  /** Starts in year 10: shown, but outside the 10 years. */
  beyondHorizon: boolean;
  missingChildcare: boolean;
  /** Move: where to. */
  toMetro?: string;
};

export type MetroOption = { zip: string; metro: string };

export type LifeEventsVM = {
  /** Calendar year of "now" and the years 0–10 the timeline offers. */
  currentYear: number;
  years: number[];
  /** What the picker can add. */
  kinds: LifeEventKind[];
  /** In the order they were added. */
  events: LifeEventVM[];
  selectedId: string | null;
  select: (id: string | null) => void;
  add: (kind: LifeEventKind) => void;
  remove: (id: string) => void;
  setYear: (id: string, startYear: number) => void;
  /** Replace an event's own fields (same id and kind). */
  update: (event: LifeEvent) => void;
  /** Metros a move can go to (one area each). */
  metros: MetroOption[];
  homeMetro: string;
  homeIsFallback: boolean;
  /** Null when the engine rejected the events (an invalid number). */
  result: {
    without: ForecastPoint[];
    with: ForecastPoint[];
    in10y: { without: Money; with: Money };
    delta: Money;
  } | null;
};
