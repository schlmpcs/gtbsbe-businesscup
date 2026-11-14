// Server-only: funnel events (T8). What the browser (POST /api/events) and the Pro routes record,
// and the funnel report built from them (GET /api/events/funnel; docs/PRODUCT.md → Metrics to show).
//
// The rules live here once, as pure functions; the Postgres and memory stores only store rows and
// count them, so both report the same numbers:
// - Events are stored under the hash of the anonymous id, with the server's clock. An event id
//   already stored (a resent batch) is skipped, so retries never double count.
// - The report counts distinct anonymous ids, not events: one person who reloads /future five
//   times reached "forecast" once. Each id is reduced to the set of event names it sent in the
//   window, as a bit mask (bit i = FUNNEL_EVENT_NAMES[i]); the stores return how many ids sent
//   each set, and buildFunnelReport derives every number from those counts.
import {
  FUNNEL_EVENT_NAMES, FUNNEL_STEPS, TOOL_IDS, type ToolId, type FunnelEvent, type FunnelEventName, type FunnelReport,
} from '@lifeguessr/types';

/** One event to store: its id (a UUID; the browser's, or a fresh one for server events) and body. */
export type StoredEvent = FunnelEvent & { id: string };

/** The report window, both ends included. */
export type FunnelWindow = { from: Date; to: Date };

/** How many anonymous ids sent exactly the set of events `mask` stands for. */
export type MaskCount = { mask: string; users: number };

/** The `home_guessed` events in the window: how many, clues opened in total, how many with none. */
export type GuessStats = { guesses: number; cluesOpened: number; blind: number };

export interface EventStore {
  /** Stores `events` for this anonymous id; returns how many were new (resent ids are skipped). */
  record(anonId: string, events: readonly StoredEvent[]): Promise<number>;
  /** The funnel and game metrics over `window`. */
  funnel(window: FunnelWindow): Promise<FunnelReport>;
}

/** The bit of `name` in a mask; 0 for a name this build does not know (e.g. written by a newer one). */
export function eventBit(name: string): bigint {
  const i = (FUNNEL_EVENT_NAMES as readonly string[]).indexOf(name);
  return i < 0 ? 0n : 1n << BigInt(i);
}

/** The mask of a set of event names. */
export function maskOf(names: Iterable<string>): bigint {
  let mask = 0n;
  for (const name of names) mask |= eventBit(name);
  return mask;
}

/** The first of each id, in order: a batch that repeats an event stores it once. */
export function uniqueById(events: readonly StoredEvent[]): StoredEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** The props column of an event: `{}` for an event without props. */
export const propsOf = (event: FunnelEvent): Record<string, unknown> => ('props' in event ? { ...event.props } : {});

const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

/** Everything GET /api/events/funnel reports, from the per-id event sets and the guess counts. */
export type ToolCount = { tool: ToolId; opened: number; completed: number; converted: number };
export function buildFunnelReport(window: FunnelWindow, masks: readonly MaskCount[], guesses: GuessStats, tools: readonly ToolCount[] = []): FunnelReport {
  const rows = masks.filter((m) => BigInt(m.mask) !== 0n && m.users > 0);
  /** Distinct ids that sent every event in `need`. */
  const withAll = (need: bigint) => rows.reduce((sum, m) => ((BigInt(m.mask) & need) === need ? sum + m.users : sum), 0);
  const bit = (name: FunnelEventName) => eventBit(name);

  const events = Object.fromEntries(FUNNEL_EVENT_NAMES.map((name) => [name, withAll(bit(name))])) as Record<FunnelEventName, number>;

  let need = 0n;
  let previous: number | null = null;
  const steps = FUNNEL_STEPS.map((name) => {
    need |= bit(name);
    const funnel = withAll(need);
    const step = { name, users: events[name], funnel, conversion: previous === null ? null : ratio(funnel, previous) };
    previous = funnel;
    return step;
  });

  const players = events.play_started;
  const finished = events.game_finished;
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    users: rows.reduce((sum, m) => sum + m.users, 0),
    steps,
    events,
    tools: {
      opened: Object.fromEntries(TOOL_IDS.map(id=>[id,tools.find(t=>t.tool===id)?.opened??0])) as Record<ToolId,number>,
      completed: Object.fromEntries(TOOL_IDS.map(id=>[id,tools.find(t=>t.tool===id)?.completed??0])) as Record<ToolId,number>,
      rates: Object.fromEntries(TOOL_IDS.map(id=>{const t=tools.find(t=>t.tool===id);return [id,ratio(t?.converted??0,t?.opened??0)];})) as Record<ToolId,number|null>,
    },
    game: {
      players,
      finished,
      finishRate: ratio(withAll(bit('play_started') | bit('game_finished')), players),
      guesses: guesses.guesses,
      cluesPerHome: ratio(guesses.cluesOpened, guesses.guesses),
      blindGuessRate: ratio(guesses.blind, guesses.guesses),
      shared: events.result_shared,
      shareRate: ratio(withAll(bit('game_finished') | bit('result_shared')), finished),
    },
  };
}

/** The window of the last `days` days up to `now`. */
export function lastDays(days: number, now: Date = new Date()): FunnelWindow {
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}

/** Completion markers for the independent tool funnels. */
export const TOOL_COMPLETIONS = { subscriptions: 'subs_revealed', overpaying: 'overpaying_checked', payoff: 'payoff_planned' } as const;
