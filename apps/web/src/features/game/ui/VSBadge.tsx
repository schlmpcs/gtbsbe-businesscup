import { duel as t } from '@/copy';
import { cx } from '@/ui-kit';

/** The dark "VS" circle between the two lives. Decorative: the cards carry the meaning. */
export function VSBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex size-3xl shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-on-primary shadow-lg ring-4 ring-bg',
        className,
      )}
    >
      {t.vs}
    </span>
  );
}
