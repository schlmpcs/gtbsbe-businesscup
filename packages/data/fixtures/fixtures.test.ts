import { describe, expect, it } from 'vitest';
import { AREA_TIERS } from '@lifeguessr/types';
import { areaByZip, areaDataSample, cardsSample, loanOffersSample, profileDemo } from './index';
import { readStatementSampleCsv } from './node';

describe('fixtures', () => {
  it('cover every area tier once', () => {
    expect(areaDataSample.map((a) => a.tier).sort()).toEqual([...AREA_TIERS].sort());
  });

  it('give every non-estimate data value a source with a URL', () => {
    for (const a of areaDataSample) {
      const sourced = [
        ...Object.values(a.rentByBedrooms), a.groceriesPerAdult, a.gasPerGallon, a.carInsuranceMonthly, a.cpiYoY,
      ];
      for (const s of sourced) {
        if (!s.isEstimate) expect(s.source.url, `${a.zip} ${s.source.name}`).toMatch(/^https:\/\//);
      }
      if (a.childcareMonthly) expect(a.childcareMonthly.source.url).toMatch(/^https:\/\//);
    }
  });

  it('have rent rising with bedrooms in every ZIP', () => {
    for (const a of areaDataSample) {
      const rents = ([0, 1, 2, 3, 4] as const).map((b) => a.rentByBedrooms[b].value);
      expect(rents).toEqual([...rents].sort((x, y) => x - y));
    }
  });

  it('only use ZIPs that exist in the area fixtures, and have unique card ids', () => {
    for (const c of cardsSample) expect(() => areaByZip(c.zip)).not.toThrow();
    expect(new Set(cardsSample.map((c) => c.id)).size).toBe(cardsSample.length);
    expect(cardsSample.length).toBeGreaterThanOrEqual(5);
  });

  it('include a demo profile with a card debt, an auto loan and estimated fields', () => {
    expect(profileDemo.debts.map((d) => d.kind).sort()).toEqual(['auto', 'card']);
    expect(Object.values(profileDemo.spending).some((s) => s.isEstimate)).toBe(true);
    expect(() => {
      (profileDemo as { doneMoveIds: string[] }).doneMoveIds.push('x');
    }).toThrow();
  });

  it('include three loan offers', () => {
    expect(loanOffersSample).toHaveLength(3);
  });

  it('include a statement with at least 4 full months, paychecks and person-to-person lines', () => {
    const lines = readStatementSampleCsv().trim().split('\n');
    expect(lines[0]).toBe('Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #');
    const months = new Set(lines.slice(1).map((l) => l.split(',')[1]!.slice(0, 2)));
    expect(months.size).toBeGreaterThanOrEqual(5); // Jul–Oct full + Nov partial
    expect(lines.some((l) => l.includes('PAYROLL'))).toBe(true);
    expect(lines.some((l) => /Zelle payment (to|from) [A-Z][a-z]+ [A-Z][a-z]+/.test(l))).toBe(true);
    expect(lines.some((l) => /VENMO/i.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('AMAZON PRIME'))).toBe(true);
  });
});
