// The Monte Carlo work /plan sends off the main thread: one monteCarlo() run (Chance of success, the AI
// line's p5–p95 band) or the moves' successRateDelta (planMoveEffects with the same seed). Pure apart
// from picking a seed when the person turned the fixed seed off: the engine has no randomness, so the
// seed is chosen here and passed in, and the result says which one was used.
import { monteCarlo, planMoveEffects, type MoveCandidate } from '@lifeguessr/engine';
import type { MonteCarloResult, MonteCarloSettings, PlanMoveEffect, Scenario } from '@lifeguessr/types';
import type { PlanInputs } from './planFixtures';

export type MonteCarloRequest =
  | { kind: 'monteCarlo'; inputs: PlanInputs; scenario: Scenario; settings: MonteCarloSettings }
  | { kind: 'moveEffects'; inputs: PlanInputs; scenario: Scenario; moves: MoveCandidate[]; settings: MonteCarloSettings };

export type MonteCarloResponse =
  | { kind: 'monteCarlo'; result: MonteCarloResult }
  | { kind: 'moveEffects'; effects: PlanMoveEffect[] }
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
    return {
      kind: 'moveEffects',
      effects: planMoveEffects(profile, accounts, req.scenario, req.moves, area, { monteCarlo: settings }),
    };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
