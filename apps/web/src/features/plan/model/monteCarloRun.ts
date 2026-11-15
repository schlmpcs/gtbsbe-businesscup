// The Monte Carlo work /plan sends off the main thread: one monteCarlo() run (Chance of success, the AI
// line's p5–p95 band) or the moves' successRateDelta (planMoveEffects with the same seed). Pure apart
// from picking a seed when the person turned the fixed seed off: the engine has no randomness, so the
// seed is chosen here and passed in, and the result says which one was used.
import { decisionSweep, monteCarlo, planMoveEffects, type MoveCandidate } from '@lifeguessr/engine';
import type { DecisionSweepPoint, MonteCarloResult, MonteCarloSettings, PlanMoveEffect, Scenario } from '@lifeguessr/types';
import type { PlanInputs } from './planFixtures';

export type MonteCarloRequest =
  | { kind: 'monteCarlo'; inputs: PlanInputs; scenario: Scenario; settings: MonteCarloSettings }
  | { kind: 'moveEffects'; inputs: PlanInputs; scenario: Scenario; moves: MoveCandidate[]; settings: MonteCarloSettings }
  /** The home Life line: the Chance of success with one event at each of `years` (decisionSweep, same seed). */
  | { kind: 'decisionSweep'; inputs: PlanInputs; scenario: Scenario; eventId: string; years: number[]; settings: MonteCarloSettings };

export type MonteCarloResponse =
  | { kind: 'monteCarlo'; result: MonteCarloResult }
  | { kind: 'moveEffects'; effects: PlanMoveEffect[] }
  /** Each year's Chance of success; the plans stay on the main thread (it draws them before this answers). */
  | { kind: 'decisionSweep'; points: { year: number; chance: NonNullable<DecisionSweepPoint['chance']> }[] }
  | { kind: 'error'; message: string };

/** A seed for a run without a fixed one: any 32-bit unsigned integer (monteCarlo()'s range). */
export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32);

/** The settings with a seed: the fixed one, else a new random one. */
export const seeded = (settings: MonteCarloSettings): MonteCarloSettings & { seed: number } =>
  ({ ...settings, seed: settings.seed ?? randomSeed() });

/** Runs one request. Engine errors (an invalid setting) come back as `{ kind: 'error' }`, never thrown. */
export function runMonteCarloRequest(req: MonteCarloRequest): MonteCarloResponse {
  try {
    const { profile, accounts, area } = req.inputs;
    const settings = seeded(req.settings);
    if (req.kind === 'monteCarlo') {
      return { kind: 'monteCarlo', result: monteCarlo(profile, accounts, req.scenario, settings, area) };
    }
    if (req.kind === 'decisionSweep') {
      const points = decisionSweep(profile, accounts, req.scenario, req.eventId, req.years, area, settings);
      return { kind: 'decisionSweep', points: points.map((p) => ({ year: p.year, chance: p.chance! })) };
    }
    return {
      kind: 'moveEffects',
      effects: planMoveEffects(profile, accounts, req.scenario, req.moves, area, { monteCarlo: settings }),
    };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
