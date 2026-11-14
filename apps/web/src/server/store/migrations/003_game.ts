import type { Migration } from './types';

// The daily game (T5, /api/daily/clue and /api/daily/guess). One row per clue a player opened and
// one per guess, keyed by the US Eastern date of the set, the player's anon_key (sha256 of the
// anonymous id, ../anonKey.ts) and the card.
//
// - game_clues: what the server counts when it scores a guess (never a count from the client).
//   The primary key makes opening the same clue twice count once.
// - game_results: the scored guess. The UNIQUE constraint is the one-guess-per-card-per-player-
//   per-day rule; a second insert loses and the stored result is answered instead. `result_id` is
//   random (not derived from the anon id) and is what share links carry. cost, result and card
//   hold the GuessReveal exactly as answered, so a share card or a replay shows the numbers the
//   player saw even after the area data is refreshed. points and in_range are copies of
//   result.points and result.inRange for the leaderboard's sums.
export const m003Game: Migration = {
  version: 3,
  name: 'game',
  sql: `
CREATE TABLE game_clues (
  play_date date NOT NULL,
  anon_key  text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  card_id   text NOT NULL CHECK (char_length(card_id) BETWEEN 1 AND 64),
  clue      text NOT NULL CHECK (clue IN ('garage', 'kidsRoom', 'kitchen', 'entry', 'mailbox')),
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (play_date, anon_key, card_id, clue)
);

CREATE TABLE game_results (
  result_id     text PRIMARY KEY CHECK (result_id ~ '^[0-9a-f]{32}$'),
  play_date     date NOT NULL,
  anon_key      text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  card_id       text NOT NULL CHECK (char_length(card_id) BETWEEN 1 AND 64),
  guess         double precision NOT NULL CHECK (guess > 0),
  clues_opened  text[] NOT NULL,
  points        integer NOT NULL CHECK (points >= 0),
  in_range      boolean NOT NULL,
  cost          jsonb NOT NULL CHECK (jsonb_typeof(cost) = 'object'),
  result        jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  card          jsonb NOT NULL CHECK (jsonb_typeof(card) = 'object'),
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT game_results_one_guess UNIQUE (play_date, anon_key, card_id)
);

-- The leaderboard sums one day's rows per player.
CREATE INDEX game_results_day ON game_results (play_date, anon_key);
`,
};
