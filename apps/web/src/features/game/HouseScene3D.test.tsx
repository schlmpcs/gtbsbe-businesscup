// @vitest-environment jsdom
// The 3D house scene on the real view-model and fixture game client: the empty layout render first,
// and a room's 3D props only in its close-up after it is opened (they come from its ClueReveal).
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { common, game as t } from '@/copy';
import { resetClientState } from '@/test/clientState';
import { createFixtureGameClient, type GameClient } from './model/client';
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
