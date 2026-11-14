import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  type AREA_TIERS, type CLUE_IDS, COST_CATEGORIES, type DEBT_KINDS, type KID_AGES, type MOVE_KINDS,
  type PRO_ERROR_CODES, type PRO_PLANS, PRO_PRICES, type PRO_SOURCES,
  type AreaDataSchema, type CategoryTotalsSchema, ForecastBundleSchema, ForecastPointSchema, ForecastSchema,
  type LifeCardSchema, LoanInputSchema, ProfilePatchSchema,
  ProConfirmRequestSchema, ProDemoUnlockRequestSchema, ProErrorResponseSchema, type ProStatusSchema,
  ProStatusResponseSchema, ProfileSchema, PurchaseSchema, StatementItemSchema, YearAnchorSchema,
  type AreaData, type CategoryTotals, type ClueId, type CostCategory, type Debt, type Forecast,
  type ForecastBundle, type ForecastPoint, type ForecastSource, type KidAge, type LifeCard, type LoanInput,
  type MoveKind, type ProErrorCode, type ProPlan, type ProSource,
  type ProStatus, type Profile, type ProfilePatch, type Purchase, type StatementItem, type YearAnchor,
} from './index';

// These assertions are checked by `pnpm typecheck` (tsc covers test files): a contract change
// that is not mirrored in its schema, or the reverse, fails to compile.
describe('schemas match the contracts', () => {
  it('parsed output is assignable to the contract, and the contract is accepted as input', () => {
    expectTypeOf<z.infer<typeof AreaDataSchema>>().toExtend<AreaData>();
    expectTypeOf<AreaData>().toExtend<z.input<typeof AreaDataSchema>>();
    expectTypeOf<z.infer<typeof LifeCardSchema>>().toExtend<LifeCard>();
    expectTypeOf<LifeCard>().toExtend<z.input<typeof LifeCardSchema>>();
    expectTypeOf<z.infer<typeof ProfileSchema>>().toExtend<Profile>();
    expectTypeOf<Profile>().toExtend<z.input<typeof ProfileSchema>>();
    expectTypeOf<z.infer<typeof ProfilePatchSchema>>().toExtend<ProfilePatch>();
    expectTypeOf<ProfilePatch>().toExtend<z.input<typeof ProfilePatchSchema>>();
    expectTypeOf<z.infer<typeof LoanInputSchema>>().toExtend<LoanInput>();
    expectTypeOf<LoanInput>().toExtend<z.input<typeof LoanInputSchema>>();
    expectTypeOf<z.infer<typeof PurchaseSchema>>().toExtend<Purchase>();
    expectTypeOf<Purchase>().toExtend<z.input<typeof PurchaseSchema>>();
    expectTypeOf<z.infer<typeof StatementItemSchema>>().toExtend<StatementItem>();
    expectTypeOf<StatementItem>().toExtend<z.input<typeof StatementItemSchema>>();
    expectTypeOf<z.infer<typeof CategoryTotalsSchema>>().toExtend<CategoryTotals>();
    expectTypeOf<CategoryTotals>().toExtend<z.input<typeof CategoryTotalsSchema>>();
    expectTypeOf<z.infer<typeof ProStatusSchema>>().toExtend<ProStatus>();
    expectTypeOf<ProStatus>().toExtend<z.input<typeof ProStatusSchema>>();
    expectTypeOf<z.infer<typeof ForecastPointSchema>>().toExtend<ForecastPoint>();
    expectTypeOf<ForecastPoint>().toExtend<z.input<typeof ForecastPointSchema>>();
    expectTypeOf<z.infer<typeof ForecastSchema>>().toExtend<Forecast>();
    expectTypeOf<Forecast>().toExtend<z.input<typeof ForecastSchema>>();
    expectTypeOf<z.infer<typeof YearAnchorSchema>>().toExtend<YearAnchor>();
    expectTypeOf<YearAnchor>().toExtend<z.input<typeof YearAnchorSchema>>();
    expectTypeOf<z.infer<typeof ForecastBundleSchema>>().toExtend<ForecastBundle>();
    expectTypeOf<ForecastBundle>().toExtend<z.input<typeof ForecastBundleSchema>>();
  });

  it('value lists cover every union member', () => {
    expectTypeOf<CostCategory>().toEqualTypeOf<(typeof COST_CATEGORIES)[number]>();
    expectTypeOf<KidAge>().toEqualTypeOf<(typeof KID_AGES)[number]>();
    expectTypeOf<ClueId>().toEqualTypeOf<(typeof CLUE_IDS)[number]>();
    expectTypeOf<AreaData['tier']>().toEqualTypeOf<(typeof AREA_TIERS)[number]>();
    expectTypeOf<Debt['kind']>().toEqualTypeOf<(typeof DEBT_KINDS)[number]>();
    expectTypeOf<MoveKind>().toEqualTypeOf<(typeof MOVE_KINDS)[number]>();
    expectTypeOf<ProPlan>().toEqualTypeOf<(typeof PRO_PLANS)[number]>();
    expectTypeOf<ProSource>().toEqualTypeOf<(typeof PRO_SOURCES)[number]>();
    expectTypeOf<ProErrorCode>().toEqualTypeOf<(typeof PRO_ERROR_CODES)[number]>();
    expect(new Set(COST_CATEGORIES).size).toBe(COST_CATEGORIES.length);
    expectTypeOf<ForecastBundle['source']>().toEqualTypeOf<ForecastSource>();
    expectTypeOf<z.infer<typeof ForecastBundleSchema>['source']>().toEqualTypeOf<ForecastSource>();
  });
});

