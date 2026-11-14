// @vitest-environment jsdom
// S1 Today's view of the duel day: from the browser's fixture log, or (with the duel on the server)
// from the mirror the duel client keeps of what the server replied. Counts only: no answer here.
import type { DuelHint, DuelLetter, DuelRound, PickResult } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DuelClient, DuelDay } from './duelClient';
import { mirrorServerDuelProgress } from './duelClient';
import {
  duelDayProgressFromRounds, FIXTURE_DUEL_LOG_KEY, parseServerDuelMirror, readDuelDayProgress, rememberServerDuelRounds,
  SERVER_DUEL_MIRROR_KEY,
} from './duelProgress';

const DATE = '2026-11-14';
const RESULT = {} as PickResult;
const HINT: DuelHint = { A: 'a', B: 'b' };

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

const stored = () => JSON.parse(localStorage.getItem(SERVER_DUEL_MIRROR_KEY) ?? 'null') as unknown;

describe('parseServerDuelMirror', () => {
  it('reads the rounds of the asked-for day, sorted and without repeats', () => {
    expect(parseServerDuelMirror(JSON.stringify({ date: DATE, rounds: [3, 1, 3] }), DATE)).toEqual([1, 3]);
  });

  it('is null when nothing is stored, it is corrupt, or it is for another day', () => {
    expect(parseServerDuelMirror(null, DATE)).toBeNull();
    expect(parseServerDuelMirror('{nope', DATE)).toBeNull();
    expect(parseServerDuelMirror('null', DATE)).toBeNull();
    expect(parseServerDuelMirror(JSON.stringify({ date: '2026-11-13', rounds: [1, 2] }), DATE)).toBeNull();
    expect(parseServerDuelMirror(JSON.stringify({ date: DATE }), DATE)).toBeNull();
  });

  it('ignores anything that is not a round of the day (a hand-edited value can not invent progress)', () => {
    expect(parseServerDuelMirror(JSON.stringify({ date: DATE, rounds: [0, 6, 2.5, '4', null, 5, 1] }), DATE)).toEqual([1, 5]);
  });
});

describe('duelDayProgressFromRounds', () => {
  it('counts the rounds picked; five finish the day', () => {
    expect(duelDayProgressFromRounds(DATE, [1, 2])).toEqual({ date: DATE, played: 2, total: 5, finished: false });
    expect(duelDayProgressFromRounds(DATE, [1, 2, 3, 4, 5])).toEqual({ date: DATE, played: 5, total: 5, finished: true });
  });

  it('is nothing played when there is no mirror for the day', () => {
    expect(duelDayProgressFromRounds(DATE, null)).toEqual({ date: null, played: 0, total: 5, finished: false });
  });
});

describe('readDuelDayProgress', () => {
  const fixtureLog = (picks: number[]) =>
    localStorage.setItem(
      FIXTURE_DUEL_LOG_KEY,
      JSON.stringify({ date: DATE, resultId: 'r', picks: Object.fromEntries(picks.map((r) => [r, { choice: 'A', result: RESULT }])), hints: {} }),
    );

  it('fixture source: counts the browser log, and ignores a server mirror', () => {
    fixtureLog([1, 2]);
    rememberServerDuelRounds(DATE, [1, 2, 3, 4]);
    expect(readDuelDayProgress(DATE)).toEqual({ date: DATE, played: 2, total: 5, finished: false });
  });

  it('API source: counts what the server last said, and ignores a fixture log', () => {
    vi.stubEnv('NEXT_PUBLIC_DUEL_SOURCE', 'api');
    fixtureLog([1]);
    expect(readDuelDayProgress(DATE)).toMatchObject({ played: 0, finished: false }); // nothing mirrored yet: the call to action says "play"
    rememberServerDuelRounds(DATE, [2, 4]);
    expect(readDuelDayProgress(DATE)).toEqual({ date: DATE, played: 2, total: 5, finished: false });
    expect(readDuelDayProgress('2026-11-15')).toMatchObject({ date: null, played: 0 }); // another day: nothing played yet
  });
});

