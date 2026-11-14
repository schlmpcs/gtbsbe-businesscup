// The scenario tabs of /plan: pick, duplicate, rename, remove. Fixture-backed (planStore.ts) until MP7b
// moves the scenarios into the browser store.
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { usePlanStore } from './planStore';
import type { ScenariosVM } from './types';

export const DEFAULT_SCENARIO_ICON = 'home';

export function useScenarios(): ScenariosVM {
  const scenarios = usePlanStore((s) => s.scenarios);
  const activeId = usePlanStore((s) => s.activeId);
  const select = usePlanStore((s) => s.select);
  const addScenario = usePlanStore((s) => s.addScenario);
  const removeScenario = usePlanStore((s) => s.removeScenario);
  const edit = usePlanStore((s) => s.edit);

  const add = useCallback((): string => {
    const { scenarios: all, activeId: current } = usePlanStore.getState();
    const source = all.find((s) => s.id === current) ?? all[0]!;
    // "Scenario 3", "Scenario 4", …: the first number no scenario has taken.
    const taken = new Set(all.map((s) => s.name));
    let n = all.length + 1;
    while (taken.has(copy.scenarios.defaultName(n))) n++;
    const id = `scenario-${crypto.randomUUID()}`;
    addScenario({ ...structuredClone(source), id, name: copy.scenarios.defaultName(n) });
    return id;
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
      select,
      add,
      rename,
      remove: removeScenario,
    }),
    [scenarios, activeId, select, add, rename, removeScenario],
  );
}
