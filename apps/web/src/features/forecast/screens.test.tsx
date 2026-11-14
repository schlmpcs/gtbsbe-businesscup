// @vitest-environment jsdom
// S1 and S10 screens wired to their real view-model hooks on the demo profile (fixtures).
import { inflationAnnualOf, rankMoves } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { common, forecast as t } from '@/copy';
import { getArea } from '@lifeguessr/data/areas';
import { APP_STORE_KEY, useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { aiAnswer, mockForecastRoute } from '@/test/forecastApi';
import { FORECAST_DEBOUNCE_MS } from './model/useForecastBundle';
import type { FutureVM, MoveVM, TodayVM } from './model/types';
import type { ExplainFn } from './model/useMoveExplain';
import { useFuture } from './model/useFuture';
import { useToday } from './model/useToday';
import { FutureScreen } from './ui/FutureScreen';
import { TodayScreen, type TodayLinks } from './ui/TodayScreen';

let route: ReturnType<typeof mockForecastRoute>;

beforeEach(() => {
  resetClientState();
  route = mockForecastRoute();
});

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const links: TodayLinks = {
  play: '/play', sample: '/future?sample=1', future: '/future', afford: '/afford', loan: '/loan', decide: '/decide', checkin: '/checkin',
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

/** A hand-made Today view-model: ready, with the forecast answered by the rules. */
function todayVm(over: Partial<TodayVM> = {}): TodayVM {
  return {
    status: 'ready', firstVisit: false, isSample: false, profileOrigin: 'user', isDemoProfile: false,
    monthEnd: {
      status: 'ready',
      data: {
        projectedSpend: 3900, vsAverage: null, drifts: [], historyMonths: 0, noAverage: 'history', fromStatement: false,
        month: '2026-11', asOfDay: null, takeHome: { value: 5200, isEstimate: false },
      },
    },
    horizonYears: 10, horizonReady: true, atHorizon: { month: 120, low: 1, mid: 2, high: 3 }, bandIsZero: false, bandKind: 'inputs',
    forecastStatus: 'ready', forecastError: null, source: 'rules', isRefreshing: false, actionsDisabled: false, committedMove: null,
    markCommittedDone: () => {}, topMove: { status: 'ready', data: null },
    game: { kind: 'duel', date: null, played: 0, total: 5, finished: false, homes: [] },
    ...over,
  };
}

/** A hand-made move as the view-model shows it: `effect` is measured at `horizonYears`, `effect10y` always at 10. */
function moveVm(over: Partial<MoveVM> = {}): MoveVM {
  return {
    id: 'cutCategory:other', kind: 'cutCategory', level: 1, effect10y: 1234, effect: 1234, horizonYears: 10,
    patch: { spending: { other: 100 } }, isCommitted: false, target: { kind: 'spendingTo', category: 'other', monthly: 100 },
    source: 'rules', ...over,
  };
}

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('TodayScreen (S1) first visit', () => {
  it('explains the app with Play and Try with sample data, and shows no numbers', async () => {
    render(<Today />);
    const f = t.today.firstVisit;
    expect(await screen.findByRole('heading', { level: 1, name: f.title })).toBeInTheDocument();
    expect(screen.getByText(f.body)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(`^${f.play}`) })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: f.sample })).toHaveAttribute('href', '/future?sample=1');
    expect(screen.getByText(f.note)).toBeInTheDocument();
    const steps = within(screen.getByRole('region', { name: f.stepsLabel })).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual(f.steps.map((step, i) => `${i + 1}${step}`));
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('at-horizon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('month-end')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: t.today.allScreens }).querySelectorAll('a[data-screen]')).toHaveLength(2);
  });

  it('shows the usual Today once the sample life is loaded, without the sample note (the banner says it)', async () => {
    act(() => void useAppStore.getState().loadSample());
    render(<Today />);
    expect(await screen.findByTestId('at-horizon')).toBeInTheDocument();
    expect(screen.queryByTestId('today-first-visit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sample-note')).not.toBeInTheDocument();
  });
});

