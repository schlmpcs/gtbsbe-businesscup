// @vitest-environment jsdom
// The duel view-model (S2 Duel round, S3 Reveal, S3 Day result) on the fixture duel, and on the
// HTTP duel client (mocked fetch, and the real duel routes in-process on the memory store).
import { costOfLife, dailyDuelPairs, duelDifference } from '@lifeguessr/engine';
import type { ClientFunnelEvent, DuelLetter, EventsRequest, PickResult } from '@lifeguessr/types';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { duel as t } from '@/copy/duel';
import { duelCardsSample } from '@/fixtures/duelCards';
import { ApiError } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { flushEvents, queuedEventsForTests, resetEventsForTests } from '@/lib/events';
import { resetClientState, waitForReady } from '@/test/clientState';
import type { DuelDailyResponse } from '@/lib/api/gameSchemas';
import { duelScorer, duelSet } from '@/server/game/duel';
import { ANON, setupGameTestEnv } from '@/server/game/testUtils';
import { createRouteFetch } from '@/test/gameRoutes';
import { createHttpDuelClient, type DuelClient, type DuelDay } from './duelClient';
import { choiceOf, nextNewYorkMidnight } from './duelDerive';
import { createFixtureDuelClient, FIXTURE_DUEL_LOG_KEY } from './duelFixtureClient';
import { DuelScreen } from '../ui/DuelScreen';
import { parseDuelLog } from './duelProgress';
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
    expect(share).toHaveBeenCalledWith(hook.result.current.summary!.shareText, null); // fixtures: no image
    expect(hook.result.current.summary!.shareImage).toBeNull();
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

// ----- the HTTP duel client ---------------------------------------------------------------------

const HTTP_ID = '11111111-2222-4333-8444-555555555555';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The VM without its callbacks and its source: what the screen renders. */
function rendered(vm: ReturnType<typeof useDuel>) {
  return Object.fromEntries(Object.entries(vm).filter(([k, v]) => typeof v !== 'function' && k !== 'source'));
}

describe('useDuel on the HTTP client (mocked fetch)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Plays part of today on the fixture duel (round 1 right, round 2 wrong after a hint, a hint on
   * round 3, then back to round 3 on screen) and returns the fixture log, as a reload finds it.
   */
  async function halfPlayedFixtureDay() {
    client = createFixtureDuelClient({ persist: true });
    const hook = await renderDuel();
    await pickAndWait(hook, RIGHT[0]!);
    act(() => hook.result.current.next());
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.hint!.used).toBe(true));
    await pickAndWait(hook, WRONG[1]!);
    act(() => hook.result.current.next());
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.hint!.used).toBe(true));
    hook.unmount();
    const log = parseDuelLog(localStorage.getItem(FIXTURE_DUEL_LOG_KEY), TODAY)!;
    const { duels } = await createFixtureDuelClient({ persist: false }).daily(TODAY);
    return { log, duels };
  }

  /** The same day as GET /api/daily?game=duel sends it: string round keys, the day's resultId. */
  function wireOf({ log, duels }: Awaited<ReturnType<typeof halfPlayedFixtureDay>>): DuelDailyResponse {
    const picks = Object.fromEntries(Object.entries(log.picks).map(([round, pick]) => [String(round), pick]));
    const hints = Object.fromEntries(Object.entries(log.hints).map(([round, hint]) => [String(round), hint]));
    return { ok: true, date: TODAY, duels, progress: { resultId: '0123456789abcdef0123456789abcdef', picks, hints } };
  }

  it('resumes a half-played day from the server’s progress exactly as from the fixture log', async () => {
    const day = await halfPlayedFixtureDay();
    vi.stubGlobal('fetch', vi.fn(async () => json(wireOf(day))));

    for (const viewKept of [true, false]) {
      if (!viewKept) localStorage.removeItem(DUEL_VIEW_KEY); // a cleared tab: resume at the first open round
      client = createFixtureDuelClient({ persist: true });
      const fromLog = await renderDuel();
      client = createHttpDuelClient({ anonId: () => HTTP_ID });
      const fromServer = await renderDuel();

      expect(fromServer.result.current.source).toBe('api');
      expect(fromServer.result.current.round).toBe(3);
      expect(fromServer.result.current.phase).toBe('round');
      expect(fromServer.result.current.hint).toMatchObject({ used: true, pointsNow: 900 });
      expect(fromServer.result.current.dots.map((d) => d.state)).toEqual(['green', 'ink', 'current', 'upcoming', 'upcoming']);
      expect(rendered(fromServer.result.current)).toEqual(rendered(fromLog.result.current));
      fromLog.unmount();
      fromServer.unmount();
    }
  });

  it('a pick on the HTTP client sends no score and shows the server’s result', async () => {
    const day = await halfPlayedFixtureDay();
    const wire = wireOf(day);
    const r3: PickResult = { ...day.log.picks[1]!.result, correct: true, points: 800, totals: { A: 5000, B: 4000 } };
    const fetchMock = vi.fn(async (url: string) => (url.endsWith('/pick') ? json({ ...r3, replayed: false }) : json(wire)));
    vi.stubGlobal('fetch', fetchMock);
    client = createHttpDuelClient({ anonId: () => HTTP_ID });
    const hook = await renderDuel();
    await pickAndWait(hook, 'A');
    expect(hook.result.current.reveal).toMatchObject({ round: 3, choice: 'A', correct: true, points: 800 });
    const [, init] = fetchMock.mock.calls.find(([url]) => (url as string).endsWith('/pick')) as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ anonId: HTTP_ID, date: TODAY, round: 3, choice: 'A' });
  });
});

