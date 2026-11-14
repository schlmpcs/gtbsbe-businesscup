import { duel as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { DuelDotVM } from '../model/types';

const DOT: Record<DuelDotVM['state'], string> = {
  current: 'bg-primary',
  upcoming: 'bg-border',
  green: 'bg-positive',
  yellow: 'bg-warning',
  ink: 'bg-ink',
};

/** Five round segments: done rounds in their result color, the current one orange. */
export function RoundDots({ dots }: { dots: readonly DuelDotVM[] }) {
  return (
    <ol aria-label={t.roundDots.label} className="flex items-center gap-sm">
      {dots.map((d) => (
        <li key={d.round} className={cx('h-xs w-[calc(var(--spacing-2xl)*1.4)] rounded-full transition-colors', DOT[d.state])}>
          <span className="sr-only">{t.roundDots.dot(d.round, t.roundDots.state[d.state])}</span>
        </li>
      ))}
    </ol>
  );
}
