// A progress bar that grows in from the left. `value` is a ratio (1 = full; more than 1 still draws full).
// An optional thin marker (e.g. "where you should be today") sits at `marker` (0..1). Decorative: put the
// numbers next to it as text.
import { cx } from '../cx';
import { MOTION, TONE_BG, type ChartTone } from './tones';

export type MeterProps = {
  value: number;
  tone?: ChartTone;
  marker?: number | null;
  size?: 'sm' | 'md';
  className?: string;
};

export function Meter({ value, tone = 'c1', marker = null, size = 'sm', className }: MeterProps) {
  const width = `${Math.min(100, Math.max(0, value * 100))}%`;
  return (
    <div aria-hidden="true" className={cx('relative w-full overflow-hidden rounded-full bg-surface-strong', size === 'sm' ? 'h-2' : 'h-3', className)}>
      <div className="h-full" style={{ width }}>
        <div className={cx('h-full rounded-full', TONE_BG[tone], MOTION.growX)} />
      </div>
      {marker !== null && marker > 0 && marker < 1 && (
        <div className="absolute inset-y-0 w-0.5 bg-ink/70" style={{ left: `${marker * 100}%` }} />
      )}
    </div>
  );
}
