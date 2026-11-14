import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ScenarioSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { findArea, getArea } from '../areas';
import { resolveWhatIfPreset, whatIfPresets } from './index';

const artDir = fileURLToPath(new URL('../../../apps/web/public/art/what-if/', import.meta.url));

describe('what-if presets', () => {
  it('are the five presets with unique ids, art on disk and only ZIPs we have data for', () => {
    expect(whatIfPresets.map((p) => p.id)).toEqual(['car', 'city', 'baby', 'card', 'rent']);
    for (const p of whatIfPresets) {
      for (const side of [p.A, p.B]) {
        expect(existsSync(`${artDir}${side.art}.webp`), `${p.id} ${side.art}`).toBe(true);
        for (const c of side.changes) if (c.kind === 'move') expect(findArea(c.zip), c.zip).not.toBeNull();
      }
    }
  });

  it('label preset loan terms as estimates with a source', () => {
    const car = whatIfPresets.find((p) => p.id === 'car')!;
    expect(car.isEstimate).toBe(true);
    expect(car.source.name).toMatch(/not a quote/);
  });

  it('resolve a move within the home metro to that tier, and skip a move to where you already live', () => {
    const rent = whatIfPresets.find((p) => p.id === 'rent')!;
    const home = getArea('75206');
    const a = resolveWhatIfPreset(rent.A, home);
    expect(ScenarioSchema.parse(a)).toEqual(a);
    expect(a.changes).toEqual([{ kind: 'move', zip: '75205' }]);
    expect(resolveWhatIfPreset(rent.B, home).changes).toEqual([{ kind: 'move', zip: '75024' }]);
    expect(resolveWhatIfPreset(rent.A, getArea('75205')).changes).toEqual([]);
  });
});
