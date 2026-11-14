// @vitest-environment jsdom
// S14 check-in on its real view-model hook (the demo profile). Every number the tests expect on screen
// is computed by the engine here, never taken from a constant.
import { applyPatch, checkinRecord, checkinStart, checkinSummary, seedOf, simulateMonth } from '@lifeguessr/engine';
import type { Move } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkin as c } from '@/copy';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import { formatMoney, formatMonth } from '@/ui-kit';
import { addMonths, checkinPlan, useCheckin } from './model/useCheckin';
import { CheckinScreen } from './ui/CheckinScreen';

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const NOW = new Date(2026, 10, 14);
const Checkin = () => <CheckinScreen vm={useCheckin({ now: NOW })} Link={A} />;
const DEC = '2026-12';

beforeEach(() => {
  resetClientState();
  resetProState();
});

function engineMonth(month = DEC, index = 1) {
  const p = useAppStore.getState().profile;
  const rates = areaRates(p);
  const start = checkinStart(p, useAppStore.getState().checkins, { rates });
  return checkinRecord(start, month, simulateMonth(start, index, seedOf(month)), { rates });
}

describe('addMonths and checkinPlan', () => {
  it('adds calendar months across the year end', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', 23)).toBe('2027-12');
  });

  it('applies the committed move only when it is the profile’s', () => {
    const p = useAppStore.getState().profile;
    const move: Move = { id: 'm', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 1, patch: { spending: { eatingOut: 100 } } };
    expect(checkinPlan(p, move)).toBe(p);
    expect(checkinPlan({ ...p, committedMoveId: 'm' }, move).spending.eatingOut.value).toBe(100);
  });
});

describe('S14 check-in, free', () => {
  it('fast-forwards one simulated month: forecast vs actual from the engine, paywall instead of Save', async () => {
    const user = userEvent.setup();
    render(<Checkin />);
    await user.click(await screen.findByRole('button', { name: c.fastForward }));

    const expected = engineMonth();
    const month = screen.getByTestId('simulated-month');
    expect(within(month).getByText(c.simulatedTag)).toBeTruthy();
    expect(within(month).getByText(formatMonth(DEC))).toBeTruthy();

    const summary = checkinSummary(useAppStore.getState().profile, [], expected, { rates: areaRates(useAppStore.getState().profile) });
    const compare = screen.getByTestId('checkin-compare');
    expect(within(compare).getAllByRole('listitem')).toHaveLength(summary.rows.length);
    expect(screen.getByTestId('checkin-total').textContent).toContain(formatMoney(summary.actualTotal));
    expect(screen.getByTestId('checkin-number-10y').textContent).toBe(formatMoney(expected.number10y));

    expect(await screen.findByRole('heading', { name: c.paywall.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.save })).toBeNull();
    expect(screen.queryByTestId('checkin-history')).toBeNull();
    expect(screen.queryByTestId('checkin-goal')).toBeNull();
    expect((screen.getByRole('button', { name: c.fastForward }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('S14 check-in, Pro', () => {
  beforeEach(() => resetProState(fakeProAdapter(statusInfo(PRO_DEMO))));

  it('saves the month into the history and continues from it', async () => {
    const user = userEvent.setup();
    render(<Checkin />);
    expect(await screen.findByTestId('checkin-history')).toBeTruthy();
    const first = engineMonth();
    await user.click(screen.getByRole('button', { name: c.fastForward }));
    await user.click(screen.getByRole('button', { name: c.save }));

    const saved = useAppStore.getState().checkins;
    expect(saved).toHaveLength(1);
    expect({ ...saved[0], savedAt: undefined }).toEqual({ ...first, savedAt: undefined });
    const rows = await screen.findAllByTestId('checkin-history-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain(formatMonth(DEC));
    expect(rows[0]!.textContent).toContain(formatMoney(first.number10y));
    expect(screen.getByRole('status').textContent).toBe(c.saved(formatMonth(DEC)));
    const value = screen.getByTestId('checkin-value');
    expect(value.textContent).toContain(c.value.paidDown(formatMoney(first.debtPaidDown)));

    // January starts from December's end balances.
    const second = engineMonth('2027-01', 2);
    expect(second.monthIndex).toBe(2);
    await user.click(screen.getByRole('button', { name: c.fastForward }));
    expect(within(screen.getByTestId('simulated-month')).getByText(formatMonth('2027-01'))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: c.save }));
    expect(useAppStore.getState().checkins.map((r) => r.month)).toEqual([DEC, '2027-01']);
    expect(useAppStore.getState().checkins[1]!.netWorth).toBeCloseTo(second.netWorth, 6);
    expect(await screen.findAllByTestId('checkin-history-row')).toHaveLength(2);
  });

  it('shows goal progress and the committed card move from the engine', async () => {
    const move: Move = { id: 'payCardFirst', kind: 'payCardFirst', level: 1, effect10y: 1, patch: { debts: [{ id: 'card-1', extraPayment: 300 }] } };
    useAppStore.getState().commitMove(move);
    useAppStore.getState().setGoal({ target: 100_000, years: 10 });
    const user = userEvent.setup();
    render(<Checkin />);
    await user.click(await screen.findByRole('button', { name: c.fastForward }));

    const s = useAppStore.getState();
    const plan = applyPatch(s.profile, move.patch);
    const rates = areaRates(plan);
    const record = checkinRecord(plan, DEC, simulateMonth(plan, 1, seedOf(DEC)), { rates });
    const summary = checkinSummary(plan, [], record, { rates, goal: s.goal, committedMove: move });

    const goal = await screen.findByTestId('checkin-goal');
    expect(within(goal).getByText(c.goal.verdicts[summary.goal!.verdict])).toBeTruthy();
    const moveCard = screen.getByTestId('checkin-move');
    if (summary.move?.kind !== 'debtPayoff') throw new Error('expected a card payoff');
    expect(moveCard.textContent).toContain(c.move.paid(formatMoney(summary.move.paid), formatMoney(6400)));
    expect(moveCard.textContent).toContain(c.move.payoff(summary.move.payoffMonths));
  });
});
