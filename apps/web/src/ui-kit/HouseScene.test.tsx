// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { areaByZip, cardsSample } from '@lifeguessr/data/fixtures';
import { DECOR_ROOMS, LAYOUTS, sceneOf } from '@lifeguessr/engine';
import { CLUE_IDS, type ClueId, type SceneLayout, type SceneProp } from '@lifeguessr/types';
import { common, game } from '@/copy';
import { HouseScene, type HouseSceneRoom } from './HouseScene';
import { CLUE_ROOM_RECTS, DECOR_ROOM_GEOMETRY, STAGE, zoomTransform } from './houseSceneGeometry';

const t = common.kit.houseScene;
const card = cardsSample.find((c) => c.car && c.kids.length > 0)!;
const scene = sceneOf(card, areaByZip(card.zip));

const room = (id: ClueId, patch: Partial<HouseSceneRoom> = {}): HouseSceneRoom => ({
  id,
  label: game.clues.rooms[id],
  status: 'closed',
  badge: '−10%',
  hint: `Tap to look (−10% points)`,
  props: [],
  ...patch,
});

/** A scene wired like the game: tapping a closed room opens it (synchronously here). */
function Playable({ onOpenRoom = () => {}, disabled = false }: { onOpenRoom?: (id: ClueId) => void; disabled?: boolean }) {
  const [open, setOpen] = useState<ClueId[]>([]);
  const rooms = CLUE_IDS.map((id) =>
    open.includes(id)
      ? room(id, { status: 'open', hint: 'Opened', props: scene.clues[id].props, details: <p>Facts for {id}</p> })
      : room(id),
  );
  return (
    <HouseScene
      layout={scene.public.layout}
      layoutLabel="3-bedroom"
      decor={scene.public.decor}
      rooms={rooms}
      onOpenRoom={(id) => {
        onOpenRoom(id);
        setOpen((o) => [...o, id]);
      }}
      spriteLabel={game.scene.sprite}
      disabled={disabled}
    />
  );
}

