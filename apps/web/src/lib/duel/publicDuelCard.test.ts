import { PublicDuelCardSchema, type AreaData, type DuelFactGroupId, type LifeCard } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import { createFixtureDuelClient } from '@/features/game/model/duelFixtureClient';
import { duelCardsSample } from '@/fixtures/duelCards';
import { areaForZip } from '@/lib/areas';
import { duelFacts, duelRegion, hintOf, publicDuelCard } from './publicDuelCard';

const sample = (id: string): LifeCard => duelCardsSample.find((c) => c.id === id)!;

describe('the shared duel card builder', () => {
  it('builds the PublicDuelCard: household, metro, caption, the four fact groups, the house', () => {
    expect(publicDuelCard(sample('sample-duel-03'), 'A')).toEqual({
      letter: 'A',
      household: '2 adults · 2 kids · 3 bedrooms',
      metro: 'Boston, MA',
      caption: "Coaches the kids' Little League team.",
      facts: [
        { group: 'home', items: ['3-bedroom rental', 'In the Northeast'] },
        { group: 'family', items: ['Kids: 2 school-age', 'All in school'] },
        { group: 'car', items: ['Midsize car', 'Financed, 6-year loan'] },
        { group: 'food', items: ['Eats out 2×/week', 'Groceries for 4'] },
      ],
      art: 'layout/3bed',
      composite: true,
    });
    expect(publicDuelCard(sample('sample-duel-01'), 'B')).toEqual({
      letter: 'B',
      household: '1 adult · no kids · studio',
      metro: 'Atlanta, GA',
      caption: 'Sells vintage records on weekends.',
      facts: [
        { group: 'home', items: ['Studio rental', 'In the South'] },
        { group: 'family', items: ['No kids', 'Lives solo'] },
        { group: 'car', items: ['No car', 'No car loan'] },
        { group: 'food', items: ['Eats out 4×/week', 'Groceries for one'] },
      ],
      art: 'layout/studio',
      composite: true,
    });
    expect(duelFacts(sample('sample-duel-02')).map((g) => g.items)).toEqual([
      ['2-bedroom rental', 'In the South'], ['Kid: toddler', 'Not in school yet'],
      ['Economy car', 'Financed, 5-year loan'], ['Eats out 2×/week', 'Groceries for 3'],
    ]);
  });

  it('every built card passes the contract schema', () => {
    for (const card of duelCardsSample) expect(PublicDuelCardSchema.safeParse(publicDuelCard(card, 'A')).success, card.id).toBe(true);
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
    const group = (card: LifeCard, id: DuelFactGroupId) => duelFacts(card).find((g) => g.group === id)!.items;
    expect(group({ ...base, car: { price: 90_000, downPayment: 10_000, apr: 0.07, termMonths: 60 } }, 'car'))
      .toEqual([t.facts.luxuryCar, 'Financed, 5-year loan']);
    expect(group({ ...base, car: { price: 20_000, downPayment: 20_000, apr: 0, termMonths: 0 } }, 'car')[1]).toBe(t.facts.paidInFull);
    expect(group({ ...base, car: { price: 30_000, downPayment: 3_000, apr: 0.07, termMonths: 66 } }, 'car')[1]).toBe('Financed, 66-month loan');
    expect(group({ ...base, eatingOutPerWeek: 0 }, 'food')[0]).toBe('Never eats out');
    expect(group({ ...base, eatingOutPerWeek: 2.6 }, 'food')[0]).toBe('Eats out 3×/week');
    expect(group({ ...base, adults: 2, kids: ['schoolAge', 'infant', 'schoolAge'] }, 'family'))
      .toEqual(['Kids: baby, 2 school-age', '1 of 3 not in school yet']);
    expect(group({ ...base, kids: ['toddler', 'preschool'] }, 'family')).toEqual(['Kids: toddler, preschooler', 'None in school yet']);
    expect(group({ ...base, kids: ['schoolAge'] }, 'family')).toEqual(['Kid: school-age', 'In school']);
    expect(group({ ...base, adults: 2 }, 'family')).toEqual([t.facts.noKids, t.facts.couple]);
    expect(group({ ...base, adults: 2, kids: ['toddler'] }, 'food')[1]).toBe('Groceries for 3');
    expect(group({ ...base, bedrooms: 4 }, 'home')[0]).toBe('4-bedroom rental');
  });

  it('names the Census region from the metro’s state, never a price level', () => {
    expect(duelRegion('Boston, MA')).toBe('northeast');
    expect(duelRegion('Minneapolis-St. Paul, MN')).toBe('midwest');
    expect(duelRegion('Dallas-Fort Worth, TX')).toBe('south');
    expect(duelRegion('Seattle, WA')).toBe('west');
    expect(duelRegion('Somewhere')).toBe('unknown');
    const words = duelCardsSample.flatMap((c) => duelFacts(c).flatMap((g) => g.items)).join(' ').toLowerCase();
    for (const tier of ['cheap', 'mid', 'expensive', 'suburb']) expect(words).not.toMatch(new RegExp(`\\b${tier}\\b`));
    expect(words).not.toMatch(/\$/);
  });
});
