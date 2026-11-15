// What-if field: parsed items → PlanEvents. Expected numbers are worked out by hand from the fixture
// area data (areaData.sample.json, Dallas-Fort Worth 75206 'mid': 1-bed rent $1,900, 2-bed $2,230, car
// insurance $150, gas $3.408, infant childcare $840.67, median home value $615,400) and synthetic metros
// built from it with only the fields named below changed. Default household (no householdFacts):
// 1 adult, no kids, 1 bedroom, a car (45 gal/month); groceries and eating out are the same everywhere
// here, so the move delta is rent + car insurance + fuel (+ childcare with kids).
import { describe, expect, it } from 'vitest';
import type { AreaData, PlanEvent, PlanEventContext, Profile, WhatIfItem } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { whatIfEvent, whatIfEvents } from './whatIf';

const dallasMid = areaByZip('75206');
const dallasCheap = areaByZip('75216');

/** A synthetic area: `base` with a new metro/ZIP/tier and the given rents, car insurance, gas, infant childcare. */
function area(
  base: AreaData,
  over: { zip: string; metro: string; tier: AreaData['tier']; rent: Partial<Record<0 | 1 | 2 | 3 | 4, number>>;
    carInsurance: number; gas: number; infant?: number },
): AreaData {
  const rentByBedrooms = { ...base.rentByBedrooms };
  for (const [b, v] of Object.entries(over.rent)) {
    const k = Number(b) as 0 | 1 | 2 | 3 | 4;
    rentByBedrooms[k] = { ...rentByBedrooms[k], value: v };
  }
  return {
    ...base, zip: over.zip, metro: over.metro, tier: over.tier, rentByBedrooms,
    carInsuranceMonthly: { ...base.carInsuranceMonthly, value: over.carInsurance },
    gasPerGallon: { ...base.gasPerGallon, value: over.gas },
    ...(over.infant !== undefined && { childcareMonthly: { ...base.childcareMonthly!, infant: over.infant } }),
  };
}

// Denver mid: 1-bed 2,400 (+500), 2-bed 2,700 (+470), insurance 170 (+20), gas 3.808 (+0.40 × 45 = +18), infant 1,000 (+159.33).
const denverMid = area(dallasMid, { zip: '80205', metro: 'Denver, CO', tier: 'mid', rent: { 1: 2400, 2: 2700 }, carInsurance: 170, gas: 3.808, infant: 1000 });
// Denver cheap: 1-bed 1,300 vs Dallas cheap 1,100 (+200), same insurance/gas changes as Denver mid.
const denverCheap = area(dallasCheap, { zip: '80219', metro: 'Denver, CO', tier: 'cheap', rent: { 1: 1300 }, carInsurance: 170, gas: 3.808 });
// Houston mid: 1-bed 1,500 (−400), insurance and gas as Dallas.
const houstonMid = area(dallasMid, { zip: '77008', metro: 'Houston, TX', tier: 'mid', rent: { 1: 1500 }, carInsurance: 150, gas: 3.408 });
const areas: AreaData[] = [dallasCheap, dallasMid, denverCheap, denverMid, houstonMid];

const asOf = '2026-11';
const profile = { ...structuredClone(profileDemo), asOf } as Profile; // age 32 → born 1994
const ctx: PlanEventContext = { profile, area: dallasMid, assumptions: scenarioDemo.assumptions, asOf };

const expenseAmount = (e: PlanEvent | null | undefined) => (e?.type === 'expense' ? e.amount : NaN);
const incomeMonthly = (e: PlanEvent | null | undefined) => (e?.type === 'income' ? e.monthly : NaN);

const item = (over: Partial<WhatIfItem> & Pick<WhatIfItem, 'type'>): WhatIfItem =>
  ({ year: null, label: 'x', metro: null, amount: null, cadence: null, endYear: null, ...over });

