// @vitest-environment jsdom
// S13 / S14 screens on their real view-model hooks (the fixture stores and the sample statement).
// Every number the tests expect on screen is computed by the engine here, never taken from a constant.
import { monthEndDetail, rankMoves } from '@lifeguessr/engine';
import type { ForecastBundle } from '@lifeguessr/types';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { common, forecast, mocks, toolPlan } from '@/copy';
import { cloneProfileDemo, statementTotalsSample } from '@/fixtures';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { usePlanStore } from '@/features/plan/model/planStore';
import { markLedgerLoaded, setLedgerStore } from '@/features/transactions/model/transactionsStore';
import { memoryRecordStore } from '@/lib/model/idb';
import { areaRates } from '@/lib/model/profile';
import { createTransactionStore } from '@/lib/model/transactions';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { mockForecastRoute, rulesAnswer } from '@/test/forecastApi';
import { resetProState } from '@/test/pro';
import { formatMoney } from '@/ui-kit';
import { compareOf, useCheckin } from './model/useCheckin';
import { useDecide } from './model/useDecide';
import { CheckinScreen } from './ui/CheckinScreen';
import { DecideScreen } from './ui/DecideScreen';

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const NOW = new Date(2026, 10, 14);
const links = { addCarLoan: '/accounts?add=1', budget: '/budget' };
const Decide = () => <DecideScreen vm={useDecide({ now: FIXTURE_NOW })} links={links} Link={A} />;
const Checkin = () => <CheckinScreen vm={useCheckin({ now: NOW })} Link={A} />;
const rates = areaRates(cloneProfileDemo());
const d = mocks.decide;
const c = mocks.checkin;

describe('S13 decision', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXTURE_NOW);
    await resetFixtureStores();
  });
  afterEach(() => vi.useRealTimers());

  it('asks about the person’s own car and answers in one sentence from the engine', async () => {
    render(<Decide />);
    expect(await screen.findByRole('heading', { level: 1, name: d.title })).toBeTruthy();
    // No fixed example cars, and no example banner: the demo person's car is in their accounts.
    expect(screen.queryByText(/Camry|RAV4/)).toBeNull();
    expect(screen.queryByTestId('decide-example-note')).toBeNull();
    expect((screen.getByRole('textbox', { name: new RegExp(`^${d.fields.car.loanBalance}`) }) as HTMLInputElement).value).toBe('17,800');
    const sentence = screen.getByTestId('decide-sentence').textContent ?? '';
    expect(sentence).toMatch(/richer by 2036\.$|about the same by 2036\.$/);
    expect(screen.getByTestId('decide-forecast-source').textContent).toBe(forecast.source.rules);
    expect(screen.getByTestId('decide-chart')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Line chart/ })).toBeTruthy();
    expect(screen.getByTestId('decide-costs')).toBeTruthy();
  });

  it('switching to “Go car-free” changes the answer; an emptied field asks for a fix', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<Decide />);
    const before = (await screen.findByTestId('decide-sentence')).textContent;
    await user.click(screen.getByRole('radio', { name: d.kinds.noCar }));
    expect(screen.getByRole('heading', { name: d.altTitle.noCar })).toBeTruthy();
    expect(screen.getByTestId('decide-sentence').textContent).not.toBe(before);
    const running = screen.getByRole('textbox', { name: new RegExp(`^${d.fields.car.running}`) });
    await user.clear(running);
    expect(screen.getByText(d.errors.required!)).toBeTruthy();
    expect(screen.getByTestId('decide-fix')).toBeTruthy();
    expect(screen.queryByTestId('decide-sentence')).toBeNull();
  });

  it('adds a lease to the plan and links to it', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<Decide />);
    const plan = await screen.findByTestId('decide-plan');
    await user.click(within(plan).getByRole('radio', { name: d.kindsShort.lease }));
    expect(within(plan).getByTestId('tool-plan-impact')).toBeTruthy();
    const count = usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!.events.length;
    await user.click(within(plan).getByTestId('tool-plan-add'));
    expect(within(plan).getByTestId('tool-plan-added')).toBeTruthy();
    expect(within(plan).getByRole('link', { name: new RegExp(toolPlan.open) }).getAttribute('href')).toBe('/plan');
    const active = usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!;
    expect(active.events).toHaveLength(count + 1);
    expect(active.events.at(-1)).toMatchObject({ type: 'expense', cadence: 'monthly', name: d.plan.eventName.lease });
  });
});

