// Server-only: funnel events in process memory (tests, and `pnpm dev` without STORE_URL). Same rules
// as Postgres (./events.ts). Bounded, so a long dev session cannot grow it without end.
import { TOOL_IDS } from '@lifeguessr/types';
import { TOOL_COMPLETIONS } from './events';
import { anonKey } from './anonKey';
import {
  buildFunnelReport, maskOf, propsOf, uniqueById, type EventStore, type GuessStats, type MaskCount,
} from './events';

type Row = { id: string; anonKey: string; name: string; props: Record<string, unknown>; at: number };

/** Oldest rows are dropped past this many. */
export const MEMORY_EVENTS_MAX = 100_000;

export function createMemoryEventStore(opts: { now?: () => Date; max?: number } = {}): EventStore {
  const now = opts.now ?? (() => new Date());
  const max = opts.max ?? MEMORY_EVENTS_MAX;
  let rows: Row[] = [];
  const ids = new Set<string>();

  return {
    async record(anonId, events) {
      const key = anonKey(anonId);
      const at = now().getTime();
      let stored = 0;
      for (const e of uniqueById(events)) {
        if (ids.has(e.id)) continue;
        ids.add(e.id);
        rows.push({ id: e.id, anonKey: key, name: e.name, props: structuredClone(propsOf(e)), at });
        stored++;
      }
      if (rows.length > max) {
        const dropped = rows.slice(0, rows.length - max);
        rows = rows.slice(rows.length - max);
        for (const r of dropped) ids.delete(r.id);
      }
      return stored;
    },

    async funnel(window) {
      const from = window.from.getTime();
      const to = window.to.getTime();
      const inWindow = rows.filter((r) => r.at >= from && r.at <= to);

      const namesById = new Map<string, Set<string>>();
      for (const r of inWindow) {
        if (maskOf([r.name]) === 0) continue;
        const names = namesById.get(r.anonKey) ?? new Set<string>();
        names.add(r.name);
        namesById.set(r.anonKey, names);
      }
      const counts = new Map<number, number>();
      for (const names of namesById.values()) {
        const mask = maskOf(names);
        counts.set(mask, (counts.get(mask) ?? 0) + 1);
      }
      const masks: MaskCount[] = [...counts].map(([mask, users]) => ({ mask, users }));

      const guesses: GuessStats = { guesses: 0, cluesOpened: 0, blind: 0 };
      for (const r of inWindow) {
        const opened = r.props.cluesOpened;
        if (r.name !== 'home_guessed' || typeof opened !== 'number') continue;
        guesses.guesses++;
        guesses.cluesOpened += opened;
        if (opened === 0) guesses.blind++;
      }
      const tools = TOOL_IDS.map(tool=>{
        const opened = new Set(inWindow.filter(r=>r.name==='tool_opened' && r.props.tool===tool).map(r=>r.anonKey));
        const completed = new Set(inWindow.filter(r=>r.name===TOOL_COMPLETIONS[tool]).map(r=>r.anonKey));
        return {tool,opened:opened.size,completed:completed.size,converted:[...opened].filter(id=>completed.has(id)).length};
      });
      return buildFunnelReport(window, masks, guesses, tools);
    },
  };
}
