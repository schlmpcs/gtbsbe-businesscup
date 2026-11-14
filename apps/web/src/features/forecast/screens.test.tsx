// @vitest-environment jsdom
// S1 and S10 screens wired to their real view-model hooks on the demo profile (fixtures).
import { inflationAnnualOf, rankMoves } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { common, forecast as t } from '@/copy';
import { getArea } from '@lifeguessr/data/areas';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import type { ExplainFn } from './model/useMoveExplain';
import { useFuture } from './model/useFuture';
import { useToday } from './model/useToday';
import { FutureScreen } from './ui/FutureScreen';
import { TodayScreen, type TodayLinks } from './ui/TodayScreen';

beforeEach(resetClientState);

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const links: TodayLinks = {
  play: '/play', future: '/future', afford: '/afford', loan: '/loan', decide: '/decide', checkin: '/checkin',
  profile: '/me/guess', upload: '/me/upload',
};

function Today() {
  const vm = useToday({ now: new Date(2026, 10, 14) });
  return <TodayScreen vm={vm} links={links} screens={[{ id: 'S1', href: '/' }, { id: 'S10', href: '/future' }]} Link={A} />;
}

function Future({ explain }: { explain?: ExplainFn }) {
  const vm = useFuture({ explain });
  return <FutureScreen vm={vm} links={{ today: '/', makeExact: '/me/upload' }} Link={A} />;
}

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('TodayScreen (S1)', () => {
  it('shows the 10-year number with its range, the play CTA and the entry points', async () => {
    render(<Today />);
    const card = await screen.findByTestId('in10y');
    await waitFor(() => expect(within(card).getByText(t.netWorthIn10y)).toBeInTheDocument());
    expect(within(card).getByText(/^Likely between \$[\d,]+ and \$[\d,]+$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.today.play.cta })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: t.today.future.cta })).toHaveAttribute('href', '/future');
    expect(screen.getByRole('link', { name: new RegExp(t.today.tools.afford.title) })).toHaveAttribute('href', '/afford');
    expect(screen.getByRole('link', { name: new RegExp(t.today.tools.loan.title) })).toHaveAttribute('href', '/loan');
    expect(screen.getByRole('link', { name: new RegExp(t.today.tools.decide.title) })).toHaveAttribute('href', '/decide');
    expect(screen.getByRole('link', { name: new RegExp(t.today.tools.checkin.title) })).toHaveAttribute('href', '/checkin');
    expect(screen.getByTestId('sample-note')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: t.today.allScreens }).querySelectorAll('a[data-screen]')).toHaveLength(2);
  });

  it('shows the projection only, and why, until 3 months of statements', async () => {
    render(<Today />);
    const card = await screen.findByTestId('month-end');
    await waitFor(() => expect(within(card).getByTestId('month-end-no-history')).toBeInTheDocument());
    expect(within(card).getByText(t.today.monthEnd.needHistory(0))).toBeInTheDocument();
    expect(within(card).queryByTestId('month-end-drifts')).not.toBeInTheDocument();
  });

  it('shows drift flags when the view-model has an average', async () => {
    // monthEnd is T9's engine piece; feed the screen a VM that has the 3-month average.
    const vm = {
      status: 'ready' as const, profileOrigin: 'user' as const, isDemoProfile: false,
      monthEnd: {
        status: 'ready' as const,
        data: {
          projectedSpend: 3900, vsAverage: 240, drifts: [{ category: 'eatingOut' as const, delta: 120 }],
          historyMonths: 3, fromStatement: true, takeHome: { value: 5200, isEstimate: false },
        },
      },
      in10y: { month: 120, low: 1, mid: 2, high: 3 }, in10yBandIsZero: false, committedMove: null,
      markCommittedDone: () => {}, topMove: { status: 'ready' as const, data: null },
      game: { date: null, played: 0, total: 0, finished: false, homes: [] },
    };
    render(<TodayScreen vm={vm} links={links} screens={[]} Link={A} />);
    const drifts = screen.getByTestId('month-end-drifts');
    expect(within(drifts).getByText(t.today.monthEnd.vsAverageValue('+$240'))).toBeInTheDocument();
    expect(within(drifts).getByText(t.today.monthEnd.drift(common.categories.eatingOut, '+$120'))).toBeInTheDocument();
    expect(screen.getByText(t.today.monthEnd.fromStatement)).toBeInTheDocument();
  });

  it('marks the committed move done from Today', async () => {
    const user = userEvent.setup();
    render(<Today />);
    const moveCard = await screen.findByTestId('today-move');
    await waitFor(() => expect(within(moveCard).getByText(t.today.move.topTitle)).toBeInTheDocument());
    expect(within(moveCard).queryByRole('button')).not.toBeInTheDocument();

    const ranked = rankMoves(useAppStore.getState().profile, { rates: { inflationAnnual: inflationAnnualOf(getArea('75206')) } });
    act(() => useAppStore.getState().commitMove(ranked[0]!));
    await waitFor(() => expect(within(moveCard).getByText(t.today.move.committedTitle)).toBeInTheDocument());
    await user.click(within(moveCard).getByRole('button', { name: t.today.move.markDone }));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([ranked[0]!.id]);
  });
});

