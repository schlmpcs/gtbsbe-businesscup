// @vitest-environment jsdom
// The payoff planner section of Loan Lab (M13, issue #89): the real view-model hooks on a fake payoff engine,
// behind the placeholder UI. Expected figures come from the canned plans in src/test/payoff.ts (November 2026 today).
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { common, loan as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { plannerOptions } from '@/test/payoff';
import type { PayoffPlannerVM } from './model/types';
import { useLoanLab } from './model/useLoanLab';
import { usePayoffPlanner, type PayoffPlannerOptions } from './model/usePayoffPlanner';
import { LoanLabScreen } from './ui/LoanLabScreen';

beforeEach(resetClientState);

/** The screen as the page composes it: Loan Lab's hook, the planner's hook, one screen. `patch` overrides the planner's VM. */
function Screen({ options, patch, noOffers = false }: { options: PayoffPlannerOptions | null; patch?: Partial<PayoffPlannerVM>; noOffers?: boolean }) {
  const lab = useLoanLab(noOffers ? { initialOffers: [] } : {});
  const planner = usePayoffPlanner(lab, options);
  return <LoanLabScreen vm={lab} payoff={planner && patch ? { ...planner, ...patch } : planner} />;
}

async function open(over: Parameters<typeof plannerOptions>[0] = {}, patch?: Partial<PayoffPlannerVM>) {
  const user = userEvent.setup();
  const fake = plannerOptions(over);
  render(<Screen options={fake.options} patch={patch} />);
  const section = await screen.findByRole('region', { name: t.planner.title });
  return { user, section, ...fake };
}

const compare = () => screen.getByRole('table', { name: t.planner.compare.caption });
const BAD = /Infinity|NaN|undefined|\[object|null/;

describe('Loan Lab with the planner', () => {
  it('replaces the payoff order card with the planner section', async () => {
    await open();
    expect(screen.queryByRole('heading', { name: t.payoffOrder.title })).toBeNull();
    expect(screen.getByRole('heading', { name: t.planner.title })).toBeInTheDocument();
    // The rest of Loan Lab is still there.
    expect(screen.getByRole('table', { name: t.compare.caption })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: t.extra.slider(t.offerName(1)) })).toBeInTheDocument();
  });

  it('keeps today\'s payoff order card and shows no planner while the planner is not wired', async () => {
    render(<Screen options={null} />);
    expect(await screen.findByRole('heading', { name: t.payoffOrder.title })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.planner.title })).toBeNull();
  });

  it('says what it is: a projection from the person\'s inputs, an educational simulation, not advice', async () => {
    const { section } = await open();
    expect(within(section).getByText(/educational simulation, not financial advice/)).toBeInTheDocument();
    expect(within(section).getAllByText(/Projected from your inputs/).length).toBeGreaterThan(0);
    expect(within(section).getByText(t.planner.assumptions)).toBeInTheDocument();
  });
});

