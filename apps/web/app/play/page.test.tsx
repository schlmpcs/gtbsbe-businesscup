// @vitest-environment jsdom
// /play picks the game: the duel by default, the slider game with NEXT_PUBLIC_GAME_MODE=slider (the
// rollback). The two views are stubbed: their own tests cover them.
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkedScreenIds } from '@/lib/screens';
import PlayPage from './page';

vi.mock('../duel/DuelView', () => ({
  DuelView: ({ challenged }: { challenged: boolean }) => <p>duel{challenged ? ' challenged' : ''}</p>,
}));
vi.mock('@/features/game/model/usePlay', () => ({
  usePlay: ({ streamer }: { streamer: boolean }) => ({ streamer }),
}));
vi.mock('@/features/game/ui/PlayScreen', () => ({
  PlayScreen: ({ vm }: { vm: { streamer: boolean } }) => <p>slider{vm.streamer ? ' streamer' : ''}</p>,
}));

afterEach(() => vi.unstubAllEnvs());

async function renderPlay(params: { stream?: string; c?: string } = {}) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PlayPage searchParams={Promise.resolve(params)} />
      </Suspense>,
    );
  });
}

describe('/play', () => {
  it('is the duel by default, and ?stream=1 does not switch it', async () => {
    await renderPlay({ stream: '1', c: 'friend-result' });
    expect(screen.getByText('duel challenged')).toBeInTheDocument();
    expect(screen.queryByText(/slider/)).not.toBeInTheDocument();
  });

  it('is the slider game with NEXT_PUBLIC_GAME_MODE=slider, streamer mode included', async () => {
    vi.stubEnv('NEXT_PUBLIC_GAME_MODE', 'slider');
    await renderPlay({ stream: '1' });
    expect(screen.getByText('slider streamer')).toBeInTheDocument();
    expect(screen.queryByText(/duel/)).not.toBeInTheDocument();
  });
});

describe('linked screens (S1 "All screens")', () => {
  it('leaves out S4 Streamer mode with the duel, lists it with the slider game', () => {
    expect(linkedScreenIds('duel')).not.toContain('S4');
    expect(linkedScreenIds('duel')).toContain('S2');
    expect(linkedScreenIds('slider')).toContain('S4');
    expect(linkedScreenIds()).not.toContain('S4'); // the default is the duel
  });
});
