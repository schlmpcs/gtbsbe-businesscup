// Server-only: the share card PNG of one stored result (GET /api/share), 9:16 for stories and
// clips, 1:1 for feeds. Every number on it comes from what the store holds, never from the
// request, so a share card cannot be faked. There are two kinds of stored result behind the same
// 32-hex resultId format:
// - a slider guess (store.game): the reveal the player got and the amount the server scored;
// - a duel day (store.duel): the picks the server scored, one per round.
//
// shareCardModel() and duelShareCardModel() are the pure part (what the card says, formatted);
// renderShareCard() lays either one out with next/og (Satori + resvg, Node runtime). Both cards
// share the frame (brand and date on top, the call to action and the disclaimer at the bottom) and
// differ only in the white panel in the middle.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DUEL_ROUND_COUNT, guessMaxPoints } from '@lifeguessr/engine';
import type { DuelRound } from '@lifeguessr/types';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { duel as duelCopy, game as gameCopy } from '@/copy';
import { directionOf, tileColor } from '@/features/game/model/derive';
import { duelTileColor } from '@/features/game/model/duelDerive';
import type { DuelTileColor, RevealVM, ShareTileColor } from '@/features/game/model/types';
import { formatMoney } from '@/lib/format';
import type { StoredPick } from '@/server/store/duel';
import type { StoredResult } from '@/server/store/game';

export type ShareFormat = '9x16' | '1x1';

export const SHARE_SIZES = {
  '9x16': { width: 1080, height: 1920 },
  '1x1': { width: 1080, height: 1080 },
} as const satisfies Record<ShareFormat, { width: number; height: number }>;

const FORMAT_ALIASES: Record<string, ShareFormat> = {
  '9x16': '9x16', '9:16': '9x16', story: '9x16',
  '1x1': '1x1', '1:1': '1x1', square: '1x1',
};

/** `format` from the query: 9x16 (default), 1x1, or their aliases (9:16, story, 1:1, square). */
export function parseShareFormat(raw: string | null): ShareFormat | null {
  if (raw === null || raw === '') return '9x16';
  return FORMAT_ALIASES[raw.toLowerCase()] ?? null;
}

/**
 * Dollhouse colors, the same values as tokens.json (a test keeps them equal). Satori needs plain
 * colors; it cannot read the CSS variables the app uses.
 */
export const SHARE_COLORS = {
  bg: '#f4f1eb',
  surface: '#ffffff',
  border: '#e6e0d6',
  text: '#1d1b18',
  textMuted: '#7c766c',
  primary: '#ff5b2e',
  positive: '#1fa866',
  warning: '#f2b233',
  negative: '#d63a24',
  ink: '#1d1b18',
} as const;

/** The verdict pill: the share grid's tile color, with text that stays readable on it. */
const TILE_COLORS: Record<ShareTileColor, { bg: string; text: string }> = {
  green: { bg: SHARE_COLORS.positive, text: SHARE_COLORS.surface },
  yellow: { bg: SHARE_COLORS.warning, text: SHARE_COLORS.text },
  red: { bg: SHARE_COLORS.negative, text: SHARE_COLORS.surface },
};

export type ShareCardModel = {
  kind: 'slider';
  format: ShareFormat;
  width: number;
  height: number;
  brand: string;
  dateLine: string;
  metro: string;
  caption: string;
  guessLabel: string;
  guess: string;
  actualLabel: string;
  actual: string;
  perMonth: string;
  range: string;
  direction: RevealVM['direction'];
  verdict: string;
  tile: ShareTileColor;
  tileColor: string;
  tileTextColor: string;
  points: string;
  clues: string;
  cta: string;
  disclaimer: string;
};

const longDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** 'YYYY-MM-DD' → "Nov 14, 2026". */
export function formatPlayDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return longDate.format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/** What the card says, from the stored result only. */
export function shareCardModel(stored: StoredResult, format: ShareFormat): ShareCardModel {
  const t = gameCopy.shareCard;
  const { reveal, guess } = stored;
  const { total } = reveal.cost;
  const direction = directionOf(guess, total);
  const tile = tileColor(reveal);
  return {
    kind: 'slider',
    format,
    ...SHARE_SIZES[format],
    brand: t.brand,
    dateLine: t.daily(formatPlayDate(stored.date)),
    metro: reveal.card.metro,
    caption: reveal.card.caption,
    guessLabel: t.guessLabel,
    guess: formatMoney(guess),
    actualLabel: t.actualLabel,
    actual: formatMoney(total.mid),
    perMonth: t.perMonth,
    range: t.range(formatMoney(total.low), formatMoney(total.high)),
    direction,
    verdict: t.verdict[direction],
    tile,
    tileColor: TILE_COLORS[tile].bg,
    tileTextColor: TILE_COLORS[tile].text,
    points: t.points(reveal.result.points.toLocaleString('en-US'), guessMaxPoints.value.toLocaleString('en-US')),
    clues: t.clues(reveal.cluesOpened.length),
    cta: t.cta,
    disclaimer: t.disclaimer,
  };
}

