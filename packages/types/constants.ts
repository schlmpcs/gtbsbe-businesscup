// Value lists for the unions in ./index.ts (runtime iteration, zod enums). Each `satisfies` line
// fails to compile if a member is misspelled; schemas.test.ts checks that none is missing.
import type { AreaData, ClueId, CostCategory, Debt, KidAge, MoveKind } from './index';

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
