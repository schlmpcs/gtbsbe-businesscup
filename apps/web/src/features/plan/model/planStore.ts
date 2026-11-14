// Local state behind the /plan hooks: the scenarios, the Next Moves applied to each, the active one, the
// open event editor, the Monte Carlo run (status, result, settings) and the autosave indicator.
//
// Seed: until the person changes a scenario, the scenarios follow the profile (seedScenarios). The demo
// profile gets the demo pair (scenario.demo.json and scenario.alt.json, built for it); a profile of the
// person's own gets the Baseline of docs/ENGINEERING.md → MP6: Retire at the retirement age and Social
// Security at 67, both from the engine's defaultEvent. The store starts on the demo pair, so the screen
// has a plan on the first render.
import { scenarioAlt, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { defaultEvent } from '@lifeguessr/engine';
import type { MonteCarloResult, MonteCarloSettings, Move, PlanEvent, PlanEventContext, Scenario } from '@lifeguessr/types';
import { create } from 'zustand';
import type { SaveState } from './types';

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

export const usePlanStore = create<PlanData & PlanActions>()((set, get) => {
  /** 'saving' now, 'saved' 300 ms after the last change. */
  const touch = () => {
    set({ saveState: 'saving', touched: true });
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      set({ saveState: 'saved' });
    }, AUTOSAVE_MS);
  };
  const changed = () => {
    touch();
    set((st) => ({ ...STALE_CHANCE, chanceRun: st.chanceRun + 1 }));
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
      if (get().scenarios.some((s) => s.id === id)) set((st) => ({ activeId: id, openEventId: null, ...STALE_CHANCE, chanceRun: st.chanceRun + 1 }));
    },
    addScenario: (copy, fromId) => {
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
      const current = get().movesApplied[scenarioId] ?? [];
      if (current.some((m) => m.id === move.id)) return;
      set((st) => ({ movesApplied: { ...st.movesApplied, [scenarioId]: [...current, move] } }));
      changed();
    },
    setOpenEvent: (id) => set({ openEventId: id }),
    setChance: (patch) => set(patch),
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
      const st = get();
      if (st.touched || st.seedKey === key || scenarios.length === 0) return;
      const activeId = scenarios.some((s) => s.id === st.activeId) ? st.activeId : scenarios[0]!.id;
      set((s) => ({
        scenarios, movesApplied: {}, activeId, openEventId: null, seedKey: key, ...STALE_CHANCE, chanceRun: s.chanceRun + 1,
      }));
    },
  };
});

/** Back to the initial demo pair; for tests. */
export function resetPlanStore(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  usePlanStore.setState(initialPlanData());
}
