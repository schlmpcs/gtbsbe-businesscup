// M3: the golden audit of the sample statement. detectSubscriptions runs on `statementItemsSample`
// with the classes the keyword rules assign to each label (the fallback of /api/statement/categorize,
// so this is the audit a user gets with no API key) and a catalogue that says what the golden audit
// says the real one (M4) must: service ids planet-fitness, netflix, spotify and amazon-prime, and
// Apple as an ambiguous entry. The catalogue is defined here, in the test, not read from M4's data.
// It lives in apps/web because the rules are server code the engine package cannot import.
import { statementItemsSample, subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { detectSubscriptions } from '@lifeguessr/engine';
import { SubscriptionAuditSchema, type KnownService } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { ruleClass } from '@/server/statement/rules';

const entry = (id: string, name: string, category: KnownService['category'], matchers: string[], price: number, ambiguous = false): KnownService => ({
  id, name, category, matchers, ...(ambiguous ? { ambiguous } : {}),
  plans: [{ id: 'default', name, price, cadence: id === 'amazon-prime' ? 'yearly' : 'monthly' }],
  priceYear: 2026, source: { name: 'test catalogue', year: 2026 }, isEstimate: true,
});

const catalogue: readonly KnownService[] = [
  entry('netflix', 'Netflix', 'video', ['NETFLIX', 'NETFLIX COM'], 17.99),
  entry('spotify', 'Spotify', 'music', ['SPOTIFY', 'SPOTIFY USA'], 11.99),
  entry('planet-fitness', 'Planet Fitness', 'fitness', ['PLANET FITNESS', 'PLANET FITNESS CLUB FEES'], 24.99),
  entry('amazon-prime', 'Amazon Prime', 'other', ['AMAZON PRIME'], 139),
  entry('apple', 'Apple', 'other', ['APPLE COM BILL'], 0.99, true),
];

/** The class the keyword rules give a masked label for money out (what M4's `classes` returns on the rules path). */
const classOf = (label: string) => ruleClass(label, 'out').cls;

describe('detectSubscriptions on the sample statement (keyword-rule classes)', () => {
  it('matches the M1 golden audit: five findings, $69.54 a month and $834.52 a year', () => {
    const audit = detectSubscriptions(statementItemsSample, { classOf, catalogue });
    expect(SubscriptionAuditSchema.safeParse(audit).success).toBe(true);
    expect(audit).toEqual(subscriptionsExpected);
  });

  it('without the catalogue: Prime is absent and the totals are $57.96 a month and $695.52 a year', () => {
    // 11.99 + 17.99 + 2.99 + 24.99 = 57.96; × 12 = 695.52. Apple stays (the rules call it a subscription), with no service id.
    const audit = detectSubscriptions(statementItemsSample, { classOf });
    expect(audit.findings.map((f) => f.id)).toEqual(['planet-fitness-club-fees', 'netflix-com-ca', 'spotify-usa-ny', 'apple-com-bill-ca']);
    expect(audit.findings.every((f) => f.serviceId === undefined && f.confidence === 'high')).toBe(true);
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([57.96, 695.52]);
  });

  it('does not find rent, the car loan, insurance, the card payment, utilities, pay, savings or coffee', () => {
    const keys = detectSubscriptions(statementItemsSample, { classOf, catalogue }).findings.map((f) => f.merchantKey).join(' | ');
    const notSubscriptions = [
      'OAKWOOD', 'TOYOTA', 'PROGRESSIVE', 'CAPITAL ONE', 'PAYROLL', 'TXU', 'ATMOS', 'SPECTRUM', 'STARBUCKS', 'TRANSFER',
      'ZELLE', 'VENMO', 'AMAZON MKTPL', 'CVS', 'WHATABURGER', 'TACO BELL', 'UBER', 'DOORDASH',
    ];
    for (const name of notSubscriptions) expect(keys, name).not.toContain(name);
  });

  it('in strict mode (no classes) finds the same five, none above medium confidence', () => {
    const audit = detectSubscriptions(statementItemsSample, { catalogue });
    expect(audit.findings.map((f) => f.id)).toEqual(subscriptionsExpected.findings.map((f) => f.id));
    expect(audit.findings.map((f) => f.confidence)).toEqual(['medium', 'medium', 'medium', 'medium', 'medium']);
    expect([audit.monthlyTotal, audit.yearlyTotal]).toEqual([69.54, 834.52]);
  });

  it('does not change the sample it reads', () => {
    expect(Object.isFrozen(statementItemsSample)).toBe(true);
    expect(() => detectSubscriptions(statementItemsSample, { classOf, catalogue })).not.toThrow();
  });
});