describe('TodayScreen (S1)', () => {
  // Past the first visit: the user has guessed their own month.
  beforeEach(() => useAppStore.setState({ selfGuess: 3000 }));

  it('shows the 10-year number with its range, the play CTA and the entry points', async () => {
    render(<Today />);
    const card = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(card).getByText(t.netWorthAt(10))).toBeInTheDocument());
    expect(within(card).getByText(/^Likely between \$[\d,]+ and \$[\d,]+$/)).toBeInTheDocument();
    expect(within(card).getByTestId('forecast-source')).toHaveTextContent(t.source.rules);
    expect(within(card).getByText(t.band.label)).toBeInTheDocument();
    // /play is the duel by default: rounds, not homes.
    expect(screen.getByRole('heading', { level: 1, name: t.today.duel.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.today.playDuel.cta })).toHaveAttribute('href', '/play');
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

  it('labels the 10-year number as the AI estimate, with the model’s band, when the model answered', async () => {
    route = mockForecastRoute((body) => aiAnswer(body));
    render(<Today />);
    const card = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(card).getByTestId('forecast-source')).toHaveAttribute('data-source', 'ai'));
    expect(within(card).getByTestId('forecast-source')).toHaveTextContent(t.source.ai);
    expect(within(card).getByText(t.band.model.label)).toBeInTheDocument();
    expect(within(card).queryByText(t.band.label)).not.toBeInTheDocument();
    const move = await screen.findByTestId('today-move');
    await waitFor(() => expect(within(move).getByTestId('forecast-source')).toHaveTextContent(t.source.ai));
  });

  it('shows this month and the rules-based 10-year number at once, then the AI estimate when it lands', async () => {
    let release!: () => void;
    route = mockForecastRoute((body) => new Promise((resolve) => (release = () => resolve(aiAnswer(body)))));
    render(<Today />);
    const monthEnd = await screen.findByTestId('month-end');
    await waitFor(() => expect(within(monthEnd).getByTestId('month-end-no-history')).toBeInTheDocument());
    const card = screen.getByTestId('at-horizon');
    expect(card.querySelector('[aria-busy="true"]')).toBeNull(); // no skeleton
    expect(within(card).getByTestId('forecast-source')).toHaveAttribute('data-source', 'rules');
    expect(within(card).getByTestId('forecast-source')).toHaveTextContent(t.source.rules);
    expect(within(card).getByText(t.future.refreshing)).toBeInTheDocument();
    expect(within(screen.getByTestId('today-move')).getByTestId('forecast-source')).toHaveTextContent(t.source.rules);

    act(() => release());
    await waitFor(() => expect(within(card).getByTestId('forecast-source')).toHaveAttribute('data-source', 'ai'));
    expect(within(card).queryByText(t.future.refreshing)).not.toBeInTheDocument();
  });

  it('says so, instead of a skeleton forever, when the forecast cannot be built', () => {
    const vm = todayVm({ forecastStatus: 'error', forecastError: { kind: 'unknown', message: 'x' }, source: null });
    render(<TodayScreen vm={vm} links={links} screens={[]} Link={A} />);
    const card = screen.getByTestId('at-horizon');
    expect(within(card).getByRole('alert')).toHaveTextContent(t.errors.unknown);
    expect(card.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId('month-end')).toBeInTheDocument();
  });

  it('disables “I did it” while the forecast is refreshing', () => {
    const committed = {
      id: 'cutCategory:other', kind: 'cutCategory' as const, level: 1 as const, effect10y: 1234,
      effect: 1234, horizonYears: 10 as const, patch: { spending: { other: 100 } }, isCommitted: true,
      target: { kind: 'spendingTo' as const, category: 'other' as const, monthly: 100 }, source: 'rules' as const,
    };
    const { rerender } = render(<TodayScreen vm={todayVm({ committedMove: committed })} links={links} screens={[]} Link={A} />);
    expect(screen.getByRole('button', { name: t.today.move.markDone })).toBeEnabled();
    rerender(<TodayScreen vm={todayVm({ committedMove: committed, actionsDisabled: true })} links={links} screens={[]} Link={A} />);
    expect(screen.getByRole('button', { name: t.today.move.markDone })).toBeDisabled();
  });

  it('names the picked year: the card title, the number’s label and the move’s gain follow horizonYears', () => {
    const vm = todayVm({
      horizonYears: 1,
      topMove: { status: 'ready', data: moveVm({ effect: 513, horizonYears: 1 }) },
    });
    render(<TodayScreen vm={vm} links={links} screens={[]} Link={A} />);
    const card = screen.getByTestId('at-horizon');
    expect(within(card).getByRole('heading', { name: 'You in 1 year' })).toBeInTheDocument();
    expect(within(card).getByText('Net worth in 1 year')).toBeInTheDocument();
    expect(within(screen.getByTestId('today-move')).getByText('+$513 in 1 year')).toBeInTheDocument();
  });

  it('words a move’s gain with the move’s own year: a stored committed move outside the ranking says 10 years', () => {
    const vm = todayVm({
      horizonYears: 3,
      committedMove: moveVm({ isCommitted: true, source: null, effect: 1234, horizonYears: 10 }),
    });
    render(<TodayScreen vm={vm} links={links} screens={[]} Link={A} />);
    expect(within(screen.getByTestId('at-horizon')).getByRole('heading', { name: 'You in 3 years' })).toBeInTheDocument();
    expect(within(screen.getByTestId('today-move')).getByText('+$1,234 in 10 years')).toBeInTheDocument();
  });

  it('follows the year picked on S10 from the store, from the same answer (no new request)', async () => {
    render(<Today />);
    const card = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(card).getByTestId('forecast-source')).toBeInTheDocument());
    // The first request has settled (the source tag shows the rules answer at once, so it says nothing about that).
    await waitFor(() => expect(within(card).queryByText(t.future.refreshing)).not.toBeInTheDocument());
    expect(within(card).getByRole('heading', { name: 'You in 10 years' })).toBeInTheDocument();
    expect(route.calls).toHaveLength(1);

    act(() => useAppStore.getState().setHorizonYears(3));
    expect(within(card).getByRole('heading', { name: 'You in 3 years' })).toBeInTheDocument();
    expect(within(card).getByText('Net worth in 3 years')).toBeInTheDocument();
    expect(within(screen.getByTestId('today-move')).getByText(/^\+\$[\d,]+ in 3 years$/)).toBeInTheDocument();
    // A new year that changed the request would show "updating" at once (its request is debounced, so the
    // call count alone cannot see it yet).
    expect(within(card).queryByText(t.future.refreshing)).not.toBeInTheDocument();
    expect(route.calls).toHaveLength(1);
  });

  it('says the forecast is updating, politely, while the number on the card is the previous answer', async () => {
    render(<Today />);
    const card = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(card).getByText(t.netWorthAt(10))).toBeInTheDocument());
    const status = within(card).getByTestId('forecast-refreshing');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();

    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    expect(status).toHaveTextContent(t.future.refreshing);
    expect(within(card).getByText(t.netWorthAt(10))).toBeInTheDocument(); // still the previous answer
    await waitFor(() => expect(status).toBeEmptyDOMElement(), { timeout: FORECAST_DEBOUNCE_MS + 1_000 });
  });

  it('shows the updating line from the view-model flag only', () => {
    const { rerender } = render(<TodayScreen vm={todayVm()} links={links} screens={[]} Link={A} />);
    expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument();
    rerender(<TodayScreen vm={todayVm({ isRefreshing: true })} links={links} screens={[]} Link={A} />);
    expect(within(screen.getByTestId('at-horizon')).getByText(t.future.refreshing)).toBeInTheDocument();
  });

  it('shows drift flags when the view-model has an average', async () => {
    // monthEnd is T9's engine piece; feed the screen a VM that has the 3-month average.
    const vm = todayVm({
      monthEnd: {
        status: 'ready' as const,
        data: {
          projectedSpend: 3900, vsAverage: 240, drifts: [{ category: 'eatingOut' as const, delta: 120 }],
          historyMonths: 3, noAverage: null, fromStatement: true, month: '2026-11', asOfDay: 12,
          takeHome: { value: 5200, isEstimate: false },
        },
      },
    });
    render(<TodayScreen vm={vm} links={links} screens={[]} Link={A} />);
    const drifts = screen.getByTestId('month-end-drifts');
    expect(within(drifts).getByText(t.today.monthEnd.vsAverageValue('+$240'))).toBeInTheDocument();
    expect(within(drifts).getByText(t.today.monthEnd.drift(common.categories.eatingOut, '+$120'))).toBeInTheDocument();
    expect(screen.getByText(t.today.monthEnd.fromStatement('November 12'))).toBeInTheDocument();
  });

  it('marks the committed move done from Today', async () => {
    const user = userEvent.setup();
    render(<Today />);
    const moveCard = await screen.findByTestId('today-move');
    await waitFor(() => expect(within(moveCard).getByTestId('forecast-source')).toBeInTheDocument()); // the answer is in
    expect(within(moveCard).getByText(t.today.move.topTitle)).toBeInTheDocument();
    expect(within(moveCard).queryByRole('button')).not.toBeInTheDocument();

    const ranked = rankMoves(useAppStore.getState().profile, { rates: { inflationAnnual: inflationAnnualOf(getArea('75206')) } });
    act(() => useAppStore.getState().commitMove(ranked[0]!));
    await waitFor(() => expect(within(moveCard).getByText(t.today.move.committedTitle)).toBeInTheDocument());
    await user.click(within(moveCard).getByRole('button', { name: t.today.move.markDone }));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([ranked[0]!.id]);
  });
});

