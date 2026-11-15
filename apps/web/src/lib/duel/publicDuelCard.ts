// The duel card builder: what the browser may see of a life before it picks (PublicDuelCard), and
// the hint. Shared by the fixture duel client (browser, sample cards) and the server's duel set
// (server/game/duel.ts, the catalog), so both build byte-identical cards from one copy.
//
// Pure, and it holds no card data: it turns a LifeCard it is given into words. Browser code may
// import it. What a PublicDuelCard must never carry (totals, category amounts, the ZIP, the area
// tier, the card id) is tested in server/game/duel.test.ts.
import { LAYOUTS, carSprite } from '@lifeguessr/engine';
import type { AreaData, DuelFactGroup, DuelLetter, KidAge, LifeCard, PublicDuelCard } from '@lifeguessr/types';
import { duel as t, type DuelRegion } from '@/copy/duel';

/** US Census regions by state (postal code). Public geography, not a price level. */
const REGION_STATES: Record<Exclude<DuelRegion, 'unknown'>, readonly string[]> = {
  northeast: ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  midwest: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
  south: ['AL', 'AR', 'DC', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
  west: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY'],
};

/** The region of a metro label ("Boston, MA" → northeast), from its trailing state code. */
export function duelRegion(metro: string): DuelRegion {
  const state = /,\s*([A-Z]{2})\s*$/.exec(metro)?.[1];
  const found = (Object.keys(REGION_STATES) as Exclude<DuelRegion, 'unknown'>[]).find((r) => state && REGION_STATES[r].includes(state));
  return found ?? 'unknown';
}

const KID_ORDER: readonly KidAge[] = ['infant', 'toddler', 'preschool', 'schoolAge'];

/**
 * The card's facts, two lines per group (Home, Family, Car, Food), each read off one LifeCard field.
 * Words only: no dollar amount, total, ZIP or neighborhood tier (the tier is the paid hint).
 */
export function duelFacts(card: LifeCard): DuelFactGroup[] {
  const f = t.facts;
  // "Rental" holds for every card today: costOfLife prices every card as a renter (rentUtilities from
  // the area's rent). If a LifeCard ever owns its home (a mortgage, or no rent line), this line must
  // come from that field instead, or it will state a false fact.
  const home: DuelFactGroup = { group: 'home', items: [f.home(card.bedrooms), f.region[duelRegion(card.metro)]] };

  const ages = KID_ORDER
    .map((age) => ({ age: f.kidAge[age], count: card.kids.filter((k) => k === age).length }))
    .filter((a) => a.count > 0);
  const young = card.kids.filter((k) => k !== 'schoolAge').length;
  const family: DuelFactGroup = card.kids.length === 0
    ? { group: 'family', items: [f.noKids, card.adults === 1 ? f.livesSolo : f.couple] }
    : { group: 'family', items: [f.kids(ages), young > 0 ? f.underSchoolAge(young) : f.allInSchool(card.kids.length)] };

  const car: DuelFactGroup = !card.car
    ? { group: 'car', items: [f.noCar, f.noCarLoan] }
    : {
        group: 'car',
        items: [
          { 'garage/economy': f.economyCar, 'garage/mid': f.midCar, 'garage/luxury': f.luxuryCar }[carSprite(card.car.price)],
          card.car.downPayment >= card.car.price ? f.paidInFull : f.financed(card.car.termMonths),
        ],
      };

  const food: DuelFactGroup = {
    group: 'food',
    items: [f.eatsOut(Math.round(card.eatingOutPerWeek)), f.groceriesFor(card.adults + card.kids.length)],
  };
  return [home, family, car, food];
}

/** One life as the browser sees it before the pick. */
export function publicDuelCard(card: LifeCard, letter: DuelLetter): PublicDuelCard {
  return {
    letter,
    household: t.household(card.adults, card.kids.length, card.bedrooms),
    metro: card.metro,
    caption: card.caption,
    facts: duelFacts(card),
    art: `layout/${LAYOUTS[card.bedrooms]}`,
    composite: true,
  };
}

/** The hint for one life: its neighborhood tier in words ("Neighborhood unknown" without area data). */
export const hintOf = (area: AreaData | null): string => (area ? t.hintFacts[area.tier] : t.hintUnknown);