describe('the comparison', () => {
  it('shows avalanche, snowball and minimums only with the debt-free month, interest and months', async () => {
    await open();
    const table = compare();
    const head = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(head[1]).toContain(t.planner.method.names.avalanche);
    expect(head[2]).toContain(t.planner.method.names.snowball);
    expect(head[3]).toContain(t.planner.method.names.minimum);
    const row = (name: string) => within(within(table).getByRole('row', { name: new RegExp(name) })).getAllByRole('cell').map((c) => c.textContent);
    // 40, 41 and 46 months after November 2026.
    expect(row(t.planner.compare.rows.debtFree)).toEqual(['March 2030', 'April 2030', 'September 2030']);
    expect(row(t.planner.compare.rows.interest)).toEqual(['$5,000', '$5,400', '$6,200']);
    expect(row(t.planner.compare.rows.months)).toEqual(['40 months', '41 months', '46 months']);
  });

  it('describes what each method optimizes, and never says which to use', async () => {
    const { section } = await open();
    for (const text of Object.values(t.planner.method.describes)) expect(within(section).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('marks the picked method and moves the mark with the toggle', async () => {
    const { user } = await open();
    const picked = () => within(compare()).getAllByRole('columnheader').filter((h) => h.textContent!.includes(t.planner.compare.picked)).map((h) => h.textContent);
    expect(picked()).toHaveLength(1);
    expect(picked()[0]).toContain(t.planner.method.names.avalanche);
    await user.click(screen.getByRole('radio', { name: t.planner.method.names.snowball }));
    expect(picked()).toHaveLength(1);
    expect(picked()[0]).toContain(t.planner.method.names.snowball);
  });

  it('says what the picked method saves against minimums: $1,200 less interest, 6 months sooner', async () => {
    await open();
    expect(screen.getByTestId('payoff-savings')).toHaveTextContent(`${t.planner.savings.title(t.planner.method.names.avalanche)}: $1,200 less interest · 6 months sooner`);
  });

  it('says "more interest" and "later" for a method that does worse than minimums, never a negative saving', async () => {
    const { user } = await open({ engineOptions: { snowball: { interestSavedVsMinimum: -300, monthsSavedVsMinimum: -165 } } });
    await user.click(screen.getByRole('radio', { name: t.planner.method.names.snowball }));
    const line = screen.getByTestId('payoff-savings');
    expect(line).toHaveTextContent('$300 more interest · 165 months later');
    expect(line.textContent).not.toMatch(/[-−]/);
    expect(line.textContent).not.toMatch(/saves|less|sooner/);
  });

  it('says the same when there is no difference', async () => {
    await open({ engineOptions: { avalanche: { interestSavedVsMinimum: 0, monthsSavedVsMinimum: 0 } } });
    expect(screen.getByTestId('payoff-savings')).toHaveTextContent(`${t.planner.savings.interestSame} · ${t.planner.savings.monthsSame}`);
  });

  it('shows an estimate tag and a note when a minimum payment was defaulted, and neither when none was', async () => {
    const { section } = await open();
    expect(within(section).getByText(t.planner.estimate)).toBeInTheDocument();
    expect(within(section).getAllByText(common.estimateTag).length).toBeGreaterThan(0);
    // The only debt left with a balance is the car loan, whose minimum is the person's own.
    resetClientState();
    const demo = cloneProfileDemo();
    useAppStore.setState({ profile: { ...demo, debts: demo.debts.filter((d) => d.id === 'auto-1') } });
    render(<Screen options={plannerOptions().options} />);
    const other = (await screen.findAllByRole('region', { name: t.planner.title })).at(-1)!;
    expect(within(other).queryByText(t.planner.estimate)).toBeNull();
  });
});

describe('the extra payment', () => {
  const slider = () => screen.getByRole('slider', { name: t.planner.extra.label });

  it('is its own control, named so it cannot be mistaken for the selected offer\'s', async () => {
    await open();
    expect(slider()).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: t.extra.slider(t.offerName(1)) })).toBeInTheDocument();
    expect(t.planner.extra.label).not.toBe(t.extra.slider(t.offerName(1)));
  });

  it('asks the engine again when the slider or the box changes', async () => {
    const { user, comparePayoff } = await open();
    fireEvent.change(slider(), { target: { value: '150' } });
    expect(comparePayoff.mock.lastCall![1]).toBe(150);
    const box = screen.getByRole('textbox', { name: t.planner.extra.inputLabel });
    await user.clear(box);
    await user.type(box, '300');
    expect(comparePayoff.mock.lastCall![1]).toBe(300);
    expect(screen.getByTestId('payoff-planner')).not.toHaveTextContent(BAD);
  });

  it('leaves the selected offer\'s own extra payment alone', async () => {
    await open();
    fireEvent.change(slider(), { target: { value: '200' } });
    expect(screen.getByTestId('extra-payoff').textContent).toBe(t.extra.payoffMonths(36)); // offer 1 over 36 months, as before
  });
});