describe('TodayScreen (S1) daily game copy', () => {
  it('duel: counts today’s five and shows no home tiles', () => {
    const p = t.today.playDuel;
    const { unmount } = render(
      <TodayScreen vm={todayVm({ game: { kind: 'duel', date: '2026-11-14', played: 2, total: 5, finished: false, homes: [] } })} links={links} screens={[]} Link={A} />,
    );
    expect(screen.getByRole('link', { name: p.continue(2, 5) })).toHaveAttribute('href', '/play');
    expect(screen.queryByRole('region', { name: t.today.homes.label })).not.toBeInTheDocument();
    expect(screen.queryByText(/today’s homes/i)).not.toBeInTheDocument();
    unmount();

    render(<TodayScreen vm={todayVm({ game: { kind: 'duel', date: '2026-11-14', played: 5, total: 5, finished: true, homes: [] } })} links={links} screens={[]} Link={A} />);
    expect(screen.getByText(p.doneSticker)).toBeInTheDocument();
    expect(screen.getByText(p.done)).toBeInTheDocument();
  });

  it('slider (NEXT_PUBLIC_GAME_MODE=slider): today’s homes, with their tiles', () => {
    const homes = [{ id: 'a', metro: 'Austin, TX', played: true }, { id: 'b', metro: 'Boise, ID', played: false }];
    render(<TodayScreen vm={todayVm({ game: { kind: 'slider', date: '2026-11-14', played: 1, total: 2, finished: false, homes } })} links={links} screens={[]} Link={A} />);
    expect(screen.getByRole('heading', { level: 1, name: t.today.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.today.play.continue(1, 2) })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('region', { name: t.today.homes.label })).toBeInTheDocument();
  });

  it('lists a screen under the title it is given (S2 as the duel)', () => {
    render(<TodayScreen vm={todayVm()} links={links} screens={[{ id: 'S2', href: '/play', title: 'Which life costs more?' }]} Link={A} />);
    expect(screen.getByRole('link', { name: /S2\s*Which life costs more\?/ })).toHaveAttribute('href', '/play');
  });
});

