// @vitest-environment jsdom
// A challenge link on the duel screen: what the link says (buildDuelChallenge, who is ahead) and how
// it reads (the line under the title, and the day result's comparison with both grids).
import type { PickResult } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import type { DuelChallenge, DuelProgress } from './model/duelClient';
import { buildDuelChallenge, challengeDateLabel, duelOutcome } from './model/duelDerive';
import type { ChallengeVM, DuelScoreVM, DuelSummaryVM, DuelTileColor, Loadable } from './model/types';
import { DuelChallengeLine } from './ui/DuelChallenge';
import { DuelSummary } from './ui/DuelSummary';

const DATE = '2026-11-14';
const FRIEND_ID = 'f'.repeat(32);
const OWN_ID = '0123456789abcdef0123456789abcdef';

const score = (right: number, points: number, colors: DuelTileColor[], rounds = 5): DuelScoreVM => ({
  right, rounds, points, tiles: colors.map((color, i) => ({ round: (i + 1) as 1 | 2 | 3 | 4 | 5, color })),
});

const friendDay = (over: Partial<DuelChallenge> = {}): DuelChallenge => ({
  date: DATE, rounds: 5, played: 5, right: 4, points: 3_900, tiles: ['yellow', 'green', 'green', 'green', 'ink'], today: true, ...over,
});

const summaryOf = (right: number, totalPoints: number, colors: DuelTileColor[]): DuelSummaryVM => ({
  right,
  rounds: 5,
  totalPoints,
  maxPoints: 5_000,
  tiles: score(right, totalPoints, colors).tiles,
  blindSpot: null,
  challengeUrl: `https://lifeguessr.test/duel?c=${OWN_ID}`,
  shareText: '',
  shareImage: null,
  nextIn: { hours: 12, minutes: 0 },
});
const YOURS = summaryOf(3, 2_900, ['yellow', 'green', 'green', 'ink', 'ink']);

/** What this player did today: one stored pick carries the day's result id. */
const picksWith = (resultId: string): DuelProgress['picks'] => ({
  1: { choice: 'A', result: { resultId } as PickResult },
});

const ctx = (over: Partial<Parameters<typeof buildDuelChallenge>[1]> = {}) => ({
  challengeId: FRIEND_ID, date: DATE, picks: picksWith(OWN_ID), summary: null, ...over,
});

describe('duelOutcome', () => {
  it('more right picks win, then more points, and the same on both is a tie', () => {
    const a = score(3, 2_900, []);
    expect(duelOutcome(a, score(4, 3_900, []))).toBe('behind');
    expect(duelOutcome(score(4, 3_900, []), a)).toBe('ahead');
    // Equal right picks: the player with fewer hints (more points) is ahead.
    expect(duelOutcome(score(4, 3_900, []), score(4, 3_800, []))).toBe('ahead');
    expect(duelOutcome(score(4, 3_800, []), score(4, 3_900, []))).toBe('behind');
    expect(duelOutcome(score(4, 3_900, []), score(4, 3_900, []))).toBe('tied');
    // Right picks outrank points: 3 right with no hints still trails 4 right with two hints.
    expect(duelOutcome(score(3, 3_000, []), score(4, 3_800, []))).toBe('behind');
  });
});

describe('challengeDateLabel', () => {
  it('writes a play date as month and day, with no day shift from the time zone', () => {
    expect(challengeDateLabel('2026-11-14')).toBe('Nov 14');
    expect(challengeDateLabel('2026-01-01')).toBe('Jan 1');
    expect(challengeDateLabel('2026-12-31')).toBe('Dec 31');
  });
});

describe('buildDuelChallenge', () => {
  it('is the friend’s score before play: one tile per round in order, no comparison yet', () => {
    expect(buildDuelChallenge(friendDay(), ctx({ picks: {} }))).toEqual({
      kind: 'friend',
      friend: score(4, 3_900, ['yellow', 'green', 'green', 'green', 'ink']),
      comparison: null,
    });
  });

  it('sets your day next to the friend’s once all five are picked', () => {
    const vm = buildDuelChallenge(friendDay(), ctx({ summary: YOURS }));
    expect(vm).toEqual({
      kind: 'friend',
      friend: score(4, 3_900, ['yellow', 'green', 'green', 'green', 'ink']),
      comparison: { you: score(3, 2_900, ['yellow', 'green', 'green', 'ink', 'ink']), outcome: 'behind' },
    });
  });

  it('is your own link when one of today’s results carries the id, whatever the source says about it', () => {
    const own = ctx({ challengeId: OWN_ID });
    expect(buildDuelChallenge(friendDay(), own)).toEqual({ kind: 'own' });
    expect(buildDuelChallenge(null, own)).toEqual({ kind: 'own' });
    expect(buildDuelChallenge(friendDay({ today: false, date: '2026-11-13' }), own)).toEqual({ kind: 'own' });
  });

  it('is an earlier day when the source says so, or when it is not the day on screen', () => {
    expect(buildDuelChallenge(friendDay({ today: false, date: '2026-11-13' }), ctx())).toEqual({ kind: 'earlier', dateLabel: 'Nov 13' });
    // The screen's five are another day's than the link's (the day rolled over under the player).
    expect(buildDuelChallenge(friendDay({ date: '2026-11-15' }), ctx())).toEqual({ kind: 'earlier', dateLabel: 'Nov 15' });
    expect(buildDuelChallenge(friendDay({ today: false, date: '2026-11-13' }), ctx({ summary: YOURS }))).toEqual({ kind: 'earlier', dateLabel: 'Nov 13' });
  });

  it('is nothing for an id the source does not hold, and for a day the friend has not finished', () => {
    expect(buildDuelChallenge(null, ctx())).toBeNull();
    expect(buildDuelChallenge(friendDay({ played: 3, right: 2, points: 1_900, tiles: ['green', 'ink', 'green'] }), ctx())).toBeNull();
  });
});

