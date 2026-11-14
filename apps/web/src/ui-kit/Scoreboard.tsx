import type { ReactNode } from 'react';
import { cx } from './cx';

export type ScoreboardItem = {
  id: string;
  value: ReactNode;
  label: ReactNode;
  /** Value color: default white, primary (orange) or positive (green). */
  tone?: 'default' | 'primary' | 'positive';
};

const TONE = { default: 'text-on-primary', primary: 'text-primary', positive: 'text-positive' } as const;

export type ScoreboardProps = {
  items: ScoreboardItem[];
  /** Accessible name of the group (e.g. "Your score today"). */
  label: string;
  className?: string;
};

/** The black score bar from the Figma screens: big numbers with small labels, in a row (wraps on phones). */
export function Scoreboard({ items, label, className }: ScoreboardProps) {
  return (
    <dl
      aria-label={label}
      className={cx(
        'grid grid-cols-2 gap-x-xl gap-y-lg rounded-xl bg-ink px-xl py-lg sm:grid-cols-4 sm:px-2xl',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.id} className="flex min-w-0 flex-col-reverse gap-xs">
          <dt className="text-sm text-on-primary/60">{it.label}</dt>
          <dd className={cx('font-display text-3xl font-extrabold leading-tight tabular-nums sm:text-4xl', TONE[it.tone ?? 'default'])}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