/** The duel grid's tiles in the app's colors (DuelSummary uses bg-positive, bg-warning, bg-ink). */
const DUEL_TILE_FILL: Record<DuelTileColor, string> = {
  green: SHARE_COLORS.positive,
  yellow: SHARE_COLORS.warning,
  ink: SHARE_COLORS.ink,
};

/** A duel day as the store hands it back (store.duel.findDuelDay). */
export type StoredDuelDayResult = { date: string; picks: StoredPick[] };

export type DuelShareCardModel = {
  kind: 'duel';
  format: ShareFormat;
  width: number;
  height: number;
  brand: string;
  dateLine: string;
  title: string;
  /** "4 of 5": right picks out of the rounds played. */
  score: string;
  scoreLabel: string;
  points: string;
  /** "3 of 5 rounds played so far" while the day is still being played, null once all five are in. */
  played: string | null;
  /** One tile per played round, in round order. */
  tiles: { round: DuelRound; color: DuelTileColor; fill: string }[];
  legend: string;
  cta: string;
  disclaimer: string;
  /** Every round is picked, so the card can never change again (the route caches it for a year). */
  complete: boolean;
};

/**
 * What the duel card says, from the stored picks only. Each pick already carries the server's
 * verdict (`correct`) and points, so nothing is re-scored here, and the card deliberately leaves out
 * everything else a pick holds (the totals, the breakdown, which life was chosen, the lesson): the
 * image is meant to be posted, and like the emoji grid it should spoil nothing about today's five
 * and say nothing about the player beyond the score.
 *
 * A day that is still being played shows only the rounds picked so far: "2 of 3", three tiles, and
 * a line saying how many of the five are in.
 */
export function duelShareCardModel(day: StoredDuelDayResult, format: ShareFormat): DuelShareCardModel {
  const t = duelCopy;
  // The stores already sort by round; sorting again keeps the grid right whatever a store does.
  const picks = [...day.picks].sort((a, b) => a.round - b.round);
  const right = picks.filter((p) => p.scored.correct).length;
  const points = picks.reduce((sum, p) => sum + p.scored.points, 0);
  const complete = picks.length >= DUEL_ROUND_COUNT;
  return {
    kind: 'duel',
    format,
    ...SHARE_SIZES[format],
    brand: t.shareCard.brand,
    dateLine: t.shareCard.daily(formatPlayDate(day.date)),
    title: t.title,
    score: t.summary.score(right, picks.length),
    scoreLabel: t.summary.scoreLabel,
    points: t.summary.points(Math.round(points).toLocaleString('en-US')),
    played: complete ? null : t.shareCard.played(picks.length, DUEL_ROUND_COUNT),
    tiles: picks.map((p) => {
      const color = duelTileColor(p.scored);
      return { round: p.round, color, fill: DUEL_TILE_FILL[color] };
    }),
    legend: t.summary.legend,
    cta: t.shareCard.cta,
    disclaimer: t.reveal.disclaimer,
    complete,
  };
}

// ----- fonts ----------------------------------------------------------------------------------

type Font = { name: string; data: ArrayBuffer; weight: 400 | 800; style: 'normal' };

/** Bricolage Grotesque (the app's display face) from @fontsource; Satori reads WOFF, not WOFF2. */
const FONT_FILES = [
  { weight: 400, file: 'bricolage-grotesque-latin-400-normal.woff' },
  { weight: 800, file: 'bricolage-grotesque-latin-800-normal.woff' },
] as const;

/** Where the files sit relative to the app (next.config.ts traces them into the standalone build). */
export const FONT_DIR = 'node_modules/@fontsource/bricolage-grotesque/files';

/**
 * The app's directory: the working directory for `next dev`, `next start` and the standalone
 * server (which changes into its own folder); the repository root for tests run from there.
 */
const APP_DIRS = () => [process.cwd(), path.join(process.cwd(), 'apps/web')];

