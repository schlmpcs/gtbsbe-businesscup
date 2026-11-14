// @vitest-environment jsdom
// S13 / S14 screens on their real view-model hooks (the demo profile and the fixtures). Every number
// the tests expect on screen is computed by the engine here, never taken from a constant.
import { monthEnd, rankMoves } from '@lifeguessr/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { common, forecast, mocks } from '@/copy';
import { cloneProfileDemo, leaseScenarioSample, statementTotalsSample } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { formatMoney } from '@/ui-kit';
import { compareOf, useCheckin } from './model/useCheckin';
import { evaluateDecision, useDecide } from './model/useDecide';
import { CheckinScreen } from './ui/CheckinScreen';
import { DecideScreen } from './ui/DecideScreen';

beforeEach(() => {
  resetClientState();
  resetProState();
});

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const NOW = new Date(2026, 10, 14);
const Decide = () => <DecideScreen vm={useDecide({ now: NOW })} Link={A} />;
const Checkin = () => <CheckinScreen vm={useCheckin({ now: NOW })} Link={A} />;
/** The demo profile's area rates, from the real area data (what the hooks use). */
const rates = areaRates(cloneProfileDemo());
const d = mocks.decide;
const c = mocks.checkin;

describe('S13 decision', () => {
  it('renders the two paths, the VS and the result from the engine, marked as a preview', async () => {
    render(<Decide />);
    expect(await screen.findByRole('heading', { level: 1, name: d.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: d.keep.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: d.lease.title })).toBeTruthy();
    const note = screen.getByRole('note', { name: mocks.preview.sticker });
    expect(within(note).getByRole('link', { name: mocks.preview.cta }).getAttribute('href')).toBe('/pro');
    const r = evaluateDecision(cloneProfileDemo(), leaseScenarioSample, true);
    const score = screen.getByLabelText(d.scoreLabel);
    expect(within(score).getByText(formatMoney(r.betterBy10y, { signed: true }))).toBeTruthy();
    // The other decisions are coming soon.
    expect(screen.getByText(d.next.wedding)).toBeTruthy();
  });

  it('editing the lease updates the result; an emptied field is flagged', async () => {
    const user = userEvent.setup();
    render(<Decide />);
    await screen.findByLabelText(d.scoreLabel);
    const monthly = screen.getByRole('textbox', { name: new RegExp(`^${d.edit.monthly}`) });
    await user.clear(monthly);
    expect(screen.getByText(d.edit.errors.monthly!)).toBeTruthy();
    expect(screen.queryByLabelText(d.scoreLabel)).toBeNull();
    await user.type(monthly, '250');
    const r = evaluateDecision(cloneProfileDemo(), { ...leaseScenarioSample, monthly: 250 }, true);
    const score = await screen.findByLabelText(d.scoreLabel);
    expect(within(score).getByText(formatMoney(r.betterBy10y, { signed: true }))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: d.edit.reset }));
    expect((monthly as HTMLInputElement).value).toBe(String(leaseScenarioSample.monthly));
  });
});

describe('S14 check-in', () => {
  it('renders the sample month from monthEnd, the drift tiles and the add-statement link', async () => {
    render(<Checkin />);
    const expected = monthEnd(cloneProfileDemo(), statementTotalsSample.slice(0, 3), {
      month: '2026-10', day: 31, totals: statementTotalsSample[3]!.totals,
    });
    const cmp = compareOf(expected)!;
    const score = await screen.findByLabelText(c.scoreLabelDone);
    expect(within(score).getByText(formatMoney(expected.projectedSpend))).toBeTruthy();
    expect(within(score).getByText(formatMoney(cmp.average))).toBeTruthy();
    expect(screen.getByText(c.eyebrow('October'))).toBeTruthy();
    expect(screen.getByText(c.sampleNote)).toBeTruthy();
    const drift = screen.getByRole('heading', { name: c.driftTitle }).closest('section')!;
    expect(within(drift).getAllByRole('listitem')).toHaveLength(cmp.drifts.length + cmp.onTrack.length);
    expect(screen.getByRole('link', { name: new RegExp(c.addStatement('November')) }).getAttribute('href')).toBe('/me/upload');
  });

  it('commits to a move, shows its progress and marks it done', async () => {
    const user = userEvent.setup();
    render(<Checkin />);
    const section = await screen.findByTestId('checkin-move');
    // Each suggested move's 10-year number says who made it (the rules forecast, with no model key).
    expect((await within(section).findAllByTestId('forecast-source')).map((e) => e.textContent)).toEqual(
      rankMoves(cloneProfileDemo(), { rates }).map(() => forecast.source.rules),
    );
    const card = rankMoves(cloneProfileDemo(), { rates }).find((m) => m.kind === 'payCardFirst')!;
    const title = forecast.moves.title(card.kind, card.category ? common.categories[card.category] : undefined);
    await user.click(screen.getByRole('button', { name: `${c.move.commit}: ${title}` }));
    expect(useAppStore.getState().committedMove?.id).toBe(card.id);
    expect(screen.getByRole('progressbar', { name: c.move.progressLabel })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: c.move.done }));
    expect(screen.getByText(c.move.doneBody(title))).toBeTruthy();
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([card.id]);
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
