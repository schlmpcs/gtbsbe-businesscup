// MP4 (#164): plan events. Expected numbers are worked out by hand in the comments.
import { describe, expect, it } from 'vitest';
import {
  PLAN_EVENT_TYPES, type LifeEvent, type PlanEvent, type PlanEventContext, type PlanEventOf, type Profile,
} from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { kidOtherMonthly, utilitiesMonthlyAverage } from './assumptions';
import { buyHomeBreakdown, defaultEvent, defaultEventSources, expandEvent } from './planEvents';

const area = areaByZip('75206')!; // the demo ZIP
// Demo profile: take-home $5,200, rentUtilities $1,950, childcare $0, other $450 (estimate).
const ctx = (profile: Profile = cloneProfileDemo()): PlanEventContext =>
  ({ profile, area, assumptions: scenarioDemo.assumptions, asOf: '2026-11' });

const home = (over: Partial<PlanEventOf<'buyHome'>> = {}): PlanEventOf<'buyHome'> => ({
  id: 'home', type: 'buyHome', year: 2028, enabled: true,
  homeValue: 400_000, downPayment: 80_000, payCash: false, termYears: 30, rate: 0.065,
  propertyTaxRate: 0.01, insuranceMonthly: { value: 150, isEstimate: true }, upkeepRate: 0.01, replaceHousing: true,
  ...over,
});

/** The `spending` event of `category` starting in `month`, or undefined. */
const spendingAt = (events: LifeEvent[], category: string, month: string) =>
  events.find((e) => e.kind === 'spending' && e.category === category && e.month === month);
const payAt = (events: LifeEvent[], month: string) => events.find((e) => e.kind === 'pay' && e.month === month);

describe('buyHomeBreakdown + expandEvent(buyHome)', () => {
  it('$400k, 20% down, 30 years at 6.5%: P&I $2,022.62, tax $333.33, total within $0.01', () => {
    // P = 400,000 − 80,000 = 320,000; r = 0.065 / 12; n = 360
    // P&I = P·r / (1 − (1 + r)^−360) = 1,733.33 / 0.856975 = 2,022.6177
    // tax = 400,000 × 0.01 / 12 = 333.33; insurance 150 → total = 2,022.62 + 333.33 + 150 = 2,505.95
    const b = buyHomeBreakdown(home());
    expect(b.principalAndInterest).toBeCloseTo(2022.62, 2);
    expect(b.propertyTax).toBeCloseTo(333.33, 2);
    expect(b.insurance).toBe(150);
    expect(Math.abs(b.total - (2022.62 + 333.33 + 150))).toBeLessThan(0.01);

    // The mortgage debt pays exactly the breakdown's P&I, from the purchase month.
    const x = expandEvent(home(), ctx());
    expect(x.debts).toEqual([
      { id: 'home:mortgage', kind: 'mortgage', balance: 320_000, apr: 0.065,
        minPayment: { value: b.principalAndInterest, isEstimate: false } },
    ]);
    expect(x.lifeEvents.filter((e) => e.kind === 'oneOff')).toEqual([
      { id: 'home:down', month: '2028-01', kind: 'oneOff', amount: 80_000, direction: 'cost' },
    ]);
    // asOf 2026-11 → 2028-01 is 14 months later.
    expect(x.assets).toEqual([{ group: 'realEstate', month: 14, value: 400_000 }]);
  });

  it('payCash: no debt, the one-off is the full home value', () => {
    const x = expandEvent(home({ payCash: true }), ctx());
    expect(x.debts).toEqual([]);
    expect(x.lifeEvents.filter((e) => e.kind === 'oneOff')).toEqual([
      { id: 'home:down', month: '2028-01', kind: 'oneOff', amount: 400_000, direction: 'cost' },
    ]);
    expect(buyHomeBreakdown(home({ payCash: true })).principalAndInterest).toBe(0);
  });

  it('replaceHousing: true replaces the rent line, false adds to it', () => {
    // Owner costs per month: tax 400,000 × 0.01 / 12 = 333.33 + insurance 150 + upkeep 400,000 × 0.01 / 12
    // = 333.33 + utilities min(1,950, 4,931 / 12 = 410.92) = 410.92 → 1,227.58.
    const owner = 400_000 * 0.01 / 12 + 150 + 400_000 * 0.01 / 12 + utilitiesMonthlyAverage.value;
    expect(owner).toBeCloseTo(1227.58, 2);
    const replaced = spendingAt(expandEvent(home(), ctx()).lifeEvents, 'rentUtilities', '2028-01');
    const added = spendingAt(expandEvent(home({ replaceHousing: false }), ctx()).lifeEvents, 'rentUtilities', '2028-01');
    expect(replaced?.kind === 'spending' && replaced.monthly.value).toBeCloseTo(1227.58, 2);
    // 1,950 rent kept + 1,227.58 = 3,177.58
    expect(added?.kind === 'spending' && added.monthly.value).toBeCloseTo(3177.58, 2);
  });
});

