import { describe, expect, it } from 'vitest';
import { areaData } from './areas';
import {
  GEN_HOUSEHOLDS, GEN_PAY_BANDS, GEN_STYLES, generateStatement, generatorMetros, planStatement, type StatementSpec,
} from './statementGen';

const base: StatementSpec = { zip: '78744', household: 'family', pay: 'steady', style: 'typical', seed: 1, asOf: '2026-11-14' };

const rowsOf = (csv: string) => csv.trim().split('\n').slice(1).map((l) => l.split(','));

describe('generateStatement', () => {
  it('is deterministic: same spec and seed, same file', () => {
    expect(generateStatement(base).csv).toBe(generateStatement(base).csv);
    expect(generateStatement({ ...base, seed: 2 }).csv).not.toBe(generateStatement(base).csv);
  });

  it('writes the Big bank A layout, newest first, weekdays only, inside the window', () => {
    const g = generateStatement(base);
    const [header] = g.csv.split('\n');
    expect(header).toBe('Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #');
    const rows = rowsOf(g.csv);
    expect(rows.length).toBe(g.lines);
    const dates = rows.map((r) => {
      const [m, d, y] = r[1]!.split('/').map(Number);
      return Date.UTC(y!, m! - 1, d!);
    });
    for (let i = 1; i < dates.length; i++) expect(dates[i]!).toBeLessThanOrEqual(dates[i - 1]!);
    for (const t of dates) expect([0, 6]).not.toContain(new Date(t).getUTCDay());
    expect(g.from >= '2026-08-01').toBe(true);
    expect(g.to <= '2026-11-14').toBe(true);
    expect(rows.every((r) => r.length === 7)).toBe(true);
  });

  it('keeps a running balance that adds up', () => {
    const rows = rowsOf(generateStatement(base).csv).reverse();
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i]![5])).toBeCloseTo(Number(rows[i - 1]![5]) + Number(rows[i]![3]), 2);
    }
  });

  it('draws rent from the HUD figure for the ZIP and childcare from the county figure', () => {
    const area = areaData.find((a) => a.zip === base.zip)!;
    const plan = planStatement(base);
    expect(plan.monthly.rentUtilities).toBe(area.rentByBedrooms[2].value + 96);
    expect(plan.monthly.childcare).toBe(area.childcareMonthly!.toddler);
    expect(plan.sources.rent).toBe(area.rentByBedrooms[2].source.name);
    const rentLines = rowsOf(generateStatement(base).csv).filter((r) => r[2]!.includes(' RENT '));
    expect(rentLines).toHaveLength(4); // Aug, Sep, Oct, Nov
    for (const r of rentLines) expect(-Number(r[3])).toBe(Math.round((area.rentByBedrooms[2].value * 0.87) / 5) * 5);
  });

  it('pays the main earner every other Friday and a second earner twice a month', () => {
    const pay = rowsOf(generateStatement(base).csv).filter((r) => Number(r[3]) > 0);
    expect(pay.filter((r) => r[2]!.includes('PAYROLL')).length).toBeGreaterThanOrEqual(7);
    expect(pay.filter((r) => r[2]!.includes('DIR DEP')).length).toBeGreaterThanOrEqual(6);
  });

  it('runs for every metro, tier, household, pay band and style', () => {
    const zips = generatorMetros().flatMap((m) => m.tiers.map((t) => t.zip));
    expect(zips).toHaveLength(60);
    for (const zip of zips) for (const household of GEN_HOUSEHOLDS) for (const pay of GEN_PAY_BANDS) for (const style of GEN_STYLES) {
      const g = generateStatement({ zip, household, pay, style, seed: 7, asOf: '2026-11-14' });
      expect(g.lines).toBeGreaterThan(40);
      expect(g.csv).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('rejects a ZIP with no data and a malformed date', () => {
    expect(() => generateStatement({ ...base, zip: '00000' })).toThrow(RangeError);
    expect(() => generateStatement({ ...base, asOf: '11/14/2026' })).toThrow(RangeError);
  });
});
