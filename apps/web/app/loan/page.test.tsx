// @vitest-environment jsdom
// S12 page: the real hook + engine (loan stub until T3) behind the placeholder UI (jsdom). The parser is mocked.
import type { LoanInput, LoanResult } from '@lifeguessr/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loan as t, toolPlan } from '@/copy';
import { resetPlanStore, usePlanStore } from '@/features/plan/model/planStore';
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
  resetPlanStore();
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

  it('the answer names the cheapest offer in dollars and draws what each total is made of', async () => {
    await renderReady();
    // Sample offers: A $31,078, B $32,212, C $36,329 in total (engine loan math).
    expect(screen.getByTestId('loan-verdict-headline').textContent).toBe(t.verdict.saves(t.offerName(1), t.offerName(2), '$1,134'));
    const race = screen.getByTestId('loan-cost-race');
    expect(within(race).getAllByRole('listitem')).toHaveLength(3);
    expect(within(race).getByText(t.cost.row(t.offerName(1), '$31,078', '$28,000', '$3,078', '$0'))).toBeTruthy();
    expect(screen.getByRole('figure', { name: t.balance.title(t.offerName(1)) })).toBeTruthy();
  });

  it('"Add to my plan" puts the selected offer on the active plan scenario as a financed Expense', async () => {
    const user = await renderReady();
    const card = screen.getByTestId('tool-plan-impact');
    expect(within(card).getByRole('heading', { name: toolPlan.title })).toBeTruthy();
    const before = usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!.events.length;
    await user.click(within(card).getByRole('button', { name: toolPlan.add }));
    const active = usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!;
    expect(active.events).toHaveLength(before + 1);
    expect(active.events.at(-1)).toMatchObject({
      type: 'expense',
      name: t.plan.eventName(t.offerName(1)),
      amount: 28_000,
      cadence: 'once',
      financing: { downPayment: 0, apr: 0.069, termMonths: 36 },
      enabled: true,
    });
    expect(within(card).getByText(toolPlan.added)).toBeTruthy();
    expect(within(card).getByRole('link', { name: new RegExp(toolPlan.open) }).getAttribute('href')).toBe('/plan');
  });

  it('the extra-payment slider shortens the payoff', async () => {
    await renderReady();
    const payoff = screen.getByTestId('extra-payoff');
    expect(payoff.textContent).toBe(t.extra.payoffMonths(36));
    fireEvent.change(screen.getByRole('slider', { name: t.extra.slider(t.offerName(1)) }), { target: { value: '200' } });
    await waitFor(() => expect(payoff.textContent).not.toBe(t.extra.payoffMonths(36)));
    // In the offer's own result: the payoff planner below has its own "sooner" (it opens at a suggested extra).
    expect(within(screen.getByTestId('extra-result')).getByText((text) => text.endsWith(' sooner'))).toBeTruthy();
  });

  it('selecting another offer moves the gauge and the slider to it', async () => {
    const user = await renderReady();
    await user.click(screen.getByRole('button', { name: t.compare.select(t.offerName(2)) }));
    expect(screen.getByRole('meter', { name: t.gauge.after(t.offerName(2)) })).toBeTruthy();
    expect(screen.getByRole('slider', { name: t.extra.slider(t.offerName(2)) })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.compare.select(t.offerName(2)) }).getAttribute('aria-pressed')).toBe('true');
  });

  it('edits an offer on its card (APR typed as a percent) and flags an emptied field', async () => {
    const user = await renderReady();
    expect(screen.queryByRole('group', { name: t.edit.fieldsLabel(t.offerName(1)) })).toBeNull();
    const toggle = screen.getByRole('button', { name: t.edit.openLabel(t.offerName(1)) });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    const panel = screen.getByRole('group', { name: t.edit.fieldsLabel(t.offerName(1)) });
    const apr = within(panel).getByRole('textbox', { name: t.edit.apr });
    await user.clear(apr);
    expect(within(panel).getByText(t.edit.errors.apr!)).toBeTruthy();
    expect(within(screen.getByRole('table', { name: t.compare.caption })).getAllByText(t.compare.invalid).length).toBeGreaterThan(0);
    await user.type(apr, '0');
    await waitFor(() => expect(within(panel).queryByText(t.edit.errors.apr!)).toBeNull());
    // 0% APR: $28,000 / 36 months.
    expect(within(screen.getByRole('table', { name: t.compare.caption })).getByText('$778')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.edit.closeLabel(t.offerName(1)) }));
    expect(screen.queryByRole('group', { name: t.edit.fieldsLabel(t.offerName(1)) })).toBeNull();
  });

  it('removes and adds offers (up to 3) from the cards', async () => {
    const user = await renderReady();
    // Three offers: the list is full, so there is no "Add an offer" card.
    expect(screen.queryByRole('button', { name: t.edit.add })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.edit.openLabel(t.offerName(3)) }));
    await user.click(screen.getByRole('button', { name: t.edit.remove(t.offerName(3)) }));
    expect(screen.queryByRole('button', { name: t.compare.select(t.offerName(3)) })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.edit.add }));
    expect(screen.getByRole('button', { name: t.compare.select(t.offerName(3)) })).toBeTruthy();
    // The new offer opens for editing.
    expect(screen.getByRole('group', { name: t.edit.fieldsLabel(t.offerName(3)) })).toBeTruthy();
  });

  it('a typed offer is confirmed before it replaces the selected one (list full)', async () => {
    const parsed: LoanInput = { amount: 20000, apr: 0.05, termMonths: 48 };
    parseText.mockResolvedValue({ value: parsed, inferred: ['termMonths'] });
    const user = await renderReady();
    expect(screen.queryByRole('textbox', { name: t.parse.label })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.parse.open }));
    await user.type(screen.getByRole('textbox', { name: t.parse.label }), '20k at 5% for 4 years');
    await user.click(screen.getByRole('button', { name: t.parse.submit }));
    const confirm = await screen.findByRole('region', { name: t.parse.confirmTitle });
    expect(within(confirm).getByText(t.parse.termMonths(48))).toBeTruthy();
    expect(within(confirm).getByText(`(${t.parse.guessed})`)).toBeTruthy();
    await user.click(within(confirm).getByRole('button', { name: t.parse.confirmReplace }));
    await user.click(screen.getByRole('button', { name: t.edit.openLabel(t.offerName(1)) }));
    const panel = screen.getByRole('group', { name: t.edit.fieldsLabel(t.offerName(1)) });
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
    cost: null,
  });

  it('warns clearly when an offer never pays off', () => {
    render(<OfferCompare offers={[offer('a', 12), offer('b', null)]} selectedOfferId="a" selectOffer={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe(t.neverPaysOff(t.offerName(2)));
    expect(screen.getByText(t.compare.never)).toBeTruthy();
  });
});
