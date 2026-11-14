// M1: the contracts of the three micro-tools (subscription audit, overpaying check, debt payoff
// planner). The subscription audit's own schemas (findings, audit, charge dates) are M1's; the catalogue,
// overpaying, payoff and event schemas are declared by main (M2, M4, M10, M12), and the cases below that
// still hold for them are kept as regression tests of that shared contract. Every sample is written by
// hand, with the numbers worked out in the comments; nothing here is read back from an implementation. The committed fixtures (the sample statement's
// items and its golden audit) are checked in packages/data/fixtures/tools.test.ts (against the
// schemas and hand-worked figures) and apps/web/src/lib/statement/sampleItems.test.ts (against the
// CSV reader).
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  CADENCE_MONTHS, CLIENT_EVENT_NAMES, EVENTS_BATCH_MAX, FUNNEL_EVENT_NAMES, FUNNEL_STEPS, MISS_BUCKETS, SERVER_EVENT_NAMES,
  STATEMENT_CLASSES, SUBSCRIPTION_CONFIDENCES, SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_FLAGS, SUBSCRIPTION_ORIGINS,
  SUBSCRIPTION_STATUSES, TOOL_IDS,
  BenchmarkSchema, ChargeDateSchema, ClientEventEnvelopeSchema, EventsRequestSchema, KnownServiceSchema, OverpayingResultSchema,
  PayoffComparisonSchema, PayoffPlanSchema, StatementCategorizeResponseSchema, SubscriptionAuditSchema,
  SubscriptionFindingSchema, type ServicePlanSchema,
  type Benchmark, type ChargeDate, type ClientEventEnvelope, type ClientFunnelEvent, type KnownService, type MissBucket,
  type OverpayingResult, type PayoffComparison, type PayoffPlan, type ServicePlan, type StatementCategorizeResponse,
  type StatementClass, type SubscriptionAudit, type SubscriptionFinding, type SubscriptionFlag, type ToolId,
} from './index';

// main's bound, written out so a change to it is noticed here: subs_flagged and subs_cancel_marked count
// up to 5000 (EventsRequestSchema).
const EVENT_COUNT_MAX = 5_000;

const bad = (schema: z.ZodType, value: unknown) => expect(schema.safeParse(value).success).toBe(false);
const good = (schema: z.ZodType, value: unknown) => expect(schema.safeParse(value).success).toBe(true);

