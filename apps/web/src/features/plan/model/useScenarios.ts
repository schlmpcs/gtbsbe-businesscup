// The scenario tabs of /plan: pick, duplicate, rename, remove. Until the person changes a scenario, the
// scenarios follow the profile (planStore.ts → seedScenarios): the demo pair on the demo profile, the
// engine's Baseline on the person's own. Nothing is seeded or listed before the saved plan is loaded
// (usePlanReady), so a saved plan is never replaced by a seed and the demo tabs never flash.
import type { Profile } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { useAppStore } from '@/state/store';
import { calendarOf, eventContext, usePlanInputs } from './planEngine';
import { seedScenarios, usePlanReady, usePlanStore } from './planStore';
import type { ScenariosVM } from './types';

export const DEFAULT_SCENARIO_ICON = 'home';

/** Which seed a profile's scenarios hold: the demo pair or the person's own, for this year and birth year. */
export function seedKeyOf(demo: boolean, profile: Profile, endAge: number): string {
  const cal = calendarOf(profile, endAge);
  return `${demo ? 'demo' : 'own'}:${cal.firstYear}:${cal.birthYear}`;
}

export function useScenarios(): ScenariosVM {
  const ready = usePlanReady();
  const scenarios = usePlanStore((s) => s.scenarios);
  const activeId = usePlanStore((s) => s.activeId);
  const select = usePlanStore((s) => s.select);
  const addScenario = usePlanStore((s) => s.addScenario);
  const removeScenario = usePlanStore((s) => s.removeScenario);
  const edit = usePlanStore((s) => s.edit);
  const seed = usePlanStore((s) => s.seed);
  const inputs = usePlanInputs();
  const demo = useAppStore((s) => s.profileOrigin === 'demo');

  useEffect(() => {
    if (!ready) return;
    const first = usePlanStore.getState().scenarios[0];
    if (!first) return;
    const key = seedKeyOf(demo, inputs.profile, first.assumptions.endAge);
    if (usePlanStore.getState().seedKey === key) return;
    seed(key, seedScenarios(demo, eventContext(inputs, first)));
  }, [ready, inputs, demo, seed]);

  const add = useCallback((): string => {
    const { scenarios: all, activeId: current } = usePlanStore.getState();
    const source = all.find((s) => s.id === current) ?? all[0]!;
    // "Scenario 3", "Scenario 4", …: the first number no scenario has taken.
    const taken = new Set(all.map((s) => s.name));
    let n = all.length + 1;
    while (taken.has(copy.scenarios.defaultName(n))) n++;
    const id = `scenario-${crypto.randomUUID()}`;
    addScenario({ ...structuredClone(source), id, name: copy.scenarios.defaultName(n) }, source.id);
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
      items: ready ? scenarios.map((s) => ({ id: s.id, name: s.name, icon: s.icon ?? DEFAULT_SCENARIO_ICON, active: s.id === activeId })) : [],
      activeId,
      canCompare: ready && scenarios.length >= 2,
      canRemove: ready && scenarios.length > 1,
      select,
      add,
      rename,
      remove: removeScenario,
    }),
    [ready, scenarios, activeId, select, add, rename, removeScenario],
  );
}
