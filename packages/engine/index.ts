// @lifeguessr/engine: pure, deterministic money math (no I/O, no Date.now, no AI).
// Every number a user sees comes from here. Signatures: docs/ARCHITECTURE.md → Engine API.
// Implement inside the module files; this barrel should not need to change.
export * from './assumptions';
export * from './errors';
export { costOfLife, cardToProfile } from './cost';
export { scoreGuess } from './score';
export { forecast, applyPatch, type ForecastOptions } from './forecast';
export {
  simulate, forecastMonths, resolveRates, monthlyRate, inflationAnnualOf, cardMinPaymentFor,
  usesCardFormula, hasEstimates, SYNTHETIC_CARD_ID,
  type Simulation, type SimulationMonth, type SimulateOptions, type ForecastRates,
  type ScheduledPurchase, type Scenario,
} from './simulate';
export {
  rankMoves, movesLevel, isLevelUnlocked, moveKindOf, MOVE_LEVELS, MOVES_SHOWN, DISCRETIONARY_CATEGORIES,
  type RankMovesOptions,
} from './moves';
export { canAfford } from './afford';
export { monthEnd, type CurrentMonth } from './month';
export { sceneOf, CAR_PRICE_BANDS, TAKEOUT_BUCKETS, SPRITE_IDS } from './scene';
export { loan, compareLoans, payoffOrder, amortizedPayment, MAX_SIMULATION_MONTHS } from './loan/index';
