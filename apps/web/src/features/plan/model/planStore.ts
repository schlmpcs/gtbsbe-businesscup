// Local state behind the /plan hooks while they run on fixtures (MP7a): the scenarios (seeded from
// scenario.demo.json and scenario.alt.json), the active one, the open event editor, the Monte Carlo
// status and settings, and the autosave indicator. MP7b replaces the seed with the browser store
// (lib/model/profile.ts) and keeps this shape, so the hooks' return types do not change.
import { scenarioAlt, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import type { MonteCarloSettings, PlanEvent, Scenario } from '@lifeguessr/types';
import { create } from 'zustand';
import type { SaveState } from './types';

/** Autosave debounce from the issue: 300 ms after the last change. */
export const AUTOSAVE_MS = 300;

export type ChanceRunStatus = 'idle' | 'running' | 'done';

export type PlanData = {
  scenarios: Scenario[];
  activeId: string;
  openEventId: string | null;
  saveState: SaveState;
  chanceStatus: ChanceRunStatus;
  chanceSettings: MonteCarloSettings;
  /** The seed an on-again fixed seed goes back to. */
  fixedSeed: number;
};

export const DEFAULT_CHANCE_SETTINGS: MonteCarloSettings = {
  paths: 1000,
  seed: 42,
  inflation: { mean: 0.03, sd: 0.02 },
  growth: {},
  endThreshold: 0,
};

const clone = <T,>(v: T): T => structuredClone(v);

export function initialPlanData(): PlanData {
  return {
    scenarios: [clone(scenarioDemo) as Scenario, clone(scenarioAlt) as Scenario],
    activeId: scenarioDemo.id,
    openEventId: null,
    saveState: 'saved',
    chanceStatus: 'idle',
    chanceSettings: clone(DEFAULT_CHANCE_SETTINGS),
    fixedSeed: 42,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

type PlanActions = {
  /** Replaces one scenario with `fn(scenario)` and starts the debounced autosave. A new Monte Carlo run is needed after it. */
  edit: (id: string, fn: (s: Scenario) => Scenario) => void;
  editEvent: (scenarioId: string, eventId: string, fn: (e: PlanEvent) => PlanEvent) => void;
  select: (id: string) => void;
  addScenario: (copy: Scenario) => void;
  removeScenario: (id: string) => void;
  setOpenEvent: (id: string | null) => void;
  setChance: (patch: Partial<Pick<PlanData, 'chanceStatus' | 'chanceSettings' | 'fixedSeed'>>) => void;
};

export const usePlanStore = create<PlanData & PlanActions>()((set, get) => {
  /** 'saving' now, 'saved' 300 ms after the last change. */
  const touch = () => {
    set({ saveState: 'saving' });
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      set({ saveState: 'saved' });
    }, AUTOSAVE_MS);
  };
  const changed = () => {
    touch();
    // The saved result belongs to the plan before the change.
    if (get().chanceStatus !== 'idle') set({ chanceStatus: 'idle' });
  };
  return {
    ...initialPlanData(),
    edit: (id, fn) => {
      set((st) => ({ scenarios: st.scenarios.map((s) => (s.id === id ? fn(s) : s)) }));
      changed();
    },
    editEvent: (scenarioId, eventId, fn) => {
      get().edit(scenarioId, (s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? fn(e) : e)) }));
    },
    select: (id) => {
      if (get().scenarios.some((s) => s.id === id)) set({ activeId: id, openEventId: null, chanceStatus: 'idle' });
    },
    addScenario: (copy) => {
      set((st) => ({ scenarios: [...st.scenarios, copy], activeId: copy.id, openEventId: null, chanceStatus: 'idle' }));
      touch();
    },
    removeScenario: (id) => {
      const { scenarios, activeId } = get();
      if (scenarios.length <= 1) return;
      const rest = scenarios.filter((s) => s.id !== id);
      set({ scenarios: rest, activeId: activeId === id ? rest[0]!.id : activeId, openEventId: null, chanceStatus: 'idle' });
      touch();
    },
    setOpenEvent: (id) => set({ openEventId: id }),
    setChance: (patch) => set(patch),
  };
});

/** Back to the fixture seed; for tests. */
export function resetPlanStore(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  usePlanStore.setState(initialPlanData());
}
