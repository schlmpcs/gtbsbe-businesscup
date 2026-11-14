import type { DuelLetter, DuelRound, PickResult } from '@lifeguessr/types';
export type DuelKey = { date: string; anonId: string };
export type DuelScored = Omit<PickResult, 'resultId' | 'crowd'>;
export type StoredPick = { round: DuelRound; choice: DuelLetter; hints: number; scored: DuelScored };
export interface DuelStore {
  openHint(key: DuelKey, round: DuelRound): Promise<{ recorded: boolean }>;
  submitPick(key: DuelKey, round: DuelRound, choice: DuelLetter, score: (hints: number) => DuelScored): Promise<{ resultId: string; scored: DuelScored; choice: DuelLetter; replayed: boolean }>;
  playerDuelDay(key: DuelKey): Promise<{ resultId: string | null; picks: StoredPick[]; hintedRounds: DuelRound[] }>;
  findDuelDay(resultId: string): Promise<{ date: string; picks: StoredPick[] } | null>;
  crowd(date: string, round: DuelRound): Promise<{ A: number; B: number }>;
}
