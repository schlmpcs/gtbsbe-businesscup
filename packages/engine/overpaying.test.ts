import { describe, expect, it } from 'vitest';
import { areaDataSample, cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { OverpayingResultSchema } from '@lifeguessr/types';
import { overpayingCheck } from './overpaying';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';
const area = areaDataSample[0]!;
const input = { bedrooms: 2 as const, adults: 2 as const, kids: [] };
describe('overpayingCheck', () => {
  it('uses sourced rent ratios and exact gaps with inclusive boundaries', () => {
    const mid = area.rentByBedrooms[2].value;
    const a = {
      ...area,
      rentRangeRatio: {
        low: 0.8,
        high: 1.2,
        source: area.rentByBedrooms[2].source,
      },
    };
    for (const [rent, position] of [
      [mid * 0.7, 'below'],
      [mid, 'inRange'],
      [mid * 1.2, 'inRange'],
      [mid * 1.5, 'above'],
    ] as const) {
      const result = overpayingCheck({ ...input, rent }, a),
        line = result.lines[0]!;
      expect(line.typical).toEqual({ low: mid * 0.8, mid, high: mid * 1.2 });
      expect(line.position).toBe(position);
      expect(line.gapPerMonth).toBeCloseTo(
        position === 'above' ? mid * 0.3 : 0,
      );
      expect(line.gapPerYear).toBeCloseTo(line.gapPerMonth * 12);
      expect(line.effect10y).toBe(0);
      expect(OverpayingResultSchema.safeParse(result).success).toBe(true);
    }
  });
  it('marks fallback ranges and metro data estimated', () => {
    const a = { ...area, rentRangeRatio: undefined };
    const line = overpayingCheck({ ...input, rent: 1000 }, a, undefined, {
      coverage: 'metro',
    }).lines[0]!;
    expect(line.typical.low).toBe(area.rentByBedrooms[2].value * 0.8);
    expect(line.isEstimate).toBe(true);
    expect(line.source).toEqual(area.rentByBedrooms[2].source);
  });
  it('uses the shared kid factor and skips missing childcare', () => {
    const result = overpayingCheck(
      { ...input, kids: ['infant'], groceries: 2000, childcare: 2000 },
      area,
    );
    expect(
      result.lines.find((l) => l.line === 'groceries')!.typical.mid,
    ).toBeCloseTo(area.groceriesPerAdult.value * 2.7);
    expect(
      overpayingCheck({ ...input, childcare: 1000 }, area).skipped,
    ).toContainEqual({ line: 'childcare', reason: 'noData' });
  });
  it('does not substitute uncovered areas and distinguishes blank from missing data', () => {
    const result = overpayingCheck({ ...input, rent: 1000 }, null);
    expect(result.coverage).toBe('none');
    expect(result.lines).toEqual([]);
    expect(result.skipped).toContainEqual({ line: 'rent', reason: 'noData' });
    expect(result.skipped).toContainEqual({
      line: 'groceries',
      reason: 'notEntered',
    });
  });
  it('computes the insurance delta without removing fuel and upkeep', () => {
    const p = cloneProfileDemo();
    p.spending.car.value = 800;
    const result = overpayingCheck({ ...input, carInsurance: 500 }, area, p),
      line = result.lines[0]!;
    const opts = {
      todaysDollars: true,
      rates: { inflationAnnual: inflationAnnualOf(area) },
    };
    const changed = applyPatch(p, {
      spending: { car: 800 - (500 - area.carInsuranceMonthly.value) },
    });
    expect(line.effect10y).toBeCloseTo(
      forecast(changed, 10, opts).in10y.mid - forecast(p, 10, opts).in10y.mid,
    );
    p.spending.car.value = 0;
    expect(
      overpayingCheck({ ...input, carInsurance: 500 }, area, p).lines[0]!
        .effect10y,
    ).toBe(0);
  });
  it('rejects malformed entries and schema money', () => {
    for (const rent of [0, -1, NaN, Infinity])
      expect(() => overpayingCheck({ ...input, rent }, area)).toThrow(
        RangeError,
      );
    const result = overpayingCheck({ ...input, rent: 1000 }, area);
    expect(
      OverpayingResultSchema.safeParse({
        ...result,
        lines: [{ ...result.lines[0], yours: -1 }],
      }).success,
    ).toBe(false);
    expect(
      OverpayingResultSchema.safeParse({
        ...result,
        lines: [{ ...result.lines[0], effect10y: Infinity }],
      }).success,
    ).toBe(false);
  });
});
