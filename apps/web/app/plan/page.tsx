'use client';

// P8 Plan (`/plan`), P9 Compare (`/plan?view=compare`) and P10 Chance of success (`/plan?view=chance`):
// thin route. The plan view-model hooks feed the presentational screen; the view lives in the URL.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useAiLine } from '@/features/plan/model/useAiLine';
import { useAssumptions } from '@/features/plan/model/useAssumptions';
import { useChanceOfSuccess } from '@/features/plan/model/useChanceOfSuccess';
import { useCompare } from '@/features/plan/model/useCompare';
import { useEventCatalog } from '@/features/plan/model/useEventCatalog';
import { useEventEditor } from '@/features/plan/model/useEventEditor';
import { usePlan } from '@/features/plan/model/usePlan';
import { usePlanMoves } from '@/features/plan/model/usePlanMoves';
import { useScenarios } from '@/features/plan/model/useScenarios';
import { PLAN_VIEWS, PlanScreen, type PlanViewId } from '@/features/plan/ui/PlanScreen';

type SearchParams = Promise<{ view?: string | string[] }>;

const viewOf = (v: string | string[] | undefined): PlanViewId =>
  PLAN_VIEWS.find((x) => x === (Array.isArray(v) ? v[0] : v)) ?? 'plan';

export default function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const view = viewOf(use(searchParams).view);
  const router = useRouter();
  const scenarios = useScenarios();
  const plan = usePlan(scenarios.activeId);
  const catalog = useEventCatalog();
  const editor = useEventEditor(catalog.openEventId);
  const assumptions = useAssumptions();
  const moves = usePlanMoves();
  const aiLine = useAiLine();
  const chance = useChanceOfSuccess();

  // Compare: the active scenario against the one picked (default: the first other scenario).
  const [picked, setPicked] = useState<string | null>(null);
  const others = scenarios.items.filter((s) => s.id !== scenarios.activeId);
  const compareWithId = others.find((s) => s.id === picked)?.id ?? others[0]?.id ?? null;
  const compare = useCompare(scenarios.activeId, compareWithId ?? '');

  const onViewChange = (next: PlanViewId) => router.replace(next === 'plan' ? '/plan' : `/plan?view=${next}`, { scroll: false });

  return (
    <PlanScreen
      view={view}
      onViewChange={onViewChange}
      plan={plan}
      scenarios={scenarios}
      catalog={catalog}
      editor={editor}
      assumptions={assumptions}
      moves={moves}
      aiLine={aiLine}
      compare={compare}
      compareWithId={compareWithId}
      onCompareWith={setPicked}
      chance={chance}
      Link={Link}
    />
  );
}
