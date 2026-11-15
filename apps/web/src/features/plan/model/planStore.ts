// Local state behind the /plan hooks: the scenarios, the Next Moves applied to each, the active one, the
// open event editor, the Monte Carlo run (status, result, settings) and the autosave indicator.
//
// Saved in this browser (safeStorage, key PLAN_STORE_KEY, versioned): the scenarios, the active one, the
// applied moves, `touched` and the Chance settings. Not saved: the Monte Carlo result and run status (a
// reload starts idle, so the result is computed again), the open editor and the seed key. Like the other
// planner stores it uses `skipHydration` (server render = first client render = the demo pair);
// `usePlanReady` loads it after the first client render, and every action loads it first, so a change
// made before the load (a tool page, a test) is never lost to it. Each write reports back: `saveState` is
// 'saved' only once the write went through, 'error' when this browser refused it.
//
// Seed: until the person changes a scenario, the scenarios follow the profile (seedScenarios). The demo
// profile gets the demo pair (scenario.demo.json and scenario.alt.json, built for it); a profile of the
// person's own gets the Baseline of docs/ENGINEERING.md → MP6: Retire at the retirement age and Social
// Security at 67, both from the engine's defaultEvent. The store starts on the demo pair, so the screen
// has a plan on the first render.
import { scenarioAlt, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { defaultEvent } from '@lifeguessr/engine';
import {
  MonteCarloSettingsSchema, PlanAssumptionsSchema, PlanEventSchema,
  type MonteCarloResult, type MonteCarloSettings, type Move, type PlanEvent, type PlanEventContext, type Scenario,
} from '@lifeguessr/types';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { usePersistedReady } from '@/features/dashboard/model/persisted';
import { registerDataClearer } from '@/lib/model/transactions';
import { readStorage, removeStorage, tryWriteStorage } from '@/lib/safeStorage';
import type { SaveState } from './types';

export const PLAN_STORE_KEY = 'lifeguessr.plan';
/** Bump with a `migrate` step when the saved shape changes; other versions are ignored. */
export const PLAN_STORE_VERSION = 1;

/** Autosave debounce from the issue: 300 ms after the last change. */
export const AUTOSAVE_MS = 300;

export type ChanceRunStatus = 'idle' | 'running' | 'done' | 'error';

export type PlanData = {
  scenarios: Scenario[];
  /** Next Moves added to a scenario, by scenario id (profile patches the plan applies, in order). */
  movesApplied: Record<string, Move[]>;
  activeId: string;
  openEventId: string | null;
  saveState: SaveState;
  chanceStatus: ChanceRunStatus;
  /** The last finished run, for the scenario and settings it ran on (cleared by any change). */
  chanceResult: MonteCarloResult | null;
  /** Counts runs, so a run that finishes after a change is dropped. */
  chanceRun: number;
  chanceSettings: MonteCarloSettings;
  /** The seed an on-again fixed seed goes back to. */
  fixedSeed: number;
  /** Which seed the scenarios hold ('demo:<birth year>' or 'own:<birth year>'); null = the initial demo pair. */
  seedKey: string | null;
  /** The person changed a scenario: the seed no longer follows the profile. */
  touched: boolean;
};

export const DEFAULT_CHANCE_SETTINGS: MonteCarloSettings = {
  paths: 1000,
  seed: 42,
  inflation: { mean: 0.03, sd: 0.02 },
  growth: {},
  endThreshold: 0,
};

const clone = <T,>(v: T): T => structuredClone(v);

/** The demo pair's calendar: the demo person is 32 in this year (Retire at 67 in 2061). */
const DEMO_SEED_YEAR = 2026;

/**
 * The scenarios for a profile nobody has planned on yet. `demo`: the demo pair, its years moved by
 * the years since DEMO_SEED_YEAR (the demo person stays 32 "today"). Otherwise the Baseline: the demo
 * Baseline's assumptions (retire at 67, to 90, today's dollars) with Retire and Social Security from
 * defaultEvent on the person's profile.
 */
export function seedScenarios(demo: boolean, ctx: PlanEventContext): Scenario[] {
  if (demo) {
    const shift = Number(ctx.asOf.slice(0, 4)) - DEMO_SEED_YEAR;
    const moved = (s: Scenario): Scenario => ({
      ...clone(s),
      events: s.events.map((e) => ({ ...clone(e), year: e.year + shift, ...('endYear' in e && e.endYear !== undefined ? { endYear: e.endYear + shift } : {}) }) as PlanEvent),
    });
    return [moved(scenarioDemo as Scenario), moved(scenarioAlt as Scenario)];
  }
  const base = clone(scenarioDemo) as Scenario;
  const c: PlanEventContext = { ...ctx, assumptions: base.assumptions };
  return [{
    ...base,
    events: [
      { ...defaultEvent('retire', c), id: 'ev-retire' },
      { ...defaultEvent('socialSecurity', c), id: 'ev-social-security' },
    ],
  }];
}

export function initialPlanData(): PlanData {
  return {
    scenarios: [clone(scenarioDemo) as Scenario, clone(scenarioAlt) as Scenario],
    movesApplied: {},
    activeId: scenarioDemo.id,
    openEventId: null,
    saveState: 'saved',
    chanceStatus: 'idle',
    chanceResult: null,
    chanceRun: 0,
    chanceSettings: clone(DEFAULT_CHANCE_SETTINGS),
    fixedSeed: 42,
    seedKey: null,
    touched: false,
  };
}

/** What is saved in the browser. */
export type PersistedPlan = Pick<PlanData, 'scenarios' | 'activeId' | 'movesApplied' | 'touched' | 'chanceSettings' | 'fixedSeed'>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** A saved scenario, or null when it cannot be planned on. Events that fail the contract are dropped, not the scenario. */
function restoreScenario(v: unknown): Scenario | null {
  if (!isObject(v) || !isText(v.id) || !isText(v.name) || !Array.isArray(v.events)) return null;
  if (!PlanAssumptionsSchema.safeParse(v.assumptions).success) return null;
  const events = v.events.filter((e) => PlanEventSchema.safeParse(e).success) as PlanEvent[];
  return {
    id: v.id,
    name: v.name,
    ...(isText(v.icon) ? { icon: v.icon } : {}),
    assumptions: v.assumptions as Scenario['assumptions'],
    events,
  };
}

const isMove = (v: unknown): v is Move => isObject(v) && isText(v.id) && isText(v.kind) && isObject(v.patch);

/**
 * Saved data read back, or null when there is nothing usable (no valid scenario). Anything else that
 * does not check out falls back to its default: the active id to the first scenario, moves of unknown
 * scenarios are dropped, bad Chance settings go back to DEFAULT_CHANCE_SETTINGS.
 */
export function restorePlan(saved: unknown): PersistedPlan | null {
  if (!isObject(saved) || !Array.isArray(saved.scenarios)) return null;
  const scenarios: Scenario[] = [];
  for (const raw of saved.scenarios) {
    const s = restoreScenario(raw);
    if (s && !scenarios.some((x) => x.id === s.id)) scenarios.push(s);
  }
  if (scenarios.length === 0) return null;
  const ids = new Set(scenarios.map((s) => s.id));
  const movesApplied: Record<string, Move[]> = {};
  if (isObject(saved.movesApplied)) {
    for (const [id, moves] of Object.entries(saved.movesApplied)) {
      if (ids.has(id) && Array.isArray(moves)) movesApplied[id] = moves.filter(isMove);
    }
  }
  const settings = MonteCarloSettingsSchema.safeParse(saved.chanceSettings);
  const fixedSeed = saved.fixedSeed;
  return {
    scenarios,
    activeId: typeof saved.activeId === 'string' && ids.has(saved.activeId) ? saved.activeId : scenarios[0]!.id,
    movesApplied,
    touched: saved.touched === true,
    chanceSettings: settings.success ? (settings.data as MonteCarloSettings) : clone(DEFAULT_CHANCE_SETTINGS),
    fixedSeed: Number.isInteger(fixedSeed) && (fixedSeed as number) >= 0 && (fixedSeed as number) <= 0xffffffff ? (fixedSeed as number) : 42,
  };
}

const persistedOf = (s: PlanData): PersistedPlan => ({
  scenarios: s.scenarios, activeId: s.activeId, movesApplied: s.movesApplied, touched: s.touched, chanceSettings: s.chanceSettings, fixedSeed: s.fixedSeed,
});

/** Whether the last write reached the browser's storage. */
let lastWriteOk = true;

/** localStorage through the safe helpers; unreadable or unversioned data reads as nothing saved. */
const planStorage: PersistStorage<PersistedPlan> = {
  getItem: (name) => {
    const raw = readStorage(name);
    if (raw === null) return null;
    try {
      const value: unknown = JSON.parse(raw);
      return isObject(value) && typeof value.version === 'number' ? (value as unknown as StorageValue<PersistedPlan>) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    // Before the load, the state is the defaults: writing it would overwrite the saved plan.
    if (!usePlanStore.persist.hasHydrated()) return;
    let json: string;
    try {
      json = JSON.stringify(value);
    } catch {
      lastWriteOk = false;
      return;
    }
    lastWriteOk = tryWriteStorage(name, json);
  },
  removeItem: removeStorage,
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

type PlanActions = {
  /** Replaces one scenario with `fn(scenario)` and starts the debounced autosave. A new Monte Carlo run is needed after it. */
  edit: (id: string, fn: (s: Scenario) => Scenario) => void;
  editEvent: (scenarioId: string, eventId: string, fn: (e: PlanEvent) => PlanEvent) => void;
  select: (id: string) => void;
  /** Adds `copy` and makes it active; `fromId`'s applied moves come with it. */
  addScenario: (copy: Scenario, fromId?: string) => void;
  removeScenario: (id: string) => void;
  /** Adds a Next Move to a scenario's plan (once). */
  applyMove: (scenarioId: string, move: Move) => void;
  /** Takes a Next Move off a scenario's plan (no-op when it is not there). */
  removeMove: (scenarioId: string, moveId: string) => void;
  setOpenEvent: (id: string | null) => void;
  setChance: (patch: Partial<Pick<PlanData, 'chanceStatus' | 'chanceSettings' | 'fixedSeed' | 'chanceResult'>>) => void;
  /** Starts a run: 'running', a new run number (returned), no result. */
  startChanceRun: () => number;
  /** Ends run `run` with a result or an error; ignored when a change or another run came after it. */
  finishChanceRun: (run: number, result: MonteCarloResult | null) => void;
  /** Replaces the scenarios with a seed for the profile, unless the person changed them already. */
  seed: (key: string, scenarios: Scenario[]) => void;
};

/** What a change to the plan resets: the Monte Carlo result belongs to the plan before it. */
const STALE_CHANCE = { chanceStatus: 'idle', chanceResult: null } as const;

/** Loads the saved plan first if it is not loaded yet (synchronous on localStorage). */
function ensureHydrated(): void {
  if (!usePlanStore.persist.hasHydrated()) void usePlanStore.persist.rehydrate();
}

export const usePlanStore = create<PlanData & PlanActions>()(persist((set, get) => {
  /**
   * 'saving' now; 300 ms after the last change, 'saved' if the write of that change went through, or
   * 'error' if the browser refused it (private window, storage full or blocked). Every change is written
   * at once (the persist middleware), so a reload inside the 300 ms keeps it.
   */
  const touch = () => {
    set({ saveState: 'saving', touched: true });
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      set({ saveState: lastWriteOk ? 'saved' : 'error' });
    }, AUTOSAVE_MS);
  };
  const changed = () => {
    touch();
    set((st) => ({ ...STALE_CHANCE, chanceRun: st.chanceRun + 1 }));
  };
  return {
    ...initialPlanData(),
    edit: (id, fn) => {
      ensureHydrated();
      set((st) => ({ scenarios: st.scenarios.map((s) => (s.id === id ? fn(s) : s)) }));
      changed();
    },
    editEvent: (scenarioId, eventId, fn) => {
      get().edit(scenarioId, (s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? fn(e) : e)) }));
    },
    select: (id) => {
      ensureHydrated();
      if (get().scenarios.some((s) => s.id === id)) set((st) => ({ activeId: id, openEventId: null, ...STALE_CHANCE, chanceRun: st.chanceRun + 1 }));
    },
    addScenario: (copy, fromId) => {
      ensureHydrated();
      set((st) => ({
        scenarios: [...st.scenarios, copy],
        movesApplied: fromId && st.movesApplied[fromId] ? { ...st.movesApplied, [copy.id]: [...st.movesApplied[fromId]] } : st.movesApplied,
        activeId: copy.id,
        openEventId: null,
        ...STALE_CHANCE,
        chanceRun: st.chanceRun + 1,
      }));
      touch();
    },
    removeScenario: (id) => {
      ensureHydrated();
      const { scenarios, activeId, movesApplied } = get();
      if (scenarios.length <= 1) return;
      const rest = scenarios.filter((s) => s.id !== id);
      const { [id]: _dropped, ...moves } = movesApplied;
      set((st) => ({
        scenarios: rest, movesApplied: moves, activeId: activeId === id ? rest[0]!.id : activeId, openEventId: null, ...STALE_CHANCE, chanceRun: st.chanceRun + 1,
      }));
      touch();
    },
    applyMove: (scenarioId, move) => {
      ensureHydrated();
      const current = get().movesApplied[scenarioId] ?? [];
      if (current.some((m) => m.id === move.id)) return;
      set((st) => ({ movesApplied: { ...st.movesApplied, [scenarioId]: [...current, move] } }));
      changed();
    },
    removeMove: (scenarioId, moveId) => {
      ensureHydrated();
      const current = get().movesApplied[scenarioId] ?? [];
      if (!current.some((m) => m.id === moveId)) return;
      set((st) => ({ movesApplied: { ...st.movesApplied, [scenarioId]: current.filter((m) => m.id !== moveId) } }));
      changed();
    },
    setOpenEvent: (id) => set({ openEventId: id }),
    setChance: (patch) => {
      ensureHydrated();
      set(patch);
    },
    startChanceRun: () => {
      const run = get().chanceRun + 1;
      set({ chanceRun: run, chanceStatus: 'running', chanceResult: null });
      return run;
    },
    finishChanceRun: (run, result) => {
      if (get().chanceRun !== run || get().chanceStatus !== 'running') return;
      set(result ? { chanceStatus: 'done', chanceResult: result } : { chanceStatus: 'error', chanceResult: null });
    },
    seed: (key, scenarios) => {
      ensureHydrated();
      const st = get();
      if (st.touched || st.seedKey === key || scenarios.length === 0) return;
      const activeId = scenarios.some((s) => s.id === st.activeId) ? st.activeId : scenarios[0]!.id;
      set((s) => ({
        scenarios, movesApplied: {}, activeId, openEventId: null, seedKey: key, ...STALE_CHANCE, chanceRun: s.chanceRun + 1,
      }));
    },
  };
}, {
  name: PLAN_STORE_KEY,
  version: PLAN_STORE_VERSION,
  storage: planStorage,
  skipHydration: true,
  partialize: persistedOf,
  // No earlier versions exist: data of any other version (an older or newer build) is ignored.
  migrate: () => undefined as unknown as PersistedPlan,
  merge: (saved, current) => {
    const restored = restorePlan(saved);
    if (!restored) return current;
    // The seed key starts over, so a plan the person never changed follows the profile again (useScenarios
    // re-seeds it); a changed one (`touched`) stays as saved. A Chance result from before is stale.
    return {
      ...current, ...restored, openEventId: null, saveState: 'saved', seedKey: null, ...STALE_CHANCE, chanceRun: current.chanceRun + 1,
    };
  },
}));

/** True once the saved plan is loaded (always false on the server and on the first client render). Starts the load. */
export function usePlanReady(): boolean {
  return usePersistedReady(usePlanStore);
}

/** Forget the plan ("Delete all my data"): back to the initial demo pair, nothing saved. */
export function clearPlan(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  usePlanStore.setState(initialPlanData());
  usePlanStore.persist.clearStorage();
  lastWriteOk = true;
}
registerDataClearer(clearPlan);

/** Back to the initial demo pair with nothing saved, loaded (so changes are written); for tests. */
export function resetPlanStore(): void {
  clearPlan();
  void usePlanStore.persist.rehydrate();
}
