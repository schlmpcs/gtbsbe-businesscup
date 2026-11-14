// @vitest-environment jsdom
// The 3D house scene on the real view-model and fixture game client: the empty layout render first,
// and a room's 3D props only in its close-up after it is opened (they come from its ClueReveal).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { common, game as t } from '@/copy';
import { ANON, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { resetClientState } from '@/test/clientState';
import { createRouteFetch } from '@/test/gameRoutes';
import { createFixtureGameClient, createHttpGameClient, type GameClient } from './model/client';
import { usePlay } from './model/usePlay';
import { PlayScreen } from './ui/PlayScreen';

let client: GameClient;
beforeEach(() => {
  resetClientState();
  client = createFixtureGameClient({ persist: false });
});

function Play() {
  const vm = usePlay({ client });
  return <PlayScreen vm={vm} guessOwnHref="/me/guess" />;
}

const sprites = () =>
  Array.from(document.querySelectorAll('img'))
    .map((img) => img.getAttribute('src') ?? '')
    .filter((src) => src.startsWith('/scene/'));

describe('HouseScene3D (default clue panel)', () => {
  it('shows only the empty layout render until a room is opened, then that room’s 3D props', async () => {
    render(<Play />);
    await screen.findByText(t.progress(1, 5));
    expect(sprites()).toHaveLength(1);
    expect(sprites()[0]).toMatch(/^\/scene\/layout\/(studio|1bed|2bed|3bed|4bed)\.webp$/);

    fireEvent.click(screen.getByRole('button', { name: t.clues.rooms.kitchen }));
    const closeUp = screen.getByRole('region', { name: common.kit.houseScene.closeUp(t.clues.rooms.kitchen) });
    await within(closeUp).findByText(/Takeout and restaurants/);
    const inside = Array.from(closeUp.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(inside).toHaveLength(1);
    expect(inside[0]).toMatch(/^\/scene\/kitchen\/takeout-(0-1|2-3|4-6|7plus)\.webp$/);
    expect(sprites().some((src) => src.startsWith('/scene/garage/'))).toBe(false); // garage still closed

    fireEvent.click(within(closeUp).getByRole('button', { name: common.kit.houseScene.back }));
    expect(screen.queryByRole('region', { name: common.kit.houseScene.closeUp(t.clues.rooms.kitchen) })).toBeNull();
    expect(screen.getByRole('button', { name: t.clues.rooms.kitchen })).toHaveAttribute('data-status', 'open');
  });
});

describe('HouseScene3D in API mode', () => {
  const getStore = setupGameTestEnv();
  afterEach(() => vi.unstubAllGlobals());

  it('a room tap goes through POST /api/daily/clue, which records it before the room opens', async () => {
    const routes = createRouteFetch();
    vi.stubGlobal('fetch', routes.fetch);
    client = createHttpGameClient({ anonId: () => ANON });
    render(<Play />);
    await screen.findByText(t.progress(1, 5));

    fireEvent.click(screen.getByRole('button', { name: t.clues.rooms.garage }));
    await waitFor(() => expect(screen.getByRole('button', { name: t.clues.rooms.garage })).toHaveAttribute('data-status', 'open'));
    const clueCalls = routes.calls.filter((c) => c.path === '/api/daily/clue');
    expect(clueCalls).toHaveLength(1);
    expect(clueCalls[0]!.body).toMatchObject({ anonId: ANON, clue: 'garage', date: TODAY });
    const cardId = (clueCalls[0]!.body as { cardId: string }).cardId;
    expect((await getStore().game.playerDay(TODAY, ANON)).clues).toEqual({ [cardId]: ['garage'] });
  });
});
