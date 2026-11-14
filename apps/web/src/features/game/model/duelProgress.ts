// The player's duel progress for a day, as the fixture duel source keeps it in this browser. The
// fixture client (./duelFixtureClient) writes the log; S1 Today reads it here to show "2 of 5"
// without loading the client (which holds the answers). No answers live in this module: the log
// holds only what the player already saw (their picks with the results shown to them, and hints).
import { DUEL_ROUND_COUNT } from '@lifeguessr/engine';
import { duelSource } from '@/lib/config';
import { readStorage } from '@/lib/safeStorage';
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

/**
 * Today's duel progress in this browser. Only the fixture source keeps it here; with
 * NEXT_PUBLIC_DUEL_SOURCE=api the server holds it (GET /api/daily?game=duel, which /play resumes
 * from) and S1 Today reads nothing here: it shows the "play" call to action, never a made-up
 * count. Counting the server's rounds on S1 is for the switch-over (#120).
 */
export function readDuelDayProgress(date: string): DuelDayProgress {
  if (duelSource() === 'api') return duelDayProgress(null);
  return duelDayProgress(parseDuelLog(readStorage(FIXTURE_DUEL_LOG_KEY), date));
}
