// @vitest-environment jsdom
// S21 route: streamer mode builds nothing of the tool, and a normal visit shows it, cold, on the real
// catalogue and the real store slice (only the wiring call is counted, to prove streamer mode never makes it).
// A reload goes through the real store and the browser's storage, never an in-memory stand-in.
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscriptions as t } from '@/copy';
import type * as Wiring from '@/features/subscriptions/model/wiring';
import { resetClientState } from '@/test/clientState';
import { mockForecastRoute } from '@/test/forecastApi';
import { reloadAppStore } from '@/test/subscriptions';
import SubscriptionsPage from './page';

const wiring = vi.hoisted(() => ({ builds: 0 }));
vi.mock('@/features/subscriptions/model/wiring', async (importOriginal) => {
  const real = await importOriginal<typeof Wiring>();
  return {
    ...real,
    useSubscriptionsDeps: () => {
      wiring.builds += 1;
      return real.useSubscriptionsDeps();
    },
  };
});

beforeEach(() => {
  resetClientState();
  mockForecastRoute();
  wiring.builds = 0;
});

async function renderPage(search: { stream?: string | string[] } = {}) {
  // The page reads `searchParams` with `use`, which suspends once: render inside an awaited act.
  await act(async () => {
    render(
      <Suspense fallback={<p>suspended</p>}>
        <SubscriptionsPage searchParams={Promise.resolve(search)} />
      </Suspense>,
    );
  });
}

describe('/tools/subscriptions (S21)', () => {
  it('streamer mode shows a notice and builds nothing of the tool: no wiring, no guess box, no findings', async () => {
    await renderPage({ stream: '1' });
    expect(await screen.findByRole('heading', { level: 1, name: t.streamer.title })).toBeInTheDocument();
    expect(screen.getByText(t.streamer.body)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.guess.label)).not.toBeInTheDocument();
    expect(wiring.builds).toBe(0);
  });

  it('a visit shows the tool, cold, starting on the statement upload, under its own heading (no screen id)', async () => {
    await renderPage();
    expect(await screen.findByLabelText(t.statement.pickerLabel)).toBeInTheDocument();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(t.screens.S21);
    expect(h1).not.toHaveTextContent(/\bS\d{1,2}\b/);
    expect(wiring.builds).toBeGreaterThan(0);
  });

  it('survives a reload on the real store: the ticks are still ticked and the gap is the same', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole('button', { name: t.statement.byHand }));
    await user.type(await screen.findByLabelText(t.guess.label), '20');
    await user.click(screen.getByRole('button', { name: t.guess.next }));
    for (const name of ['Netflix', 'Spotify', 'Planet Fitness']) await user.click(screen.getByRole('checkbox', { name }));
    // Catalogue prices (packages/data/subscriptions.json): 8.99 + 12.99 + 15.00 = 36.98 a month.
    expect(within(screen.getByRole('status')).getByText(/\$36\.98 a month/)).toBeInTheDocument();

    cleanup();
    await reloadAppStore();
    await renderPage();

    // It starts where it was left (the ticks), with all three still ticked and the same total.
    for (const name of ['Netflix', 'Spotify', 'Planet Fitness']) expect(await screen.findByRole('checkbox', { name })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Disney+' })).not.toBeChecked();
    expect(within(screen.getByRole('status')).getByText(/\$36\.98 a month/)).toBeInTheDocument();
    // And the guess came back too: 20 against 36.98 is $16.98 under, a factor of 0.54 (20 ÷ 36.98).
    await user.click(screen.getByRole('button', { name: t.ticks.next }));
    expect(screen.getByText(t.reveal.gap.lower('$16.98'))).toBeInTheDocument();
    expect(screen.getByText(`${t.reveal.factor('0.54')} · ${t.reveal.bucket['0.5to0.8']}`)).toBeInTheDocument();
  });

  it('only the exact ?stream=1 turns it off', async () => {
    await renderPage({ stream: '0' });
    expect(await screen.findByLabelText(t.statement.pickerLabel)).toBeInTheDocument();
  });
});
