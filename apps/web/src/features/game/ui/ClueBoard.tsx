import { useId } from 'react';
import { game as t } from '@/copy';
import { cx, formatRate } from '@/ui-kit';
import type { ClueId, ClueVM, ExploreCardVM } from '../model/types';
import { ClueFacts } from './ClueFacts';

/**
 * Props of the clue panel slot. The static ClueBoard below implements it today; the illustrated
 * <HouseScene> (T12) takes the same props and replaces it behind a flag (PlayScreen's `ClueSlot`).
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

  // Opened room: a black-bordered tile with what the room shows.
  if (clue.status === 'open') {
    return (
      <div className={cx('flex flex-col gap-xs rounded-lg border-2 border-ink bg-surface px-lg py-md shadow-sm', rowText)}>
        <div className="flex items-baseline justify-between gap-md">
          <span className="font-bold">{room}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.clues.opened}</span>
        </div>
        <ClueFacts facts={clue.facts} className="text-sm font-medium" />
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

  // Closed room: the "peek" pill, white with an orange border.
  return (
    <div className="flex flex-col gap-xs">
      <button
        type="button"
        onClick={() => onOpenClue(clue.id)}
        disabled={disabled || clue.status === 'opening'}
        aria-busy={clue.status === 'opening' || undefined}
        className={cx(
          'flex w-full flex-wrap items-baseline justify-between gap-x-md gap-y-xs rounded-full border-2 border-primary bg-surface px-lg py-sm text-left shadow-md',
          'transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60',
          rowText,
        )}
      >
        <span className="font-bold">{room}</span>
        <span className="text-sm font-semibold text-primary">{hint}</span>
      </button>
      {clue.status === 'error' && (
        <p role="alert" className="px-md text-sm font-medium text-negative">
          {room}: {t.errors.clue}
        </p>
      )}
    </div>
  );
}

/** Static clue panel (the cut-order fallback for the house scene): five tap-to-reveal rooms in a framed tile. */
export function ClueBoard(props: ClueBoardProps) {
  const { card, large } = props;
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-xl bg-surface p-md text-text shadow-lg lg:-rotate-1"
    >
      <div className="flex flex-col gap-lg rounded-lg bg-surface-strong p-lg sm:p-xl">
        <div className="flex flex-col gap-xs">
          <h2 id={headingId} className={cx('font-display font-extrabold leading-tight', large ? 'text-4xl' : 'text-2xl')}>
            {t.clues.heading}
          </h2>
          <p className="text-sm text-text-muted">{t.clues.intro}</p>
        </div>
        <ul className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {card.clues.map((clue) => (
            <li key={clue.id} aria-live="polite">
              <ClueRow clue={clue} {...props} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
