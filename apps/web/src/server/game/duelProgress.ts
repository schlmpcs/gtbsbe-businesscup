// Server-only: what the server tells a player about their own duel day (GET /api/daily?game=duel
// with x-anon-id). The stored day (server/store/duel: picks as scored, rounds with a hint) becomes
// the wire shape DuelProgressWireSchema describes, which the browser's DuelProgress is built from.
//
// What is stored stays as it was answered (a pick keeps the score it got, hint and all); two things
// are rebuilt when the server answers:
// - the hint TEXT, with duelHint(pair), for rounds the server recorded a hint for and no other;
// - the crowd, live (liveCrowds below), so a returning player sees today's numbers: null until
//   DUEL_CROWD_MIN_PICKS players picked the round.
import { DUEL_CROWD_MIN_PICKS, type DuelRound, type PickResult } from '@lifeguessr/types';
import type { DuelProgressWire } from '@/lib/api/gameSchemas';
import type { DuelCounts, DuelStore } from '@/server/store/duel';
import { duelHint, findDuelPair } from './duel';

/** The player's stored duel day, as DuelStore.playerDuelDay answers it. */
export type StoredDuelDay = Awaited<ReturnType<DuelStore['playerDuelDay']>>;

export type DuelCrowd = PickResult['crowd'];

type RoundKey = keyof DuelProgressWire['picks'];

/**
 * The crowd line of one round from its stored counts: `{ pickedA, total }`, or null while fewer
 * than `min` players have picked it (the reveal then says "Not enough picks yet"). Pure, so the
 * threshold edge (19 vs 20) is tested without a store.
 *
 * It lives here, next to liveCrowds, rather than in ./duel: ./duel is the day's set (pairs, hints,
 * scoring) built from the catalog, and never reads the store. Counting other players is part of
 * turning stored picks into a reply, which is what this module does, and keeping the rule beside
 * its only caller leaves one place to read when the line looks wrong.
 */
export function crowdOf(counts: DuelCounts, min: number = DUEL_CROWD_MIN_PICKS): DuelCrowd {
  const total = counts.A + counts.B;
  return total < min ? null : { pickedA: counts.A, total };
}

/**
 * THE one place the crowd counts of a duel are produced for a reply that carries stored picks:
 * GET /api/daily?game=duel for the rounds in the player's progress, and POST /api/daily/pick for
 * the round just picked (new or replayed). Both go through here, so a pick, its replay and the
 * daily progress always show the same numbers at the same moment.
 *
 * Live, not stored and not cached: every call counts everyone's picks so far, with one query for
 * all the rounds asked (store.crowds). A replayed pick therefore carries today's count, not the
 * one it had when it was first scored, and the player's own pick is in it (it is a stored row
 * like any other). One indexed count per reply is cheap at this scale; if it ever is not, a short
 * per-(date, round) cache goes here, and the reveal's number would then lag by that long.
 */
export async function liveCrowds(
  store: DuelStore,
  date: string,
  rounds: readonly DuelRound[],
): Promise<ReadonlyMap<DuelRound, DuelCrowd>> {
  const counts = await store.crowds(date, rounds);
  return new Map(rounds.map((round) => [round, crowdOf(counts.get(round) ?? { A: 0, B: 0 })]));
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
