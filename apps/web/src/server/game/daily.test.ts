import { getArea } from '@lifeguessr/data/areas';
import { dailyCards, dailyCycleDays, lifeCards } from '@lifeguessr/data/cards';
import { costOfLife, sceneOf, scoreGuess } from '@lifeguessr/engine';
import { CLUE_IDS } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { dayNumber } from '@/lib/dates';
import { clueReveal, dailySet, DAY_GRACE_MS, findDailyCard, playDate, publicCards, resolvePlayDate, scorerFor } from './daily';

const at = (iso: string) => new Date(iso);

describe('playDate: the US Eastern calendar date', () => {
  it.each([
    // Standard time (UTC−5): midnight Eastern is 05:00 UTC.
    ['2026-11-15T04:59:59.999Z', '2026-11-14'],
    ['2026-11-15T05:00:00.000Z', '2026-11-15'],
    ['2026-01-01T04:59:59Z', '2025-12-31'],
    ['2026-01-01T05:00:00Z', '2026-01-01'],
    // Daylight time (UTC−4): midnight Eastern is 04:00 UTC.
    ['2026-07-04T03:59:59Z', '2026-07-03'],
    ['2026-07-04T04:00:00Z', '2026-07-04'],
  ])('%s is %s', (now, date) => {
    expect(playDate(at(now))).toBe(date);
  });

  it('follows the spring-forward day (2026-03-08: midnight at 05:00 UTC, the next at 04:00 UTC)', () => {
    expect(playDate(at('2026-03-08T04:59:59Z'))).toBe('2026-03-07');
    expect(playDate(at('2026-03-08T05:00:00Z'))).toBe('2026-03-08');
    // 2 AM EST jumps to 3 AM EDT at 07:00 UTC; still the 8th on both sides.
    expect(playDate(at('2026-03-08T06:59:59Z'))).toBe('2026-03-08');
    expect(playDate(at('2026-03-08T07:00:00Z'))).toBe('2026-03-08');
    expect(playDate(at('2026-03-09T03:59:59Z'))).toBe('2026-03-08'); // a 23-hour day
    expect(playDate(at('2026-03-09T04:00:00Z'))).toBe('2026-03-09');
  });

  it('follows the fall-back day (2026-11-01: midnight at 04:00 UTC, the next at 05:00 UTC)', () => {
    expect(playDate(at('2026-11-01T03:59:59Z'))).toBe('2026-10-31');
    expect(playDate(at('2026-11-01T04:00:00Z'))).toBe('2026-11-01');
    // 2 AM EDT falls back to 1 AM EST at 06:00 UTC; the repeated hour is still the 1st.
    expect(playDate(at('2026-11-01T05:30:00Z'))).toBe('2026-11-01');
    expect(playDate(at('2026-11-01T06:30:00Z'))).toBe('2026-11-01');
    expect(playDate(at('2026-11-02T04:59:59Z'))).toBe('2026-11-01'); // a 25-hour day
    expect(playDate(at('2026-11-02T05:00:00Z'))).toBe('2026-11-02');
  });

  it('is not the UTC date, nor the date in the server’s own zone', () => {
    // 9 PM in New York on the 14th is already the 15th in UTC (and in Almaty).
    expect(playDate(at('2026-11-15T02:00:00Z'))).toBe('2026-11-14');
  });
});

describe('resolvePlayDate', () => {
  const justAfterMidnight = at('2026-11-15T05:10:00Z'); // 12:10 AM Eastern on the 15th

  it('uses today when no date is sent, and accepts today', () => {
    expect(resolvePlayDate(undefined, justAfterMidnight)).toEqual({ ok: true, date: '2026-11-15' });
    expect(resolvePlayDate('2026-11-15', justAfterMidnight)).toEqual({ ok: true, date: '2026-11-15' });
  });

  it('keeps yesterday’s set open for the grace period after midnight, then closes it', () => {
    expect(resolvePlayDate('2026-11-14', justAfterMidnight)).toEqual({ ok: true, date: '2026-11-14' });
    const midnight = at('2026-11-15T05:00:00Z').getTime();
    expect(resolvePlayDate('2026-11-14', new Date(midnight + DAY_GRACE_MS - 1))).toEqual({ ok: true, date: '2026-11-14' });
    expect(resolvePlayDate('2026-11-14', new Date(midnight + DAY_GRACE_MS))).toEqual({ ok: false, today: '2026-11-15' });
  });

  it('refuses any other date (older sets, future sets)', () => {
    expect(resolvePlayDate('2026-11-13', justAfterMidnight)).toEqual({ ok: false, today: '2026-11-15' });
    expect(resolvePlayDate('2026-11-16', justAfterMidnight)).toEqual({ ok: false, today: '2026-11-15' });
  });
});

describe('the daily set', () => {
  it('is the catalog’s 5 cards for the date’s day number: the same for everyone', () => {
    const set = dailySet('2026-11-14');
    expect(set).toHaveLength(5);
    expect(set.map((c) => c.id)).toEqual(dailyCards(dayNumber('2026-11-14')).map((c) => c.id));
    expect(set.every((c) => c.pack === undefined)).toBe(true);
    expect(dailySet('2026-11-15').map((c) => c.id)).not.toEqual(set.map((c) => c.id));
    // The pools cycle every dailyCycleDays days.
    const later = new Date(Date.UTC(2026, 10, 14 + dailyCycleDays)).toISOString().slice(0, 10);
    expect(dailySet(later).map((c) => c.id)).toEqual(set.map((c) => c.id));
  });

  it('shows the browser PublicCards only: no costs and none of the fields the clues reveal', () => {
    const cards = publicCards('2026-11-14');
    expect(cards.map((c) => c.id)).toEqual(dailySet('2026-11-14').map((c) => c.id));
    for (const card of cards) expect(Object.keys(card).sort()).toEqual(['caption', 'decor', 'id', 'layout', 'metro']);
    const text = JSON.stringify(cards);
    for (const secret of ['"zip"', '"kids"', '"car"', '"eatingOutPerWeek"', '"adults"', '"total"', '"price"']) {
      expect(text).not.toContain(secret);
    }
    expect(cards.every((c) => c.decor.every((p) => p.clue === undefined))).toBe(true);
  });

  it('finds a card only in its own day’s set (packs and other days are refused)', () => {
    const [first] = dailySet('2026-11-14');
    expect(findDailyCard('2026-11-14', first!.id)).toEqual(first);
    expect(findDailyCard('2026-11-15', first!.id)).toBeNull();
    const pack = lifeCards.find((c) => c.pack !== undefined)!;
    expect(findDailyCard('2026-11-14', pack.id)).toBeNull();
    expect(findDailyCard('2026-11-14', 'lc-nope')).toBeNull();
  });

  it('answers clues and scores with the engine (sceneOf, costOfLife, scoreGuess)', () => {
    for (const card of dailySet('2026-11-14')) {
      const area = getArea(card.zip);
      for (const clue of CLUE_IDS) expect(clueReveal(card, clue)).toEqual(sceneOf(card, area).clues[clue]);
      const cost = costOfLife(card, area);
      expect(scorerFor(card, 3_100)(['garage', 'kitchen'])).toEqual({ cost, result: scoreGuess(3_100, cost, 2), card });
      expect(scorerFor(card, 3_100)([]).result).toEqual(scoreGuess(3_100, cost, 0));
    }
  });
});
