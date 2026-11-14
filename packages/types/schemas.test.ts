import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  type AREA_TIERS, type CATEGORIZED_BY, type CLUE_IDS, COST_CATEGORIES, type DEBT_KINDS, type KID_AGES,
  MAX_STATEMENT_ITEMS, type MOVE_KINDS, type PRO_ERROR_CODES, type PRO_PLANS, PRO_PRICES, type PRO_SOURCES,
  type SESSION_ERROR_CODES, SESSION_WISHLIST_MAX, STATEMENT_CLASSES,
  AnonIdSchema, SessionRequestSchema, SessionResponseSchema, type SessionStateSchema,
  StatementCategorizeRequestSchema, StatementCategorizeResponseSchema,
  type StatementCategorizeRequest, type StatementCategorizeResponse, type StatementClass,
  type AreaDataSchema, type CategoryTotalsSchema, type LifeCardSchema, LoanInputSchema, ProfilePatchSchema,
  ProConfirmRequestSchema, ProDemoUnlockRequestSchema, ProErrorResponseSchema, type ProStatusSchema,
  ProStatusResponseSchema, ProfileSchema, PurchaseSchema, StatementItemSchema,
  type AreaData, type CategoryTotals, type ClueId, type CostCategory, type Debt, type KidAge,
  type LifeCard, type LoanInput, type MoveKind, type ProErrorCode, type ProPlan, type ProSource,
  type ProStatus, type Profile, type ProfilePatch, type Purchase, type StatementItem,
  type SessionErrorCode, type SessionState,
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
    expectTypeOf<z.infer<typeof StatementCategorizeRequestSchema>>().toExtend<StatementCategorizeRequest>();
    expectTypeOf<StatementCategorizeRequest>().toExtend<z.input<typeof StatementCategorizeRequestSchema>>();
    expectTypeOf<z.infer<typeof StatementCategorizeResponseSchema>>().toExtend<StatementCategorizeResponse>();
    expectTypeOf<z.infer<typeof SessionStateSchema>>().toExtend<SessionState>();
    expectTypeOf<SessionState>().toExtend<z.input<typeof SessionStateSchema>>();
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
    expectTypeOf<StatementClass>().toEqualTypeOf<(typeof STATEMENT_CLASSES)[number]>();
    expectTypeOf<StatementCategorizeResponse['categorizedBy']>().toEqualTypeOf<(typeof CATEGORIZED_BY)[number]>();
    expectTypeOf<SessionErrorCode>().toEqualTypeOf<(typeof SESSION_ERROR_CODES)[number]>();
    expect(new Set(COST_CATEGORIES).size).toBe(COST_CATEGORIES.length);
    expect(new Set(STATEMENT_CLASSES).size).toBe(STATEMENT_CLASSES.length);
  });
});

describe('statement contracts', () => {
  const item = { label: 'KROGER #', amount: 42.5, month: '2026-02', day: 28 };

  it('accepts masked lines and rejects days the month does not have', () => {
    expect(StatementCategorizeRequestSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(StatementCategorizeRequestSchema.safeParse({ items: [{ ...item, day: 29 }] }).success).toBe(false);
    expect(StatementCategorizeRequestSchema.safeParse({ items: [{ ...item, month: '2024-02', day: 29 }] }).success).toBe(true);
    expect(StatementCategorizeRequestSchema.safeParse({ items: [{ ...item, month: '2026-13' }] }).success).toBe(false);
    expect(StatementCategorizeRequestSchema.safeParse({ items: [{ ...item, label: '' }] }).success).toBe(false);
    expect(StatementCategorizeRequestSchema.safeParse({ items: [{ ...item, amount: Number.NaN }] }).success).toBe(false);
  });

  it('caps the number of lines and needs at least one', () => {
    expect(StatementCategorizeRequestSchema.safeParse({ items: [] }).success).toBe(false);
    const many = Array.from({ length: MAX_STATEMENT_ITEMS + 1 }, () => item);
    expect(StatementCategorizeRequestSchema.safeParse({ items: many }).success).toBe(false);
  });

  it('shapes the reply', () => {
    const totals = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0]));
    const month = { month: '2026-02', totals, oneOffs: [], detectedPay: 4_800 };
    expect(StatementCategorizeResponseSchema.safeParse({ ok: true, months: [month], categorizedBy: 'rules' }).success).toBe(true);
    expect(StatementCategorizeResponseSchema.safeParse({ ok: true, months: [month], categorizedBy: 'llm' }).success).toBe(false);
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

describe('Session contracts', () => {
  const anonId = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
  const purchase: Purchase = { label: 'Laptop', amount: 1_400, recurring: false, payWith: 'card' };

  it('accepts a crypto.randomUUID() id, lower-cased, and nothing else', () => {
    expect(AnonIdSchema.parse(anonId.toUpperCase())).toBe(anonId);
    for (const bad of ['', 'anon-00000001', `${anonId}x`, '0f8e2b4c1d2e4f5a9b8c7d6e5f4a3b2c', 'javascript:alert(1)']) {
      expect(AnonIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('takes { anonId } alone (a load) and refuses unknown fields', () => {
    expect(SessionRequestSchema.safeParse({ anonId }).success).toBe(true);
    expect(SessionRequestSchema.safeParse({ anonId, statementMonths: [] }).success).toBe(false);
    expect(SessionRequestSchema.safeParse({ profile: undefined }).success).toBe(false);
  });

  it(`caps the wishlist at ${SESSION_WISHLIST_MAX} purchases`, () => {
    const wishlist = (n: number) => Array.from({ length: n }, () => purchase);
    expect(SessionRequestSchema.safeParse({ anonId, wishlist: wishlist(SESSION_WISHLIST_MAX) }).success).toBe(true);
    expect(SessionRequestSchema.safeParse({ anonId, wishlist: wishlist(SESSION_WISHLIST_MAX + 1) }).success).toBe(false);
  });

  it('describes a reply with or without a saved profile', () => {
    expect(SessionResponseSchema.safeParse({ ok: true, wishlist: [], revision: 0, updatedAt: null }).success).toBe(true);
    expect(SessionResponseSchema.safeParse({
      ok: true, wishlist: [purchase], revision: 3, updatedAt: '2026-11-14T10:00:00.000Z',
    }).success).toBe(true);
    expect(SessionResponseSchema.safeParse({ ok: true, wishlist: [], revision: -1, updatedAt: null }).success).toBe(false);
  });
});
