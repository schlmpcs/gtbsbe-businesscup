// @vitest-environment jsdom
// S11 page: the real hook + engine behind the placeholder UI (jsdom). The parser is mocked.
import type { Purchase } from '@lifeguessr/types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { afford as t } from '@/copy';
import type { AffordResultVM } from '@/features/afford/model/types';
import { AffordResultPanel } from '@/features/afford/ui/AffordResultPanel';
import type * as AiParse from '@/lib/api/aiParse';
import { resetClientState } from '@/test/clientState';
import AffordPage from './page';

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
  render(<AffordPage />);
  await screen.findByRole('heading', { name: t.form.title });
  return user;
}

const verdict = () => screen.getByTestId('afford-verdict');

describe('/afford (S11)', () => {
  it('a $300 cash purchase fits, with the chart, horizons and cheapest way', async () => {
    const user = await renderReady();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(t.screens.S11); // no screen ID shown
    expect(screen.getByText(t.form.empty)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '300');
    await waitFor(() => expect(verdict().dataset.verdict).toBe('fits'));
    expect(verdict().textContent).toBe(t.result.verdicts.fits);
    expect(screen.getByRole('figure', { name: t.result.chartTitle(t.defaultPurchaseLabel) })).toBeTruthy();
    const table = screen.getByRole('table', { name: t.result.horizonsCaption });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText(t.result.cheapestTitle)).toBeTruthy();
    expect(screen.getByText((text) => text.startsWith(t.result.cheapestSame))).toBeTruthy();
  });

  it('a $15,000 card purchase is a no, with the reason in plain words', async () => {
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '15000');
    await user.click(screen.getByRole('radio', { name: t.form.payWithOptions.card }));
    await waitFor(() => expect(verdict().dataset.verdict).toBe('no'));
    expect(screen.getByText(t.result.failsOn.cushion(t.result.cushionMonths(1)))).toBeTruthy();
  });

  it('paying with a loan asks for its terms and flags the missing APR', async () => {
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '2000');
    await user.click(screen.getByRole('radio', { name: t.form.payWithOptions.loan }));
    expect(screen.getByText(t.form.errors['loan.apr']!)).toBeTruthy();
    expect(screen.getByText(t.form.fixFields)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: t.form.apr }), '9.9');
    await user.type(screen.getByRole('textbox', { name: t.form.termMonths }), '24');
    await waitFor(() => expect(verdict()).toBeTruthy());
  });

  it('free text is shown for confirmation before it fills the form; saved to the wishlist', async () => {
    const parsed: Purchase = { label: 'Gym', amount: 60, recurring: 'monthly', payWith: 'card' };
    parseText.mockResolvedValue({ value: parsed, inferred: ['payWith'] });
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.parse.label }), 'gym 60 a month on my card');
    await user.click(screen.getByRole('button', { name: t.parse.submit }));
    const confirm = await screen.findByRole('region', { name: t.parse.confirmTitle });
    expect(within(confirm).getByText('Gym')).toBeTruthy();
    expect(within(confirm).getByText(`(${t.parse.guessed})`)).toBeTruthy();
    expect((screen.getByRole('textbox', { name: t.form.amount }) as HTMLInputElement).value).toBe('');
    await user.click(within(confirm).getByRole('button', { name: t.parse.confirm }));
    expect((screen.getByRole('textbox', { name: t.form.amount }) as HTMLInputElement).value).toBe('60');
    expect((screen.getByRole('radio', { name: t.form.recurringOptions.monthly }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(verdict()).toBeTruthy());

    await user.click(screen.getByRole('button', { name: t.wishlist.add }));
    expect(screen.getByRole('button', { name: t.wishlist.loadLabel('Gym') })).toBeTruthy();
  });

  it('a parser failure falls back to the form', async () => {
    parseText.mockRejectedValue(new Error('boom'));
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.parse.label }), 'something');
    await user.click(screen.getByRole('button', { name: t.parse.submit }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(t.parse.errors.other);
    await user.click(within(alert).getByRole('button', { name: t.parse.useForm }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AffordResultPanel', () => {
  const points = [0, 1, 12, 60, 120].map((month) => ({ month, low: 0, mid: 0, high: 0 }));
  const base: AffordResultVM = {
    verdict: 'no',
    waitMonths: null,
    failsOn: 'debtLoad',
    baselineFails: false,
    cheapestWay: 'cash',
    todaysDollars: false,
    withPoints: points,
    withoutPoints: points,
    horizons: [],
  };
  const rules = { cushionMonths: 1, debtLoadRed: 0.36 };
  const panel = (data: AffordResultVM) => (
    <AffordResultPanel result={{ status: 'ready', data }} rules={rules} invalidFields={[]} purchaseLabel="Car" chosenWay="loan" />
  );

  it('names the rule the purchase breaks, with the threshold from the view-model', () => {
    render(panel(base));
    expect(screen.getByText(t.result.failsOn.debtLoad('36%'))).toBeTruthy();
    expect(screen.queryByText((text) => text.startsWith(t.result.baseline.no))).toBeNull();
  });

  it('when the plan already breaks a rule, says so instead of blaming the purchase', () => {
    render(panel({ ...base, baselineFails: true, failsOn: 'cardRevolves' }));
    expect(screen.getByText(`${t.result.baseline.no} ${t.result.failsOn.cardRevolves}`)).toBeTruthy();
  });

  it('fits with a broken baseline shows the heads-up; wait shows the months', () => {
    const { unmount } = render(panel({ ...base, verdict: 'fits', failsOn: null, baselineFails: true }));
    expect(screen.getByRole('note').textContent).toBe(t.result.baseline.fits);
    unmount();
    render(panel({ ...base, verdict: 'wait', waitMonths: 3, failsOn: 'cushion' }));
    expect(screen.getByTestId('afford-verdict').textContent).toBe(t.result.verdicts.wait(3));
    expect(screen.getByText(t.result.waitBody(3))).toBeTruthy();
    expect(screen.getByText(t.result.failsOn.cushion(t.result.cushionMonths(1)))).toBeTruthy();
  });
});
