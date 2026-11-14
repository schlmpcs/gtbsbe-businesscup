import { anonKey } from './anonKey';
import { newResultId, RESULT_ID } from './game';
import type { DuelStore, StoredPick } from './duel';
import type { DuelRound } from '@lifeguessr/types';

type Day = { date: string; resultId: string | null; hints: Set<DuelRound>; picks: StoredPick[] };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function createMemoryDuelStore(): DuelStore {
  const days = new Map<string, Day>();
  const get = (date: string, anonId: string) => {
    const key = `${date}:${anonKey(anonId)}`;
    let day = days.get(key);
    if (!day) { day = { date, resultId: null, hints: new Set(), picks: [] }; days.set(key, day); }
    return day;
  };
  return {
    async openHint({ date, anonId }, round) {
      const day = get(date, anonId);
      if (day.hints.has(round) || day.picks.some(p => p.round === round)) return { recorded: false };
      day.hints.add(round); return { recorded: true };
    },
    async submitPick({ date, anonId }, round, choice, score) {
      const day = get(date, anonId);
      const existing = day.picks.find(p => p.round === round);
      if (existing) return { resultId: day.resultId!, scored: copy(existing.scored), choice: existing.choice, replayed: true };
      const hints = day.hints.has(round) ? 1 : 0;
      const scored = copy(score(hints));
      day.resultId ??= newResultId();
      day.picks.push({ round, choice, hints, scored });
      return { resultId: day.resultId, scored: copy(scored), choice, replayed: false };
    },
    async playerDuelDay({ date, anonId }) {
      const day = get(date, anonId);
      return { resultId: day.resultId, picks: copy([...day.picks].sort((a, b) => a.round - b.round)), hintedRounds: [...day.hints].sort() };
    },
    async findDuelDay(resultId) {
      if (!RESULT_ID.test(resultId)) return null;
      const day = [...days.values()].find(d => d.resultId === resultId);
      return day ? { date: day.date, picks: copy([...day.picks].sort((a, b) => a.round - b.round)) } : null;
    },
    async crowd(date, round) {
      const result = { A: 0, B: 0 };
      for (const day of days.values()) if (day.date === date) for (const pick of day.picks) if (pick.round === round) result[pick.choice]++;
      return result;
    },
  };
}
