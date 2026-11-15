// Compare two scenarios: both net worth series, the differences and one sentence, from the engine's
// compareScenarios (MP6) on the two plans. B is planned in A's display unit, so both are in the same
// dollars. The view-model's differences read A − B (the engine's are B − A).
import { COMPARE_TIE, compareScenarios } from '@lifeguessr/engine';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { money, shortfallLabel, shortfallYearsDelta, signedMoney, toneOf } from './planFormat';
import { planFor, usePlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import type { CompareVM, PlanTone } from './types';

export function useCompare(aId: string, bId: string): CompareVM {
  const inputs = usePlanInputs();
  const scenarios = usePlanStore((s) => s.scenarios);
  const [swapped, setSwapped] = useState(false);
  const swap = useCallback(() => setSwapped((v) => !v), []);
  const [firstId, secondId] = swapped ? [bId, aId] : [aId, bId];

  const vm = useMemo((): CompareVM => {
    const a = scenarios.find((s) => s.id === firstId);
    const b0 = scenarios.find((s) => s.id === secondId);
    if (!a || !b0) return { status: 'notFound' };
    const b = b0.assumptions.display === a.assumptions.display ? b0 : { ...b0, assumptions: { ...b0.assumptions, display: a.assumptions.display } };
    const pa = planFor(inputs, a);
    const pb = planFor(inputs, b);
    const cmp = compareScenarios(pa, pb);
    const ages = new Map(pa.years.map((y) => [y.year, y.age]));
    const series = cmp.years.map((y) => ({ year: y.year, age: ages.get(y.year)!, a: y.a, b: y.b }));

    const k = copy.compare.kpi;
    const kpi = (key: 'netWorthAtRetirement' | 'netWorthAtEnd') => cmp.kpis.find((x) => x.key === key)!;
    // A − B: the engine's diff (B − A) negated. A gap under COMPARE_TIE (it shows as $0) has no tone.
    const dRet = 0 - (kpi('netWorthAtRetirement').diff ?? 0); // 0 − x: no −0
    const dEnd = 0 - (kpi('netWorthAtEnd').diff ?? 0);
    const tone = (d: number): PlanTone | null => (Math.abs(d) < COMPARE_TIE ? null : toneOf(d));
    const short = shortfallYearsDelta(pa.kpis.shortfallAge, pb.kpis.shortfallAge, a.assumptions.endAge);

    const s = cmp.sentence;
    const direction = s.leader === null ? 'same' : s.leader === 'a' ? 'higher' : 'lower';
    const diffLabel = money(s.amount);
    const sentence =
      direction === 'same'
        ? copy.compare.sentence.same(a.name, b.name, s.age)
        : copy.compare.sentence[direction](a.name, b.name, diffLabel, s.age);

    return {
      status: 'ready',
      a: { id: a.id, name: a.name },
      b: { id: b.id, name: b.name },
      series,
      diffTable: [
        { id: 'netWorthAtRetirement', label: k.netWorthAtRetirement, aLabel: money(pa.kpis.netWorthAtRetirement), bLabel: money(pb.kpis.netWorthAtRetirement), diffLabel: signedMoney(dRet), tone: tone(dRet) },
        { id: 'netWorthAtEnd', label: k.netWorthAtEnd, aLabel: money(pa.kpis.netWorthAtEnd), bLabel: money(pb.kpis.netWorthAtEnd), diffLabel: signedMoney(dEnd), tone: tone(dEnd) },
        {
          id: 'shortfall', label: k.shortfall,
          aLabel: shortfallLabel(pa.kpis.shortfallAge, a.assumptions.endAge), bLabel: shortfallLabel(pb.kpis.shortfallAge, b.assumptions.endAge),
          diffLabel: short.label, tone: short.years === 0 ? null : toneOf(short.years),
        },
      ],
      sentenceData: { aName: a.name, bName: b.name, age: s.age, direction, diffLabel },
      sentence,
      swap,
    };
  }, [inputs, scenarios, firstId, secondId, swap]);

  const ready = vm.status === 'ready';
  useEffect(() => {
    if (ready) track({ name: 'compare_viewed' }, { once: 'compare_viewed' });
  }, [ready]);

  return vm;
}
