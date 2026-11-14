// Smoke tests for the shared engine pieces and the T12 stub. Each task adds its own test file
// (cost.test.ts, forecast.test.ts, ...) instead of editing this one.
import { describe, expect, it } from 'vitest';
import { areaByZip, cardsSample } from '@lifeguessr/data/fixtures';
import { CLUE_IDS } from '@lifeguessr/types';
import { NotImplementedError, assumptions, notImplemented, sceneOf } from './index';

describe('assumptions', () => {
  it('each carries a source or assumption: true', () => {
    for (const [id, a] of Object.entries(assumptions)) {
      const ok = ('source' in a && a.source !== undefined) || ('assumption' in a && a.assumption === true);
      expect(ok, id).toBe(true);
    }
  });

  it('stores rates as decimals, not percents', () => {
    expect(assumptions.cardAprDefault.value).toBeLessThan(1);
    expect(assumptions.returnAnnualNominal.value).toBeLessThan(1);
  });
});

describe('notImplemented', () => {
  it('names the task', () => {
    const e = notImplemented('Y1');
    expect(e).toBeInstanceOf(NotImplementedError);
    expect(e.task).toBe('Y1');
    expect(e.message).toContain('Y1');
  });
});

describe('sceneOf (stub)', () => {
  it('is deterministic and reveals one entry per clue with matching facts', () => {
    for (const card of cardsSample) {
      const area = areaByZip(card.zip);
      const scene = sceneOf(card, area);
      expect(sceneOf(card, area)).toEqual(scene);
      expect(Object.keys(scene.clues).sort()).toEqual([...CLUE_IDS].sort());
      expect(scene.public.id).toBe(card.id);
      for (const clue of CLUE_IDS) {
        expect(scene.clues[clue].clue).toBe(clue);
        expect(scene.clues[clue].props.length).toBeGreaterThan(0);
        expect(scene.clues[clue].props.every((p) => p.clue === clue)).toBe(true);
      }
      expect(scene.clues.garage.facts.car).toEqual(card.car);
      expect(scene.clues.mailbox.facts).toEqual({ zip: card.zip, tier: area.tier });
    }
  });

  it('never leaks the answer in the public card', () => {
    const card = cardsSample[0]!;
    const pub = sceneOf(card, areaByZip(card.zip)).public;
    expect(Object.keys(pub).sort()).toEqual(['caption', 'decor', 'id', 'layout', 'metro']);
  });
});
