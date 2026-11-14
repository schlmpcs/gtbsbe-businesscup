import {
  AVATAR_BOUNDS,
  AVATAR_ROUND_BALANCE,
  AVATAR_ROUND_MONTHLY,
  AVATAR_RENT_SHARE_STEP,
  type AgeBand,
  type AvatarPayload,
  type AvatarPreview,
  type AvatarStamp,
  type AreaData,
  type Profile,
} from '@lifeguessr/types';
import { simulate } from './simulate';

/** Shared balance-sheet definition: cash + retirement + the home (owners) minus debts, matching month zero. */
export function netWorthOf(p: Profile): number {
  return (
    p.cash.value +
    p.retirement.value +
    (p.home?.value.value ?? 0) -
    p.debts.reduce((sum, d) => sum + d.balance, 0)
  );
}
/** Five-year age bands with open-ended outer bands. */
export function ageBandOf(age: number): AgeBand {
  if (!Number.isFinite(age)) throw new RangeError('Invalid age');
  return age < 25
    ? 'under25'
    : age < 30
      ? '25-29'
      : age < 35
        ? '30-34'
        : age < 40
          ? '35-39'
          : age < 45
            ? '40-44'
            : '45plus';
}
function round(value: number, step: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Invalid avatar amount');
  const rounded = Math.sign(value) * Math.round(Math.abs(value) / step) * step;
  return Object.is(rounded, -0) ? 0 : rounded;
}
function balance(value: number): number {
  return round(
    value,
    Math.abs(value) < AVATAR_ROUND_BALANCE.threshold
      ? AVATAR_ROUND_BALANCE.below
      : AVATAR_ROUND_BALANCE.above,
  );
}
/** Refuse out-of-bounds values; never clamp them into a publishable range. */
export function checkAvatarBounds(
  p: Pick<AvatarPayload, 'netWorth' | 'monthlyCost' | 'debtTotal' | 'metro'>,
  age?: number,
): AvatarPreview['outOfBounds'] {
  const issues: AvatarPreview['outOfBounds'] = [];
  for (const field of ['netWorth', 'monthlyCost', 'debtTotal'] as const) {
    const value = p[field],
      bound = AVATAR_BOUNDS[field];
    if (!Number.isFinite(value) || value < bound.min)
      issues.push({ field, reason: 'tooLow' });
    else if (value > bound.max) issues.push({ field, reason: 'tooHigh' });
  }
  if (!p.metro) issues.push({ field: 'metro', reason: 'tooLow' });
  if (
    age !== undefined &&
    (!Number.isFinite(age) ||
      age < AVATAR_BOUNDS.age.min ||
      age > AVATAR_BOUNDS.age.max)
  )
    issues.push({
      field: 'age',
      reason: age > AVATAR_BOUNDS.age.max ? 'tooHigh' : 'tooLow',
    });
  return issues;
}
/** One exact preview/pool payload. Bounds apply before rounding, so invalid values cannot round into acceptance. */
export function coarsenAvatar(
  p: Profile,
  area: AreaData | null,
  stamp: AvatarStamp,
): AvatarPreview {
  const flows = simulate(p, 1).path[1]!;
  const raw = {
    netWorth: netWorthOf(p),
    monthlyCost: flows.spending + flows.requiredDebtPayments,
    debtTotal: p.debts.reduce((sum, d) => sum + d.balance, 0),
    metro: area && p.zip === area.zip ? area.metro : '',
  };
  const rent = p.spending.rentUtilities;
  const estimated = new Set<AvatarPreview['estimatedFields'][number]>();
  if (p.age.isEstimate) estimated.add('ageBand');
  if (p.cash.isEstimate || p.retirement.isEstimate || p.home?.value.isEstimate) estimated.add('netWorth');
  if (
    Object.entries(p.spending).some(
      ([key, v]) => key !== 'debtPayments' && v.isEstimate,
    ) ||
    p.debts.some((d) => d.minPayment.isEstimate)
  )
    estimated.add('monthlyCost');
  if (rent.isEstimate || p.takeHomePay.isEstimate) estimated.add('rentShare');
  if (!p.household)
    for (const field of [
      'facts.hasCar',
      'facts.kids',
      'facts.householdAdults',
    ] as const)
      estimated.add(field);
  const payload: AvatarPayload = {
    kind: 'avatar',
    stamp,
    ageBand: ageBandOf(p.age.value),
    metro: raw.metro,
    netWorth: balance(raw.netWorth),
    monthlyCost: round(raw.monthlyCost, AVATAR_ROUND_MONTHLY),
    debtTotal: balance(raw.debtTotal),
    rentShare:
      rent.value > 0 && p.takeHomePay.value > 0
        ? round(rent.value / p.takeHomePay.value, AVATAR_RENT_SHARE_STEP)
        : null,
    facts: p.household
      ? { ...p.household, kids: Math.min(3, p.household.kids) as 0 | 1 | 2 | 3 }
      : { hasCar: false, kids: 0, householdAdults: 1 },
  };
  return {
    payload,
    estimatedFields: [...estimated],
    outOfBounds: checkAvatarBounds(raw, p.age.value),
  };
}
/** Aggregated picks only; small samples never expose a win rate. */
export function avatarStatsOf(
  shown: number,
  picked: number,
  minPicks: number,
): { shown: number; picked: number; winRate: number | null } {
  if (
    ![shown, picked, minPicks].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) ||
    picked > shown ||
    minPicks < 1
  )
    throw new RangeError('Invalid avatar counters');
  return { shown, picked, winRate: shown >= minPicks ? picked / shown : null };
}
