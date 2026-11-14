// M3: detectSubscriptions and auditTotals. Every expected number is worked out by hand in the test
// that uses it (never read back from the detector). The catalogue here is a small one defined for
// these tests: the real one (M4) is data the detector receives as a parameter, and only the lone
// charge bound is also checked against it (one block, with the plan prices read off it). The golden audit of
// the sample statement with the keyword rules' classes lives in
// apps/web/src/lib/statement/subscriptionsGolden.test.ts (the rules are server code).
import { statementItemsSample } from '@lifeguessr/data/fixtures/tools';
import { knownServices } from '@lifeguessr/data/subscriptions';
import {
  KnownServiceSchema, SubscriptionAuditSchema, SubscriptionFindingSchema,
  type KnownService, type ServiceCategory, type StatementClass, type StatementItem, type SubscriptionAudit,
  type SubscriptionFinding,
} from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { assumptions, subscriptionAssumptions } from './assumptions';
import { auditTotals, detectSubscriptions } from './subscriptions';

// ----- helpers ---------------------------------------------------------------------------------

const item = (month: string, day: number, label: string, amount: number): StatementItem => ({ month, day, label, amount });
/** One charge of `amount` on `day` in each of the given months. */
const monthly = (label: string, amount: number, day: number, months: readonly string[]): StatementItem[] =>
  months.map((month) => item(month, day, label, amount));
/** 'YYYY-MM' of month `n` (1-12) of `year`. */
const ym = (n: number, year = 2026) => `${year}-${String(n).padStart(2, '0')}`;
const range = (from: number, to: number, year = 2026) =>
  Array.from({ length: to - from + 1 }, (_, i) => ym(from + i, year));
/** A pay line: sets the statement's last day (`asOf`) without being a charge. */
const payday = (month: string, day: number) => item(month, day, 'ACME LOGISTICS INC PAYROLL PPD ID: #', -2000);

const asClass = (cls: StatementClass) => () => cls;

const service = (
  id: string, name: string, category: ServiceCategory, matchers: string[],
  plans: [number, 'monthly' | 'quarterly' | 'yearly'][], ambiguous = false,
): KnownService => ({
  id, name, category, matchers,
  plans: plans.map(([price, cadence], i) => ({ id: `plan${i}`, name: `${name} ${cadence}`, price, cadence })),
  ...(ambiguous ? { ambiguous } : {}),
  priceYear: 2026, source: { name: 'test catalogue', year: 2026 }, isEstimate: true,
});

const CATALOGUE: readonly KnownService[] = [
  service('netflix', 'Netflix', 'video', ['NETFLIX'], [[17.99, 'monthly']]),
  service('hulu', 'Hulu', 'video', ['HULU'], [[9.99, 'monthly']]),
  service('max', 'Max', 'video', ['HBO MAX'], [[15.99, 'monthly']]),
  service('spotify', 'Spotify', 'music', ['SPOTIFY'], [[11.99, 'monthly']]),
  service('pandora', 'Pandora', 'music', ['PANDORA'], [[10.99, 'monthly']]),
  service('planet-fitness', 'Planet Fitness', 'fitness', ['PLANET FITNESS'], [[24.99, 'monthly']]),
  service('la-fitness', 'LA Fitness', 'fitness', ['LA FITNESS'], [[34.99, 'monthly']]),
  service('amazon-prime', 'Amazon Prime', 'other', ['AMAZON PRIME'], [[139, 'yearly']]),
  service('apple', 'Apple', 'other', ['APPLE COM BILL'], [[0.99, 'monthly']], true),
  service('city-news', 'City News', 'news', ['CITY NEWS'], [[30, 'quarterly']]),
];

/** Runs the detector and checks the result against the M1 contract before returning it. */
function run(
  items: readonly StatementItem[],
  opts: Parameters<typeof detectSubscriptions>[1] = {},
): SubscriptionAudit {
  const audit = detectSubscriptions(items, opts);
  const parsed = SubscriptionAuditSchema.safeParse(audit);
  expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  return audit;
}
const only = (audit: SubscriptionAudit): SubscriptionFinding => {
  expect(audit.findings).toHaveLength(1);
  return audit.findings[0]!;
};
const idsOf = (audit: SubscriptionAudit) => audit.findings.map((f) => f.id);
const byId = (audit: SubscriptionAudit, id: string): SubscriptionFinding => {
  const found = audit.findings.find((f) => f.id === id);
  expect(found, `finding ${id}`).toBeDefined();
  return found!;
};

const subscriptions = asClass('subscriptions');

// ----- the basics ------------------------------------------------------------------------------

describe('detectSubscriptions: the basics', () => {
  it('returns an empty audit with asOf null for no lines', () => {
    expect(run([])).toEqual({ findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 0, asOf: null });
  });

  it('finds a steady monthly charge: $9.99 on the 5th of January to March', () => {
    const audit = run(monthly('GYM CLUB # NY', 9.99, 5, range(1, 3)), { classOf: subscriptions });
    expect(only(audit)).toEqual({
      id: 'gym-club-ny', merchantKey: 'GYM CLUB NY', label: 'GYM CLUB # NY', category: 'other',
      cadence: 'monthly', amount: 9.99, monthly: 9.99, yearly: 119.88, // 9.99 × 12 = 119.88
      chargesSeen: 3, lastCharge: { month: '2026-03', day: 5 }, nextExpected: { month: '2026-04', day: 5 },
      status: 'active', flags: [], confidence: 'high', origin: 'statement', isEstimate: false,
    });
    expect([audit.monthlyTotal, audit.yearlyTotal, audit.monthsCovered, audit.asOf]).toEqual([9.99, 119.88, 3, { month: '2026-03', day: 5 }]);
  });

  it('works on lines in any order, and does not change its input', () => {
    const items = [
      ...monthly('GYM CLUB # NY', 9.99, 5, range(1, 4)),
      ...monthly('NETFLIX.COM # CA', 17.99, 7, range(1, 4)),
      payday('2026-04', 15),
    ];
    const frozen = Object.freeze(items.map((i) => Object.freeze({ ...i })));
    const forward = run(frozen, { classOf: subscriptions, catalogue: CATALOGUE });
    const backward = run([...frozen].reverse(), { classOf: subscriptions, catalogue: CATALOGUE });
    // A fixed permutation of all nine lines (indexes 0 to 8 once each).
    const shuffled = run([5, 0, 8, 2, 7, 4, 1, 6, 3].map((i) => frozen[i]!), { classOf: subscriptions, catalogue: CATALOGUE });
    expect(backward).toEqual(forward);
    expect(shuffled).toEqual(forward);
    expect(items).toEqual(frozen); // the input array and its lines are untouched
    expect(forward.findings).toHaveLength(2);
  });

  it('is deterministic: the same input twice gives deep-equal output', () => {
    const opts = { classOf: subscriptions, catalogue: CATALOGUE } as const;
    expect(detectSubscriptions(statementItemsSample, opts)).toEqual(detectSubscriptions(statementItemsSample, opts));
  });

  it('counts the calendar months with any line, money in included, and takes asOf from the newest line', () => {
    const audit = run([...monthly('GYM CLUB # NY', 9.99, 5, range(1, 3)), payday('2026-04', 15)], { classOf: subscriptions });
    expect(audit.monthsCovered).toBe(4);                              // January to April, April only has pay
    expect(audit.asOf).toEqual({ month: '2026-04', day: 15 });
  });

  it('orders findings by yearly cost, highest first, then by id', () => {
    const audit = run([
      ...monthly('ZED APP', 5, 2, range(1, 3)),                       // 60 a year
      ...monthly('ALPHA APP', 5, 9, range(1, 3)),                     // 60 a year: ties with ZED, so id decides
      ...monthly('BIG APP', 30, 20, range(1, 3)),                     // 360 a year
      ...monthly('MID APP', 12, 14, range(1, 3)),                     // 144 a year
    ], { classOf: subscriptions });
    expect(idsOf(audit)).toEqual(['big-app', 'mid-app', 'alpha-app', 'zed-app']);
    expect(audit.findings.map((f) => f.yearly)).toEqual([360, 144, 60, 60]);
  });

  it('ignores a refund or credit: it neither joins nor subtracts from a series', () => {
    const audit = run([...monthly('GYM CLUB # NY', 9.99, 5, range(1, 3)), item('2026-02', 20, 'GYM CLUB # NY', -9.99)], { classOf: subscriptions });
    expect([only(audit).chargesSeen, only(audit).amount]).toEqual([3, 9.99]);
    expect(run([item('2026-01', 5, 'GYM CLUB # NY', -9.99), item('2026-02', 5, 'GYM CLUB # NY', -9.99)], { classOf: subscriptions }).findings).toEqual([]);
  });

  it('skips lines with no merchant (a label that is only masks)', () => {
    expect(run(monthly('[ref] 1234', 9.99, 5, range(1, 3)), { classOf: subscriptions }).findings).toEqual([]);
  });

  it('reports a steady amount of 50 cents or more and not 49 cents: the floor against card checks', () => {
    const at = (amount: number) => run(monthly('CARD CHECK CO', amount, 5, range(1, 3)), { classOf: subscriptions });
    expect(at(0.49).findings).toEqual([]);
    expect(only(at(0.5))).toMatchObject({ amount: 0.5, monthly: 0.5, yearly: 6 });   // 0.50 × 12
  });
});

// ----- what is a candidate ---------------------------------------------------------------------

