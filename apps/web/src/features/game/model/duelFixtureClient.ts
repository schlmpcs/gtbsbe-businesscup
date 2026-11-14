// The fixture duel: the DuelClient contract computed in the browser from the sample cards with the
// real engine (costOfLife → dailyDuelPairs → scoreDuelPick), so the duel plays without a server.
// It plays the part of the server: it holds the answers, keeps one pick per round and the hint log
// per day (in localStorage, so a reload can neither re-pick nor drop a hint), and fills the lesson
// from the fixed template table in @/copy. Crowd counts need many players: always null here.
//
// It holds the answers (the cards), so only ./duelClient loads it, with a dynamic import() that a
// duel API build drops (NEXT_PUBLIC_DUEL_SOURCE=api). Don't import it statically from browser code; the
// ESLint rule in eslint.config.mjs holds that.
import { LAYOUTS, carSprite, costOfLife, dailyDuelPairs, scoreDuelPick } from '@lifeguessr/engine';
import type {
  AreaData, CostBreakdown, DuelHint, DuelLetter, DuelRound, LifeCard, PickResult, PublicDuel, PublicDuelCard,
} from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';
import { duelCardsSample } from '@/fixtures/cards';
import { ApiError } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { newUuid } from '@/state/anonId';
import type { DuelClient } from './duelClient';
import { FIXTURE_DUEL_LOG_KEY, parseDuelLog, type DuelLog } from './duelProgress';

export { FIXTURE_DUEL_LOG_KEY };

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
  return [car, kids, food, t.facts.rents];
}

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

const hintOf = (area: AreaData | null): string => (area ? t.hintFacts[area.tier] : t.hintUnknown);

export function createFixtureDuelClient(
  opts: { cards?: readonly LifeCard[]; persist?: boolean; areaFor?: (zip: string) => AreaData | null } = {},
): DuelClient {
  const cards = opts.cards ?? duelCardsSample;
  const persist = opts.persist ?? true;
  const areaFor = opts.areaFor ?? areaForZip;
  let log: DuelLog | null = null;
  /** The day's pairs as card ids, by round. */
  let pairs: { date: string; byRound: Map<DuelRound, Record<DuelLetter, LifeCard>> } | null = null;

  const save = () => {
    if (persist && log) writeStorage(FIXTURE_DUEL_LOG_KEY, JSON.stringify(log));
  };
  const restore = (date: string): DuelLog | null => (persist ? parseDuelLog(readStorage(FIXTURE_DUEL_LOG_KEY), date) : null);

  const costOf = (card: LifeCard): CostBreakdown => {
    const area = areaFor(card.zip);
    if (!area) throw new ApiError(`No fixture AreaData for ZIP ${card.zip}`, 404);
    return costOfLife(card, area);
  };

  const pairOf = (round: DuelRound, date: string) => {
    if (!log || !pairs || date !== log.date) throw new ApiError(`No duel set for ${date}`, 404);
    const pair = pairs.byRound.get(round);
    if (!pair) throw new ApiError(`No round ${round} on ${date}`, 404);
    return pair;
  };

  return {
    source: 'fixtures',
    async daily(today) {
      const candidates = cards.map((c) => ({ id: c.id, total: costOf(c).total.mid }));
      const set = dailyDuelPairs(today, candidates);
      const byId = new Map(cards.map((c) => [c.id, c]));
      pairs = { date: today, byRound: new Map(set.map((p) => [p.round, { A: byId.get(p.A)!, B: byId.get(p.B)! }])) };
      log = (log?.date === today ? log : null) ?? restore(today)
        ?? { date: today, resultId: `fixture-duel-${today}-${newUuid().slice(0, 8)}`, picks: {}, hints: {} };
      save();
      const duels: PublicDuel[] = set.map((p) => ({
        date: today,
        round: p.round,
        kind: 'life',
        cards: [publicDuelCard(byId.get(p.A)!, 'A'), publicDuelCard(byId.get(p.B)!, 'B')],
      }));
      return { date: today, duels, progress: { picks: { ...log.picks }, hints: { ...log.hints } } };
    },

    async hint(round, date) {
      const pair = pairOf(round, date);
      const hint: DuelHint = { A: hintOf(areaFor(pair.A.zip)), B: hintOf(areaFor(pair.B.zip)) };
      // Like a server: a hint opened after the pick doesn't change the score.
      if (!log!.picks[round] && !log!.hints[round]) {
        log!.hints[round] = hint;
        save();
      }
      return hint;
    },

    async pick(round, choice, date) {
      const pair = pairOf(round, date);
      const done = log!.picks[round];
      if (done) return done.result; // one pick per round: repeat the stored result
      const score = scoreDuelPick({ A: costOf(pair.A), B: costOf(pair.B) }, choice, log!.hints[round] ? 1 : 0);
      const result: PickResult = {
        resultId: log!.resultId,
        correct: score.correct,
        points: score.points,
        totals: score.totals,
        breakdown: score.breakdown,
        decidedBy: score.decidedBy,
        lesson: t.lessons[score.lesson],
        crowd: null,
      };
      log!.picks[round] = { choice, result };
      save();
      return result;
    },
  };
}