describe('TodayScreen with statement history', () => {
  it('still reads history months from the store', async () => {
    useAppStore.getState().applyStatementTotals([{ month: '2026-10', totals: totals({ groceries: 500 }), oneOffs: [] }]);
    render(<Today />);
    await waitFor(() => expect(screen.getByText(t.today.monthEnd.needHistory(1))).toBeInTheDocument());
  });
});

describe('FutureScreen (S10)', () => {
  it('renders the headline, the band label, 1–3 moves and How we calculate', async () => {
    render(<Future />);
    const headline = await screen.findByTestId('in10y');
    expect(within(headline).getByText(t.future.headline)).toBeInTheDocument();
    expect(within(screen.getByTestId('band-note')).getByText(t.band.label)).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: t.future.chartTitle })).toBeInTheDocument();
    const moves = within(screen.getByTestId('moves')).getAllByRole('article');
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves.length).toBeLessThanOrEqual(3);
    expect(screen.getByTestId('level-2')).toHaveAttribute('data-locked', 'true');
    const how = screen.getByTestId('how-we-calculate');
    expect(within(how).getByText(t.how.labels.cardAprDefault)).toBeInTheDocument();
    expect(within(how).getAllByText(t.how.assumption).length).toBeGreaterThan(0);
    expect(within(how).getByRole('link', { name: /Federal Reserve G\.19/ })).toBeInTheDocument();
  });

  it('commits a move, flags it, unlocks level 2, and marks it done', async () => {
    const user = userEvent.setup();
    render(<Future />);
    const first = (await screen.findAllByRole('article'))[0]!;
    const id = first.getAttribute('data-move-id')!;
    await user.click(within(first).getByRole('button', { name: t.moves.commit }));
    const committed = document.querySelector<HTMLElement>(`[data-move-id="${id}"]`)!;
    expect(committed).toHaveAttribute('data-committed', 'true');
    expect(within(committed).getByTestId('committed-badge')).toHaveTextContent(t.moves.committed);
    expect(useAppStore.getState().profile.committedMoveId).toBe(id);
    expect(screen.getByTestId('level-2')).toHaveAttribute('data-locked', 'false');
    expect(screen.getByTestId('committed-preview')).toBeInTheDocument();

    await user.click(within(committed).getByRole('button', { name: t.moves.markDone }));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([id]);
    expect(screen.getByText(t.moves.doneCount(1))).toBeInTheDocument();
  });

  it('toggles today’s dollars and the comparison with the top move', async () => {
    const user = userEvent.setup();
    render(<Future />);
    const headline = await screen.findByTestId('in10y');
    expect(within(headline).getByText(t.todaysDollarsNote)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: t.future.todaysDollarsToggle }));
    expect(within(headline).getByText(t.futureDollarsNote)).toBeInTheDocument();

    const compare = screen.getByRole('checkbox', { name: /^Compare with:/ });
    expect(compare).not.toBeChecked();
    await user.click(compare);
    expect(compare).toBeChecked();
    expect(within(headline).getByText(new RegExp(t.future.withMoveIn10y))).toBeInTheDocument();
  });

  it('“Why?” shows the explanation from the explain route', async () => {
    const user = userEvent.setup();
    const explain = vi.fn<ExplainFn>(async () => ({ text: 'Because it helps. It adds up.', source: 'template' }));
    render(<Future explain={explain} />);
    const first = (await screen.findAllByRole('article'))[0]!;
    await user.click(within(first).getByRole('button', { name: new RegExp(`^${t.moves.why}`) }));
    await waitFor(() => expect(within(first).getByText('Because it helps. It adds up.')).toBeInTheDocument());
    expect(within(first).getByText(t.moves.whyTemplate)).toBeInTheDocument();
    expect(explain).toHaveBeenCalledTimes(1);
  });

  it('shows the effect in signed dollars', async () => {
    render(<Future />);
    const first = (await screen.findAllByRole('article'))[0]!;
    expect(within(first).getByText(/^\+\$[\d,]+$/)).toBeInTheDocument();
    expect(within(first).getByText(t.moves.effectLabel)).toBeInTheDocument();
  });
});