describe('detectSubscriptions: the class filter', () => {
  const rent = monthly('OAKWOOD APTS WEB PMTS # WEB ID: #', 1720, 1, range(1, 4));

  it.each(['rentUtilities', 'debtPayments', 'childcare', 'car', 'groceries', 'eatingOut', 'pay', 'transfer'] as const)(
    'never calls a steady %s line a subscription',
    (cls) => {
      expect(run(rent, { classOf: asClass(cls) }).findings).toEqual([]);
    },
  );

  it.each([['subscriptions', 'high'], ['other', 'low']] as const)('looks at lines the categorizer put in %s (confidence %s)', (cls, confidence) => {
    const audit = run(rent, { classOf: asClass(cls) });
    expect(only(audit)).toMatchObject({ id: 'oakwood-apts-web-pmts-web-id', amount: 1720, chargesSeen: 4, confidence });
  });

  it('lets a catalogue match override the class: a known service is a subscription whatever the categorizer said', () => {
    const audit = run(monthly('NETFLIX.COM', 17.99, 7, range(1, 3)), { classOf: asClass('car'), catalogue: CATALOGUE });
    expect(only(audit)).toMatchObject({ serviceId: 'netflix', category: 'video', confidence: 'high' });
  });

  it('treats a label the categorizer did not return a class for as unclassified: catalogue only, medium at most', () => {
    const items = [...monthly('NETFLIX.COM', 17.99, 7, range(1, 3)), ...monthly('GYM CLUB # NY', 9.99, 5, range(1, 3))];
    const audit = run(items, { classOf: () => undefined, catalogue: CATALOGUE });
    expect(idsOf(audit)).toEqual(['netflix-com']);
    expect(only(audit).confidence).toBe('medium');                    // three charges would be `high` with a known class
  });
});

describe('detectSubscriptions: strict mode (no classOf)', () => {
  it('applies the catalogue only, and no finding is above medium', () => {
    const audit = run(statementItemsSample, { catalogue: CATALOGUE });
    expect(idsOf(audit)).toEqual([
      'planet-fitness-club-fees', 'netflix-com-ca', 'spotify-usa-ny', 'amazon-prime-amzn-com-bill-wa', 'apple-com-bill-ca',
    ]);
    expect(audit.findings.map((f) => f.confidence)).toEqual(['medium', 'medium', 'medium', 'medium', 'medium']);
    // The same five as the golden audit: 57.96 + 139 ÷ 12 = 69.54 a month; 695.52 + 139 = 834.52 a year.
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([69.54, 834.52]);
  });

  it('finds nothing without a catalogue either, but still reports the statement it read', () => {
    const audit = run(statementItemsSample);
    expect(audit).toEqual({ findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 5, asOf: { month: '2026-11', day: 12 } });
  });

  it('never lifts a pattern with two charges above low, strict or not', () => {
    const items = monthly('NEW GYM # NY', 20, 3, range(1, 2));
    expect(only(run(items, { classOf: subscriptions })).confidence).toBe('low');
    expect(run(items).findings).toEqual([]);                           // strict: an unknown merchant is not a candidate
  });
});

// ----- the monthly series ----------------------------------------------------------------------

describe('detectSubscriptions: confidence', () => {
  it('is high with three charges, high with two and a catalogue match, medium with one and a match, low with two and none', () => {
    const three = monthly('GYM CLUB # NY', 9.99, 5, range(1, 3));
    const twoKnown = monthly('NETFLIX.COM', 17.99, 7, range(1, 2));
    const oneKnown = [item('2026-02', 1, 'PLANET FITNESS CLUB FEES', 24.99)];
    const twoUnknown = monthly('NEW GYM # NY', 20, 3, range(1, 2));
    const audit = run([...three, ...twoKnown, ...oneKnown, ...twoUnknown], { classOf: subscriptions, catalogue: CATALOGUE });
    expect(Object.fromEntries(audit.findings.map((f) => [f.id, f.confidence]))).toEqual({
      'gym-club-ny': 'high', 'netflix-com': 'high', 'planet-fitness-club-fees': 'medium', 'new-gym-ny': 'low',
    });
  });

  it('finds no pattern in one charge of an unknown merchant', () => {
    expect(run([item('2026-01', 5, 'GYM CLUB # NY', 9.99)], { classOf: subscriptions }).findings).toEqual([]);
  });

  it('does not let an ambiguous catalogue entry (Apple) raise a pattern: two charges stay low, three are high', () => {
    const two = run(monthly('APPLE.COM/BILL # CA', 2.99, 3, range(1, 2)), { classOf: subscriptions, catalogue: CATALOGUE });
    expect(only(two).confidence).toBe('low');
    const three = run(monthly('APPLE.COM/BILL # CA', 2.99, 3, range(1, 3)), { classOf: subscriptions, catalogue: CATALOGUE });
    expect(only(three).confidence).toBe('high');
  });

  it('keeps the label unchanged and guesses no service id for an ambiguous entry', () => {
    const f = only(run(monthly('APPLE.COM/BILL # CA', 2.99, 3, range(1, 3)), { classOf: subscriptions, catalogue: CATALOGUE }));
    expect(f.serviceId).toBeUndefined();
    expect('serviceId' in f).toBe(false);
    expect([f.label, f.category]).toEqual(['APPLE.COM/BILL # CA', 'other']);
  });

  it('reads one charge of an ambiguous merchant as nothing: it could be any product', () => {
    expect(run([item('2026-01', 3, 'APPLE.COM/BILL # CA', 2.99)], { classOf: subscriptions, catalogue: CATALOGUE }).findings).toEqual([]);
  });

  it('treats a label that matches two catalogue entries as unrecognised (no guess), still found by its pattern', () => {
    const twins = [
      service('twin-a', 'Twin A', 'video', ['SHARED NAME'], [[9.99, 'monthly']]),
      service('twin-b', 'Twin B', 'music', ['SHARED NAME'], [[9.99, 'monthly']]),
    ];
    const items = monthly('SHARED NAME # NY', 9.99, 5, range(1, 3));
    const audit = run(items, { classOf: subscriptions, catalogue: twins });
    expect([only(audit).serviceId, only(audit).category]).toEqual([undefined, 'other']);
    expect(run(items, { catalogue: twins }).findings).toEqual([]);      // strict mode: no match, so no candidate
  });
});