describe('TodayScreen with statement history', () => {
  it('still reads history months from the store', async () => {
    useAppStore.getState().applyStatementTotals([{ month: '2026-10', totals: totals({ groceries: 500 }), oneOffs: [] }]);
    render(<Today />);
    await waitFor(() => expect(screen.getByText(t.today.monthEnd.needHistory(1))).toBeInTheDocument());
  });

  it('with 3 past months but nothing yet this month, says so instead of asking for more months', async () => {
    useAppStore.getState().applyStatementTotals([
      { month: '2026-08', totals: totals({ groceries: 500 }), oneOffs: [] },
      { month: '2026-09', totals: totals({ groceries: 500 }), oneOffs: [] },
      { month: '2026-10', totals: totals({ groceries: 500 }), oneOffs: [] },
    ]);
    render(<Today />);
    const card = await screen.findByTestId('month-end');
    await waitFor(() => expect(within(card).getByTestId('month-end-no-current')).toBeInTheDocument());
    expect(within(card).queryByTestId('month-end-no-history')).not.toBeInTheDocument();
    expect(within(card).queryByText(t.today.monthEnd.needHistory(3))).not.toBeInTheDocument();
    expect(within(card).getByText(t.today.monthEnd.noRowsThisMonth('November'))).toBeInTheDocument();
    expect(within(card).getByText(t.today.monthEnd.needThisMonth('November'))).toBeInTheDocument();
    expect(within(card).queryByTestId('month-end-drifts')).not.toBeInTheDocument();
  });

  it('says how far into the month the statement goes', async () => {
    useAppStore.getState().applyStatementTotals([
      { month: '2026-11', totals: totals({ groceries: 200 }), oneOffs: [], lastDay: 9 },
    ]);
    render(<Today />);
    await waitFor(() => expect(screen.getByText(t.today.monthEnd.fromStatement('November 9'))).toBeInTheDocument());
  });
});

