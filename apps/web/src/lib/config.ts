// Client feature flags. Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each flag is
// read with its literal name.

/** Where the daily game gets its cards, clues and scores. */
export type GameSource = 'fixtures' | 'api';

/**
 * `NEXT_PUBLIC_GAME_SOURCE=api` uses the server routes (/api/daily, /api/daily/clue,
 * /api/daily/guess; task T5). Anything else, including unset, plays on the fixture cards in the
 * browser, so the game works before T5 lands.
 */
export function gameSource(): GameSource {
  return process.env.NEXT_PUBLIC_GAME_SOURCE === 'api' ? 'api' : 'fixtures';
}

/** Where the profile and wishlist are saved besides this browser. */
export type SessionSource = 'local' | 'api';

/**
 * `NEXT_PUBLIC_SESSION_SOURCE=api` also saves to POST /api/session (task T4). Default: local only
 * (localStorage), so nothing calls a route that does not exist yet.
 */
export function sessionSource(): SessionSource {
  return process.env.NEXT_PUBLIC_SESSION_SOURCE === 'api' ? 'api' : 'local';
}

/** Whether funnel events are sent. */
export type EventsSource = 'off' | 'api';

/**
 * `NEXT_PUBLIC_EVENTS_SOURCE=api` sends funnel events to POST /api/events (task T8, needs the
 * store). Default: off, so a build without a store never calls a route that would answer 503.
 */
export function eventsSource(): EventsSource {
  return process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api' ? 'api' : 'off';
}