describe('Pro contracts', () => {
  it('prices every plan once, in dollars', () => {
    expect(PRO_PRICES.yearly).toEqual({ amount: 39.99, interval: 'year' });
    expect(PRO_PRICES.monthly).toEqual({ amount: 6.99, interval: 'month' });
  });

  it('accepts only test-mode Checkout Session ids', () => {
    expect(ProConfirmRequestSchema.safeParse({ sessionId: 'cs_test_a1B2c3D4e5F6g7H8' }).success).toBe(true);
    expect(ProConfirmRequestSchema.safeParse({ sessionId: 'cs_live_a1B2c3D4e5F6g7H8' }).success).toBe(false);
    expect(ProConfirmRequestSchema.safeParse({ sessionId: 'cs_test_' }).success).toBe(false);
    expect(ProConfirmRequestSchema.safeParse({ sessionId: '../etc/passwd' }).success).toBe(false);
  });

  it('trims the promo code and rejects an empty one', () => {
    expect(ProDemoUnlockRequestSchema.parse({ code: '  JURY-DEMO ' })).toEqual({ code: 'JURY-DEMO' });
    expect(ProDemoUnlockRequestSchema.safeParse({ code: '   ' }).success).toBe(false);
  });

  it('shapes the status and error replies', () => {
    const since = '2026-11-14T12:00:00.000Z';
    const demo = { enabled: true, code: 'JURY-DEMO' };
    expect(ProStatusResponseSchema.safeParse({
      ok: true, status: { pro: true, source: 'demo', since }, checkoutAvailable: false, demo,
    }).success).toBe(true);
    expect(ProStatusResponseSchema.safeParse({
      ok: true, status: { pro: true, source: 'demo' }, checkoutAvailable: false, demo,
    }).success).toBe(false);                                  // `since` is required for Pro
    expect(ProErrorResponseSchema.safeParse({
      ok: false, error: { code: 'rate_limited', retryAfterSeconds: 12 },
    }).success).toBe(true);
    expect(ProErrorResponseSchema.safeParse({ ok: false, error: { code: 'nope' } }).success).toBe(false);
  });
});

describe('schemas reject the mistakes they exist for', () => {
  it('rejects an APR given as a percent', () => {
    expect(LoanInputSchema.safeParse({ amount: 28_000, apr: 6.9, termMonths: 36 }).success).toBe(false);
    expect(LoanInputSchema.safeParse({ amount: 28_000, apr: 0.069, termMonths: 36 }).success).toBe(true);
  });

  it('rejects a down payment larger than the amount', () => {
    expect(LoanInputSchema.safeParse({ amount: 1_000, apr: 0.1, termMonths: 12, downPayment: 2_000 }).success).toBe(false);
  });

  it('accepts a partial spending patch but requires every category in Profile.spending', () => {
    expect(ProfilePatchSchema.safeParse({ spending: { eatingOut: 200 } }).success).toBe(true);
    const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, { value: 0, isEstimate: true }]));
    const { eatingOut: _dropped, ...missingOne } = spending;
    const base = {
      age: { value: 30, isEstimate: false }, takeHomePay: { value: 4_000, isEstimate: false },
      cash: { value: 0, isEstimate: true }, retirement: { value: 0, isEstimate: true },
      retirementShare: { value: 0, isEstimate: true }, debts: [], doneMoveIds: [],
    };
    expect(ProfileSchema.safeParse({ ...base, spending }).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...base, spending: missingOne }).success).toBe(false);
  });

  it('validates statement item month and day', () => {
    expect(StatementItemSchema.safeParse({ label: 'KROGER', amount: 54.1, month: '2026-10', day: 3 }).success).toBe(true);
    expect(StatementItemSchema.safeParse({ label: 'KROGER', amount: 54.1, month: '2026-13', day: 3 }).success).toBe(false);
    expect(StatementItemSchema.safeParse({ label: 'KROGER', amount: 54.1, month: '2026-10', day: 32 }).success).toBe(false);
  });

  it('accepts purchases paid with cash, card or a loan', () => {
    expect(PurchaseSchema.safeParse({ label: 'Laptop', amount: 1_400, recurring: false, payWith: 'card' }).success).toBe(true);
    expect(PurchaseSchema.safeParse({
      label: 'Car', amount: 28_000, recurring: false,
      payWith: { loan: { amount: 28_000, apr: 0.069, termMonths: 36 } },
    }).success).toBe(true);
    expect(PurchaseSchema.safeParse({ label: 'Gym', amount: 30, recurring: 'weekly', payWith: 'cash' }).success).toBe(false);
  });
});

