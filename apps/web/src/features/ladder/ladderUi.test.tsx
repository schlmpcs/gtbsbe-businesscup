// @vitest-environment jsdom
// Ladder UI (features/ladder/ui) with hand-made view-models: states the e2e path can't reach yet
// (S9 errors and review states, parse errors and confirmation on S7), the S8 debt form units, and
// the one-task-per-step frame (one orange CTA, a text action, no 10-year strip before S9).
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { common, forecast, ladder } from '@/copy';
import type {
  BalanceSheetVM, ClosestLifeVM, GuessYourselfVM, LadderProgressVM, LifeCandidateVM, ParsedRowVM, QuickSlidersVM,
  StatementUploadVM,
} from './model/types';
import { BalanceSheet } from './ui/BalanceSheet';
import { artFor, ClosestLife } from './ui/ClosestLife';
import { DebtForm } from './ui/DebtForm';
import { DescribeLife } from './ui/DescribeLife';
import { GuessYourself } from './ui/GuessYourself';
import { StatementUpload } from './ui/StatementUpload';

const progress: LadderProgressVM = {
  status: 'ready',
  rungs: (['S5', 'S6', 'S9', 'S8'] as const).map((screen, i) => ({ screen, href: `/x/${screen}`, done: i < 2 })),
  doneCount: 2,
  in10y: { month: 120, low: 40_000, mid: 60_000, high: 90_000 },
  bandWidth: 50_000,
  bandWidthAllEstimated: 100_000,
  bandNarrowed: 0.5,
  estimates: { left: 6, total: 14 },
  in10ySource: 'rules',
  futureHref: '/future',
  byHandHref: '/me/sliders',
};

const zeros = (over: Partial<Record<CostCategory, number>> = {}) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

function uploadVM(over: Partial<StatementUploadVM> = {}): StatementUploadVM {
  return {
    status: 'idle',
    error: null,
    lastRead: null,
    pending: [],
    lines: [],
    summary: null,
    questions: [],
    answerCategory: vi.fn(),
    answerAmount: vi.fn(),
    skipQuestion: vi.fn(),
    amountBounds: { min: 0, max: 100_000, step: 1 },
    history: [],
    hasDriftHistory: false,
    whatWeKeep: { months: [], categories: [], takeHomePay: false, savedProfileToServer: false },
    readFile: null,
    trySample: vi.fn(),
    submitTotals: vi.fn(),
    apply: vi.fn(),
    discard: vi.fn(),
    ...over,
  };
}

