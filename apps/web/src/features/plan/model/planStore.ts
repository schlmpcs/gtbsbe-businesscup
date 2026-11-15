// State behind the /plan hooks: the scenarios, the active one, the open event editor, the Monte Carlo
// run (status, settings, result) and the autosave indicator.
//
// - Scenarios live in this browser only (event names are personal, CLAUDE.md rule 6), in localStorage
//   through the same `safeStorage` as the profile and the accounts, under their own key. Every change
//   is written 300 ms after the last one (`saveState` shows "Saving…" until then).
// - A new user starts from `baselineScenario` of their profile (`initPlan`, once the profile and the
//   accounts are loaded); `loadSample` replaces the scenarios with scenario.demo.json and its Compare
//   pair scenario.alt.json. "Delete all my data" clears them (`clearPlan`).
// - The Chance of success run goes to a Web Worker (monteCarloJob.ts). Any change to the plan or the
//   settings cancels a run in progress and drops the result, which belonged to the plan before it.
// - `pinnedInputs` fixes the engine inputs (tests pin the demo fixtures, `resetPlanStore`); null = the
//   live profile and accounts (planInputs.ts).
import { baselineScenario, MAX_SCENARIOS } from '@lifeguessr/engine';
import { ScenarioSchema, type MonteCarloResult, type MonteCarloSettings, type PlanEvent, type Scenario } from '@lifeguessr/types';
import { create } from 'zustand';
import { scenarioAlt, scenarioDemo } from '@/fixtures';
import { registerDataClearer } from '@/lib/model/transactions';
import { readStorage, removeStorage, writeStorage } from '@/lib/safeStorage';
import { startMonteCarloJob, type CancelJob } from './monteCarloJob';
import { fixturePlanInputs, type PlanInputs } from './planFixtures';
import type { SaveState } from './types';

/** Autosave debounce from the issue: 300 ms after the last change. */
export const AUTOSAVE_MS = 300;
export const PLAN_STORE_KEY = 'lifeguessr.plan';
const STORAGE_VERSION = 1;

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
  /** The last finished run of the active scenario with the current settings; null otherwise. */
  chanceResult: MonteCarloResult | null;
  /** What the run in progress or shown was made from: a result counts only while both are current. */
  chanceRunOf: { inputs: PlanInputs; scenario: Scenario } | null;
  /** Fixed engine inputs (tests); null = the live profile and accounts. */
  pinnedInputs: PlanInputs | null;
  /** The scenarios are loaded (or seeded) in this page load. */
  ready: boolean;
};

export const DEFAULT_CHANCE_SETTINGS: MonteCarloSettings = {
  paths: 1000,
  seed: 42,
  inflation: { mean: 0.03, sd: 0.02 },
  growth: {},
  endThreshold: 0,
};

const clone = <T,>(v: T): T => structuredClone(v);

/** The sample: scenario.demo.json (Baseline) and scenario.alt.json (Baseline + a kid). */
const sampleScenarios = (): Scenario[] => [clone(scenarioDemo) as Scenario, clone(scenarioAlt) as Scenario];

/** The app's state before `initPlan`: no scenarios yet, live inputs. */
export function livePlanData(): PlanData {
  return {
    scenarios: [],
    activeId: '',
    openEventId: null,
    saveState: 'saved',
    chanceStatus: 'idle',
    chanceSettings: clone(DEFAULT_CHANCE_SETTINGS),
    fixedSeed: DEFAULT_CHANCE_SETTINGS.seed!,
    chanceResult: null,
    chanceRunOf: null,
    pinnedInputs: null,
    ready: false,
  };
}

/** For tests: the fixture scenarios (scenario.demo.json, scenario.alt.json) on the pinned demo inputs. */
export function initialPlanData(): PlanData {
  const scenarios = sampleScenarios();
  return { ...livePlanData(), scenarios, activeId: scenarios[0]!.id, pinnedInputs: fixturePlanInputs(), ready: true };
}

// ----- Storage -----------------------------------------------------------------------------------

