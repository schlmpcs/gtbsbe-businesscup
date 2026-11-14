// The duel card builder: what the browser may see of a life before it picks (PublicDuelCard), and
// the hint. Shared by the fixture duel client (browser, sample cards) and the server's duel set
// (server/game/duel.ts, the catalog), so both build byte-identical cards from one copy.
//
// Pure, and it holds no card data: it turns a LifeCard it is given into words. Browser code may
// import it. What a PublicDuelCard must never carry (totals, category amounts, the ZIP, the area
// tier, the card id) is tested in server/game/duel.test.ts.
import { LAYOUTS, carSprite } from '@lifeguessr/engine';
import type { AreaData, DuelLetter, LifeCard, PublicDuelCard } from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';

/** The 4 fact chips of a life: car, kids, eating out, housing. Picks words only; no cost facts. */
export function duelFacts(card: LifeCard): string[] {
  const car = !card.car
    ? t.facts.noCar
    : { 'garage/economy': t.facts.economyCar, 'garage/mid': t.facts.midCar, 'garage/luxury': t.facts.luxuryCar }[carSprite(card.car.price)];
  const kids = card.kids.length === 0
    ? t.facts.noKids
    : card.kids.some((k) => k !== 'schoolAge') ? t.facts.daycare : t.facts.schoolKids;
  const meals = card.eatingOutPerWeek;
  const food = meals <= 1 ? t.facts.cooksAtHome : meals <= 3 ? t.facts.eatsOutSometimes : meals <= 6 ? t.facts.eatsOutOften : t.facts.eatsOutMostDays;
  // "Rents" is hard-coded: costOfLife prices every card as a renter (rentUtilities from the area's
  // rent), so it is true of every card today. If a LifeCard ever owns its home (a mortgage, or no
  // rent line), this chip must come from that field instead, or it will state a false fact.
  return [car, kids, food, t.facts.rents];
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
