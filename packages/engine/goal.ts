import {
  GoalSchema,
  type Goal,
  type GoalStatus,
  type Money,
  type Move,
  type MovesTowardGoal,
  type Profile,
  type SavingToReach,
} from '@lifeguessr/types';
import { applyPatch, forecast, type ForecastOptions } from './forecast';
/** Accuracy of the target solve, measured in today's dollars at the horizon. */
export const GOAL_SOLVE_TOLERANCE = 1;
/** A bounded bisection avoids an unending loop when floating-point values stop moving. */
const GOAL_SOLVE_STEPS = 80;
function atGoal(p: Profile, goal: Goal, opts: ForecastOptions) {
  return forecast(p, goal.years, { ...opts, todaysDollars: true }).points[
    goal.years * 12
  ]!;
}
/** Rules-based verdict in today's dollars. Zero-width bands cannot produce withinRange. */
export function goalStatus(
  p: Profile,
  goal: Goal,
  opts: ForecastOptions = {},
): GoalStatus {
  GoalSchema.parse(goal);
  const projected = atGoal(p, goal, opts);
  return {
    goal,
    projected,
    gap: goal.target - projected.mid,
    progress: projected.mid / goal.target,
    verdict:
      projected.low >= goal.target
        ? 'onTrack'
        : projected.high < goal.target
          ? 'behind'
          : 'withinRange',
  };
}
/** Solve a constant real monthly surplus, capped at take-home pay; ignores taxes. */
export function extraSavingToReach(
  p: Profile,
  goal: Goal,
  opts: ForecastOptions = {},
): SavingToReach {
  GoalSchema.parse(goal);
  if (!Number.isFinite(p.takeHomePay.value))
    throw new RangeError('Invalid takeHomePay');
  const cap = Math.max(0, p.takeHomePay.value);
  const projected = (extraMonthly: Money) =>
    atGoal(p, goal, { ...opts, extraMonthly }).mid;
  if (projected(0) >= goal.target) return { extraMonthly: 0, reachable: true };
  if (projected(cap) < goal.target)
    return { extraMonthly: cap, reachable: false };
  let low = 0,
    high = cap;
  for (let i = 0; i < GOAL_SOLVE_STEPS; i++) {
    const mid = (low + high) / 2,
      value = projected(mid);
    if (value >= goal.target) {
      high = mid;
      if (value - goal.target <= GOAL_SOLVE_TOLERANCE) break;
    } else low = mid;
  }
  return { extraMonthly: high, reachable: true };
}
/** Reforecast each move at the actual horizon; combine patches sequentially because effects interact. */
export function movesTowardGoal(
  p: Profile,
  goal: Goal,
  moves: Move[],
  opts: ForecastOptions = {},
): MovesTowardGoal {
  const status = goalStatus(p, goal, opts),
    base = status.projected.mid;
  const share = (effect: number) =>
    status.gap > 0 ? effect / status.gap : null;
  const perMove = moves.map((move) => {
    const effectAtGoal =
      atGoal(applyPatch(p, move.patch), goal, opts).mid - base;
    return { moveId: move.id, effectAtGoal, shareOfGap: share(effectAtGoal) };
  });
  const combined =
    atGoal(
      moves.reduce((profile, move) => applyPatch(profile, move.patch), p),
      goal,
      opts,
    ).mid - base;
  return {
    perMove,
    combined: {
      effect: combined,
      shareOfGap: share(combined),
      closesGap: status.gap > 0 && combined >= status.gap,
    },
  };
}
