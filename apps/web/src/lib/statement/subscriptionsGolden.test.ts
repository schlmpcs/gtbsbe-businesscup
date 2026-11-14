// M3: the golden audit of the sample statement, end to end with the real pieces: M1's
// `statementItemsSample`, M4's real catalogue (`knownServices`) and the real per-label classes the
// categorizer route returns (`categorizeStatement` with no client: the keyword rules, so no model is
// called and this is the audit a user gets with no API key). The result must equal M1's
// `subscriptions.expected.json`. It lives in apps/web because the categorizer is server code the
// engine package cannot import. The engine's own tests (packages/engine/subscriptions.test.ts) use
// small catalogues defined inline.
import { knownServices } from '@lifeguessr/data/subscriptions';
import { statementItemsSample, subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { detectSubscriptions } from '@lifeguessr/engine';
import {
  KnownServiceSchema, SubscriptionAuditSchema, type KnownService, type StatementClass, type StatementItem,
} from '@lifeguessr/types';
import { beforeAll, describe, expect, it } from 'vitest';
import { categorizeStatement } from '@/server/statement/categorize';

let classOf: (label: string) => StatementClass | undefined;
let classes: { label: string; class: StatementClass }[];

beforeAll(async () => {
  const result = await categorizeStatement(statementItemsSample, null);
  classes = result.classes ?? [];
  const byLabel = new Map(classes.map((c) => [c.label, c.class]));
  classOf = (label) => byLabel.get(label);
});

describe('detectSubscriptions on the sample statement (real catalogue, real classes)', () => {
  it('has a class for every outgoing label of the statement, so no merchant is left to strict mode', () => {
    const outgoing = new Set(statementItemsSample.filter((i) => i.amount > 0).map((i) => i.label));
    expect(classes.length).toBeGreaterThan(0);
    for (const label of outgoing) expect(classOf(label), label).toBeDefined();
  });

  it('matches the M1 golden audit: five findings, $69.54 a month and $834.52 a year', () => {
    const audit = detectSubscriptions(statementItemsSample, { classOf, catalogue: knownServices });
    expect(SubscriptionAuditSchema.safeParse(audit).success).toBe(true);
    expect(audit).toEqual(subscriptionsExpected);
    // The shape the audit screen relies on: Prime is `other` and `medium`, Apple has no service id.
    const prime = audit.findings.find((f) => f.id === 'amazon-prime-amzn-com-bill-wa')!;
    expect([prime.category, prime.confidence, prime.serviceId, prime.flags]).toEqual(['other', 'medium', 'amazon-prime', ['seenOnce']]);
    const apple = audit.findings.find((f) => f.id === 'apple-com-bill-ca')!;
    expect(apple.serviceId).toBeUndefined();
  });

  it('without the catalogue: Prime is absent and the totals are $57.96 a month and $695.52 a year', () => {
    // 11.99 + 17.99 + 2.99 + 24.99 = 57.96; × 12 = 695.52. Apple stays (the rules call it a subscription), with no service id.
    const audit = detectSubscriptions(statementItemsSample, { classOf });
    expect(audit.findings.map((f) => f.id)).toEqual(['planet-fitness-club-fees', 'netflix-com-ca', 'spotify-usa-ny', 'apple-com-bill-ca']);
    expect(audit.findings.every((f) => f.serviceId === undefined && f.confidence === 'high')).toBe(true);
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([57.96, 695.52]);
  });

  it('does not find rent, the car loan, insurance, the card payment, utilities, pay, savings or coffee', () => {
    const keys = detectSubscriptions(statementItemsSample, { classOf, catalogue: knownServices }).findings.map((f) => f.merchantKey).join(' | ');
    const notSubscriptions = [
      'OAKWOOD', 'TOYOTA', 'PROGRESSIVE', 'CAPITAL ONE', 'PAYROLL', 'TXU', 'ATMOS', 'SPECTRUM', 'STARBUCKS', 'TRANSFER',
      'ZELLE', 'VENMO', 'AMAZON MKTPL', 'CVS', 'TARGET', 'WHATABURGER', 'TACO BELL', 'UBER', 'DOORDASH',
    ];
    for (const name of notSubscriptions) expect(keys, name).not.toContain(name);
  });

  it('in strict mode (no classes) finds the same five, none above medium confidence', () => {
    const audit = detectSubscriptions(statementItemsSample, { catalogue: knownServices });
    expect(audit.findings.map((f) => f.id)).toEqual(subscriptionsExpected.findings.map((f) => f.id));
    expect(audit.findings.map((f) => f.confidence)).toEqual(['medium', 'medium', 'medium', 'medium', 'medium']);
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([69.54, 834.52]);
  });

  it('does not change the sample it reads', () => {
    expect(Object.isFrozen(statementItemsSample)).toBe(true);
    expect(() => detectSubscriptions(statementItemsSample, { classOf, catalogue: knownServices })).not.toThrow();
  });
});

describe('the real catalogue and the detector', () => {
  it('has entries that all parse with the contract schema, and is frozen', () => {
    expect(knownServices.length).toBeGreaterThanOrEqual(60);
    for (const service of knownServices) expect(KnownServiceSchema.safeParse(service).success, service.id).toBe(true);
    expect(Object.isFrozen(knownServices)).toBe(true);
  });

  it('is accepted by detectSubscriptions: it returns a valid audit without touching the frozen catalogue', () => {
    const audit = detectSubscriptions(statementItemsSample, { catalogue: knownServices });
    expect(SubscriptionAuditSchema.safeParse(audit).success).toBe(true);
  });

  it('finds every service from its own matcher and plan price, in strict mode', () => {
    const lines = (service: KnownService): StatementItem[] => {
      const plan = service.plans[0]!;
      const months = plan.cadence === 'monthly' ? ['2026-08', '2026-09', '2026-10'] : ['2026-10'];
      return months.map((month) => ({ month, day: 5, label: service.matchers[0]!, amount: plan.price }));
    };
    for (const service of knownServices) {
      const plan = service.plans[0]!;
      const audit = detectSubscriptions(lines(service), { catalogue: knownServices });
      const found = audit.findings;
      expect(found, service.id).toHaveLength(1);
      const f = found[0]!;
      expect(SubscriptionAuditSchema.safeParse(audit).success, service.id).toBe(true);
      expect([f.cadence, f.amount, f.confidence], service.id).toEqual([plan.cadence, plan.price, 'medium']);
      if (service.ambiguous) {
        // Apple, Google and Amazon bill many products: no service id, no category guessed.
        expect([f.serviceId, f.category], service.id).toEqual([undefined, 'other']);
      } else {
        expect([f.serviceId, f.category], service.id).toEqual([service.id, service.category]);
      }
      if (plan.cadence !== 'monthly') expect(f.flags, service.id).toEqual(['seenOnce']);
    }
  });
});