describe('forecast schemas', () => {
  const point = (month: number, mid = 1_000 + month): ForecastPoint => ({ month, mid, low: mid - 100, high: mid + 100 });
  const forecast = (n = 121): Forecast => {
    const points = Array.from({ length: n }, (_, month) => point(month));
    return { points, in10y: points[120] ?? point(120), todaysDollars: false };
  };
  // The engine's `rulesBundle` result is parsed in packages/engine/bundle.test.ts (the engine depends
  // on this package, not the other way round); this is the same shape built by hand.
  const bundle = (): ForecastBundle => ({ source: 'rules', base: forecast(), scenarios: { a: forecast(), b: forecast() } });

  it('ForecastBundleSchema accepts a rules bundle (no model) and an AI bundle (with a model)', () => {
    expect(ForecastBundleSchema.safeParse(bundle()).success).toBe(true);
    expect(ForecastBundleSchema.safeParse({ ...bundle(), source: 'ai', model: 'claude-test' }).success).toBe(true);
    expect(ForecastBundleSchema.safeParse({ ...bundle(), scenarios: {} }).success).toBe(true);
  });

  it('rejects a point with NaN or Infinity', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const b = bundle();
      b.base.points[50] = { ...b.base.points[50]!, mid: bad };
      expect(ForecastBundleSchema.safeParse(b).success).toBe(false);
      const inScenario = bundle();
      inScenario.scenarios.a!.points[7] = { ...inScenario.scenarios.a!.points[7]!, high: bad };
      expect(ForecastBundleSchema.safeParse(inScenario).success).toBe(false);
      expect(ForecastPointSchema.safeParse({ month: 3, mid: 1, low: bad, high: 2 }).success).toBe(false);
    }
  });

  it('requires the point month to be a non-negative integer', () => {
    for (const month of [-1, 1.5, Number.NaN]) {
      expect(ForecastPointSchema.safeParse({ month, mid: 1, low: 0, high: 2 }).success).toBe(false);
      const b = bundle();
      b.base.points[10] = { ...b.base.points[10]!, month };
      expect(ForecastBundleSchema.safeParse(b).success).toBe(false);
    }
    expect(ForecastPointSchema.safeParse({ month: 0, mid: 1, low: 0, high: 2 }).success).toBe(true);
    expect(ForecastPointSchema.safeParse({ month: 120, mid: 1, low: 0, high: 2 }).success).toBe(true);
  });

  it('rejects a bundle whose source is not ai or rules', () => {
    expect(ForecastBundleSchema.safeParse({ ...bundle(), source: 'x' }).success).toBe(false);
    expect(ForecastBundleSchema.safeParse({ ...bundle(), source: undefined }).success).toBe(false);
  });

  it('rejects a forecast with fewer than 121 points, and accepts a longer horizon', () => {
    expect(ForecastSchema.safeParse(forecast(120)).success).toBe(false);
    expect(ForecastSchema.safeParse(forecast(121)).success).toBe(true);
    expect(ForecastSchema.safeParse(forecast(241)).success).toBe(true);
    const short = bundle();
    short.scenarios.b = forecast(60);
    expect(ForecastBundleSchema.safeParse(short).success).toBe(false);
  });

  it('rejects a forecast missing in10y or todaysDollars', () => {
    const { in10y: _in10y, ...noIn10y } = forecast();
    const { todaysDollars: _flag, ...noFlag } = forecast();
    expect(ForecastSchema.safeParse(noIn10y).success).toBe(false);
    expect(ForecastSchema.safeParse(noFlag).success).toBe(false);
  });

  it('YearAnchorSchema takes a structurally valid anchor and rejects NaN, strings and a fractional year', () => {
    expect(YearAnchorSchema.safeParse({ year: 3, low: -10, mid: 0, high: 10 }).success).toBe(true);
    expect(YearAnchorSchema.safeParse({ year: 3, low: Number.NaN, mid: 0, high: 10 }).success).toBe(false);
    expect(YearAnchorSchema.safeParse({ year: 3, low: '1', mid: 0, high: 10 }).success).toBe(false);
    expect(YearAnchorSchema.safeParse({ year: 2.5, low: 0, mid: 0, high: 10 }).success).toBe(false);
  });
});
