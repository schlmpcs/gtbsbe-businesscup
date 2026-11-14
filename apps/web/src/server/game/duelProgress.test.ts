// The duel's crowd line on the server: crowdOf (the threshold) and liveCrowds (the store counts it
// reads). The routes' replies are tested in app/api/daily/route.test.ts and pick/route.test.ts.
import { DUEL_CROWD_MIN_PICKS, type DuelLetter } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@/server/store';
import { crowdOf, liveCrowds } from './duelProgress';
import { duelScorer, findDuelPair } from './duel';

const DATE = '2026-11-14';

describe('crowdOf', () => {
  it('is null below DUEL_CROWD_MIN_PICKS (20) picks and the counts from 20 on', () => {
    expect(DUEL_CROWD_MIN_PICKS).toBe(20);
    expect(crowdOf({ A: 12, B: 7 })).toBeNull(); // 19
    expect(crowdOf({ A: 12, B: 8 })).toEqual({ pickedA: 12, total: 20 });
    expect(crowdOf({ A: 0, B: 20 })).toEqual({ pickedA: 0, total: 20 });
    expect(crowdOf({ A: 131, B: 83 })).toEqual({ pickedA: 131, total: 214 });
    expect(crowdOf({ A: 0, B: 0 })).toBeNull();
  });

  it('takes another minimum', () => {
    expect(crowdOf({ A: 1, B: 1 }, 3)).toBeNull();
    expect(crowdOf({ A: 2, B: 1 }, 3)).toEqual({ pickedA: 2, total: 3 });
  });
});

describe('liveCrowds', () => {
  /** `n` players pick `round` of DATE, the first `a` of them A and the rest B. */
  async function picks(store: ReturnType<typeof createMemoryStore>, round: 1 | 2, n: number, a: number, prefix = 'p') {
    for (let i = 0; i < n; i++) {
      const choice: DuelLetter = i < a ? 'A' : 'B';
      await store.duel.submitPick({ date: DATE, anonId: `${prefix}-${round}-${i}` }, round, choice, duelScorer(findDuelPair(DATE, round)!, choice));
    }
  }

  it('answers every round asked, null below the threshold, with one store call for all of them', async () => {
    const store = createMemoryStore();
    await picks(store, 1, 19, 11);
    await picks(store, 2, 20, 5);
    const spy = vi.spyOn(store.duel, 'crowds');
    const crowds = await liveCrowds(store.duel, DATE, [1, 2, 3]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(crowds).toEqual(new Map([[1, null], [2, { pickedA: 5, total: 20 }], [3, null]]));

    // The 20th pick of round 1 shows up on the next call: nothing is cached.
    await picks(store, 1, 1, 1, 'late');
    expect((await liveCrowds(store.duel, DATE, [1])).get(1)).toEqual({ pickedA: 12, total: 20 });
  });
});
