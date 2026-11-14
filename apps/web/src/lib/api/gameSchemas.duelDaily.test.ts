import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { duelProgressFromWire } from '@/features/game/model/duelClient';
import { duelScorer, findDuelPair, publicDuels } from '@/server/game/duel';
import { toDuelProgress } from '@/server/game/duelProgress';
import { createMemoryStore } from '@/server/store';
import {
  DailyGameSchema, DuelDailyResponseSchema, DuelProgressWireSchema, type DuelProgressWire,
} from './gameSchemas';

const date = '2026-11-14';
const key = { date, anonId: 'schema-test' };

/** A real wire progress: round 1 picked with a hint, round 3 hinted only, built by the server's own mapper. */
async function realProgress(): Promise<DuelProgressWire> {
  const { duel } = createMemoryStore();
  const pick = (round: DuelRound, choice: DuelLetter) =>
    duel.submitPick(key, round, choice, duelScorer(findDuelPair(date, round)!, choice));
  await duel.openHint(key, 1);
  await pick(1, 'A');
  await duel.openHint(key, 3);
  return toDuelProgress(date, await duel.playerDuelDay(key), new Map());
}

describe('DuelProgressWireSchema', () => {
  it('accepts what the server builds, with a round missing from picks and hints', async () => {
    const wire = await realProgress();
    expect(Object.keys(wire.picks)).toEqual(['1']);
    expect(Object.keys(wire.hints)).toEqual(['1', '3']);
    expect(DuelProgressWireSchema.parse(JSON.parse(JSON.stringify(wire)))).toEqual(wire);
  });

  it('accepts an empty day: resultId null, no picks, no hints', () => {
    expect(DuelProgressWireSchema.parse({ resultId: null, picks: {}, hints: {} })).toEqual({ resultId: null, picks: {}, hints: {} });
  });

  it('rejects a bad resultId, a round outside 1–5, a letter outside A/B and an empty hint', async () => {
    const wire = await realProgress();
    const bad = (patch: object) => DuelProgressWireSchema.safeParse({ ...wire, ...patch }).success;
    expect(bad({})).toBe(true);
    expect(bad({ resultId: 'abc' })).toBe(false);
    expect(bad({ resultId: 'A'.repeat(32) })).toBe(false); // lower-case hex only, like the store's ids
    expect(bad({ picks: { '6': wire.picks['1'] } })).toBe(false);
    expect(bad({ picks: { '0': wire.picks['1'] } })).toBe(false);
    expect(bad({ picks: { '1': { ...wire.picks['1'], choice: 'C' } } })).toBe(false);
    expect(bad({ hints: { '1': { A: '', B: 'x' } } })).toBe(false);
  });

  it('maps onto the browser’s DuelProgress by turning the round keys into numbers', async () => {
    const wire = DuelProgressWireSchema.parse(JSON.parse(JSON.stringify(await realProgress())));
    // The HTTP duel client's mapper: nothing is guessed, every field of DuelProgress comes from the wire.
    const progress = duelProgressFromWire(wire);
    expect(Object.keys(progress.picks)).toEqual(['1']);
    expect(progress.picks[1]!.choice).toBe('A');
    expect(progress.picks[1]!.result.resultId).toBe(wire.resultId);
    expect(Object.keys(progress.hints)).toEqual(['1', '3']);
  });
});

describe('DuelDailyResponseSchema', () => {
  const body = { ok: true, date, duels: publicDuels(date) };

  it('takes the five duels with or without progress', async () => {
    expect(DuelDailyResponseSchema.parse(body)).toEqual(body);
    const withProgress = { ...body, progress: await realProgress() };
    expect(DuelDailyResponseSchema.parse(JSON.parse(JSON.stringify(withProgress)))).toEqual(withProgress);
  });

  it('rejects other than five duels, a bad date and a missing ok', () => {
    expect(DuelDailyResponseSchema.safeParse({ ...body, duels: body.duels.slice(0, 4) }).success).toBe(false);
    expect(DuelDailyResponseSchema.safeParse({ ...body, duels: [...body.duels, body.duels[0]] }).success).toBe(false);
    expect(DuelDailyResponseSchema.safeParse({ ...body, date: '14/11/2026' }).success).toBe(false);
    expect(DuelDailyResponseSchema.safeParse({ date, duels: body.duels }).success).toBe(false);
  });
});

describe('DailyGameSchema', () => {
  it('knows the slider and the duel only', () => {
    expect(DailyGameSchema.options).toEqual(['slider', 'duel']);
    expect(DailyGameSchema.safeParse('Duel').success).toBe(false);
  });
});
