import { duel as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { DuelDotVM } from '../model/types';

const DOT: Record<DuelDotVM['state'], string> = {
  current: 'w-xl bg-primary',
  upcoming: 'bg-surface-strong',
  green: 'bg-positive',
  yellow: 'bg-warning',
  ink: 'bg-ink',
};

/** Five round dots: done rounds in their result color, the current one long and orange. */
export function RoundDots({ dots }: { dots: readonly DuelDotVM[] }) {
  return (
    <ol aria-label={t.roundDots.label} className="flex items-center gap-sm">
      {dots.map((d) => (
        <li key={d.round} className={cx('h-sm min-w-sm rounded-full transition-all', DOT[d.state])}>
          <span className="sr-only">{t.roundDots.dot(d.round, t.roundDots.state[d.state])}</span>
        </li>
      ))}
    </ol>
  );
}