describe('HouseScene', () => {
  it('draws the house with every room closed and nothing of the answer', () => {
    render(<Playable />);
    const house = screen.getByRole('group', { name: t.house('3-bedroom') });
    for (const id of CLUE_IDS) {
      const button = within(house).getByRole('button', { name: game.clues.rooms[id] });
      expect(button).toHaveAccessibleDescription('Tap to look (−10% points)');
      expect(button).toHaveAttribute('data-status', 'closed');
      expect(button).toHaveTextContent('−10%');
    }
    // Only the shell and decor are drawn: no clue sprite is in the page before a room opens.
    const srcs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(srcs).toContain(`/scene/layout/${scene.public.layout}.svg`);
    for (const id of CLUE_IDS) {
      for (const p of scene.clues[id].props) expect(srcs).not.toContain(`/scene/${p.sprite}.svg`);
    }
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('tap → zoom → asks for the clue once → shows the props and facts; back returns focus', async () => {
    const user = userEvent.setup();
    const onOpenRoom = vi.fn();
    render(<Playable onOpenRoom={onOpenRoom} />);
    const kitchen = screen.getByRole('button', { name: game.clues.rooms.kitchen });
    await user.click(kitchen);
    expect(onOpenRoom).toHaveBeenCalledExactlyOnceWith('kitchen');

    const closeUp = screen.getByRole('region', { name: t.closeUp(game.clues.rooms.kitchen) });
    expect(within(closeUp).getByRole('heading', { name: game.clues.rooms.kitchen })).toHaveFocus();
    expect(within(closeUp).getByText('Facts for kitchen')).toBeInTheDocument();
    const takeout = scene.clues.kitchen.props[0]!.sprite;
    expect(within(closeUp).getByText(game.scene.sprite(takeout))).toBeInTheDocument();
    // The house zooms into the room and is only a picture while zoomed.
    const stage = document.querySelector('[data-zoomed]') as HTMLElement;
    expect(stage).toHaveAttribute('data-zoomed', 'kitchen');
    expect(stage.style.transform).toBe(zoomTransform(CLUE_ROOM_RECTS.kitchen));
    expect(stage).toHaveAttribute('inert');

    await user.click(within(closeUp).getByRole('button', { name: t.back }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(kitchen).toHaveFocus();
    expect(kitchen).toHaveAttribute('data-status', 'open');

    // An open room zooms again without asking for the clue twice.
    await user.click(kitchen);
    expect(screen.getByRole('region', { name: t.closeUp(game.clues.rooms.kitchen) })).toBeInTheDocument();
    expect(onOpenRoom).toHaveBeenCalledTimes(1);
  });

  it('Escape leaves the close-up', async () => {
    const user = userEvent.setup();
    render(<Playable />);
    const garage = screen.getByRole('button', { name: game.clues.rooms.garage });
    await user.click(garage);
    expect(screen.getByRole('region')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).toBeNull();
    expect(garage).toHaveFocus();
  });

  it('disabled: closed rooms cannot be opened, open rooms can still be looked at', async () => {
    const user = userEvent.setup();
    const onOpenRoom = vi.fn();
    render(
      <HouseScene
        layout="studio"
        layoutLabel="Studio"
        decor={[]}
        rooms={[room('garage'), room('kitchen', { status: 'open', props: scene.clues.kitchen.props })]}
        onOpenRoom={onOpenRoom}
        spriteLabel={game.scene.sprite}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: game.clues.rooms.garage })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: game.clues.rooms.kitchen }));
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(onOpenRoom).not.toHaveBeenCalled();
  });

  it('a room that failed to open says so and can retry', async () => {
    const user = userEvent.setup();
    const onOpenRoom = vi.fn();
    render(
      <HouseScene
        layout="1bed"
        layoutLabel="1-bedroom"
        decor={[]}
        rooms={[room('mailbox', { status: 'error', badge: 'Retry', error: 'That room didn’t open.' })]}
        onOpenRoom={onOpenRoom}
        spriteLabel={game.scene.sprite}
      />,
    );
    const mailbox = screen.getByRole('button', { name: game.clues.rooms.mailbox });
    expect(mailbox).toHaveTextContent('Retry');
    await user.click(mailbox);
    expect(onOpenRoom).toHaveBeenCalledWith('mailbox');
    const closeUp = screen.getByRole('region');
    expect(within(closeUp).getByText('That room didn’t open.')).toBeInTheDocument();
    await user.click(within(closeUp).getByRole('button', { name: t.retry }));
    expect(onOpenRoom).toHaveBeenCalledTimes(2);
  });

  it('places every decor prop of every layout in a slot of its room', () => {
    const layouts = Object.values(LAYOUTS) as SceneLayout[];
    const placed = new Set<string>();
    for (const layout of layouts) {
      const bedrooms = Object.entries(LAYOUTS).find(([, l]) => l === layout)![0];
      const c = { ...cardsSample[0]!, bedrooms: Number(bedrooms) as 0 | 1 | 2 | 3 | 4 };
      const decor: SceneProp[] = sceneOf(c, areaByZip(c.zip)).public.decor;
      const geometry = DECOR_ROOM_GEOMETRY[layout];
      for (const g of geometry) placed.add(g.id);
      for (const roomId of new Set(decor.map((d) => d.room))) {
        const items = decor.filter((d) => d.room === roomId);
        const g = geometry.find((x) => x.id === roomId);
        expect(g, `${layout}: no geometry for decor room ${roomId}`).toBeDefined();
        expect(items.length, `${layout}/${roomId}: more decor than slots`).toBeLessThanOrEqual(g!.slots.length);
      }
    }
    expect([...placed].sort()).toEqual([...DECOR_ROOMS].sort());
  });

  it('zooming keeps the room fully on the stage', () => {
    for (const id of CLUE_IDS) {
      const r = CLUE_ROOM_RECTS[id];
      const m = /translate\((-?[\d.]+)%, (-?[\d.]+)%\) scale\(([\d.]+)\)/.exec(zoomTransform(r))!;
      const [tx, ty, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const left = tx + (s * r.x * 100) / STAGE.width;
      const right = tx + (s * (r.x + r.w) * 100) / STAGE.width;
      const top = ty + (s * r.y * 100) / STAGE.height;
      const bottom = ty + (s * (r.y + r.h) * 100) / STAGE.height;
      expect(left, id).toBeGreaterThanOrEqual(-0.01);
      expect(right, id).toBeLessThanOrEqual(100.01);
      expect(top, id).toBeGreaterThanOrEqual(-0.01);
      expect(bottom, id).toBeLessThanOrEqual(100.01);
      expect(s, id).toBeGreaterThan(2); // a real close-up
    }
  });
});