describe('LadderShell (via any rung)', () => {
  it('shows the step pills with the current one marked', () => {
    render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const steps = screen.getByRole('navigation', { name: ladder.shell.stepsLabel });
    expect(within(steps).getAllByRole('link')).toHaveLength(4);
    expect(within(steps).getByRole('link', { current: 'step' })).toHaveAttribute('href', '/x/S9');
    expect(screen.getByText(ladder.shell.stepsDone(2, 4))).toBeInTheDocument();
  });

  it('the last step: one short 10-year line above the CTA to the forecast, tagged as an estimate; no technical wording', () => {
    const { unmount } = render(<StatementUpload vm={uploadVM()} progress={progress} />);
    expect(screen.queryByTestId('ladder-in10y')).toBeNull(); // S9 is not the last step
    unmount();
    // The shell is the same on every rung: here S9 stands in for the last step.
    const last = { ...progress, rungs: progress.rungs.filter((r) => r.screen !== 'S8') };
    render(<StatementUpload vm={uploadVM()} progress={last} />);
    expect(screen.getByRole('link', { name: ladder.shell.cta.last })).toHaveAttribute('href', '/future');
    const line = screen.getByTestId('ladder-in10y');
    expect(line).toHaveTextContent(`${ladder.shell.in10yLabel}$60,000${common.estimateTag}`);
    expect(screen.queryByText(forecast.source.rulesPreview)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('S5–S8 have no 10-year strip: one orange CTA and one text action', () => {
    const vm: GuessYourselfVM = {
      status: 'ready',
      guess: { value: 3000, min: 1000, max: 15000, step: 10, position: 0.4 },
      savedGuess: null,
      reveal: null,
      bridge: null,
      setGuess: vi.fn(),
      setGuessPosition: vi.fn(),
      submit: vi.fn(),
    };
    render(<GuessYourself vm={vm} progress={progress} />);
    expect(screen.queryByTestId('ladder-in10y')).toBeNull();
    expect(screen.queryByText(forecast.source.rulesPreview)).toBeNull();
    expect(screen.queryByText(ladder.shell.in10yLabel)).toBeNull();
    expect(screen.getByRole('link', { name: ladder.shell.skip.step })).toHaveAttribute('href', '/x/S6');
  });
});

describe('ClosestLife (S6) art', () => {
  const life = (kids: number, bedrooms: LifeCandidateVM['bedrooms'], carPrice: number | null) => ({
    kids: Array.from({ length: kids }, () => 'schoolAge' as const),
    bedrooms,
    carPrice,
  });

  it('matches the household: studio, 1-bed apartment, family house, with or without a car', () => {
    expect(artFor(life(0, 0, null))).toBe('home-studio');
    expect(artFor(life(0, 1, null))).toBe('home-apartment-nocar');
    expect(artFor(life(0, 1, 62000))).toBe('home-apartment');
    expect(artFor(life(1, 2, 18000))).toBe('home-family');
    expect(artFor(life(1, 2, null))).toBe('home-cottage');
    expect(artFor(life(2, 4, 52000))).toBe('home-large');
  });
});

describe('ClosestLife (S6) About you', () => {
  const bounds = { min: 0, max: 1_000_000, step: 1 };
  const closestVM = (over: Partial<ClosestLifeVM['about']> = {}): ClosestLifeVM => ({
    status: 'ready',
    selfGuess: null,
    about: {
      age: { value: null, estimate: 32, isEstimate: true, bounds },
      takeHomePay: { value: null, estimate: 5200, isEstimate: true, bounds },
      adults: 1,
      kids: { infant: 0, toddler: 0, preschool: 0, schoolAge: 0 },
      kidsPerBandMax: 5,
      bedrooms: 1,
      hasCar: true,
      zip: '',
      zipStatus: 'empty',
      areaZip: null,
      ...over,
    },
    setAge: vi.fn(),
    setTakeHomePay: vi.fn(),
    setAdults: vi.fn(),
    setKidCount: vi.fn(),
    setBedrooms: vi.fn(),
    setHasCar: vi.fn(),
    setZip: vi.fn(),
    candidate: null,
    spendingFromStatement: false,
    chosenCardId: null,
    selectedCardId: null,
    choose: vi.fn(),
  });

  it('our typical age and pay are placeholders, never values that look typed; one estimate tag for the block', () => {
    render(<ClosestLife vm={closestVM()} progress={progress} />);
    const age = screen.getByLabelText(ladder.closest.about.age);
    expect(age).toHaveValue('');
    expect(age).toHaveAttribute('placeholder', ladder.closest.about.estimatePlaceholder('32'));
    expect(screen.getByLabelText(ladder.closest.about.pay)).toHaveAttribute('placeholder', ladder.closest.about.estimatePlaceholder('5,200'));
    expect(screen.getAllByText(common.estimateTag)).toHaveLength(1);
    expect(screen.getByLabelText(ladder.closest.about.zip)).toHaveAttribute('placeholder', ladder.closest.about.zipPlaceholder);
  });

  it('typed values show as typed, with no estimate tag', () => {
    render(
      <ClosestLife
        vm={closestVM({
          age: { value: 29, estimate: 29, isEstimate: false, bounds },
          takeHomePay: { value: 6000, estimate: 6000, isEstimate: false, bounds },
        })}
        progress={progress}
      />,
    );
    expect(screen.getByLabelText(ladder.closest.about.age)).toHaveValue('29');
    expect(screen.queryByText(common.estimateTag)).toBeNull();
  });

  it('the disabled CTA says why it waits: no ZIP yet, or none we have data for', () => {
    const { unmount } = render(<ClosestLife vm={closestVM()} progress={progress} />);
    const cta = screen.getByRole('button', { name: ladder.shell.cta.S6 });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAccessibleDescription(ladder.closest.about.zipNeeded);
    unmount();
    render(<ClosestLife vm={closestVM({ zip: '00501', zipStatus: 'none' })} progress={progress} />);
    expect(screen.getByRole('button', { name: ladder.shell.cta.S6 })).toHaveAccessibleDescription(ladder.closest.about.zipNeededData);
  });
});

describe('BalanceSheet (S8)', () => {
  const field = (value: number, isEstimate: boolean) => ({ value, isEstimate });
  const fb = { min: 0, max: 1_000_000, step: 1 };
  const balanceVM = (over: Partial<BalanceSheetVM> = {}): BalanceSheetVM => ({
    status: 'ready',
    fields: { age: field(32, true), takeHomePay: field(5200, false), cash: field(3800, true), retirement: field(14500, true) },
    fieldBounds: { age: fb, takeHomePay: fb, cash: fb, retirement: fb },
    debts: [],
    debtKinds: ['card', 'student'],
    debtBounds: { balance: fb, apr: { min: 0, max: 1, step: 0.0001 }, minPayment: fb },
    debtAprDefaults: { card: 0.21, auto: 0.07, student: 0.06, personal: 0.12, bnpl: 0, mortgage: 0.065 },
    estimateMinPayment: () => 25,
    detectedDebt: null,
    confirmDetected: vi.fn(() => ''),
    dismissDetected: vi.fn(),
    debtLoad: { value: 0.1, zone: 'green', thresholds: { yellow: 0.2, red: 0.36 } },
    debtLoadMax: 0.6,
    netWorth: 18300,
    home: {
      tenure: 'rent', tenures: ['rent', 'mortgage', 'outright'], summary: null,
      bounds: { value: fb, hoaMonthly: fb }, needsMortgage: false, mortgageWhileOutright: false,
      setTenure: vi.fn(), setValue: vi.fn(), setHoaMonthly: vi.fn(),
    },
    setField: vi.fn(),
    skipField: vi.fn(),
    addDebt: vi.fn(() => ''),
    updateDebt: vi.fn(),
    removeDebt: vi.fn(),
    scanStatement: vi.fn(async () => ({ status: 'none' }) as never),
    ...over,
  });

  it('asks only savings and debts: age and pay are a read-only line linking back to About you', () => {
    render(<BalanceSheet vm={balanceVM()} progress={progress} />);
    expect(screen.queryByLabelText(ladder.balance.fields.age)).toBeNull();
    expect(screen.queryByLabelText(ladder.balance.fields.takeHomePay)).toBeNull();
    const about = screen.getByTestId('from-about');
    expect(about).toHaveTextContent(ladder.balance.fromAbout('32', '$5,200'));
    expect(within(about).getByRole('link', { name: ladder.balance.fromAboutLink })).toHaveAttribute('href', '/x/S6');
    expect(screen.getByLabelText(ladder.balance.fields.cash)).toBeInTheDocument();
  });

  it('one estimate tag for the savings card, not one per row', () => {
    render(<BalanceSheet vm={balanceVM()} progress={progress} />);
    const savings = screen.getByRole('region', { name: ladder.balance.savingsTitle });
    expect(within(savings).getAllByText(common.estimateTag)).toHaveLength(1);
  });

  it('pays the S5 guess off against the month, marked as an estimate while the spending is typical', () => {
    render(<BalanceSheet vm={balanceVM()} progress={progress} payoff={{ guess: 3000, actual: 3600, difference: 600, isEstimate: true }} />);
    const payoff = screen.getByTestId('guess-payoff');
    expect(payoff).toHaveTextContent(ladder.guess.payoffEstimate('$3,000', '$3,600'));
    expect(within(payoff).getByText(common.estimateTag)).toBeInTheDocument();
  });
});

describe('StatementUpload (S9)', () => {
  it('without a reader: the picker is disabled and explains why; nothing claims statement data is sent', () => {
    render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const picker = screen.getByLabelText(ladder.upload.pickerLabel);
    expect(picker).toBeDisabled();
    expect(picker).toHaveAccessibleDescription(ladder.upload.pickerUnavailable);
    expect(screen.getByRole('region', { name: ladder.upload.keep.title })).toHaveTextContent(ladder.upload.keep.none);
    expect(screen.queryByText(ladder.upload.keep.sentTitle)).toBeNull();
    expect(screen.queryByText(ladder.upload.keep.server)).toBeNull();
  });

  it('always says what the 10-year forecast sends to the model provider', () => {
    const { unmount } = render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const keep = screen.getByRole('region', { name: ladder.upload.keep.title });
    expect(keep).toHaveTextContent(ladder.upload.keep.forecastSent);
    unmount();
    render(<StatementUpload vm={uploadVM({ readFile: vi.fn() })} progress={progress} />);
    expect(screen.getByRole('region', { name: ladder.upload.keep.title })).toHaveTextContent(ladder.upload.keep.forecastSent);
  });

  it('does not call the profile “not stored” when the same panel says it is saved on our server', () => {
    const vm = uploadVM({
      whatWeKeep: { months: ['2026-10'], categories: [...COST_CATEGORIES], takeHomePay: true, savedProfileToServer: true },
    });
    render(<StatementUpload vm={vm} progress={progress} />);
    const keep = screen.getByRole('region', { name: ladder.upload.keep.title });
    expect(keep).toHaveTextContent(ladder.upload.keep.server);
    expect(ladder.upload.keep.forecastSent).not.toMatch(/not stored|n’t store/i);
    // The provider does not train on API data; zero data retention is not enabled, so no copy claims it.
    expect(ladder.upload.keep.forecastSent).toMatch(/(does not|doesn’t) use API data to train/i);
    expect(ladder.upload.keep.forecastSent).not.toMatch(/retention|keep them/i);
  });

  it('does not show “Connect your bank app”: it is not built, so the dead button is hidden', () => {
    render(<StatementUpload vm={uploadVM({ readFile: vi.fn() })} progress={progress} />);
    expect(screen.queryByText(/connect your bank/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bank/i })).not.toBeInTheDocument();
  });

  it('“Try with sample statement” asks the view-model to read the sample; disabled while reading', async () => {
    const trySample = vi.fn();
    const { rerender } = render(<StatementUpload vm={uploadVM({ readFile: vi.fn(), trySample })} progress={progress} />);
    await userEvent.click(screen.getByRole('button', { name: ladder.upload.trySample }));
    expect(trySample).toHaveBeenCalledTimes(1);
    rerender(<StatementUpload vm={uploadVM({ readFile: vi.fn(), trySample, status: 'reading' })} progress={progress} />);
    expect(screen.getByRole('button', { name: ladder.upload.trySample })).toBeDisabled();
  });

  it('opens with the fork: a bank CSV (most accurate), or no statement → by hand; the footer has only the CTA', () => {
    render(<StatementUpload vm={uploadVM({ readFile: vi.fn() })} progress={progress} />);
    const csv = screen.getByRole('region', { name: ladder.upload.fork.statementTitle });
    expect(csv).toHaveTextContent(ladder.upload.fork.statementBadge);
    expect(within(csv).getByLabelText(ladder.upload.pickerLabel)).toBeEnabled();
    const byHand = screen.getByRole('region', { name: ladder.upload.fork.byHandTitle });
    expect(within(byHand).getByRole('link', { name: ladder.upload.fork.byHandLink })).toHaveAttribute('href', '/me/sliders');
    expect(screen.getAllByRole('link', { name: /by hand/i })).toHaveLength(1); // no second way out in the footer
    expect(screen.getByRole('link', { name: ladder.shell.cta.S9 })).toHaveAttribute('href', '/x/S8');
    expect(screen.getByRole('link', { name: ladder.shell.back })).toHaveAttribute('href', '/x/S6');
    // The spending step is the third pill.
    expect(screen.getByRole('link', { current: 'step' })).toHaveTextContent(`3${ladder.shell.rungs.S9}`);
  });

  it('with a reader: the picker hands the file over', async () => {
    const readFile = vi.fn();
    render(<StatementUpload vm={uploadVM({ readFile })} progress={progress} />);
    const file = new File(['a,b'], 'statement.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText(ladder.upload.pickerLabel), file);
    expect(readFile).toHaveBeenCalledWith(file);
    expect(screen.getByText(ladder.upload.keep.sentTitle)).toBeInTheDocument();
  });

  it('while reading: says so and disables the picker', () => {
    render(<StatementUpload vm={uploadVM({ readFile: vi.fn(), status: 'reading' })} progress={progress} />);
    expect(screen.getByRole('status')).toHaveTextContent(ladder.upload.reading);
    expect(screen.getByLabelText(ladder.upload.pickerLabel)).toBeDisabled();
  });

  it('review: shows each month, then apply or discard', async () => {
    const vm = uploadVM({
      status: 'review',
      lastRead: { transactions: 1234, skippedPending: 2, skippedOther: 1, from: '2026-09-01', to: '2026-10-31', categorizedBy: 'rules' },
      pending: [
        { month: '2026-09', totals: zeros({ groceries: 600, subscriptions: 30 }), total: 630, oneOffs: [{ label: 'SOFA', amount: 800 }], detectedPay: 5400, averaged: true },
        { month: '2026-10', totals: zeros({ groceries: 700 }), total: 700, oneOffs: [], detectedPay: null, averaged: false },
      ],
      summary: { averageMonth: 630, fullMonths: 1 },
      whatWeKeep: { months: ['2026-09', '2026-10'], categories: [...COST_CATEGORIES], takeHomePay: true, savedProfileToServer: true },
    });
    render(<StatementUpload vm={vm} progress={progress} />);
    // The confirm sits on top: what was read, the average month, and "Use these numbers" right there.
    const summary = screen.getByTestId('statement-summary');
    expect(summary).toHaveTextContent(ladder.upload.averageMonth('$630', 1));
    expect(within(summary).getByRole('button', { name: ladder.upload.apply })).toBeInTheDocument();
    // The months are under "Details", closed.
    expect(screen.getByTestId('statement-months')).not.toHaveAttribute('open');
    const sep = screen.getByRole('region', { name: ladder.upload.monthLabel('2026-09') });
    expect(within(sep).getByRole('list', { name: ladder.upload.monthLabel('2026-09') })).toHaveTextContent(common.categories.groceries);
    expect(within(sep).getByText(ladder.upload.detectedPay('$5,400'))).toBeInTheDocument();
    expect(within(sep).getByText('SOFA')).toBeInTheDocument();
    expect(within(sep).queryByText(ladder.upload.partialMonth)).toBeNull();
    expect(within(screen.getByRole('region', { name: ladder.upload.monthLabel('2026-10') })).getByText(ladder.upload.partialMonth)).toBeInTheDocument();
    const read = screen.getByTestId('statement-read');
    expect(read).toHaveTextContent('Read 1,234 transactions from Sep 1, 2026 to Oct 31, 2026.');
    expect(read).toHaveTextContent('2 pending lines (they count once they post) and 1 line that isn’t a transaction left out.');
    expect(read).toHaveTextContent(ladder.upload.categorizedBy.rules);
    const keep = screen.getByRole('region', { name: ladder.upload.keep.title });
    expect(keep).toHaveTextContent('Sep 2026, Oct 2026');
    expect(keep).toHaveTextContent(ladder.upload.keep.payFound);
    expect(keep).toHaveTextContent(ladder.upload.keep.server);

    await userEvent.click(screen.getByRole('button', { name: ladder.upload.apply }));
    expect(vm.apply).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: ladder.upload.discard }));
    expect(vm.discard).toHaveBeenCalledOnce();
    // Going on with a statement under review uses it too: never silently dropped.
    const next = screen.getByRole('link', { name: ladder.shell.cta.S9 });
    expect(next).toHaveAttribute('href', '/x/S8');
    next.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(next);
    expect(vm.apply).toHaveBeenCalledTimes(2);
  });

  it('applied with a guess: pays the guess off against the real month', () => {
    const vm = uploadVM({ status: 'applied', history: ['2026-10'] });
    render(<StatementUpload vm={vm} progress={progress} payoff={{ guess: 3000, actual: 4200, difference: 1200, isEstimate: false }} />);
    const payoff = screen.getByTestId('guess-payoff');
    expect(payoff).toHaveTextContent(ladder.guess.reveal('$3,000', '$4,200'));
    expect(payoff).toHaveTextContent(ladder.guess.revealMore('$1,200'));
    expect(within(payoff).queryByText(common.estimateTag)).toBeNull();
  });

  it('"What we keep" is one line and a disclosure, so the step’s CTA stays in view', () => {
    render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const details = screen.getByTestId('what-we-keep-details');
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText(ladder.upload.keep.toggle)).toBeInTheDocument();
  });

  it('review: asks the follow-ups, in the model’s words or the template’s, each answerable or skippable', async () => {
    const vm = uploadVM({
      status: 'review',
      pending: [{ month: '2026-10', totals: zeros({ other: 90 }), total: 90, oneOffs: [], detectedPay: null, averaged: true }],
      questions: [
        { id: 'missing:groceries', kind: 'missing', question: null, merchant: null, category: 'groceries', monthly: 0, options: [], answer: null },
        { id: 'cash:cash', kind: 'cash', question: 'What do you usually spend your cash on?', merchant: null, category: null, monthly: 25, options: ['groceries', 'eatingOut', 'other'], answer: { kind: 'skipped' } },
        { id: 'merchant:TARGET', kind: 'merchant', question: null, merchant: 'TARGET DALLAS TX', category: null, monthly: 60.28, options: ['groceries', 'eatingOut', 'other'], answer: { kind: 'category', category: 'groceries' } },
      ],
    });
    render(<StatementUpload vm={vm} progress={progress} />);
    // The fork steps aside while a file is reviewed.
    expect(screen.queryByRole('region', { name: ladder.upload.fork.byHandTitle })).toBeNull();
    const questions = screen.getByRole('region', { name: ladder.upload.questions.title });
    const groceries = within(questions).getByRole('group', { name: ladder.upload.questions.template.missing(common.categories.groceries) });
    const cash = within(questions).getByRole('group', { name: 'What do you usually spend your cash on?' });
    const target = within(questions).getByRole('group', { name: ladder.upload.questions.template.merchant('TARGET DALLAS TX') });

    // Amounts come from the view-model, formatted; a missing category has none.
    expect(cash).toHaveTextContent(ladder.upload.questions.monthly('$25'));
    expect(target).toHaveTextContent(ladder.upload.questions.monthly('$60'));
    expect(groceries).not.toHaveTextContent(ladder.upload.questions.monthly('$0'));

    // The answer so far is shown, and can be changed.
    expect(within(target).getByRole('radio', { name: common.categories.groceries })).toBeChecked();
    expect(target).toHaveTextContent(ladder.upload.questions.answeredCategory(common.categories.groceries));
    await userEvent.click(within(target).getByRole('radio', { name: common.categories.eatingOut }));
    expect(vm.answerCategory).toHaveBeenCalledWith('merchant:TARGET', 'eatingOut');
    expect(cash).toHaveTextContent(ladder.upload.questions.skipped);
    expect(within(cash).queryByRole('button', { name: ladder.upload.questions.skip })).toBeNull();

    // A missing category takes a typed monthly amount, added only on "Add it".
    const add = within(groceries).getByRole('button', { name: ladder.upload.questions.amountSave });
    expect(add).toBeDisabled();
    await userEvent.type(within(groceries).getByLabelText(ladder.upload.questions.amountLabel), '450');
    expect(vm.answerAmount).not.toHaveBeenCalled();
    await userEvent.click(add);
    expect(vm.answerAmount).toHaveBeenCalledWith('missing:groceries', 450);
    await userEvent.click(within(groceries).getByRole('button', { name: ladder.upload.questions.skip }));
    expect(vm.skipQuestion).toHaveBeenCalledWith('missing:groceries');
  });

  it('bad totals: an alert with a way out', async () => {
    const vm = uploadVM({ status: 'error', error: { kind: 'badInput' } });
    render(<StatementUpload vm={vm} progress={progress} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ladder.upload.errors.badInput);
    await userEvent.click(screen.getByRole('button', { name: ladder.upload.dismiss }));
    expect(vm.discard).toHaveBeenCalledOnce();
  });

  it.each([
    [{ kind: 'unreadable', reason: 'noColumns' }, ladder.upload.errors.unreadable.noColumns],
    [{ kind: 'unreadable', reason: 'notCsv' }, ladder.upload.errors.unreadable.notCsv],
    [{ kind: 'rateLimited' }, ladder.upload.errors.rateLimited],
    [{ kind: 'network' }, ladder.upload.errors.network],
    [{ kind: 'invalidResponse' }, ladder.upload.errors.unknown],
  ] as const)('error %o: explains it', (error, text) => {
    render(<StatementUpload vm={uploadVM({ status: 'error', error })} progress={progress} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });
});

