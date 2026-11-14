import type { DuelLetter, DuelRound, PickResult } from '@lifeguessr/types';
export type DuelKey = { date: string; anonId: string };
export type DuelScored = Omit<PickResult, 'resultId' | 'crowd'>;
export type DuelCounts = Record<DuelLetter, number>;
export type StoredPick = { round: DuelRound; choice: DuelLetter; hints: number; scored: DuelScored };
export interface DuelStore {
  openHint(key: DuelKey, round: DuelRound): Promise<{ recorded: boolean }>;
  submitPick(key: DuelKey, round: DuelRound, choice: DuelLetter, score: (hints: number) => DuelScored): Promise<{ resultId: string; scored: DuelScored; choice: DuelLetter; replayed: boolean }>;
  playerDuelDay(key: DuelKey): Promise<{ resultId: string | null; picks: StoredPick[]; hintedRounds: DuelRound[] }>;
  findDuelDay(resultId: string): Promise<{ date: string; picks: StoredPick[] } | null>;
  /**
   * How many stored picks each round of `date` has per letter: one row per player per round (the
   * picks table's primary key), the asking player's own pick included. Every round asked for is in
   * the answer, `{ A: 0, B: 0 }` when nobody picked it yet. One call for all the rounds a reply
   * needs, so GET /api/daily?game=duel counts five rounds in one query, not five.
   */
  crowds(date: string, rounds: readonly DuelRound[]): Promise<Map<DuelRound, DuelCounts>>;
}