describe('expandEvent(haveKid)', () => {
  it('childcare stops after childcareYears; the other child costs last 18 years', () => {
    const kid: PlanEvent = {
      id: 'kid', type: 'haveKid', year: 2028, enabled: true,
      childcareMonthly: { value: 840.67, isEstimate: true }, childcareYears: 5, otherMonthly: { value: 800, isEstimate: true },
    };
    const { lifeEvents, debts, assets } = expandEvent(kid, ctx());
    expect(debts).toEqual([]);
    expect(assets).toEqual([]);
    // childcare: 0 today + 840.67 from 2028-01; back to 0 five years later, 2033-01.
    expect(spendingAt(lifeEvents, 'childcare', '2028-01')).toMatchObject({ monthly: { value: 840.67 } });
    expect(spendingAt(lifeEvents, 'childcare', '2033-01')).toMatchObject({ monthly: { value: 0 } });
    expect(lifeEvents.filter((e) => e.kind === 'spending' && e.category === 'childcare')).toHaveLength(2);
    // other: 450 + 800 = 1,250 from 2028-01; back to 450 eighteen years later, 2046-01.
    expect(spendingAt(lifeEvents, 'other', '2028-01')).toMatchObject({ monthly: { value: 1250 } });
    expect(spendingAt(lifeEvents, 'other', '2046-01')).toMatchObject({ monthly: { value: 450 } });
  });
});

describe('expandEvent(careerBreak)', () => {
  const pause: PlanEvent = { id: 'pause', type: 'careerBreak', year: 2029, enabled: true, endYear: 2030 };

  it('pay is 0 from the break, then the pay before it again', () => {
    const { lifeEvents } = expandEvent(pause, ctx());
    expect(payAt(lifeEvents, '2029-01')).toMatchObject({ takeHomePay: { value: 0 } });
    expect(payAt(lifeEvents, '2030-01')).toMatchObject({ takeHomePay: { value: 5_200 } }); // the demo take-home
  });

  it('restores the pay of a prior New job, not today’s pay', () => {
    const job: PlanEvent = { id: 'job', type: 'newJob', year: 2027, enabled: true, takeHomePay: 6_000 };
    const profile = { ...cloneProfileDemo(), asOf: '2026-11', events: expandEvent(job, ctx()).lifeEvents };
    const { lifeEvents } = expandEvent(pause, ctx(profile));
    expect(payAt(lifeEvents, '2029-01')).toMatchObject({ takeHomePay: { value: 0 } });
    expect(payAt(lifeEvents, '2030-01')).toMatchObject({ takeHomePay: { value: 6_000 } });
  });
});

describe('defaultEvent', () => {
  it('every default for the demo ZIP has a Source or isEstimate on each amount', () => {
    for (const type of PLAN_EVENT_TYPES) {
      const event = defaultEvent(type, ctx());
      const sources = defaultEventSources(type, ctx());
      expect(event.type).toBe(type);
      for (const [key, value] of Object.entries(event)) {
        if (key === 'year' || key === 'endYear') continue; // dates, not amounts
        const isEstimate = typeof value === 'object' && value !== null && 'isEstimate' in value
          ? (value as { isEstimate: boolean }).isEstimate : undefined;
        if (typeof value !== 'number' && isEstimate === undefined) continue; // ids, flags, cadence
        const source = sources[key];
        expect(isEstimate === true || (source !== undefined && source.name.length > 0 && source.year > 0),
          `${type}.${key}`).toBe(true);
      }
    }
    // The buy-home and kid defaults come from the ZIP's own data.
    expect(defaultEvent('buyHome', ctx())).toMatchObject({ homeValue: 615_400, downPayment: 123_080, propertyTaxRate: 0.01625 });
    expect(defaultEventSources('buyHome', ctx()).homeValue).toEqual(area.homeValueMedian!.source);
    expect(defaultEvent('haveKid', ctx())).toMatchObject({
      childcareMonthly: { value: 840.67, isEstimate: true }, otherMonthly: { value: kidOtherMonthly.value, isEstimate: true },
    });
  });
});

describe('disabled events', () => {
  it('expand to nothing', () => {
    for (const type of PLAN_EVENT_TYPES) {
      const event = { ...defaultEvent(type, ctx()), enabled: false } as PlanEvent;
      expect(expandEvent(event, ctx()), type).toEqual({ lifeEvents: [], debts: [], assets: [] });
    }
  });
});
