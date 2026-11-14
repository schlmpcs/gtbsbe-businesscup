import { expect, it } from 'vitest';
import { cloneProfileDemo, areaDataSample } from '@lifeguessr/data/fixtures';
import {
  AVATAR_BOUNDS,
  AvatarPublicSchema,
  type Profile,
} from '@lifeguessr/types';
import {
  coarsenAvatar,
  netWorthOf,
  ageBandOf,
  checkAvatarBounds,
  avatarStatsOf,
} from './avatar';
import { simulate } from './simulate';
const area = areaDataSample[0]!;
const profile = () => {
  const p = cloneProfileDemo();
  p.zip = area.zip;
  return p;
};
it('uses the same net worth as the forecast and rounds after summing', () => {
  const p = profile();
  expect(netWorthOf(p)).toBe(simulate(p, 0).path[0]!.netWorth);
  p.debts = [];
  p.retirement.value = 0;
  for (const [cash, expected] of [
    [-12400, -12000],
    [-400, 0],
    [-500, -1000],
    [99499, 99000],
    [100000, 100000],
    [102500, 105000],
  ]) {
    p.cash.value = cash!;
    expect(coarsenAvatar(p, area, 'selfReported').payload.netWorth).toBe(
      expected,
    );
  }
});
it('uses known metro data, bounded facts and real age bands without exposing private fields', () => {
  const p = profile();
  p.household = { hasCar: true, kids: 3, householdAdults: 2 };
  const preview = coarsenAvatar(p, area, 'selfReported');
  expect(preview.payload.facts.kids).toBe(3);
  expect(
    AvatarPublicSchema.safeParse({
      ...preview.payload,
      avatarId: 'a'.repeat(22),
    }).success,
  ).toBe(true);
  expect(JSON.stringify(preview.payload)).not.toMatch(
    /zip|county|anon|takeHomePay|cash|retirement/,
  );
  expect(
    AvatarPublicSchema.safeParse({
      ...preview.payload,
      avatarId: 'a'.repeat(22),
      zip: p.zip,
    }).success,
  ).toBe(false);
  expect(coarsenAvatar(p, null, 'selfReported').outOfBounds).toContainEqual({
    field: 'metro',
    reason: 'tooLow',
  });
  delete p.zip;
  expect(coarsenAvatar(p, area, 'selfReported').payload.metro).toBe('');
  expect([24, 25, 29, 30, 35, 40, 45, 100].map(ageBandOf)).toEqual([
    'under25',
    '25-29',
    '25-29',
    '30-34',
    '35-39',
    '40-44',
    '45plus',
    '45plus',
  ]);
});
it('marks estimated inputs and treats absent household facts as explicit estimates', () => {
  const p = profile();
  const preview = coarsenAvatar(p, area, 'selfReported');
  expect(preview.estimatedFields).toContain('facts.kids');
  p.cash.isEstimate = true;
  expect(coarsenAvatar(p, area, 'selfReported').estimatedFields).toContain(
    'netWorth',
  );
  p.household = { hasCar: false, kids: 0, householdAdults: 1 };
  expect(coarsenAvatar(p, area, 'selfReported').estimatedFields).not.toContain(
    'facts.kids',
  );
  p.takeHomePay.value = 0;
  expect(coarsenAvatar(p, area, 'selfReported').payload.rentShare).toBeNull();
  p.takeHomePay.value = 1000;
  p.spending.rentUtilities.value = 123;
  expect(coarsenAvatar(p, area, 'selfReported').payload.rentShare).toBe(0.1);
});
it('checks raw bounds before rounding can hide a violation', () => {
  const base = {
    netWorth: 0,
    monthlyCost: 1000,
    debtTotal: 0,
    metro: area.metro,
  };
  for (const field of ['netWorth', 'monthlyCost', 'debtTotal'] as const) {
    const { min, max } = AVATAR_BOUNDS[field];
    expect(checkAvatarBounds({ ...base, [field]: min })).toEqual([]);
    expect(checkAvatarBounds({ ...base, [field]: max })).toEqual([]);
    expect(checkAvatarBounds({ ...base, [field]: min - 1 })).toContainEqual({
      field,
      reason: 'tooLow',
    });
    expect(checkAvatarBounds({ ...base, [field]: max + 1 })).toContainEqual({
      field,
      reason: 'tooHigh',
    });
  }
  const p = profile();
  p.debts = [];
  p.spending = Object.fromEntries(
    Object.keys(p.spending).map((key) => [
      key,
      { value: key === 'groceries' ? 299 : 0, isEstimate: false },
    ]),
  ) as Profile['spending'];
  const result = coarsenAvatar(p, area, 'selfReported');
  expect(result.payload.monthlyCost).toBe(300);
  expect(result.outOfBounds).toContainEqual({
    field: 'monthlyCost',
    reason: 'tooLow',
  });
  expect(checkAvatarBounds(base, 17)).toContainEqual({
    field: 'age',
    reason: 'tooLow',
  });
  expect(checkAvatarBounds(base, 101)).toContainEqual({
    field: 'age',
    reason: 'tooHigh',
  });
});
it('suppresses small-sample stats and rejects invalid counters', () => {
  expect(avatarStatsOf(19, 10, 20).winRate).toBeNull();
  expect(avatarStatsOf(20, 10, 20).winRate).toBe(0.5);
  expect(() => avatarStatsOf(1, 2, 20)).toThrow(RangeError);
  expect(() => avatarStatsOf(20, 10, 0)).toThrow(RangeError);
});