describe('a plan that never pays off', () => {
  const never = {
    avalanche: { monthsToDebtFree: null, monthsSavedVsMinimum: null, totalInterest: 4e13, interestSavedVsMinimum: -4e13, perDebt: [], timeline: [{ month: 0, balance: 52_200 }, { month: 120, balance: 90_000 }] },
    solve: { extra: 312.4, reachable: true },
  };

  it('says "not at these payments" with the extra that would clear it in 10 years, and no date, interest or Infinity', async () => {
    const { section } = await open({ engineOptions: never });
    const table = compare();
    const debtFree = within(within(table).getByRole('row', { name: new RegExp(t.planner.compare.rows.debtFree) })).getAllByRole('cell');
    expect(debtFree[0]).toHaveTextContent(t.planner.compare.never);
    const interest = within(within(table).getByRole('row', { name: new RegExp(t.planner.compare.rows.interest) })).getAllByRole('cell');
    expect(interest[0]).toHaveTextContent(t.planner.compare.never);
    expect(within(section).getByText(t.planner.never.body)).toBeInTheDocument();
    expect(within(section).getByText(t.planner.never.fix('$313', 10))).toBeInTheDocument();
    expect(section).not.toHaveTextContent(BAD);
    expect(section.textContent).not.toContain('4,000,000'); // the 100-year interest is not shown anywhere
    expect(screen.queryByTestId('payoff-savings')).toBeNull();
  });

  it('says so when no extra could clear it', async () => {
    const { section } = await open({ engineOptions: { ...never, solve: { extra: 1_000_000, reachable: false } } });
    expect(within(section).getByText(t.planner.never.fixNone)).toBeInTheDocument();
    expect(section.textContent).not.toContain('1,000,000');
  });

  it('says minimums never pay off when only they do not, and still shows the picked plan\'s date', async () => {
    const { section } = await open({ engineOptions: { minimum: { monthsToDebtFree: null, totalInterest: 9e13 } } });
    expect(within(section).getByText(t.planner.savings.minimumNever)).toBeInTheDocument();
    expect(within(compare()).getByText('March 2030')).toBeInTheDocument();
    expect(section).not.toHaveTextContent(BAD);
  });
});

describe('the balance chart and the payoff order', () => {
  it('draws the balance as a chart with a table behind it', async () => {
    const { section } = await open();
    expect(within(section).getByRole('figure', { name: t.planner.chart.title })).toBeInTheDocument();
  });

  it('lists the debts in the picked order: kind, rate, balance, the new loan marked, the payoff month, estimates tagged', async () => {
    const { section } = await open();
    const rows = within(within(section).getByRole('list', { name: t.planner.order.title })).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining(`${t.planner.order.step(t.payoffOrder.kinds.card!, '24.4%')}`),
      expect.stringContaining(`${t.planner.order.step(t.payoffOrder.kinds.auto!, '7.4%')}`),
      expect.stringContaining(`${t.planner.order.step(t.planner.order.newLoan(t.offerName(1)), '6.9%')}`),
    ]);
    expect(rows[0]).toHaveTextContent('$6,400');
    expect(rows[0]).toHaveTextContent(t.planner.order.paidBy('November 2027'));
    expect(rows[2]).toHaveTextContent('$28,000');
    expect(within(rows[0]!).getByText(common.estimateTag)).toBeInTheDocument(); // the card's minimum is a default
    expect(within(rows[1]!).queryByText(common.estimateTag)).toBeNull();
  });

  it('follows the offer that is selected: the new loan is named after it', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: t.compare.select(t.offerName(2)) }));
    const list = within(screen.getByRole('region', { name: t.planner.title })).getByRole('list', { name: t.planner.order.title });
    expect(within(list).getByText(new RegExp(t.planner.order.newLoan(t.offerName(2)).replace('(', '\\(').replace(')', '\\)')))).toBeInTheDocument();
  });
});