describe('useDuel: a repeated pick, and the day ending mid-play', () => {
  it('a replayed pick (another tab picked first) shows the letter the server scored, not the one tapped', async () => {
    const real = createFixtureDuelClient({ persist: false });
    await real.daily(TODAY);
    const first = await real.pick(1, RIGHT[0]!, TODAY); // "the other tab"
    expect(choiceOf(first)).toBe(RIGHT[0]);
    // This page loaded before the other tab's pick, and taps the other letter:
    const stale: DuelClient = {
      source: 'api',
      daily: async () => ({ ...(await real.daily(TODAY)), progress: { picks: {}, hints: {} } }),
      pick: (r, c, d) => real.pick(r, c, d),
      hint: (r, d) => real.hint(r, d),
    };
    client = stale;
    const tab = await renderDuel();
    await pickAndWait(tab, WRONG[0]!);
    expect(tab.result.current.reveal).toMatchObject({ choice: RIGHT[0], correct: true, points: first.points });
    expect(tab.result.current.cards!.find((c) => c.pickedByYou)!.letter).toBe(RIGHT[0]);
  });

  /** A client whose day ends after `daily` served `days[0]`: picks and hints for it answer 409 day_over. */
  function rollingClient(days: [DuelDay, DuelDay]) {
    let served = 0;
    const real = createFixtureDuelClient({ persist: false });
    const dayOver = () => Promise.reject(new ApiError('ended', 409, false, { ok: false, error: { code: 'day_over', today: days[1].date } }));
    const c: DuelClient = {
      source: 'api',
      daily: vi.fn(async () => days[Math.min(served++, 1)]!),
      pick: vi.fn((round, choice, date) => (date === days[0].date ? dayOver() : real.pick(round, choice, date))),
      hint: vi.fn((round, date) => (date === days[0].date ? dayOver() : real.hint(round, date))),
    };
    return { c, real };
  }

  it('409 day_over on a pick loads the new day’s five and says so; the next pick clears the note', async () => {
    const fixture = createFixtureDuelClient({ persist: false });
    const yesterday = await fixture.daily('2026-11-13');
    const today = await createFixtureDuelClient({ persist: false }).daily(TODAY);
    const { c, real } = rollingClient([yesterday, today]);
    await real.daily(TODAY);
    client = c;
    const hook = await renderDuel();
    expect(hook.result.current.date).toBe('2026-11-13');
    expect(hook.result.current.newDay).toBe(false);

    act(() => hook.result.current.pick('A'));
    await waitFor(() => expect(hook.result.current.date).toBe(TODAY));
    const vm = hook.result.current;
    expect(vm).toMatchObject({ status: 'ready', newDay: true, phase: 'round', round: 1, pickError: null, error: null });
    expect(vm.dots.map((d) => d.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(c.daily).toHaveBeenCalledTimes(2);

    await pickAndWait(hook, RIGHT[0]!);
    expect(hook.result.current.newDay).toBe(false);
    expect(hook.result.current.reveal).toMatchObject({ round: 1, correct: true });
  });

  it('409 day_over on a hint loads the new day too, with no hint error', async () => {
    const yesterday = await createFixtureDuelClient({ persist: false }).daily('2026-11-13');
    const today = await createFixtureDuelClient({ persist: false }).daily(TODAY);
    const { c, real } = rollingClient([yesterday, today]);
    await real.daily(TODAY);
    client = c;
    const hook = await renderDuel();
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.date).toBe(TODAY));
    expect(hook.result.current).toMatchObject({ newDay: true, hint: { used: false, status: 'idle' } });
    act(() => hook.result.current.openHint());
    await waitFor(() => expect(hook.result.current.hint!.used).toBe(true));
    expect(hook.result.current.newDay).toBe(false);
  });

  it('the screen says the new day started, in place of a pick error', async () => {
    const yesterday = await createFixtureDuelClient({ persist: false }).daily('2026-11-13');
    const today = await createFixtureDuelClient({ persist: false }).daily(TODAY);
    const { c, real } = rollingClient([yesterday, today]);
    await real.daily(TODAY);
    client = c;
    function Duel() {
      return createElement(DuelScreen, { vm: useDuel({ client, now }), guessOwnHref: '/me/guess' });
    }
    render(createElement(Duel));
    await userEvent.click(await screen.findByRole('button', { name: /^Life A costs more/ }));
    expect(await screen.findByText(t.newDay)).toHaveAttribute('role', 'status');
    expect(screen.queryByText(t.pickError, { exact: false })).toBeNull();
    expect(screen.getByText(new RegExp(`^${t.round(1, 5)}`))).toBeInTheDocument(); // the new day's round 1
  });

  it('any other 409 is still an error on the round, not a new day', async () => {
    const real = createFixtureDuelClient({ persist: false });
    client = {
      source: 'api',
      daily: (d) => real.daily(d),
      pick: () => Promise.reject(new ApiError('conflict', 409, false, { ok: false, error: { code: 'something_else' } })),
      hint: (r, d) => real.hint(r, d),
    };
    const hook = await renderDuel();
    act(() => hook.result.current.pick('A'));
    await waitFor(() => expect(hook.result.current.pickError).not.toBeNull());
    expect(hook.result.current.newDay).toBe(false);
    expect(hook.result.current.date).toBe(TODAY);
  });
});

