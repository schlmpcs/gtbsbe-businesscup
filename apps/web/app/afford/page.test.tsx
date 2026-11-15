// @vitest-environment jsdom
// S11 page: the real hook + engine behind the placeholder UI (jsdom). The parser is mocked.
import type { Purchase } from '@lifeguessr/types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { afford as t, common, forecast, pro, toolPlan, workTime as workTimeCopy } from '@/copy';
import { resetPlanStore, usePlanStore } from '@/features/plan/model/planStore';
import type { AffordResultVM } from '@/features/afford/model/types';
import { AffordResultPanel } from '@/features/afford/ui/AffordResultPanel';
import type * as AiParse from '@/lib/api/aiParse';
import { resetClientState } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import AffordPage from './page';

const parseText = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/aiParse', async (importOriginal) => ({
  ...(await importOriginal<typeof AiParse>()),
  parseText,
}));

beforeEach(() => {
  resetClientState();
  resetPlanStore();
  resetProState(); // a free user, and no request leaves the test
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
  it('a $300 cash purchase fits (stretched on the demo’s thin cushion), with the chart, horizons and cheapest way', async () => {
    const user = await renderReady();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(t.screens.S11); // no screen ID shown
    expect(screen.getByText(t.form.empty)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '300');
    await waitFor(() => expect(verdict().dataset.verdict).toBe('fits'));
    // The demo keeps about 1 month of costs in cash, under the 3 months "comfortably" needs.
    expect(verdict().dataset.tier).toBe('stretched');
    expect(verdict().textContent).toBe(t.result.tiers.stretched);
    expect(within(screen.getByTestId('afford-kpis')).getByText(t.result.kpis.cushion)).toBeTruthy();
    expect(screen.getByRole('figure', { name: t.result.chartTitle(t.defaultPurchaseLabel) })).toBeTruthy();
    const table = screen.getByRole('table', { name: t.result.horizonsCaption });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText(t.result.cheapestTitle)).toBeTruthy();
    expect(screen.getByText((text) => text.startsWith(t.result.cheapestSame))).toBeTruthy();
    for (const tag of screen.getAllByTestId('afford-forecast-source')) expect(tag).toHaveTextContent(forecast.source.rules);
  });

  it('"Add to my plan" measures the purchase on the plan and adds it to the active scenario', async () => {
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.form.label }), 'Couch');
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '2400');
    const card = await screen.findByTestId('tool-plan-impact');
    expect(within(card).getByText(toolPlan.atRetirement(67))).toBeTruthy();
    const active = () => usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId)!;
    const before = active().events.length;
    await user.click(within(card).getByRole('button', { name: toolPlan.add }));
    expect(active().events).toHaveLength(before + 1);
    expect(active().events.at(-1)).toMatchObject({ type: 'expense', name: 'Couch', amount: 2400, cadence: 'once', enabled: true });
    expect(within(card).getByText(toolPlan.added)).toBeTruthy();
    // Once added, the same purchase can't be added twice.
    expect(within(card).queryByRole('button', { name: toolPlan.add })).toBeNull();
  });

  it('an example chip fills the fields', async () => {
    const user = await renderReady();
    const ex = t.form.examples[1];
    await user.click(screen.getByRole('button', { name: t.form.example(ex.label, '$1,200') }));
    expect((screen.getByRole('textbox', { name: t.form.label }) as HTMLInputElement).value).toBe(ex.label);
    expect((screen.getByRole('textbox', { name: t.form.amount }) as HTMLInputElement).value).toBe('1,200');
    await waitFor(() => expect(verdict()).toBeTruthy());
  });

  it('a $15,000 card purchase is a no, with the reason in plain words', async () => {
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '15000');
    await user.click(screen.getByRole('radio', { name: t.form.payWithOptions.card }));
    await waitFor(() => expect(verdict().dataset.verdict).toBe('no'));
    expect(verdict().textContent).toBe(t.result.tiers.notYet);
    expect(screen.getByText(t.result.failsOn.cushion(t.result.cushionMonths(1)))).toBeTruthy();
  });

  it('paying with a loan starts on typical terms, tagged estimate: a verdict with no typing and no errors', async () => {
    const user = await renderReady();
    await user.type(screen.getByRole('textbox', { name: t.form.label }), 'Car');
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '28000');
    await user.click(screen.getByRole('radio', { name: t.form.payWithOptions.loan }));
    await waitFor(() => expect(verdict()).toBeTruthy());
    expect(screen.queryByText(t.form.fixFields)).toBeNull();
    expect(screen.queryByText(t.form.errors['loan.apr']!)).toBeNull();
    expect(screen.getAllByText(t.form.loanTypical.auto)).toHaveLength(2); // the APR and the term
    // A field the user empties is theirs: then it is flagged.
    await user.clear(screen.getByRole('textbox', { name: t.form.apr }));
    expect(screen.getByText(t.form.errors['loan.apr']!)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: t.form.apr }), '9.9');
    await waitFor(() => expect(verdict()).toBeTruthy());
    expect(screen.getAllByText(t.form.loanTypical.auto)).toHaveLength(1); // only the term is still typical
  });

  it('free text is shown for confirmation before it fills the form; Pro saves it to the wishlist', async () => {
    resetProState(fakeProAdapter(statusInfo(PRO_DEMO)));
    const parsed: Purchase = { label: 'Gym', amount: 60, recurring: 'monthly', payWith: 'card' };
    parseText.mockResolvedValue({ value: parsed, inferred: ['payWith'] });
    const user = await renderReady();
    // The fields are the main path; the sentence box opens from a small link under them.
    expect(screen.queryByRole('textbox', { name: t.parse.label })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.parse.open }));
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

    await user.click(await screen.findByRole('button', { name: t.wishlist.add }));
    expect(screen.getByRole('button', { name: t.wishlist.loadLabel('Gym') })).toBeTruthy();
  });

  it('a free user sees a link to Pro instead of the wishlist save button, once there is a verdict', async () => {
    const user = await renderReady();
    // Before a verdict: no Pro card, and no empty wishlist section.
    expect(screen.queryByText(pro.lock.wishlistBody)).toBeNull();
    expect(screen.queryByRole('region', { name: t.wishlist.title })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: t.form.amount }), '300');
    await waitFor(() => expect(verdict().dataset.verdict).toBe('fits'));
    const note = await screen.findByRole('note');
    expect(within(note).getByText(pro.lock.wishlistBody)).toBeTruthy();
    expect(within(note).getByRole('link', { name: pro.lock.cta }).getAttribute('href')).toBe('/pro');
    expect(screen.queryByRole('button', { name: t.wishlist.add })).toBeNull();
  });

  it('a parser failure falls back to the form', async () => {
    parseText.mockRejectedValue(new Error('boom'));
    const user = await renderReady();
    await user.click(screen.getByRole('button', { name: t.parse.open }));
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
    cheapestWayFits: true,
    goalEffect: null,
    todaysDollars: false,
    forecastSource: 'rules',
    withPoints: points,
    withoutPoints: points,
    horizons: [],
    workTime: null,
    tier: 'notYet',
    stretchedBy: null,
    cushion: { before: 1.2, after: 0.8 },
    debtLoad: { before: 0.1, after: 0.4 },
    chart: [0, 5, 10].map((year) => ({ year, with: 1000 * year, without: 1200 * year })),
  };
  const rules = { cushionMonths: 1, debtLoadRed: 0.36, debtLoadYellow: 0.2, comfortableCushionMonths: 3 };
  const panel = (data: AffordResultVM) => (
    <AffordResultPanel result={{ status: 'ready', data }} rules={rules} invalidFields={[]} purchaseLabel="Car" chosenWay="loan" />
  );

  it('labels the chart and the horizon numbers as the rules-based estimate (S10 may show the AI model’s number)', () => {
    const at = (month: 1 | 12 | 60 | 120) => ({ month, with: points[0]!, without: points[0]!, deltaMid: 0 });
    render(panel({ ...base, horizons: [at(1), at(12), at(60), at(120)] }));
    for (const card of [screen.getByTestId('afford-chart'), screen.getByTestId('afford-horizons')]) {
      expect(within(card).getByTestId('afford-forecast-source')).toHaveTextContent(forecast.source.rules);
    }
    expect(screen.getAllByTestId('afford-forecast-source')).toHaveLength(2);
  });

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
    const { unmount } = render(panel({ ...base, verdict: 'fits', tier: 'comfortable', failsOn: null, baselineFails: true }));
    expect(screen.getByRole('note').textContent).toBe(t.result.baseline.fits);
    unmount();
    render(panel({ ...base, verdict: 'wait', waitMonths: 3, failsOn: 'cushion' }));
    expect(screen.getByTestId('afford-verdict').textContent).toBe(t.result.tiers.notYet);
    expect(screen.getByText(t.result.reasons.wait(3))).toBeTruthy();
    expect(screen.getByText(t.result.waitBody(3))).toBeTruthy();
    expect(screen.getByText(t.result.failsOn.cushion(t.result.cushionMonths(1)))).toBeTruthy();
  });

  it('says why it is comfortable or stretched, with the numbers from the view-model', () => {
    const { unmount } = render(panel({ ...base, verdict: 'fits', tier: 'comfortable', failsOn: null, cushion: { before: 6, after: 5.5 }, debtLoad: { before: 0.1, after: 0.1 } }));
    expect(screen.getByTestId('afford-verdict').textContent).toBe(t.result.tiers.comfortable);
    expect(screen.getByText(t.result.reasons.comfortable('5.5 mo', '10%'))).toBeTruthy();
    unmount();
    const { unmount: u2 } = render(panel({ ...base, verdict: 'fits', tier: 'stretched', stretchedBy: 'debtLoad', failsOn: null, debtLoad: { before: 0.1, after: 0.25 }, cushion: { before: 6, after: 5 } }));
    expect(screen.getByText(t.result.reasons.stretchedDebt('25%', '20%'))).toBeTruthy();
    u2();
    render(panel({ ...base, verdict: 'fits', tier: 'stretched', stretchedBy: 'cushion', failsOn: null, cushion: { before: 1.2, after: 0.8 } }));
    expect(screen.getByText(t.result.reasons.stretchedThin('1.2 mo', '0.8 mo', '3 mo'))).toBeTruthy();
  });

  it('shows the price in work time next to the verdict, tagged when take-home pay is an estimate', () => {
    const { unmount } = render(panel(base));
    expect(screen.queryByTestId('afford-work-time')).toBeNull();
    unmount();
    const work = { unit: 'days', amount: 3, per: false, hoursPerWeek: 40, isEstimate: false } as const;
    const { rerender } = render(panel({ ...base, workTime: work }));
    const line = screen.getByTestId('afford-work-time');
    expect(line).toHaveTextContent(workTimeCopy.ofYourWork('days', 3));
    expect(within(line).queryByText(common.estimateTag)).toBeNull();
    rerender(panel({ ...base, workTime: { ...work, unit: 'weeks', amount: 2.5, per: 'monthly', isEstimate: true } }));
    expect(screen.getByTestId('afford-work-time')).toHaveTextContent('= 2.5 weeks of your work each month');
    expect(within(screen.getByTestId('afford-work-time')).getByText(common.estimateTag)).toBeTruthy();
  });
});
