// @vitest-environment jsdom
// The /play UI on the real view-model and fixture game client (lives outside ui/ because it wires
// the hook to the presentational screen, as app/play/page.tsx does).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { common, game as t } from '@/copy';
import { resetClientState } from '@/test/clientState';
import { createFixtureGameClient, type GameClient } from './model/client';
import { usePlay, type UsePlayOptions } from './model/usePlay';
import { PlayScreen } from './ui/PlayScreen';

let client: GameClient;
beforeEach(() => {
  resetClientState();
  client = createFixtureGameClient({ persist: false });
});

function Play(props: Omit<UsePlayOptions, 'client'>) {
  const vm = usePlay({ client, ...props });
  return <PlayScreen vm={vm} guessOwnHref="/me/guess" />;
}

const lockInButton = () => screen.getByRole('button', { name: /^Lock in/ });

describe('PlayScreen', () => {
  it('explores a home, opens a clue with its cost shown, guesses, and reveals', async () => {
    render(<Play />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('S2');
    await screen.findByText(t.progress(1, 5));
    expect(screen.getByText(t.multiplier.cost('10%'))).toBeInTheDocument();

    const kitchen = screen.getByRole('button', { name: new RegExp(t.clues.rooms.kitchen) });
    expect(kitchen).toHaveTextContent(t.clues.closedHint('10%'));
    fireEvent.click(kitchen);
    await screen.findByText(/Takeout and restaurants/);
    expect(screen.queryByRole('button', { name: new RegExp(t.clues.rooms.kitchen) })).toBeNull();
    expect(screen.getByText('90%')).toBeInTheDocument(); // multiplier after one clue

    fireEvent.change(screen.getByRole('textbox', { name: t.guess.input }), { target: { value: '4500' } });
    expect(lockInButton()).toHaveTextContent(t.guess.lockIn('$4,500'));
    fireEvent.click(lockInButton());

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('S3'));
    expect(screen.getByRole('list', { name: t.reveal.breakdownLabel })).toBeInTheDocument();
    expect(screen.getByRole('figure')).toHaveAccessibleName(/Your guess \$4,500/);
    expect(screen.getByText(/base points × 90% for 1 room opened/)).toBeInTheDocument();
    expect(screen.getAllByText(common.kit.sourcePrefix, { exact: false }).length).toBeGreaterThan(0);
    // Every category appears once in the bars (lines aggregated by the view-model).
    const bars = within(screen.getByRole('list', { name: t.reveal.breakdownLabel })).getAllByRole('listitem');
    const labels = bars.map((li) => li.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(screen.getByRole('button', { name: t.reveal.next })).toBeInTheDocument();
  });

  it('plays all five homes into the summary with the share grid and the bridge', async () => {
    const share = vi.fn().mockResolvedValue('copied');
    render(<Play share={share} />);
    for (let i = 0; i < 5; i++) {
      await screen.findByText(t.progress(i + 1, 5));
      fireEvent.click(lockInButton());
      const next = await screen.findByRole('button', { name: i === 4 ? t.reveal.finish : t.reveal.next });
      fireEvent.click(next);
    }
    await screen.findByRole('heading', { name: t.summary.heading });
    const grid = screen.getByRole('list', { name: t.summary.gridLabel });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('link', { name: t.summary.cta })).toHaveAttribute('href', '/me/guess');

    fireEvent.click(screen.getByRole('button', { name: t.summary.share }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.summary.shareStatus.copied));
    expect(share.mock.calls[0]![0]).toMatch(/^LifeGuessr \d{4}-\d{2}-\d{2}\n[🟩🟨🟥]{5}\n/u);
  });

  it('shows the share text to copy by hand when sharing fails', async () => {
    render(<Play share={() => Promise.resolve('failed')} />);
    for (let i = 0; i < 5; i++) {
      await screen.findByText(t.progress(i + 1, 5));
      fireEvent.click(lockInButton());
      fireEvent.click(await screen.findByRole('button', { name: i === 4 ? t.reveal.finish : t.reveal.next }));
    }
    fireEvent.click(await screen.findByRole('button', { name: t.summary.share }));
    const box = await screen.findByRole('textbox', { name: t.summary.shareTextLabel });
    expect((box as HTMLTextAreaElement).value).toMatch(/[🟩🟨🟥]{5}/u);
  });

  it('S4 streamer mode: big countdown that starts, and locks in at zero', async () => {
    render(<Play streamer countdownSeconds={2} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('S4');
    const timer = await screen.findByRole('timer');
    expect(timer).toHaveTextContent(t.streamer.seconds(2));
    fireEvent.click(screen.getByRole('button', { name: t.streamer.start }));
    expect(screen.getByRole('button', { name: t.streamer.pause })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent(t.streamer.seconds(1)), { timeout: 2000 });
    await waitFor(() => expect(screen.getByRole('button', { name: t.reveal.next })).toBeInTheDocument(), { timeout: 3000 });
  });

  it('reports a load failure with a retry', async () => {
    const failing: GameClient = { ...client, daily: vi.fn().mockRejectedValueOnce(new Error('down')).mockImplementation(client.daily) };
    client = failing;
    render(<Play />);
    const retry = await screen.findByRole('button', { name: t.errors.retry });
    expect(screen.getByText(t.errors.title)).toBeInTheDocument();
    await act(async () => fireEvent.click(retry));
    await screen.findByText(t.progress(1, 5));
  });
});
