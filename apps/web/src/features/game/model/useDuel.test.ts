// @vitest-environment jsdom
// The duel view-model (S2 Duel round, S3 Reveal, S3 Day result) on the fixture duel.
import { costOfLife, dailyDuelPairs, duelDifference } from '@lifeguessr/engine';
import type { ClientFunnelEvent, DuelLetter, EventsRequest } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { duel as t } from '@/copy/duel';
import { duelCardsSample } from '@/fixtures/cards';
import { ApiError } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { flushEvents, queuedEventsForTests, resetEventsForTests } from '@/lib/events';
import { resetClientState, waitForReady } from '@/test/clientState';
import type { DuelClient } from './duelClient';
import { nextNewYorkMidnight } from './duelDerive';
import { createFixtureDuelClient, FIXTURE_DUEL_LOG_KEY } from './duelFixtureClient';
import { DUEL_VIEW_KEY, useDuel, type UseDuelOptions } from './useDuel';

const TODAY = '2026-11-14';
// Noon in New York (17:00 UTC, EST): the next five go live in 12h 0m.
const NOW = new Date('2026-11-14T17:00:00Z');
const now = () => NOW;

/** The right answer per round, worked out with the engine from the same sample cards. */
function costlierByRound(): DuelLetter[] {
  const totals = new Map(duelCardsSample.map((c) => [c.id, costOfLife(c, areaForZip(c.zip)!).total.mid]));
  return dailyDuelPairs(TODAY, [...totals].map(([id, total]) => ({ id, total }))).map(
    (p) => duelDifference({ A: totals.get(p.A)!, B: totals.get(p.B)! }).costlier!,
  );
}
const RIGHT = costlierByRound();
const WRONG = RIGHT.map((l): DuelLetter => (l === 'A' ? 'B' : 'A'));

let sent: EventsRequest[] = [];
let client: DuelClient;
beforeEach(() => {
  resetClientState();
  sent = [];
  resetEventsForTests(async (batch) => {
    sent.push(batch);
    return 'sent';
  });
  client = createFixtureDuelClient({ persist: false });
});

async function tracked(): Promise<ClientFunnelEvent[]> {
  while (queuedEventsForTests().length > 0) await flushEvents();
  return sent.flatMap((b) => b.events).map(({ id: _id, ...e }) => e as ClientFunnelEvent);
}

async function renderDuel(extra: UseDuelOptions = {}) {
  const hook = renderHook(() => useDuel({ client, now, origin: 'https://lifeguessr.test', ...extra }));
  await waitForReady(hook.result);
  return hook;
}

type Hook = Awaited<ReturnType<typeof renderDuel>>;
async function pickAndWait({ result }: Hook, letter: DuelLetter) {
  const round = result.current.round;
  act(() => result.current.pick(letter));
  await waitFor(() => expect(result.current.reveal?.round).toBe(round));
}