describe('whatIfEvents: non-move items', () => {
  it('a kid in 2029: the default kid event (area infant childcare) in 2029, named by the label', () => {
    const [e] = whatIfEvents([item({ type: 'haveKid', year: 2029, label: 'A kid' })], ctx, areas);
    expect(e).toMatchObject({
      type: 'haveKid', year: 2029, name: 'A kid', enabled: true, childcareYears: 5,
      childcareMonthly: { value: 840.67, isEstimate: true },
    });
  });

  it('no year: next year; Retire defaults to birth year + retire age (1994 + 67)', () => {
    const events = whatIfEvents([item({ type: 'windfall' }), item({ type: 'retire' })], ctx, areas);
    expect(events.map((e) => e.year)).toEqual([2027, 2061]);
  });

  it('a stated amount overrides the default', () => {
    const events = whatIfEvents(
      [
        item({ type: 'buyHome', year: 2033, amount: 375_000 }),
        item({ type: 'windfall', amount: 20_000 }),
        item({ type: 'newJob', amount: 6_000 }),
        item({ type: 'income', amount: 800, endYear: 2030 }),
        item({ type: 'expense', amount: 300, cadence: 'monthly', endYear: 2030 }),
        item({ type: 'expense', amount: 1_200 }),
      ],
      ctx,
      areas,
    );
    expect(events[0]).toMatchObject({ type: 'buyHome', year: 2033, homeValue: 375_000, downPayment: 75_000 }); // 20% kept
    expect(events[1]).toMatchObject({ type: 'windfall', amount: 20_000 });
    expect(events[2]).toMatchObject({ type: 'newJob', takeHomePay: 6_000 });
    expect(events[3]).toMatchObject({ type: 'income', monthly: 800, endYear: 2030 });
    expect(events[4]).toMatchObject({ type: 'expense', amount: 300, cadence: 'monthly', endYear: 2030 });
    expect(events[5]).toMatchObject({ type: 'expense', amount: 1_200, cadence: 'once' });
  });

  it('no amount: the default amount (home value = area median, 20% down)', () => {
    const [e] = whatIfEvents([item({ type: 'buyHome' })], ctx, areas);
    expect(e).toMatchObject({ homeValue: 615_400, downPayment: 123_080 });
  });

  it('a career break moved to 2030 keeps its one-year length', () => {
    const [e] = whatIfEvents([item({ type: 'careerBreak', year: 2030 })], ctx, areas);
    expect(e).toMatchObject({ type: 'careerBreak', year: 2030, endYear: 2031 });
  });

  it('ids are unique per item', () => {
    const events = whatIfEvents([item({ type: 'windfall' }), item({ type: 'windfall' })], ctx, areas);
    expect(new Set(events.map((e) => e.id)).size).toBe(2);
  });
});

describe('whatIfEvents: move', () => {
  it('to a costlier metro: a monthly expense of the cost-of-living delta (500 + 20 + 18 = 538)', () => {
    const [e] = whatIfEvents([item({ type: 'move', year: 2028, metro: 'Denver, CO', label: 'Move to Denver' })], ctx, areas);
    expect(e).toMatchObject({ type: 'expense', cadence: 'monthly', year: 2028, name: 'Move to Denver', enabled: true });
    expect(expenseAmount(e)).toBeCloseTo(538, 6);
  });

  it('to a cheaper metro: a monthly income of the money it frees (1,900 − 1,500 = 400)', () => {
    const [e] = whatIfEvents([item({ type: 'move', metro: 'Houston, TX' })], ctx, areas);
    expect(e).toMatchObject({ type: 'income', year: 2027 });
    expect(incomeMonthly(e)).toBeCloseTo(400, 6);
  });

  it('keeps the current tier: cheap Dallas → cheap Denver (200 + 20 + 18 = 238)', () => {
    const e = whatIfEvent(item({ type: 'move', metro: 'Denver' }), 0, { ...ctx, area: dallasCheap }, areas);
    expect(expenseAmount(e)).toBeCloseTo(238, 6);
  });

  it("costs the person's household: 2 adults, an infant, 2 bedrooms (470 + 159.33 + 20 + 18 = 667.33)", () => {
    const withKid = { ...profile, householdFacts: { adults: 2 as const, kids: ['infant' as const], bedrooms: 2 as const, hasCar: true } };
    const e = whatIfEvent(item({ type: 'move', metro: 'Denver, CO' }), 0, { ...ctx, profile: withKid }, areas);
    expect(expenseAmount(e)).toBeCloseTo(667.33, 6);
  });

  it('no current area: the mid-tier area of the median metro (Houston < Dallas < Denver → Dallas) is the baseline', () => {
    const { area: _drop, ...noArea } = ctx;
    const e = whatIfEvent(item({ type: 'move', metro: 'Denver, CO' }), 0, noArea, areas);
    expect(expenseAmount(e)).toBeCloseTo(538, 6);
  });

  it('an unknown metro, or no metro, is skipped', () => {
    const events = whatIfEvents(
      [item({ type: 'move', metro: 'Boise, ID' }), item({ type: 'move' }), item({ type: 'haveKid' })],
      ctx,
      areas,
    );
    expect(events.map((e) => e.type)).toEqual(['haveKid']);
  });
});
