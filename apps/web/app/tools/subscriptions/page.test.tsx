// @vitest-environment jsdom
// S21 route: streamer mode builds nothing of the tool, an unconnected build says so, and a connected one
// shows the tool. The wiring (catalogue and local store, which come from M2 and M4) is replaced here.
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscriptions as t } from '@/copy';
import type { SubscriptionsDeps } from '@/features/subscriptions/model/useSubscriptions';
import { resetClientState } from '@/test/clientState';
import { mockForecastRoute } from '@/test/forecastApi';
import { testCatalogue, useMemoryStore } from '@/test/subscriptions';
import SubscriptionsPage from './page';

const wiring = vi.hoisted(() => ({ connected: false, builds: 0 }));
vi.mock('@/features/subscriptions/model/wiring', () => ({
  useSubscriptionsDeps: (): SubscriptionsDeps | null => {
    wiring.builds += 1;
    // The memory store is a hook; the page calls this hook on every render, in the same order.
    const store = useMemoryStore();
    return wiring.connected ? { catalogue: testCatalogue, store, track: () => {} } : null;
  },
}));

beforeEach(() => {
  resetClientState();
  mockForecastRoute();
  wiring.connected = false;
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
    wiring.connected = true;
    await renderPage({ stream: '1' });
    expect(await screen.findByRole('heading', { level: 1, name: t.streamer.title })).toBeInTheDocument();
    expect(screen.getByText(t.streamer.body)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.guess.label)).not.toBeInTheDocument();
    expect(wiring.builds).toBe(0);
  });

  it('a build with no catalogue or store connected says the tool is not switched on, under its own heading', async () => {
    await renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: t.screens.S21 })).toBeInTheDocument();
    expect(screen.getByText(t.notConnected)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.guess.label)).not.toBeInTheDocument();
  });

  it('a connected build shows the tool, starting cold on the guess', async () => {
    wiring.connected = true;
    await renderPage();
    expect(await screen.findByLabelText(t.guess.label)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: t.screens.S21 })).toBeInTheDocument();
  });

  it('only the exact ?stream=1 turns it off', async () => {
    wiring.connected = true;
    await renderPage({ stream: '0' });
    expect(await screen.findByLabelText(t.guess.label)).toBeInTheDocument();
  });
});
