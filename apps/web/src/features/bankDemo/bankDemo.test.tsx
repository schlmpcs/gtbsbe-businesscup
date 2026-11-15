// @vitest-environment jsdom
// The demo bank link: the hook (timer + download, real CSV reader) and the sheet it feeds.
import hh01 from '@lifeguessr/data/fixtures/synthetic-statements/hh01-austin-single-renter.csv?raw';
import hh02 from '@lifeguessr/data/fixtures/synthetic-statements/hh02-queens-retail-roommates.csv?raw';
import hh13 from '@lifeguessr/data/fixtures/synthetic-statements/hh13-elk-grove-single-income-family.csv?raw';
import hh31 from '@lifeguessr/data/fixtures/synthetic-statements/hh31-austin-software-engineer.csv?raw';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bankDemo as t } from '@/copy';
import { demoBank, type DemoBankId } from './model/banks';
import { useBankDemo, useBankDemoHandoff } from './model/useBankDemo';
import { BankDemoSheet } from './ui/BankDemoSheet';

// The statements these banks hold (jsdom can't use the fs fixture helpers).
const CSV: Record<string, string> = {
  'hh01-austin-single-renter.csv': hh01,
  'hh02-queens-retail-roommates.csv': hh02,
  'hh13-elk-grove-single-income-family.csv': hh13,
  'hh31-austin-software-engineer.csv': hh31,
};
const fetchStatement = vi.fn(async (id: DemoBankId) => CSV[demoBank(id).statement]!);

afterEach(() => {
  vi.useRealTimers();
  fetchStatement.mockClear();
});

describe('useBankDemo', () => {
  it('connects step by step and hands over the bank statement as a CSV file', async () => {
    const onUse = vi.fn();
    const { result } = renderHook(() => useBankDemo({ onUse, fetchStatement, stepMs: 5 }));
    expect(result.current.open).toBe(false);
    act(() => result.current.start());
    act(() => result.current.search('harbor'));
    expect(result.current.banks.map((b) => b.id)).toEqual(['harbor']);
    act(() => result.current.pick('harbor'));
    expect(result.current.bank).toMatchObject({ id: 'harbor', name: t.banks.harbor, initials: 'HB' });
    act(() => result.current.connect());
    expect(result.current.step).toBe('connecting');
    await waitFor(() => expect(result.current.step).toBe('connected'));
    expect(fetchStatement).toHaveBeenCalledWith('harbor', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.accounts.map((a) => a.kind)).toEqual(['checking', 'card']);
    expect(result.current.days).toBeGreaterThan(90);

    act(() => result.current.use());
    expect(result.current.open).toBe(false);
    const [file, bankId] = onUse.mock.calls[0]!;
    expect(bankId).toBe('harbor');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('harbor-demo-statement.csv');
    expect(await (file as File).text()).toBe(hh01);
  });

  it('a failed download shows the error, and retry tries again', async () => {
    const failing = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(fetchStatement);
    const { result } = renderHook(() => useBankDemo({ onUse: vi.fn(), fetchStatement: failing, stepMs: 5 }));
    act(() => result.current.start());
    act(() => result.current.pick('pebble'));
    act(() => result.current.connect());
    await waitFor(() => expect(result.current.step).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.step).toBe('connected'));
    expect(result.current.accounts.map((a) => a.kind)).toEqual(['checking']);
  });

  it('the /transactions handoff imports a demo bank once and ignores anything else', async () => {
    const onFile = vi.fn();
    const done = vi.fn();
    const { rerender } = renderHook(({ bank }) => useBankDemoHandoff(bank, onFile, done, fetchStatement), {
      initialProps: { bank: 'chase' as string | null },
    });
    expect(fetchStatement).not.toHaveBeenCalled();
    rerender({ bank: 'maple' });
    rerender({ bank: 'maple' });
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(onFile).toHaveBeenCalledOnce();
    expect((onFile.mock.calls[0]![0] as File).name).toBe('maple-demo-statement.csv');
  });
});

describe('BankDemoSheet', () => {
  function Open({ onUse }: { onUse: (file: File) => void }) {
    const vm = useBankDemo({ onUse, fetchStatement, stepMs: 150 });
    return (
      <>
        <button type="button" onClick={vm.start}>
          open
        </button>
        <BankDemoSheet vm={vm} />
      </>
    );
  }

  it('walks pick → demo sign-in → connecting → connected, labelled a demo all the way', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<Open onUse={onUse} />);
    expect(screen.queryByTestId('bank-demo')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByTestId('bank-demo').dataset.step).toBe('pick');
    expect(screen.getByTestId('bank-demo-badge').textContent).toBe(t.badge);
    expect(screen.getByText(t.disclaimer)).toBeTruthy();
    // Only made-up banks, each saying "(demo)".
    for (const name of Object.values(t.banks)) expect(screen.getByText(name)).toBeTruthy();

    await user.type(screen.getByLabelText(t.pick.searchLabel), 'zzz');
    expect(screen.getByText(t.pick.none)).toBeTruthy();
    await user.clear(screen.getByLabelText(t.pick.searchLabel));
    await user.click(screen.getByTestId('bank-demo-bank-summit'));

    expect(screen.getByRole('heading', { name: t.signIn.title(t.banks.summit) })).toBeTruthy();
    expect((screen.getByLabelText(t.signIn.user) as HTMLInputElement).value).toBe('demo');
    expect((screen.getByLabelText(t.signIn.password) as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByTestId('bank-demo-credentials-note').textContent).toBe(t.signIn.note);
    await user.click(screen.getByTestId('bank-demo-connect'));

    expect(screen.getByTestId('bank-demo').dataset.step).toBe('connecting');
    expect(screen.getByTestId('bank-demo-step-verify').dataset.status).toBe('active');
    await waitFor(() => expect(screen.getByTestId('bank-demo').dataset.step).toBe('connected'), { timeout: 3_000 });
    expect(screen.getByTestId('bank-demo-account-checking').textContent).toContain(t.connected.checking);
    expect(screen.getByTestId('bank-demo-account-card').textContent).toContain(t.connected.card);

    await user.click(screen.getByTestId('bank-demo-use'));
    expect(onUse).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('bank-demo')).toBeNull();
  });
});