describe('mirrorServerDuelProgress: the duel client keeps S1 in step with the server', () => {
  /** A stand-in for the HTTP client: a fixed day, picks that succeed or fail on demand. */
  function inner(picked: DuelRound[], fail = false): DuelClient & { calls: string[] } {
    const calls: string[] = [];
    return {
      source: 'api',
      calls,
      async daily(today) {
        calls.push(`daily ${today}`);
        const day: DuelDay = {
          date: DATE,
          duels: [],
          progress: { picks: Object.fromEntries(picked.map((r) => [r, { choice: 'A' as DuelLetter, result: RESULT }])), hints: {} },
        };
        return day;
      },
      async pick(round, _choice, date) {
        calls.push(`pick ${round} ${date}`);
        if (fail) throw new Error('503');
        return RESULT;
      },
      async hint(round, date) {
        calls.push(`hint ${round} ${date}`);
        return HINT;
      },
      async challenge(resultId) {
        calls.push(`challenge ${resultId}`);
        return null;
      },
    };
  }

  it('daily: writes the server day and the rounds it already counts, and passes the day through', async () => {
    const client = mirrorServerDuelProgress(inner([1, 2]));
    expect(client.source).toBe('api');
    const day = await client.daily('2026-11-13'); // a stale browser clock: the server's date wins
    expect(day.date).toBe(DATE);
    expect(stored()).toEqual({ date: DATE, rounds: [1, 2] });
  });

  it('daily: a fresh player (or a new day) replaces the mirror with nothing picked', async () => {
    rememberServerDuelRounds('2026-11-13', [1, 2, 3, 4, 5]);
    await mirrorServerDuelProgress(inner([])).daily(DATE);
    expect(stored()).toEqual({ date: DATE, rounds: [] });
  });

  it('pick: adds the round once the server has scored it, and a repeat adds nothing', async () => {
    const client = mirrorServerDuelProgress(inner([1]));
    await client.daily(DATE);
    await client.pick(2, 'B', DATE);
    expect(stored()).toEqual({ date: DATE, rounds: [1, 2] });
    await client.pick(2, 'A', DATE);
    expect(stored()).toEqual({ date: DATE, rounds: [1, 2] });
  });

  it('pick: a failed pick leaves the mirror alone, and the error still reaches the caller', async () => {
    const client = mirrorServerDuelProgress(inner([1], true));
    await client.daily(DATE);
    await expect(client.pick(2, 'A', DATE)).rejects.toThrow('503');
    expect(stored()).toEqual({ date: DATE, rounds: [1] });
  });

  it('hint: is passed through and counts nothing', async () => {
    const client = mirrorServerDuelProgress(inner([]));
    await client.daily(DATE);
    expect(await client.hint(1, DATE)).toEqual(HINT);
    expect(stored()).toEqual({ date: DATE, rounds: [] });
  });

  it('pick on a day the mirror does not hold starts that day from this round', async () => {
    rememberServerDuelRounds('2026-11-13', [1, 2, 3, 4, 5]);
    await mirrorServerDuelProgress(inner([])).pick(1, 'A', DATE);
    expect(stored()).toEqual({ date: DATE, rounds: [1] });
  });

  it('keeps the rest of the client as it is: the challenge lookup, and methods a later change adds, pass through', async () => {
    const base = Object.assign(inner([]), { extra: () => 'kept' });
    const client = mirrorServerDuelProgress(base) as typeof base;
    expect(client.extra()).toBe('kept');
    expect(await client.challenge('0123456789abcdef0123456789abcdef', DATE)).toBeNull();
    expect(base.calls).toEqual(['challenge 0123456789abcdef0123456789abcdef']);
    expect(stored()).toBeNull(); // a challenge lookup is not the player's own progress
  });
});
