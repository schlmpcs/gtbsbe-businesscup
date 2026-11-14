// @vitest-environment jsdom
// Ladder UI (features/ladder/ui) with hand-made view-models: states the e2e path can't reach yet
// (S9 errors and review states, parse errors and confirmation on S7) and the S8 debt form units.
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { common, ladder } from '@/copy';
import type {
  GuessYourselfVM, LadderProgressVM, ParsedRowVM, QuickSlidersVM, StatementUploadVM,
} from './model/types';
import { DebtForm } from './ui/DebtForm';
import { DescribeLife } from './ui/DescribeLife';
import { GuessYourself } from './ui/GuessYourself';
import { StatementUpload } from './ui/StatementUpload';

const progress: LadderProgressVM = {
  status: 'ready',
  rungs: (['S5', 'S6', 'S7', 'S8', 'S9'] as const).map((screen, i) => ({ screen, href: `/x/${screen}`, done: i < 2 })),
  doneCount: 2,
  in10y: { month: 120, low: 40_000, mid: 60_000, high: 90_000 },
  bandWidth: 50_000,
  bandWidthAllEstimated: 100_000,
  bandNarrowed: 0.5,
  estimates: { left: 6, total: 14 },
  futureHref: '/future',
};

const zeros = (over: Partial<Record<CostCategory, number>> = {}) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

function uploadVM(over: Partial<StatementUploadVM> = {}): StatementUploadVM {
  return {
    status: 'idle',
    error: null,
    lastRead: null,
    pending: [],
    history: [],
    hasDriftHistory: false,
    whatWeKeep: { months: [], categories: [], takeHomePay: false, savedProfileToServer: false },
    readFile: null,
    submitTotals: vi.fn(),
    apply: vi.fn(),
    discard: vi.fn(),
    ...over,
  };
}

describe('LadderProgress (via any rung)', () => {
  it('shows the rungs, the 10-year range, how much it narrowed and the CTAs', () => {
    const vm = uploadVM();
    render(<StatementUpload vm={vm} progress={progress} />);
    const steps = screen.getByRole('navigation', { name: ladder.shell.stepsLabel });
    expect(within(steps).getAllByRole('link')).toHaveLength(5);
    expect(within(steps).getByRole('link', { current: 'step' })).toHaveAttribute('href', '/x/S9');
    expect(screen.getByText(ladder.shell.stepsDone(2, 5))).toBeInTheDocument();
    expect(screen.getByText(ladder.shell.range('$40,000', '$90,000'))).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: ladder.shell.narrowedLabel })).toHaveAttribute('aria-valuenow', '0.5');
    expect(screen.getByRole('link', { name: ladder.shell.futureCta })).toHaveAttribute('href', '/future');
  });
});

describe('StatementUpload (S9)', () => {
  it('without a reader: the picker is disabled and explains why; nothing claims data is sent', () => {
    render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const picker = screen.getByLabelText(ladder.upload.pickerLabel);
    expect(picker).toBeDisabled();
    expect(picker).toHaveAccessibleDescription(ladder.upload.pickerUnavailable);
    expect(screen.getByRole('region', { name: ladder.upload.keep.title })).toHaveTextContent(ladder.upload.keep.none);
    expect(screen.queryByText(ladder.upload.keep.sentTitle)).toBeNull();
    expect(screen.queryByText(ladder.upload.keep.server)).toBeNull();
  });

  it('offers connecting a bank app as coming soon, not as a working option', () => {
    render(<StatementUpload vm={uploadVM()} progress={progress} />);
    const connect = screen.getByRole('button', { name: `${ladder.upload.bank.button} · ${ladder.upload.bank.soon}` });
    expect(connect).toBeDisabled();
    expect(connect).toHaveAccessibleDescription(ladder.upload.bank.note);
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
        { month: '2026-09', totals: zeros({ groceries: 600, subscriptions: 30 }), total: 630, oneOffs: [{ label: 'SOFA', amount: 800 }], detectedPay: 5400 },
        { month: '2026-10', totals: zeros({ groceries: 700 }), total: 700, oneOffs: [], detectedPay: null },
      ],
      whatWeKeep: { months: ['2026-09', '2026-10'], categories: [...COST_CATEGORIES], takeHomePay: true, savedProfileToServer: true },
    });
    render(<StatementUpload vm={vm} progress={progress} />);
    const sep = screen.getByRole('region', { name: ladder.upload.monthLabel('2026-09') });
    expect(within(sep).getByRole('list', { name: ladder.upload.monthLabel('2026-09') })).toHaveTextContent(common.categories.groceries);
    expect(within(sep).getByText(ladder.upload.detectedPay('$5,400'))).toBeInTheDocument();
    expect(within(sep).getByText('SOFA')).toBeInTheDocument();
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

  it('submits the text', async () => {
    const parse = parseVM();
    render(<DescribeLife parse={parse} rows={[]} />);
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

  it('APR typed as a percent is saved as a decimal; an empty minimum is null (estimated)', async () => {
    const onSave = vi.fn();
    render(
      <DebtForm
        title="New debt"
        kinds={['card', 'student']}
        bounds={bounds}
        initial={{ kind: 'card', balance: null, apr: null, minPayment: null }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const save = screen.getByRole('button', { name: ladder.balance.save });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(ladder.balance.kindLabel), 'student');
    await userEvent.type(screen.getByLabelText(ladder.balance.balanceLabel), '20000');
    await userEvent.type(screen.getByLabelText(ladder.balance.aprLabel), '5.5');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ kind: 'student', balance: 20000, apr: 0.055, minPayment: null });
  });
});

describe('GuessYourself (S5)', () => {
  it('shows the comparison with the engine estimate after a guess is saved', () => {
    const vm: GuessYourselfVM = {
      status: 'ready',
      guess: { value: 3000, min: 1000, max: 15000, step: 10, position: 0.4 },
      savedGuess: 3000,
      comparison: {
        guess: 3000, estimate: 4000, isEstimate: true, basis: 'closestLife',
        difference: -1000, differenceShare: -0.25, direction: 'below',
      },
      bridge: null,
      setGuess: vi.fn(),
      setGuessPosition: vi.fn(),
      submit: vi.fn(),
    };
    render(<GuessYourself vm={vm} progress={progress} />);
    expect(screen.getByTestId('guess-verdict')).toHaveTextContent(ladder.guess.below('$1,000', '25%'));
    expect(screen.getByText(ladder.guess.basis.closestLife)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ladder.guess.update })).toBeDisabled();
  });
});
