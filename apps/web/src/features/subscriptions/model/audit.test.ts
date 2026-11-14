import { statementItemsSample, subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { auditTotals, detectSubscriptions } from '@lifeguessr/engine';
import { SubscriptionFindingSchema, type SubscriptionFinding } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { bigCatalogue, ruleClasses, testCatalogue } from '@/test/subscriptions';
import {
  auditFromTicks, CANCEL_MOVE_ID, cancelCandidate, carryMarks, displayNameOf, forgottenIds, isCounted, mergeFindings, missBucketOf,
  missFactor, tickIdOf, tickServices,
} from './audit';

describe('auditFromTicks', () => {
  it('three monthly ticks: $17.99 + $11.99 + $24.99 = $54.97 a month, $659.64 a year', () => {
    // Hand: 17.99 + 11.99 = 29.98; + 24.99 = 54.97. Yearly: 54.97 × 12 = 659.64.
    const audit = auditFromTicks(
      [
        { serviceId: 'netflix', planId: 'standard' },
        { serviceId: 'spotify', planId: 'individual' },
        { serviceId: 'planet-fitness', planId: 'black-card' },
      ],
      testCatalogue,
    );
    expect(audit.monthlyTotal).toBe(54.97);
    expect(audit.yearlyTotal).toBe(659.64);
    expect(audit.findings.map((f) => f.id)).toEqual([tickIdOf('planet-fitness'), tickIdOf('netflix'), tickIdOf('spotify')]); // yearly desc: 299.88, 215.88, 143.88
  });

  it('builds findings that are ticks: nothing charged, nothing seen, an estimate, valid against the contract', () => {
    const { findings } = auditFromTicks([{ serviceId: 'netflix', planId: 'standard' }], testCatalogue);
    expect(findings).toEqual([{
      id: 'tick:netflix', merchantKey: 'NETFLIX', label: 'Netflix', serviceId: 'netflix', category: 'video',
      cadence: 'monthly', amount: 17.99, monthly: 17.99, yearly: 215.88,
      chargesSeen: 0, lastCharge: null, nextExpected: null, status: 'active', flags: [],
      confidence: 'high', origin: 'tickList', isEstimate: true,
    }]);
    for (const f of findings) expect(SubscriptionFindingSchema.safeParse(f).success).toBe(true);
  });

  it('a yearly plan is shown per month: $139 a year is $11.58 a month (139 ÷ 12 = 11.5833…), $139 a year', () => {
    const { findings, monthlyTotal, yearlyTotal } = auditFromTicks([{ serviceId: 'amazon-prime', planId: 'annual' }], testCatalogue);
    expect(findings[0]).toMatchObject({ cadence: 'yearly', amount: 139, monthly: 11.58, yearly: 139 });
    expect([monthlyTotal, yearlyTotal]).toEqual([11.58, 139]);
    expect(SubscriptionFindingSchema.safeParse(findings[0]).success).toBe(true);
  });

  it('a quarterly plan: $30 a quarter is $10 a month and $120 a year', () => {
    const { findings } = auditFromTicks([{ serviceId: 'quarterly-gym', planId: 'quarter' }], testCatalogue);
    expect(findings[0]).toMatchObject({ cadence: 'quarterly', amount: 30, monthly: 10, yearly: 120 });
  });

  it('rounds the total to the cent once, not each service: $17.99 + $139 a year = 17.99 + 11.5833 = $29.57', () => {
    const { monthlyTotal, yearlyTotal } = auditFromTicks(
      [{ serviceId: 'netflix', planId: 'standard' }, { serviceId: 'amazon-prime', planId: 'annual' }],
      testCatalogue,
    );
    expect(monthlyTotal).toBe(29.57);
    expect(yearlyTotal).toBe(354.88); // 215.88 + 139
  });

  it('counts a service once, skips ones the catalogue does not know and plans that do not exist or are free', () => {
    const { findings, monthlyTotal } = auditFromTicks(
      [
        { serviceId: 'netflix', planId: 'standard' },
        { serviceId: 'netflix', planId: 'premium' },        // the same service again: the first tick stays
        { serviceId: 'no-such-service', planId: 'x' },
        { serviceId: 'spotify', planId: 'no-such-plan' },
        { serviceId: 'free-tier', planId: 'free' },         // a free plan costs nothing
      ],
      testCatalogue,
    );
    expect(findings.map((f) => f.id)).toEqual(['tick:netflix']);
    expect(monthlyTotal).toBe(17.99);
  });

  it('no ticks: nothing, totals 0', () => {
    expect(auditFromTicks([], testCatalogue)).toEqual({ findings: [], monthlyTotal: 0, yearlyTotal: 0 });
  });
});

describe('tickServices', () => {
  it('lists unambiguous services with their usable plans and a default plan (the first)', () => {
    const list = tickServices(testCatalogue);
    expect(list.map((t) => t.service.id)).toEqual(['netflix', 'spotify', 'planet-fitness', 'amazon-prime', 'disney-plus', 'quarterly-gym']);
    // Apple is ambiguous; the free-tier service has no plan that costs anything.
    expect(list[0]!.defaultPlan.id).toBe('ads');
    expect(list[3]!.plans.map((p) => p.id)).toEqual(['annual', 'monthly']);
  });

  it('keeps at most 40, in catalogue order', () => {
    const list = tickServices(bigCatalogue(55));
    expect(list).toHaveLength(40);
    expect(list[0]!.service.id).toBe('svc-00');
    expect(list[39]!.service.id).toBe('svc-39');
  });
});

describe('missFactor and missBucketOf (guess ÷ actual)', () => {
  it('is guess ÷ actual', () => {
    expect(missFactor(25, 100)).toBe(0.25);
    expect(missFactor(86, 219)).toBeCloseTo(0.3927, 4); // 86 ÷ 219
    expect(missFactor(0, 40)).toBe(0);
  });

  it('has no factor without a guess, or when the actual total is 0 (the total alone is shown)', () => {
    expect(missFactor(null, 100)).toBeNull();
    expect(missFactor(50, 0)).toBeNull();
    expect(missFactor(0, 0)).toBeNull();
    expect(missBucketOf(null, 100)).toBeNull();
    expect(missBucketOf(50, 0)).toBeNull();
  });

  // Edges of an actual of $100, hand-picked: 0.5 → 50, 0.8 → 80, 1.25 → 125, 2 → 200. Each bucket
  // takes its lower edge: [0, 0.5) [0.5, 0.8) [0.8, 1.25) [1.25, 2) [2, ∞).
  it.each([
    [0, 'under0.5'], [49.99, 'under0.5'],
    [50, '0.5to0.8'], [79.99, '0.5to0.8'],
    [80, '0.8to1.25'], [100, '0.8to1.25'], [124.99, '0.8to1.25'],
    [125, '1.25to2'], [199.99, '1.25to2'],
    [200, 'over2'], [1000, 'over2'],
  ] as const)('a guess of $%s against $100 is %s', (guess, bucket) => {
    expect(missBucketOf(guess, 100)).toBe(bucket);
  });

  it('puts the survey’s own gap, $86 against $219 (0.39), under 0.5', () => {
    expect(missBucketOf(86, 219)).toBe('under0.5');
  });

  it('decides edges in whole cents, not floating point: $5.60 against $7.00 is exactly 0.8', () => {
    expect(5.6 / 7).toBeLessThan(0.8); // 0.7999999999999999: the division alone would pick the lower bucket
    expect(missBucketOf(5.6, 7)).toBe('0.8to1.25');
    expect(missBucketOf(8.75, 7)).toBe('1.25to2'); // 8.75 ÷ 7 = 1.25
    expect(missBucketOf(14, 7)).toBe('over2');
    expect(missBucketOf(3.5, 7)).toBe('0.5to0.8');
  });
});

describe('isCounted', () => {
  const sample = detectSubscriptions(statementItemsSample, { catalogue: testCatalogue, classOf: (label) => ruleClasses(statementItemsSample).find((c) => c.label === label)?.class });

  it('active findings that are not low confidence count; a low one counts once confirmed; stopped never', () => {
    const active = sample.findings[0]!;
    const low: SubscriptionFinding = { ...active, id: 'low-one', confidence: 'low' };
    const stopped: SubscriptionFinding = { ...active, id: 'old-one', status: 'stopped', nextExpected: null };
    expect(isCounted(active, new Set())).toBe(true);
    expect(isCounted(low, new Set())).toBe(false);
    expect(isCounted(low, new Set(['low-one']))).toBe(true);
    expect(isCounted(stopped, new Set(['old-one']))).toBe(false);
  });

  it('agrees with the engine: a finding counts exactly when auditTotals adds it', () => {
    const active = sample.findings[0]!;
    const cases: SubscriptionFinding[] = [
      active,
      { ...active, id: 'a', confidence: 'low' },
      { ...active, id: 'b', confidence: 'medium' },
      { ...active, id: 'c', status: 'stopped', nextExpected: null },
    ];
    const confirmed = new Set(['a']);
    for (const f of cases) expect(isCounted(f, confirmed), f.id).toBe(auditTotals([f], confirmed).monthlyTotal > 0);
  });
});

describe('mergeFindings: the statement wins', () => {
  const statement = detectSubscriptions(statementItemsSample, { catalogue: testCatalogue, classOf: (label) => ruleClasses(statementItemsSample).find((c) => c.label === label)?.class });

  it('a service that is both ticked and found is counted once, as the statement finding (measured)', () => {
    const ticked = auditFromTicks([{ serviceId: 'netflix', planId: 'premium' }, { serviceId: 'disney-plus', planId: 'basic' }], testCatalogue).findings;
    const merged = mergeFindings(statement.findings, ticked);
    expect(merged.filter((f) => f.serviceId === 'netflix')).toHaveLength(1);
    const netflix = merged.find((f) => f.serviceId === 'netflix')!;
    expect(netflix).toMatchObject({ origin: 'statement', isEstimate: false, amount: 17.99 }); // not the $24.99 premium tick
    expect(merged.map((f) => f.id)).toContain('tick:disney-plus');                         // ticked, not in the statement: kept
    expect(merged).toHaveLength(statement.findings.length + 1);
  });

  it('sorts by yearly cost descending, then id, like an audit', () => {
    const ticked = auditFromTicks([{ serviceId: 'disney-plus', planId: 'basic' }], testCatalogue).findings;
    const merged = mergeFindings(statement.findings, ticked);
    const yearly = merged.map((f) => f.yearly);
    expect(yearly).toEqual([...yearly].sort((a, b) => b - a));
  });

  it('keeps a stopped or unconfirmed statement finding’s tick out too (the statement already speaks for that service)', () => {
    const stopped: SubscriptionFinding = { ...statement.findings.find((f) => f.serviceId === 'spotify')!, status: 'stopped', nextExpected: null };
    const ticked = auditFromTicks([{ serviceId: 'spotify', planId: 'individual' }], testCatalogue).findings;
    expect(mergeFindings([stopped], ticked).map((f) => f.id)).toEqual([stopped.id]);
  });
});

describe('forgottenIds', () => {
  const classOf = (label: string) => ruleClasses(statementItemsSample).find((c) => c.label === label)?.class;
  const statement = detectSubscriptions(statementItemsSample, { catalogue: testCatalogue, classOf });
  const ticks = [{ serviceId: 'netflix', planId: 'standard' }, { serviceId: 'spotify', planId: 'individual' }];

  it('found in the statement, not ticked: Planet Fitness, Amazon Prime and Apple (no service id) of the five', () => {
    expect(forgottenIds(statement.findings, ticks, new Set())).toEqual([
      'planet-fitness-club-fees', 'amazon-prime-amzn-com-bill-wa', 'apple-com-bill-ca',
    ]);
  });

  it('nothing is "forgotten" when nothing was ticked: the person never listed anything', () => {
    expect(forgottenIds(statement.findings, [], new Set())).toEqual([]);
  });

  it('a low-confidence finding is not forgotten until it is confirmed; a stopped one never is', () => {
    const [first] = statement.findings;
    const low: SubscriptionFinding = { ...first!, id: 'maybe', serviceId: undefined, confidence: 'low' };
    const stopped: SubscriptionFinding = { ...first!, id: 'gone', serviceId: undefined, status: 'stopped', nextExpected: null };
    expect(forgottenIds([low, stopped], ticks, new Set())).toEqual([]);
    expect(forgottenIds([low, stopped], ticks, new Set(['maybe']))).toEqual(['maybe']);
  });
});

describe('displayNameOf', () => {
  it('is the catalogue name when the service is known, else the label as it is', () => {
    const f = subscriptionsExpected.findings;
    expect(displayNameOf(f[1]!, testCatalogue)).toBe('Netflix');                    // NETFLIX.COM # CA
    expect(displayNameOf(f[4]!, testCatalogue)).toBe('APPLE.COM/BILL # CA');          // ambiguous: no service id
    expect(displayNameOf({ ...f[1]!, serviceId: 'gone-from-catalogue' }, testCatalogue)).toBe('NETFLIX.COM # CA');
  });
});

describe('cancelCandidate', () => {
  it('is a cancelSubscriptions move that lowers subscriptions by the marked amount: $85 − $29.98 = $55.02', () => {
    const profile = cloneProfileDemo();
    expect(profile.spending.subscriptions.value).toBe(85);
    expect(cancelCandidate(profile, 29.98)).toEqual({
      id: CANCEL_MOVE_ID, kind: 'cancelSubscriptions', level: 1, category: 'subscriptions',
      patch: { spending: { subscriptions: 55.02 } },
    });
  });

  it('cannot go below zero, and cleans floating-point dust to the cent', () => {
    const profile = cloneProfileDemo();
    expect(cancelCandidate(profile, 120).patch).toEqual({ spending: { subscriptions: 0 } });
    expect(cancelCandidate({ ...profile, spending: { ...profile.spending, subscriptions: { value: 0.3, isEstimate: false } } }, 0.1).patch)
      .toEqual({ spending: { subscriptions: 0.2 } }); // 0.3 − 0.1 = 0.19999999999999998 in floating point
  });

  it('has an id the forecast route accepts and the engine reads as a level-1 cancelSubscriptions move', () => {
    expect(CANCEL_MOVE_ID).toMatch(/^[A-Za-z0-9:_.-]{1,96}$/);
    expect(CANCEL_MOVE_ID.split(':')[0]).toBe('cancelSubscriptions');
    expect(CANCEL_MOVE_ID).not.toBe('cancelSubscriptions'); // the engine's own candidate keeps its id
  });
});

describe('carryMarks', () => {
  const classOf = (label: string) => ruleClasses(statementItemsSample).find((c) => c.label === label)?.class;
  const { findings } = detectSubscriptions(statementItemsSample, { catalogue: testCatalogue, classOf });
  const ticks = [{ serviceId: 'netflix', planId: 'standard' }, { serviceId: 'disney-plus', planId: 'basic' }];

  it('keeps a mark on a finding that is still there, moves a tick mark to the finding of its service, keeps one the statement did not show', () => {
    expect(carryMarks(['spotify-usa-ny', 'tick:netflix', 'tick:disney-plus'], ticks, findings))
      .toEqual(['spotify-usa-ny', 'netflix-com-ca', 'tick:disney-plus']);
  });

  it('drops a mark that points at nothing: a finding that is gone, a tick of a service no longer ticked', () => {
    expect(carryMarks(['old-finding', 'tick:spotify', 'tick:gone'], ticks, findings)).toEqual([]);
  });

  it('lists an id once even when two marks end up on the same finding', () => {
    expect(carryMarks(['netflix-com-ca', 'tick:netflix'], ticks, findings)).toEqual(['netflix-com-ca']);
  });
});
