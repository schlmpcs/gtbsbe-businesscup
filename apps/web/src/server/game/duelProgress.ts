// Server-only: what the server tells a player about their own duel day (GET /api/daily?game=duel
// with x-anon-id). The stored day (server/store/duel: picks as scored, rounds with a hint) becomes
// the wire shape DuelProgressWireSchema describes, which the browser's DuelProgress is built from.
//
// What is stored stays as it was answered (a pick keeps the score it got, hint and all); two things
// are rebuilt when the server answers:
// - the hint TEXT, with duelHint(pair), for rounds the server recorded a hint for and no other;
// - the crowd, live (liveCrowds below), so a returning player sees today's numbers.
import type { DuelRound, PickResult } from '@lifeguessr/types';
import type { DuelProgressWire } from '@/lib/api/gameSchemas';
import type { DuelStore } from '@/server/store/duel';
import { duelHint, findDuelPair } from './duel';

/** The player's stored duel day, as DuelStore.playerDuelDay answers it. */
export type StoredDuelDay = Awaited<ReturnType<DuelStore['playerDuelDay']>>;

export type DuelCrowd = PickResult['crowd'];

type RoundKey = keyof DuelProgressWire['picks'];

/**
 * THE one place the crowd counts of a duel are produced for a reply that carries stored picks
 * (here, and the pick route when it answers a replayed pick). Live, not stored: each call reflects
 * everyone's picks so far.
 *
 * #116 (crowd counts) fills this in: read `store.crowd(date, round)` → `{ A, B }`, answer
 * `{ pickedA: A, total: A + B }`, or null while `total` is under the minimum PickResult documents
 * (20). Until then every round answers null, which PickResultSchema allows ("Not enough picks yet").
 */
export async function liveCrowds(
  _store: DuelStore,
  _date: string,
  _rounds: readonly DuelRound[],
): Promise<ReadonlyMap<DuelRound, DuelCrowd>> {
  return new Map();
}

/** The day in the wire shape. `crowds` come from liveCrowds for the rounds in `day.picks`. */
export function toDuelProgress(
  date: string,
  day: StoredDuelDay,
  crowds: ReadonlyMap<DuelRound, DuelCrowd>,
): DuelProgressWire {
  const progress: DuelProgressWire = { resultId: day.resultId, picks: {}, hints: {} };
  for (const pick of day.picks) {
    // Both stores give a day its result id with its first pick; a pick without one is a broken row.
    if (day.resultId === null) throw new Error(`duel day ${date}: round ${pick.round} is picked but the day has no resultId`);
    progress.picks[String(pick.round) as RoundKey] = {
      choice: pick.choice,
      result: { ...pick.scored, resultId: day.resultId, crowd: crowds.get(pick.round) ?? null },
    };
  }
  for (const round of day.hintedRounds) {
    const pair = findDuelPair(date, round);
    if (pair) progress.hints[String(round) as RoundKey] = duelHint(pair);
  }
  return progress;
}
