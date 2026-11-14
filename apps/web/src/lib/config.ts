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

/** Whether funnel events are sent. */
export type EventsSource = 'off' | 'api';

/**
 * `NEXT_PUBLIC_EVENTS_SOURCE=api` sends funnel events to POST /api/events (task T8, needs the
 * store). Default: off, so a build without a store never calls a route that would answer 503.
 */
export function eventsSource(): EventsSource {
  return process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api' ? 'api' : 'off';
}

/** Which daily game /play is. */
export type GameMode = 'duel' | 'slider';

/**
 * `/play` is the duel ("Which life costs more?", S2/S3) by default. `NEXT_PUBLIC_GAME_MODE=slider`
 * brings back the slider game ("guess the home's monthly cost", with S4 streamer mode at
 * /play?stream=1) as the rollback. S1 Today, S5 and the screen list read the same flag, so they
 * describe the game /play actually serves.
 */
export function gameMode(): GameMode {
  return process.env.NEXT_PUBLIC_GAME_MODE === 'slider' ? 'slider' : 'duel';
}

/**
 * Where the duel gets its pairs, picks and hints, separately from NEXT_PUBLIC_GAME_SOURCE (which the
 * slider game, sessions plumbing and the leaderboard follow). Default `fixtures`: the duel is
 * computed in the browser with the real engine, even in an API build. `NEXT_PUBLIC_DUEL_SOURCE=api`
 * plays against the server routes; until they land (#115, switch-over #120) that build answers
 * "unavailable".
 */
export function duelSource(): GameSource {
  return process.env.NEXT_PUBLIC_DUEL_SOURCE === 'api' ? 'api' : 'fixtures';
}
