// Client feature flags. Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each flag is
// read with its literal name.

/** Where the daily game gets its cards, clues and scores. */
export type GameSource = 'fixtures' | 'api';

/**
 * `NEXT_PUBLIC_GAME_SOURCE=api` uses the server routes (/api/daily, /api/daily/clue,
 * /api/daily/guess; task T5): the server holds the answers, records clues, scores guesses and
 * keeps the results the leaderboard and share cards read (needs the store, STORE_URL). Anything
 * else, including unset, plays on the fixture cards in the browser with the same engine.
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