/** Saved scenarios, each checked against the contract; broken entries and repeated ids are dropped. */
function loadSaved(): { scenarios: Scenario[]; activeId: string } | null {
  let saved: unknown;
  try {
    saved = JSON.parse(readStorage(PLAN_STORE_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object') return null;
  const { scenarios: list, activeId } = saved as { scenarios?: unknown; activeId?: unknown };
  if (!Array.isArray(list)) return null;
  const scenarios: Scenario[] = [];
  for (const item of list) {
    const parsed = ScenarioSchema.safeParse(item);
    if (parsed.success && scenarios.length < MAX_SCENARIOS && !scenarios.some((s) => s.id === parsed.data.id)) {
      scenarios.push(parsed.data as Scenario);
    }
  }
  if (scenarios.length === 0) return null;
  return { scenarios, activeId: typeof activeId === 'string' && scenarios.some((s) => s.id === activeId) ? activeId : scenarios[0]!.id };
}

function save({ scenarios, activeId }: Pick<PlanData, 'scenarios' | 'activeId'>): void {
  writeStorage(PLAN_STORE_KEY, JSON.stringify({ version: STORAGE_VERSION, scenarios, activeId }));
}

// ----- Store -------------------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cancelRun: CancelJob | null = null;

function cancelChanceJob(): void {
  cancelRun?.();
  cancelRun = null;
}

type PlanActions = {
  /** Replaces one scenario with `fn(scenario)` and starts the debounced autosave. A new Monte Carlo run is needed after it. */
  edit: (id: string, fn: (s: Scenario) => Scenario) => void;
  editEvent: (scenarioId: string, eventId: string, fn: (e: PlanEvent) => PlanEvent) => void;
  select: (id: string) => void;
  addScenario: (copy: Scenario) => void;
  removeScenario: (id: string) => void;
  setOpenEvent: (id: string | null) => void;
  /** A settings or status change cancels the run in progress and drops its result. */
  setChance: (patch: Partial<Pick<PlanData, 'chanceStatus' | 'chanceSettings' | 'fixedSeed'>>) => void;
  /** Runs Monte Carlo for `scenario` on `inputs` with the current settings (a new seed when none is fixed). */
  runChance: (inputs: PlanInputs, scenario: Scenario) => void;
  /** Replaces the scenarios with the sample (scenario.demo.json and scenario.alt.json). */
  loadSample: () => void;
};

export const usePlanStore = create<PlanData & PlanActions>()((set, get) => {
  /** 'saving' now; written to the browser and 'saved' 300 ms after the last change. */
  const touch = () => {
    set({ saveState: 'saving' });
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save(get());
      set({ saveState: 'saved' });
    }, AUTOSAVE_MS);
  };
  /** The shown result and a run in progress belong to the plan before the change. */
  const dropChance = () => {
    cancelChanceJob();
    if (get().chanceStatus !== 'idle' || get().chanceResult !== null) set({ chanceStatus: 'idle', chanceResult: null });
  };
  return {
    ...livePlanData(),
    edit: (id, fn) => {
      set((st) => ({ scenarios: st.scenarios.map((s) => (s.id === id ? fn(s) : s)) }));
      dropChance();
      touch();
    },
    editEvent: (scenarioId, eventId, fn) => {
      get().edit(scenarioId, (s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? fn(e) : e)) }));
    },
    select: (id) => {
      if (!get().scenarios.some((s) => s.id === id)) return;
      dropChance();
      set({ activeId: id, openEventId: null });
      touch();
    },
    addScenario: (copy) => {
      dropChance();
      set((st) => ({ scenarios: [...st.scenarios, copy], activeId: copy.id, openEventId: null }));
      touch();
    },
    removeScenario: (id) => {
      const { scenarios, activeId } = get();
      if (scenarios.length <= 1 || !scenarios.some((s) => s.id === id)) return;
      const rest = scenarios.filter((s) => s.id !== id);
      dropChance();
      set({ scenarios: rest, activeId: activeId === id ? rest[0]!.id : activeId, openEventId: null });
      touch();
    },
    setOpenEvent: (id) => set({ openEventId: id }),
    setChance: (patch) => {
      cancelChanceJob();
      set({ ...patch, chanceResult: null, ...(patch.chanceStatus === undefined ? { chanceStatus: 'idle' as const } : {}) });
    },
    runChance: (inputs, scenario) => {
      cancelChanceJob();
      set({ chanceStatus: 'running', chanceResult: null, chanceRunOf: { inputs, scenario } });
      const settings = get().chanceSettings;
      cancelRun = startMonteCarloJob({ kind: 'monteCarlo', inputs, scenario, settings }, (res) => {
        cancelRun = null;
        if (res.kind === 'monteCarlo') set({ chanceStatus: 'done', chanceResult: res.result });
        else set({ chanceStatus: 'idle', chanceResult: null });
      });
    },
    loadSample: () => {
      dropChance();
      const scenarios = sampleScenarios();
      set({ scenarios, activeId: scenarios[0]!.id, openEventId: null, ready: true });
      touch();
    },
  };
});

/**
 * Load the saved scenarios, or seed the Baseline of this profile when there are none. Once per page
 * load, with the live inputs (planInputs.ts runs it when the profile and the accounts are loaded).
 */
export function initPlan(inputs: PlanInputs): void {
  const st = usePlanStore.getState();
  if (st.ready || st.pinnedInputs) return;
  const saved = loadSaved();
  if (saved) {
    usePlanStore.setState({ ...saved, ready: true });
    return;
  }
  const baseline = baselineScenario(inputs.profile, inputs.area, inputs.profile.asOf!);
  usePlanStore.setState({ scenarios: [baseline], activeId: baseline.id, ready: true });
  save(usePlanStore.getState());
}

/** "Delete all my data": forget the scenarios in this browser; the next `initPlan` seeds a new Baseline. */
export function clearPlan(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  cancelChanceJob();
  removeStorage(PLAN_STORE_KEY);
  usePlanStore.setState(usePlanStore.getState().pinnedInputs ? initialPlanData() : livePlanData());
}

registerDataClearer(clearPlan);

/** Tests: back to `initialPlanData()` (the demo fixtures on the pinned demo inputs). */
export function resetPlanStore(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  cancelChanceJob();
  usePlanStore.setState(initialPlanData());
}
