import type { Migration } from './types';

// Funnel events (T8, POST /api/events): one row per event, for the funnel and the game metrics
// (GET /api/events/funnel; docs/PRODUCT.md → Metrics to show).
//
// - `id` is the browser's crypto.randomUUID() for the event, so a batch sent twice (a retry after
//   a lost reply) is stored once (INSERT … ON CONFLICT DO NOTHING).
// - `anon_key` is sha256(anonId) in hex (../anonKey.ts), as in every table; the raw id is never kept.
// - `name` is not checked against the list of names here: the list lives in code
//   (FUNNEL_EVENT_NAMES), and a rollback must still be able to read rows a newer build wrote.
// - `props` holds only the small enums and counts the route accepts (EventsRequestSchema).
// - `occurred_at` is the server's clock at insert, never the browser's.
export const m004FunnelEvents: Migration = {
  version: 4,
  name: 'funnel_events',
  sql: `
CREATE TABLE funnel_events (
  id          uuid PRIMARY KEY,
  anon_key    text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  name        text NOT NULL CHECK (name ~ '^[a-z][a-z0-9_]{0,47}$'),
  props       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(props) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- The funnel reads a time window, then groups by anon_key.
CREATE INDEX funnel_events_occurred_at ON funnel_events (occurred_at);
-- The game metrics read one event name in a time window.
CREATE INDEX funnel_events_name_occurred_at ON funnel_events (name, occurred_at);
`,
};
