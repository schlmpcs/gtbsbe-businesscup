import { useId } from 'react';
import { whatIf as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { ChoiceVM, Letter } from '../model/types';
import { factText } from './facts';

export type ChoiceCardProps = {
  choice: ChoiceVM;
  /** "Change": point the What if… field at this side. Absent = read-only (the hero). */
  onEdit?: () => void;
  compact?: boolean;
  className?: string;
};

export const LETTER_BG: Record<Letter, string> = { A: 'bg-ink', B: 'bg-primary' };
export const LETTER_TEXT: Record<Letter, string> = { A: 'text-ink', B: 'text-primary' };

/** The cream art tile: the art's own cream background melts into it (multiply), so no square edge shows. */
export function ArtTile({ art, className }: { art: string | null; className?: string }) {
  return (
    <div className={cx('relative shrink-0 overflow-hidden rounded-lg bg-surface-strong', className)}>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- static local art, no optimizer needed
        <img
          src={`/art/what-if/${art}.webp`}
          alt=""
          width={640}
          height={640}
          loading="lazy"
          decoding="async"
          className="block size-full object-cover mix-blend-multiply"
        />
      )}
    </div>
  );
}

/** One side of the choice, in the duel's A/B language: letter badge, title, fact chips, Change. */
export function ChoiceCard({ choice, onEdit, compact = false, className }: ChoiceCardProps) {
  const titleId = useId();
  const accent = choice.letter === 'B';
  return (
    <article
      aria-labelledby={titleId}
      data-testid={`choice-${choice.letter}`}
      className={cx(
        'relative flex min-w-0 items-stretch gap-md rounded-xl bg-surface shadow-md',
        compact ? 'p-md' : 'p-md sm:p-lg',
        accent ? 'ring-2 ring-primary' : 'ring-2 ring-ink',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-sm">
        <div className="flex items-center gap-sm">
          <span
            aria-hidden="true"
            className={cx(
              'flex size-2xl shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold text-on-primary',
              LETTER_BG[choice.letter],
            )}
          >
            {choice.letter}
          </span>
          <span className="sr-only">{t.choiceLabel(choice.letter)}: </span>
          {choice.estimate && (
            <span className="rounded-full bg-surface-strong px-sm py-xs text-xs font-semibold text-text-muted">{t.facts.estimate}</span>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t.editLabel(choice.letter)}
              className="ml-auto rounded-full px-sm py-xs text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-focus"
            >
              {t.edit}
            </button>
          )}
        </div>
        <h3 id={titleId} className={cx('font-display font-extrabold leading-tight break-words', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>
          {choice.title}
        </h3>
        <ul className="flex flex-wrap gap-xs">
          {(compact ? choice.facts.slice(0, 2) : choice.facts).map((f, i) => (
            <li
              key={`${f.kind}-${i}`}
              className={cx(
                'rounded-full px-sm py-xs text-xs font-semibold',
                f.kind === 'afford'
                  ? f.verdict === 'fits' ? 'bg-positive-soft text-text' : 'bg-surface-strong text-text-muted'
                  : 'border border-border bg-bg text-text',
              )}
            >
              {factText(f)}
            </li>
          ))}
        </ul>
      </div>
      <ArtTile art={choice.art} className={compact ? 'size-[calc(var(--spacing-3xl)*1.75)] self-center' : 'size-[calc(var(--spacing-3xl)*2)] self-center sm:size-[calc(var(--spacing-3xl)*2.5)]'} />
    </article>
  );
}
