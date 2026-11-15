// Chart tones of the report screens (Cash flow, Budget, Recurring, Goals, Accounts, Transactions): one
// name per token color, with the literal Tailwind classes (so the scanner sees them). Colors only.
import type { StatementClass } from '@lifeguessr/types';
export type ChartTone = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'positive' | 'negative' | 'warning' | 'primary' | 'ink' | 'muted';

export const TONE_BG: Record<ChartTone, string> = {
  c1: 'bg-chart-1', c2: 'bg-chart-2', c3: 'bg-chart-3', c4: 'bg-chart-4', c5: 'bg-chart-5', c6: 'bg-chart-6',
  positive: 'bg-positive', negative: 'bg-negative', warning: 'bg-warning', primary: 'bg-primary', ink: 'bg-ink', muted: 'bg-surface-strong',
};
export const TONE_FILL: Record<ChartTone, string> = {
  c1: 'fill-chart-1', c2: 'fill-chart-2', c3: 'fill-chart-3', c4: 'fill-chart-4', c5: 'fill-chart-5', c6: 'fill-chart-6',
  positive: 'fill-positive', negative: 'fill-negative', warning: 'fill-warning', primary: 'fill-primary', ink: 'fill-ink', muted: 'fill-surface-strong',
};
export const TONE_STROKE: Record<ChartTone, string> = {
  c1: 'stroke-chart-1', c2: 'stroke-chart-2', c3: 'stroke-chart-3', c4: 'stroke-chart-4', c5: 'stroke-chart-5', c6: 'stroke-chart-6',
  positive: 'stroke-positive', negative: 'stroke-negative', warning: 'stroke-warning', primary: 'stroke-primary', ink: 'stroke-ink', muted: 'stroke-surface-strong',
};
export const TONE_TEXT: Record<ChartTone, string> = {
  c1: 'text-chart-1', c2: 'text-chart-2', c3: 'text-chart-3', c4: 'text-chart-4', c5: 'text-chart-5', c6: 'text-chart-6',
  positive: 'text-positive', negative: 'text-negative', warning: 'text-warning', primary: 'text-primary', ink: 'text-ink', muted: 'text-text-muted',
};

/** A cycle of distinct categorical tones (for lists whose items have no fixed color). */
export const CYCLE: readonly ChartTone[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

/**
 * Motion classes, all CSS: elements start from their @starting-style on first paint and transition to
 * their final state; with prefers-reduced-motion they render final at once. Never blocks input.
 */
export const MOTION = {
  /** A horizontal bar that grows from its left edge. */
  growX: 'origin-left transition-transform duration-700 ease-out starting:scale-x-0 motion-reduce:transition-none',
  /** An SVG bar that grows up from its base. */
  growY: 'origin-bottom [transform-box:fill-box] transition-transform duration-700 ease-out starting:scale-y-0 motion-reduce:transition-none',
  /** Fade in (Sankey ribbons, chips). */
  fade: 'transition-opacity duration-700 ease-out starting:opacity-0 motion-reduce:transition-none',
  /** An SVG stroke drawn along its length; give the path pathLength={1}. */
  draw: '[stroke-dasharray:1] [stroke-dashoffset:0] transition-[stroke-dashoffset] duration-1000 ease-out starting:[stroke-dashoffset:1] motion-reduce:transition-none',
  /** A card or section rising into place. */
  rise: 'transition-[opacity,translate] duration-500 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none',
} as const;

/**
 * One color per statement class, by budget group (essentials blue, lifestyle pink, debt purple; pay
 * green, transfers grey), so a category chip, a Sankey band and a donut slice agree on every screen.
 */
export const CLASS_TONE: Record<StatementClass, ChartTone> = {
  rentUtilities: 'c1', groceries: 'c1', car: 'c1', childcare: 'c1',
  eatingOut: 'c2', subscriptions: 'c2', other: 'c2',
  debtPayments: 'c5',
  pay: 'positive', transfer: 'c6',
};
/** The same colors per budget group. */
export const GROUP_TONE: Record<'essentials' | 'lifestyle' | 'debt', ChartTone> = { essentials: 'c1', lifestyle: 'c2', debt: 'c5' };
