// The placeholder sprite kit in public/scene: one file per engine sprite id, each with alt text.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPRITE_IDS } from '@lifeguessr/engine';
import { game } from '@/copy';

describe('scene sprites', () => {
  const publicScene = fileURLToPath(new URL('../../public/scene/', import.meta.url));

  it('every sprite id has a file in public/scene (the D1 kit replaces them one-for-one)', () => {
    const missing = SPRITE_IDS.filter((id) => !existsSync(`${publicScene}${id}.svg`));
    expect(missing).toEqual([]);
  });

  it('every sprite id has words for alt text', () => {
    for (const id of SPRITE_IDS) expect(game.scene.sprites[id], id).toMatch(/\S/);
  });
});
