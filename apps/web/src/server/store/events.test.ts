import { FUNNEL_EVENT_NAMES, FUNNEL_STEPS, type FunnelEvent, type FunnelReport } from '@lifeguessr/types';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFunnelReport, eventBit, lastDays, maskOf, uniqueById, type StoredEvent } from './events';
import { createMemoryEventStore } from './events.memory';
import { createMemoryStore, type Store } from './index';
import { TEST_STORE_URL, testPostgresStore } from './testUtils';

const A = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
const B = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
const C = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

let seq = 0;
/** A stored event with a fresh, valid UUID. */
const ev = (event: FunnelEvent): StoredEvent => ({ ...event, id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}` });
const guessed = (home: number, cluesOpened: number) => ev({ name: 'home_guessed', props: { home, cluesOpened } });

const window = () => lastDays(1, new Date(Date.now() + 60_000));
const step = (report: FunnelReport, name: string) => report.steps.find((s) => s.name === name);

describe('masks', () => {
  it('give each known event one bit and ignore names this build does not know', () => {
    expect(new Set(FUNNEL_EVENT_NAMES.map(eventBit)).size).toBe(FUNNEL_EVENT_NAMES.length);
    expect(eventBit('play_started')).toBe(1n);
    expect(eventBit('a_newer_event')).toBe(0n);
    expect(maskOf(['play_started', 'play_started', 'a_newer_event'])).toBe(1n);
    expect(maskOf([])).toBe(0n);
  });

  it('are 64 bits: the 32nd name (bit 31) stays positive and exact', () => {
    expect(FUNNEL_EVENT_NAMES.length).toBeGreaterThanOrEqual(32);
    const name32 = FUNNEL_EVENT_NAMES[31]!;
    expect(eventBit(name32)).toBe(2n ** 31n); // a 32-bit `1 << 31` would be -2147483648
    expect(maskOf(['play_started', name32])).toBe(2n ** 31n + 1n);
    expect(maskOf(FUNNEL_EVENT_NAMES)).toBe(2n ** BigInt(FUNNEL_EVENT_NAMES.length) - 1n);
  });

  it('keeps every event name distinct up to the 63 a signed 64-bit mask holds', () => {
    const names = FUNNEL_EVENT_NAMES as unknown as string[];
    const originalLength = names.length;
    try {
      while (names.length < 63) names.push(`future_test_event_${names.length}`);
      expect(new Set(names.map(eventBit)).size).toBe(63);
      expect(maskOf(names)).toBe((1n << 63n) - 1n);
    } finally { names.length = originalLength; }
  });

  it('keep the first event of each id', () => {
    const a = ev({ name: 'forecast_viewed' });
    const b = ev({ name: 'paywall_viewed' });
    expect(uniqueById([a, b, { ...a, name: 'sliders_adjusted' }])).toEqual([a, b]);
  });
});

describe('buildFunnelReport', () => {
  const w = { from: new Date('2026-11-07T00:00:00Z'), to: new Date('2026-11-14T00:00:00Z') };
  const m = (...names: string[]) => maskOf(names);
  const none = { guesses: 0, cluesOpened: 0, blind: 0 };

  it('counts slider and duel players in the same funnel', () => {
    const report = buildFunnelReport(w, [
      { mask: m('play_started', 'home_guessed', 'game_finished'), users: 1 },
      { mask: m('play_started', 'duel_picked', 'game_finished'), users: 1 },
    ], none);
    expect(step(report, 'play_started')?.users).toBe(2);
    expect(step(report, 'game_finished')?.funnel).toBe(2);
    expect(report.events.duel_picked).toBe(1);
  });

  it('counts people per step, people through every earlier step, and the conversion between steps', () => {
    const report = buildFunnelReport(
      w,
      [
        // 4 played and finished, 1 of them guessed their own cost and moved the sliders
        { mask: m('play_started', 'game_finished', 'own_guess_submitted', 'sliders_adjusted'), users: 1 },
        { mask: m('play_started', 'game_finished', 'result_shared'), users: 3 },
        // 2 played and left
        { mask: m('play_started'), users: 2 },
        // 2 went straight to the sliders without playing: they count for the step, not the funnel
        { mask: m('sliders_adjusted'), users: 2 },
      ],
      { guesses: 20, cluesOpened: 30, blind: 5 },
    );
    expect(report.from).toBe('2026-11-07T00:00:00.000Z');
    expect(report.to).toBe('2026-11-14T00:00:00.000Z');
    expect(report.users).toBe(8);
    expect(report.steps.map((s) => s.name)).toEqual([...FUNNEL_STEPS]);
    expect(step(report, 'play_started')).toEqual({ name: 'play_started', users: 6, funnel: 6, conversion: null });
    expect(step(report, 'game_finished')).toEqual({ name: 'game_finished', users: 4, funnel: 4, conversion: 4 / 6 });
    expect(step(report, 'own_guess_submitted')).toEqual({ name: 'own_guess_submitted', users: 1, funnel: 1, conversion: 1 / 4 });
    expect(step(report, 'sliders_adjusted')).toEqual({ name: 'sliders_adjusted', users: 3, funnel: 1, conversion: 1 });
    expect(step(report, 'balance_sheet_edited')).toEqual({ name: 'balance_sheet_edited', users: 0, funnel: 0, conversion: 0 });
    // Nobody reached the step before: no conversion to show, rather than 0 % or a division by zero.
    expect(step(report, 'statement_applied')?.conversion).toBeNull();
    expect(report.events.result_shared).toBe(3);
    expect(report.events.pro_purchased).toBe(0);
    expect(report.game).toEqual({
      players: 6, finished: 4, finishRate: 4 / 6,
      guesses: 20, cluesPerHome: 1.5, blindGuessRate: 0.25,
      shared: 3, shareRate: 3 / 4,
    });
  });

  it('reports zeros and no rates for an empty window', () => {
    const report = buildFunnelReport(w, [], { guesses: 0, cluesOpened: 0, blind: 0 });
    expect(report.users).toBe(0);
    expect(report.steps.every((s) => s.users === 0 && s.funnel === 0)).toBe(true);
    expect(report.game).toEqual({
      players: 0, finished: 0, finishRate: null, guesses: 0, cluesPerHome: null, blindGuessRate: null, shared: 0, shareRate: null,
    });
  });

  it('ignores ids with only unknown events', () => {
    expect(buildFunnelReport(w, [{ mask: 0n, users: 9 }], { guesses: 0, cluesOpened: 0, blind: 0 }).users).toBe(0);
  });

  it('counts an id that sent the 32nd event (bit 31) like any other', () => {
    const name32 = FUNNEL_EVENT_NAMES[31]!;
    const report = buildFunnelReport(w, [{ mask: m('play_started', name32), users: 2 }, { mask: m(name32), users: 1 }], none);
    expect(report.users).toBe(3);
    expect(report.events[name32]).toBe(3);
    expect(report.events.play_started).toBe(2);
    expect(step(report, 'play_started')?.funnel).toBe(2);
  });

  it('keeps every low bit of a mask with bit 62 set (no loss of precision as a float would)', () => {
    const high = (1n << 62n) | m('play_started', 'game_finished');
    expect(Number(high) % 2).toBe(0); // the premise: as a JS number, the low bits are gone
    const report = buildFunnelReport(w, [{ mask: high, users: 4 }], none);
    expect(report.users).toBe(4);
    expect(report.events.play_started).toBe(4);
    expect(report.events.game_finished).toBe(4);
    expect(report.game.finishRate).toBe(1);
    expect(FUNNEL_EVENT_NAMES.filter((n) => report.events[n] > 0).sort()).toEqual(['game_finished', 'play_started']);
  });
});

// ----- the same behaviour from both implementations ------------------------------------------

type Harness = { store: Store; cleanup: () => Promise<void> };
const implementations: [string, () => Harness][] = [['memory', () => ({ store: createMemoryStore(), cleanup: async () => {} })]];
if (TEST_STORE_URL) implementations.push(['postgres', () => testPostgresStore()]);

describe.each(implementations)('%s event store', (backend, make) => {
  let harness: Harness | undefined;
  const open = () => {
    harness = make();
    return harness.store.events;
  };
  afterEach(async () => {
    await harness?.cleanup();
    harness = undefined;
  });

  it('stores a batch once: a resent batch (same ids) is not counted again', async () => {
    const events = open();
    const batch = [ev({ name: 'play_started' }), ev({ name: 'clue_opened', props: { home: 1, clue: 'garage' } }), guessed(1, 1)];
    expect(await events.record(A, batch)).toBe(3);
    expect(await events.record(A, batch)).toBe(0);
    expect(await events.record(A, [batch[0]!, batch[0]!])).toBe(0);
    const report = await events.funnel(window());
    expect(report.users).toBe(1);
    expect(report.game.guesses).toBe(1);
  });

  it('counts people, not events, and builds the funnel and game metrics from what they did', async () => {
    const events = open();
    // A: plays all 5 homes (2 blind), finishes, shares, goes down the ladder to the paywall.
    await events.record(A, [
      ev({ name: 'play_started' }),
      guessed(1, 2), guessed(2, 1), guessed(3, 0), guessed(4, 0), guessed(5, 3),
      ev({ name: 'game_finished', props: { homes: 5 } }),
      ev({ name: 'result_shared', props: { via: 'share' } }),
      ev({ name: 'own_guess_submitted' }), ev({ name: 'sliders_adjusted' }), ev({ name: 'balance_sheet_edited' }),
      ev({ name: 'statement_applied', props: { months: 5 } }),
      ev({ name: 'forecast_viewed' }), ev({ name: 'forecast_viewed' }), ev({ name: 'forecast_viewed' }),
      ev({ name: 'paywall_viewed' }),
    ]);
    await events.record(A, [ev({ name: 'pro_purchased', props: { plan: 'yearly' } })]);
    // B: plays one home and leaves.
    await events.record(B, [ev({ name: 'play_started' }), guessed(1, 1)]);
    // C: never plays, only looks at the forecast.
    await events.record(C, [ev({ name: 'forecast_viewed' })]);

    const report = await events.funnel(window());
    expect(report.users).toBe(3);
    expect(report.events.forecast_viewed).toBe(2);
    expect(report.steps.map((s) => [s.name, s.users, s.funnel])).toEqual([
      ['play_started', 2, 2],
      ['game_finished', 1, 1],
      ['own_guess_submitted', 1, 1],
      ['sliders_adjusted', 1, 1],
      ['balance_sheet_edited', 1, 1],
      ['statement_applied', 1, 1],
      ['forecast_viewed', 2, 1],
      ['paywall_viewed', 1, 1],
      ['pro_purchased', 1, 1],
    ]);
    expect(report.game).toEqual({
      players: 2, finished: 1, finishRate: 0.5,
      guesses: 6, cluesPerHome: 7 / 6, blindGuessRate: 2 / 6,
      shared: 1, shareRate: 1,
    });
  });

  it('counts the 32nd event name (bit 31 of the mask)', async () => {
    expect(FUNNEL_EVENT_NAMES.indexOf('pro_promo_redeemed')).toBeGreaterThanOrEqual(31); // the premise
    const events = open();
    await events.record(A, [ev({ name: 'play_started' }), ev({ name: 'pro_promo_redeemed' })]);
    await events.record(B, [ev({ name: 'pro_promo_redeemed' })]);
    const report = await events.funnel(window());
    expect(report.users).toBe(2);
    expect(report.events.pro_promo_redeemed).toBe(2);
    expect(report.events.play_started).toBe(1);
  });

  it('reports only the window asked for', async () => {
    const events = open();
    await events.record(A, [ev({ name: 'play_started' })]);
    const past = { from: new Date('2020-01-01T00:00:00Z'), to: new Date('2020-01-08T00:00:00Z') };
    expect((await events.funnel(past)).users).toBe(0);
    expect((await events.funnel(window())).users).toBe(1);
  });

  if (backend === 'postgres') {
    it('stores the hash of the anonymous id, the props as JSON and the server clock', async () => {
      const events = open();
      await events.record(A, [ev({ name: 'clue_opened', props: { home: 2, clue: 'kitchen' } })]);
      const { rows } = await harness!.store.db!.query<{ anon_key: string; props: unknown; dump: string; age: number }>(
        `SELECT anon_key, props, funnel_events::text AS dump, extract(epoch FROM now() - occurred_at)::float AS age FROM funnel_events`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.anon_key).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0]!.dump).not.toContain(A);
      expect(rows[0]!.props).toEqual({ home: 2, clue: 'kitchen' });
      expect(rows[0]!.age).toBeLessThan(60);
    });

    it('leaves out rows of event names a newer build added (after a rollback)', async () => {
      const events = open();
      await events.record(A, [ev({ name: 'play_started' })]);
      await harness!.store.db!.query(
        `INSERT INTO funnel_events (id, anon_key, name) VALUES ('11111111-1111-4111-8111-111111111111', repeat('a', 64), 'a_newer_event')`,
      );
      const report = await events.funnel(window());
      expect(report.users).toBe(1);
      expect(report.events.play_started).toBe(1);
    });

    it('moves an event out of the window when it is older', async () => {
      const events = open();
      await events.record(A, [ev({ name: 'play_started' })]);
      await events.record(B, [ev({ name: 'play_started' })]);
      await harness!.store.db!.query(`UPDATE funnel_events SET occurred_at = now() - interval '8 days' WHERE anon_key <> $1`, [
        (await import('./anonKey')).anonKey(A),
      ]);
      expect((await events.funnel(lastDays(7, new Date(Date.now() + 60_000)))).users).toBe(1);
      expect((await events.funnel(lastDays(9, new Date(Date.now() + 60_000)))).users).toBe(2);
    });
  }
});

describe('memory event store', () => {
  it('keeps at most `max` rows, dropping the oldest (and forgetting their ids)', async () => {
    const store = createMemoryEventStore({ max: 3 });
    const first = ev({ name: 'play_started' });
    await store.record(A, [first, ev({ name: 'forecast_viewed' })]);
    await store.record(B, [ev({ name: 'play_started' }), ev({ name: 'forecast_viewed' })]);
    const report = await store.funnel(window());
    expect(report.events.play_started).toBe(1); // A's play_started was dropped
    expect(report.events.forecast_viewed).toBe(2);
    expect(await store.record(A, [first])).toBe(1);
  });

  it('uses its clock for the window', async () => {
    let now = new Date('2026-11-01T12:00:00Z');
    const store = createMemoryEventStore({ now: () => now });
    await store.record(A, [ev({ name: 'play_started' })]);
    now = new Date('2026-11-10T12:00:00Z');
    await store.record(B, [ev({ name: 'play_started' })]);
    expect((await store.funnel(lastDays(7, now))).users).toBe(1);
    expect((await store.funnel(lastDays(10, now))).users).toBe(2);
  });
});