function parseVM(over: Partial<QuickSlidersVM['parse']> = {}): QuickSlidersVM['parse'] {
  return {
    text: 'rent 1800',
    status: 'idle',
    parsed: null,
    inferred: [],
    error: null,
    setText: vi.fn(),
    submit: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    ...over,
  };
}

describe('DescribeLife (S7)', () => {
  it('confirming: lists the values, highlights inferred ones, confirm/discard', async () => {
    const parse = parseVM({ status: 'confirming', parsed: { spending: { rentUtilities: 1800 } } });
    const rows: ParsedRowVM[] = [
      { path: 'spending.rentUtilities', target: { kind: 'spending', category: 'rentUtilities' }, value: 1800, unit: 'money', current: 1950, inferred: false },
      { path: 'debts.0.apr', target: { kind: 'debtApr', debtId: 'card-1', debtKind: 'card' }, value: 0.24, unit: 'rate', current: 0.2436, inferred: true },
    ];
    render(<DescribeLife parse={parse} rows={rows} />);
    const confirm = screen.getByRole('region', { name: ladder.sliders.describe.confirmTitle });
    const items = within(confirm).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('$1,800');
    expect(items[0]).toHaveTextContent(ladder.sliders.describe.was('$1,950'));
    expect(items[0]).toHaveAttribute('data-inferred', 'false');
    expect(items[1]).toHaveTextContent(ladder.sliders.describe.rowLabel.debtApr(ladder.balance.debtKinds.card));
    expect(items[1]).toHaveTextContent('24%');
    expect(items[1]).toHaveAttribute('data-inferred', 'true');
    expect(within(items[1]!).getByText(ladder.sliders.describe.inferred)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ladder.sliders.describe.confirm }));
    expect(parse.confirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: ladder.sliders.describe.discard }));
    expect(parse.cancel).toHaveBeenCalledOnce();
  });

  it.each(['unavailable', 'nothingFound'] as const)('error %s: explains and points at the sliders', async (kind) => {
    const parse = parseVM({ status: 'error', error: { kind } });
    render(<DescribeLife parse={parse} rows={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ladder.sliders.describe.errors[kind]);
    await userEvent.click(screen.getByRole('button', { name: ladder.sliders.describe.dismiss }));
    expect(parse.cancel).toHaveBeenCalledOnce();
  });

  it('incomplete: explains and points at the sliders', () => {
    render(<DescribeLife parse={parseVM({ status: 'error', error: { kind: 'incomplete', missing: ['apr'] } })} rows={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ladder.sliders.describe.errors.incomplete);
  });

  it('is one text link until opened, then submits the text', async () => {
    const parse = parseVM();
    render(<DescribeLife parse={parse} rows={[]} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    const open = screen.getByRole('button', { name: ladder.sliders.describe.open });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox', { name: ladder.sliders.describe.label })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ladder.sliders.describe.submit }));
    expect(parse.submit).toHaveBeenCalledOnce();
  });
});

describe('DebtForm (S8)', () => {
  const bounds = {
    balance: { min: 0, max: 1e8, step: 1 },
    apr: { min: 0, max: 1, step: 0.0001 },
    minPayment: { min: 0, max: 1e6, step: 1 },
  };

  it('only the balance is needed: APR prefilled for the kind (estimate); typed APR saved as a decimal', async () => {
    const onSave = vi.fn();
    render(
      <DebtForm
        title="New debt"
        kinds={['card', 'student']}
        bounds={bounds}
        aprDefaults={{ card: 0.2236, auto: 0.08, student: 0.0639, personal: 0.12, bnpl: 0, mortgage: 0.065 }}
        estimateMinPayment={(b, apr) => b * (apr / 12) + b * 0.01}
        initial={{ kind: 'card', balance: null, apr: null, minPayment: null }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const save = screen.getByRole('button', { name: ladder.balance.save });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: ladder.balance.debtKinds.student }));
    await userEvent.type(screen.getByLabelText(ladder.balance.balanceLabel), '20000');
    await userEvent.click(save);
    // JF7: an untouched APR is the kind's prefilled typical rate, saved tagged as an estimate.
    expect(onSave).toHaveBeenLastCalledWith({ kind: 'student', balance: 20000, apr: 0.0639, aprIsEstimate: true, minPayment: null });
    const apr = screen.getByLabelText(ladder.balance.aprLabel);
    await userEvent.clear(apr);
    await userEvent.type(apr, '5.5');
    await userEvent.click(save);
    // A typed APR is the user's own: no estimate tag.
    expect(onSave).toHaveBeenLastCalledWith({ kind: 'student', balance: 20000, apr: 0.055, aprIsEstimate: false, minPayment: null });
  });
});

