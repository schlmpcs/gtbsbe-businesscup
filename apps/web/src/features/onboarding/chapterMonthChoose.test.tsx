// @vitest-environment jsdom
// Chapter 3's choices: "Connect your bank" (the demo bank link, labelled a demo) first, then the CSV
// import with our own file button, the sample statement and the sliders. A statement the bank link
// hands over opens its review.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { bankDemo, ladder, onboarding } from '@/copy';
import type { MonthRevealVM, QuickSlidersVM, StatementUploadVM } from './model/types';
import { ChapterMonth } from './ui/ChapterMonth';

const reveal = { guess: null, actual: 0, difference: null, differenceShare: null, direction: null, guessShare: 0, actualShare: 0, isEstimate: true, from: 'estimate', categories: [] } as MonthRevealVM;
const sliders = { sliders: [], monthlyCost: 0, ownsHome: false, setSpending: vi.fn() } as unknown as QuickSlidersVM;
const upload = (over: Partial<StatementUploadVM> = {}) =>
  ({ status: 'idle', readFile: vi.fn(), trySample: vi.fn(), apply: vi.fn(), discard: vi.fn(), summary: null, lastRead: null, ...over }) as unknown as StatementUploadVM;

describe('chapter 3: how to count the month', () => {
  it('offers Connect your bank first, labelled a demo with sample data', async () => {
    const onConnectBank = vi.fn();
    render(<ChapterMonth upload={upload()} sliders={sliders} reveal={reveal} onDone={vi.fn()} onConnectBank={onConnectBank} />);
    const cards = ['month-bank', 'month-csv', 'month-sample', 'month-sliders'].map((id) => screen.getByTestId(id));
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1]!.compareDocumentPosition(cards[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId('month-bank-badge').textContent).toBe(bankDemo.badge);
    expect(screen.getByTestId('month-bank').textContent).toContain(bankDemo.disclaimer);
    await userEvent.setup().click(screen.getByTestId('month-bank'));
    expect(onConnectBank).toHaveBeenCalledOnce();
  });

  it('without the bank link the card is not offered', () => {
    render(<ChapterMonth upload={upload()} sliders={sliders} reveal={reveal} onDone={vi.fn()} />);
    expect(screen.queryByTestId('month-bank')).toBeNull();
  });

  it('the CSV import uses our own English file button and shows the chosen file name', async () => {
    const vm = upload();
    const { rerender } = render(<ChapterMonth upload={vm} sliders={sliders} reveal={reveal} onDone={vi.fn()} onConnectBank={vi.fn()} />);
    expect(screen.getByText(onboarding.month.pickFile)).toBeTruthy();
    expect(screen.getByTestId('month-csv-name').textContent).toBe(onboarding.month.noFile);
    const input = screen.getByLabelText(ladder.upload.pickerLabel) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.className).toContain('sr-only');
    const file = new File(['Date,Description,Amount\n'], 'my-bank.csv', { type: 'text/csv' });
    await userEvent.setup().upload(input, file);
    expect(vm.readFile).toHaveBeenCalledWith(file);
    // The chapter moved on to the statement; going back shows the choices again.
    rerender(<ChapterMonth upload={upload({ status: 'error' })} sliders={sliders} reveal={reveal} onDone={vi.fn()} onConnectBank={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('a statement the bank link hands over (reading, then review) opens its review from the choices', () => {
    const { rerender } = render(<ChapterMonth upload={upload()} sliders={sliders} reveal={reveal} onDone={vi.fn()} onConnectBank={vi.fn()} />);
    expect(screen.getByTestId('month-bank')).toBeTruthy();
    rerender(<ChapterMonth upload={upload({ status: 'reading' })} sliders={sliders} reveal={reveal} onDone={vi.fn()} onConnectBank={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain(onboarding.month.reading);
    rerender(
      <ChapterMonth
        upload={upload({ status: 'review', summary: { averageMonth: 4_000, fullMonths: 3 } })}
        sliders={sliders}
        reveal={reveal}
        onDone={vi.fn()}
        onConnectBank={vi.fn()}
      />,
    );
    expect(screen.getByTestId('statement-summary')).toBeTruthy();
  });
});
