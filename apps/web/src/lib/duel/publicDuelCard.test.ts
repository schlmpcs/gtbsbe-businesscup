import type { AreaData, LifeCard } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import { createFixtureDuelClient } from '@/features/game/model/duelFixtureClient';
import { duelCardsSample } from '@/fixtures/duelCards';
import { areaForZip } from '@/lib/areas';
import { duelFacts, hintOf, publicDuelCard } from './publicDuelCard';

const sample = (id: string): LifeCard => duelCardsSample.find((c) => c.id === id)!;

describe('the shared duel card builder', () => {
  // Pinned from the fixture client's output before the builder moved here (2026-11-14, round 1):
  // the move must not change a byte of what the browser sees.
  it('builds the same PublicDuelCard the fixture client built before the move', () => {
    expect(publicDuelCard(sample('sample-duel-03'), 'A')).toEqual({
      letter: 'A',
      household: '2 adults · 2 kids · 3 bedrooms',
      metro: 'Boston, MA',
      caption: "Coaches the kids' Little League team.",
      facts: ['1 car', 'School-age kids', 'Eats out sometimes', 'Rents'],
      art: 'layout/3bed',
      composite: true,
    });
    expect(publicDuelCard(sample('sample-duel-01'), 'B')).toEqual({
      letter: 'B',
      household: '1 adult · no kids · studio',
      metro: 'Atlanta, GA',
      caption: 'Sells vintage records on weekends.',
      facts: ['No car', 'No kids', 'Eats out often', 'Rents'],
      art: 'layout/studio',
      composite: true,
    });
    expect(duelFacts(sample('sample-duel-02'))).toEqual(['Economy car', 'Daycare', 'Eats out sometimes', 'Rents']);
    expect(duelFacts(sample('sample-duel-05'))).toEqual(['No car', 'Daycare', 'Cooks at home', 'Rents']);
  });

  it('the fixture client serves exactly the shared builder’s cards and hints', async () => {
    const client = createFixtureDuelClient({ persist: false });
    for (const date of ['2026-11-14', '2026-11-15', '2027-02-28', '2027-07-04', '2028-12-31']) {
      const { duels } = await client.daily(date);
      expect(duels).toHaveLength(5);
      for (const duel of duels) {
        for (const card of duel.cards) {
          const source = duelCardsSample.find((c) => c.caption === card.caption && c.metro === card.metro)!;
          expect(card).toEqual(publicDuelCard(source, card.letter));
        }
        const [a, b] = duel.cards.map((card) => duelCardsSample.find((c) => c.caption === card.caption && c.metro === card.metro)!);
        expect(await client.hint(duel.round, date)).toEqual({ A: hintOf(areaForZip(a!.zip)), B: hintOf(areaForZip(b!.zip)) });
      }
    }
  });

  it('the hint is the neighborhood tier, or "unknown" without area data', () => {
    const tiers: AreaData['tier'][] = ['cheap', 'mid', 'expensive', 'suburb'];
    for (const tier of tiers) expect(hintOf({ tier } as AreaData)).toBe(t.hintFacts[tier]);
    expect(hintOf(null)).toBe(t.hintUnknown);
  });

  it('picks the fact words from the card’s fields', () => {
    const base = sample('sample-duel-01');
    expect(duelFacts({ ...base, car: { price: 90_000, downPayment: 10_000, apr: 0.07, termMonths: 60 } })[0]).toBe(t.facts.luxuryCar);
    expect(duelFacts({ ...base, eatingOutPerWeek: 0 })[2]).toBe(t.facts.cooksAtHome);
    expect(duelFacts({ ...base, eatingOutPerWeek: 7 })[2]).toBe(t.facts.eatsOutMostDays);
    expect(duelFacts({ ...base, kids: ['schoolAge', 'infant'] })[1]).toBe(t.facts.daycare);
    expect(duelFacts(base)[3]).toBe(t.facts.rents);
  });
});
