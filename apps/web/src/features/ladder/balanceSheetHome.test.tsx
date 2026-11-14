// @vitest-environment jsdom
// JF4 S8 "Your home" on the real view-model: pick own, see the owner costs, add the mortgage, back to rent.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { ladder } from '@/copy';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { useBalanceSheet } from './model/useBalanceSheet';
import { useLadderProgress } from './model/useLadderProgress';
import { BalanceSheet } from './ui/BalanceSheet';

const h = ladder.balance.home;

function Page() {
  return <BalanceSheet vm={useBalanceSheet()} progress={useLadderProgress()} />;
}

beforeEach(resetClientState);

it('rent → own with a mortgage → add the mortgage → rent', async () => {
  const user = userEvent.setup();
  render(<Page />);
  const section = await screen.findByTestId('home-section');
  expect(within(section).getByText(h.rentNote)).toBeTruthy();

  await user.click(within(section).getByLabelText(h.tenures.mortgage));
  // Owner costs for 75206 at the area median $615,400 (hand-calculated in profileOps.test): $2,050/mo.
  expect(within(section).getByTestId('owner-costs-total').textContent).toBe(h.perMonth('$2,050'));
  expect(within(section).getByText(h.costLines.propertyTax)).toBeTruthy();

  await user.click(within(section).getByRole('button', { name: new RegExp(h.addMortgage) }));
  const form = within(section).getByRole('form', { name: h.addMortgage });
  await user.type(within(form).getByLabelText(ladder.balance.balanceLabel), '300000');
  await user.click(within(form).getByRole('button', { name: ladder.balance.save }));
  expect(useAppStore.getState().profile.debts.some((d) => d.kind === 'mortgage')).toBe(true);
  expect(within(section).queryByRole('button', { name: new RegExp(h.addMortgage) })).toBeNull();

  await user.click(within(section).getByLabelText(h.tenures.rent));
  expect(useAppStore.getState().profile.home).toBeUndefined();
});
