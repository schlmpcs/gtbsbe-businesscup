// Server-only: the daily game's records (T5). Which clues each player opened for each card, and
// the one scored guess per card per player per day, which the leaderboard and share cards read.
//
// The rules live here once; the Postgres and memory stores only load and write rows around them,
// so both behave the same:
// - A clue counts once, and only while the card is not guessed yet (one opened after the guess
//   is answered but not recorded, so it cannot change a stored score).
// - A guess is scored by the caller's `score` function from the clues the STORE recorded, never
//   from anything the client sent. Recording and scoring for one (day, player, card) are
//   serialized, so a clue and a guess sent together never race.
// - One guess per card per player per day (migration 003's UNIQUE constraint in Postgres). A
//   repeated guess answers the stored result (`replayed: true`) and never scores again.
// - Stored reveals are kept as the JSON that was answered and read back through the contract, so
//   a replay, a share card and the leaderboard show exactly what the player saw.
import { randomBytes } from 'node:crypto';
import type { ClueId, GuessReveal, Money } from '@lifeguessr/types';
import { game as gameCopy } from '@/copy';
import { GuessRevealSchema, type LeaderboardEntry } from '@/lib/api/gameSchemas';
import { anonKey } from './anonKey';

/** One player's play of one card on one day. `date` is the set's US Eastern date ('YYYY-MM-DD'). */
export type PlayKey = { date: string; anonId: string; cardId: string };

/** The reveal minus what the store adds (the result id and the clues it counted). */
export type ScoredGuess = Pick<GuessReveal, 'cost' | 'result' | 'card'>;

/** Scores a guess from the clues the store recorded. Must be pure (it may run inside a transaction). */
export type GuessScorer = (cluesOpened: ClueId[]) => ScoredGuess;

export type StoredResult = {
  resultId: string;
  date: string;
  cardId: string;
  /** The amount that was scored (monthly dollars). */
  guess: Money;
  reveal: GuessReveal;
  /** ISO 8601 UTC. */
  createdAt: string;
};

export type SubmitOutcome = { result: StoredResult; replayed: boolean };

/** What one player holds on one day: clues per card (in opening order) and scored guesses. */
export type PlayerDay = { clues: Record<string, ClueId[]>; results: StoredResult[] };

export type Leaderboard = {
  date: string;
  /** Players with at least one guess that day. */
  players: number;
  /** The top `limit` players, best first. */
  entries: LeaderboardEntry[];
  /** The caller's own row (also when it is outside the top), or null. */
  you: LeaderboardEntry | null;
};

export type LeaderboardOptions = { limit: number; anonId?: string | null };

export interface GameStore {
  /** Records an opened clue. `recorded` is false when it was already open or the card is guessed. */
  openClue(key: PlayKey, clue: ClueId): Promise<{ recorded: boolean }>;
  /** Scores and stores the guess, or answers the stored one. `score` gets the recorded clues. */
  submitGuess(key: PlayKey, guess: Money, score: GuessScorer): Promise<SubmitOutcome>;
  /** One player's clues and results for a day. */
  playerDay(date: string, anonId: string): Promise<PlayerDay>;
  /** A stored result by its id (share links), or null. */
  findResult(resultId: string): Promise<StoredResult | null>;
  leaderboard(date: string, opts: LeaderboardOptions): Promise<Leaderboard>;
}

/** Share links carry this: 128 random bits, unrelated to the anonymous id. */
export const RESULT_ID = /^[0-9a-f]{32}$/;

export const newResultId = (): string => randomBytes(16).toString('hex');

/** The reveal as stored: JSON (a non-finite logError becomes null, as on the wire). */
export const encodeReveal = (reveal: GuessReveal): Record<string, unknown> =>
  JSON.parse(JSON.stringify(reveal)) as Record<string, unknown>;

/** A stored reveal read back through the contract. Throws when it no longer matches it. */
export function decodeReveal(raw: unknown, resultId: string): GuessReveal {
  const parsed = GuessRevealSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`stored game result ${resultId} does not match the GuessReveal contract`);
  return parsed.data;
}

/** The reveal for a new result: the scored guess plus the id and the clues that were counted. */
export function buildReveal(resultId: string, cluesOpened: readonly ClueId[], scored: ScoredGuess): GuessReveal {
  return { resultId, cost: scored.cost, result: scored.result, card: scored.card, cluesOpened: [...cluesOpened] };
}

// ----- leaderboard ----------------------------------------------------------------------------

/** One player's sums for a day (what both stores aggregate before ranking). */
export type PlayerTotal = { anonKey: string; points: number; played: number; inRange: number; finishedAt: string };

/**
 * Best first: more points, then whoever finished (made their latest guess) first, then by key so
 * the order is stable. Ties on points share a rank (1, 2, 2, 4).
 */
export function compareTotals(a: PlayerTotal, b: PlayerTotal): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
  return a.anonKey < b.anonKey ? -1 : a.anonKey > b.anonKey ? 1 : 0;
}

/** The pure leaderboard: the memory store uses it, and the Postgres query computes the same. */
export function rankTotals(date: string, totals: readonly PlayerTotal[], opts: LeaderboardOptions): Leaderboard {
  const own = opts.anonId ? anonKey(opts.anonId) : null;
  const sorted = [...totals].sort(compareTotals);
  const entries: LeaderboardEntry[] = [];
  let you: LeaderboardEntry | null = null;
  let rank = 0;
  sorted.forEach((t, i) => {
    if (i === 0 || t.points !== sorted[i - 1]!.points) rank = i + 1;
    const isYou = t.anonKey === own;
    if (i >= opts.limit && !isYou) return;
    const entry = toEntry(t, rank, isYou);
    if (i < opts.limit) entries.push(entry);
    if (isYou) you = entry;
  });
  return { date, players: sorted.length, entries, you };
}

export function toEntry(t: Pick<PlayerTotal, 'anonKey' | 'points' | 'played' | 'inRange'>, rank: number, you: boolean): LeaderboardEntry {
  return { rank, handle: handleOf(t.anonKey), points: t.points, played: t.played, inRange: t.inRange, you };
}

/**
 * A made-up display name for a player, e.g. "Thrifty Otter 42": stable for one anonymous id, but
 * derived from a further hash of its anon_key, so it reveals nothing about the id or the key.
 */
export function handleOf(key: string): string {
  const { adjectives, animals } = gameCopy.leaderboard.handleWords;
  const h = anonKey(`lifeguessr-handle:${key}`); // sha256 hex
  const a = parseInt(h.slice(0, 8), 16) % adjectives.length;
  const b = parseInt(h.slice(8, 16), 16) % animals.length;
  const n = parseInt(h.slice(16, 20), 16) % 100;
  return gameCopy.leaderboard.handle(adjectives[a]!, animals[b]!, n);
}
