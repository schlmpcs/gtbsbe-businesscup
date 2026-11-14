import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DuelRound } from '@lifeguessr/types';
import type { DuelScored, DuelStore } from './duel';
import { createMemoryStore, type Store } from './index';
import { describePostgres, testPostgresStore } from './testUtils';

const date = '2026-11-14';
const key = { date, anonId: 'one' };
const score = (hints: number): DuelScored => ({ correct: true, points: hints ? 500 : 1000, totals: { A: 1, B: 2 }, breakdown: { A: [], B: [] }, decidedBy: { category: 'rentUtilities', A: 1, B: 2 }, lesson: 'lesson' });
function contract(name: string, open: () => { store: Store; cleanup: () => Promise<void> }) {
  describe(name, () => {
    let duel: DuelStore;
    let cleanup: () => Promise<void>;
    beforeAll(() => { const setup = open(); duel = setup.store.duel; cleanup = setup.cleanup; });
    afterAll(async () => cleanup());
    it('serializes picks and hints, preserves replays and groups five rounds into a day', async () => {
      expect(await duel.openHint(key, 1)).toEqual({ recorded: true });
      expect(await duel.openHint(key, 1)).toEqual({ recorded: false });
      const first = await duel.submitPick(key, 1, 'A', score);
      expect(first.scored.points).toBe(500);
      expect(await duel.submitPick(key, 1, 'B', () => { throw new Error('replayed scorer'); })).toEqual({ ...first, replayed: true });
      expect(await duel.openHint(key, 2)).toEqual({ recorded: true });
      const rest = await Promise.all(([2, 3, 4, 5] as DuelRound[]).map(round => duel.submitPick(key, round, 'B', score)));
      expect(rest.every(p => p.resultId === first.resultId)).toBe(true);
      expect(await duel.openHint(key, 3)).toEqual({ recorded: false });
      expect((await duel.playerDuelDay(key)).picks).toHaveLength(5);
      expect(await duel.findDuelDay(first.resultId)).toEqual({ date, picks: (await duel.playerDuelDay(key)).picks });
      expect(await duel.findDuelDay('bad')).toBeNull();
      expect((await duel.submitPick({ date, anonId: 'two' }, 1, 'B', score)).resultId).not.toBe(first.resultId);
      expect((await duel.submitPick({ ...key, date: '2026-11-15' }, 1, 'A', score)).resultId).not.toBe(first.resultId);
      expect(await duel.crowds(date, [1])).toEqual(new Map([[1, { A: 1, B: 1 }]]));
      const concurrentKey = { date, anonId: 'concurrent' };
      const concurrent = await Promise.all([duel.submitPick(concurrentKey, 1, 'A', score), duel.submitPick(concurrentKey, 2, 'B', score)]);
      expect(concurrent[0]!.resultId).toBe(concurrent[1]!.resultId);
    });

    it('counts one stored pick per player per round, by round and by date', async () => {
      // A date of its own, so the picks of the test above do not count here.
      const day = '2026-12-01';
      const next = '2026-12-02';
      const player = (i: number) => ({ date: day, anonId: `crowd-${i}` });
      expect(await duel.crowds(day, [1, 2])).toEqual(new Map([[1, { A: 0, B: 0 }], [2, { A: 0, B: 0 }]]));
      expect(await duel.crowds(day, [])).toEqual(new Map());

      // 12 A and 7 B on round 1; every replay (same letter or the other one) is answered from the
      // stored row and adds nothing.
      for (let i = 0; i < 19; i++) await duel.submitPick(player(i), 1, i < 12 ? 'A' : 'B', score);
      for (let i = 0; i < 19; i++) expect((await duel.submitPick(player(i), 1, i % 2 ? 'A' : 'B', score)).replayed).toBe(true);
      expect((await duel.crowds(day, [1])).get(1)).toEqual({ A: 12, B: 7 });

      // Round 2 that day and round 1 the next day are counted apart from round 1 today.
      await duel.submitPick(player(0), 2, 'B', score);
      await duel.submitPick({ date: next, anonId: 'crowd-0' }, 1, 'B', score);
      expect(await duel.crowds(day, [1, 2, 3])).toEqual(new Map([[1, { A: 12, B: 7 }], [2, { A: 0, B: 1 }], [3, { A: 0, B: 0 }]]));
      expect(await duel.crowds(next, [1])).toEqual(new Map([[1, { A: 0, B: 1 }]]));

      // The 20th player.
      await duel.submitPick(player(19), 1, 'A', score);
      expect((await duel.crowds(day, [1])).get(1)).toEqual({ A: 13, B: 7 });
    });
  });
}
contract('duel memory', () => ({ store: createMemoryStore(), cleanup: async () => {} }));
describePostgres('duel postgres', () => contract('duel postgres contract', () => testPostgresStore()));