describe('the target date', () => {
  const month = () => screen.getByLabelText(t.planner.target.label) as HTMLInputElement;
  const result = () => screen.getByTestId('payoff-target-result');

  it('says the extra per month a chosen month needs, rounded up to the dollar', async () => {
    await open({ engineOptions: { solve: { extra: 212.2, reachable: true } } });
    fireEvent.change(month(), { target: { value: '2029-12' } });
    expect(result()).toHaveTextContent(t.planner.target.needs('December 2029', '$213'));
  });

  it('says "on track" when the current extra already gets there', async () => {
    await open({ engineOptions: { solve: { extra: 212.2, reachable: true } } });
    fireEvent.change(screen.getByRole('slider', { name: t.planner.extra.label }), { target: { value: '250' } });
    fireEvent.change(month(), { target: { value: '2029-12' } });
    expect(result()).toHaveTextContent(t.planner.target.onTrack('December 2029', '$250'));
  });

  it('says "on track" at minimums when no extra is needed', async () => {
    await open({ engineOptions: { solve: { extra: 0, reachable: true } } });
    fireEvent.change(month(), { target: { value: '2031-01' } });
    expect(result()).toHaveTextContent(t.planner.target.onTrackMinimums('January 2031'));
  });

  it('says it is not reachable, without a made-up amount', async () => {
    await open({ engineOptions: { solve: { extra: 1_000_000, reachable: false } } });
    fireEvent.change(month(), { target: { value: '2026-12' } });
    expect(result()).toHaveTextContent(t.planner.target.unreachable('December 2026'));
    expect(result().textContent).not.toContain('1,000,000');
  });

  it('offers only months from next month to 100 years on, and explains a month in the past or too far', async () => {
    const { section } = await open({}, undefined);
    expect(month().min).toBe('2026-12');
    expect(month().max).toBe('2126-11');
    fireEvent.change(month(), { target: { value: '2026-10' } });
    expect(within(section).getByText(t.planner.target.past)).toBeInTheDocument();
    fireEvent.change(month(), { target: { value: '2126-12' } });
    expect(within(section).getByText(t.planner.target.tooFar(100))).toBeInTheDocument();
  });

  it('explains text that is not a month (a browser without a month picker), and clears with the button', async () => {
    const { user, section } = await open({}, { target: { status: 'invalid' } });
    expect(within(section).getByText(t.planner.target.invalid)).toBeInTheDocument();
    fireEvent.change(month(), { target: { value: '2029-12' } });
    await user.click(screen.getByRole('button', { name: t.planner.target.clear }));
    expect(month().value).toBe('');
  });

  it('shows an error line when the solver fails', async () => {
    const { section } = await open({}, { target: { status: 'error', error: { kind: 'unknown', message: 'x' } } });
    expect(within(section).getByText(t.planner.target.error)).toBeInTheDocument();
  });
});

describe('the states', () => {
  it('no debts: one line and a link to the balance sheet, no chart, no table', async () => {
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts: [] } });
    render(<Screen options={plannerOptions().options} noOffers />);
    const section = await screen.findByRole('region', { name: t.planner.title });
    expect(within(section).getByText(t.planner.noDebts)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: t.planner.editDebts })).toHaveAttribute('href', '/me/balance');
    expect(within(section).queryByRole('figure')).toBeNull();
    expect(within(section).queryByRole('table')).toBeNull();
    expect(section).not.toHaveTextContent(BAD);
  });

  it('with debts: still links to the balance sheet, and has no form for entering debts', async () => {
    const { section } = await open();
    expect(within(section).getByRole('link', { name: t.planner.editDebts })).toHaveAttribute('href', '/me/balance');
    expect(within(section).queryByRole('textbox', { name: /balance|apr|rate/i })).toBeNull();
  });

  it('streamer mode: the section says it is hidden and shows no number', async () => {
    const { section } = await open({ streamer: true });
    expect(within(section).getByText(t.planner.hidden)).toBeInTheDocument();
    expect(section.textContent).not.toMatch(/\$\d/);
    expect(within(section).queryByRole('table')).toBeNull();
    expect(within(section).queryByRole('slider')).toBeNull();
  });

  it('engine failure: an error line, no numbers, nothing else', async () => {
    const { section } = await open({ engineOptions: { throws: new RangeError('Duplicate debt id: card-1') } });
    expect(within(section).getByRole('alert')).toHaveTextContent(t.planner.errors.other);
    expect(within(section).queryByRole('table')).toBeNull();
    expect(section.textContent).not.toContain('Duplicate debt id');
  });

  it('an answer with a NaN in it: an error line, never the number', async () => {
    const { section } = await open({ engineOptions: { avalanche: { totalInterest: Number.NaN } } });
    expect(within(section).getByRole('alert')).toHaveTextContent(t.planner.errors.invalidResponse);
    expect(section).not.toHaveTextContent(BAD);
  });

  it('no Infinity or NaN reaches the screen with a target set on a plan that never pays off', async () => {
    const { section } = await open({
      engineOptions: { avalanche: { monthsToDebtFree: null, monthsSavedVsMinimum: null, totalInterest: 4e13, interestSavedVsMinimum: -4e13 }, solve: { extra: 80, reachable: true } },
    });
    fireEvent.change(screen.getByLabelText(t.planner.target.label), { target: { value: '2029-12' } });
    expect(section).not.toHaveTextContent(BAD);
    expect(section.textContent).not.toMatch(/[-−]\$/);
  });
});
