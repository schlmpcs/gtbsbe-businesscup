// Compare two scenarios: both net worth series, the differences and one sentence. Fixture-backed
// (fixturePlan.ts) until MP3 lands.
import { useCallback, useMemo, useState } from 'react';
import { plan as copy } from '@/copy';
import { fixturePlan } from './fixturePlan';
import { money, signedMoney, toneOf } from './planFormat';
import { usePlanStore } from './planStore';
import type { CompareVM, PlanTone } from './types';

/** Differences smaller than this many dollars read as "about the same". */
const SAME_WITHIN = 0.5;

export function useCompare(aId: string, bId: string): CompareVM {
  const scenarios = usePlanStore((s) => s.scenarios);
  const [swapped, setSwapped] = useState(false);
  const swap = useCallback(() => setSwapped((v) => !v), []);
  const [firstId, secondId] = swapped ? [bId, aId] : [aId, bId];

  return useMemo((): CompareVM => {
    const a = scenarios.find((s) => s.id === firstId);
    const b = scenarios.find((s) => s.id === secondId);
    if (!a || !b) return { status: 'notFound' };
    const pa = fixturePlan(a);
    const pb = fixturePlan(b);
    const n = Math.min(pa.years.length, pb.years.length);
    const series = Array.from({ length: n }, (_, i) => ({ year: pa.years[i]!.year, age: pa.years[i]!.age, a: pa.years[i]!.netWorth, b: pb.years[i]!.netWorth }));

    const k = copy.compare.kpi;
    const shortLabel = (age: number | null, endAge: number) => (age === null ? copy.kpi.shortfall.never(endAge) : copy.kpi.shortfall.age(age));
    const dRet = pa.kpis.netWorthAtRetirement - pb.kpis.netWorthAtRetirement;
    const dEnd = pa.kpis.netWorthAtEnd - pb.kpis.netWorthAtEnd;
    const yrs = (pa.kpis.shortfallAge ?? a.assumptions.endAge + 1) - (pb.kpis.shortfallAge ?? b.assumptions.endAge + 1);
    const tone = (d: number): PlanTone | null => (Math.abs(d) < SAME_WITHIN ? null : toneOf(d));

    const direction = Math.abs(dRet) < SAME_WITHIN ? 'same' : dRet > 0 ? 'higher' : 'lower';
    const age = a.assumptions.retireAge;
    const diffLabel = money(Math.abs(dRet));
    const sentence =
      direction === 'same'
        ? copy.compare.sentence.same(a.name, b.name, age)
        : copy.compare.sentence[direction](a.name, b.name, diffLabel, age);

    return {
      status: 'ready',
      a: { id: a.id, name: a.name },
      b: { id: b.id, name: b.name },
      series,
      diffTable: [
        { id: 'netWorthAtRetirement', label: k.netWorthAtRetirement, aLabel: money(pa.kpis.netWorthAtRetirement), bLabel: money(pb.kpis.netWorthAtRetirement), diffLabel: signedMoney(dRet), tone: tone(dRet) },
        { id: 'netWorthAtEnd', label: k.netWorthAtEnd, aLabel: money(pa.kpis.netWorthAtEnd), bLabel: money(pb.kpis.netWorthAtEnd), diffLabel: signedMoney(dEnd), tone: tone(dEnd) },
        {
          id: 'shortfall', label: k.shortfall, aLabel: shortLabel(pa.kpis.shortfallAge, a.assumptions.endAge), bLabel: shortLabel(pb.kpis.shortfallAge, b.assumptions.endAge),
          diffLabel: yrs === 0 ? '—' : copy.editor.preview.years(`${yrs > 0 ? '+' : '−'}${Math.abs(yrs)}`), tone: tone(yrs),
        },
      ],
      sentenceData: { aName: a.name, bName: b.name, age, direction, diffLabel },
      sentence,
      swap,
    };
  }, [scenarios, firstId, secondId, swap]);
}
