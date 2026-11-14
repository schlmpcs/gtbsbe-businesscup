// Server-only: funnel events in Postgres (table `funnel_events`, migration 004).
import { FUNNEL_EVENT_NAMES, TOOL_IDS } from '@lifeguessr/types';
import { anonKey } from './anonKey';
import { buildFunnelReport, propsOf, uniqueById, type EventStore, type GuessStats, type MaskCount, type ToolCount, TOOL_COMPLETIONS } from './events';
import type { Db } from './postgres';

// One statement per batch. Arrays go in as parameters (never into the SQL text); props are JSON
// text cast to jsonb, because node-postgres would turn a JS object array into a Postgres array
// literal, not JSON.
const INSERT = `
INSERT INTO funnel_events (id, anon_key, name, props)
SELECT e.id, $1, e.name, e.props::jsonb
  FROM unnest($2::uuid[], $3::text[], $4::text[]) AS e(id, name, props)
ON CONFLICT (id) DO NOTHING`;

// Each id's set of event names in the window as a bit mask (bit i = $1[i + 1]), then how many ids
// share each set. At most one row per distinct set, however many people and events there are.
const MASKS = `
SELECT mask, count(*)::int AS users
  FROM (SELECT bit_or(1::bigint << (array_position($1::text[], name) - 1)) AS mask
          FROM funnel_events
         WHERE occurred_at >= $2 AND occurred_at <= $3 AND name = ANY($1::text[])
         GROUP BY anon_key) AS per_id
 GROUP BY mask`;

const GUESSES = `
SELECT count(*)::int AS guesses,
       coalesce(sum((props->>'cluesOpened')::int), 0)::int AS clues_opened,
       count(*) FILTER (WHERE (props->>'cluesOpened')::int = 0)::int AS blind
  FROM funnel_events
 WHERE name = 'home_guessed' AND occurred_at >= $1 AND occurred_at <= $2
   AND jsonb_typeof(props->'cluesOpened') = 'number'`;

const TOOLS = `
SELECT tool, count(*) FILTER (WHERE opened)::int AS opened,
       count(*) FILTER (WHERE completed)::int AS completed,
       count(*) FILTER (WHERE opened AND completed)::int AS converted
FROM (
  SELECT t.tool, e.anon_key,
         bool_or(e.name = 'tool_opened' AND e.props->>'tool' = t.tool) AS opened,
         bool_or(e.name = t.completion) AS completed
  FROM unnest($1::text[], $2::text[]) AS t(tool, completion)
  JOIN funnel_events e ON (e.name = t.completion OR (e.name = 'tool_opened' AND e.props->>'tool' = t.tool))
  WHERE e.occurred_at >= $3 AND e.occurred_at <= $4
  GROUP BY t.tool, e.anon_key
) per_id GROUP BY tool`;

export function createPostgresEventStore(db: Db): EventStore {
  return {
    async record(anonId, events) {
      const unique = uniqueById(events);
      if (unique.length === 0) return 0;
      const { rowCount } = await db.query(INSERT, [
        anonKey(anonId),
        unique.map((e) => e.id),
        unique.map((e) => e.name),
        unique.map((e) => JSON.stringify(propsOf(e))),
      ]);
      return rowCount ?? 0;
    },

    async funnel(window) {
      // Both reads see one snapshot, so the funnel and the guess counts agree.
      return db.transaction(async (tx) => {
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        const masks = await tx.query<MaskCount>(MASKS, [FUNNEL_EVENT_NAMES, window.from, window.to]);
        const guesses = await tx.query<{ guesses: number; clues_opened: number; blind: number }>(GUESSES, [window.from, window.to]);
        const g = guesses.rows[0];
        const stats: GuessStats = { guesses: g?.guesses ?? 0, cluesOpened: g?.clues_opened ?? 0, blind: g?.blind ?? 0 };
        const tools = await tx.query<ToolCount>(TOOLS, [TOOL_IDS, TOOL_IDS.map(id=>TOOL_COMPLETIONS[id]),window.from,window.to]);
        return buildFunnelReport(window, masks.rows.map(row=>({...row,mask:Number(row.mask)})), stats, tools.rows);
      });
    },
  };
}
