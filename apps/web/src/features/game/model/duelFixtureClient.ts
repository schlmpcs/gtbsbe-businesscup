// The fixture duel: the DuelClient contract computed in the browser from the sample cards with the
// real engine (costOfLife → dailyDuelPairs → scoreDuelPick), so the duel plays without a server.
// It plays the part of the server: it holds the answers, keeps one pick per round and the hint log
// per day (in localStorage, so a reload can neither re-pick nor drop a hint), and fills the lesson
// from the fixed template table in @/copy. Crowd counts need many players: always null here. The
// public cards and hints come from the builder the server uses too (@/lib/duel/publicDuelCard).
//
// It holds the answers (the cards), so only ./duelClient loads it, with a dynamic import() that a
// duel API build drops (NEXT_PUBLIC_DUEL_SOURCE=api). Don't import it statically from browser code; the
// ESLint rule in eslint.config.mjs holds that.
import { costOfLife, DUEL_ROUND_COUNT, dailyDuelPairs, scoreDuelPick } from '@lifeguessr/engine';
import {
  DUEL_ROUNDS,
  type AreaData, type CostBreakdown, type DuelHint, type DuelLetter, type DuelRound, type LifeCard, type PickResult,
  type PublicDuel,
} from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';
import { duelCardsSample } from '@/fixtures/duelCards';
import { ApiError } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { scoreDuelDay } from '@/lib/duel/duelDay';
import { hintOf, publicDuelCard } from '@/lib/duel/publicDuelCard';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { newUuid } from '@/state/anonId';
import type { DuelChallenge, DuelClient } from './duelClient';
import { FIXTURE_DUEL_LOG_KEY, parseDuelLog, parseStoredDuelLog, type DuelLog } from './duelProgress';

export { FIXTURE_DUEL_LOG_KEY };

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
        // This browser only knows its own pick, so there is no crowd to report: null shows "Not
        // enough picks yet", which is true here. Never make one up (#116); only the server, which
        // stores everyone's picks, answers real counts.
        crowd: null,
      };
      log!.picks[round] = { choice, result };
      save();
      return result;
    },

    async challenge(resultId, today) {
      // Only the day this browser played itself: it has no other player's picks. A link from
      // anywhere else is "not found", which the screen shows as the generic challenge line.
      const own = [log, persist ? parseStoredDuelLog(readStorage(FIXTURE_DUEL_LOG_KEY)) : null].find((l) => l?.resultId === resultId);
      if (!own) return null;
      const picks = DUEL_ROUNDS.flatMap((round) => (own.picks[round] ? [{ round, scored: own.picks[round]!.result }] : []));
      return { date: own.date, rounds: DUEL_ROUND_COUNT, ...scoreDuelDay(picks), today: own.date === today } satisfies DuelChallenge;
    },
  };
}