describe('GuessYourself (S5)', () => {
  it('after a guess is saved: no estimate to compare with, no update link; the CTA leads on', () => {
    const vm: GuessYourselfVM = {
      status: 'ready',
      guess: { value: 3000, min: 1000, max: 15000, step: 10, position: 0.4 },
      savedGuess: 3000,
      reveal: null,
      bridge: null,
      setGuess: vi.fn(),
      setGuessPosition: vi.fn(),
      submit: vi.fn(),
    };
    const { unmount } = render(<GuessYourself vm={vm} progress={progress} />);
    expect(screen.queryByTestId('guess-reveal')).toBeNull();
    expect(screen.queryByRole('link', { name: ladder.guess.submit })).toBeNull();
    expect(screen.getByRole('link', { name: ladder.shell.cta.S5 })).toHaveAttribute('href', '/x/S6');
    unmount();
    // Once the spending is the user's own: guess vs reality.
    render(<GuessYourself vm={{ ...vm, reveal: { guess: 3000, actual: 4000, difference: 1000 } }} progress={progress} />);
    expect(screen.getByTestId('guess-reveal')).toHaveTextContent(ladder.guess.reveal('$3,000', '$4,000'));
    expect(screen.getByTestId('guess-reveal')).toHaveTextContent(ladder.guess.revealMore('$1,000'));
  });

  it('before a guess is saved: locking it is the CTA, with the game line as a sticker', async () => {
    const vm: GuessYourselfVM = {
      status: 'ready',
      guess: { value: 3000, min: 1000, max: 15000, step: 10, position: 0.4 },
      savedGuess: null,
      reveal: null,
      bridge: { played: 5, guessedLow: 4, guessedHigh: 1 },
      setGuess: vi.fn(),
      setGuessPosition: vi.fn(),
      submit: vi.fn(),
    };
    render(<GuessYourself vm={vm} progress={progress} />);
    expect(screen.getByText(ladder.guess.bridgeLow(4, 5))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: ladder.shell.cta.S5 })).toBeNull();
    // Locking the guess goes on to the next step in the same tap.
    const lock = screen.getByRole('link', { name: ladder.guess.submit });
    expect(lock).toHaveAttribute('href', '/x/S6');
    lock.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(lock);
    expect(vm.submit).toHaveBeenCalledOnce();
  });
});