async function readFont(file: string): Promise<Buffer> {
  let lastError: unknown;
  for (const dir of APP_DIRS()) {
    try {
      return await readFile(path.join(dir, FONT_DIR, file));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

let fonts: Promise<Font[]> | null = null;

/** The brand fonts, read once. Without them the card still renders in next/og's built-in font. */
export function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    FONT_FILES.map(async ({ weight, file }) => {
      const buf = await readFont(file);
      return {
        name: 'Bricolage Grotesque',
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        weight,
        style: 'normal' as const,
      };
    }),
  ).catch((err: unknown) => {
    console.warn(`[share] brand font unavailable, using the default font: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  });
  return fonts;
}

// ----- layout ---------------------------------------------------------------------------------

/** Both formats use one layout; the square card is the story card scaled down. */
function scaleFor(format: ShareFormat) {
  const story = format === '9x16';
  const s = story ? 1 : 0.78;
  return { story, px: (n: number) => Math.round(n * s) };
}

type FrameProps = Pick<ShareCardModel, 'format' | 'brand' | 'dateLine' | 'cta' | 'disclaimer'> & { children: ReactNode };

/** What every share card has: brand and date on top, the white panel, the call to action below. */
function Frame({ format, brand, dateLine, cta, disclaimer, children }: FrameProps) {
  const { story, px } = scaleFor(format);
  const c = SHARE_COLORS;
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: c.bg, color: c.text, padding: px(story ? 88 : 72), fontFamily: 'Bricolage Grotesque',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: px(76), fontWeight: 800, color: c.primary, letterSpacing: -1 }}>{brand}</div>
        <div style={{ display: 'flex', fontSize: px(36), color: c.textMuted, marginTop: px(8) }}>{dateLine}</div>
      </div>

      <div
        style={{
          display: 'flex', flexDirection: 'column', background: c.surface, border: `${px(3)}px solid ${c.border}`,
          borderRadius: px(48), padding: px(story ? 64 : 52),
        }}
      >
        {children}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: px(40), fontWeight: 800 }}>{cta}</div>
        <div style={{ display: 'flex', fontSize: px(28), color: c.textMuted, marginTop: px(12) }}>{disclaimer}</div>
      </div>
    </div>
  );
}

function SliderCard({ m }: { m: ShareCardModel }) {
  const { story, px } = scaleFor(m.format);
  const c = SHARE_COLORS;
  return (
    <Frame {...m}>
      <div style={{ display: 'flex', fontSize: px(38), color: c.textMuted }}>{m.metro}</div>
      <div style={{ display: 'flex', fontSize: px(story ? 52 : 46), lineHeight: 1.2, marginTop: px(12) }}>{m.caption}</div>

      {/* The story card stacks the two amounts (room for five-digit months); the square sets them side by side. */}
      <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', marginTop: px(story ? 56 : 40), gap: px(story ? 32 : 40) }}>
        {[
          { label: m.guessLabel, value: m.guess },
          { label: m.actualLabel, value: m.actual },
        ].map((col) => (
          <div key={col.label} style={{ display: 'flex', flexDirection: 'column', ...(!story && { flex: 1 }) }}>
            <div style={{ display: 'flex', fontSize: px(34), color: c.textMuted }}>{col.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: px(4) }}>
              <span style={{ fontSize: px(story ? 112 : 92), fontWeight: 800, letterSpacing: -2 }}>{col.value}</span>
              <span style={{ fontSize: px(36), color: c.textMuted, marginLeft: px(8) }}>{m.perMonth}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: px(34), color: c.textMuted, marginTop: px(16) }}>{m.range}</div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: px(story ? 56 : 40), gap: px(24) }}>
        <div
          style={{
            display: 'flex', background: m.tileColor, color: m.tileTextColor, fontSize: px(36), fontWeight: 800,
            borderRadius: px(999), padding: `${px(14)}px ${px(32)}px`,
          }}
        >
          {m.verdict}
        </div>
        <div style={{ display: 'flex', fontSize: px(34), color: c.textMuted }}>{m.clues}</div>
      </div>
      <div style={{ display: 'flex', fontSize: px(story ? 80 : 68), fontWeight: 800, marginTop: px(24) }}>{m.points}</div>
    </Frame>
  );
}

/**
 * The duel's panel: the question, the score as big as the app's day result shows it, the points,
 * and the grid. Tiles are sized so five of them fill the panel's width in both formats.
 */
function DuelCard({ m }: { m: DuelShareCardModel }) {
  const { story, px } = scaleFor(m.format);
  const c = SHARE_COLORS;
  // Five 132px tiles with 24px gaps (756px) fill the story panel's 770px inner width; the square
  // card scales both down with everything else.
  const tile = px(132);
  return (
    <Frame {...m}>
      <div style={{ display: 'flex', fontSize: px(story ? 64 : 50), fontWeight: 800, lineHeight: 1.15 }}>{m.title}</div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(story ? 72 : 28) }}>
        <div style={{ display: 'flex', fontSize: px(story ? 38 : 34), color: c.textMuted }}>{m.scoreLabel}</div>
        <div style={{ display: 'flex', fontSize: px(story ? 260 : 150), fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{m.score}</div>
        <div style={{ display: 'flex', fontSize: px(story ? 76 : 56), fontWeight: 800, color: c.primary, marginTop: px(story ? 20 : 12) }}>{m.points}</div>
        {m.played && <div style={{ display: 'flex', fontSize: px(story ? 38 : 34), color: c.textMuted, marginTop: px(12) }}>{m.played}</div>}
      </div>

      <div style={{ display: 'flex', gap: px(24), marginTop: px(story ? 80 : 36) }}>
        {m.tiles.map((t) => (
          <div key={t.round} style={{ display: 'flex', width: tile, height: tile, borderRadius: px(28), background: t.fill }} />
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: px(30), color: c.textMuted, marginTop: px(24) }}>{m.legend}</div>
    </Frame>
  );
}

/** The PNG for a model. Callers add caching headers; the bytes depend only on the stored result. */
export async function renderShareCard(
  m: ShareCardModel | DuelShareCardModel,
  headers: Record<string, string> = {},
): Promise<ImageResponse> {
  const loaded = await loadFonts();
  return new ImageResponse(m.kind === 'duel' ? <DuelCard m={m} /> : <SliderCard m={m} />, {
    width: m.width,
    height: m.height,
    ...(loaded.length > 0 && { fonts: loaded }),
    headers,
  });
}
