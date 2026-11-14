import { useId } from 'react';
import { game as t } from '@/copy';
import { cx, formatRate } from '@/ui-kit';
import type { ClueId, ClueVM, ExploreCardVM } from '../model/types';
import { ClueFacts } from './ClueFacts';

/**
 * Props of the clue panel slot (PlayScreen's `ClueSlot`). The illustrated house (HouseSceneClues,
 * T12) is the default; the static ClueBoard below takes the same props and is the fallback.
 */
export type ClueBoardProps = {
  /** The home being explored: its clue rooms, layout, decor and the clue cost. */
  card: ExploreCardVM;
  onOpenClue: (clue: ClueId) => void;
  /** No more rooms can be opened (the guess is being locked in). */
  disabled?: boolean;
  /** Streamer mode: bigger type and targets. */
  large?: boolean;
};

function ClueRow({ clue, card, onOpenClue, disabled, large }: ClueBoardProps & { clue: ClueVM }) {
  const room = t.clues.rooms[clue.id];
  const rowText = large ? 'text-xl' : 'text-base';

  if (clue.status === 'open') {
    return (
      <div className={cx('flex flex-col gap-xs rounded-md bg-surface px-lg py-md', rowText)}>
        <div className="flex items-baseline justify-between gap-md">
          <span className="font-semibold">{room}</span>
          <span className="text-sm text-text-muted">{t.clues.opened}</span>
        </div>
        <ClueFacts facts={clue.facts} />
      </div>
    );
  }

  const hint =
    clue.status === 'opening'
      ? t.clues.opening
      : disabled
        ? t.clues.lockedHint
        : card.clueCost > 0
          ? t.clues.closedHint(formatRate(card.clueCost))
          : t.clues.closedFreeHint;

  return (
    <div className="flex flex-col gap-xs">
      <button
        type="button"
        onClick={() => onOpenClue(clue.id)}
        disabled={disabled || clue.status === 'opening'}
        aria-busy={clue.status === 'opening' || undefined}
        className={cx(
          'flex w-full items-center justify-between gap-md rounded-md border border-border bg-bg px-lg py-md text-left',
          'transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60',
          rowText,
        )}
      >
        <span className="font-semibold">{room}</span>
        <span className="text-sm text-text-muted">{hint}</span>
      </button>
      {clue.status === 'error' && (
        <p role="alert" className="text-sm font-medium text-negative">
          {room}: {t.errors.clue}
        </p>
      )}
    </div>
  );
}

/** Static clue panel (the cut-order fallback for the house scene): five tap-to-reveal rooms. */
export function ClueBoard(props: ClueBoardProps) {
  const { card, large } = props;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h2 id={headingId} className={cx('font-semibold leading-tight', large ? 'text-2xl' : 'text-lg')}>
          {t.clues.heading}
        </h2>
        <p className="text-sm text-text-muted">{t.clues.intro}</p>
      </div>
      <ul className="flex flex-col gap-sm">
        {card.clues.map((clue) => (
          <li key={clue.id} aria-live="polite">
            <ClueRow clue={clue} {...props} />
          </li>
        ))}
      </ul>
    </section>
  );
}
