import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { costOfLife, guessMaxPoints, scoreGuess } from '@lifeguessr/engine';
import { DUEL_ROUNDS, type ClueId, type DuelLetter, type DuelRound, type GuessReveal } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { dayNumber } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import type { StoredPick } from '@/server/store/duel';
import type { StoredResult } from '@/server/store/game';
import { duelScorer, findDuelPair } from './duel';
import {
  duelShareCardModel, formatPlayDate, loadFonts, parseShareFormat, renderShareCard, SHARE_COLORS, SHARE_SIZES,
  shareCardModel, type DuelShareCardModel, type ShareCardModel,
} from './shareCard';

const card = dailyCards(dayNumber('2026-11-14'))[2]!;
const cost = costOfLife(card, getArea(card.zip));

function stored(guess: number, clues: ClueId[] = []): StoredResult {
  const reveal: GuessReveal = { resultId: 'a'.repeat(32), cost, result: scoreGuess(guess, cost, clues.length), card, cluesOpened: clues };
  return { resultId: reveal.resultId, date: '2026-11-14', cardId: card.id, guess, reveal, createdAt: '2026-11-14T17:00:00.000Z' };
}

/**
 * A stored duel pick, scored by the server's own scorer for that day's real pair: `right` picks
 * the costlier life, `hints` is what the store recorded before the pick.
 */
function storedPick(round: DuelRound, right: boolean, hints = 0): StoredPick {
  const pair = findDuelPair('2026-11-14', round)!;
  const costlier: DuelLetter = duelScorer(pair, 'A')(0).correct ? 'A' : 'B';
  const choice: DuelLetter = right ? costlier : costlier === 'A' ? 'B' : 'A';
  return { round, choice, hints, scored: duelScorer(pair, choice)(hints) };
}

/** Width and height from a PNG's IHDR chunk. */
async function pngSize(card: ShareCardModel | DuelShareCardModel): Promise<{ bytes: Uint8Array; size: number[] }> {
  const res = await renderShareCard(card);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(bytes.buffer);
  return { bytes, size: [view.getUint32(16), view.getUint32(20)] };
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
      warning: token('warning'), negative: token('negative'), ink: token('ink'),
    });
  });
});

describe('duelShareCardModel: the card’s inputs come from the stored picks only', () => {
  // Round 1 right with a hint (yellow), 2 and 3 right (green), 4 missed (ink), 5 right (green).
  const finished = (): StoredPick[] => [
    storedPick(1, true, 1), storedPick(2, true), storedPick(3, true), storedPick(4, false), storedPick(5, true),
  ];

  it('a finished day: "4 of 5", the summed points and five tiles in round order', () => {
    // Handed over out of order: the card still reads round 1 → 5.
    const picks = finished();
    const m = duelShareCardModel({ date: '2026-11-14', picks: [picks[3]!, picks[0]!, picks[4]!, picks[2]!, picks[1]!] }, '9x16');
    expect(m).toMatchObject({
      kind: 'duel', format: '9x16', width: 1080, height: 1920, complete: true, played: null,
      brand: 'LifeGuessr', title: 'Which life costs more?', dateLine: 'Daily duel · Nov 14, 2026',
      score: '4 of 5', scoreLabel: 'Right picks', points: '3,900 points',
    });
    expect(m.tiles.map((x) => x.round)).toEqual(DUEL_ROUNDS);
    expect(m.tiles.map((x) => x.color)).toEqual(['yellow', 'green', 'green', 'ink', 'green']);
    expect(m.tiles.map((x) => x.fill)).toEqual([
      SHARE_COLORS.warning, SHARE_COLORS.positive, SHARE_COLORS.positive, SHARE_COLORS.ink, SHARE_COLORS.positive,
    ]);
  });

  it('a partial day: only its played rounds, and a line saying how many are in', () => {
    const m = duelShareCardModel({ date: '2026-11-14', picks: [storedPick(1, true), storedPick(2, false), storedPick(3, true, 1)] }, '1x1');
    expect(m).toMatchObject({
      format: '1x1', width: 1080, height: 1080, complete: false,
      score: '2 of 3', points: '1,900 points', played: '3 of 5 rounds played so far',
    });
    expect(m.tiles.map((x) => [x.round, x.color])).toEqual([[1, 'green'], [2, 'ink'], [3, 'yellow']]);
  });

  it('says nothing about amounts, choices, lives or the player', () => {
    const picks = finished();
    const text = JSON.stringify(duelShareCardModel({ date: '2026-11-14', picks }, '9x16'));
    for (const p of picks) {
      for (const total of Object.values(p.scored.totals)) {
        expect(text).not.toContain(formatMoney(total));
        expect(text).not.toContain(String(Math.round(total)));
      }
      expect(text).not.toContain(p.scored.lesson);
      expect(text).not.toContain(p.scored.decidedBy.category);
      const pair = findDuelPair('2026-11-14', p.round)!;
      for (const card of [pair.A, pair.B]) {
        expect(text).not.toContain(card.metro);
        expect(text).not.toContain(card.id);
      }
    }
    expect(text).not.toMatch(/"choice"|Life [AB]/);
  });
});

describe('renderShareCard', () => {
  it('loads the brand font and renders both formats as PNGs', async () => {
    expect((await loadFonts()).map((f) => f.weight)).toEqual([400, 800]);
    for (const format of ['9x16', '1x1'] as const) {
      const { bytes, size } = await pngSize(shareCardModel(stored(3_000, ['garage']), format));
      expect(size).toEqual([SHARE_SIZES[format].width, SHARE_SIZES[format].height]);
      if (process.env.SHARE_CARD_OUT) writeFileSync(path.join(process.env.SHARE_CARD_OUT, `share-${format}.png`), bytes);
    }
  });

  it('renders a duel day (finished and partial) in both formats as PNGs', async () => {
    const days = {
      finished: [storedPick(1, true, 1), storedPick(2, true), storedPick(3, true), storedPick(4, false), storedPick(5, true)],
      partial: [storedPick(1, true), storedPick(2, false)],
    };
    for (const [name, picks] of Object.entries(days)) {
      for (const format of ['9x16', '1x1'] as const) {
        const { bytes, size } = await pngSize(duelShareCardModel({ date: '2026-11-14', picks }, format));
        expect(size).toEqual([SHARE_SIZES[format].width, SHARE_SIZES[format].height]);
        expect(bytes.byteLength).toBeGreaterThan(10_000); // a real card, not an empty frame
        if (process.env.SHARE_CARD_OUT) writeFileSync(path.join(process.env.SHARE_CARD_OUT, `share-duel-${name}-${format}.png`), bytes);
      }
    }
  });
});
