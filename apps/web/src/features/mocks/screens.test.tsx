// @vitest-environment jsdom
// S13 and S14 screens wired to their real view-model hooks on the demo profile (fixtures).
import { inflationAnnualOf, rankMoves } from '@lifeguessr/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { common, forecast, mocks } from '@/copy';
import { areaByZip, cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { useCheckin } from './model/useCheckin';
import { useDecision } from './model/useDecision';
import { CheckinScreen } from './ui/CheckinScreen';
import { DecisionScreen } from './ui/DecisionScreen';

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

function Decide() {
  return <DecisionScreen vm={useDecision()} links={{ loan: '/loan', afford: '/afford' }} Link={A} />;
}

function Checkin() {
  return <CheckinScreen vm={useCheckin({ now: new Date(2026, 10, 14) })} links={{ upload: '/me/upload', future: '/future' }} Link={A} />;
}

const d = mocks.decision;
const c = mocks.checkin;

describe('/decide (S13)', () => {
  it('compares the two sample paths with keeping the car, and names the better path', async () => {
    render(<Decide />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(mocks.screens.S13);
    const table = await screen.findByRole('table', { name: d.compare.caption });
    for (const name of [d.keepName, d.pathName('A'), d.pathName('B')]) {
      expect(within(table).getByRole('columnheader', { name })).toBeTruthy();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(9); // header + 8 metrics
    for (const id of ['A', 'B']) expect(screen.getByTestId(`decision-verdict-${id}`).dataset.verdict).toMatch(/^(fits|wait|no)$/);
    expect(screen.getByTestId('decision-leader').dataset.leader).toBe('B');
    expect(screen.getByRole('figure', { name: d.chartTitle })).toBeTruthy();
    // Other decisions are listed as coming with Pro; the preview note links to Pro.
    const kinds = screen.getByRole('navigation', { name: d.kindsLabel });
    expect(within(kinds).getByText(d.kinds.wedding).getAttribute('aria-disabled')).toBe('true');
    expect(within(screen.getByTestId('preview-note')).getByRole('link', { name: mocks.preview.cta }).getAttribute('href')).toBe('/pro');
  });

  it('editing a path updates the comparison; an emptied field is flagged', async () => {
    const user = userEvent.setup();
    render(<Decide />);
    await screen.findByRole('table', { name: d.compare.caption });
    const panelA = screen.getByRole('tabpanel', { name: d.pathName('A') });
    await user.click(within(panelA).getByRole('radio', { name: d.edit.payWithOptions.cash }));
    expect(within(panelA).queryByRole('textbox', { name: d.edit.apr })).toBeNull();
    const table = screen.getByRole('table', { name: d.compare.caption });
    expect(within(table).getByText(d.compare.noPayment)).toBeTruthy();

    const price = within(panelA).getByRole('textbox', { name: d.edit.price });
    await user.clear(price);
    expect(within(panelA).getByText(d.edit.errors.price!)).toBeTruthy();
    expect(screen.queryByTestId('decision-leader')).toBeNull();
    await user.click(screen.getByRole('button', { name: d.edit.reset }));
    expect(screen.getByTestId('decision-leader')).toBeTruthy();
  });
});

describe('/checkin (S14)', () => {
  it('walks the three steps on the sample statement, commits a move, marks it done and finishes', async () => {
    const user = userEvent.setup();
    render(<Checkin />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(mocks.screens.S14);

    // Step 1: the sample statement's October.
    const month = await screen.findByTestId('checkin-month');
    expect(within(month).getByRole('heading', { name: c.month.title('2026-10') })).toBeTruthy();
    expect(within(month).getByText(c.month.sampleNote)).toBeTruthy();
    expect(within(month).getByRole('link', { name: c.month.upload }).getAttribute('href')).toBe('/me/upload');

    // Step 2: no committed move yet, so pick the best one.
    await user.click(screen.getByRole('button', { name: c.next }));
    const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
    const best = rankMoves(cloneProfileDemo(), { rates })[0]!;
    const title = forecast.moves.title(best.kind, best.category ? common.categories[best.category] : undefined);
    await user.click(screen.getByRole('button', { name: `${c.move.commit}: ${title}` }));
    expect(useAppStore.getState().committedMove?.id).toBe(best.id);
    expect(within(screen.getByTestId('checkin-move')).getByText(title)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: c.move.done }));
    expect(screen.getByText(c.move.doneBody(title))).toBeTruthy();
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([best.id]);

    // Step 3 and the summary.
    await user.click(screen.getByRole('button', { name: c.next }));
    expect(screen.getByRole('figure', { name: c.future.chartTitle })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: c.finish }));
    const summary = screen.getByTestId('checkin-summary');
    expect(within(summary).getByText(c.summary.moveDone(title))).toBeTruthy();
    await user.click(within(summary).getByRole('button', { name: c.restart }));
    expect(screen.getByTestId('checkin-month')).toBeTruthy();
  });

  it('“not yet” keeps the committed move', async () => {
    const user = userEvent.setup();
    const p = cloneProfileDemo();
    const move = rankMoves(p, { rates: { inflationAnnual: inflationAnnualOf(areaByZip('75206')) } })[0]!;
    useAppStore.getState().commitMove(move);
    render(<Checkin />);
    await screen.findByTestId('checkin-month');
    await user.click(screen.getByRole('button', { name: c.steps.move }));
    await user.click(screen.getByRole('button', { name: c.move.keepGoing }));
    expect(screen.getByText(c.move.keepBody)).toBeTruthy();
    expect(useAppStore.getState().committedMove?.id).toBe(move.id);
  });
});
