// Game UI tuning (not finance). Scoring constants live in the engine's assumptions.ts.
import type { Money } from '@lifeguessr/types';

/** Homes per daily set. */
export const CARDS_PER_DAY = 5;

/** Guess slider: log scale from $1k to $15k a month (docs/PRODUCT.md → Game design). */
export const GUESS_MIN: Money = 1_000;
export const GUESS_MAX: Money = 15_000;
export const GUESS_STEP: Money = 10;
/** Starting position: the geometric middle of the track (≈ $3,870). */
export const GUESS_DEFAULT: Money = Math.round(Math.sqrt(GUESS_MIN * GUESS_MAX) / GUESS_STEP) * GUESS_STEP;

/** Share grid: yellow tile from this many points (green = in range, red = below). */
export const YELLOW_TILE_MIN_POINTS = 500;

/** Streamer mode: seconds on the countdown before the guess locks in. */
export const STREAMER_COUNTDOWN_SECONDS = 30;