describe('the micro-tool schemas match their contract types', () => {
  it('parsed output is assignable to the contract, and the contract is accepted as input', () => {
    expectTypeOf<z.infer<typeof ServicePlanSchema>>().toExtend<ServicePlan>();
    expectTypeOf<ServicePlan>().toExtend<z.input<typeof ServicePlanSchema>>();
    expectTypeOf<z.infer<typeof KnownServiceSchema>>().toExtend<KnownService>();
    expectTypeOf<KnownService>().toExtend<z.input<typeof KnownServiceSchema>>();
    expectTypeOf<z.infer<typeof SubscriptionFindingSchema>>().toExtend<SubscriptionFinding>();
    expectTypeOf<SubscriptionFinding>().toExtend<z.input<typeof SubscriptionFindingSchema>>();
    expectTypeOf<z.infer<typeof SubscriptionAuditSchema>>().toExtend<SubscriptionAudit>();
    expectTypeOf<SubscriptionAudit>().toExtend<z.input<typeof SubscriptionAuditSchema>>();
    expectTypeOf<z.infer<typeof BenchmarkSchema>>().toExtend<Benchmark>();
    expectTypeOf<Benchmark>().toExtend<z.input<typeof BenchmarkSchema>>();
    expectTypeOf<z.infer<typeof OverpayingResultSchema>>().toExtend<OverpayingResult>();
    expectTypeOf<OverpayingResult>().toExtend<z.input<typeof OverpayingResultSchema>>();
    expectTypeOf<z.infer<typeof PayoffPlanSchema>>().toExtend<PayoffPlan>();
    expectTypeOf<PayoffPlan>().toExtend<z.input<typeof PayoffPlanSchema>>();
    expectTypeOf<z.infer<typeof PayoffComparisonSchema>>().toExtend<PayoffComparison>();
    expectTypeOf<PayoffComparison>().toExtend<z.input<typeof PayoffComparisonSchema>>();
    expectTypeOf<z.infer<typeof StatementCategorizeResponseSchema>>().toExtend<StatementCategorizeResponse>();
  });

  it('value lists cover every union member, once', () => {
    expectTypeOf<ToolId>().toEqualTypeOf<(typeof TOOL_IDS)[number]>();
    expectTypeOf<MissBucket>().toEqualTypeOf<(typeof MISS_BUCKETS)[number]>();
    expectTypeOf<SubscriptionFlag>().toEqualTypeOf<(typeof SUBSCRIPTION_FLAGS)[number]>();
    expectTypeOf<SubscriptionFinding['confidence']>().toEqualTypeOf<(typeof SUBSCRIPTION_CONFIDENCES)[number]>();
    expectTypeOf<SubscriptionFinding['status']>().toEqualTypeOf<(typeof SUBSCRIPTION_STATUSES)[number]>();
    expectTypeOf<SubscriptionFinding['origin']>().toEqualTypeOf<(typeof SUBSCRIPTION_ORIGINS)[number]>();
    for (const list of [
      TOOL_IDS, MISS_BUCKETS, SUBSCRIPTION_FLAGS, SUBSCRIPTION_CONFIDENCES, SUBSCRIPTION_STATUSES, SUBSCRIPTION_ORIGINS,
    ] as readonly (readonly string[])[]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('names the three tools, the five miss buckets and the months in each cadence the issue lists', () => {
    expect(TOOL_IDS).toEqual(['subscriptions', 'overpaying', 'payoff']);
    expect(MISS_BUCKETS).toEqual(['under0.5', '0.5to0.8', '0.8to1.25', '1.25to2', 'over2']);
    expect(CADENCE_MONTHS).toEqual({ monthly: 1, quarterly: 3, yearly: 12 });
  });
});

describe('KnownService (the catalogue entry)', () => {
  const plan: ServicePlan = { id: 'standard', name: 'Standard', price: 17.99, cadence: 'monthly' };
  const service: KnownService = {
    id: 'netflix', name: 'Netflix', category: 'video', matchers: ['NETFLIX COM', 'NETFLIX'], plans: [plan],
    priceYear: 2026, source: { name: 'Illustrative test source', year: 2026, url: 'https://example.com/pricing' }, isEstimate: false,
  };

  it('accepts an entry, with or without the ambiguous flag', () => {
    good(KnownServiceSchema, service);
    good(KnownServiceSchema, { ...service, id: 'apple', name: 'Apple', category: 'other', matchers: ['APPLE COM BILL'], ambiguous: true });
  });

  it('accepts matchers as merchantKey() writes them: upper-case words and single spaces', () => {
    for (const matcher of ['NETFLIX', 'SPOTIFY USA', 'PLANET FITNESS CLUB FEES', 'AMAZON PRIME', 'APPLE COM BILL', 'AT T']) {
      good(KnownServiceSchema, { ...service, matchers: [matcher] });
    }
    good(KnownServiceSchema, { ...service, matchers: ['NETFLIX', 'NETFLIX COM'] });   // different matchers, one of them a prefix of the other
  });

  it.each([
    ['a lower-case matcher (merchantKey never produces one, so it could never match)', { ...service, matchers: ['netflix com'] }],
    ['a mixed-case matcher', { ...service, matchers: ['Netflix'] }],
    ['two spaces in a row', { ...service, matchers: ['NETFLIX  COM'] }],
    ['a leading space', { ...service, matchers: [' NETFLIX'] }],
    ['a trailing space', { ...service, matchers: ['NETFLIX '] }],
  ])('refuses %s', (_why, value) => bad(KnownServiceSchema, value));

  it.each([
    ['no plan', { ...service, plans: [] }],
    ['no matcher', { ...service, matchers: [] }],
    ['an empty matcher', { ...service, matchers: [''] }],
    ['a matcher with a digit (not merchantKey style)', { ...service, matchers: ['NETFLIX 2026'] }],
    ['a matcher with punctuation', { ...service, matchers: ['NETFLIX.COM'] }],
    ['an unknown category', { ...service, category: 'streaming' }],
    ['a price of NaN', { ...service, plans: [{ ...plan, price: Number.NaN }] }],
    ['a price of Infinity', { ...service, plans: [{ ...plan, price: Number.POSITIVE_INFINITY }] }],
    ['a negative price', { ...service, plans: [{ ...plan, price: -1 }] }],
    ['an unknown cadence', { ...service, plans: [{ ...plan, cadence: 'weekly' }] }],
    ['no source', { ...service, source: undefined }],
    ['a price year that is not a year', { ...service, priceYear: 26 }],
    ['an id that is not a short string', { ...service, id: 'x'.repeat(101) }],
    ['no isEstimate flag', { ...service, isEstimate: undefined }],
  ])('refuses %s', (_why, value) => bad(KnownServiceSchema, value));
});

describe('ChargeDate (a day inside a statement)', () => {
  it('takes a month and a day that month has, in leap years too', () => {
    const days: ChargeDate[] = [{ month: '2026-11', day: 30 }, { month: '2026-12', day: 31 }, { month: '2028-02', day: 29 }, { month: '2026-01', day: 1 }];
    for (const day of days) good(ChargeDateSchema, day);
  });

  it.each([
    ['a day the month does not have', { month: '2026-11', day: 31 }],
    ['February 29 in a year that is not a leap year', { month: '2026-02', day: 29 }],
    ['day zero', { month: '2026-11', day: 0 }],
    ['a fractional day', { month: '2026-11', day: 7.5 }],
    ['a month 13', { month: '2026-13', day: 1 }],
    ['a month without its zero', { month: '2026-1', day: 1 }],
  ])('refuses %s', (_why, value) => bad(ChargeDateSchema, value));
});

describe('SubscriptionFinding and SubscriptionAudit', () => {
  // Netflix, five monthly charges of $17.99 on the 7th, July to November 2026 (as in the sample statement):
  // monthly 17.99, yearly 17.99 × 12 = 215.88.
  const netflix: SubscriptionFinding = {
    id: 'netflix-com-ca', merchantKey: 'NETFLIX COM CA', label: 'NETFLIX.COM # CA', serviceId: 'netflix', category: 'video',
    cadence: 'monthly', amount: 17.99, monthly: 17.99, yearly: 215.88, chargesSeen: 5,
    lastCharge: { month: '2026-11', day: 7 }, nextExpected: { month: '2026-12', day: 7 },
    status: 'active', flags: [], confidence: 'high', origin: 'statement', isEstimate: false,
  };
  // Amazon Prime, one yearly charge of $139 on 9 August: monthly 139 / 12 = 11.58 (to the cent), yearly 139.
  const prime: SubscriptionFinding = {
    id: 'amazon-prime-amzn-com-bill-wa', merchantKey: 'AMAZON PRIME AMZN COM BILL WA',
    label: 'AMAZON PRIME*[ref] Amzn.com/bill WA', serviceId: 'amazon-prime', category: 'other',
    cadence: 'yearly', amount: 139, monthly: 11.58, yearly: 139, chargesSeen: 1,
    lastCharge: { month: '2026-08', day: 9 }, nextExpected: { month: '2027-08', day: 9 },
    status: 'active', flags: ['seenOnce'], confidence: 'medium', origin: 'statement', isEstimate: false,
  };
  // A service the user ticked in the cold tick-list: nothing was charged or seen, and the price is a catalogue estimate.
  const ticked: SubscriptionFinding = {
    id: 'spotify', merchantKey: 'SPOTIFY', label: 'Spotify', serviceId: 'spotify', category: 'music',
    cadence: 'monthly', amount: 11.99, monthly: 11.99, yearly: 143.88, chargesSeen: 0,
    lastCharge: null, nextExpected: null, status: 'active', flags: [], confidence: 'high', origin: 'tickList', isEstimate: true,
  };

  it('accepts a monthly finding, a yearly one seen once, and a ticked service', () => {
    good(SubscriptionFindingSchema, netflix);
    good(SubscriptionFindingSchema, prime);
    good(SubscriptionFindingSchema, ticked);
  });

  it('accepts a price rise (with its previous amount), an overlap and a stopped finding', () => {
    // $15.49 → $17.99 is a rise of 2.50 (about 16%).
    good(SubscriptionFindingSchema, { ...netflix, flags: ['priceUp'], previousAmount: 15.49 });
    good(SubscriptionFindingSchema, { ...netflix, flags: ['overlap'], overlapsWith: ['hulu-com'] });
    good(SubscriptionFindingSchema, { ...netflix, status: 'stopped', nextExpected: null });
  });

  it('accepts a quarterly finding: $30 a quarter is $10 a month and $120 a year', () => {
    good(SubscriptionFindingSchema, { ...netflix, cadence: 'quarterly', amount: 30, monthly: 10, yearly: 120 });
  });

  it('accepts February 29 in a leap year and a 31st in a 31-day month', () => {
    good(SubscriptionFindingSchema, { ...netflix, lastCharge: { month: '2028-02', day: 29 }, nextExpected: { month: '2028-03', day: 31 } });
  });

  it.each([
    ['an amount of NaN', { ...netflix, amount: Number.NaN }],
    ['an amount of Infinity', { ...netflix, amount: Number.POSITIVE_INFINITY }],
    ['a negative amount', { ...netflix, amount: -17.99, monthly: -17.99, yearly: -215.88 }],
    ['a monthly figure that is not the amount per month', { ...netflix, monthly: 215.88 }],
    ['a yearly figure that is not twelve months', { ...netflix, yearly: 17.99 }],
    ['a yearly amount whose monthly figure is the whole price', { ...prime, monthly: 139 }],
    ['a month that is not YYYY-MM', { ...netflix, lastCharge: { month: '2026-13', day: 7 } }],
    ['a day the month does not have', { ...netflix, lastCharge: { month: '2026-11', day: 31 } }],
    ['February 29 in a year that is not a leap year', { ...netflix, lastCharge: { month: '2026-02', day: 29 } }],
    ['a fractional day', { ...netflix, lastCharge: { month: '2026-11', day: 7.5 } }],
    ['an unknown cadence', { ...netflix, cadence: 'weekly' }],
    ['an unknown flag', { ...netflix, flags: ['cheap'] }],
    ['the same flag twice', { ...netflix, flags: ['priceUp', 'priceUp'], previousAmount: 15.49 }],
    ['an unknown confidence', { ...netflix, confidence: 'certain' }],
    ['a stopped finding that still has a next date', { ...netflix, status: 'stopped' }],
    ['a price rise with no previous amount', { ...netflix, flags: ['priceUp'] }],
    ['a price rise whose previous amount is higher', { ...netflix, flags: ['priceUp'], previousAmount: 19.99 }],
    ['an overlap that names no other finding', { ...netflix, flags: ['overlap'] }],
    ['seenOnce on a finding with five charges', { ...netflix, flags: ['seenOnce'] }],
    ['a statement finding with no charge seen', { ...netflix, chargesSeen: 0 }],
    ['a statement finding with no last charge', { ...netflix, lastCharge: null }],
    ['a ticked service with charges seen', { ...ticked, chargesSeen: 3 }],
    ['a ticked service with a last charge', { ...ticked, lastCharge: { month: '2026-11', day: 12 } }],
    ['a ticked service that is not marked as an estimate', { ...ticked, isEstimate: false }],
    ['a label that is empty', { ...netflix, label: '' }],
    ['an id that is not a short string', { ...netflix, id: 'x'.repeat(101) }],
    ['a previous amount of zero', { ...netflix, flags: ['priceUp'], previousAmount: 0 }],
    ['a list of overlapping findings without the overlap flag', { ...netflix, overlapsWith: ['hulu-com'] }],
    ['a list of overlapping findings under another flag', { ...netflix, flags: ['priceUp'], previousAmount: 15.49, overlapsWith: ['hulu-com'] }],
    ['a previous amount without the priceUp flag', { ...netflix, previousAmount: 15.49 }],
    ['a previous amount under another flag', { ...netflix, flags: ['introEnded'], previousAmount: 0.99 }],
  ])('refuses %s', (_why, value) => bad(SubscriptionFindingSchema, value));

  it('takes monthly and yearly as the exact figure or as rounded to the cent (Money stays unrounded dollars)', () => {
    // 139 ÷ 12 = 11.58333…; to the cent that is 11.58. Both are fine; 11.60 is not the monthly cost of $139 a year.
    good(SubscriptionFindingSchema, { ...prime, monthly: 139 / 12 });
    good(SubscriptionFindingSchema, { ...prime, monthly: 11.58 });
    bad(SubscriptionFindingSchema, { ...prime, monthly: 11.6 });
    good(SubscriptionFindingSchema, { ...netflix, yearly: 17.99 * 12 });            // 215.88 up to float noise
  });

  describe('the audit', () => {
    // 17.99 + 11.58 = 29.57 a month (rounded to cents once); 215.88 + 139 = 354.88 a year.
    const audit: SubscriptionAudit = {
      findings: [netflix, prime], monthlyTotal: 29.57, yearlyTotal: 354.88, monthsCovered: 5, asOf: { month: '2026-11', day: 12 },
    };

    it('accepts an audit, and the empty one a statement with no recurring charge gives', () => {
      good(SubscriptionAuditSchema, audit);
      good(SubscriptionAuditSchema, { findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 0, asOf: null });
      good(SubscriptionAuditSchema, { findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 2, asOf: { month: '2026-11', day: 12 } });
    });

    it.each([
      ['a total of NaN', { ...audit, monthlyTotal: Number.NaN }],
      ['a negative total', { ...audit, yearlyTotal: -1 }],
      ['a negative month count', { ...audit, monthsCovered: -1 }],
      ['a fractional month count', { ...audit, monthsCovered: 1.5 }],
      ['findings but no as-of date', { ...audit, asOf: null }],
      ['a day the as-of month does not have', { ...audit, asOf: { month: '2026-11', day: 31 } }],
      // 17.99 × 2 = 35.98 a month and 215.88 × 2 = 431.76 a year, so only the repeated id is wrong here.
      ['two findings with the same id', { ...audit, findings: [netflix, netflix], monthlyTotal: 35.98, yearlyTotal: 431.76 }],
      ['an overlap with a finding that is not in the audit', {
        ...audit, findings: [{ ...netflix, flags: ['overlap'], overlapsWith: ['hulu-com'] }, prime],
      }],
      ['a finding that overlaps itself', {
        ...audit, findings: [{ ...netflix, flags: ['overlap'], overlapsWith: ['netflix-com-ca'] }, prime],
      }],
      ['a finding with an overlap list but no overlap flag', { ...audit, findings: [{ ...netflix, overlapsWith: ['amazon-prime-amzn-com-bill-wa'] }, prime] }],
      ['a finding with a previous amount but no priceUp flag', { ...audit, findings: [{ ...netflix, previousAmount: 15.49 }, prime] }],
      ['findings that is not a list', { ...audit, findings: netflix }],
      // Netflix was last charged on 7 November 2026 and Prime on 9 August.
      ['an as-of day before the last charge of a finding', { ...audit, asOf: { month: '2026-11', day: 6 } }],
      ['an as-of month before the last charge of a finding', { ...audit, asOf: { month: '2026-07', day: 31 } }],
      // Both findings are active and at least medium confidence, so both are counted: 29.57 a month, 354.88 a year.
      ['totals of zero beside active findings that are not low confidence', { ...audit, monthlyTotal: 0, yearlyTotal: 0 }],
      ['a monthly total that leaves out an active medium-confidence finding (Netflix alone is 17.99)', { ...audit, monthlyTotal: 17.99 }],
      ['a yearly total that leaves out an active medium-confidence finding (Netflix alone is 215.88)', { ...audit, yearlyTotal: 215.88 }],
      ['a monthly total above every finding put together', { ...audit, monthlyTotal: 40 }],
      ['a yearly total above every finding put together', { ...audit, yearlyTotal: 400 }],
    ])('refuses %s', (_why, value) => bad(SubscriptionAuditSchema, value));

    it('accepts an overlap between two findings that are both in the audit', () => {
      const hulu: SubscriptionFinding = {
        ...netflix, id: 'hulu-com', merchantKey: 'HULU COM', label: 'HULU.COM', serviceId: 'hulu',
        flags: ['overlap'], overlapsWith: ['netflix-com-ca'],
      };
      // Both cost 17.99 a month (215.88 a year): 35.98 and 431.76 together.
      good(SubscriptionAuditSchema, {
        ...audit, findings: [{ ...netflix, flags: ['overlap'], overlapsWith: ['hulu-com'] }, hulu], monthlyTotal: 35.98, yearlyTotal: 431.76,
      });
    });

    it('accepts an as-of date on the day of the newest charge, and later', () => {
      good(SubscriptionAuditSchema, { ...audit, asOf: { month: '2026-11', day: 7 } });
      good(SubscriptionAuditSchema, { ...audit, asOf: { month: '2027-01', day: 1 } });
    });

    describe('totals count the active findings that are not low confidence, and never more than all findings', () => {
      // Spotify seen twice at the same price: only a pattern, so low confidence ("to confirm").
      const toConfirm: SubscriptionFinding = {
        ...netflix, id: 'spotify-usa-ny', merchantKey: 'SPOTIFY USA NY', label: 'SPOTIFY USA # NY', serviceId: 'spotify', category: 'music',
        amount: 11.99, monthly: 11.99, yearly: 143.88, chargesSeen: 2,
        lastCharge: { month: '2026-11', day: 12 }, nextExpected: { month: '2026-12', day: 12 }, confidence: 'low',
      };
      // Hulu stopped: last charged in July, and no next date.
      const stopped: SubscriptionFinding = {
        ...netflix, id: 'hulu-com', merchantKey: 'HULU COM', label: 'HULU.COM', serviceId: 'hulu',
        amount: 9.99, monthly: 9.99, yearly: 119.88, lastCharge: { month: '2026-07', day: 7 }, nextExpected: null, status: 'stopped',
      };
      const asOf = { month: '2026-11', day: 12 };

      it('leaves a low-confidence finding out until it is confirmed, then counts it', () => {
        // Not confirmed: Netflix only, 17.99 a month and 215.88 a year.
        good(SubscriptionAuditSchema, { findings: [netflix, toConfirm], monthlyTotal: 17.99, yearlyTotal: 215.88, monthsCovered: 5, asOf });
        // Confirmed: 17.99 + 11.99 = 29.98 a month and 215.88 + 143.88 = 359.76 a year.
        good(SubscriptionAuditSchema, { findings: [netflix, toConfirm], monthlyTotal: 29.98, yearlyTotal: 359.76, monthsCovered: 5, asOf });
      });

      it('does not need a stopped finding in the totals', () => {
        good(SubscriptionAuditSchema, { findings: [netflix, stopped], monthlyTotal: 17.99, yearlyTotal: 215.88, monthsCovered: 5, asOf });
      });

      it('takes the totals of an audit that holds only findings to confirm as zero', () => {
        good(SubscriptionAuditSchema, { findings: [toConfirm], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 2, asOf });
      });

      it('refuses totals above all the findings, stopped and low-confidence ones included', () => {
        // All three together: 17.99 + 11.99 + 9.99 = 39.97 a month and 215.88 + 143.88 + 119.88 = 479.64 a year.
        good(SubscriptionAuditSchema, { findings: [netflix, toConfirm, stopped], monthlyTotal: 39.97, yearlyTotal: 479.64, monthsCovered: 5, asOf });
        bad(SubscriptionAuditSchema, { findings: [netflix, toConfirm, stopped], monthlyTotal: 45, yearlyTotal: 479.64, monthsCovered: 5, asOf });
        bad(SubscriptionAuditSchema, { findings: [netflix, toConfirm, stopped], monthlyTotal: 39.97, yearlyTotal: 500, monthsCovered: 5, asOf });
      });
    });

    it('holds at most SUBSCRIPTION_FINDINGS_MAX findings, and an audit that full can be counted in one event', () => {
      // n copies of Netflix under different ids: n × 17.99 a month and n × 215.88 a year.
      const many = (n: number): SubscriptionAudit => ({
        findings: Array.from({ length: n }, (_, i) => ({ ...netflix, id: `service-${i}` })),
        monthlyTotal: n * 17.99, yearlyTotal: n * 215.88, monthsCovered: 5, asOf: { month: '2026-11', day: 12 },
      });
      const atCap = many(SUBSCRIPTION_FINDINGS_MAX);
      expect(atCap.findings).toHaveLength(SUBSCRIPTION_FINDINGS_MAX);
      good(SubscriptionAuditSchema, atCap);
      bad(SubscriptionAuditSchema, many(SUBSCRIPTION_FINDINGS_MAX + 1));
      // The audit's whole finding list can be flagged, or marked to cancel, in one event (main's cap is 5000).
      expect(SUBSCRIPTION_FINDINGS_MAX).toBeLessThanOrEqual(EVENT_COUNT_MAX);
      const eventId = '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10';
      for (const name of ['subs_flagged', 'subs_cancel_marked']) {
        good(ClientEventEnvelopeSchema, { id: eventId, name, props: { count: atCap.findings.length } });
      }
    });
  });
});

describe('Benchmark and OverpayingResult', () => {
  // Rent: $2,150 a month against a typical $1,580 to $1,940 (mid $1,760). Above the range by
  // 2,150 − 1,940 = 210 a month, which is 210 × 12 = 2,520 a year.
  const rent: Benchmark = {
    line: 'rent', yours: 2_150, typical: { low: 1_580, mid: 1_760, high: 1_940 },
    source: { name: 'Illustrative test source', year: 2026 }, isEstimate: false,
    position: 'above', gapPerMonth: 210, gapPerYear: 2_520, effect10y: 25_000,
  };
  // Car insurance: $140 a month sits inside $120 to $160, so there is no gap.
  const insurance: Benchmark = {
    line: 'carInsurance', yours: 140, typical: { low: 120, mid: 140, high: 160 },
    source: { name: 'Illustrative test source', year: 2026 }, isEstimate: true,
    position: 'inRange', gapPerMonth: 0, gapPerYear: 0, effect10y: 0,
  };

  it('accepts a line above the range, one inside it, one below it and one at the edge', () => {
    good(BenchmarkSchema, rent);
    good(BenchmarkSchema, insurance);
    good(BenchmarkSchema, { ...insurance, yours: 100, position: 'below' });
    good(BenchmarkSchema, { ...insurance, yours: 160 });               // exactly the top of the range is still in range
    good(BenchmarkSchema, { ...insurance, yours: 120 });               // and so is the bottom
    good(BenchmarkSchema, { ...rent, effect10y: -4_000 });             // a line moved up to the mid costs money
  });

  it.each([
    ['yours of NaN', { ...rent, yours: Number.NaN }],
    ['a negative amount', { ...rent, yours: -2_150 }],
    ['an effect of Infinity', { ...rent, effect10y: Number.POSITIVE_INFINITY }],
    ['a range that is not low ≤ mid ≤ high', { ...rent, typical: { low: 1_900, mid: 1_760, high: 1_940 } }],
    ['a line that is not one of the four', { ...rent, line: 'phone' }],
    ['a position that is not one of the three', { ...rent, position: 'over' }],
    ['a negative gap', { ...rent, gapPerMonth: -210, gapPerYear: -2_520 }],
    ['no source', { ...rent, source: undefined }],
    ['no isEstimate flag', { ...rent, isEstimate: undefined }],
  ])('refuses %s', (_why, value) => bad(BenchmarkSchema, value));

  const result: OverpayingResult = {
    coverage: 'exact', lines: [rent, insurance],
    skipped: [{ line: 'groceries', reason: 'notEntered' }, { line: 'childcare', reason: 'noData' }],
  };

  it('accepts an exact result, a metro result with its metro, and "no coverage" with no lines', () => {
    good(OverpayingResultSchema, result);
    good(OverpayingResultSchema, { ...result, coverage: 'metro', metro: 'Dallas-Fort Worth' });
    good(OverpayingResultSchema, {
      coverage: 'none', lines: [], skipped: [{ line: 'rent', reason: 'noData' }],
    });
  });

  it.each([
    ['a coverage that is not one of the three', { ...result, coverage: 'national' }],
    ['a skip reason that is not one of the two', { ...result, skipped: [{ line: 'groceries', reason: 'tooHard' }] }],
    ['lines that is not a list', { ...result, lines: rent }],
  ])('refuses %s', (_why, value) => bad(OverpayingResultSchema, value));
});

describe('PayoffPlan and PayoffComparison', () => {
  // One debt, $400 at 0% paid $100 a month: balances 400, 300, 200, 100, 0 over months 0 to 4. No
  // interest, so $400 is paid in all, and the plan saves nothing against paying the minimum.
  const plan: PayoffPlan = {
    method: 'avalanche', order: ['card-1'], monthsToDebtFree: 4, totalInterest: 0, totalPaid: 400,
    perDebt: [{ id: 'card-1', payoffMonth: 4, interest: 0 }],
    timeline: [
      { month: 0, balance: 400 }, { month: 1, balance: 300 }, { month: 2, balance: 200 }, { month: 3, balance: 100 }, { month: 4, balance: 0 },
    ],
    interestSavedVsMinimum: 0, monthsSavedVsMinimum: 0,
  };

  it('accepts a finished plan, and a plan that never pays off (nulls, never Infinity)', () => {
    good(PayoffPlanSchema, plan);
    good(PayoffPlanSchema, {
      ...plan, monthsToDebtFree: null, perDebt: [{ id: 'card-1', payoffMonth: null, interest: 1_200 }],
      monthsSavedVsMinimum: null,
    });
  });

  it('accepts no debts at all: a zero plan', () => {
    good(PayoffPlanSchema, {
      method: 'minimum', order: [], monthsToDebtFree: 0, totalInterest: 0, totalPaid: 0, perDebt: [],
      timeline: [{ month: 0, balance: 0 }], interestSavedVsMinimum: 0, monthsSavedVsMinimum: 0,
    });
  });

  it.each([
    ['a method that is not one of the three', { ...plan, method: 'highestBalance' }],
    ['negative months to debt-free', { ...plan, monthsToDebtFree: -1 }],
    ['fractional months to debt-free', { ...plan, monthsToDebtFree: 4.5 }],
    ['Infinity months to debt-free', { ...plan, monthsToDebtFree: Number.POSITIVE_INFINITY }],
    ['NaN total interest', { ...plan, totalInterest: Number.NaN }],
    ['negative total interest', { ...plan, totalInterest: -1 }],
    ['negative total paid', { ...plan, totalPaid: -400 }],
    ['a negative balance in the timeline', { ...plan, timeline: [{ month: 0, balance: -1 }] }],
    ['a timeline longer than the simulation cap', {
      ...plan, timeline: Array.from({ length: 1_202 }, (_, month) => ({ month, balance: 0 })),
    }],
    ['a debt with a payoff month below zero', { ...plan, perDebt: [{ id: 'card-1', payoffMonth: -1, interest: 0 }] }],
    ['a debt with NaN interest', { ...plan, perDebt: [{ id: 'card-1', payoffMonth: 4, interest: Number.NaN }] }],
    ['an interest saving of NaN', { ...plan, interestSavedVsMinimum: Number.NaN }],
  ])('refuses %s', (_why, value) => bad(PayoffPlanSchema, value));

  it('takes a negative number of months saved against the minimum plan: snowball can finish later than the input-order minimum', () => {
    // Main's engine really does this (a 5-debt set at extra 0 gave -165 months), and a month count is a whole number of either sign.
    for (const monthsSavedVsMinimum of [-165, -1, 0, 4]) good(PayoffPlanSchema, { ...plan, monthsSavedVsMinimum });
    good(PayoffPlanSchema, { ...plan, monthsSavedVsMinimum: null });
    bad(PayoffPlanSchema, { ...plan, monthsSavedVsMinimum: 1.5 });
    bad(PayoffPlanSchema, { ...plan, monthsSavedVsMinimum: Number.NaN });
    // The same for the money saved: a plan can cost more interest than the minimum plan.
    good(PayoffPlanSchema, { ...plan, interestSavedVsMinimum: -250 });
  });

  it('PayoffComparison holds one plan per method and a non-negative extra payment', () => {
    const comparison: PayoffComparison = {
      extra: 150,
      avalanche: plan,
      snowball: { ...plan, method: 'snowball' },
      minimum: { ...plan, method: 'minimum' },
    };
    good(PayoffComparisonSchema, comparison);
    good(PayoffComparisonSchema, { ...comparison, extra: 0 });
    bad(PayoffComparisonSchema, { ...comparison, extra: -1 });
    bad(PayoffComparisonSchema, { ...comparison, extra: Number.NaN });
    bad(PayoffComparisonSchema, { ...comparison, minimum: undefined });
  });
});

describe('POST /api/statement/categorize reply: the additive `classes` field', () => {
  const totals = Object.fromEntries(['rentUtilities', 'car', 'childcare', 'groceries', 'eatingOut', 'subscriptions', 'debtPayments', 'other'].map((c) => [c, 0]));
  const reply = { ok: true, months: [{ month: '2026-10', totals, oneOffs: [] }], categorizedBy: 'rules' };

  it('types it as an optional list of { label, class }', () => {
    expectTypeOf<NonNullable<StatementCategorizeResponse['classes']>[number]>().toEqualTypeOf<{ label: string; class: StatementClass }>();
  });

  it('is optional, so a reply without it (and an old client that ignores it) still validates', () => {
    good(StatementCategorizeResponseSchema, reply);
    good(StatementCategorizeResponseSchema, {
      ...reply, classes: [{ label: 'NETFLIX.COM # CA', class: 'subscriptions' }, { label: 'ACME PAYROLL', class: 'pay' }],
    });
    good(StatementCategorizeResponseSchema, { ...reply, classes: [] });
  });

  it('accepts every StatementClass, and refuses an unknown class, an empty label and a non-list', () => {
    for (const cls of STATEMENT_CLASSES) good(StatementCategorizeResponseSchema, { ...reply, classes: [{ label: 'X', class: cls }] });
    bad(StatementCategorizeResponseSchema, { ...reply, classes: [{ label: 'X', class: 'rent' }] });
    bad(StatementCategorizeResponseSchema, { ...reply, classes: [{ label: '', class: 'other' }] });
    bad(StatementCategorizeResponseSchema, { ...reply, classes: { label: 'X', class: 'other' } });
  });

  it('keeps `months` and `categorizedBy` exactly as before', () => {
    bad(StatementCategorizeResponseSchema, { ...reply, categorizedBy: 'llm' });
    bad(StatementCategorizeResponseSchema, { ok: true, categorizedBy: 'rules', classes: [] });
  });
});

describe('the micro-tool funnel events', () => {
  const anonId = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
  const id = '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10';
  const NEW_EVENTS = [
    'tool_opened', 'subs_started', 'subs_revealed', 'subs_flagged', 'subs_cancel_marked',
    'renewals_exported', 'overpaying_checked', 'payoff_planned',
  ] as const;

  it('lists the eight names as client events, and in none of the server or funnel-step lists', () => {
    for (const name of NEW_EVENTS) {
      expect(CLIENT_EVENT_NAMES).toContain(name);
      expect(FUNNEL_EVENT_NAMES).toContain(name);
      expect(SERVER_EVENT_NAMES).not.toContain(name);
      expect(FUNNEL_STEPS).not.toContain(name);
    }
    expect(FUNNEL_EVENT_NAMES.length).toBeLessThanOrEqual(63);   // one bit each in the Postgres bigint funnel mask (same bound as schemas.test.ts)
  });

  it('leaves the main funnel exactly as it was', () => {
    expect(FUNNEL_STEPS).toEqual([
      'play_started', 'game_finished', 'own_guess_submitted', 'sliders_adjusted', 'balance_sheet_edited',
      'statement_applied', 'forecast_viewed', 'paywall_viewed', 'pro_purchased',
    ]);
  });

  it('types each new event with enum or count props only', () => {
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'tool_opened' }>['props']>().toEqualTypeOf<{ tool: ToolId }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'subs_started' }>['props']>().toEqualTypeOf<{ path: 'tickList' | 'statement' }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'subs_revealed' }>['props']>().toEqualTypeOf<{ miss: MissBucket }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'subs_flagged' | 'subs_cancel_marked' }>['props']>().toEqualTypeOf<{ count: number }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'overpaying_checked' }>['props']>().toEqualTypeOf<{ lines: number; above: number }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'payoff_planned' }>['props']>().toEqualTypeOf<{ method: 'avalanche' | 'snowball' }>();
    expectTypeOf<Extract<ClientFunnelEvent, { name: 'renewals_exported' }>>().toEqualTypeOf<{ name: 'renewals_exported' }>();
    expectTypeOf<z.infer<typeof ClientEventEnvelopeSchema>>().toExtend<ClientEventEnvelope>();
    expectTypeOf<ClientEventEnvelope>().toExtend<z.input<typeof ClientEventEnvelopeSchema>>();
  });

  it('accepts every new event, in a batch, with the props the issue lists', () => {
    const events: ClientEventEnvelope[] = [
      { id, name: 'tool_opened', props: { tool: 'subscriptions' } },
      { id, name: 'tool_opened', props: { tool: 'overpaying' } },
      { id, name: 'tool_opened', props: { tool: 'payoff' } },
      { id, name: 'subs_started', props: { path: 'tickList' } },
      { id, name: 'subs_started', props: { path: 'statement' } },
      ...MISS_BUCKETS.map((miss) => ({ id, name: 'subs_revealed' as const, props: { miss } })),
      { id, name: 'subs_flagged', props: { count: 0 } },
      { id, name: 'subs_flagged', props: { count: EVENT_COUNT_MAX } },
      { id, name: 'subs_cancel_marked', props: { count: 3 } },
      { id, name: 'renewals_exported' },
      { id, name: 'overpaying_checked', props: { lines: 4, above: 2 } },
      { id, name: 'overpaying_checked', props: { lines: 0, above: 0 } },
      { id, name: 'payoff_planned', props: { method: 'avalanche' } },
      { id, name: 'payoff_planned', props: { method: 'snowball' } },
    ];
    for (const event of events) good(ClientEventEnvelopeSchema, event);
    expect(events.length).toBeLessThanOrEqual(EVENTS_BATCH_MAX);
    good(EventsRequestSchema, { anonId, events });
  });

  it('lets subs_flagged and subs_cancel_marked count up to the cap, which is above what an audit can hold', () => {
    // An event over its cap would make the whole POST /api/events batch a 400, and the browser drops a batch it
    // gets a 400 for. So the cap of the event must not be below the most findings an audit may hold.
    expect(SUBSCRIPTION_FINDINGS_MAX).toBeLessThanOrEqual(EVENT_COUNT_MAX);
    for (const name of ['subs_flagged', 'subs_cancel_marked'] as const) {
      good(ClientEventEnvelopeSchema, { id, name, props: { count: EVENT_COUNT_MAX } });
      good(ClientEventEnvelopeSchema, { id, name, props: { count: SUBSCRIPTION_FINDINGS_MAX } });
      bad(ClientEventEnvelopeSchema, { id, name, props: { count: EVENT_COUNT_MAX + 1 } });
    }
    good(EventsRequestSchema, {
      anonId, events: [{ id, name: 'play_started' }, { id, name: 'subs_flagged', props: { count: SUBSCRIPTION_FINDINGS_MAX } }],
    });
  });

  it.each([
    ['an amount in props', { id, name: 'tool_opened', props: { tool: 'subscriptions', amount: 57.96 } }],
    ['an amount where a count goes', { id, name: 'subs_flagged', props: { count: 28_000 } }],
    ['a fractional count', { id, name: 'subs_cancel_marked', props: { count: 17.99 } }],
    ['a negative count', { id, name: 'subs_flagged', props: { count: -1 } }],
    ['a count over the cap', { id, name: 'subs_flagged', props: { count: EVENT_COUNT_MAX + 1 } }],
    ['a free string where a count goes', { id, name: 'subs_flagged', props: { count: 'Netflix' } }],
    ['a merchant label as the path', { id, name: 'subs_started', props: { path: 'netflix' } }],
    ['a merchant label beside the props', { id, name: 'subs_started', props: { path: 'statement', label: 'NETFLIX.COM' } }],
    ['an extra key on props', { id, name: 'payoff_planned', props: { method: 'avalanche', extra: 150 } }],
    ['a field beside the event', { id, name: 'subs_flagged', props: { count: 2 }, note: 'forgot Hulu' }],
    ['a tool that is not one of the three', { id, name: 'tool_opened', props: { tool: 'household' } }],
    ['no props on an event that needs them', { id, name: 'tool_opened' }],
    ['empty props on an event that needs them', { id, name: 'subs_revealed', props: {} }],
    ['props on an event that has none', { id, name: 'renewals_exported', props: { count: 4 } }],
    ['a miss that is a number, not a bucket', { id, name: 'subs_revealed', props: { miss: 2.5 } }],
    ['a miss bucket that does not exist', { id, name: 'subs_revealed', props: { miss: '0.8to1.2' } }],
    ['the "minimum" method, which is not a plan the user picks', { id, name: 'payoff_planned', props: { method: 'minimum' } }],
    ['more than four lines', { id, name: 'overpaying_checked', props: { lines: 5, above: 0 } }],
    ['an amount as the number of lines', { id, name: 'overpaying_checked', props: { lines: 2_150, above: 1 } }],
    ['an id that is not a UUID', { id: 'abc', name: 'renewals_exported' }],
  ])('refuses %s', (_why, event) => bad(ClientEventEnvelopeSchema, event));
});
