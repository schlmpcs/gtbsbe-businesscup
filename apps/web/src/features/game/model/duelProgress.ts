// The player's duel progress for a day, as S1 Today shows it ("Keep playing (2 of 5)") without
// loading a duel client. Two sources, matching NEXT_PUBLIC_DUEL_SOURCE:
// - fixtures: the fixture client (./duelFixtureClient) writes the day's log in this browser and
//   S1 counts its picks. The log holds only what the player already saw (their picks with the
//   results shown to them, and hints).
// - api: the server holds the progress. The duel client (mirrorServerDuelProgress in ./duelClient)
//   copies the rounds the server counts into a small mirror here whenever it loads the day or the
//   server scores a pick, so S1 reads it at once, with no request of its own and no flash.
// No answers live in this module: only dates, round numbers and the player's own picks.
import { DUEL_ROUND_COUNT } from '@lifeguessr/engine';
import { DUEL_ROUNDS, type DuelRound } from '@lifeguessr/types';
import { duelSource } from '@/lib/config';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import type { DuelProgress } from './duelClient';

/** localStorage key of the fixture duel's per-day log (the browser "server"). */
export const FIXTURE_DUEL_LOG_KEY = 'lifeguessr.fixtureDuel';

/** The fixture "server" log for one day. */
export type DuelLog = {
  date: string;
  /** One id for the player's day: the challenge link and share card point at it. */
  resultId: string;
  picks: DuelProgress['picks'];
  hints: DuelProgress['hints'];
};

/** Parses a stored log; null when it is missing, corrupt or for another day. */
export function parseDuelLog(raw: string | null, date: string): DuelLog | null {
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<DuelLog> | null;
    if (saved && saved.date === date && typeof saved.resultId === 'string') {
      return { date, resultId: saved.resultId, picks: saved.picks ?? {}, hints: saved.hints ?? {} };
    }
  } catch {
    // a corrupt log: the day starts fresh
  }
  return null;
}

/** How far the player got in a day's duels. */
export type DuelDayProgress = { date: string | null; played: number; total: number; finished: boolean };

/** Counts the rounds picked in a day's log (null: nothing played that day). */
export function duelDayProgress(log: DuelLog | null, total: number = DUEL_ROUND_COUNT): DuelDayProgress {
  const played = log ? Math.min(Object.keys(log.picks).length, total) : 0;
  return { date: log?.date ?? null, played, total, finished: played >= total };
}

// ----- the server duel's mirror ---------------------------------------------------------------------

/** localStorage key of the mirror of the rounds the server counts for this player (API duel source). */
export const SERVER_DUEL_MIRROR_KEY = 'lifeguessr.duelServerDay';

/** The mirror as stored: the server's date and the rounds it has scored. */
type ServerDuelMirror = { date: string; rounds: DuelRound[] };

const isRound = (r: unknown): r is DuelRound => (DUEL_ROUNDS as readonly unknown[]).includes(r);

/** The rounds the mirror holds for `date`, sorted and unique; null when missing, corrupt or for another day. */
export function parseServerDuelMirror(raw: string | null, date: string): DuelRound[] | null {
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<ServerDuelMirror> | null;
    if (saved && saved.date === date && Array.isArray(saved.rounds)) {
      return [...new Set(saved.rounds.filter(isRound))].sort((a, b) => a - b);
    }
  } catch {
    // a corrupt mirror: nothing is known, S1 offers the plain "play"
  }
  return null;
}

/** Stores the rounds the server counts for `date`. */
export function rememberServerDuelRounds(date: string, rounds: readonly number[]): void {
  const mirror: ServerDuelMirror = { date, rounds: [...new Set(rounds.filter(isRound))].sort((a, b) => a - b) };
  writeStorage(SERVER_DUEL_MIRROR_KEY, JSON.stringify(mirror));
}

/** The server day's progress from the mirrored rounds (null: none known for that day). */
export function duelDayProgressFromRounds(
  date: string,
  rounds: readonly DuelRound[] | null,
  total: number = DUEL_ROUND_COUNT,
): DuelDayProgress {
  const played = rounds ? Math.min(rounds.length, total) : 0;
  return { date: rounds ? date : null, played, total, finished: played >= total };
}

/**
 * Today's duel progress in this browser: the fixture source's log, or with NEXT_PUBLIC_DUEL_SOURCE=api
 * the mirror of what the server counted the last time /play talked to it. Before the first visit to
 * /play (nothing mirrored) it is "nothing played", so S1 offers the plain "play"; a count the server
 * never gave is never made up.
 */
export function readDuelDayProgress(date: string): DuelDayProgress {
  if (duelSource() === 'api') {
    return duelDayProgressFromRounds(date, parseServerDuelMirror(readStorage(SERVER_DUEL_MIRROR_KEY), date));
  }
  return duelDayProgress(parseDuelLog(readStorage(FIXTURE_DUEL_LOG_KEY), date));
}
