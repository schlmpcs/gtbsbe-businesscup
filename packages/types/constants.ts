// Value lists for the unions in ./index.ts (runtime iteration, zod enums). Each `satisfies` line
// fails to compile if a member is misspelled; schemas.test.ts checks that none is missing.
import type {
  AreaData, ClueId, CostCategory, Debt, KidAge, MoveKind, ProErrorCode, ProPlan, ProSource, SessionErrorCode,
} from './index';

export const COST_CATEGORIES = [
  'rentUtilities', 'car', 'childcare', 'groceries',
  'eatingOut', 'subscriptions', 'debtPayments', 'other',
] as const satisfies readonly CostCategory[];
export const KID_AGES = ['infant', 'toddler', 'preschool', 'schoolAge'] as const satisfies readonly KidAge[];
export const CLUE_IDS = ['garage', 'kidsRoom', 'kitchen', 'entry', 'mailbox'] as const satisfies readonly ClueId[];
export const AREA_TIERS = ['cheap', 'mid', 'expensive', 'suburb'] as const satisfies readonly AreaData['tier'][];
export const DEBT_KINDS = ['card', 'auto', 'student', 'personal', 'bnpl', 'mortgage'] as const satisfies readonly Debt['kind'][];
export const MOVE_KINDS = [
  'payCardFirst', 'cutCategory', 'cancelSubscriptions',
  'retirementMatch', 'hsa', 'refinance', 'negotiateRent', 'reshopInsurance',
] as const satisfies readonly MoveKind[];

// ----- Pro (S15, the paywall demo) -----------------------------------------------------------

export const PRO_PLANS = ['yearly', 'monthly'] as const satisfies readonly ProPlan[];
export const PRO_SOURCES = ['stripe_test', 'demo'] as const satisfies readonly ProSource[];
export const PRO_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable', 'upstream_error',
  'not_paid', 'session_mismatch', 'invalid_code',
] as const satisfies readonly ProErrorCode[];

/**
 * What Pro costs: US dollars per billing interval. A pricing assumption (docs/PRODUCT.md →
 * Business model), so the UI labels it as such. The Stripe Checkout amount and every price the
 * UI shows come from here, so they cannot drift apart.
 */
export const PRO_PRICES = {
  yearly: { amount: 39.99, interval: 'year' },
  monthly: { amount: 6.99, interval: 'month' },
} as const satisfies Record<ProPlan, { amount: number; interval: 'year' | 'month' }>;

// ----- Sessions (T4) -------------------------------------------------------------------------

export const SESSION_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable', 'not_paid',
] as const satisfies readonly SessionErrorCode[];
/** Most purchases one saved wishlist may hold. */
export const SESSION_WISHLIST_MAX = 50;
