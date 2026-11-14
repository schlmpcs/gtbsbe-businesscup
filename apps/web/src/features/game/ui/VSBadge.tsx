import { duel as t } from '@/copy';
import { cx } from '@/ui-kit';

/** The round ink "VS" badge between the two lives. Decorative: the cards carry the meaning. */
export function VSBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex size-3xl shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold text-on-primary shadow-lg ring-[length:var(--spacing-sm)] ring-bg md:size-[calc(var(--spacing-3xl)*1.75)] md:text-3xl',
        className,
      )}
    >
      {t.vs}
    </span>
  );
}
