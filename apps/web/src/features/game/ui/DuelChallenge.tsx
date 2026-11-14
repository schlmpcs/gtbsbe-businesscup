import { useId } from 'react';
import { duel as t } from '@/copy';
import type { ChallengeVM, DuelOutcome, DuelScoreVM, Loadable } from '../model/types';
import { DuelTiles } from './DuelTiles';

const fmt = (n: number) => n.toLocaleString('en-US');

/** The challenge link's `friend` case: its VM, with or without the comparison yet. */
export type FriendChallengeVM = Extract<ChallengeVM, { kind: 'friend' }>;

/**
 * Under the title before and during play: whose score this is. The friend's score once it is read;
 * for an old link, that its day is over; and for a link that could not be read (still loading, an id
 * nobody holds, the server not answering) the generic "a friend challenged you", which is true of
 * all of them. Nothing for your own link: that is your result, not a challenge.
 */
export function DuelChallengeLine({ challenge }: { challenge: Loadable<ChallengeVM | null> }) {
  const data = challenge.status === 'ready' ? challenge.data : null;
  if (data?.kind === 'own') return null;
  const text =
    data?.kind === 'friend'
      ? t.challenge.friendScore(data.friend.right, data.friend.rounds, fmt(data.friend.points))
      : data?.kind === 'earlier'
        ? t.challenge.earlier(data.dateLabel)
        : t.challenge.generic;
  return (
    <p role="status" className="rounded-full bg-primary-soft px-lg py-xs text-sm font-semibold text-primary">
      {text}
    </p>
  );
}

function ScoreRow({ label, score, gridLabel }: { label: string; score: DuelScoreVM; gridLabel: string }) {
  return (
    <li className="flex flex-col gap-xs sm:flex-row sm:items-center sm:gap-lg">
      <p className="font-display text-xl font-extrabold sm:w-[calc(var(--spacing-3xl)*2)]">{label}</p>
      <DuelTiles tiles={score.tiles} label={gridLabel} size="md" />
      <p className="text-sm font-medium text-text-muted">{t.summary.points(fmt(score.points))}</p>
    </li>
  );
}

/**
 * The day result next to a friend's: "You 3/5 · Friend 4/5", who is ahead, and both grids, so the
 * rounds where you split are easy to see. The same colors and the same legend as the single grid.
 */
export function DuelVersus({ friend, you, outcome }: { friend: DuelScoreVM; you: DuelScoreVM; outcome: DuelOutcome }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-lg rounded-xl bg-surface p-xl text-text shadow-md">
      <div className="flex flex-col gap-sm">
        <h3 id={headingId} className="text-sm font-bold uppercase tracking-wide text-primary">
          {t.challenge.heading}
        </h3>
        <p className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {t.challenge.headline(you.right, friend.right, you.rounds)}
        </p>
        <p className="text-lg font-bold">{t.challenge.outcome[outcome]}</p>
      </div>
      <ul className="flex flex-col gap-lg">
        <ScoreRow label={t.challenge.you} score={you} gridLabel={t.summary.gridLabel} />
        <ScoreRow label={t.challenge.friend} score={friend} gridLabel={t.challenge.friendGridLabel} />
      </ul>
      <p aria-hidden="true" className="text-sm text-text-muted">{t.summary.legend}</p>
    </section>
  );
}