describe('S14 check-in', () => {
  beforeEach(async () => {
    resetClientState();
    resetProState();
    const store = createTransactionStore({ db: memoryRecordStore([]) });
    setLedgerStore(store);
    await store.load();
    markLedgerLoaded(store);
  });

  it('renders the sample month (labelled), the KPI strip and the category bars from monthEndDetail', async () => {
    render(<Checkin />);
    const expected = monthEndDetail(cloneProfileDemo(), statementTotalsSample.slice(0, 3), {
      month: '2026-10', day: 31, totals: statementTotalsSample[3]!.totals,
    });
    const cmp = compareOf(expected);
    const kpis = await screen.findByTestId('checkin-kpis');
    expect(within(kpis).getByText(formatMoney(expected.projectedSpend))).toBeTruthy();
    expect(within(kpis).getByText(formatMoney(cmp.usual))).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: c.eyebrow('October') })).toBeTruthy();
    expect(screen.getByText(c.sampleNote)).toBeTruthy();
    const bars = screen.getByTestId('checkin-drifts');
    expect(within(bars).getAllByRole('listitem')).toHaveLength(cmp.rows.length);
    expect(bars.querySelectorAll('[data-drift]')).toHaveLength(expected.drifts.length);
    expect(screen.getByRole('link', { name: new RegExp(c.addStatement('November')) }).getAttribute('href')).toBe('/transactions?import=1');
  });

  it('offers the top move, commits to it and marks it done', async () => {
    const user = userEvent.setup();
    render(<Checkin />);
    const section = await screen.findByTestId('checkin-move');
    const top = rankMoves(cloneProfileDemo(), { rates })[0]!;
    const title = forecast.moves.title(top.kind, top.category ? common.categories[top.category] : undefined);
    expect((await within(section).findAllByTestId('forecast-source')).map((e) => e.textContent)).toEqual([forecast.source.rules]);
    await user.click(within(section).getByRole('button', { name: `${c.move.commit}: ${title}` }));
    expect(useAppStore.getState().committedMove?.id).toBe(top.id);
    expect(within(await screen.findByTestId('checkin-move')).getByTestId('forecast-source').textContent).toBe(forecast.source.rules);
    await user.click(screen.getByRole('button', { name: c.move.done }));
    expect(screen.getByText(c.move.doneBody(title))).toBeTruthy();
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([top.id]);
  });

  it('a committed card move shows its progress bar', async () => {
    const card = rankMoves(cloneProfileDemo(), { rates }).find((m) => m.kind === 'payCardFirst')!;
    useAppStore.getState().commitMove(card);
    render(<Checkin />);
    expect(await screen.findByRole('progressbar', { name: c.move.progressLabel })).toBeTruthy();
  });

  it('words the suggested move’s gain with the picked year', async () => {
    useAppStore.getState().setHorizonYears(3);
    render(<Checkin />);
    const section = await screen.findByTestId('checkin-move');
    expect(await within(section).findByText(/^\+\$[\d,]+ in 3 years$/)).toBeTruthy();
    expect(within(section).queryByText(/in 10 years/)).toBeNull();
  });

  it('“I did it” is usable at once: the rules forecast for the current profile is on screen while the answer is on its way', async () => {
    let release: (() => void) | undefined;
    mockForecastRoute((body) => new Promise<ForecastBundle>((resolve) => (release = () => resolve(rulesAnswer(body)))));
    useAppStore.getState().commitMove(rankMoves(cloneProfileDemo(), { rates })[0]!);
    render(<Checkin />);
    const done = await screen.findByRole('button', { name: c.move.done });
    expect(done).toBeEnabled();
    await waitFor(() => expect(release).toBeDefined());
    await act(async () => release?.());
    expect(screen.getByRole('button', { name: c.move.done })).toBeEnabled();
  });

  it('“not yet” keeps the committed move', async () => {
    const user = userEvent.setup();
    const move = rankMoves(cloneProfileDemo(), { rates })[0]!;
    useAppStore.getState().commitMove(move);
    render(<Checkin />);
    await user.click(await screen.findByRole('button', { name: c.move.keepGoing }));
    expect(screen.getByText(c.move.keepBody)).toBeTruthy();
    expect(useAppStore.getState().committedMove?.id).toBe(move.id);
  });
});