describe('useDuel on the HTTP client against the real duel routes (memory store)', () => {
  setupGameTestEnv();
  afterEach(() => vi.unstubAllGlobals());

  it('a hint and two picks are on the server; a cleared tab resumes at round 3 with the same results', async () => {
    vi.stubGlobal('fetch', createRouteFetch().fetch);
    const costlier = duelSet(TODAY).map((pair) => (duelScorer(pair, 'A')(0).correct ? 'A' : 'B') as DuelLetter);
    client = createHttpDuelClient({ anonId: () => ANON });
    const first = await renderDuel();
    expect(first.result.current).toMatchObject({ source: 'api', date: TODAY, round: 1, phase: 'round' });

    act(() => first.result.current.openHint());
    await waitFor(() => expect(first.result.current.hint!.used).toBe(true));
    await pickAndWait(first, costlier[0]!);
    expect(first.result.current.reveal).toMatchObject({ correct: true, points: 900 });
    act(() => first.result.current.next());
    await pickAndWait(first, costlier[1] === 'A' ? 'B' : 'A');
    expect(first.result.current.reveal).toMatchObject({ round: 2, correct: false, points: 0 });
    first.unmount();

    localStorage.clear(); // a cleared tab: only the server remembers
    client = createHttpDuelClient({ anonId: () => ANON });
    const again = await renderDuel();
    expect(again.result.current).toMatchObject({ round: 3, phase: 'round' });
    expect(again.result.current.dots.map((d) => d.state)).toEqual(['yellow', 'ink', 'current', 'upcoming', 'upcoming']);
  });
});