describe('useDuel on fixtures', () => {
  it('loads today’s five duels and shows round 1 with no totals and no hint', async () => {
    const { result } = await renderDuel();
    const vm = result.current;
    expect(vm.status).toBe('ready');
    expect(vm.source).toBe('fixtures');
    expect(vm.date).toBe(TODAY);
    expect(vm.phase).toBe('round');
    expect(vm.round).toBe(1);
    expect(vm.totalRounds).toBe(5);
    expect(vm.dots.map((d) => d.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(vm.cards!.map((c) => c.letter)).toEqual(['A', 'B']);
    for (const card of vm.cards!) {
      expect(card).toMatchObject({ state: 'round', total: null, categories: [], hintFact: null, composite: true, pickedByYou: false });
      expect(card.facts).toHaveLength(4);
      expect(card.art).toMatch(/^layout\//);
      expect(card.household).toMatch(/adult/);
    }
    expect(vm.hint).toEqual({ used: false, status: 'idle', cost: expect.closeTo(0.1, 10), pointsNow: 1000, pointsWithHint: 900 });
    expect(vm.reveal).toBeNull();
    expect(vm.summary).toBeNull();
    expect(await tracked()).toEqual([{ name: 'play_started' }]);
  });

  it('a right pick reveals both monthly totals, the gap, what decided it and +1,000', async () => {
    const hook = await renderDuel();
    await pickAndWait(hook, RIGHT[0]!);
    const { reveal, cards, phase, hint } = hook.result.current;
    expect(phase).toBe('reveal');
    expect(hint).toBeNull();
    expect(reveal).toMatchObject({ round: 1, choice: RIGHT[0], correct: true, points: 1000, costlier: RIGHT[0], crowd: null, isLastRound: false });
    expect(reveal!.difference).toBeCloseTo(Math.abs(reveal!.totals.A - reveal!.totals.B), 6);
    expect(reveal!.decidedBy.amount).toBeGreaterThan(reveal!.decidedBy.otherAmount);
    expect(Object.values(t.lessons)).toContain(reveal!.lesson);
    expect(reveal!.sources.length).toBeGreaterThan(0);

    const winner = cards!.find((c) => c.letter === RIGHT[0])!;
    const loser = cards!.find((c) => c.letter !== RIGHT[0])!;
    expect(winner).toMatchObject({ state: 'winner', pickedByYou: true, total: reveal!.totals[RIGHT[0]!] });
    expect(loser).toMatchObject({ state: 'other', pickedByYou: false });
    // Bars share one scale: the costlier card's categories fill the track.
    expect(winner.categories.reduce((s, c) => s + c.scale, 0)).toBeCloseTo(1, 6);
    expect(loser.categories.reduce((s, c) => s + c.scale, 0)).toBeLessThan(1);
    expect(winner.categories.reduce((s, c) => s + c.amount, 0)).toBeCloseTo(winner.total!, 6);

    expect(await tracked()).toEqual([{ name: 'play_started' }, { name: 'duel_picked', props: { round: 1, correct: true } }]);
  });

  it('a wrong pick scores 0, and a second tap changes nothing', async () => {
    const hook = await renderDuel();
    await pickAndWait(hook, WRONG[0]!);
    expect(hook.result.current.reveal).toMatchObject({ correct: false, points: 0, costlier: RIGHT[0] });
    act(() => hook.result.current.pick(RIGHT[0]!));
    expect(hook.result.current.reveal).toMatchObject({ choice: WRONG[0], correct: false });
  });

  it('the hint shows one more fact on both cards and takes 10% of the round', async () => {
    const hook = await renderDuel();
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.hint!.used).toBe(true));
    expect(hook.result.current.hint).toMatchObject({ pointsNow: 900, pointsWithHint: 800 });
    for (const card of hook.result.current.cards!) expect(Object.values(t.hintFacts)).toContain(card.hintFact);
    await pickAndWait(hook, RIGHT[0]!);
    expect(hook.result.current.reveal!.points).toBe(900);
    expect(await tracked()).toContainEqual({ name: 'hint_opened', props: { round: 1 } });
  });

  it('next() moves on only after a pick; five rounds end on the day result', async () => {
    const hook = await renderDuel();
    act(() => hook.result.current.next());
    expect(hook.result.current.round).toBe(1);

    // Round 1 with a hint (yellow), 2 and 3 right (green), 4 and 5 missed (ink).
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.hint!.used).toBe(true));
    const picks: DuelLetter[] = [RIGHT[0]!, RIGHT[1]!, RIGHT[2]!, WRONG[3]!, WRONG[4]!];
    for (let i = 0; i < 5; i++) {
      await pickAndWait(hook, picks[i]!);
      if (i < 4) {
        act(() => hook.result.current.next());
        expect(hook.result.current.round).toBe(i + 2);
      }
    }
    expect(hook.result.current.reveal!.isLastRound).toBe(true);
    act(() => hook.result.current.next());

    const vm = hook.result.current;
    expect(vm.phase).toBe('summary');
    expect(vm.cards).toBeNull();
    const s = vm.summary!;
    expect(s).toMatchObject({ right: 3, rounds: 5, totalPoints: 2900, maxPoints: 5000, nextIn: { hours: 12, minutes: 0 } });
    expect(s.tiles.map((x) => x.color)).toEqual(['yellow', 'green', 'green', 'ink', 'ink']);
    expect(vm.dots.map((d) => d.state)).toEqual(['yellow', 'green', 'green', 'ink', 'ink']);
    expect(s.blindSpot).not.toBeNull();
    expect(s.challengeUrl).toMatch(/^https:\/\/lifeguessr\.test\/duel\?c=fixture-duel-2026-11-14-/);
    expect(s.shareText).toContain('🟨🟩🟩⬛⬛');
    expect(s.shareText).toContain('3/5 · 2,900 points');

    const events = await tracked();
    expect(events.filter((e) => e.name === 'duel_picked')).toHaveLength(5);
    expect(events).toContainEqual({ name: 'game_finished', props: { homes: 5 } });
    expect(events.filter((e) => e.name === 'play_started')).toHaveLength(1);
  });

  it('copies the challenge link and shares the result', async () => {
    const copy = vi.fn(async () => true);
    const share = vi.fn(async () => 'shared' as const);
    const hook = await renderDuel({ copy, share });
    for (let i = 0; i < 5; i++) {
      await pickAndWait(hook, RIGHT[i]!);
      act(() => hook.result.current.next());
    }
    expect(hook.result.current.summary!.blindSpot).toBeNull();
    act(() => hook.result.current.copyChallenge());
    await waitFor(() => expect(hook.result.current.copyStatus).toBe('copied'));
    expect(copy).toHaveBeenCalledWith(hook.result.current.summary!.challengeUrl);
    act(() => { hook.result.current.copyChallenge(); hook.result.current.guessOwn(); hook.result.current.guessOwn(); });
    act(() => hook.result.current.share());
    await waitFor(() => expect(hook.result.current.shareStatus).toBe('shared'));
    expect(share).toHaveBeenCalledWith(hook.result.current.summary!.shareText);
    const events = await tracked();
    expect(events.filter((e) => e.name === 'challenge_copied')).toHaveLength(1);
    expect(events.filter((e) => e.name === 'own_guess_started')).toHaveLength(1);
    expect(events).toContainEqual({ name: 'result_shared', props: { via: 'share' } });
  });

  it('a failed copy says so and tracks nothing', async () => {
    const hook = await renderDuel({ copy: async () => false });
    for (let i = 0; i < 5; i++) {
      await pickAndWait(hook, RIGHT[i]!);
      act(() => hook.result.current.next());
    }
    act(() => hook.result.current.copyChallenge());
    await waitFor(() => expect(hook.result.current.copyStatus).toBe('failed'));
    expect(await tracked()).not.toContainEqual({ name: 'challenge_copied' });
  });

  it('keeps today’s progress across a reload: same reveal, same score, no second pick', async () => {
    client = createFixtureDuelClient({ persist: true });
    const first = await renderDuel();
    await pickAndWait(first, RIGHT[0]!);
    const points = first.result.current.reveal!.points;
    first.unmount();
    expect(localStorage.getItem(FIXTURE_DUEL_LOG_KEY)).toContain(TODAY);
    expect(JSON.parse(localStorage.getItem(DUEL_VIEW_KEY)!)).toEqual({ date: TODAY, index: 0 });

    client = createFixtureDuelClient({ persist: true }); // a fresh page load
    const again = await renderDuel();
    expect(again.result.current.phase).toBe('reveal');
    expect(again.result.current.reveal).toMatchObject({ round: 1, choice: RIGHT[0], points });
    act(() => again.result.current.next());
    expect(again.result.current.round).toBe(2);
    again.unmount();

    client = createFixtureDuelClient({ persist: true });
    const third = await renderDuel();
    expect(third.result.current.round).toBe(2);
    expect(third.result.current.phase).toBe('round');
  });

  it('shows an error with a retry when the source fails, and a pick error without losing the round', async () => {
    let fail = true;
    const real = createFixtureDuelClient({ persist: false });
    client = {
      source: 'fixtures',
      daily: (today) => (fail ? Promise.reject(new ApiError('down', 503)) : real.daily(today)),
      pick: (round, choice, date) => (fail ? Promise.reject(new ApiError('down', 0)) : real.pick(round, choice, date)),
      hint: (round, date) => real.hint(round, date),
    };
    const hook = renderHook(() => useDuel({ client, now }));
    await waitForReady(hook.result);
    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.error).toEqual({ kind: 'unavailable' });
    fail = false;
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    fail = true;
    act(() => hook.result.current.pick('A'));
    await waitFor(() => expect(hook.result.current.pickError).toEqual({ kind: 'network', status: undefined }));
    expect(hook.result.current.phase).toBe('round');
    expect(hook.result.current.cards!.every((c) => c.state === 'round')).toBe(true);
  });
});

describe('nextNewYorkMidnight', () => {
  it('counts down to midnight in New York, in standard and daylight time', () => {
    expect(nextNewYorkMidnight(new Date('2026-11-14T17:00:00Z'))).toEqual({ hours: 12, minutes: 0 }); // EST noon
    expect(nextNewYorkMidnight(new Date('2026-07-01T03:30:00Z'))).toEqual({ hours: 0, minutes: 30 }); // EDT 23:30
    expect(nextNewYorkMidnight(new Date('2026-11-15T05:00:00Z'))).toEqual({ hours: 24, minutes: 0 }); // EST midnight
  });
});
