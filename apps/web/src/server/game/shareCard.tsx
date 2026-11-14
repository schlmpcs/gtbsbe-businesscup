// Server-only: the share card PNG of one stored result (GET /api/share), 9:16 for stories and
// clips, 1:1 for feeds. Every number on it comes from the stored result (the reveal the player got
// and the amount the server scored), never from the request, so a share card cannot be faked.
//
// shareCardModel() is the pure part (what the card says, formatted); renderShareCard() lays it
// out with next/og (Satori + resvg, Node runtime).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { guessMaxPoints } from '@lifeguessr/engine';
import { ImageResponse } from 'next/og';
import { game as gameCopy } from '@/copy';
import { directionOf, tileColor } from '@/features/game/model/derive';
import type { RevealVM, ShareTileColor } from '@/features/game/model/types';
import { formatMoney } from '@/lib/format';
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
} as const;

/** The verdict pill: the share grid's tile color, with text that stays readable on it. */
const TILE_COLORS: Record<ShareTileColor, { bg: string; text: string }> = {
  green: { bg: SHARE_COLORS.positive, text: SHARE_COLORS.surface },
  yellow: { bg: SHARE_COLORS.warning, text: SHARE_COLORS.text },
  red: { bg: SHARE_COLORS.negative, text: SHARE_COLORS.surface },
};

export type ShareCardModel = {
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

function Card({ m }: { m: ShareCardModel }) {
  const story = m.format === '9x16';
  const s = story ? 1 : 0.78; // the square card uses the same layout, smaller
  const px = (n: number) => Math.round(n * s);
  const c = SHARE_COLORS;
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: c.bg, color: c.text, padding: px(story ? 88 : 72), fontFamily: 'Bricolage Grotesque',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: px(76), fontWeight: 800, color: c.primary, letterSpacing: -1 }}>{m.brand}</div>
        <div style={{ display: 'flex', fontSize: px(36), color: c.textMuted, marginTop: px(8) }}>{m.dateLine}</div>
      </div>

      <div
        style={{
          display: 'flex', flexDirection: 'column', background: c.surface, border: `${px(3)}px solid ${c.border}`,
          borderRadius: px(48), padding: px(story ? 64 : 52),
        }}
      >
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: px(40), fontWeight: 800 }}>{m.cta}</div>
        <div style={{ display: 'flex', fontSize: px(28), color: c.textMuted, marginTop: px(12) }}>{m.disclaimer}</div>
      </div>
    </div>
  );
}

/** The PNG for a model. Callers add caching headers; the bytes depend only on the stored result. */
export async function renderShareCard(m: ShareCardModel, headers: Record<string, string> = {}): Promise<ImageResponse> {
  const loaded = await loadFonts();
  return new ImageResponse(<Card m={m} />, {
    width: m.width,
    height: m.height,
    ...(loaded.length > 0 && { fonts: loaded }),
    headers,
  });
}
