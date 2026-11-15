// A round initials badge for a merchant or bill (no logos: we never fetch brand marks). The tint is
// picked from the name so the same merchant keeps its color. Decorative.
import { cx } from '../cx';

const TINTS = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/20 text-text',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
  'bg-primary-soft text-primary',
] as const;

export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  const [a, b] = words;
  return ((a![0] ?? '') + (b?.[0] ?? a![1] ?? '')).toUpperCase();
}

export function Initials({ name, className, size = 'md' }: { name: string; className?: string; size?: 'sm' | 'md' }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
        TINTS[h % TINTS.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
