import { useId } from 'react';
import { game as t } from '@/copy';
import { cx, formatRate, HouseScene, type HouseSceneRoom } from '@/ui-kit';
import type { ClueVM } from '../model/types';
import type { ClueBoardProps } from './ClueBoard';
import { ClueFacts } from './ClueFacts';

/** The words for one clue room: its name, its state, and what opening it costs. */
function roomOf(clue: ClueVM, card: ClueBoardProps['card'], disabled: boolean): HouseSceneRoom {
  const cost = formatRate(card.clueCost);
  const hint =
    clue.status === 'open'
      ? t.clues.opened
      : clue.status === 'opening'
        ? t.clues.opening
        : disabled
          ? t.clues.lockedHint
          : card.clueCost > 0
            ? t.clues.closedHint(cost)
            : t.clues.closedFreeHint;
  return {
    id: clue.id,
    label: t.clues.rooms[clue.id],
    status: clue.status,
    badge: clue.status === 'error' ? t.scene.errorBadge : card.clueCost > 0 ? t.scene.costBadge(cost) : t.scene.freeBadge,
    hint,
    props: clue.reveal?.props ?? [],
    details: clue.facts.length > 0 ? <ClueFacts facts={clue.facts} /> : undefined,
    error: clue.status === 'error' ? t.errors.clue : undefined,
  };
}

/**
 * The clue panel as the illustrated house (T12): the same slot props as the static ClueBoard,
 * drawn with the ui-kit <HouseScene>. Every room's props and facts come from the view-model.
 */
export function HouseSceneClues({ card, onOpenClue, disabled = false, large = false }: ClueBoardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h2 id={headingId} className={cx('font-semibold leading-tight', large ? 'text-2xl' : 'text-lg')}>
          {t.clues.heading}
        </h2>
        <p className="text-sm text-text-muted">{t.clues.intro}</p>
      </div>
      <HouseScene
        // A new home starts with the whole house in view.
        key={card.id}
        layout={card.layout}
        layoutLabel={t.home.layouts[card.layout]}
        decor={card.decor}
        rooms={card.clues.map((clue) => roomOf(clue, card, disabled))}
        onOpenRoom={onOpenClue}
        spriteLabel={t.scene.sprite}
        disabled={disabled}
        large={large}
        note={t.scene.placeholderArt}
      />
    </section>
  );
}
