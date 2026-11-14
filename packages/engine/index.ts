// @lifeguessr/engine: pure, deterministic money math (no I/O, no Date.now, no model calls).
// Every number a user sees is computed here, or, for the AI forecast, checked here against the rules
// forecast (anchors.ts): the engine stays pure and never produces the AI numbers itself.
// Signatures: docs/ARCHITECTURE.md → Engine API.
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
  anchorIssues, anchorsToForecast, deflateForecast, forecastSanityIssues, scenarioEffectIssues,
} from './anchors';
export { forecastFacts, rulesBundle, type ForecastFacts } from './bundle';
export {
  rankMoves, moveCandidates, rankCandidates, movesLevel, isLevelUnlocked, moveKindOf, MOVE_LEVELS, MOVES_SHOWN,
  DISCRETIONARY_CATEGORIES, type MoveCandidate, type RankMovesOptions,
} from './moves';
export { canAfford, AFFORD_CHECK_MONTHS, AFFORD_MAX_WAIT_MONTHS, type AffordOptions } from './afford';
export { monthEnd, type CurrentMonth } from './month';
export { sceneOf, CAR_PRICE_BANDS, TAKEOUT_BUCKETS, SPRITE_IDS } from './scene';
export { loan, compareLoans, payoffOrder, amortizedPayment, MAX_SIMULATION_MONTHS } from './loan/index';