describe('DuelChallengeLine', () => {
  const line = (challenge: Loadable<ChallengeVM | null>) => {
    render(<DuelChallengeLine challenge={challenge} />);
    return screen.queryByRole('status');
  };

  it('says whose score to beat: "A friend scored 4/5 (3,900 points)"', () => {
    const friend = score(4, 3_900, ['yellow', 'green', 'green', 'green', 'ink']);
    expect(line({ status: 'ready', data: { kind: 'friend', friend, comparison: null } })).toHaveTextContent('A friend scored 4/5 (3,900 points). Beat it: tap the life that costs more.');
  });

  it('says the challenge was for another day, and shows today’s five', () => {
    expect(line({ status: 'ready', data: { kind: 'earlier', dateLabel: 'Nov 13' } })).toHaveTextContent(
      'This challenge was for Nov 13. Here are today’s five.',
    );
  });

  it.each<[string, Loadable<ChallengeVM | null>]>([
    ['still loading', { status: 'loading' }],
    ['an id nobody holds, or an unfinished day', { status: 'ready', data: null }],
    ['a failed request', { status: 'error', error: { kind: 'network' } }],
  ])('falls back to the generic line for %s', (_, challenge) => {
    expect(line(challenge)).toHaveTextContent(t.challenge.generic);
  });

  it('says nothing on your own link', () => {
    expect(line({ status: 'ready', data: { kind: 'own' } })).toBeNull();
  });
});

describe('the day result of a challenge', () => {
  const friendVM = (comparison: Extract<ChallengeVM, { kind: 'friend' }>['comparison']) =>
    ({ kind: 'friend', friend: score(4, 3_900, ['yellow', 'green', 'green', 'green', 'ink']), comparison }) as const;
  const renderSummary = (challenge: ReturnType<typeof friendVM> | null, summary = YOURS) =>
    render(
      <DuelSummary
        summary={summary} copyStatus="idle" shareStatus="idle" onCopyChallenge={() => {}} onShare={() => {}} onGuessOwn={() => {}}
        guessOwnHref="/me/guess" challenge={challenge}
      />,
    );

  it('shows "You 3/5 · Friend 4/5", who is ahead, and both grids with their points', () => {
    renderSummary(friendVM({ you: score(3, 2_900, ['yellow', 'green', 'green', 'ink', 'ink']), outcome: 'behind' }));
    const versus = screen.getByRole('region', { name: t.challenge.heading });
    expect(within(versus).getByText('You 3/5 · Friend 4/5')).toBeInTheDocument();
    expect(within(versus).getByText(t.challenge.outcome.behind)).toBeInTheDocument();
    expect(within(versus).getByText('2,900 points')).toBeInTheDocument();
    expect(within(versus).getByText('3,900 points')).toBeInTheDocument();

    const yours = within(versus).getByRole('list', { name: t.summary.gridLabel });
    const theirs = within(versus).getByRole('list', { name: t.challenge.friendGridLabel });
    expect(within(yours).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Round 1: right with a hint', 'Round 2: right', 'Round 3: right', 'Round 4: missed', 'Round 5: missed',
    ]);
    expect(within(theirs).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Round 1: right with a hint', 'Round 2: right', 'Round 3: right', 'Round 4: right', 'Round 5: missed',
    ]);
    // Your grid is in the card once, not twice.
    expect(screen.getAllByRole('list', { name: t.summary.gridLabel })).toHaveLength(1);
  });

  it.each(['ahead', 'tied', 'behind'] as const)('says the outcome in words: %s', (outcome) => {
    renderSummary(friendVM({ you: score(3, 2_900, ['green', 'green', 'green', 'ink', 'ink']), outcome }));
    expect(screen.getByText(t.challenge.outcome[outcome])).toBeInTheDocument();
  });

  it.each([
    ['no challenge', null],
    ['a challenge with nothing to compare yet', friendVM(null)],
  ])('is the plain day result with %s: one grid, no comparison', (_, challenge) => {
    renderSummary(challenge);
    expect(screen.queryByRole('region', { name: t.challenge.heading })).toBeNull();
    expect(screen.getAllByRole('list', { name: t.summary.gridLabel })).toHaveLength(1);
    expect(screen.queryByRole('list', { name: t.challenge.friendGridLabel })).toBeNull();
    expect(screen.getByText(t.summary.legend)).toBeInTheDocument();
  });
});

describe('the day result’s one main action', () => {
  it('has exactly one link, to guess your own month, placed before the share buttons', () => {
    render(
      <DuelSummary
        summary={YOURS} copyStatus="idle" shareStatus="idle" onCopyChallenge={() => {}} onShare={() => {}} onGuessOwn={() => {}}
        guessOwnHref="/me/guess"
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(t.summary.cta);
    expect(links[0]).toHaveAttribute('href', '/me/guess');
    const share = screen.getByRole('button', { name: t.summary.share });
    const copy = screen.getByRole('button', { name: t.summary.copyChallenge(3, 5) });
    // DOM order = reading order on a phone: the bridge comes right after the score, sharing after it.
    expect(links[0].compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(links[0].compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: t.summary.ctaLead })).toBeInTheDocument();
  });
});
