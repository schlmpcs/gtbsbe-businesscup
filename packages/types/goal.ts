import { z } from 'zod';
import type { ForecastPoint, Money } from './index';
import { GOAL_MIN_YEARS, GOAL_MAX_YEARS } from './constants';
export const GoalSchema = z.object({
  target: z.number().finite().positive(),
  years: z.number().int().min(GOAL_MIN_YEARS).max(GOAL_MAX_YEARS),
});
export type Goal = z.infer<typeof GoalSchema>;
export type GoalVerdict = 'onTrack' | 'withinRange' | 'behind';
export type GoalStatus = {
  goal: Goal;
  projected: ForecastPoint;
  gap: Money;
  progress: number;
  verdict: GoalVerdict;
};
export type SavingToReach = { extraMonthly: Money; reachable: boolean };
export type MovesTowardGoal = {
  perMove: { moveId: string; effectAtGoal: Money; shareOfGap: number | null }[];
  combined: { effect: Money; shareOfGap: number | null; closesGap: boolean };
};
