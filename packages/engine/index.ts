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
export { canAfford, AFFORD_CHECK_MONTHS, AFFORD_MAX_WAIT_MONTHS, type AffordOptions } from './afford';
export { monthEnd, type CurrentMonth } from './month';
export {
  sceneOf, carSprite, takeoutSprite, CAR_PRICE_BANDS, TAKEOUT_BUCKETS, CLUE_COST_CATEGORIES, LAYOUT_COST_CATEGORY,
  LAYOUTS, LAYOUT_BEDROOMS, KID_SPRITES, DECOR_SPRITE_IDS, DECOR_ROOMS, SPRITE_IDS,
  type DecorRoom, type SpriteId,
} from './scene';
export { loan, compareLoans, payoffOrder, amortizedPayment, MAX_SIMULATION_MONTHS } from './loan/index';
