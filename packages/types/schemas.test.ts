import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  type AREA_TIERS, type CATEGORIZED_BY, type CLUE_IDS, COST_CATEGORIES, type DEBT_KINDS, type KID_AGES,
  MAX_STATEMENT_ITEMS, type MOVE_KINDS, type PRO_ERROR_CODES, type PRO_PLANS, PRO_PRICES, type PRO_SOURCES,
  type SESSION_ERROR_CODES, SESSION_WISHLIST_MAX, STATEMENT_CLASSES,
  AnonIdSchema, SessionRequestSchema, SessionResponseSchema, type SessionStateSchema,
  StatementCategorizeRequestSchema, StatementCategorizeResponseSchema,
  type StatementCategorizeRequest, type StatementCategorizeResponse, type StatementClass,
  type AreaDataSchema, CategoryTotalsSchema, type LifeCardSchema, LoanInputSchema, ProfilePatchSchema,
  ProConfirmRequestSchema, ProDemoCheckoutRequestSchema, ProDemoUnlockRequestSchema, ProErrorResponseSchema, ProStatusSchema,
  ProStatusResponseSchema, ProfileSchema, PurchaseSchema, StatementItemSchema,
  type AreaData, type CategoryTotals, type ClueId, type CostCategory, type Debt, type KidAge,
  type LifeCard, type LoanInput, type MoveKind, type ProErrorCode, type ProPlan, type ProSource,
  type ProStatus, type Profile, type ProfilePatch, type Purchase, type StatementItem,
  type SessionErrorCode, type SessionState,
  CLIENT_EVENT_NAMES, ClientEventEnvelopeSchema, EVENTS_BATCH_MAX, type EVENTS_ERROR_CODES, EventsRequestSchema,
  FUNNEL_EVENT_NAMES, FUNNEL_STEPS, type FunnelReportSchema, type SERVER_EVENT_NAMES,
  type ClientEventEnvelope, type ClientFunnelEvent, type EventsErrorCode, type EventsRequest, type FunnelReport,
  type ServerFunnelEvent,
  ForecastBundleSchema, ForecastPointSchema, ForecastSchema, YearAnchorSchema,
  type Forecast, type ForecastBundle, type ForecastPoint, type ForecastSource, type YearAnchor,
  FORECAST_HORIZONS, HorizonYearsSchema, type ExplainRequest, type HorizonYears, type Money,
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
    expectTypeOf<ForecastBundle['source']>().toEqualTypeOf<ForecastSource>();
    expectTypeOf<z.infer<typeof ForecastBundleSchema>['source']>().toEqualTypeOf<ForecastSource>();
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

  it('takes only a plan for the simulated checkout, never card-like fields', () => {
    expect(ProDemoCheckoutRequestSchema.parse({ plan: 'monthly' })).toEqual({ plan: 'monthly' });
    for (const bad of [{}, { plan: 'weekly' }, { plan: 'yearly', card: '4242 4242 4242 4242' }]) {
      expect(ProDemoCheckoutRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('knows the simulated checkout as a Pro source that carries a plan', () => {
    const since = '2026-11-14T12:00:00.000Z';
    const status = { pro: true, source: 'demo_checkout', plan: 'yearly', since } as const;
    expect(ProStatusSchema.parse(status)).toEqual(status);
  });

  it('records simulated purchases as their own event, outside the funnel steps', () => {
    expect(FUNNEL_EVENT_NAMES).toContain('pro_demo_purchased');
    expect(FUNNEL_STEPS).not.toContain('pro_demo_purchased');
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

  it('checks a month’s lastDay against the length of that month', () => {
    const m = { month: '2026-11', totals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])), oneOffs: [] };
    expect(CategoryTotalsSchema.safeParse(m).success).toBe(true); // optional: older saved data has none
    expect(CategoryTotalsSchema.safeParse({ ...m, lastDay: 30 }).success).toBe(true);
    expect(CategoryTotalsSchema.safeParse({ ...m, lastDay: 31 }).success).toBe(false); // November has 30 days
    expect(CategoryTotalsSchema.safeParse({ ...m, month: '2028-02', lastDay: 29 }).success).toBe(true); // leap year
    expect(CategoryTotalsSchema.safeParse({ ...m, month: '2026-02', lastDay: 29 }).success).toBe(false);
    expect(CategoryTotalsSchema.safeParse({ ...m, lastDay: 0 }).success).toBe(false);
    expect(CategoryTotalsSchema.safeParse({ ...m, lastDay: 2.5 }).success).toBe(false);
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

describe('Funnel event contracts', () => {
  const anonId = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
  const id = '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10';

  it('match the contract types, and the name lists cover every member', () => {
    expectTypeOf<z.infer<typeof ClientEventEnvelopeSchema>>().toExtend<ClientEventEnvelope>();
    expectTypeOf<ClientEventEnvelope>().toExtend<z.input<typeof ClientEventEnvelopeSchema>>();
    expectTypeOf<z.infer<typeof EventsRequestSchema>>().toExtend<EventsRequest>();
    expectTypeOf<EventsRequest>().toExtend<z.input<typeof EventsRequestSchema>>();
    expectTypeOf<z.infer<typeof FunnelReportSchema>>().toExtend<FunnelReport>();
    expectTypeOf<FunnelReport>().toExtend<z.input<typeof FunnelReportSchema>>();
    expectTypeOf<ClientFunnelEvent['name']>().toEqualTypeOf<(typeof CLIENT_EVENT_NAMES)[number]>();
    expectTypeOf<ServerFunnelEvent['name']>().toEqualTypeOf<(typeof SERVER_EVENT_NAMES)[number]>();
    expectTypeOf<EventsErrorCode>().toEqualTypeOf<(typeof EVENTS_ERROR_CODES)[number]>();
    expect(new Set(FUNNEL_EVENT_NAMES).size).toBe(FUNNEL_EVENT_NAMES.length);
    // Every client name has a schema (the discriminated union refuses any other name).
    for (const name of CLIENT_EVENT_NAMES) {
      expect(ClientEventEnvelopeSchema.options.some((o) => o.shape.name.value === name)).toBe(true);
    }
    // The funnel is made of known events; the Postgres funnel query gives each name one bit of an int.
    for (const step of FUNNEL_STEPS) expect(FUNNEL_EVENT_NAMES).toContain(step);
    expect(FUNNEL_EVENT_NAMES.length).toBeLessThanOrEqual(31);
  });

  it('accepts the events the app sends', () => {
    const events: ClientEventEnvelope[] = [
      { id, name: 'play_started' },
      { id, name: 'clue_opened', props: { home: 1, clue: 'kitchen' } },
      { id, name: 'home_guessed', props: { home: 3, cluesOpened: 0 } },
      { id, name: 'game_finished', props: { homes: 5 } },
      { id, name: 'result_shared', props: { via: 'copy' } },
      { id, name: 'closest_life_chosen', props: { fromToday: true } },
      { id, name: 'statement_applied', props: { months: 5 } },
      { id, name: 'move_committed', props: { kind: 'payCardFirst' } },
      { id, name: 'afford_checked', props: { verdict: 'wait' } },
      { id, name: 'loan_compared', props: { offers: 3 } },
      { id, name: 'paywall_viewed' },
      { id, name: 'forecast_horizon_changed', props: { years: 3 } },
    ];
    expect(EventsRequestSchema.safeParse({ anonId, events }).success).toBe(true);
  });

  it.each([
    ['an unknown name', { id, name: 'page_view' }],
    ['a server-only event', { id, name: 'pro_purchased', props: { plan: 'yearly' } }],
    ['free text in props', { id, name: 'clue_opened', props: { home: 1, clue: 'kitchen', note: 'Jane Doe, 12 Elm St' } }],
    ['props on an event without them', { id, name: 'play_started', props: { email: 'a@b.co' } }],
    ['a field beside the event', { id, name: 'forecast_viewed', label: 'Zelle to Jane' }],
    ['a value outside its enum', { id, name: 'result_shared', props: { via: 'email' } }],
    ['a home out of range', { id, name: 'home_guessed', props: { home: 0, cluesOpened: 1 } }],
    ['a fractional count', { id, name: 'home_guessed', props: { home: 1, cluesOpened: 1.5 } }],
    ['an amount where a count goes', { id, name: 'loan_compared', props: { offers: 28_000 } }],
    ['an id that is not a UUID', { id: 'abc', name: 'forecast_viewed' }],
    ['a horizon outside the picker', { id, name: 'forecast_horizon_changed', props: { years: 7 } }],
    ['a horizon event without props', { id, name: 'forecast_horizon_changed' }],
    ['a horizon given as a string', { id, name: 'forecast_horizon_changed', props: { years: '3' } }],
    ['a field beside the horizon', { id, name: 'forecast_horizon_changed', props: { years: 3, from: 10 } }],
  ])('refuses %s', (_why, ev) => {
    expect(ClientEventEnvelopeSchema.safeParse(ev).success).toBe(false);
  });

  it(`takes 1 to ${EVENTS_BATCH_MAX} events and nothing besides anonId and events`, () => {
    const batch = (n: number) => Array.from({ length: n }, () => ({ id, name: 'forecast_viewed' as const }));
    expect(EventsRequestSchema.safeParse({ anonId, events: batch(EVENTS_BATCH_MAX) }).success).toBe(true);
    expect(EventsRequestSchema.safeParse({ anonId, events: batch(EVENTS_BATCH_MAX + 1) }).success).toBe(false);
    expect(EventsRequestSchema.safeParse({ anonId, events: [] }).success).toBe(false);
    expect(EventsRequestSchema.safeParse({ anonId, events: batch(1), extra: true }).success).toBe(false);
  });
});

describe('Forecast horizon contracts', () => {
  const id = '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10';

  it('lists the picker horizons, and the type, schema and constant agree', () => {
    expect(FORECAST_HORIZONS).toEqual([1, 3, 5, 10]);
    expectTypeOf<HorizonYears>().toEqualTypeOf<(typeof FORECAST_HORIZONS)[number]>();
    expectTypeOf<HorizonYears>().toEqualTypeOf<1 | 3 | 5 | 10>();
    expectTypeOf<z.infer<typeof HorizonYearsSchema>>().toEqualTypeOf<HorizonYears>();
  });

  it.each(FORECAST_HORIZONS)('accepts %i years', (years) => {
    expect(HorizonYearsSchema.safeParse(years).success).toBe(true);
  });

  it.each([0, 2, 4, 7, 15, -1, 3.5, '10', null, undefined])('refuses %j years', (years) => {
    expect(HorizonYearsSchema.safeParse(years).success).toBe(false);
  });

  it('carries the shown horizon and its effect on an explain request, as an optional field', () => {
    expectTypeOf<NonNullable<ExplainRequest['horizon']>>().toEqualTypeOf<{ years: HorizonYears; effect: Money }>();
    expectTypeOf<{ loanResult: NonNullable<ExplainRequest['loanResult']> }>().toExtend<ExplainRequest>();
  });

  it('accepts the horizon event with a picker value', () => {
    for (const years of FORECAST_HORIZONS) {
      const ev = { id, name: 'forecast_horizon_changed', props: { years } };
      expect(ClientEventEnvelopeSchema.safeParse(ev).success).toBe(true);
    }
  });

  it('is a client event and not a funnel step', () => {
    expect(CLIENT_EVENT_NAMES).toContain('forecast_horizon_changed');
    expect(FUNNEL_EVENT_NAMES).toContain('forecast_horizon_changed');
    expect(FUNNEL_STEPS).not.toContain('forecast_horizon_changed' as never);
  });
});
