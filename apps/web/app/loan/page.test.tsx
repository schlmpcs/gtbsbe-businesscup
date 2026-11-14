// @vitest-environment jsdom
// S12 page: the real hook + engine (loan stub until T3) behind the placeholder UI (jsdom). The parser is mocked.
import type { LoanInput, LoanResult } from '@lifeguessr/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loan as t } from '@/copy';
import type { LoanOfferVM } from '@/features/loan/model/types';
import { OfferCompare } from '@/features/loan/ui/OfferCompare';
import type * as AiParse from '@/lib/api/aiParse';
import { resetClientState } from '@/test/clientState';
import LoanLabPage from './page';

const parseText = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/aiParse', async (importOriginal) => ({
  ...(await importOriginal<typeof AiParse>()),
  parseText,
}));

beforeEach(() => {
  resetClientState();
  parseText.mockReset();
});

async function renderReady() {
  const user = userEvent.setup();
  render(<LoanLabPage />);
  await screen.findByRole('table', { name: t.compare.caption });
  return user;
}

describe('/loan (S12)', () => {
  it('compares the 3 fixture offers side by side', async () => {
    await renderReady();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(t.screens.S12); // no screen ID shown
    const table = screen.getByRole('table', { name: t.compare.caption });
    for (const n of [1, 2, 3]) expect(within(table).getByRole('button', { name: t.compare.select(t.offerName(n)) })).toBeTruthy();
    expect(within(table).getByText('$863')).toBeTruthy(); // $28,000 at 6.9% for 36 months (ENGINEERING.md)
    expect(within(table).getByText(t.compare.lowestCost)).toBeTruthy();
    expect(screen.getAllByRole('meter')).toHaveLength(2);
  });

  it('the extra-payment slider shortens the payoff', async () => {
    await renderReady();
    const payoff = screen.getByTestId('extra-payoff');
    expect(payoff.textContent).toBe(t.extra.payoffMonths(36));
    fireEvent.change(screen.getByRole('slider', { name: t.extra.slider(t.offerName(1)) }), { target: { value: '200' } });
    await waitFor(() => expect(payoff.textContent).not.toBe(t.extra.payoffMonths(36)));
    expect(screen.getByText((text) => text.endsWith(' sooner'))).toBeTruthy();
  });

  it('selecting another offer moves the gauge and the slider to it', async () => {
    const user = await renderReady();
    await user.click(screen.getByRole('button', { name: t.compare.select(t.offerName(2)) }));
    expect(screen.getByRole('meter', { name: t.gauge.after(t.offerName(2)) })).toBeTruthy();
    expect(screen.getByRole('slider', { name: t.extra.slider(t.offerName(2)) })).toBeTruthy();
    expect(screen.getByRole('tab', { name: t.offerName(2) }).getAttribute('aria-selected')).toBe('true');
  });

  it('edits an offer (APR typed as a percent) and flags an emptied field', async () => {
    const user = await renderReady();
    const panel = screen.getByRole('tabpanel', { name: t.offerName(1) });
    const apr = within(panel).getByRole('textbox', { name: t.edit.apr });
    await user.clear(apr);
    expect(within(panel).getByText(t.edit.errors.apr!)).toBeTruthy();
    expect(within(screen.getByRole('table', { name: t.compare.caption })).getAllByText(t.compare.invalid).length).toBeGreaterThan(0);
    await user.type(apr, '0');
    await waitFor(() => expect(within(panel).queryByText(t.edit.errors.apr!)).toBeNull());
    // 0% APR: $28,000 / 36 months.
    expect(within(screen.getByRole('table', { name: t.compare.caption })).getByText('$778')).toBeTruthy();
  });

  it('removes and adds offers (up to 3)', async () => {
    const user = await renderReady();
    expect((screen.getByRole('button', { name: t.edit.add }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('tab', { name: t.offerName(3) }));
    await user.click(screen.getByRole('button', { name: t.edit.remove(t.offerName(3)) }));
    expect(screen.queryByRole('tab', { name: t.offerName(3) })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.edit.add }));
    expect(screen.getByRole('tab', { name: t.offerName(3) })).toBeTruthy();
  });

  it('a typed offer is confirmed before it replaces the selected one (list full)', async () => {
    const parsed: LoanInput = { amount: 20000, apr: 0.05, termMonths: 48 };
    parseText.mockResolvedValue({ value: parsed, inferred: ['termMonths'] });
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.parse.label }), '20k at 5% for 4 years');
    await user.click(screen.getByRole('button', { name: t.parse.submit }));
    const confirm = await screen.findByRole('region', { name: t.parse.confirmTitle });
    expect(within(confirm).getByText(t.parse.termMonths(48))).toBeTruthy();
    expect(within(confirm).getByText(`(${t.parse.guessed})`)).toBeTruthy();
    await user.click(within(confirm).getByRole('button', { name: t.parse.confirmReplace }));
    const panel = screen.getByRole('tabpanel', { name: t.offerName(1) });
    expect((within(panel).getByRole('textbox', { name: t.edit.amount }) as HTMLInputElement).value).toBe('20,000');
  });
});

describe('OfferCompare', () => {
  const result = (payoffMonth: number | null): LoanResult => ({
    monthly: 100,
    totalInterest: 50,
    totalCost: 1050,
    payoffMonth,
    debtLoadBefore: 0.1,
    debtLoadAfter: 0.2,
    effect10y: 0,
    schedule: [],
  });
  const offer = (id: string, payoffMonth: number | null): LoanOfferVM => ({
    id,
    input: { amount: 1000, apr: 0.1, termMonths: 12 },
    result: result(payoffMonth),
    invalidFields: [],
    error: null,
    isLowestCost: false,
    isLowestMonthly: false,
    debtLoadAfter: null,
  });

  it('warns clearly when an offer never pays off', () => {
    render(<OfferCompare offers={[offer('a', 12), offer('b', null)]} selectedOfferId="a" selectOffer={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe(t.neverPaysOff(t.offerName(2)));
    expect(screen.getByText(t.compare.never)).toBeTruthy();
  });
});