describe('useDuel share: the share card PNG where the platform shares files, else the text', () => {
  // The fixture duel's answers, but reporting itself as the API source, so the summary points at
  // the server's share card like an API build does.
  const apiClient = (): DuelClient => {
    const real = createFixtureDuelClient({ persist: false });
    return { source: 'api', daily: (d) => real.daily(d), pick: (r, c, d) => real.pick(r, c, d), hint: (r, d) => real.hint(r, d) };
  };
  const pngReply = () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'content-type': 'image/png' } });

  let share: ReturnType<typeof vi.fn>;
  let canShare: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    share = vi.fn(async () => {});
    canShare = vi.fn(() => true);
    fetchMock = vi.fn(async () => pngReply());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
    vi.stubGlobal('fetch', fetchMock);
    return () => {
      delete (navigator as { share?: unknown }).share;
      delete (navigator as { canShare?: unknown }).canShare;
      vi.unstubAllGlobals();
    };
  });

  /** Plays all five, lands on the day result, and lets the share card download settle. */
  async function finishedDay(extra: UseDuelOptions = {}) {
    const hook = await renderDuel(extra);
    for (let i = 0; i < 5; i++) {
      await pickAndWait(hook, RIGHT[i]!);
      act(() => hook.result.current.next());
    }
    expect(hook.result.current.phase).toBe('summary');
    // The download and the blob read resolve over a few ticks; the hook keeps the file to itself,
    // so give it a handful of macrotasks before anyone taps Share.
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return hook;
  }

  async function shareAndWait(hook: Hook) {
    act(() => hook.result.current.share());
    await waitFor(() => expect(hook.result.current.shareStatus).not.toBe('sharing'));
  }

  it('downloads the 9:16 card when the day result shows, and shares it with the text', async () => {
    client = apiClient();
    const hook = await finishedDay();
    const summary = hook.result.current.summary!;
    const id = encodeURIComponent(summary.challengeUrl.split('?c=')[1]!);
    expect(summary.shareImage).toEqual({ story: `/api/share?resultId=${id}&format=9x16`, square: `/api/share?resultId=${id}&format=1x1` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(summary.shareImage!.story);

    await shareAndWait(hook);
    expect(hook.result.current.shareStatus).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0]![0] as ShareData;
    expect(data.text).toBe(summary.shareText);
    expect(data.files).toHaveLength(1);
    expect(data.files![0]).toMatchObject({ name: `lifeguessr-duel-${TODAY}.png`, type: 'image/png' });
    expect(await tracked()).toContainEqual({ name: 'result_shared', props: { via: 'share' } });
  });

  it('shares the text when the browser can’t share files', async () => {
    client = apiClient();
    canShare.mockImplementation((data?: ShareData) => !data?.files);
    const hook = await finishedDay();
    await shareAndWait(hook);
    expect(hook.result.current.shareStatus).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: hook.result.current.summary!.shareText });
    expect(await tracked()).toContainEqual({ name: 'result_shared', props: { via: 'share' } });
  });

  it('shares the text when the card couldn’t be downloaded', async () => {
    client = apiClient();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }));
    const hook = await finishedDay();
    await shareAndWait(hook);
    expect(share).toHaveBeenCalledWith({ text: hook.result.current.summary!.shareText });
  });

  it('on fixtures there is no server card: nothing is downloaded and the text is shared', async () => {
    const hook = await finishedDay();
    expect(hook.result.current.summary!.shareImage).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await shareAndWait(hook);
    expect(share).toHaveBeenCalledWith({ text: hook.result.current.summary!.shareText });
  });
});

describe('nextNewYorkMidnight', () => {
  it('counts down to midnight in New York, in standard and daylight time', () => {
    expect(nextNewYorkMidnight(new Date('2026-11-14T17:00:00Z'))).toEqual({ hours: 12, minutes: 0 }); // EST noon
    expect(nextNewYorkMidnight(new Date('2026-07-01T03:30:00Z'))).toEqual({ hours: 0, minutes: 30 }); // EDT 23:30
    expect(nextNewYorkMidnight(new Date('2026-11-15T05:00:00Z'))).toEqual({ hours: 24, minutes: 0 }); // EST midnight
  });
});
