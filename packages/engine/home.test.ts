import { describe, expect, it } from 'vitest';
import type { AreaData, Home } from '@lifeguessr/types';
import { defaultHome, ownerCosts, tenureOf } from './home';

const src = { name: 'test', year: 2024 };
const home: Home = { tenure: 'mortgage', value: { value: 600_000, isEstimate: false }, appreciation: { value: 0.04, isEstimate: true }, hoaMonthly: 250 };

describe('ownerCosts (JF4)', () => {
  it('area rates: tax 600,000 × 1.2% / 12 = 600; insurance 150; upkeep 600,000 × 1% / 12 = 500; HOA 250; utilities 4,931 / 12', () => {
    const area = { propertyTaxRate: { value: 0.012, source: src }, homeInsuranceMonthly: { value: 150, source: src, isEstimate: true } } as AreaData;
    const c = ownerCosts(home, area);
    const by = Object.fromEntries(c.lines.map((l) => [l.key, l.monthly]));
    expect(by).toEqual({ propertyTax: 600, insurance: 150, upkeep: 500, hoa: 250, utilities: 4_931 / 12 });
    expect(c.total).toBeCloseTo(600 + 150 + 500 + 250 + 410.9167, 3);
    expect(c.lines.find((l) => l.key === 'propertyTax')!.source).toBe(src);
  });

  it('no area: 1% tax = 500, NAIC countrywide 1,737 / 12 insurance, all estimates except HOA', () => {
    const c = ownerCosts({ ...home, hoaMonthly: 0 });
    const by = Object.fromEntries(c.lines.map((l) => [l.key, l.monthly]));
    expect(by.propertyTax).toBe(500);
    expect(by.insurance).toBeCloseTo(144.75, 6);
    expect(c.lines.filter((l) => !l.isEstimate).map((l) => l.key)).toEqual(['hoa']);
  });
});

describe('defaultHome / tenureOf (JF4)', () => {
  it('rent has no home; own takes the area median and appreciation as estimates', () => {
    expect(defaultHome('rent')).toBeUndefined();
    const area = { homeValueMedian: { value: 615_400, source: src }, homeAppreciationAnnual: { value: 0.045, source: src } } as AreaData;
    expect(defaultHome('outright', area)).toEqual({
      tenure: 'outright', value: { value: 615_400, isEstimate: true }, appreciation: { value: 0.045, isEstimate: true }, hoaMonthly: 0,
    });
    expect(defaultHome('mortgage', undefined, 0.03)!.value.value).toBe(400_000);
    expect(defaultHome('mortgage', undefined, 0.03)!.appreciation.value).toBe(0.03);
    expect(tenureOf({})).toBe('rent');
    expect(tenureOf({ home })).toBe('mortgage');
  });
});
