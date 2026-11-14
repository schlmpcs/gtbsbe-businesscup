// M1: the micro-tool fixtures. The sample statement's items are checked against the CSV reader in
// apps/web/src/lib/statement/sampleItems.test.ts (this package cannot import the reader); here the
// fixtures are checked against the schemas and against figures worked out by hand from the CSV.
import { StatementItemSchema, SubscriptionAuditSchema, SubscriptionFindingSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { readStatementSampleCsv } from './node';
import { statementItemsSample, subscriptionsExpected } from './tools';

describe('statementItemsSample', () => {
  it('has one valid item for each of the 170 lines of statement.sample.csv', () => {
    // The header is one line and every other line is a transaction.
    expect(readStatementSampleCsv().trimEnd().split('\n').length - 1).toBe(170);
    expect(statementItemsSample).toHaveLength(170);
    for (const item of statementItemsSample) expect(StatementItemSchema.safeParse(item).success, item.label).toBe(true);
  });

  it('is frozen, so a test cannot change what every other test reads', () => {
    expect(Object.isFrozen(statementItemsSample)).toBe(true);
    expect(Object.isFrozen(statementItemsSample[0])).toBe(true);
  });

  it('shows the five recurring charges as masked labels, with the amounts the CSV has', () => {
    const labelled = (text: string) => statementItemsSample.filter((i) => i.label.includes(text));
    expect(labelled('SPOTIFY').map((i) => i.amount)).toEqual([11.99, 11.99, 11.99, 11.99, 11.99]);
    expect(labelled('NETFLIX').map((i) => i.amount)).toEqual([17.99, 17.99, 17.99, 17.99, 17.99]);
    expect(labelled('APPLE.COM/BILL').map((i) => i.amount)).toEqual([2.99, 2.99, 2.99, 2.99, 2.99]);
    expect(labelled('PLANET FITNESS').map((i) => i.amount)).toEqual([24.99, 24.99, 24.99, 24.99, 24.99]);
    expect(labelled('AMAZON PRIME').map((i) => [i.month, i.day, i.amount])).toEqual([['2026-08', 9, 139]]);
  });
});

describe('subscriptionsExpected (the golden audit of the sample statement)', () => {
  const byId = (id: string) => subscriptionsExpected.findings.find((f) => f.id === id)!;

  it('is a valid audit, and every finding in it is a valid finding', () => {
    expect(SubscriptionAuditSchema.safeParse(subscriptionsExpected).success).toBe(true);
    for (const f of subscriptionsExpected.findings) expect(SubscriptionFindingSchema.safeParse(f).success, f.id).toBe(true);
    expect(Object.isFrozen(subscriptionsExpected)).toBe(true);
  });

  it('finds Spotify, Netflix, Apple and Planet Fitness: monthly, five charges each, active', () => {
    // Charges on the same day of each month from July to November 2026: Spotify on the 12th
    // ($11.99), Netflix the 7th ($17.99), Apple the 3rd ($2.99), Planet Fitness the 1st ($24.99).
    const expected = [
      { id: 'spotify-usa-ny', amount: 11.99, yearly: 143.88, day: 12 },        // 11.99 × 12 = 143.88
      { id: 'netflix-com-ca', amount: 17.99, yearly: 215.88, day: 7 },        // 17.99 × 12 = 215.88
      { id: 'apple-com-bill-ca', amount: 2.99, yearly: 35.88, day: 3 },       // 2.99 × 12 = 35.88
      { id: 'planet-fitness-club-fees', amount: 24.99, yearly: 299.88, day: 1 }, // 24.99 × 12 = 299.88
    ];
    for (const e of expected) {
      const f = byId(e.id);
      expect(f, e.id).toBeDefined();
      expect([f.cadence, f.amount, f.monthly, f.yearly, f.chargesSeen, f.status]).toEqual(['monthly', e.amount, e.amount, e.yearly, 5, 'active']);
      expect(f.lastCharge).toEqual({ month: '2026-11', day: e.day });
      expect(f.nextExpected).toEqual({ month: '2026-12', day: e.day });
      expect([f.confidence, f.origin, f.isEstimate, f.flags]).toEqual(['high', 'statement', false, []]);
    }
  });

  it('finds Amazon Prime once, as a yearly $139 charge in August: medium confidence, next in August 2027', () => {
    const prime = byId('amazon-prime-amzn-com-bill-wa');
    expect(prime).toBeDefined();
    expect([prime.cadence, prime.amount, prime.yearly, prime.chargesSeen, prime.status]).toEqual(['yearly', 139, 139, 1, 'active']);
    expect(prime.monthly).toBe(11.58);                                        // 139 ÷ 12 = 11.5833…, to the cent
    expect(prime.lastCharge).toEqual({ month: '2026-08', day: 9 });
    expect(prime.nextExpected).toEqual({ month: '2027-08', day: 9 });
    expect([prime.flags, prime.confidence, prime.origin, prime.serviceId]).toEqual([['seenOnce'], 'medium', 'statement', 'amazon-prime']);
  });

  it('totals $69.54 a month and $834.52 a year', () => {
    // Monthly: 11.99 + 17.99 + 2.99 + 24.99 = 57.96, plus 139 ÷ 12 = 11.5833…  → 69.5433… → 69.54.
    // Yearly: 57.96 × 12 = 695.52, plus 139 → 834.52. Without the catalogue (no Prime): 57.96 and 695.52.
    expect(subscriptionsExpected.monthlyTotal).toBe(69.54);
    expect(subscriptionsExpected.yearlyTotal).toBe(834.52);
    const withoutPrime = subscriptionsExpected.findings.filter((f) => f.id !== 'amazon-prime-amzn-com-bill-wa');
    expect(withoutPrime).toHaveLength(4);
    expect(withoutPrime.reduce((sum, f) => sum + f.amount, 0)).toBeCloseTo(57.96, 9);
    expect(withoutPrime.reduce((sum, f) => sum + f.yearly, 0)).toBeCloseTo(695.52, 9);
  });

  it('leaves out what is not a subscription: rent, a car loan, a card payment, insurance, pay, utilities, coffee', () => {
    expect(subscriptionsExpected.findings).toHaveLength(5);
    const keys = subscriptionsExpected.findings.map((f) => f.merchantKey).join(' | ');
    for (const notASubscription of ['OAKWOOD', 'TOYOTA', 'CAPITAL ONE', 'PROGRESSIVE', 'PAYROLL', 'TXU', 'ATMOS', 'SPECTRUM', 'STARBUCKS', 'TRANSFER', 'ZELLE']) {
      expect(keys).not.toContain(notASubscription);
    }
  });

  it('is ordered by yearly cost, highest first, and says when and how much of the statement it covers', () => {
    // 299.88 (Planet Fitness), 215.88 (Netflix), 143.88 (Spotify), 139 (Amazon Prime), 35.88 (Apple).
    expect(subscriptionsExpected.findings.map((f) => f.yearly)).toEqual([299.88, 215.88, 143.88, 139, 35.88]);
    expect(subscriptionsExpected.monthsCovered).toBe(5);                      // July to November 2026
    expect(subscriptionsExpected.asOf).toEqual({ month: '2026-11', day: 12 }); // the newest line, Spotify on 12 November
  });

  it('flags nothing but Prime (no price rise, no intro price, no overlap among the services it names)', () => {
    for (const f of subscriptionsExpected.findings) {
      expect(f.flags, f.id).toEqual(f.id === 'amazon-prime-amzn-com-bill-wa' ? ['seenOnce'] : []);
      expect(f.previousAmount, f.id).toBeUndefined();
      expect(f.overlapsWith, f.id).toBeUndefined();
    }
  });

  it('keeps the ambiguous Apple charge without a service id, and names the other four services', () => {
    // Apple bills many products, so the catalogue entry is ambiguous and no service is guessed.
    expect(byId('apple-com-bill-ca').serviceId).toBeUndefined();
    expect(byId('apple-com-bill-ca').category).toBe('other');
    expect([byId('spotify-usa-ny'), byId('netflix-com-ca'), byId('planet-fitness-club-fees'), byId('amazon-prime-amzn-com-bill-wa')]
      .map((f) => [f.serviceId, f.category])).toEqual([['spotify', 'music'], ['netflix', 'video'], ['planet-fitness', 'fitness'], ['amazon-prime', 'other']]);
  });
});