describe('FutureScreen (S10)', () => {
  it('renders the headline, the band label, 1–3 moves and How we calculate', async () => {
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    expect(within(headline).getByText(t.future.headline(10))).toBeInTheDocument();
    expect(within(headline).getByTestId('forecast-source')).toHaveAttribute('data-source', 'rules');
    expect(within(headline).getByTestId('forecast-source')).toHaveTextContent(t.source.rules);
    expect(within(screen.getByTestId('band-note')).getByText(t.band.label)).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: t.future.chartTitle(10) })).toBeInTheDocument();
    const moves = within(screen.getByTestId('moves')).getAllByRole('article');
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves.length).toBeLessThanOrEqual(3);
    for (const move of moves) expect(within(move).getByTestId('forecast-source')).toHaveTextContent(t.source.rules);
    expect(screen.getByTestId('level-2')).toHaveAttribute('data-locked', 'true');
    const how = screen.getByTestId('how-we-calculate');
    expect(within(how).getByText(t.how.intro)).toBeInTheDocument();
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
    expect(screen.getByTestId('committed-preview')).toBeInTheDocument(); // at once: it came with the answer
    expect(route.calls).toHaveLength(1);

    await user.click(within(committed).getByRole('button', { name: t.moves.markDone }));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([id]);
    expect(screen.getByText(t.moves.doneCount(1))).toBeInTheDocument();
  });

  it('toggles today’s dollars and the comparison with the top move', async () => {
    const user = userEvent.setup();
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    expect(within(headline).getByText(t.todaysDollarsNote)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: t.future.todaysDollarsToggle }));
    expect(within(headline).getByText(t.futureDollarsNote)).toBeInTheDocument();

    const compare = screen.getByRole('checkbox', { name: /^Compare with:/ });
    expect(compare).not.toBeChecked();
    await user.click(compare);
    expect(compare).toBeChecked();
    expect(within(headline).getByText(new RegExp(t.future.withMoveAt))).toBeInTheDocument();
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

  it('labels everything as the AI estimate, with the model’s band note and the matching “How we calculate”', async () => {
    route = mockForecastRoute((body) => aiAnswer(body));
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(headline).getByTestId('forecast-source')).toHaveAttribute('data-source', 'ai'));
    expect(within(headline).getByTestId('forecast-source')).toHaveTextContent(t.source.ai);
    const band = screen.getByTestId('band-note');
    expect(within(band).getByText(t.band.model.label)).toBeInTheDocument();
    expect(within(band).getByText(t.band.model.explain)).toBeInTheDocument();
    expect(within(band).queryByText(t.band.label)).not.toBeInTheDocument();
    for (const move of within(screen.getByTestId('moves')).getAllByRole('article')) {
      expect(within(move).getByTestId('forecast-source')).toHaveTextContent(t.source.ai);
    }
    const how = screen.getByTestId('how-we-calculate');
    expect(within(how).getByText(t.how.introAi)).toBeInTheDocument();
    expect(within(how).queryByText(t.how.intro)).not.toBeInTheDocument();
  });

  it('names the band’s source in the chart legend: the model’s uncertainty for an AI answer, the inputs for rules', async () => {
    const rules = render(<Future />);
    const rulesChart = await screen.findByRole('figure', { name: t.future.chartTitle(10) });
    expect(within(screen.getByTestId('at-horizon')).getByTestId('forecast-source')).toHaveAttribute('data-source', 'rules');
    expect(within(rulesChart).getByText(t.band.label)).toBeInTheDocument();
    expect(within(rulesChart).queryByText(t.band.model.label)).not.toBeInTheDocument();
    rules.unmount();
    resetClientState();

    route = mockForecastRoute((body) => aiAnswer(body));
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(headline).getByTestId('forecast-source')).toHaveAttribute('data-source', 'ai'));
    const aiChart = screen.getByRole('figure', { name: t.future.chartTitle(10) });
    expect(within(aiChart).getByText(t.band.model.label)).toBeInTheDocument();
    expect(within(aiChart).queryByText(t.band.label)).not.toBeInTheDocument();
  });

  it('describes the rules forecast in “How we calculate” while the model’s answer is on its way, then the AI one', async () => {
    let release!: () => void;
    route = mockForecastRoute((body) => new Promise((resolve) => (release = () => resolve(aiAnswer(body)))));
    render(<Future />);
    const how = await screen.findByTestId('how-we-calculate');
    await waitFor(() => expect(route.calls).toHaveLength(1));
    expect(within(how).getByText(t.how.intro)).toBeInTheDocument(); // the numbers on screen are the rules'
    expect(within(how).queryByText(t.how.introAi)).not.toBeInTheDocument();

    act(() => release());
    await waitFor(() => expect(within(how).getByText(t.how.introAi)).toBeInTheDocument());
    expect(within(how).queryByText(t.how.intro)).not.toBeInTheDocument();
  });

  it('says the forecast is updating while a new answer is on its way', async () => {
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    await waitFor(() => expect(within(headline).getByText(t.future.headline(10))).toBeInTheDocument());
    expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument();

    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    expect(screen.getByText(t.future.refreshing)).toBeInTheDocument();
    expect(within(headline).getByText(t.future.headline(10))).toBeInTheDocument(); // still the previous answer
    await waitFor(() => expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument(), {
      timeout: FORECAST_DEBOUNCE_MS + 1_000,
    });
    expect(route.calls).toHaveLength(2);
  });

  it('keeps the move buttons enabled on a profile change: the moves on screen are the new profile’s rules ranking', async () => {
    render(<Future />);
    const first = (await screen.findAllByRole('article'))[0]!;
    await waitFor(() => expect(within(first).getByRole('button', { name: t.moves.commit })).toBeEnabled());

    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    await waitFor(() => expect(screen.getByText(t.future.refreshing)).toBeInTheDocument());
    for (const article of screen.getAllByRole('article')) {
      expect(within(article).getByRole('button', { name: t.moves.commit })).toBeEnabled();
      expect(within(article).getByRole('button', { name: t.moves.markDone })).toBeEnabled();
    }
    await waitFor(() => expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument(), {
      timeout: FORECAST_DEBOUNCE_MS + 1_000,
    });
    for (const article of screen.getAllByRole('article')) {
      expect(within(article).getByRole('button', { name: t.moves.commit })).toBeEnabled();
      expect(within(article).getByRole('button', { name: t.moves.markDone })).toBeEnabled();
    }
  });

  it('keeps the move buttons enabled while a remembered rules answer for this profile is asked for again', async () => {
    const first = render(<Future />);
    await screen.findAllByRole('article'); // the rules answer is in and remembered
    first.unmount();

    route = mockForecastRoute(() => new Promise(() => {})); // the model is slow
    render(<Future />);
    await waitFor(() => expect(route.calls).toHaveLength(1));
    const articles = await screen.findAllByRole('article'); // the remembered answer, no skeleton
    expect(screen.getByText(t.future.refreshing)).toBeInTheDocument();
    for (const article of articles) {
      expect(within(article).getByRole('button', { name: t.moves.commit })).toBeEnabled();
      expect(within(article).getByRole('button', { name: t.moves.markDone })).toBeEnabled();
    }
  });

  it('offers 1, 3, 5 and 10 years as one radio group, 10 chosen, under the title', async () => {
    render(<Future />);
    const group = await screen.findByRole('group', { name: 'Look ahead' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['1 year', '3 years', '5 years', '10 years']);
    expect(within(group).getByRole('radio', { name: '10 years' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: '3 years' })).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You in 10 years');
  });

  it('choosing a year calls setHorizonYears with that number', async () => {
    const user = userEvent.setup();
    const setHorizonYears = vi.fn();
    function Spied() {
      const vm: FutureVM = useFuture();
      return <FutureScreen vm={{ ...vm, setHorizonYears }} links={{ today: '/', makeExact: '/me/upload' }} Link={A} />;
    }
    render(<Spied />);
    await user.click(await screen.findByRole('radio', { name: '3 years' }));
    expect(setHorizonYears).toHaveBeenCalledTimes(1);
    expect(setHorizonYears).toHaveBeenCalledWith(3);
  });

  it('re-reads the same answer at the picked year: title, headline, chart, intro and every move, with no new request', async () => {
    const user = userEvent.setup();
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    await screen.findAllByRole('article');
    // The first request has settled (the source tag shows the rules answer at once, so it says nothing about that).
    await waitFor(() => expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument());
    const asked = route.calls.length;
    expect(asked).toBe(1);

    await user.click(screen.getByRole('radio', { name: '3 years' }));
    expect(screen.getByRole('radio', { name: '3 years' })).toBeChecked();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You in 3 years');
    expect(within(headline).getByText('Net worth in 3 years')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Your net worth over the next 3 years' })).toBeInTheDocument();
    expect(screen.getByText('Ranked by what each adds in 3 years, in today’s dollars.')).toBeInTheDocument();
    for (const move of within(screen.getByTestId('moves')).getAllByRole('article')) {
      expect(within(move).getByText('Net worth gain in 3 years')).toBeInTheDocument();
    }
    expect(useAppStore.getState().horizonYears).toBe(3);
    // A new year that changed the request would show "updating" at once (its request is debounced, so the
    // call count alone cannot see it yet).
    expect(screen.queryByText(t.future.refreshing)).not.toBeInTheDocument();
    expect(route.calls).toHaveLength(asked);
  });

  it('says “1 year”, not “1 years”, everywhere at the shortest horizon', async () => {
    useAppStore.getState().setHorizonYears(1);
    render(<Future />);
    const headline = await screen.findByTestId('at-horizon');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You in 1 year');
    expect(screen.getByRole('radio', { name: '1 year' })).toBeChecked();
    expect(within(headline).getByText('Net worth in 1 year')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Your net worth over the next year' })).toBeInTheDocument();
    expect(screen.getByText('Ranked by what each adds in 1 year, in today’s dollars.')).toBeInTheDocument();
    const first = (await screen.findAllByRole('article'))[0]!;
    expect(within(first).getByText('Net worth gain in 1 year')).toBeInTheDocument();
    expect(within(first).getByText(/^\+\$[\d,]+$/)).toBeInTheDocument();
  });

  it('shows the effect in signed dollars', async () => {
    render(<Future />);
    const first = (await screen.findAllByRole('article'))[0]!;
    expect(within(first).getByText(/^\+\$[\d,]+$/)).toBeInTheDocument();
    expect(within(first).getByText(t.moves.effectLabel(10))).toBeInTheDocument();
  });
});

describe('Before the saved state loads (S1 and S10)', () => {
  /** What the first render shows, before the persisted store has loaded (the server snapshot). */
  const firstRender = (node: ReactNode) => {
    const div = document.createElement('div');
    div.innerHTML = renderToString(node);
    return div;
  };

  it('names no year and keeps the picker off, with no year chosen, until the saved horizon is in, then shows the saved one (no 10-year flash)', async () => {
    // A returning user who picked 3 years: saved, while the store in memory still holds the default.
    useAppStore.getState().setHorizonYears(3);
    const saved = localStorage.getItem(APP_STORE_KEY)!;
    useAppStore.setState({ horizonYears: 10 });
    localStorage.setItem(APP_STORE_KEY, saved);

    const future = firstRender(<Future />);
    expect(future.querySelector('h1')?.textContent).toBe(t.future.titleNeutral);
    // The picker keeps its place, but is off with no year chosen.
    const radios = [...future.querySelectorAll<HTMLInputElement>('input[name="horizon"]')];
    expect(radios).toHaveLength(4);
    expect(radios.some((r) => r.checked)).toBe(false);
    expect(future.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true);
    expect(future.textContent).toContain(t.moves.introNeutral);
    future.querySelector('fieldset')?.remove(); // its options are the years on offer, not a shown one
    expect(future.textContent).not.toMatch(/\d+ years?/);

    const today = firstRender(<Today />);
    expect(today.querySelector('[data-testid="at-horizon"]')?.textContent).toContain(t.today.future.titleNeutral);
    expect(today.textContent).not.toMatch(/You in \d/);

    await act(async () => {
      await useAppStore.persist.rehydrate();
    });
    expect(useAppStore.getState().horizonYears).toBe(3);
    render(<Future />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You in 3 years');
    expect(await screen.findByRole('radio', { name: '3 years' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '3 years' })).toBeEnabled();
  });
});
