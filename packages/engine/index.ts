// @lifeguessr/engine: pure, deterministic money math (no I/O, no Date.now, no model calls).
// Every number a user sees is computed here, or, for the AI forecast, checked here against the rules
// forecast (anchors.ts): the engine stays pure and never produces the AI numbers itself.
// Signatures: docs/ARCHITECTURE.md → Engine API.
// Implement inside the module files; this barrel should not need to change.
export * from './assumptions';
export * from './errors';
export { costOfLife, cardToProfile } from './cost';
export { scoreGuess } from './score';
export {
  dailyDuelPairs, scoreDuelPick, duelCategoryLines, duelMultiplier, duelRoundPoints, duelDifference, duelGap, duelBlindSpot,
  DUEL_ROUND_COUNT, type DuelCandidate, type DuelPair, type DuelPickScore, type DuelLessonId,
} from './duel';
export { forecast, applyPatch, type ForecastOptions } from './forecast';
export {
  simulate, forecastMonths, resolveRates, monthlyRate, inflationAnnualOf, cardMinPaymentFor,
  usesCardFormula, hasEstimates, SYNTHETIC_CARD_ID,
  type Simulation, type SimulationMonth, type SimulateOptions, type ForecastRates,
  type ScheduledPurchase, type Scenario,
} from './simulate';
export {
  anchorIssues, anchorsToForecast, deflateForecast, forecastSanityIssues, pointAt, scenarioEffectIssues,
} from './anchors';
export { forecastFacts, rulesBundle, type ForecastFacts, type ForecastFactsEvent } from './bundle';
export { eventStartMonth, addMonths, withoutEvents } from './events';
export {
  rankMoves, moveCandidates, rankCandidates, movesLevel, isLevelUnlocked, moveKindOf, MOVE_LEVELS, MOVES_SHOWN,
  DISCRETIONARY_CATEGORIES, type MoveCandidate, type RankMovesOptions,
} from './moves';
export { canAfford, AFFORD_CHECK_MONTHS, AFFORD_MAX_WAIT_MONTHS, type AffordOptions } from './afford';
export { monthEnd, type CurrentMonth } from './month';
export { statementTotals, merchantKey, type ClassifiedStatementItem } from './statement';
export { detectSubscriptions, auditTotals, type DetectSubscriptionsOptions } from './subscriptions';
export {
  sceneOf, carSprite, takeoutSprite, CAR_PRICE_BANDS, TAKEOUT_BUCKETS, CLUE_COST_CATEGORIES, LAYOUT_COST_CATEGORY,
  LAYOUTS, LAYOUT_BEDROOMS, KID_SPRITES, DECOR_SPRITE_IDS, DECOR_ROOMS, SPRITE_IDS,
  type DecorRoom, type SpriteId,
} from './scene';
export {
  loan, compareLoans, payoffOrder, payoffPlan, comparePayoff, extraToFinishBy, amortize, amortizedPayment, MAX_SIMULATION_MONTHS,
  type Amortization, type LoanOptions,
} from './loan/index';
export { goalStatus, extraSavingToReach, movesTowardGoal, GOAL_SOLVE_TOLERANCE } from './goal';
export { overpayingCheck, type OverpayingInput } from './overpaying';
export { netWorthOf, ageBandOf, coarsenAvatar, checkAvatarBounds, avatarStatsOf } from './avatar';
