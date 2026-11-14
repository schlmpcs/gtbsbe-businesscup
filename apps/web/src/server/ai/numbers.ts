// Server-only: find numbers in free text and match them against known values.
//
// Used by /api/ai/explain to enforce "no new numbers" (every number in the model's sentence must
// be a displayed form of a number we sent it) and by /api/ai/parse to flag parsed values that the
// user's text doesn't state literally, plus percent-instead-of-decimal mistakes.

export type NumberToken = {
  /** The number as written, with K/M/B multipliers applied; a percent stays in percent (6.9). */
  value: number;
  /** Half of the last written digit's place value: "$48K" → 500, "6.9%" → 0.05, "1,235" → 0.5. */
  halfUnit: number;
  percent: boolean;
  raw: string;
};

const MULTIPLIERS: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mn: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9,
};

// 1,234,567.89 | 1234 | 0.069, then an optional K/M/B (no space) or thousand/million/billion,
// then an optional % / percent. A lone "m" needs a word boundary so "12 months" isn't 12 million.
const DIGITS_RE =
  /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:([kKmMbB]|mn|bn)\b|\s?(thousand|million|billion)\b)?(\s?(?:%|percent\b))?/g;

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1e3, million: 1e6,
  billion: 1e9, dozen: 12,
};
// "one" and "zero" are left out on purpose: "one of your debts", "the one that…" are not amounts.
const WORDS_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'gi');

/** Every number written in `text`, with digits or as a number word. */
export function extractNumbers(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  const withoutDigits = text.replace(
    DIGITS_RE,
    (raw: string, int: string, dec: string | undefined, short: string | undefined, long: string | undefined, pct: string | undefined) => {
      const multiplier = MULTIPLIERS[(short ?? long ?? '').toLowerCase()] ?? 1;
      const decimals = dec?.length ?? 0;
      const base = Number(`${int.replaceAll(',', '')}${dec ? `.${dec}` : ''}`);
      tokens.push({
        value: base * multiplier,
        halfUnit: 0.5 * 10 ** -decimals * multiplier,
        percent: pct !== undefined,
        raw: raw.trim(),
      });
      return ' ';
    },
  );
  for (const match of withoutDigits.matchAll(WORDS_RE)) {
    const word = match[1].toLowerCase();
    tokens.push({ value: NUMBER_WORDS[word], halfUnit: 0, percent: false, raw: match[1] });
  }
  return tokens;
}

/**
 * True if the written token is a displayed form of `target`: equal up to the precision it was
 * written with ("$48K" ≈ 48,213; "22.8%" ≈ 22.8), or, for amounts of 100 or more, within 1%
 * ("$48,000" ≈ 48,213, but "$50,000" is not). Signs are ignored ("cuts $500" for −500).
 */
export function tokenMatches(token: NumberToken, target: number): boolean {
  const t = Math.abs(target);
  const diff = Math.abs(token.value - t);
  if (diff <= token.halfUnit + 1e-9 * Math.max(1, t)) return true;
  return t >= 100 && diff <= 0.01 * t;
}

/**
 * The numbers a sentence may use, given the values we sent: each value as is, and each value
 * between −1 and 1 also as a percent (0.228 → 22.8), since rates are decimals.
 */
export function allowedForms(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    out.push(v);
    if (Math.abs(v) <= 1) out.push(v * 100);
  }
  return out;
}

/** Raw strings of the numbers in `text` that don't match any allowed value. */
export function unsupportedNumbers(text: string, allowed: readonly number[]): string[] {
  return extractNumbers(text)
    .filter((token) => !allowed.some((v) => tokenMatches(token, v)))
    .map((token) => token.raw);
}
