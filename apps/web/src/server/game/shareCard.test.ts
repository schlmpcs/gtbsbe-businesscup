import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { costOfLife, guessMaxPoints, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, GuessReveal } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { dayNumber } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import type { StoredResult } from '@/server/store/game';
import {
  formatPlayDate, loadFonts, parseShareFormat, renderShareCard, SHARE_COLORS, SHARE_SIZES, shareCardModel,
} from './shareCard';

const card = dailyCards(dayNumber('2026-11-14'))[2]!;
const cost = costOfLife(card, getArea(card.zip));

function stored(guess: number, clues: ClueId[] = []): StoredResult {
  const reveal: GuessReveal = { resultId: 'a'.repeat(32), cost, result: scoreGuess(guess, cost, clues.length), card, cluesOpened: clues };
  return { resultId: reveal.resultId, date: '2026-11-14', cardId: card.id, guess, reveal, createdAt: '2026-11-14T17:00:00.000Z' };
}

describe('parseShareFormat', () => {
  it('reads 9x16 (default) and 1x1 with their aliases, and refuses anything else', () => {
    expect(parseShareFormat(null)).toBe('9x16');
    expect(parseShareFormat('')).toBe('9x16');
    expect(['9x16', '9:16', 'story', 'STORY'].map(parseShareFormat)).toEqual(['9x16', '9x16', '9x16', '9x16']);
    expect(['1x1', '1:1', 'square'].map(parseShareFormat)).toEqual(['1x1', '1x1', '1x1']);
    expect(parseShareFormat('16x9')).toBeNull();
    expect(SHARE_SIZES).toEqual({ '9x16': { width: 1080, height: 1920 }, '1x1': { width: 1080, height: 1080 } });
  });
});

describe('shareCardModel: the card’s inputs come from the stored result only', () => {
  it('shows the stored guess, the reveal’s range and the engine’s points', () => {
    const r = stored(cost.total.mid * 1.5, ['garage', 'kitchen']);
    const m = shareCardModel(r, '1x1');
    expect(m).toMatchObject({ format: '1x1', width: 1080, height: 1080 });
    expect(m.guess).toBe(formatMoney(r.guess));
    expect(m.actual).toBe(formatMoney(cost.total.mid));
    expect(m.range).toContain(formatMoney(cost.total.low));
    expect(m.range).toContain(formatMoney(cost.total.high));
    expect(m.points).toBe(`${r.reveal.result.points.toLocaleString('en-US')} / ${guessMaxPoints.value.toLocaleString('en-US')} points`);
    expect(m.clues).toBe('2 rooms opened');
    expect(m.metro).toBe(card.metro);
    expect(m.caption).toBe(card.caption);
    expect(m.dateLine).toBe('Daily · Nov 14, 2026');
  });

  it('labels the verdict and its color like the reveal and the share grid', () => {
    const inRange = shareCardModel(stored(cost.total.mid), '9x16');
    expect(inRange).toMatchObject({ direction: 'in', verdict: 'In range', tile: 'green', tileColor: SHARE_COLORS.positive });
    expect(inRange.clues).toBe('No rooms opened');
    const low = shareCardModel(stored(cost.total.low / 3), '9x16');
    expect(low).toMatchObject({ direction: 'low', verdict: 'Guessed low', tile: 'red', tileColor: SHARE_COLORS.negative });
    const high = shareCardModel(stored(cost.total.high * 1.05), '9x16');
    expect(high).toMatchObject({ direction: 'high', verdict: 'Guessed high', tile: 'yellow' });
  });

  it('formats play dates without a time-zone shift', () => {
    expect(formatPlayDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatPlayDate('2026-12-31')).toBe('Dec 31, 2026');
  });

  it('uses the Dollhouse colors from tokens.json', () => {
    const tokens = JSON.parse(readFileSync(path.join(__dirname, '../../../../../tokens.json'), 'utf8')) as {
      color: Record<string, { $value: string }>;
    };
    const token = (name: string) => tokens.color[name]!.$value.toLowerCase();
    expect(SHARE_COLORS).toEqual({
      bg: token('bg'), surface: token('surface'), border: token('border'), text: token('text'),
      textMuted: token('text-muted'), primary: token('primary'), positive: token('positive'),
      warning: token('warning'), negative: token('negative'),
    });
  });
});

describe('renderShareCard', () => {
  it('loads the brand font and renders both formats as PNGs', async () => {
    expect((await loadFonts()).map((f) => f.weight)).toEqual([400, 800]);
    for (const format of ['9x16', '1x1'] as const) {
      const res = await renderShareCard(shareCardModel(stored(3_000, ['garage']), format));
      const bytes = new Uint8Array(await res.arrayBuffer());
      const view = new DataView(bytes.buffer);
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([SHARE_SIZES[format].width, SHARE_SIZES[format].height]);
      if (process.env.SHARE_CARD_OUT) writeFileSync(path.join(process.env.SHARE_CARD_OUT, `share-${format}.png`), bytes);
    }
  });
});