describe('detectSubscriptions: missed months and gaps', () => {
  it('allows one missed month between charges: January, February and April are one series', () => {
    const audit = run(monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-02', '2026-04']), { classOf: subscriptions });
    expect([only(audit).chargesSeen, only(audit).cadence, only(audit).lastCharge]).toEqual([3, 'monthly', { month: '2026-04', day: 5 }]);
    expect(only(audit).nextExpected).toEqual({ month: '2026-05', day: 5 });
  });

  it('ends the series at two missed months in a row: January and February remain, and they are stopped by May', () => {
    const audit = run([...monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-02', '2026-05']), payday('2026-05', 28)], { classOf: subscriptions });
    expect([only(audit).chargesSeen, only(audit).lastCharge, only(audit).status]).toEqual([2, { month: '2026-02', day: 5 }, 'stopped']);
  });

  it('finds a quarterly charge: $30 on the 10th every third month is $10 a month and $120 a year', () => {
    const audit = run(monthly('CITY WATER CO', 30, 10, ['2026-01', '2026-04', '2026-07']), { classOf: subscriptions });
    expect(only(audit)).toMatchObject({
      cadence: 'quarterly', amount: 30, monthly: 10, yearly: 120, chargesSeen: 3, confidence: 'high', // 30 ÷ 3 = 10; 30 × 4 = 120
      lastCharge: { month: '2026-07', day: 10 }, nextExpected: { month: '2026-10', day: 10 }, status: 'active',
    });
  });

  it('finds a quarterly charge from two charges three months apart, with low confidence for an unknown merchant', () => {
    const audit = run(monthly('CITY WATER CO', 30, 10, ['2026-01', '2026-04']), { classOf: subscriptions });
    expect(only(audit)).toMatchObject({ cadence: 'quarterly', chargesSeen: 2, confidence: 'low' });
  });

  it('finds no series in a charge that comes every other month with no month between (gap of 4 months)', () => {
    expect(run(monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-05']), { classOf: subscriptions }).findings).toEqual([]);
  });

  it('does not read a two-month cycle as a monthly charge with a missed month each time', () => {
    // January, March, May: every gap is 2 months, so no two charges are in adjacent months.
    expect(run(monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-03', '2026-05']), { classOf: subscriptions }).findings).toEqual([]);
    expect(run(monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-03']), { classOf: subscriptions, catalogue: CATALOGUE }).findings).toEqual([]);
    // One adjacent pair is enough: January, February, April.
    expect(only(run(monthly('GYM CLUB # NY', 9.99, 5, ['2026-01', '2026-02', '2026-04']), { classOf: subscriptions })).chargesSeen).toBe(3);
  });

  it('keeps an audit within the contract cap of 500 findings, the costliest first', () => {
    const letters = (i: number) => String.fromCharCode(65 + (i % 26), 65 + (Math.floor(i / 26) % 26), 65 + Math.floor(i / 676));
    const items = Array.from({ length: 600 }, (_, i) => monthly(`SHOP ${letters(i)}`, 5 + (i % 50), 1 + (i % 20), range(1, 3))).flat();
    const audit = run(items, { classOf: subscriptions });
    expect(audit.findings).toHaveLength(500);
    expect(audit.findings.map((f) => f.yearly)).toEqual([...audit.findings.map((f) => f.yearly)].sort((a, b) => b - a));
  });

  it('finds nothing in weekly charges: four a month is not a monthly subscription', () => {
    const weekly = range(1, 3).flatMap((m) => [1, 8, 15, 22].map((d) => item(m, d, 'GYM CLUB # NY', 9.99)));
    expect(run(weekly, { classOf: subscriptions }).findings).toEqual([]);
  });

  it('finds nothing in a merchant visited often with no steady amount (coffee on a card)', () => {
    const cafe = [
      item('2026-01', 3, 'CORNER CAFE # NY', 5.25), item('2026-01', 9, 'CORNER CAFE # NY', 8.4),
      item('2026-02', 4, 'CORNER CAFE # NY', 6.75), item('2026-02', 15, 'CORNER CAFE # NY', 12.1),
      item('2026-03', 20, 'CORNER CAFE # NY', 9.5), item('2026-03', 26, 'CORNER CAFE # NY', 11.2),
    ];
    expect(run(cafe, { classOf: asClass('other') }).findings).toEqual([]);
  });

  it('does not read a one-off larger charge on another day as part of a series', () => {
    const items = [...monthly('GYM CLUB # NY', 9.99, 5, range(1, 3)), item('2026-02', 22, 'GYM CLUB # NY', 240)];
    expect(only(run(items, { classOf: subscriptions })).chargesSeen).toBe(3);
  });
});

describe('detectSubscriptions: the day of the month', () => {
  it('accepts a charge up to 3 days from the usual day and drops one 4 days away', () => {
    // Days 5, 5 and 8: the median is 5 and 8 is exactly 3 away, so all three count.
    expect(only(run([item('2026-01', 5, 'GYM CLUB # NY', 9.99), item('2026-02', 5, 'GYM CLUB # NY', 9.99), item('2026-03', 8, 'GYM CLUB # NY', 9.99)], { classOf: subscriptions })).chargesSeen).toBe(3);
    // Days 5, 5 and 9: 9 is 4 away; the March charge is left out, so two remain (and March is now a missed month).
    const four = run([item('2026-01', 5, 'GYM CLUB # NY', 9.99), item('2026-02', 5, 'GYM CLUB # NY', 9.99), item('2026-03', 9, 'GYM CLUB # NY', 9.99)], { classOf: subscriptions });
    expect([only(four).chargesSeen, only(four).lastCharge]).toEqual([2, { month: '2026-02', day: 5 }]);
  });

  it('leaves out a charge that drifts from the usual day and keeps the series: a retry on the 12th does not break it', () => {
    const items = [
      item('2026-01', 5, 'GYM CLUB # NY', 9.99), item('2026-02', 5, 'GYM CLUB # NY', 9.99), item('2026-03', 12, 'GYM CLUB # NY', 9.99),
      item('2026-04', 5, 'GYM CLUB # NY', 9.99), item('2026-05', 5, 'GYM CLUB # NY', 9.99),
    ];
    const f = only(run(items, { classOf: subscriptions }));
    expect([f.chargesSeen, f.lastCharge, f.nextExpected]).toEqual([4, { month: '2026-05', day: 5 }, { month: '2026-06', day: 5 }]);
  });

  it('follows a charge on the 31st through February, a 30-day month and a leap year, clamping the next date to the month', () => {
    // 31 Jan, 28 Feb, 31 Mar, 30 Apr, 31 May 2027: the usual day is 31 (the median), clamped to each month.
    const may = only(run([['2027-01', 31], ['2027-02', 28], ['2027-03', 31], ['2027-04', 30], ['2027-05', 31]].map(([m, d]) => item(m as string, d as number, 'CLOUD BOX', 12)), { classOf: subscriptions }));
    expect([may.chargesSeen, may.confidence, may.nextExpected]).toEqual([5, 'high', { month: '2027-06', day: 30 }]); // June has 30 days
    const march = only(run([['2027-01', 31], ['2027-02', 28], ['2027-03', 31]].map(([m, d]) => item(m as string, d as number, 'CLOUD BOX', 12)), { classOf: subscriptions }));
    expect(march.nextExpected).toEqual({ month: '2027-04', day: 30 });
    // 2028 is a leap year: 29 Feb is the 31st clamped, and the next date after 31 Dec 2027 + 31 Jan 2028 is 29 Feb.
    const leap = only(run([['2028-01', 31], ['2028-02', 29], ['2028-03', 31]].map(([m, d]) => item(m as string, d as number, 'CLOUD BOX', 12)), { classOf: subscriptions }));
    expect([leap.chargesSeen, leap.nextExpected]).toEqual([3, { month: '2028-04', day: 30 }]);
    const toLeapFeb = only(run([item('2027-12', 31, 'CLOUD BOX', 12), item('2028-01', 31, 'CLOUD BOX', 12)], { classOf: subscriptions }));
    expect(toLeapFeb.nextExpected).toEqual({ month: '2028-02', day: 29 });
    const toPlainFeb = only(run([item('2026-12', 31, 'CLOUD BOX', 12), item('2027-01', 31, 'CLOUD BOX', 12)], { classOf: subscriptions }));
    expect(toPlainFeb.nextExpected).toEqual({ month: '2027-02', day: 28 });
  });

  it('follows a charge on the 29th and the 30th through February', () => {
    const on30 = only(run([['2028-01', 30], ['2028-02', 29], ['2028-03', 30]].map(([m, d]) => item(m as string, d as number, 'CLOUD BOX', 12)), { classOf: subscriptions }));
    expect([on30.chargesSeen, on30.nextExpected]).toEqual([3, { month: '2028-04', day: 30 }]);
    const on29 = only(run([['2027-01', 29], ['2027-02', 28], ['2027-03', 29]].map(([m, d]) => item(m as string, d as number, 'CLOUD BOX', 12)), { classOf: subscriptions }));
    expect([on29.chargesSeen, on29.nextExpected]).toEqual([3, { month: '2027-04', day: 29 }]);
  });

  it('reads a statement that starts mid-month: the partial first month counts as a month', () => {
    const items = [item('2026-01', 20, 'NETFLIX.COM', 17.99), ...monthly('NETFLIX.COM', 17.99, 20, range(2, 3)), item('2026-01', 28, 'ACME LOGISTICS INC PAYROLL PPD ID: #', -2000)];
    const audit = run(items, { classOf: subscriptions, catalogue: CATALOGUE });
    expect([only(audit).chargesSeen, audit.monthsCovered]).toEqual([3, 3]);
  });
});

// ----- the next date and stopped ---------------------------------------------------------------

describe('detectSubscriptions: status and next date', () => {
  const gym = (months: readonly string[], day: number) => monthly('GYM CLUB # NY', 9.99, day, months);

  it('is stopped when the last charge is 3 months older than the newest line, with no next date and no place in the totals', () => {
    const audit = run([...gym(range(1, 3), 5), payday('2026-06', 2)], { classOf: subscriptions });
    expect(only(audit)).toMatchObject({ status: 'stopped', nextExpected: null, chargesSeen: 3, lastCharge: { month: '2026-03', day: 5 } });
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([0, 0]);
  });

  it('stops after 1.5 billing periods: 46 days old is stopped, 45 days is still active', () => {
    // 1.5 × 30.4375 = 45.66 days. 17 April to 2 June: 13 + 31 + 2 = 46 days.
    expect(only(run([...gym(range(2, 4), 17), payday('2026-06', 2)], { classOf: subscriptions })).status).toBe('stopped');
    // 18 April to 2 June: 12 + 31 + 2 = 45 days.
    const active = only(run([...gym(range(2, 4), 18), payday('2026-06', 2)], { classOf: subscriptions }));
    expect([active.status, active.nextExpected]).toEqual(['active', { month: '2026-05', day: 18 }]);
  });

  it('projects the next charge one period on: monthly +1, quarterly +3, yearly +12', () => {
    expect(only(run(gym(range(1, 3), 5), { classOf: subscriptions })).nextExpected).toEqual({ month: '2026-04', day: 5 });
    expect(only(run(gym(['2025-11', '2026-02', '2026-05'], 5), { classOf: subscriptions })).nextExpected).toEqual({ month: '2026-08', day: 5 });
    const prime = only(run([item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139), payday('2026-11', 12)], { catalogue: CATALOGUE }));
    expect(prime.nextExpected).toEqual({ month: '2027-08', day: 9 });
  });

  it('rolls December into January', () => {
    expect(only(run(gym(['2026-10', '2026-11', '2026-12'], 5), { classOf: subscriptions })).nextExpected).toEqual({ month: '2027-01', day: 5 });
  });
});

// ----- price changes ---------------------------------------------------------------------------

describe('detectSubscriptions: priceUp', () => {
  const streaming = (...amounts: number[]) =>
    amounts.map((amount, i) => item(ym(i + 1), 10, 'STREAMCO # NY', amount));

  it('flags a $15.49 charge that became $17.99 after four charges, and says what it was', () => {
    // 17.99 ÷ 15.49 = 1.161 (at least 1.05) and 17.99 - 15.49 = 2.50 (at least 0.50).
    const f = only(run(streaming(15.49, 15.49, 15.49, 15.49, 17.99), { classOf: subscriptions }));
    expect(f).toMatchObject({
      flags: ['priceUp'], previousAmount: 15.49, amount: 17.99, monthly: 17.99, yearly: 215.88, // 17.99 × 12
      chargesSeen: 5, confidence: 'high', status: 'active',
    });
  });

  it('flags the first rise even when the new price has been charged only once, but only after a steady old price (2 or more charges)', () => {
    expect(only(run(streaming(15.49, 15.49, 17.99), { classOf: subscriptions })).flags).toEqual(['priceUp']);
    // One old charge is not a steady amount: the $15.49 is left out and the series is the two $17.99 charges.
    const f = only(run(streaming(15.49, 17.99, 17.99), { classOf: subscriptions }));
    expect([f.flags, f.chargesSeen, f.previousAmount]).toEqual([[], 2, undefined]);
  });

  it('flags a rise of exactly 5% and 50 cents, and not one a cent short of 5%', () => {
    // 10.00 → 10.50: ratio 1.05 and +0.50, both at the limit. 10.00 → 10.49: ratio 1.049.
    expect(only(run(streaming(10, 10, 10.5), { classOf: subscriptions })).flags).toEqual(['priceUp']);
    const short = only(run(streaming(10, 10, 10.49), { classOf: subscriptions }));
    expect([short.flags, short.amount, short.chargesSeen]).toEqual([[], 10.49, 3]);     // still one series at the new price
  });

  it('does not flag a rise under 50 cents, however large in percent: $4.00 to $4.30 is 7.5% but 30 cents', () => {
    const f = only(run(streaming(4, 4, 4, 4.3), { classOf: subscriptions }));
    expect([f.flags, f.amount, f.chargesSeen]).toEqual([[], 4.3, 4]);
  });

  it('treats a charge within 3% as the same price: $15.49 then $15.79 (1.9%) is one steady amount of $15.49', () => {
    const f = only(run(streaming(15.49, 15.49, 15.49, 15.79), { classOf: subscriptions }));
    expect([f.flags, f.amount, f.chargesSeen]).toEqual([[], 15.49, 4]);                // the median of 1549, 1549, 1549, 1579
  });

  it('does not read a charge more than twice the usual as a price rise: a $59 annual fee on the billing day is left out', () => {
    // 59.00 ÷ 24.99 = 2.36, over the cap of 2: a different charge. The monthly series is the four $24.99 charges.
    const items = [...monthly('GYM CLUB # NY', 24.99, 10, range(1, 4)), item('2026-05', 10, 'GYM CLUB # NY', 59)];
    const f = only(run(items, { classOf: subscriptions }));
    expect([f.flags, f.amount, f.chargesSeen, f.lastCharge]).toEqual([[], 24.99, 4, { month: '2026-04', day: 10 }]);
  });

  it('keeps a price drop in the series without a flag: $17.99 three times, then $15.49', () => {
    const f = only(run(streaming(17.99, 17.99, 17.99, 15.49), { classOf: subscriptions }));
    expect([f.flags, f.amount, f.chargesSeen, f.monthly]).toEqual([[], 15.49, 4, 15.49]);
  });

  it('works for a quarterly charge too: $30 twice, then $33', () => {
    // 33 ÷ 30 = 1.10 and +3.00.
    const items = ['2026-01', '2026-04', '2026-07'].map((m, i) => item(m, 10, 'CITY WATER CO', i < 2 ? 30 : 33));
    const f = only(run(items, { classOf: subscriptions }));
    expect([f.cadence, f.flags, f.previousAmount, f.amount, f.monthly, f.yearly]).toEqual(['quarterly', ['priceUp'], 30, 33, 11, 132]); // 33 ÷ 3; 33 × 4
  });
});

describe('detectSubscriptions: introEnded', () => {
  const trial = (...amounts: number[]) => amounts.map((amount, i) => item(ym(i + 1), 8, 'TRIAL TV # NY', amount));

  it('flags a $0.99 first charge followed by $9.99', () => {
    // 0.99 ÷ 9.99 = 0.099, at most 0.5.
    const f = only(run(trial(0.99, 9.99, 9.99, 9.99), { classOf: subscriptions }));
    expect(f).toMatchObject({ flags: ['introEnded'], amount: 9.99, chargesSeen: 4, yearly: 119.88, confidence: 'high' });
    expect(f.previousAmount).toBeUndefined();
  });

  it('needs the full price to have been charged twice: one intro charge and one bigger charge is not yet a pattern', () => {
    // Two charges of different amounts on the same day look just like a shop visited every month (the sample
    // statement's Target: $22.55 on 27 Aug, $63.53 on 27 Sep), so the new amount must repeat before it is called steady.
    expect(run(trial(0.99, 9.99), { classOf: subscriptions }).findings).toEqual([]);
    const shop = [item('2026-08', 27, 'TARGET # DALLAS TX', 22.55), item('2026-09', 27, 'TARGET # DALLAS TX', 63.53)];
    expect(run(shop, { classOf: asClass('other') }).findings).toEqual([]);
    const f = only(run(trial(0.99, 9.99, 9.99), { classOf: subscriptions }));
    expect([f.flags, f.chargesSeen, f.confidence]).toEqual([['introEnded'], 3, 'high']);
  });

  it('allows two intro charges, and not three: a longer run at the low price is the price', () => {
    const two = only(run(trial(0.99, 0.99, 9.99, 9.99), { classOf: subscriptions }));
    expect([two.flags, two.chargesSeen]).toEqual([['introEnded'], 4]);
    // Three at $0.99 is a series of its own (stopped by May), and the $9.99 charges another, neither flagged: two findings
    // from one merchant, told apart by amount in cents. 9.99 × 12 = 119.88 sorts before 0.99 × 12 = 11.88.
    const three = run(trial(0.99, 0.99, 0.99, 9.99, 9.99), { classOf: subscriptions });
    expect(three.findings.map((f) => [f.id, f.flags, f.amount, f.chargesSeen, f.status])).toEqual([
      ['trial-tv-ny-999', [], 9.99, 2, 'active'],
      ['trial-tv-ny-99', [], 0.99, 3, 'stopped'],
    ]);
  });

  it('flags an intro of exactly half the price and not a cent over', () => {
    expect(only(run(trial(5, 10, 10), { classOf: subscriptions })).flags).toEqual(['introEnded']);   // 5.00 = 0.5 × 10.00
    const over = only(run(trial(5.01, 10, 10), { classOf: subscriptions }));                         // 5.01 > 0.5 × 10.00
    expect([over.flags, over.chargesSeen]).toEqual([[], 2]);                                         // only the two $10.00 charges
  });

  it('can carry both flags: intro, steady, then a rise', () => {
    const f = only(run(trial(0.99, 9.99, 9.99, 11.99), { classOf: subscriptions }));
    expect([f.flags, f.previousAmount, f.amount, f.chargesSeen]).toEqual([['priceUp', 'introEnded'], 9.99, 11.99, 4]);
  });
});

// ----- overlap ---------------------------------------------------------------------------------

describe('detectSubscriptions: overlap', () => {
  const streams = [
    ...monthly('NETFLIX.COM', 17.99, 7, range(1, 6)),
    ...monthly('HULU # CA', 9.99, 12, range(1, 6)),
    ...monthly('HBO MAX', 15.99, 20, range(1, 6)),
  ];

  it('flags three video services, each naming the other two', () => {
    const audit = run(streams, { classOf: subscriptions, catalogue: CATALOGUE });
    expect(byId(audit, 'netflix-com')).toMatchObject({ flags: ['overlap'], overlapsWith: ['hbo-max', 'hulu-ca'] });
    expect(byId(audit, 'hulu-ca')).toMatchObject({ flags: ['overlap'], overlapsWith: ['hbo-max', 'netflix-com'] });
    expect(byId(audit, 'hbo-max')).toMatchObject({ flags: ['overlap'], overlapsWith: ['hulu-ca', 'netflix-com'] });
  });

  it('flags two music services, and not a single one', () => {
    const two = run([...monthly('SPOTIFY USA # NY', 11.99, 12, range(1, 3)), ...monthly('PANDORA', 10.99, 4, range(1, 3))], { classOf: subscriptions, catalogue: CATALOGUE });
    expect(two.findings.map((f) => f.flags)).toEqual([['overlap'], ['overlap']]);
    const one = run(monthly('SPOTIFY USA # NY', 11.99, 12, range(1, 3)), { classOf: subscriptions, catalogue: CATALOGUE });
    expect(only(one).flags).toEqual([]);
  });

  it('does not flag two gyms: fitness is not a category where one replaces the other', () => {
    const audit = run([...monthly('PLANET FITNESS CLUB FEES', 24.99, 1, range(1, 3)), ...monthly('LA FITNESS', 34.99, 9, range(1, 3))], { classOf: subscriptions, catalogue: CATALOGUE });
    expect(audit.findings.map((f) => f.flags)).toEqual([[], []]);
  });

  it('counts only active services: one that stopped does not overlap, and is not named', () => {
    const items = [
      ...monthly('NETFLIX.COM', 17.99, 7, range(1, 6)),
      ...monthly('HBO MAX', 15.99, 20, range(1, 6)),
      ...monthly('HULU # CA', 9.99, 12, range(1, 3)),                  // last charge 12 March, 3 months before the newest line
    ];
    const audit = run(items, { classOf: subscriptions, catalogue: CATALOGUE });
    expect(byId(audit, 'hulu-ca')).toMatchObject({ status: 'stopped', flags: [] });
    expect(byId(audit, 'netflix-com')).toMatchObject({ flags: ['overlap'], overlapsWith: ['hbo-max'] });
  });

  it('does not overlap two unknown merchants: no catalogue, no shared category', () => {
    const audit = run([...monthly('ALPHA APP', 5, 2, range(1, 3)), ...monthly('BETA APP', 6, 9, range(1, 3))], { classOf: subscriptions, catalogue: CATALOGUE });
    expect(audit.findings.map((f) => f.flags)).toEqual([[], []]);
  });
});

// ----- two series from one merchant, long ids --------------------------------------------------

describe('detectSubscriptions: ids and several series from one merchant', () => {
  it('splits two plans billed by one merchant on the same day into two findings, told apart by amount', () => {
    const items = [...monthly('STREAMCO # NY', 15.49, 7, range(1, 4)), ...monthly('STREAMCO # NY', 7.99, 7, range(1, 4))];
    const audit = run(items, { classOf: subscriptions });
    expect(audit.findings.map((f) => [f.id, f.amount, f.chargesSeen, f.yearly])).toEqual([
      ['streamco-ny-1549', 15.49, 4, 185.88],                          // 15.49 × 12
      ['streamco-ny-799', 7.99, 4, 95.88],                             // 7.99 × 12
    ]);
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([23.48, 281.76]);   // 15.49 + 7.99; 185.88 + 95.88
  });

  it('gives ids that fit the contract (100 characters) and stay unique when two long names share a start', () => {
    const base = 'ABCDEFGHIJ '.repeat(11);                             // 121 characters with the spaces
    const items = [...monthly(`${base}ONE`, 10, 5, range(1, 3)), ...monthly(`${base}TWO`, 20, 6, range(1, 3))];
    const audit = run(items, { classOf: subscriptions });
    const ids = idsOf(audit);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(100);
  });

  it('makes the id the merchant key as a lower-case slug', () => {
    expect(idsOf(run(monthly('NETFLIX.COM # CA', 17.99, 7, range(1, 3)), { classOf: subscriptions }))).toEqual(['netflix-com-ca']);
  });
});

// ----- recognised by the catalogue: one charge, one month --------------------------------------

describe('detectSubscriptions: the catalogue and single charges', () => {
  const asOf = payday('2026-11', 12);

  it('finds a yearly plan from one charge: Amazon Prime $139, seen once, medium, next in a year', () => {
    const f = only(run([item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139), asOf], { catalogue: CATALOGUE }));
    expect(f).toMatchObject({
      id: 'amazon-prime-amzn-com-bill-wa', serviceId: 'amazon-prime', category: 'other', cadence: 'yearly',
      amount: 139, monthly: 11.58, yearly: 139,                          // 139 ÷ 12 = 11.5833…
      chargesSeen: 1, flags: ['seenOnce'], confidence: 'medium', status: 'active', isEstimate: false,
      lastCharge: { month: '2026-08', day: 9 }, nextExpected: { month: '2027-08', day: 9 },
    });
  });

  it('is absent without the catalogue', () => {
    expect(run([item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139), asOf], { classOf: subscriptions }).findings).toEqual([]);
  });

  it('recognises a yearly plan whose price rose a little (7%), and reports the charge, not the plan price', () => {
    const f = only(run([item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 149), asOf], { catalogue: CATALOGUE }));
    expect([f.amount, f.monthly, f.yearly, f.flags]).toEqual([149, 12.42, 149, ['seenOnce']]);          // 149 ÷ 12 = 12.4167…
  });

  it('does not read a charge far from any plan as that plan: Prime at $14.99 is not the $139 yearly plan', () => {
    expect(run([item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 14.99), asOf], { catalogue: CATALOGUE }).findings).toEqual([]);
  });

  it('finds a quarterly plan from one charge: $30 is $10 a month and $120 a year, next in three months', () => {
    const f = only(run([item('2026-11', 15, 'CITY NEWS # NY', 30)], { catalogue: CATALOGUE }));
    expect(f).toMatchObject({
      cadence: 'quarterly', monthly: 10, yearly: 120, flags: ['seenOnce'], confidence: 'medium', category: 'news',
      nextExpected: { month: '2027-02', day: 15 },
    });
  });

  it('counts a yearly charge seen twice, a year apart, as two charges without the seenOnce flag, and high', () => {
    const f = only(run([item('2025-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139), item('2026-08', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139), asOf], { classOf: subscriptions, catalogue: CATALOGUE }));
    expect([f.cadence, f.chargesSeen, f.flags, f.confidence, f.status]).toEqual(['yearly', 2, [], 'high', 'active']);
  });

  it('reads a statement of one month: only catalogue matches, all medium, with the totals worked by hand', () => {
    const items = [
      item('2026-11', 7, 'NETFLIX.COM # CA', 17.99), item('2026-11', 1, 'PLANET FITNESS CLUB FEES', 24.99),
      item('2026-11', 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139),
      item('2026-11', 5, 'GYM CLUB # NY', 9.99),                       // unknown: one charge is no pattern
      item('2026-11', 3, 'APPLE.COM/BILL # CA', 2.99),                 // ambiguous: one charge could be anything
    ];
    const audit = run(items, { classOf: subscriptions, catalogue: CATALOGUE });
    expect(idsOf(audit)).toEqual(['planet-fitness-club-fees', 'netflix-com-ca', 'amazon-prime-amzn-com-bill-wa']);
    expect(audit.findings.map((f) => [f.confidence, f.chargesSeen, f.flags])).toEqual([['medium', 1, []], ['medium', 1, []], ['medium', 1, ['seenOnce']]]);
    // Monthly: 24.99 + 17.99 + 139 ÷ 12 (11.5833…) = 54.5633… → 54.56. Yearly: 299.88 + 215.88 + 139 = 654.76.
    expect([audit.monthlyTotal, audit.yearlyTotal, audit.monthsCovered]).toEqual([54.56, 654.76, 1]);
  });

  it('takes one charge of a service that sells only monthly plans as monthly, at the price charged', () => {
    // The catalogue says $17.99; the statement says $19.99. The service has only monthly plans, so the cadence is not in doubt.
    const f = only(run([item('2026-11', 7, 'NETFLIX.COM # CA', 19.99)], { catalogue: CATALOGUE }));
    expect([f.cadence, f.amount, f.yearly]).toEqual(['monthly', 19.99, 239.88]);      // 19.99 × 12
  });

  it('drops a single charge of a monthly service that is already stopped: no recurrence was seen', () => {
    const audit = run([item('2026-01', 7, 'NETFLIX.COM # CA', 17.99), payday('2026-06', 2)], { catalogue: CATALOGUE });
    expect(audit.findings).toEqual([]);
  });

  it('does not take one charge of a merchant that sells both yearly and monthly plans as monthly unless the price matches', () => {
    const both = [service('mixed', 'Mixed', 'software', ['MIXED SOFT'], [[9.99, 'monthly'], [99, 'yearly']])];
    expect(only(run([item('2026-11', 7, 'MIXED SOFT', 9.99)], { catalogue: both })).cadence).toBe('monthly');
    expect(only(run([item('2026-11', 7, 'MIXED SOFT', 99)], { catalogue: both })).cadence).toBe('yearly');
    expect(run([item('2026-11', 7, 'MIXED SOFT', 40)], { catalogue: both }).findings).toEqual([]);
  });

  it('does not take Amazon marketplace purchases for Prime or anything else', () => {
    const items = [item('2026-07', 18, 'AMAZON MKTPL*[ref] Amzn.com/bill WA', 77.84), item('2026-10', 18, 'AMAZON MKTPL*[ref] Amzn.com/bill WA', 21.77)];
    expect(run(items, { classOf: asClass('other'), catalogue: CATALOGUE }).findings).toEqual([]);
  });
});

// ----- a lone charge of a monthly-only service is bounded by its plan price --------------------
// A service whose plans are all monthly has its lone charge taken as monthly at any price near a
// plan's: within a factor of 2 either way (subsStepMaxRatio), so price/2 <= charge <= price × 2.
// Outside it the charge is a one-off or a prepayment, and nothing is reported or counted.

describe('detectSubscriptions: a lone charge of a monthly-only service stays within 2x of a plan price', () => {
  const asOf = payday('2026-11', 12);
  const lone = (label: string, amount: number, catalogue: readonly KnownService[]) =>
    run([item('2026-11', 7, label, amount), asOf], { catalogue });
  const nothing = (audit: SubscriptionAudit) => [audit.findings, audit.monthlyTotal, audit.yearlyTotal];

  // $10.00: the bound is 10.00 ÷ 2 = 5.00 up to 10.00 × 2 = 20.00, both whole cents.
  const ten = [service('exact', 'Exact Plan', 'software', ['EXACT PLAN'], [[10, 'monthly']])];

  it('takes exactly 2x the plan price: $20.00 on a $10.00 plan, at $240 a year', () => {
    const f = only(lone('EXACT PLAN', 20, ten));
    expect([f.cadence, f.amount, f.yearly, f.chargesSeen]).toEqual(['monthly', 20, 240, 1]);      // 20 × 12
  });

  it('does not take one cent above 2x: $20.01 on a $10.00 plan is no subscription, and nothing is counted', () => {
    expect(nothing(lone('EXACT PLAN', 20.01, ten))).toEqual([[], 0, 0]);
  });

  it('takes exactly half the plan price: $5.00 on a $10.00 plan', () => {
    const f = only(lone('EXACT PLAN', 5, ten));
    expect([f.cadence, f.amount, f.yearly]).toEqual(['monthly', 5, 60]);                         // 5 × 12
  });

  it('does not take one cent below half: $4.99 on a $10.00 plan is no subscription, and nothing is counted', () => {
    expect(nothing(lone('EXACT PLAN', 4.99, ten))).toEqual([[], 0, 0]);
  });

  it('bounds a Netflix-like $17.99 plan at 2 × 17.99 = $35.98: that is taken, $35.99 is not', () => {
    expect(only(lone('NETFLIX.COM # CA', 35.98, CATALOGUE)).amount).toBe(35.98);
    expect(nothing(lone('NETFLIX.COM # CA', 35.99, CATALOGUE))).toEqual([[], 0, 0]);
  });

  it('is near some monthly plan, not the first: plans at $9.99 and $29.99 take $50.00 but not $60.00', () => {
    // $9.99 reaches 4.995 to 19.98; $29.99 reaches 14.995 to 59.98. $50.00 is inside only the second; $60.00 inside neither.
    const tiers = [service('tiers', 'Tiers', 'software', ['TIERS APP'], [[9.99, 'monthly'], [29.99, 'monthly']])];
    expect(only(lone('TIERS APP', 50, tiers)).amount).toBe(50);
    expect(nothing(lone('TIERS APP', 60, tiers))).toEqual([[], 0, 0]);
  });

  it('judges the latest charge when several do not repeat: $17.99 then $299.00 reports nothing', () => {
    const items = [item('2026-09', 3, 'NETFLIX.COM # CA', 17.99), item('2026-11', 20, 'NETFLIX.COM # CA', 299), asOf];
    expect(nothing(run(items, { catalogue: CATALOGUE }))).toEqual([[], 0, 0]);
  });

  it('still reports the latest charge when it is near the plan and an earlier one was not: $299.00 then $17.99', () => {
    const items = [item('2026-09', 3, 'NETFLIX.COM # CA', 299), item('2026-11', 20, 'NETFLIX.COM # CA', 17.99), asOf];
    const f = only(run(items, { catalogue: CATALOGUE }));
    expect([f.amount, f.chargesSeen, f.monthly]).toEqual([17.99, 1, 17.99]);
  });

  describe('with the real catalogue', () => {
    // Plan prices there (monthly only): Microsoft 365 $9.99 (bound 4.995 to 19.98), Adobe $22.99
    // (11.495 to 45.98), Xbox Game Pass $19.99 (9.995 to 39.98).
    it('does not read a $1,299.00 Microsoft Store purchase as Microsoft 365 at $15,588 a year', () => {
      expect(nothing(lone('MICROSOFT*STORE # WA', 1299, knownServices))).toEqual([[], 0, 0]);
    });

    it('does not read a $59.99 Xbox charge as a monthly subscription (above 2 × the plan, whichever Microsoft entry takes it)', () => {
      expect(nothing(lone('MICROSOFT*XBOX', 59.99, knownServices))).toEqual([[], 0, 0]);
      expect(nothing(lone('XBOX GAME PASS', 59.99, knownServices))).toEqual([[], 0, 0]);
    });

    it('does not read a $263.88 Adobe annual prepayment as a monthly charge', () => {
      expect(nothing(lone('ADOBE *CREATIVE CLOUD', 263.88, knownServices))).toEqual([[], 0, 0]);
    });

    it('still finds Microsoft 365 at its plan price: $9.99, $119.88 a year, seen once, medium', () => {
      const f = only(lone('MICROSOFT*STORE # WA', 9.99, knownServices));
      expect(f).toMatchObject({ serviceId: 'microsoft-365', cadence: 'monthly', amount: 9.99, monthly: 9.99, yearly: 119.88, chargesSeen: 1, confidence: 'medium' });  // 9.99 × 12
    });

    it('takes Microsoft 365 up to 2 × $9.99 = $19.98 and not at $19.99', () => {
      expect(only(lone('MICROSOFT*STORE # WA', 19.98, knownServices)).amount).toBe(19.98);
      expect(nothing(lone('MICROSOFT*STORE # WA', 19.99, knownServices))).toEqual([[], 0, 0]);
    });
  });
});

// ----- the sample statement --------------------------------------------------------------------

describe('detectSubscriptions: the sample statement', () => {
  it('finds the five catalogue merchants with the same figures as the M1 golden audit, in strict mode (class per label is the web golden test)', () => {
    const audit = run(statementItemsSample, { catalogue: CATALOGUE });
    expect(audit.findings.map((f) => [f.id, f.amount, f.cadence, f.chargesSeen, f.status])).toEqual([
      ['planet-fitness-club-fees', 24.99, 'monthly', 5, 'active'],
      ['netflix-com-ca', 17.99, 'monthly', 5, 'active'],
      ['spotify-usa-ny', 11.99, 'monthly', 5, 'active'],
      ['amazon-prime-amzn-com-bill-wa', 139, 'yearly', 1, 'active'],
      ['apple-com-bill-ca', 2.99, 'monthly', 5, 'active'],
    ]);
    expect([audit.monthsCovered, audit.asOf]).toEqual([5, { month: '2026-11', day: 12 }]);
  });
});

// ----- auditTotals -----------------------------------------------------------------------------

/** A valid finding to build totals from: monthly, $10, unless overridden. */
function finding(over: Partial<SubscriptionFinding> & { id: string }): SubscriptionFinding {
  const f: SubscriptionFinding = {
    merchantKey: over.id.toUpperCase().replace(/-/g, ' '), label: over.id.toUpperCase(), category: 'other',
    cadence: 'monthly', amount: 10, monthly: 10, yearly: 120, chargesSeen: 3,
    lastCharge: { month: '2026-03', day: 5 }, nextExpected: { month: '2026-04', day: 5 },
    status: 'active', flags: [], confidence: 'high', origin: 'statement', isEstimate: false, ...over,
  };
  expect(SubscriptionFindingSchema.safeParse(f).success, JSON.stringify(f)).toBe(true);
  return f;
}

describe('auditTotals', () => {
  it('adds the active findings of high or medium confidence', () => {
    const totals = auditTotals([
      finding({ id: 'a', amount: 10, monthly: 10, yearly: 120 }),
      finding({ id: 'b', amount: 5.5, monthly: 5.5, yearly: 66, confidence: 'medium' }),
    ]);
    expect(totals).toEqual({ monthlyTotal: 15.5, yearlyTotal: 186 });   // 10 + 5.50; 120 + 66
  });

  it('leaves out a low-confidence finding until its id is confirmed', () => {
    const findings = [finding({ id: 'a' }), finding({ id: 'new-gym', amount: 20, monthly: 20, yearly: 240, confidence: 'low' })];
    expect(auditTotals(findings)).toEqual({ monthlyTotal: 10, yearlyTotal: 120 });
    expect(auditTotals(findings, new Set(['other-id']))).toEqual({ monthlyTotal: 10, yearlyTotal: 120 });
    expect(auditTotals(findings, new Set(['new-gym']))).toEqual({ monthlyTotal: 30, yearlyTotal: 360 });  // 10 + 20; 120 + 240
  });

  it('never counts a stopped finding, confirmed or not', () => {
    const stopped = finding({ id: 'old', status: 'stopped', nextExpected: null, confidence: 'low' });
    expect(auditTotals([stopped], new Set(['old']))).toEqual({ monthlyTotal: 0, yearlyTotal: 0 });
    expect(auditTotals([finding({ id: 'old2', status: 'stopped', nextExpected: null })])).toEqual({ monthlyTotal: 0, yearlyTotal: 0 });
  });

  it('normalizes a quarterly and a yearly charge, and rounds once at the end', () => {
    // Three quarterly $10 charges: 10 ÷ 3 = 3.3333… each. Rounding each to 3.33 would give 9.99; one rounding of 10.000 gives 10.
    const q = (id: string) => finding({ id, cadence: 'quarterly', amount: 10, monthly: 3.33, yearly: 40 });
    expect(auditTotals([q('a'), q('b'), q('c')])).toEqual({ monthlyTotal: 10, yearlyTotal: 120 });
    // A yearly $139 and a monthly $24.99: (139 ÷ 12) + 24.99 = 36.5733… → 36.57; 139 + 299.88 = 438.88.
    const totals = auditTotals([
      finding({ id: 'y', cadence: 'yearly', amount: 139, monthly: 11.58, yearly: 139, chargesSeen: 1, flags: ['seenOnce'], confidence: 'medium' }),
      finding({ id: 'm', amount: 24.99, monthly: 24.99, yearly: 299.88 }),
    ]);
    expect(totals).toEqual({ monthlyTotal: 36.57, yearlyTotal: 438.88 });
  });

  it('counts a confirmed low-confidence finding in the audit the detector returns', () => {
    const items = [...monthly('NETFLIX.COM', 17.99, 7, range(1, 3)), ...monthly('WIDGET CLUB', 20, 3, range(1, 2))];
    const opts = { classOf: subscriptions, catalogue: CATALOGUE } as const;
    const plain = run(items, opts);
    expect(byId(plain, 'widget-club').confidence).toBe('low');
    expect([plain.monthlyTotal, plain.yearlyTotal]).toEqual([17.99, 215.88]);      // Netflix only; 17.99 × 12 = 215.88
    const confirmed = run(items, { ...opts, confirmed: new Set(['widget-club']) });
    expect([confirmed.monthlyTotal, confirmed.yearlyTotal]).toEqual([37.99, 455.88]); // + 20; + 240
    expect(confirmed.findings).toEqual(plain.findings);                            // confirming changes the totals, not the findings
  });

  it('is zero for no findings', () => {
    expect(auditTotals([])).toEqual({ monthlyTotal: 0, yearlyTotal: 0 });
  });
});

// ----- review round 1 --------------------------------------------------------------------------

describe('review 1: a doubled line in a month', () => {
  it('keeps the series: $9.99 on the 5th from January to May with a second $9.99 on 5 February', () => {
    const items = [...monthly('GYM CLUB # NY', 9.99, 5, range(1, 5)), item('2026-02', 5, 'GYM CLUB # NY', 9.99)];
    const f = only(run(items, { classOf: subscriptions }));
    expect([f.chargesSeen, f.amount, f.confidence]).toEqual([5, 9.99, 'high']);       // the two February lines count as one month
  });

  it('keeps a known service too: Netflix with a second charge on 7 March', () => {
    const items = [...monthly('NETFLIX.COM', 17.99, 7, range(1, 5)), item('2026-03', 7, 'NETFLIX.COM', 17.99)];
    const f = only(run(items, { classOf: subscriptions, catalogue: CATALOGUE }));
    expect([f.serviceId, f.chargesSeen, f.confidence]).toEqual(['netflix', 5, 'high']);
  });

  it('keeps the line nearest the usual day of the month', () => {
    // March has the usual 5th and a second charge on the 7th (within the window): the 5th is the March charge.
    const items = [...monthly('GYM CLUB # NY', 9.99, 5, range(1, 3)), item('2026-03', 7, 'GYM CLUB # NY', 9.99)];
    const f = only(run(items, { classOf: subscriptions }));
    expect([f.chargesSeen, f.lastCharge, f.nextExpected]).toEqual([3, { month: '2026-03', day: 5 }, { month: '2026-04', day: 5 }]);
  });

  it('rejects a charge repeated in most months, and keeps one repeated in half of them or fewer', () => {
    const twice = (months: string[]) => months.flatMap((m) => [item(m, 5, 'GYM CLUB # NY', 9.99), item(m, 5, 'GYM CLUB # NY', 9.99)]);
    const once = (months: string[]) => months.map((m) => item(m, 5, 'GYM CLUB # NY', 9.99));
    // Four months, two of them doubled: exactly half, not most.
    expect(only(run([...twice(['2026-01', '2026-02']), ...once(['2026-03', '2026-04'])], { classOf: subscriptions })).chargesSeen).toBe(4);
    // Four months, three doubled: most.
    expect(run([...twice(['2026-01', '2026-02', '2026-03']), ...once(['2026-04'])], { classOf: subscriptions }).findings).toEqual([]);
    // Two identical plans billed together every month are not one series either.
    expect(run(twice(range(1, 3)), { classOf: subscriptions }).findings).toEqual([]);
  });
});

describe('review 1: a known service whose charges do not form a series', () => {
  const opts = { classOf: subscriptions, catalogue: CATALOGUE } as const;

  it('reports the latest charge as medium: Netflix $15.49 in October, then $17.99 in November', () => {
    // The old amount was charged once, and the issue's price rise needs the old steady amount held for 2 charges,
    // so this is not a series with a flagged step: one catalogue match, one charge, medium.
    const f = only(run([item('2026-10', 7, 'NETFLIX.COM', 15.49), item('2026-11', 7, 'NETFLIX.COM', 17.99)], opts));
    expect(f).toMatchObject({
      serviceId: 'netflix', cadence: 'monthly', amount: 17.99, chargesSeen: 1, confidence: 'medium', flags: [],
      status: 'active', lastCharge: { month: '2026-11', day: 7 }, nextExpected: { month: '2026-12', day: 7 },
    });
  });

  it('reports the latest charge: Netflix on 7 January and 7 March only', () => {
    const f = only(run([item('2026-01', 7, 'NETFLIX.COM', 17.99), item('2026-03', 7, 'NETFLIX.COM', 17.99)], opts));
    expect([f.chargesSeen, f.confidence, f.lastCharge]).toEqual([1, 'medium', { month: '2026-03', day: 7 }]);
  });

  it('reports the latest charge: Netflix on 7 January, 20 February and 7 March', () => {
    const f = only(run([item('2026-01', 7, 'NETFLIX.COM', 17.99), item('2026-02', 20, 'NETFLIX.COM', 17.99), item('2026-03', 7, 'NETFLIX.COM', 17.99)], opts));
    expect([f.chargesSeen, f.confidence, f.lastCharge]).toEqual([1, 'medium', { month: '2026-03', day: 7 }]);
  });

  it('does the same in strict mode, and not for an unknown merchant or an ambiguous one', () => {
    const items = [item('2026-01', 7, 'NETFLIX.COM', 17.99), item('2026-03', 7, 'NETFLIX.COM', 17.99)];
    expect(only(run(items, { catalogue: CATALOGUE })).confidence).toBe('medium');
    expect(run([item('2026-01', 5, 'GYM CLUB # NY', 9.99), item('2026-03', 5, 'GYM CLUB # NY', 9.99)], opts).findings).toEqual([]);
    expect(run([item('2026-01', 3, 'APPLE.COM/BILL # CA', 2.99), item('2026-03', 3, 'APPLE.COM/BILL # CA', 2.99)], opts).findings).toEqual([]);
  });

  it('drops that latest charge when it already looks stopped', () => {
    const items = [item('2026-01', 7, 'NETFLIX.COM', 17.99), item('2026-03', 7, 'NETFLIX.COM', 17.99), payday('2026-06', 2)];
    expect(run(items, opts).findings).toEqual([]);
  });

  it('leaves a real series alone: the fallback is only for a service with no series', () => {
    const f = only(run([...monthly('NETFLIX.COM', 17.99, 7, range(1, 4)), item('2026-02', 20, 'NETFLIX.COM', 50)], opts));
    expect([f.chargesSeen, f.amount]).toEqual([4, 17.99]);
  });
});

describe('review 1: small subscriptions', () => {
  it('finds a $0.99 recurring catalogue service: iCloud on the 4th, five months', () => {
    const icloud = [service('icloud', 'iCloud', 'cloud', ['ICLOUD'], [[0.99, 'monthly']])];
    const f = only(run(monthly('ICLOUD STORAGE', 0.99, 4, range(1, 5)), { classOf: subscriptions, catalogue: icloud }));
    expect([f.serviceId, f.amount, f.monthly, f.yearly, f.chargesSeen, f.confidence]).toEqual(['icloud', 0.99, 0.99, 11.88, 5, 'high']); // 0.99 × 12
  });

  it('finds an unknown $0.99 monthly series', () => {
    const f = only(run(monthly('TINY APP # CA', 0.99, 9, range(1, 4)), { classOf: subscriptions }));
    expect([f.amount, f.yearly, f.chargesSeen, f.confidence]).toEqual([0.99, 11.88, 4, 'high']);
  });
});

describe('review 1: overlap', () => {
  it('never overlaps a service with itself: two Netflix plans billed the same day', () => {
    const items = [...monthly('NETFLIX.COM', 15.49, 7, range(1, 4)), ...monthly('NETFLIX.COM', 7.99, 7, range(1, 4))];
    const audit = run(items, { classOf: subscriptions, catalogue: CATALOGUE });
    expect(audit.findings.map((f) => [f.id, f.serviceId, f.flags, f.overlapsWith])).toEqual([
      ['netflix-com-1549', 'netflix', [], undefined],
      ['netflix-com-799', 'netflix', [], undefined],
    ]);
  });

  it('names only the other services when one of them has two plans', () => {
    const items = [...monthly('NETFLIX.COM', 15.49, 7, range(1, 4)), ...monthly('NETFLIX.COM', 7.99, 7, range(1, 4)), ...monthly('HULU # CA', 9.99, 12, range(1, 4))];
    const audit = run(items, { classOf: subscriptions, catalogue: CATALOGUE });
    expect(byId(audit, 'netflix-com-1549').overlapsWith).toEqual(['hulu-ca']);
    expect(byId(audit, 'netflix-com-799').overlapsWith).toEqual(['hulu-ca']);
    expect(byId(audit, 'hulu-ca').overlapsWith).toEqual(['netflix-com-1549', 'netflix-com-799']);
  });

  it('does not use an ambiguous entry for overlap: no category is guessed for it', () => {
    // An ambiguous merchant (it bills many products) whose catalogue category happens to be video.
    const streaming = [service('bundle', 'Bundle', 'video', ['BUNDLE CO'], [[14.99, 'monthly']], true), ...CATALOGUE];
    const items = [...monthly('BUNDLE CO # NY', 14.99, 3, range(1, 4)), ...monthly('NETFLIX.COM', 17.99, 7, range(1, 4))];
    const audit = run(items, { classOf: subscriptions, catalogue: streaming });
    expect(byId(audit, 'bundle-co-ny')).toMatchObject({ category: 'other', flags: [] });
    expect('serviceId' in byId(audit, 'bundle-co-ny')).toBe(false);
    expect(byId(audit, 'netflix-com')).toMatchObject({ category: 'video', flags: [] });
  });
});

describe('review 1: the catalogue match', () => {
  const spotifyPlans = [
    service('spotify', 'Spotify', 'music', ['SPOTIFY'], [[11.99, 'monthly']]),
    service('spotify-premium', 'Spotify Premium', 'music', ['SPOTIFY PREMIUM'], [[15.99, 'monthly']]),
  ];

  it('prefers the longest matcher: SPOTIFY PREMIUM is the premium plan, not an ambiguous match with SPOTIFY', () => {
    const items = monthly('SPOTIFY PREMIUM', 15.99, 12, range(1, 3));
    expect(only(run(items, { catalogue: spotifyPlans })).serviceId).toBe('spotify-premium');
    expect(only(run(monthly('SPOTIFY USA # NY', 11.99, 12, range(1, 3)), { catalogue: spotifyPlans })).serviceId).toBe('spotify');
  });

  it('still reads two entries whose matchers are the same length as ambiguous: no match', () => {
    const tie = [service('abc', 'Abc', 'video', ['ABC DEF'], [[9.99, 'monthly']]), service('xyz', 'Xyz', 'music', ['XYZ UVW'], [[9.99, 'monthly']])];
    expect(run(monthly('ABC DEF XYZ UVW', 9.99, 5, range(1, 3)), { catalogue: tie }).findings).toEqual([]);   // strict: no match, no candidate
    expect(only(run(monthly('ABC DEF XYZ UVW', 9.99, 5, range(1, 3)), { classOf: subscriptions, catalogue: tie })).serviceId).toBeUndefined();
  });
});

describe('review 1: lines that are not a real calendar day', () => {
  const gym = monthly('GYM CLUB # NY', 9.99, 5, range(1, 3));

  it('ignores 31 February: it neither sets asOf nor counts as a month', () => {
    // The pay line of "31 February" would be the newest line of a February statement; the real newest is the 5th.
    const audit = run([...gym.slice(0, 2), item('2026-02', 31, 'ACME LOGISTICS INC PAYROLL PPD ID: #', -2000)], { classOf: subscriptions });
    expect([audit.asOf, audit.monthsCovered]).toEqual([{ month: '2026-02', day: 5 }, 2]);
    expect(run([item('2026-02', 31, 'ACME LOGISTICS INC PAYROLL PPD ID: #', -2000)])).toEqual({ findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 0, asOf: null });
  });

  it('ignores a charge on 31 April, 29 February of a common year, and a month of 13', () => {
    const extra = [item('2026-04', 31, 'GYM CLUB # NY', 9.99), item('2026-13', 5, 'GYM CLUB # NY', 9.99)];
    const audit = run([...gym, ...extra], { classOf: subscriptions });
    expect([only(audit).chargesSeen, only(audit).lastCharge, audit.asOf, audit.monthsCovered]).toEqual([3, { month: '2026-03', day: 5 }, { month: '2026-03', day: 5 }, 3]);
    expect(run([item('2027-02', 29, 'GYM CLUB # NY', 9.99), payday('2027-02', 28)], { classOf: subscriptions }).asOf).toEqual({ month: '2027-02', day: 28 });
  });

  it('accepts 29 February of a leap year', () => {
    expect(run([item('2028-02', 29, 'ACME LOGISTICS INC PAYROLL PPD ID: #', -2000)]).asOf).toEqual({ month: '2028-02', day: 29 });
  });
});

describe('review 1: boundaries', () => {
  const streamco = (...amounts: number[]) => amounts.map((amount, i) => item(ym(i + 1), 10, 'STREAMCO # NY', amount));

  it('treats a charge exactly 3% above as the same price, and a cent more as a step', () => {
    // 10.00 and 10.00, then 10.30 (cents 1030 = 1000 × 1.03): one steady amount, the median 10.00.
    const same = only(run(streamco(10, 10, 10.3), { classOf: subscriptions }));
    expect([same.amount, same.chargesSeen, same.flags]).toEqual([10, 3, []]);
    // 10.31 is outside: a step to a new amount (1.031 is under the 1.05 of a price rise, so no flag).
    const step = only(run(streamco(10, 10, 10.31), { classOf: subscriptions }));
    expect([step.amount, step.chargesSeen, step.flags]).toEqual([10.31, 3, []]);
  });

  it('keeps a step of exactly 2 times in the series and drops one a cent over', () => {
    const twice = only(run(streamco(10, 10, 20), { classOf: subscriptions }));
    expect([twice.amount, twice.chargesSeen, twice.flags, twice.previousAmount]).toEqual([20, 3, ['priceUp'], 10]);
    const over = only(run(streamco(10, 10, 20.01), { classOf: subscriptions }));
    expect([over.amount, over.chargesSeen, over.flags]).toEqual([10, 2, []]);
  });

  it('chains yearly charges a year apart give or take a month, and not two months off', () => {
    const prime = (...months: string[]) => [...months.map((m) => item(m, 9, 'AMAZON PRIME*[ref] Amzn.com/bill WA', 139)), payday('2026-11', 12)];
    const seen = (months: string[]) => only(run(prime(...months), { classOf: subscriptions, catalogue: CATALOGUE })).chargesSeen;
    expect(seen(['2025-09', '2026-08'])).toBe(2);                     // 11 months
    expect(seen(['2025-08', '2026-08'])).toBe(2);                     // 12
    expect(seen(['2025-07', '2026-08'])).toBe(2);                     // 13
    expect(seen(['2025-10', '2026-08'])).toBe(1);                     // 10
    expect(seen(['2025-06', '2026-08'])).toBe(1);                     // 14
  });

  it('chains quarterly plan charges exactly three months apart, not two or four', () => {
    const news = (...months: string[]) => months.map((m) => item(m, 15, 'CITY NEWS # NY', 30));
    const seen = (months: string[]) => only(run(news(...months), { classOf: subscriptions, catalogue: CATALOGUE })).chargesSeen;
    expect(seen(['2026-01', '2026-04'])).toBe(2);                     // a quarterly series
    expect(seen(['2026-01', '2026-05'])).toBe(1);                     // four months apart: only the latest
    expect(seen(['2026-01', '2026-03'])).toBe(1);                     // two months apart
  });

  it('names its thresholds in the assumptions', () => {
    expect(subscriptionAssumptions.subsMissedPeriodsAllowed.value).toBe(1);
    expect(subscriptionAssumptions.subsMinAdjacentPairs.value).toBe(1);
    expect(subscriptionAssumptions.subsPlanGapSlackMonths.value).toEqual({ yearly: 1, quarterly: 0 });
    expect(subscriptionAssumptions.subsReportStoppedSightings.value).toBe(false);
    expect(subscriptionAssumptions.subsDoubledMonthsMaxShare.value).toBe(0.5);
    expect(subscriptionAssumptions.subsMinAmount.value).toBe(0.5);
  });
});

// ----- decision 2: confidence of a pattern with no catalogue match ----------------------------

describe('decision 2: a pattern with no catalogue match', () => {
  // The issue says a pattern alone is `low` (decision 2) and `high` with 3 or more charges (the confidence rule).
  // Reading: only the categorizer saying `subscriptions` lets 3 charges make a pattern `high`; with class `other`
  // (rent to a person, a transfer, a regular shop) a pattern alone stays `low`, shown to confirm and not counted.
  const zelle = monthly('Zelle to [name]', 200, 1, range(1, 3));
  const landlord = monthly('SUNRISE PROPERTY MGMT', 1500, 1, range(1, 3));
  const streaming = monthly('STREAMLY # CA', 12.99, 14, range(1, 3));

  it('Zelle to [name] $200 on the 1st for 3 months, class other: low, and not in the totals', () => {
    const audit = run(zelle, { classOf: asClass('other') });
    expect(only(audit)).toMatchObject({ id: 'zelle-to', amount: 200, chargesSeen: 3, confidence: 'low', status: 'active' });
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([0, 0]);
    expect(auditTotals(audit.findings)).toEqual({ monthlyTotal: 0, yearlyTotal: 0 });
  });

  it('a property manager $1,500 for 3 months, class other: low, and not in the totals', () => {
    const audit = run(landlord, { classOf: asClass('other') });
    expect([only(audit).confidence, audit.monthlyTotal, audit.yearlyTotal]).toEqual(['low', 0, 0]);
  });

  it('an unknown streaming merchant, class subscriptions, 3 charges: high, and counted', () => {
    const audit = run(streaming, { classOf: subscriptions });
    expect([only(audit).confidence, audit.monthlyTotal, audit.yearlyTotal]).toEqual(['high', 12.99, 155.88]); // 12.99 × 12
  });

  it('class subscriptions with 2 charges is low, and class other stays low however many charges', () => {
    expect(only(run(monthly('STREAMLY # CA', 12.99, 14, range(1, 2)), { classOf: subscriptions })).confidence).toBe('low');
    expect(only(run(monthly('Zelle to [name]', 200, 1, range(1, 12)), { classOf: asClass('other') })).confidence).toBe('low');
  });

  it('counts a low pattern once the user confirms it', () => {
    const audit = run(zelle, { classOf: asClass('other'), confirmed: new Set(['zelle-to']) });
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([200, 2400]);
  });

  it('leaves a catalogue match alone: class other with 3 charges is still high, and so is an ambiguous match', () => {
    const known = run(monthly('NETFLIX.COM', 17.99, 7, range(1, 3)), { classOf: asClass('other'), catalogue: CATALOGUE });
    expect(only(known).confidence).toBe('high');
    const apple = run(monthly('APPLE.COM/BILL # CA', 2.99, 3, range(1, 3)), { classOf: asClass('other'), catalogue: CATALOGUE });
    expect(only(apple).confidence).toBe('high');
  });
});

// ----- housekeeping ----------------------------------------------------------------------------

describe('M3 assumptions', () => {
  it('are in the assumptions list, each flagged as an assumption', () => {
    const ids = Object.keys(subscriptionAssumptions);
    expect(ids).toHaveLength(22);
    for (const id of ids) {
      expect((assumptions as Record<string, { assumption?: boolean }>)[id]?.assumption, id).toBe(true);
    }
  });

  it('keeps the test catalogue valid against the contract', () => {
    for (const s of CATALOGUE) expect(KnownServiceSchema.safeParse(s).success, s.id).toBe(true);
  });
});
