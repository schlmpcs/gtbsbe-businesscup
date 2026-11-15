// The scenario tabs of /plan: pick, duplicate (the engine's duplicateScenario, MP6), rename, remove, and
// the sample. Kept in this browser (planStore.ts).
import { duplicateScenario, MAX_SCENARIOS } from '@lifeguessr/engine';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { usePlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import type { ScenariosVM } from './types';

export const DEFAULT_SCENARIO_ICON = 'home';

export function useScenarios(): ScenariosVM {
  usePlanInputs(); // loads the saved scenarios (or the Baseline) once the profile is in
  const scenarios = usePlanStore((s) => s.scenarios);
  const activeId = usePlanStore((s) => s.activeId);
  const select = usePlanStore((s) => s.select);
  const addScenario = usePlanStore((s) => s.addScenario);
  const removeScenario = usePlanStore((s) => s.removeScenario);
  const edit = usePlanStore((s) => s.edit);
  const loadSample = usePlanStore((s) => s.loadSample);

  const add = useCallback((): string => {
    const { scenarios: all, activeId: current } = usePlanStore.getState();
    const source = all.find((s) => s.id === current) ?? all[0];
    if (!source || all.length >= MAX_SCENARIOS) return current;
    // "Scenario 3", "Scenario 4", …: the first number no scenario has taken.
    const taken = new Set(all.map((s) => s.name));
    let n = all.length + 1;
    while (taken.has(copy.scenarios.defaultName(n))) n++;
    const copyOf = duplicateScenario(source, copy.scenarios.defaultName(n), all.map((s) => s.id));
    addScenario(copyOf);
    track({ name: 'scenario_added', props: { scenarios: all.length + 1 } });
    return copyOf.id;
  }, [addScenario]);

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (trimmed === '') return;
      edit(id, (s) => ({ ...s, name: trimmed }));
    },
    [edit],
  );

  return useMemo(
    () => ({
      items: scenarios.map((s) => ({ id: s.id, name: s.name, icon: s.icon ?? DEFAULT_SCENARIO_ICON, active: s.id === activeId })),
      activeId,
      canCompare: scenarios.length >= 2,
      canRemove: scenarios.length > 1,
      canAdd: scenarios.length > 0 && scenarios.length < MAX_SCENARIOS,
      select,
      add,
      rename,
      remove: removeScenario,
      loadSample,
    }),
    [scenarios, activeId, select, add, rename, removeScenario, loadSample],
  );
}
